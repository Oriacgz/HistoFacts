"""
FastAPI router for Notification Microservice endpoints.
Includes internal service-to-service creation and public user endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.deps import get_current_user, CurrentUser, verify_internal_service_secret
from app.notification.models import Notification, NOTIFICATION_TYPES
from app.notification.schemas import (
    NotificationCreate,
    NotificationResponse,
    UnreadCountResponse,
    NotificationBatchReadResponse,
)
from app.notification.service import (
    create_notification_record,
    get_unread_count,
    list_notifications,
    mark_notification_read,
    mark_all_notifications_read,
)

router = APIRouter(tags=["Notifications"])


# ── Internal Endpoint (Service-to-Service Only) ───────────────
@router.post(
    "/internal/notifications",
    status_code=status.HTTP_201_CREATED,
    summary="Create notification (Internal service-to-service only)",
)
async def create_internal_notification(
    payload: NotificationCreate,
    db: AsyncSession = Depends(get_async_session),
):
    """Internal service-to-service endpoint to dispatch notifications."""
    if payload.type not in NOTIFICATION_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid notification type '{payload.type}'. Must be one of {NOTIFICATION_TYPES}",
        )
    notification = await create_notification_record(payload, db)
    if notification is None:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    return NotificationResponse.model_validate(notification)


@router.post(
    "/internal/users/{user_id}/purge",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(verify_internal_service_secret)],
)
async def purge_user_notifications(
    user_id: str,
    db: AsyncSession = Depends(get_async_session),
):
    """Internal purge: delete all notification records for the user."""
    await db.execute(delete(Notification).where(Notification.user_id == user_id))
    await db.commit()
    return {"status": "purged", "service": "notification"}


@router.get(
    "/internal/users/{user_id}/export",
    dependencies=[Depends(verify_internal_service_secret)],
)
async def export_user_notifications(
    user_id: str,
    db: AsyncSession = Depends(get_async_session),
):
    """Internal export: fetch all notifications for user data export."""
    res = await db.execute(select(Notification).where(Notification.user_id == user_id))
    rows = res.scalars().all()
    return {
        "notifications": [
            {
                "id": n.id,
                "type": n.type,
                "payload": n.payload,
                "is_read": n.is_read,
                "created_at": str(n.created_at),
            }
            for n in rows
        ]
    }



# ── Public Endpoints (Via Gateway) ────────────────────────────
@router.get(
    "/api/notifications",
    response_model=list[NotificationResponse],
    summary="Get paginated user notifications",
)
async def get_user_notifications(
    unread_only: bool = Query(False, description="Filter only unread notifications"),
    limit: int = Query(20, ge=1, le=100, description="Max items to return"),
    before: str | None = Query(None, description="Cursor: notification ID to fetch items created before"),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Retrieve paginated notifications for the authenticated user."""
    return await list_notifications(
        user_id=current_user.id,
        db=db,
        unread_only=unread_only,
        limit=limit,
        before=before,
    )


@router.get(
    "/api/notifications/unread-count",
    response_model=UnreadCountResponse,
    summary="Get unread notification count (Fast single-query)",
)
async def get_user_unread_count(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Returns unread count in a single COUNT(*) query for high-frequency bell polling.
    """
    count = await get_unread_count(user_id=current_user.id, db=db)
    return UnreadCountResponse(unread_count=count)


@router.post(
    "/api/notifications/{notification_id}/read",
    response_model=NotificationResponse,
    summary="Mark single notification as read",
)
async def mark_single_read(
    notification_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Mark a single notification as read."""
    updated = await mark_notification_read(
        notification_id=notification_id,
        user_id=current_user.id,
        db=db,
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    return updated


@router.post(
    "/api/notifications/read-all",
    response_model=NotificationBatchReadResponse,
    summary="Mark all notifications as read",
)
async def mark_all_read(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Mark all unread notifications as read."""
    count = await mark_all_notifications_read(
        user_id=current_user.id,
        db=db,
    )
    return NotificationBatchReadResponse(status="ok", updated_count=count)
