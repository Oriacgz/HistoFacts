"""
Tests for Social module (posts, threaded comments, likes, votes, media, GIF search).
"""

import io
import pytest
from PIL import Image
from httpx import AsyncClient


def create_test_image_bytes(format="PNG", size=(600, 600), color="blue") -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGB", size, color=color)
    img.save(buf, format=format)
    return buf.getvalue()


# Minimal MP4: size-prefixed ftyp box at offset 4 — enough for content classification
FAKE_VIDEO_BYTES = b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom" + b"\x00" * 32


async def _register_and_post(client, username, email):
    reg = await client.post(
        "/api/auth/register",
        json={"username": username, "email": email, "password": "Password123!"},
    )
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    post = await client.post(
        "/api/social/posts",
        json={"content": f"A historical question from {username}"},
        headers=headers,
    )
    assert post.status_code == 201
    return headers, post.json()["id"]


@pytest.mark.asyncio
async def test_social_flow(client: AsyncClient):
    # 1. Register two users
    u1_resp = await client.post(
        "/api/auth/register",
        json={"username": "AliceWriter", "email": "alice@example.com", "password": "Password123!"},
    )
    t1 = u1_resp.json()["access_token"]
    h1 = {"Authorization": f"Bearer {t1}"}

    u2_resp = await client.post(
        "/api/auth/register",
        json={"username": "BobReader", "email": "bob@example.com", "password": "Password123!"},
    )
    t2 = u2_resp.json()["access_token"]
    h2 = {"Authorization": f"Bearer {t2}"}

    # 2. Alice creates a post
    post_resp = await client.post(
        "/api/social/posts",
        json={"content": "Did you know that the Library of Alexandria was accidentally burned by Julius Caesar?"},
        headers=h1,
    )
    assert post_resp.status_code == 201
    post = post_resp.json()
    post_id = post["id"]

    # 3. Bob comments on Alice's post
    comm_resp = await client.post(
        f"/api/social/posts/{post_id}/comments",
        json={"content": "Fascinating fact! Wasn't it partially destroyed multiple times?"},
        headers=h2,
    )
    assert comm_resp.status_code == 201
    comm = comm_resp.json()
    comm_id = comm["id"]

    # 4. Alice writes a threaded reply to Bob's comment
    reply_resp = await client.post(
        f"/api/social/posts/{post_id}/comments",
        json={
            "parent_comment_id": comm_id,
            "content": "Yes, exactly! Several subsequent attacks destroyed the rest.",
        },
        headers=h1,
    )
    assert reply_resp.status_code == 201
    assert reply_resp.json()["parent_comment_id"] == comm_id

    # 5. Bob likes Alice's post
    like_resp = await client.post(f"/api/social/posts/{post_id}/like", headers=h2)
    assert like_resp.status_code == 200
    like_data = like_resp.json()
    assert like_data["liked"] is True
    assert like_data["new_like_count"] >= 1

    # 6. Authors hydrate in the feed and on comments (summary cache synced on write)
    feed = await client.get("/api/social/posts/")
    feed_post = next(p for p in feed.json() if p["id"] == post_id)
    assert feed_post["author"] is not None
    assert feed_post["author"]["username"] == "AliceWriter"
    assert feed_post["author"]["tag"]

    detail = await client.get(f"/api/social/posts/{post_id}")
    comments = detail.json()["comments"]
    assert comments[0]["author"]["username"] == "BobReader"


