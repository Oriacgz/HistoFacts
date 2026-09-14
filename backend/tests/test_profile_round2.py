"""
Tests for Profile Settings, Round 2.
Covers Tier 1 (Session Management, Account Deletion & Data Export, 2FA TOTP & Backup Codes),
Tier 2 (Preferences JSON column, Avatar fallback), and Tier 3 (Blocked Users, Notification Type Toggles, Profile Visibility).
"""

import io
import zipfile
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from app.auth.models import User, UserSession, TwoFactorAuth, Friend
from app.core.totp import get_totp_token, decrypt_totp_secret
from app.notification.models import Notification
from app.social.models import Post, Comment, UserSummaryCache


# ── Tier 1: Session Management Tests ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_session_management_and_revocation_enforcement(client: AsyncClient):
    """
    Test:
    1. Register creates an active session.
    2. GET /api/auth/users/me/sessions (and /users/me/sessions) returns sessions with is_current=True.
    3. Login from a second device creates a second session.
    4. DELETE /api/auth/users/me/sessions/{id} revokes the second session.
    5. Token refresh with the revoked session fails with 401.
    6. Token refresh with the active session still succeeds.
    """
    # 1. Register User on Device 1
    reg1 = await client.post(
        "/api/auth/register",
        json={"username": "SessionUser", "email": "session@example.com", "password": "Password123!"},
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0"},
    )
    assert reg1.status_code == 201
    tok1 = reg1.json()["access_token"]
    ref1 = reg1.json()["refresh_token"]
    h1 = {"Authorization": f"Bearer {tok1}"}

    # 2. Check sessions list
    sess_res = await client.get("/api/auth/users/me/sessions", headers=h1)
    assert sess_res.status_code == 200
    sessions = sess_res.json()
    assert len(sessions) == 1
    assert sessions[0]["is_current"] is True
    assert "Chrome on Windows" in sessions[0]["device_label"]

    # Also check /users/me/sessions alias
    sess_alias = await client.get("/users/me/sessions", headers=h1)
    assert sess_alias.status_code == 200
    assert len(sess_alias.json()) == 1

    # 3. Login from Device 2
    login2 = await client.post(
        "/api/auth/login",
        json={"email": "session@example.com", "password": "Password123!"},
        headers={"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile Safari/604.1"},
    )
    assert login2.status_code == 200
    tok2 = login2.json()["access_token"]
    ref2 = login2.json()["refresh_token"]
    h2 = {"Authorization": f"Bearer {tok2}"}

    # Device 1 sees 2 sessions
    sess_list2 = await client.get("/api/auth/users/me/sessions", headers=h1)
    assert len(sess_list2.json()) == 2
    s2 = next(s for s in sess_list2.json() if not s["is_current"])
    s2_id = s2["id"]

    # 4. Device 1 revokes Device 2's session
    del_res = await client.delete(f"/api/auth/users/me/sessions/{s2_id}", headers=h1)
    assert del_res.status_code == 204

    # Device 2's session now disappears from active sessions list
    sess_list3 = await client.get("/api/auth/users/me/sessions", headers=h1)
    assert len(sess_list3.json()) == 1
    assert all(s["id"] != s2_id for s in sess_list3.json())

    # 5. Refresh attempt using revoked token MUST FAIL with 401
    fail_refresh = await client.post("/api/auth/refresh", json={"refresh_token": ref2})
    assert fail_refresh.status_code == 401
    assert "revoked" in fail_refresh.json()["detail"].lower()

    # 6. Refresh attempt using active token succeeds
    ok_refresh = await client.post("/api/auth/refresh", json={"refresh_token": ref1})
    assert ok_refresh.status_code == 200
    assert "access_token" in ok_refresh.json()


# ── Tier 1: Two-Factor Authentication Tests ───────────────────────────────────

