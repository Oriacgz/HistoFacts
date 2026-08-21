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
    group = Group(
        name=req.name,
        description=req.description,
        created_by=creator_id,
    )
    db.add(group)
    await db.flush()

    # Creator is admin member
    member = GroupMember(
        group_id=group.id,
        user_id=creator_id,
        role="admin",
    )
    db.add(member)
    await db.flush()

    u_res = await db.execute(select(User).where(User.id == creator_id))
    creator = u_res.scalar_one_or_none()

    m_resp = GroupMemberResponse(
        group_id=group.id,
        user_id=creator_id,
        role="admin",
        joined_at=member.joined_at,
        user=UserResponse.model_validate(creator) if creator else None,
    )

    return GroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        created_by=group.created_by,
        created_at=group.created_at,
        member_count=1,
        members=[m_resp],
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


async def add_group_member(group_id: str, user_id: str, role: str, db: AsyncSession) -> bool:
    res = await db.execute(
        select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == user_id)
    )
    if res.scalar_one_or_none():
        return False

    member = GroupMember(group_id=group_id, user_id=user_id, role=role)
    db.add(member)
    await db.flush()
    return True
