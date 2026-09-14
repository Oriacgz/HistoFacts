"""
FastAPI router for Chat endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.chat.schemas import ConversationResponse, MessageResponse, SendMessageRequest
from app.chat.service import (
    get_or_create_direct_conversation,
    get_or_create_group_conversation,
    get_user_conversations,
    get_messages,
    get_new_messages,
    send_message,
    mark_as_read,
)
from app.core.database import get_async_session
from app.core.deps import get_current_user, CurrentUser

router = APIRouter(prefix="/api/chat", tags=["Chat"])


@router.get("/conversations", response_model=list[ConversationResponse])
async def list_conversations(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """List all conversations for the current user, sorted by most recent activity."""
    return await get_user_conversations(current_user.id, db)


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageResponse])
async def list_messages(
    conversation_id: str,
    before: str | None = Query(None, description="Message ID cursor for pagination"),
    limit: int = Query(30, ge=1, le=100),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Paginated message history, newest-first. Pass `before` for scroll-up loading."""
    return await get_messages(conversation_id, current_user.id, db, before, limit)


@router.get("/conversations/{conversation_id}/messages/new", response_model=list[MessageResponse])
async def poll_new_messages(
    conversation_id: str,
    after: str | None = Query(None, description="Message ID to fetch messages after"),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Poll for new messages since the given message ID — used for live updates."""
    return await get_new_messages(conversation_id, current_user.id, after, db)


@router.post("/conversations/{conversation_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def create_message(
    conversation_id: str,
    payload: SendMessageRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Send a message in a conversation."""
    result = await send_message(conversation_id, current_user.id, payload, db)
    if not result:
        raise HTTPException(status_code=403, detail="Not a participant of this conversation")
    return result


@router.post("/conversations/direct/{friend_user_id}", response_model=ConversationResponse)
async def get_or_create_direct(
    friend_user_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Get or create a direct conversation with a friend."""
    if friend_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot create a conversation with yourself")
    return await get_or_create_direct_conversation(current_user.id, friend_user_id, db)


@router.post("/conversations/group/{group_id}", response_model=ConversationResponse)
async def get_or_create_group(
    group_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Get or create a group conversation."""
    return await get_or_create_group_conversation(group_id, current_user.id, db)


@router.post("/conversations/{conversation_id}/read", status_code=status.HTTP_200_OK)
async def mark_conversation_read(
    conversation_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Mark conversation as read up to the latest message."""
    success = await mark_as_read(conversation_id, current_user.id, db)
    if not success:
        raise HTTPException(status_code=403, detail="Not a participant of this conversation")
    return {"status": "read", "conversation_id": conversation_id}