@pytest.mark.asyncio
async def test_two_factor_auth_totp_and_backup_codes(client: AsyncClient, db_session):
    """
    Test:
    1. Setup 2FA generates secret, otpauth URI, and 10 backup codes.
    2. Backup codes are hashed at rest in DB.
    3. Live code activation enables 2FA.
    4. Subsequent login without TOTP code fails with 403 2FA_REQUIRED.
    5. Login with invalid TOTP code fails with 401.
    6. Login with valid TOTP code succeeds.
    7. Login with one backup code succeeds and consumes it (single-use).
    8. Attempting to use the SAME backup code a second time fails with 401.
    9. Disable 2FA with password restores standard login.
    """
    reg = await client.post(
        "/api/auth/register",
        json={"username": "TwoFaUser", "email": "2fa@example.com", "password": "SecurePassword123!"},
    )
    tok = reg.json()["access_token"]
    user_id = reg.json()["user"]["id"]
    headers = {"Authorization": f"Bearer {tok}"}

    # 1. Setup 2FA
    setup_res = await client.post("/api/auth/users/me/2fa/setup", headers=headers)
    assert setup_res.status_code == 200
    setup_data = setup_res.json()
    secret = setup_data["secret"]
    backup_codes = setup_data["backup_codes"]
    assert len(backup_codes) == 10
    assert setup_data["otpauth_uri"].startswith("otpauth://totp/")

    # 2. Verify backup codes are hashed in DB
    tfa_row = (await db_session.execute(select(TwoFactorAuth).where(TwoFactorAuth.user_id == user_id))).scalar_one()
    assert tfa_row.enabled is False
    assert len(tfa_row.backup_codes_hashed) == 10
    assert all(c not in tfa_row.backup_codes_hashed for c in backup_codes)  # Hashes, not plain

    # 3. Enable 2FA with invalid code
    bad_enable = await client.post("/api/auth/users/me/2fa/enable", json={"code": "000000"}, headers=headers)
    assert bad_enable.status_code == 400

    # Enable 2FA with valid TOTP code
    valid_code = get_totp_token(secret)
    ok_enable = await client.post("/api/auth/users/me/2fa/enable", json={"code": valid_code}, headers=headers)
    assert ok_enable.status_code == 200

    # Status shows enabled
    status_res = await client.get("/api/auth/users/me/2fa/status", headers=headers)
    assert status_res.json()["enabled"] is True
    assert status_res.json()["backup_codes_remaining"] == 10

    # 4. Login without TOTP code -> 403 2FA_REQUIRED
    login_no_code = await client.post(
        "/api/auth/login",
        json={"email": "2fa@example.com", "password": "SecurePassword123!"},
    )
    assert login_no_code.status_code == 403
    assert login_no_code.json()["detail"] == "2FA_REQUIRED"

    # 5. Login with invalid TOTP code -> 401
    login_bad_code = await client.post(
        "/api/auth/login",
        json={"email": "2fa@example.com", "password": "SecurePassword123!", "totp_code": "999999"},
    )
    assert login_bad_code.status_code == 401

    # 6. Login with valid TOTP code -> 200
    live_code = get_totp_token(secret)
    login_ok = await client.post(
        "/api/auth/login",
        json={"email": "2fa@example.com", "password": "SecurePassword123!", "totp_code": live_code},
    )
    assert login_ok.status_code == 200
    assert "access_token" in login_ok.json()

    # 7. Login with backup code (first code) -> 200
    used_backup_code = backup_codes[0]
    login_backup = await client.post(
        "/api/auth/login",
        json={"email": "2fa@example.com", "password": "SecurePassword123!", "totp_code": used_backup_code},
    )
    assert login_backup.status_code == 200

    # Check that remaining backup codes is now 9
    status_after_backup = await client.get("/api/auth/users/me/2fa/status", headers=headers)
    assert status_after_backup.json()["backup_codes_remaining"] == 9

    # 8. Re-use of the exact same backup code MUST FAIL (one-time use)
    login_backup_reuse = await client.post(
        "/api/auth/login",
        json={"email": "2fa@example.com", "password": "SecurePassword123!", "totp_code": used_backup_code},
    )
    assert login_backup_reuse.status_code == 401

    # 9. Disable 2FA
    disable_res = await client.post(
        "/api/auth/users/me/2fa/disable",
        json={"code": "SecurePassword123!"},
        headers=headers,
    )
    assert disable_res.status_code == 200

    # Normal login now works without code
    login_plain = await client.post(
        "/api/auth/login",
        json={"email": "2fa@example.com", "password": "SecurePassword123!"},
    )
    assert login_plain.status_code == 200


# ── Tier 1: Account Deletion Grace Period & Execution ─────────────────────────

