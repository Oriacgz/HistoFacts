"""
Business logic for Chat — conversations, messages, unread tracking.
"""

from datetime import datetime, timezone
from sqlalchemy import select, func, and_, or_, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.chat.models import Conversation, DirectParticipant, Message, ConversationRead
from app.chat.schemas import (
    ConversationResponse,
    MessageResponse,
    ParticipantInfo,
    SendMessageRequest,
)
from app.auth.models import User
from app.groups.models import Group, GroupMember


def _canonical_pair(a: str, b: str) -> tuple[str, str]:
    """Return (smaller, larger) UUID strings so direct conversations are unique."""
    return (a, b) if a < b else (b, a)


async def get_or_create_direct_conversation(
    user_id: str, friend_id: str, db: AsyncSession
) -> ConversationResponse:
    """Get existing direct conversation between two users, or create one."""
    u1, u2 = _canonical_pair(user_id, friend_id)

    # Find existing conversation where both users are participants
    stmt = (
        select(DirectParticipant.conversation_id)
        .where(DirectParticipant.user_id.in_([u1, u2]))
        .group_by(DirectParticipant.conversation_id)
        .having(func.count(DirectParticipant.user_id) == 2)
    )
    existing = await db.execute(stmt)
    row = existing.scalar_one_or_none()

    if row:
        conv_id = row
    else:
        conv = Conversation(type="direct")
        db.add(conv)
        await db.flush()
        conv_id = conv.id

        db.add(DirectParticipant(conversation_id=conv_id, user_id=u1))
        db.add(DirectParticipant(conversation_id=conv_id, user_id=u2))
        await db.commit()

    return await _build_conversation_response(conv_id, user_id, db)


async def get_or_create_group_conversation(
    group_id: str, user_id: str, db: AsyncSession
) -> ConversationResponse:
    """Get existing group conversation or create one."""
    result = await db.execute(
        select(Conversation).where(
            Conversation.type == "group",
            Conversation.group_id == group_id,
        )
    )
    conv = result.scalar_one_or_none()

    if not conv:
        conv = Conversation(type="group", group_id=group_id)
        db.add(conv)
        await db.commit()

    return await _build_conversation_response(conv.id, user_id, db)


async def get_user_conversations(user_id: str, db: AsyncSession) -> list[ConversationResponse]:
    """List all conversations the user participates in, sorted by most recent activity."""

    # Direct conversations via direct_participants
    direct_q = select(Conversation.id).join(
        DirectParticipant, DirectParticipant.conversation_id == Conversation.id
    ).where(
        Conversation.type == "direct",
        DirectParticipant.user_id == user_id,
    )

    # Group conversations via group_members
    group_q = select(Conversation.id).join(
        GroupMember,
        and_(
            Conversation.group_id == GroupMember.group_id,
            GroupMember.user_id == user_id,
        )
    ).where(Conversation.type == "group")

    result = await db.execute(direct_q.union(group_q))
    conv_ids = [r[0] for r in result.all()]

    if not conv_ids:
        return []

    conversations = []
    for cid in conv_ids:
        conversations.append(await _build_conversation_response(cid, user_id, db))

    # Sort by last_message.created_at descending, conversations with no messages last
    conversations.sort(
        key=lambda c: c.last_message.created_at if c.last_message else c.created_at,
        reverse=True,
    )
    return conversations


async def get_messages(
    conversation_id: str,
    user_id: str,
    db: AsyncSession,
    before_message_id: str | None = None,
    limit: int = 30,
) -> list[MessageResponse]:
    """Paginated message history, newest-first."""
    if not await _is_participant(conversation_id, user_id, db):
        return []

    query = select(Message).where(Message.conversation_id == conversation_id)

    if before_message_id:
        # Get the created_at of the cursor message
        cursor_res = await db.execute(
            select(Message.created_at).where(Message.id == before_message_id)
        )
        cursor_ts = cursor_res.scalar_one_or_none()
        if cursor_ts:
            query = query.where(Message.created_at < cursor_ts)

    query = query.order_by(Message.created_at.desc()).limit(limit)
    result = await db.execute(query)
    messages = result.scalars().all()

    return [await _to_message_response(m, db) for m in reversed(messages)]


async def get_new_messages(
    conversation_id: str,
    user_id: str,
    after_message_id: str | None,
    db: AsyncSession,
) -> list[MessageResponse]:
    """Return only messages newer than the given message ID — for polling."""
    if not await _is_participant(conversation_id, user_id, db):
        return []

    query = select(Message).where(Message.conversation_id == conversation_id)

    if after_message_id:
        cursor_res = await db.execute(
            select(Message.created_at).where(Message.id == after_message_id)
        )
        cursor_ts = cursor_res.scalar_one_or_none()
        if cursor_ts:
            query = query.where(Message.created_at > cursor_ts)

    query = query.order_by(Message.created_at.asc()).limit(50)
    result = await db.execute(query)
    messages = result.scalars().all()

    return [await _to_message_response(m, db) for m in messages]


