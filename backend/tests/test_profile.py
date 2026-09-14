"""
Tests for Profile Settings (profile update, avatar upload, password/email change, privacy).
"""

import io
import pytest
from PIL import Image
from httpx import AsyncClient
from app.core.file_storage import UPLOADS_ROOT
from pathlib import Path


def create_test_image_bytes(format="PNG", size=(600, 600), color="blue") -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGB", size, color=color)
    img.save(buf, format=format)
    return buf.getvalue()


@pytest.mark.asyncio
async def test_profile_update_and_bio_sanitization(client: AsyncClient):
    reg = await client.post(
        "/api/auth/register",
        json={"username": "ProfTester", "email": "prof@example.com", "password": "Password123!"},
    )
    assert reg.status_code == 201
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Update profile with HTML in bio and valid ISO country code
    patch_res = await client.patch(
        "/api/auth/me",
        json={
            "bio": "<script>alert('xss')</script>Hello <b>World</b>!",
            "country_code": "in",  # lowercase should be normalized to uppercase
            "pronouns": "they/them",
            "timezone": "Asia/Kolkata",
            "show_online_status": False,
        },
        headers=headers,
    )
    assert patch_res.status_code == 200
    data = patch_res.json()
    assert data["bio"] == "alert('xss')Hello World!"
    assert data["country_code"] == "IN"
    assert data["pronouns"] == "they/them"
    assert data["timezone"] == "Asia/Kolkata"
    assert data["show_online_status"] is False

    # Try invalid country code
    bad_country = await client.patch(
        "/api/auth/me",
        json={"country_code": "ZZ"},
        headers=headers,
    )
    assert bad_country.status_code == 422  # Pydantic validation error


@pytest.mark.asyncio
async def test_username_change_and_tag_handling(client: AsyncClient):
    # Register User 1
    u1 = await client.post(
        "/api/auth/register",
        json={"username": "OriginalName", "email": "u1@example.com", "password": "Password123!"},
    )
    assert u1.status_code == 201
    token1 = u1.json()["access_token"]
    tag1 = u1.json()["user"]["tag"]
    headers1 = {"Authorization": f"Bearer {token1}"}

    # Change username
    renamed = await client.patch(
        "/api/auth/me",
        json={"username": "NewUniqueName"},
        headers=headers1,
    )
    assert renamed.status_code == 200
    assert renamed.json()["username"] == "NewUniqueName"
    assert renamed.json()["tag"] == tag1  # Tag retained if not taken


@pytest.mark.asyncio
async def test_avatar_upload_and_replacement(client: AsyncClient):
    reg = await client.post(
        "/api/auth/register",
        json={"username": "AvatarUser", "email": "avatar@example.com", "password": "Password123!"},
    )
    assert reg.status_code == 201
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Try uploading non-image (text pretending to be image)
    fake_file = {"file": ("fake.jpg", b"This is not a real image header", "image/jpeg")}
    fail_res = await client.post("/api/auth/users/me/avatar", files=fake_file, headers=headers)
    assert fail_res.status_code == 415

    # 2. Upload valid image
    img_bytes = create_test_image_bytes(format="JPEG", size=(800, 800))
    file_payload = {"file": ("avatar.jpg", img_bytes, "image/jpeg")}
    upload_res = await client.post("/api/auth/users/me/avatar", files=file_payload, headers=headers)
    assert upload_res.status_code == 200
    avatar_url1 = upload_res.json()["avatar_url"]
    assert avatar_url1.startswith("/uploads/avatars/")
    assert avatar_url1.endswith(".webp")

    # Check file exists on disk
    disk_path1 = Path(avatar_url1.lstrip("/"))
    assert disk_path1.exists()

    # 3. Upload a second avatar and ensure the old one is deleted
    img_bytes2 = create_test_image_bytes(format="PNG", size=(200, 200), color="green")
    file_payload2 = {"file": ("avatar2.png", img_bytes2, "image/png")}
    upload_res2 = await client.post("/api/auth/users/me/avatar", files=file_payload2, headers=headers)
    assert upload_res2.status_code == 200
    avatar_url2 = upload_res2.json()["avatar_url"]
    assert avatar_url2 != avatar_url1

    # Old avatar should be deleted
    assert not disk_path1.exists()
    disk_path2 = Path(avatar_url2.lstrip("/"))
    assert disk_path2.exists()


