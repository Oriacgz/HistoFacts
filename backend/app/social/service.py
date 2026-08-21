"""
Social service handling posts feed, threaded comments, and like counts.
"""

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.social.models import Post, Comment, Like
from app.social.schemas import CreatePostRequest, CreateCommentRequest, PostResponse, CommentResponse
from app.auth.models import User
from app.auth.schemas import UserResponse


async def create_post(req: CreatePostRequest, user_id: str, db: AsyncSession) -> Post:
    post = Post(
        user_id=user_id,
        group_id=req.group_id,
        event_id=req.event_id,
        content=req.content,
    )
    db.add(post)
    await db.flush()
    return post


async def get_public_feed(db: AsyncSession, limit: int = 20) -> list[PostResponse]:
    # Query posts where group_id is null (public feed)
    res = await db.execute(
        select(Post).where(Post.group_id.is_(None)).order_by(Post.created_at.desc()).limit(limit)
    )
    posts = res.scalars().all()

    out = []
    for p in posts:
        # Load author
        u_res = await db.execute(select(User).where(User.id == p.user_id))
        author = u_res.scalar_one_or_none()

        # Count comments
        c_count_res = await db.execute(
            select(func.count()).select_from(Comment).where(Comment.post_id == p.id)
        )
        c_count = c_count_res.scalar() or 0

        out.append(
            PostResponse(
                id=p.id,
                user_id=p.user_id,
                author=UserResponse.model_validate(author) if author else None,
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
    # Map comments by ID and group by parent_comment_id
    comment_map: dict[str, CommentResponse] = {}
    root_comments: list[CommentResponse] = []

    for c in comments:
        u_res = await db.execute(select(User).where(User.id == c.user_id))
        author = u_res.scalar_one_or_none()

        c_resp = CommentResponse(
            id=c.id,
            post_id=c.post_id,
            user_id=c.user_id,
            author=UserResponse.model_validate(author) if author else None,
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

    u_res = await db.execute(select(User).where(User.id == post.user_id))
    author = u_res.scalar_one_or_none()

    c_res = await db.execute(
        select(Comment).where(Comment.post_id == post_id).order_by(Comment.created_at.asc())
    )
    comments = c_res.scalars().all()
    tree = await build_comment_tree(comments, db)

    return PostResponse(
        id=post.id,
        user_id=post.user_id,
        author=UserResponse.model_validate(author) if author else None,
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
    await db.flush()
    return comment


async def toggle_post_like(post_id: str, user_id: str, db: AsyncSession) -> tuple[bool, int]:
    p_res = await db.execute(select(Post).where(Post.id == post_id))
    post = p_res.scalar_one_or_none()
    if not post:
        raise ValueError("Post not found")

    res = await db.execute(
        select(Like).where(Like.post_id == post_id, Like.user_id == user_id)
    )
    like = res.scalar_one_or_none()

    if like:
        await db.delete(like)
        post.like_count = max(0, (post.like_count or 0) - 1)
        liked = False
    else:
        new_like = Like(user_id=user_id, post_id=post_id)
        db.add(new_like)
        post.like_count = (post.like_count or 0) + 1
        liked = True

    await db.flush()
    return liked, post.like_count