async def send_message(
    conversation_id: str,
    user_id: str,
    payload: SendMessageRequest,
    db: AsyncSession,
) -> MessageResponse | None:
    """Create a message in a conversation."""
    if not await _is_participant(conversation_id, user_id, db):
        return None

    msg = Message(
        conversation_id=conversation_id,
        sender_id=user_id,
        message_type=payload.message_type,
        content=payload.content,
        shared_ref_id=payload.shared_ref_id,
    )
    db.add(msg)
    await db.flush()

    # Automatically advance sender's own read cursor to the sent message
    read_res = await db.execute(
        select(ConversationRead).where(
            ConversationRead.conversation_id == conversation_id,
            ConversationRead.user_id == user_id,
        )
    )
    read_row = read_res.scalar_one_or_none()
    if read_row:
        read_row.last_read_message_id = msg.id
        read_row.updated_at = datetime.now(timezone.utc)
    else:
        db.add(ConversationRead(
            conversation_id=conversation_id,
            user_id=user_id,
            last_read_message_id=msg.id,
            updated_at=datetime.now(timezone.utc),
        ))

    await db.commit()

    return await _to_message_response(msg, db)


async def mark_as_read(conversation_id: str, user_id: str, db: AsyncSession) -> bool:
    """Update the user's read cursor to the latest message in the conversation."""
    if not await _is_participant(conversation_id, user_id, db):
        return False

    # Get the latest message
    latest_res = await db.execute(
        select(Message.id)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.desc())
        .limit(1)
    )
    latest_msg_id = latest_res.scalar_one_or_none()

    result = await db.execute(
        select(ConversationRead).where(
            ConversationRead.conversation_id == conversation_id,
            ConversationRead.user_id == user_id,
        )
    )
    read_row = result.scalar_one_or_none()

    if read_row:
        read_row.last_read_message_id = latest_msg_id
        read_row.updated_at = datetime.now(timezone.utc)
    else:
        db.add(ConversationRead(
            conversation_id=conversation_id,
            user_id=user_id,
            last_read_message_id=latest_msg_id,
            updated_at=datetime.now(timezone.utc),
        ))

    await db.commit()
    return True


# ── Private helpers ──────────────────────────────────────────


async def _is_participant(conversation_id: str, user_id: str, db: AsyncSession) -> bool:
    """Check if user is a participant of the conversation."""
    conv_res = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conv = conv_res.scalar_one_or_none()
    if not conv:
        return False

    if conv.type == "direct":
        dp_res = await db.execute(
            select(DirectParticipant).where(
                DirectParticipant.conversation_id == conversation_id,
                DirectParticipant.user_id == user_id,
            )
        )
        return dp_res.scalar_one_or_none() is not None
    else:
        gm_res = await db.execute(
            select(GroupMember).where(
                GroupMember.group_id == conv.group_id,
                GroupMember.user_id == user_id,
            )
        )
        return gm_res.scalar_one_or_none() is not None


async def _to_message_response(msg: Message, db: AsyncSession) -> MessageResponse:
    """Convert a Message ORM object to a MessageResponse."""
    user_res = await db.execute(select(User).where(User.id == msg.sender_id))
    sender = user_res.scalar_one_or_none()

    return MessageResponse(
        id=msg.id,
        conversation_id=msg.conversation_id,
        sender_id=msg.sender_id,
        sender_username=sender.username if sender else "Unknown",
        sender_tag=sender.tag if sender else "0000",
        message_type=msg.message_type,
        content=msg.content,
        shared_ref_id=msg.shared_ref_id,
        created_at=msg.created_at,
    )


async def _get_unread_count(conversation_id: str, user_id: str, db: AsyncSession) -> int:
    """Count messages after the user's last read cursor (excluding messages sent by the user)."""
    read_res = await db.execute(
        select(ConversationRead).where(
            ConversationRead.conversation_id == conversation_id,
            ConversationRead.user_id == user_id,
        )
    )
    read_row = read_res.scalar_one_or_none()

    query = select(func.count()).select_from(Message).where(
        Message.conversation_id == conversation_id,
        Message.sender_id != user_id,
    )

    if read_row and read_row.last_read_message_id:
        # Get the timestamp of the last read message
        cursor_res = await db.execute(
            select(Message.created_at).where(Message.id == read_row.last_read_message_id)
        )
        cursor_ts = cursor_res.scalar_one_or_none()
        if cursor_ts:
            query = query.where(Message.created_at > cursor_ts)

    result = await db.execute(query)
    return result.scalar() or 0


async def _build_conversation_response(
    conversation_id: str, user_id: str, db: AsyncSession
) -> ConversationResponse:
    """Build a full ConversationResponse for a given conversation."""
    conv_res = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conv = conv_res.scalar_one()

    # Last message
    last_msg_res = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.desc())
        .limit(1)
    )
    last_msg = last_msg_res.scalar_one_or_none()
    last_message = await _to_message_response(last_msg, db) if last_msg else None

    # Unread count
    unread = await _get_unread_count(conversation_id, user_id, db)

    # Participants / group info
    participants = []
    group_name = None

    if conv.type == "direct":
        dp_res = await db.execute(
            select(DirectParticipant.user_id).where(
                DirectParticipant.conversation_id == conversation_id
            )
        )
        for (uid,) in dp_res.all():
            u_res = await db.execute(select(User).where(User.id == uid))
            u = u_res.scalar_one_or_none()
            if u:
                participants.append(ParticipantInfo(
                    id=u.id, username=u.username, tag=u.tag, avatar_url=u.avatar_url
                ))
    else:
        if conv.group_id:
            g_res = await db.execute(select(Group).where(Group.id == conv.group_id))
            g = g_res.scalar_one_or_none()
            group_name = g.name if g else None

    return ConversationResponse(
        id=conv.id,
        type=conv.type,
        group_id=conv.group_id,
        group_name=group_name,
        created_at=conv.created_at,
        last_message=last_message,
        unread_count=unread,
        participants=participants,
    )