@pytest.mark.asyncio
async def test_post_reaction_flow(client: AsyncClient):
    """Like, dislike, change reaction, clear reaction — counts stay consistent."""
    h1, post_id = await _register_and_post(client, "VoteAuthor", "voteauthor@example.com")
    h2, _ = await _register_and_post(client, "VoteReader", "votereader@example.com")

    # Author likes own post
    res = await client.post(f"/api/social/posts/{post_id}/reaction", json={"reaction": "like"}, headers=h1)
    assert res.status_code == 200
    assert res.json() == {"likes": 1, "dislikes": 0, "user_reaction": "like"}

    # Reader dislikes
    res = await client.post(f"/api/social/posts/{post_id}/reaction", json={"reaction": "dislike"}, headers=h2)
    assert res.json() == {"likes": 1, "dislikes": 1, "user_reaction": "dislike"}

    # Reader changes reaction to like
    res = await client.post(f"/api/social/posts/{post_id}/reaction", json={"reaction": "like"}, headers=h2)
    assert res.json() == {"likes": 2, "dislikes": 0, "user_reaction": "like"}

    # Reader clears reaction — feed reflects both users' state
    res = await client.post(f"/api/social/posts/{post_id}/reaction", json={"reaction": "none"}, headers=h2)
    assert res.json() == {"likes": 1, "dislikes": 0, "user_reaction": None}

    feed = await client.get("/api/social/posts/")
    feed_post = next(p for p in feed.json() if p["id"] == post_id)
    assert feed_post["likes"] == 1
    assert feed_post["dislikes"] == 0
    assert feed_post["user_reaction"] is None

    # Invalid values are rejected by schema validation
    bad = await client.post(f"/api/social/posts/{post_id}/reaction", json={"reaction": "love"}, headers=h2)
    assert bad.status_code == 422

    # Voting on a missing post 404s
    missing = await client.post("/api/social/posts/no-such-id/reaction", json={"reaction": "like"}, headers=h2)
    assert missing.status_code == 404