@pytest.mark.asyncio
async def test_password_change_flow(client: AsyncClient):
    reg = await client.post(
        "/api/auth/register",
        json={"username": "PwdUser", "email": "pwd@example.com", "password": "InitialPassword123!"},
    )
    assert reg.status_code == 201
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Wrong current password
    wrong_res = await client.post(
        "/api/auth/users/me/change-password",
        json={"current_password": "WrongPassword!", "new_password": "NewSecurePassword123!"},
        headers=headers,
    )
    assert wrong_res.status_code == 403

    # Correct current password
    ok_res = await client.post(
        "/api/auth/users/me/change-password",
        json={"current_password": "InitialPassword123!", "new_password": "NewSecurePassword123!"},
        headers=headers,
    )
    assert ok_res.status_code == 200

    # Verify old password no longer works
    login_old = await client.post(
        "/api/auth/login",
        json={"email": "pwd@example.com", "password": "InitialPassword123!"},
    )
    assert login_old.status_code == 401

    # Verify new password works
    login_new = await client.post(
        "/api/auth/login",
        json={"email": "pwd@example.com", "password": "NewSecurePassword123!"},
    )
    assert login_new.status_code == 200


@pytest.mark.asyncio
async def test_email_change_confirmation_flow(client: AsyncClient):
    reg = await client.post(
        "/api/auth/register",
        json={"username": "EmailUser", "email": "oldemail@example.com", "password": "Password123!"},
    )
    assert reg.status_code == 201
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Request email change
    req_res = await client.post(
        "/api/auth/users/me/change-email",
        json={"new_email": "newemail@example.com"},
        headers=headers,
    )
    assert req_res.status_code == 200
    verify_token = req_res.json()["token"]

    # Verify email hasn't changed yet
    me = await client.get("/api/auth/me", headers=headers)
    assert me.json()["email"] == "oldemail@example.com"

    # Confirm email with token
    confirm_res = await client.get(
        f"/api/auth/users/me/change-email/confirm?token={verify_token}"
    )
    assert confirm_res.status_code == 200
    assert confirm_res.json()["email"] == "newemail@example.com"

    # Now email is changed
    me_after = await client.get("/api/auth/me", headers=headers)
    assert me_after.json()["email"] == "newemail@example.com"


@pytest.mark.asyncio
async def test_presence_privacy_show_online_status(client: AsyncClient):
    # Register User A (Alice)
    reg_a = await client.post(
        "/api/auth/register",
        json={"username": "AliceOnline", "email": "alice_on@example.com", "password": "Password123!"},
    )
    token_a = reg_a.json()["access_token"]
    user_a = reg_a.json()["user"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Register User B (Bob)
    reg_b = await client.post(
        "/api/auth/register",
        json={"username": "BobStealth", "email": "bob_stealth@example.com", "password": "Password123!"},
    )
    token_b = reg_b.json()["access_token"]
    user_b = reg_b.json()["user"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Make friends
    req = await client.post("/api/auth/friends/request", json={"addressee_id": user_b["id"]}, headers=headers_a)
    assert req.status_code == 201
    req_id = req.json()["id"]
    await client.post(f"/api/auth/friends/requests/{req_id}/accept", headers=headers_b)

    # Bob sends heartbeat
    await client.post("/api/auth/presence/heartbeat", headers=headers_b)

    # Alice checks friends list: Bob should appear online
    list1 = await client.get("/api/auth/friends", headers=headers_a)
    assert list1.status_code == 200
    b_presence1 = next(f for f in list1.json() if f["id"] == user_b["id"])
    assert b_presence1["is_online"] is True

    # Bob turns off show_online_status
    await client.patch("/api/auth/me", json={"show_online_status": False}, headers=headers_b)

    # Alice checks friends list again: Bob should appear offline regardless of recent heartbeat
    list2 = await client.get("/api/auth/friends", headers=headers_a)
    assert list2.status_code == 200
    b_presence2 = next(f for f in list2.json() if f["id"] == user_b["id"])
    assert b_presence2["is_online"] is False
    assert b_presence2["last_seen_at"] is None
