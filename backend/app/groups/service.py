"""
Business logic for Group creation, membership, and member queries.
"""

from datetime import datetime, timedelta, timezone
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.groups.models import Group, GroupMember, UserSummaryCache
from app.groups.schemas import CreateGroupRequest, GroupResponse, GroupMemberResponse
from app.core.inter_service import notify


async def _get_user_summary(user_id: str, db: AsyncSession) -> UserSummaryCache | None:
    """Get user summary from local cache or fetch from Auth service."""
    cached = await db.get(UserSummaryCache, user_id)
    if cached:
        synced_at = cached.synced_at
        if synced_at.tzinfo is None:
            synced_at = synced_at.replace(tzinfo=timezone.utc)
        if (datetime.now(timezone.utc) - synced_at) < timedelta(hours=1):
            return cached

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


async def create_group(req: CreateGroupRequest, creator_id: str, db: AsyncSession) -> GroupResponse:
    unique_member_ids = list(dict.fromkeys(m for m in (req.member_ids or []) if m and m != creator_id))
    total_count = len(unique_member_ids) + 1

    if total_count < 3:
        raise ValueError("At least 3 members (creator + 2 invited members) are required to create a group.")
    if total_count > 50:
        raise ValueError("A group cannot exceed 50 members.")

    group = Group(
        name=req.name,
        description=req.description,
        created_by=creator_id,
    )
    db.add(group)
    await db.flush()

    admin_member = GroupMember(
        group_id=group.id,
        user_id=creator_id,
        role="admin",
    )
    db.add(admin_member)

    for uid in unique_member_ids:
        db.add(GroupMember(
            group_id=group.id,
            user_id=uid,
            role="member",
        ))

    await db.commit()

    creator = await _get_user_summary(creator_id, db)
    creator_name = creator.username if creator else "Scholar"

    for uid in unique_member_ids:
        await notify(
            user_id=uid,
            type="group_invite",
            payload={
                "group_id": group.id,
                "group_name": group.name,
                "from_user_id": creator_id,
                "from_user": creator_name,
            },
        )

    members_resp = []
    all_uids = [creator_id] + unique_member_ids
    for uid in all_uids:
        u = await _get_user_summary(uid, db)
        m_role = "admin" if uid == creator_id else "member"
        members_resp.append(
            GroupMemberResponse(
                group_id=group.id,
                user_id=uid,
                role=m_role,
                joined_at=group.created_at,
                user=u,
            )
        )

    return GroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        created_by=group.created_by,
        created_at=group.created_at,
        member_count=total_count,
        members=members_resp,
    )


async def get_user_groups(user_id: str, db: AsyncSession) -> list[GroupResponse]:
    res = await db.execute(
        select(Group)
        .join(GroupMember, GroupMember.group_id == Group.id)
        .where(GroupMember.user_id == user_id)
        .order_by(Group.created_at.desc())
    )
    groups = res.scalars().all()

    out = []
    for g in groups:
        m_count_res = await db.execute(
            select(func.count()).select_from(GroupMember).where(GroupMember.group_id == g.id)
        )
        count = m_count_res.scalar() or 0
        out.append(
            GroupResponse(
                id=g.id,
                name=g.name,
                description=g.description,
                created_by=g.created_by,
                created_at=g.created_at,
                member_count=count,
            )
        )
    return out


async def add_group_member(group_id: str, user_id: str, role: str, db: AsyncSession) -> tuple[bool, str]:
    res = await db.execute(
        select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == user_id)
    )
    if res.scalar_one_or_none():
        return False, "Already a member of this group"

    count_res = await db.execute(
        select(func.count()).select_from(GroupMember).where(GroupMember.group_id == group_id)
    )
    current_count = count_res.scalar() or 0
    if current_count >= 50:
        return False, "Group has reached maximum capacity of 50 members"

    member = GroupMember(group_id=group_id, user_id=user_id, role=role)
    db.add(member)
    await db.commit()
    return True, "Joined successfully"
