"""
Service logic for notifications: creation, single-query counts, pagination, and reads.
"""

from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.notification.models import Notification
from app.notification.schemas import NotificationCreate


async def create_notification_record(payload: NotificationCreate, db: AsyncSession) -> Notification:
    """Create and persist a new notification."""
    notification = Notification(
        user_id=payload.user_id,
        type=payload.type,
        payload=payload.payload,
    )
    db.add(notification)
    await db.commit()
    await db.refresh(notification)
    return notification


async def get_unread_count(user_id: str, db: AsyncSession) -> int:
    """
    Get count of unread notifications for a user in a single fast COUNT(*) query.
    Never fetches full rows.
    """
    stmt = (
        select(func.count())
        .select_from(Notification)
        .where(
            Notification.user_id == user_id,
            Notification.is_read.is_(False),
        )
    )
    res = await db.execute(stmt)
    return res.scalar() or 0


async def list_notifications(
    user_id: str,
    db: AsyncSession,
    unread_only: bool = False,
    limit: int = 20,
    before: str | None = None,
) -> list[Notification]:
    """
    Fetch paginated notifications for a user in a single query.
    """
    stmt = select(Notification).where(Notification.user_id == user_id)

    if unread_only:
        stmt = stmt.where(Notification.is_read.is_(False))

    if before:
        # Cursor-based pagination: fetch created_at of reference notification
        ref_res = await db.execute(
            select(Notification.created_at).where(Notification.id == before)
        )
        ref_created_at = ref_res.scalar_one_or_none()
        if ref_created_at:
            stmt = stmt.where(Notification.created_at < ref_created_at)

    stmt = stmt.order_by(Notification.created_at.desc()).limit(limit)

    res = await db.execute(stmt)
    return list(res.scalars().all())


async def mark_notification_read(
    notification_id: str,
    user_id: str,
    db: AsyncSession,
) -> Notification | None:
    """
    Mark a single notification as read, updating only that row.
    """
    stmt = (
        update(Notification)
        .where(Notification.id == notification_id, Notification.user_id == user_id)
        .values(is_read=True)
        .returning(Notification)
    )
    res = await db.execute(stmt)
    await db.commit()
    return res.scalar_one_or_none()


async def mark_all_notifications_read(user_id: str, db: AsyncSession) -> int:
    """
    Mark all unread notifications as read for the user in a single UPDATE statement.
    """
    stmt = (
        update(Notification)
        .where(
            Notification.user_id == user_id,
            Notification.is_read.is_(False),
        )
        .values(is_read=True)
    )
    res = await db.execute(stmt)
    await db.commit()
    return res.rowcount or 0