@pytest.mark.asyncio
async def test_post_media_rules(client: AsyncClient, monkeypatch):
    """Up to 4 images or exactly 1 video; mixing rejected; content-based validation; author-only."""
    from app.social.community_forum import routes as forum_routes

    h1, post_id = await _register_and_post(client, "MediaAuthor", "mediaauthor@example.com")
    h2, _ = await _register_and_post(client, "MediaVisitor", "mediavisitor@example.com")

    img_bytes = create_test_image_bytes(format="PNG", size=(300, 300))

    # 1. Four images accepted — stored under posts/{id} and returned in the feed
    files4 = [("files", (f"img{i}.png", img_bytes, "image/png")) for i in range(4)]
    res = await client.post(f"/api/social/posts/{post_id}/media", files=files4, headers=h1)
    assert res.status_code == 200
    data = res.json()
    assert data["media_type"] == "image"
    assert len(data["media_urls"]) == 4
    assert all(url.startswith(f"/uploads/posts/{post_id}/") for url in data["media_urls"])

    feed = await client.get("/api/social/posts/")
    feed_post = next(p for p in feed.json() if p["id"] == post_id)
    assert feed_post["media_type"] == "image"
    assert feed_post["media_urls"] == data["media_urls"]

    # 2. A fifth image is rejected
    files5 = [("files", (f"img{i}.png", img_bytes, "image/png")) for i in range(5)]
    res = await client.post(f"/api/social/posts/{post_id}/media", files=files5, headers=h1)
    assert res.status_code == 400

    # 3. Video alongside images is rejected — one or the other
    mixed = [("files", ("clip.mp4", FAKE_VIDEO_BYTES, "video/mp4")), ("files", ("img.png", img_bytes, "image/png"))]
    res = await client.post(f"/api/social/posts/{post_id}/media", files=mixed, headers=h1)
    assert res.status_code == 400

    # 4. A single video is accepted
    res = await client.post(
        f"/api/social/posts/{post_id}/media",
        files=[("files", ("clip.mp4", FAKE_VIDEO_BYTES, "video/mp4"))],
        headers=h1,
    )
    assert res.status_code == 200
    assert res.json()["media_type"] == "video"

    # 5. Video size cap enforced (shrink the limit for the test)
    monkeypatch.setattr(forum_routes, "MAX_VIDEO_BYTES", 10)
    res = await client.post(
        f"/api/social/posts/{post_id}/media",
        files=[("files", ("clip.mp4", FAKE_VIDEO_BYTES, "video/mp4"))],
        headers=h1,
    )
    assert res.status_code == 413
    monkeypatch.setattr(forum_routes, "MAX_VIDEO_BYTES", 100 * 1024 * 1024)

    # 6. Content, not extension or declared MIME, decides acceptance
    fake = [("files", ("photo.png", b"definitely not an image", "image/png"))]
    res = await client.post(f"/api/social/posts/{post_id}/media", files=fake, headers=h1)
    assert res.status_code == 415

    # 7. Only the author can attach media
    res = await client.post(
        f"/api/social/posts/{post_id}/media",
        files=[("files", ("img.png", img_bytes, "image/png"))],
        headers=h2,
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_comment_media_url_and_validation(client: AsyncClient):
    h1, post_id = await _register_and_post(client, "GifPoster", "gifposter@example.com")

    # Text + GIF comment accepted
    res = await client.post(
        f"/api/social/posts/{post_id}/comments",
        json={"content": "This is exactly how it happened", "media_url": "https://media.tenor.com/x.gif"},
        headers=h1,
    )
    assert res.status_code == 201
    assert res.json()["media_url"] == "https://media.tenor.com/x.gif"

    # GIF-only comment accepted (no text)
    res = await client.post(
        f"/api/social/posts/{post_id}/comments",
        json={"content": "", "media_url": "https://media.tenor.com/y.gif"},
        headers=h1,
    )
    assert res.status_code == 201

    # Neither text nor media rejected
    res = await client.post(
        f"/api/social/posts/{post_id}/comments",
        json={"content": ""},
        headers=h1,
    )
    assert res.status_code == 422

    # Non-http media_url rejected
    res = await client.post(
        f"/api/social/posts/{post_id}/comments",
        json={"content": "hello", "media_url": "javascript:alert(1)"},
        headers=h1,
    )
    assert res.status_code == 422

    # Detail view carries media_url through
    detail = await client.get(f"/api/social/posts/{post_id}")
    assert any(c["media_url"] == "https://media.tenor.com/x.gif" for c in detail.json()["comments"])


@pytest.mark.asyncio
async def test_gif_search_requires_tenor_key(client: AsyncClient, monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "tenor_api_key", "")
    res = await client.get("/api/social/gifs?query=history")
    assert res.status_code == 503


@pytest.mark.asyncio
async def test_get_public_feed_two_queries(db_session):
    from sqlalchemy import event
    from tests.conftest import test_engine
    from app.social.models import Post, UserSummaryCache
    from app.social.service import get_public_feed

    # Seed 20 posts from 20 different authors
    for i in range(20):
        uid = f"author-{i}"
        user_cache = UserSummaryCache(
            user_id=uid,
            username=f"Author_{i}",
            tag=f"{i:04d}",
            avatar_url=None,
            bio=f"Bio {i}",
            is_banned=False,
        )
        post = Post(
            user_id=uid,
            content=f"Post content number {i}",
            like_count=i,
            comment_count=i * 2,
        )
        db_session.add(user_cache)
        db_session.add(post)
    await db_session.commit()

    # Track executed queries
    queries = []

    def intercept(orm_execute_state):
        if orm_execute_state.is_select:
            queries.append(str(orm_execute_state.statement))

    event.listen(db_session.sync_session, "do_orm_execute", intercept)
    try:
        posts = await get_public_feed(db_session, limit=20)
    finally:
        event.remove(db_session.sync_session, "do_orm_execute", intercept)

    assert len(posts) == 20
    # Exactly 2 queries: 1 for posts, 1 for batched authors (UserSummaryCache)
    assert len(queries) == 2, f"Expected 2 queries, got {len(queries)}: {queries}"
    # Verify author data was hydrated from batch lookup
    for p in posts:
        assert p.author is not None
        assert p.author.username.startswith("Author_")