@pytest.mark.asyncio
async def test_account_deletion_grace_period_and_execution(client: AsyncClient, db_session):
    """
    Test:
    1. User schedules account deletion with 30-day grace period.
    2. Logging back in during grace period cancels the scheduled deletion.
    3. Explicit execution permanently anonymizes user, deletes personal records,
       and keeps posts visible with anonymized authorship.
    """
    reg = await client.post(
        "/api/auth/register",
        json={"username": "DelUser", "email": "del@example.com", "password": "Password123!"},
    )
    tok = reg.json()["access_token"]
    user_id = reg.json()["user"]["id"]
    headers = {"Authorization": f"Bearer {tok}"}

    # 1. Schedule deletion
    del_req = await client.post("/api/auth/users/me/delete", headers=headers)
    assert del_req.status_code == 200
    assert del_req.json()["status"] == "scheduled"
    assert del_req.json()["deletion_scheduled_at"] is not None

    # Check user row has deletion_scheduled_at
    user_row = (await db_session.execute(select(User).where(User.id == user_id))).scalar_one()
    assert user_row.deletion_scheduled_at is not None

    # 2. Logging in cancels the scheduled deletion (reversible)
    login_res = await client.post(
        "/api/auth/login",
        json={"email": "del@example.com", "password": "Password123!"},
    )
    assert login_res.status_code == 200
    assert login_res.json()["user"]["deletion_scheduled_at"] is None

    # 3. Create a post by DelUser to test thread preservation
    new_post = Post(user_id=user_id, title="Ancient Rome", content="The Roman Senate debated today.")
    db_session.add(new_post)
    cache_row = UserSummaryCache(user_id=user_id, username="DelUser", tag="0001", bio="History buff")
    db_session.add(cache_row)
    await db_session.commit()
    post_id = new_post.id

    # 4. Immediate execution of account deletion
    exec_res = await client.post("/api/auth/users/me/delete/execute", headers=headers)
    assert exec_res.status_code == 200

    # 5. Check post still exists (thread not broken)
    post_in_db = (await db_session.execute(
        select(Post).where(Post.id == post_id).execution_options(populate_existing=True)
    )).scalar_one_or_none()
    assert post_in_db is not None
    assert post_in_db.content == "The Roman Senate debated today."

    # Cache row is anonymized to 'Deleted User'
    cache_in_db = (await db_session.execute(
        select(UserSummaryCache).where(UserSummaryCache.user_id == user_id).execution_options(populate_existing=True)
    )).scalar_one_or_none()
    assert cache_in_db is not None
    assert cache_in_db.username == "Deleted User"
    assert cache_in_db.bio is None

    # Auth User row is anonymized
    user_after = (await db_session.execute(
        select(User).where(User.id == user_id).execution_options(populate_existing=True)
    )).scalar_one()
    assert user_after.email == f"deleted-{user_id}@deleted.local"
    assert user_after.username == "Deleted User"
    assert user_after.bio is None
    assert user_after.password_hash == "DELETED"

    # All sessions revoked
    sessions = (await db_session.execute(select(UserSession).where(UserSession.user_id == user_id))).scalars().all()
    assert all(s.revoked_at is not None for s in sessions)


# ── Tier 1: Data Export ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_data_export_zip(client: AsyncClient):
    """Test GET /api/auth/users/me/export streams a valid ZIP containing user JSON files."""
    reg = await client.post(
        "/api/auth/register",
        json={"username": "ExportUser", "email": "export@example.com", "password": "Password123!"},
    )
    tok = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {tok}"}

    export_res = await client.get("/api/auth/users/me/export", headers=headers)
    assert export_res.status_code == 200
    assert export_res.headers["content-type"] == "application/zip"

    # Validate zip file contents
    zip_bytes = export_res.content
    with zipfile.ZipFile(io.BytesIO(zip_bytes), "r") as zf:
        namelist = zf.namelist()
        assert "profile.json" in namelist
        assert "social.json" in namelist
        assert "quiz.json" in namelist
        assert "ai_notes.json" in namelist


# ── Tier 2: Preferences (Single JSON Column) ──────────────────────────────────

