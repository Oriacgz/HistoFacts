"""
Business logic for Group creation, membership, and member queries.
"""

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.groups.models import Group, GroupMember
from app.groups.schemas import CreateGroupRequest, GroupResponse, GroupMemberResponse
from app.auth.models import User
from app.auth.schemas import UserResponse


async def create_group(req: CreateGroupRequest, creator_id: str, db: AsyncSession) -> GroupResponse:
    # Filter unique member IDs excluding creator
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

    # Creator is admin member
    admin_member = GroupMember(
        group_id=group.id,
        user_id=creator_id,
        role="admin",
    )
    db.add(admin_member)

    # Add initial invited members
    for uid in unique_member_ids:
        db.add(GroupMember(
            group_id=group.id,
            user_id=uid,
            role="member",
        ))

    await db.commit()

    # Build response members
    members_resp = []
    all_uids = [creator_id] + unique_member_ids
    for uid in all_uids:
        u_res = await db.execute(select(User).where(User.id == uid))
        u = u_res.scalar_one_or_none()
        m_role = "admin" if uid == creator_id else "member"
        members_resp.append(
            GroupMemberResponse(
                group_id=group.id,
                user_id=uid,
                role=m_role,
                joined_at=group.created_at,
                user=UserResponse.model_validate(u) if u else None,
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

    # Check capacity (maximum 50 members)
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
