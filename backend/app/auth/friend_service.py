"""
Friend and presence service logic.
"""

from datetime import datetime, timezone
from sqlalchemy import select, or_, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from app.auth.models import User, Friend, UserPresence
from app.auth.schemas import FriendRequestResponse, FriendWithPresence, SearchUserResponse, UserResponse


ONLINE_THRESHOLD_SECONDS = 60


async def search_users(query: str, db: AsyncSession) -> list[SearchUserResponse]:
    """Search users by partial name or exact Name#Tag."""
    query = query.strip()
    if "#" in query:
        name, tag = query.rsplit("#", 1)
        res = await db.execute(
            select(User).where(
                func.lower(User.username) == name.strip().lower(),
                User.tag == tag.strip(),
            )
        )
        user = res.scalar_one_or_none()
        return [SearchUserResponse.model_validate(user)] if user else []
    
    res = await db.execute(
        select(User).where(User.username.ilike(f"%{query}%")).limit(10)
    )
    users = res.scalars().all()
    return [SearchUserResponse.model_validate(u) for u in users]


async def send_friend_request(
    db: AsyncSession, requester_id: str, addressee_id: str
) -> FriendRequestResponse:
    """Send a friend request. Auto-accepts if the other user already requested you."""
    if requester_id == addressee_id:
        raise HTTPException(400, "Can't add yourself")

    # Check if addressee exists
    addressee = await db.get(User, addressee_id)
    if not addressee:
        raise HTTPException(404, "User not found")

    # Check for existing relationship in either direction
    res = await db.execute(
        select(Friend).where(
            or_(
                and_(Friend.requester_id == requester_id, Friend.addressee_id == addressee_id),
                and_(Friend.requester_id == addressee_id, Friend.addressee_id == requester_id),
            )
        )
    )
    existing = res.scalar_one_or_none()

    if existing:
        if existing.status == "accepted":
            raise HTTPException(409, "Already friends")
        if existing.requester_id == addressee_id:
            # They already requested you — accept instead of duplicating
            existing.status = "accepted"
            await db.commit()
            await db.refresh(existing)
            return await _build_friend_request_response(db, existing)
        raise HTTPException(409, "Request already pending")

    friend = Friend(requester_id=requester_id, addressee_id=addressee_id)
    db.add(friend)
    await db.commit()
    await db.refresh(friend)
    return await _build_friend_request_response(db, friend)


async def get_incoming_requests(db: AsyncSession, user_id: str) -> list[FriendRequestResponse]:
    """Get pending friend requests sent to the current user."""
    res = await db.execute(
        select(Friend).where(
            Friend.addressee_id == user_id,
            Friend.status == "pending",
        ).order_by(Friend.created_at.desc())
    )
    requests = res.scalars().all()
    return [await _build_friend_request_response(db, r) for r in requests]


async def get_outgoing_requests(db: AsyncSession, user_id: str) -> list[FriendRequestResponse]:
    """Get pending friend requests sent by the current user."""
    res = await db.execute(
        select(Friend).where(
            Friend.requester_id == user_id,
            Friend.status == "pending",
        ).order_by(Friend.created_at.desc())
    )
    requests = res.scalars().all()
    return [await _build_friend_request_response(db, r) for r in requests]


async def accept_friend_request(db: AsyncSession, request_id: str, user_id: str) -> FriendRequestResponse:
    """Accept a pending friend request."""
    res = await db.execute(
        select(Friend).where(
            Friend.id == request_id,
            Friend.addressee_id == user_id,
            Friend.status == "pending",
        )
    )
    friend = res.scalar_one_or_none()
    if not friend:
        raise HTTPException(404, "Friend request not found")

    friend.status = "accepted"
    await db.commit()
    await db.refresh(friend)
    return await _build_friend_request_response(db, friend)


async def decline_friend_request(db: AsyncSession, request_id: str, user_id: str) -> None:
    """Decline a pending friend request."""
    res = await db.execute(
        select(Friend).where(
            Friend.id == request_id,
            Friend.addressee_id == user_id,
            Friend.status == "pending",
        )
    )
    friend = res.scalar_one_or_none()
    if not friend:
        raise HTTPException(404, "Friend request not found")

    await db.delete(friend)
    await db.commit()


async def unfriend(db: AsyncSession, user_id: str, friend_user_id: str) -> None:
    """Remove a friendship (accepted relationship)."""
    res = await db.execute(
        select(Friend).where(
            or_(
                and_(Friend.requester_id == user_id, Friend.addressee_id == friend_user_id),
                and_(Friend.requester_id == friend_user_id, Friend.addressee_id == user_id),
            ),
            Friend.status == "accepted",
        )
    )
    friend = res.scalar_one_or_none()
    if not friend:
        raise HTTPException(404, "Friendship not found")

    await db.delete(friend)
    await db.commit()


async def list_friends_with_presence(db: AsyncSession, user_id: str) -> list[FriendWithPresence]:
    """Get accepted friends with online/offline presence (batched query)."""
    # Get accepted friends
    res = await db.execute(
        select(User).join(
            Friend,
            or_(
                and_(Friend.requester_id == user_id, Friend.addressee_id == User.id),
                and_(Friend.addressee_id == user_id, Friend.requester_id == User.id),
            )
        ).where(
            Friend.status == "accepted",
            User.id != user_id,
        )
    )
    friends = res.scalars().all()
    
    if not friends:
        return []

    friend_ids = [f.id for f in friends]
    
    # Batch fetch presence
    presence_res = await db.execute(
        select(UserPresence).where(UserPresence.user_id.in_(friend_ids))
    )
    presence_map = {p.user_id: p.last_seen_at for p in presence_res.scalars().all()}
    
    now = datetime.now(timezone.utc)
    result = []
    for f in friends:
        last_seen = presence_map.get(f.id)
        is_online = False
        if last_seen:
            delta = (now - last_seen).total_seconds()
            is_online = delta < ONLINE_THRESHOLD_SECONDS
        
        result.append(FriendWithPresence(
            id=f.id,
            username=f.username,
            tag=f.tag,
            avatar_url=f.avatar_url,
            is_online=is_online,
            last_seen_at=last_seen,
        ))
    
    return result


async def heartbeat(db: AsyncSession, user_id: str) -> None:
    """Update user's last seen timestamp."""
    presence = UserPresence(user_id=user_id, last_seen_at=datetime.now(timezone.utc))
    await db.merge(presence)
    await db.commit()


async def _build_friend_request_response(db: AsyncSession, friend: Friend) -> FriendRequestResponse:
    """Build FriendRequestResponse with requester and addressee details."""
    requester = await db.get(User, friend.requester_id)
    addressee = await db.get(User, friend.addressee_id)
    
    return FriendRequestResponse(
        id=friend.id,
        requester_id=friend.requester_id,
        addressee_id=friend.addressee_id,
        status=friend.status,
        created_at=friend.created_at,
        requester=UserResponse.model_validate(requester) if requester else None,
        addressee=UserResponse.model_validate(addressee) if addressee else None,
    )