@pytest.mark.asyncio
async def test_preferences_stored_in_single_json_column(client: AsyncClient, db_session):
    """
    Test:
    1. PATCH /api/auth/users/me/preferences (and /users/me/preferences) modifies user.preferences.
    2. No separate column is created — theme, language, and notification_prefs reside in the single JSON column.
    """
    reg = await client.post(
        "/api/auth/register",
        json={"username": "PrefUser", "email": "pref@example.com", "password": "Password123!"},
    )
    tok = reg.json()["access_token"]
    user_id = reg.json()["user"]["id"]
    headers = {"Authorization": f"Bearer {tok}"}

    # Update preferences
    patch_res = await client.patch(
        "/api/auth/users/me/preferences",
        json={
            "theme": "dark",
            "language": "es",
            "notification_prefs": {"comment_reply": True, "note_ready": False},
        },
        headers=headers,
    )
    assert patch_res.status_code == 200
    data = patch_res.json()["preferences"]
    assert data["theme"] == "dark"
    assert data["language"] == "es"
    assert data["notification_prefs"] == {"comment_reply": True, "note_ready": False}

    # Verify directly from DB User model: stored in the single preferences column
    user_db = (await db_session.execute(select(User).where(User.id == user_id))).scalar_one()
    assert isinstance(user_db.preferences, dict)
    assert user_db.preferences["theme"] == "dark"
    assert user_db.preferences["language"] == "es"
    assert user_db.preferences["notification_prefs"]["note_ready"] is False

    # Get preferences endpoint
    get_res = await client.get("/api/auth/users/me/preferences", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["theme"] == "dark"


# ── Tier 3: Per-Notification-Type Toggles ─────────────────────────────────────

@pytest.mark.asyncio
async def test_notification_toggle_skips_row_creation(client: AsyncClient, db_session):
    """
    Test: Disabling a notification type in preferences prevents the notification row
    from ever being created in the database (saves a write).
    """
    reg = await client.post(
        "/api/auth/register",
        json={"username": "NotifToggleUser", "email": "toggle@example.com", "password": "Password123!"},
    )
    tok = reg.json()["access_token"]
    user_id = reg.json()["user"]["id"]
    headers = {"Authorization": f"Bearer {tok}"}

    # Disable 'note_ready' notifications
    await client.patch(
        "/api/auth/users/me/preferences",
        json={"notification_prefs": {"note_ready": False, "comment_reply": True}},
        headers=headers,
    )

    # 1. Attempt to create 'note_ready' notification -> should be skipped (204 or skipped)
    skip_res = await client.post(
        "/internal/notifications",
        json={
            "user_id": user_id,
            "type": "note_ready",
            "payload": {"title": "Skipped Note"},
        },
    )
    assert skip_res.status_code == 204

    # Assert NO row created in DB
    notif_rows = (await db_session.execute(select(Notification).where(Notification.user_id == user_id))).scalars().all()
    assert len(notif_rows) == 0

    # 2. Attempt to create enabled 'comment_reply' notification -> created (201)
    create_res = await client.post(
        "/internal/notifications",
        json={
            "user_id": user_id,
            "type": "comment_reply",
            "payload": {"from": "Historian"},
        },
    )
    assert create_res.status_code == 201

    # Assert exactly 1 row created in DB
    notif_rows2 = (await db_session.execute(select(Notification).where(Notification.user_id == user_id))).scalars().all()
    assert len(notif_rows2) == 1
    assert notif_rows2[0].type == "comment_reply"


# ── Tier 3: Blocked Users ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_blocked_users_flow(client: AsyncClient, db_session):
    """
    Test:
    1. User A and User B become friends.
    2. User A blocks User B: friendship removed, status='blocked'.
    3. User B cannot send a friend request to User A (rejected with 400).
    4. User B does not appear in User A's search results.
    5. GET /api/auth/users/me/blocked lists User B.
    6. User A unblocks User B: User B reappears in search results.
    """
    # Register Alice (A)
    reg_a = await client.post("/api/auth/register", json={"username": "AliceBlocker", "email": "alice_b@example.com", "password": "Password123!"})
    tok_a = reg_a.json()["access_token"]
    user_a = reg_a.json()["user"]
    h_a = {"Authorization": f"Bearer {tok_a}"}

    # Register Bob (B)
    reg_b = await client.post("/api/auth/register", json={"username": "BobBlocked", "email": "bob_b@example.com", "password": "Password123!"})
    tok_b = reg_b.json()["access_token"]
    user_b = reg_b.json()["user"]
    h_b = {"Authorization": f"Bearer {tok_b}"}

    # Become friends
    req = await client.post("/api/auth/friends/request", json={"addressee_id": user_b["id"]}, headers=h_a)
    req_id = req.json()["id"]
    await client.post(f"/api/auth/friends/requests/{req_id}/accept", headers=h_b)

    # Verify friendship exists
    friends_a = await client.get("/api/auth/friends", headers=h_a)
    assert any(f["id"] == user_b["id"] for f in friends_a.json())

    # 2. Alice blocks Bob
    block_res = await client.post(f"/api/auth/users/{user_b['id']}/block", headers=h_a)
    assert block_res.status_code == 200

    # Friendship removed
    friends_after = await client.get("/api/auth/friends", headers=h_a)
    assert all(f["id"] != user_b["id"] for f in friends_after.json())

    # 3. Bob tries to send a friend request to Alice -> 400 rejected
    req_blocked = await client.post("/api/auth/friends/request", json={"addressee_id": user_a["id"]}, headers=h_b)
    assert req_blocked.status_code == 400
    assert "blocked" in req_blocked.json()["detail"].lower()

    # 4. Search exclusion: Alice searching for Bob returns nothing
    search_res = await client.get("/api/auth/search?q=BobBlocked", headers=h_a)
    assert len(search_res.json()) == 0

    # 5. List blocked users: Alice sees Bob
    blocked_list = await client.get("/api/auth/users/me/blocked", headers=h_a)
    assert blocked_list.status_code == 200
    assert any(u["id"] == user_b["id"] for u in blocked_list.json())

    # 6. Alice unblocks Bob
    unblock_res = await client.delete(f"/api/auth/users/{user_b['id']}/block", headers=h_a)
    assert unblock_res.status_code == 204

    # Alice searching for Bob now finds him
    search_unblocked = await client.get("/api/auth/search?q=BobBlocked", headers=h_a)
    assert any(u["id"] == user_b["id"] for u in search_unblocked.json())


# ── Tier 3: Profile Visibility ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_profile_visibility_single_check(client: AsyncClient):
    """
    Test:
    profile_visibility ('public', 'friends_only', 'private') is evaluated once per view.
    When private: bio, quiz_stats, and activity_history are all hidden from others.
    When self views private profile: all fields are visible.
    When friends_only: hidden from strangers, visible once accepted as a friend.
    """
    # User A (Alice)
    reg_a = await client.post("/api/auth/register", json={"username": "AliceVis", "email": "alice_v@example.com", "password": "Password123!"})
    tok_a = reg_a.json()["access_token"]
    user_a_id = reg_a.json()["user"]["id"]
    h_a = {"Authorization": f"Bearer {tok_a}"}

    # Alice sets bio
    await client.patch("/api/auth/me", json={"bio": "Secret historian biography"}, headers=h_a)

    # User B (Bob - Stranger)
    reg_b = await client.post("/api/auth/register", json={"username": "BobVis", "email": "bob_v@example.com", "password": "Password123!"})
    tok_b = reg_b.json()["access_token"]
    h_b = {"Authorization": f"Bearer {tok_b}"}

    # 1. Public visibility (default)
    p_public = await client.get(f"/api/auth/users/{user_a_id}/profile", headers=h_b)
    assert p_public.status_code == 200
    assert p_public.json()["bio"] == "Secret historian biography"
    assert p_public.json()["quiz_stats"] is not None

    # 2. Alice sets profile_visibility="private"
    await client.patch("/api/auth/me", json={"profile_visibility": "private"}, headers=h_a)

    # Bob views Alice: bio, stats, history all hidden at once
    p_private_bob = await client.get(f"/api/auth/users/{user_a_id}/profile", headers=h_b)
    assert p_private_bob.status_code == 200
    assert p_private_bob.json()["bio"] is None
    assert p_private_bob.json()["quiz_stats"] is None
    assert p_private_bob.json()["activity_history"] == []

    # Alice views her own profile: all visible
    p_private_self = await client.get(f"/api/auth/users/{user_a_id}/profile", headers=h_a)
    assert p_private_self.status_code == 200
    assert p_private_self.json()["bio"] == "Secret historian biography"
    assert p_private_self.json()["quiz_stats"] is not None

    # 3. Alice sets profile_visibility="friends_only"
    await client.patch("/api/auth/me", json={"profile_visibility": "friends_only"}, headers=h_a)

    # Bob (not friend) views Alice: hidden
    p_friends_bob = await client.get(f"/api/auth/users/{user_a_id}/profile", headers=h_b)
    assert p_friends_bob.json()["bio"] is None
    assert p_friends_bob.json()["quiz_stats"] is None

    # Alice and Bob become friends
    req = await client.post("/api/auth/friends/request", json={"addressee_id": reg_b.json()["user"]["id"]}, headers=h_a)
    req_id = req.json()["id"]
    await client.post(f"/api/auth/friends/requests/{req_id}/accept", headers=h_b)

    # Bob (now friend) views Alice: bio and stats visible
    p_friends_accepted = await client.get(f"/api/auth/users/{user_a_id}/profile", headers=h_b)
    assert p_friends_accepted.json()["bio"] == "Secret historian biography"
    assert p_friends_accepted.json()["quiz_stats"] is not None
    assert p_friends_accepted.json()["is_friend"] is True
