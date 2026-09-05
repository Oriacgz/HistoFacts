"""
Social service handling posts feed, threaded comments, and like counts.
"""

from datetime import datetime, timedelta, timezone
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.social.models import Post, Comment, Like, UserSummaryCache
from app.social.schemas import CreatePostRequest, CreateCommentRequest, PostResponse, CommentResponse
from app.core.inter_service import notify
from app.core.database import get_async_session


async def _get_user_summary(user_id: str, db: AsyncSession) -> UserSummaryCache | None:
    """Get user summary from local cache or fetch from Auth service."""
    cached = await db.get(UserSummaryCache, user_id)
    if cached:
        synced_at = cached.synced_at
        if synced_at.tzinfo is None:
            synced_at = synced_at.replace(tzinfo=timezone.utc)
        if (datetime.now(timezone.utc) - synced_at) < timedelta(hours=1):
            return cached

    # Fetch from Auth service internal API
    try:
        from app.core.inter_service import call_auth_get_user_summary
        data = await call_auth_get_user_summary(user_id)
        if data:
            summary = UserSummaryCache(
                user_id=data["user_id"],
                username=data["username"],
                tag=data["tag"],
                avatar_url=data.get("avatar_url"),
                bio=data.get("bio"),
                is_banned=data.get("is_banned", False),
                synced_at=datetime.now(timezone.utc),
            )
            await db.merge(summary)
            await db.commit()
            return summary
    except Exception:
        pass

    # In-process DB fallback
    try:
        from app.auth.models import User
        u = await db.get(User, user_id)
        if u:
            summary = UserSummaryCache(
                user_id=u.id,
                username=u.username,
                tag=u.tag,
                avatar_url=u.avatar_url,
                bio=u.bio,
                is_banned=u.is_banned,
                synced_at=datetime.now(timezone.utc),
            )
            await db.merge(summary)
            await db.commit()
            return summary
    except Exception:
        pass

    return cached


async def create_post(req: CreatePostRequest, user_id: str, db: AsyncSession) -> Post:
    post = Post(
        user_id=user_id,
        group_id=req.group_id,
        event_id=req.event_id,
        content=req.content,
    )
    db.add(post)
    await db.commit()
    await db.refresh(post)
    return post


async def get_public_feed(db: AsyncSession, limit: int = 20) -> list[PostResponse]:
    res = await db.execute(
        select(Post).where(Post.group_id.is_(None)).order_by(Post.created_at.desc()).limit(limit)
    )
    posts = res.scalars().all()

    out = []
    for p in posts:
        author = await _get_user_summary(p.user_id, db)

        c_count_res = await db.execute(
            select(func.count()).select_from(Comment).where(Comment.post_id == p.id)
        )
        c_count = c_count_res.scalar() or 0

        out.append(
            PostResponse(
                id=p.id,
                user_id=p.user_id,
                author=author,
                group_id=p.group_id,
                event_id=p.event_id,
                content=p.content,
                like_count=p.like_count or 0,
                created_at=p.created_at,
                comment_count=c_count,
            )
        )

    return out


async def build_comment_tree(comments: list[Comment], db: AsyncSession) -> list[CommentResponse]:
    comment_map: dict[str, CommentResponse] = {}
    root_comments: list[CommentResponse] = []

    for c in comments:
        author = await _get_user_summary(c.user_id, db)

        c_resp = CommentResponse(
            id=c.id,
            post_id=c.post_id,
            user_id=c.user_id,
            author=author,
            parent_comment_id=c.parent_comment_id,
            mentioned_user_id=c.mentioned_user_id,
            content=c.content,
            like_count=c.like_count or 0,
            created_at=c.created_at,
            replies=[],
        )
        comment_map[c.id] = c_resp

    for c in comments:
        c_resp = comment_map[c.id]
        if c.parent_comment_id and c.parent_comment_id in comment_map:
            comment_map[c.parent_comment_id].replies.append(c_resp)
        else:
            root_comments.append(c_resp)

    return root_comments


async def get_post_with_comments(post_id: str, db: AsyncSession) -> PostResponse | None:
    res = await db.execute(select(Post).where(Post.id == post_id))
    post = res.scalar_one_or_none()
    if not post:
        return None

    author = await _get_user_summary(post.user_id, db)

    c_res = await db.execute(
        select(Comment).where(Comment.post_id == post_id).order_by(Comment.created_at.asc())
    )
    comments = c_res.scalars().all()
    tree = await build_comment_tree(comments, db)

    return PostResponse(
        id=post.id,
        user_id=post.user_id,
        author=author,
        group_id=post.group_id,
        event_id=post.event_id,
        content=post.content,
        like_count=post.like_count or 0,
        created_at=post.created_at,
        comment_count=len(comments),
        comments=tree,
    )


async def add_comment(post_id: str, req: CreateCommentRequest, user_id: str, db: AsyncSession) -> Comment:
    comment = Comment(
        post_id=post_id,
        user_id=user_id,
        parent_comment_id=req.parent_comment_id,
        mentioned_user_id=req.mentioned_user_id,
        content=req.content,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)

    commenter = await _get_user_summary(user_id, db)
    commenter_name = commenter.username if commenter else "Scholar"
    content_snippet = (comment.content[:80] + "...") if len(comment.content) > 80 else comment.content

    if req.parent_comment_id:
        parent = await db.get(Comment, req.parent_comment_id)
        if parent and parent.user_id != user_id:
            await notify(
                user_id=parent.user_id,
                type="comment_reply",
                payload={
                    "comment_id": comment.id,
                    "post_id": post_id,
                    "from_user_id": user_id,
                    "from_user": commenter_name,
                    "content_snippet": content_snippet,
                },
            )

    if req.mentioned_user_id and req.mentioned_user_id != user_id:
        await notify(
            user_id=req.mentioned_user_id,
            type="comment_reply",
            payload={
                "comment_id": comment.id,
                "post_id": post_id,
                "from_user_id": user_id,
                "from_user": commenter_name,
                "content_snippet": content_snippet,
                "is_mention": True,
            },
        )

    return comment


async def toggle_post_like(post_id: str, user_id: str, db: AsyncSession) -> tuple[bool, int]:
    p_res = await db.execute(select(Post).where(Post.id == post_id))
    post = p_res.scalar_one_or_none()
    if not post:
        raise ValueError("Post not found")

    res = await db.execute(
        select(Like).where(Like.target_type == "post", Like.target_id == post_id, Like.user_id == user_id)
    )
    like = res.scalar_one_or_none()

    if like:
        await db.delete(like)
        post.like_count = max(0, (post.like_count or 0) - 1)
        liked = False
    else:
        new_like = Like(user_id=user_id, target_type="post", target_id=post_id)
        db.add(new_like)
        post.like_count = (post.like_count or 0) + 1
        liked = True

    await db.commit()
    return liked, post.like_count
