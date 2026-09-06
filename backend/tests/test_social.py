"""
Tests for Social module (posts, threaded comments, likes).
"""

import pytest
from httpx import AsyncClient


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


