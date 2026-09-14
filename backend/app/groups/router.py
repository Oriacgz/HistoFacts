"""
FastAPI router for Groups endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, delete, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.groups.models import GroupMember, UserSummaryCache as GroupsCache
from app.groups.schemas import CreateGroupRequest, GroupResponse
from app.groups.service import create_group, get_user_groups, add_group_member
from app.core.database import get_async_session
from app.core.deps import get_current_user, CurrentUser, verify_internal_service_secret

router = APIRouter(tags=["Groups"])


@router.post("/api/groups", response_model=GroupResponse, status_code=status.HTTP_201_CREATED)
async def create_new_group(
    req: CreateGroupRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    try:
        return await create_group(req, current_user.id, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api/groups", response_model=list[GroupResponse])
async def list_my_groups(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    return await get_user_groups(current_user.id, db)


@router.post("/api/groups/{group_id}/join", status_code=status.HTTP_200_OK)
async def join_group(
    group_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    added, msg = await add_group_member(group_id, current_user.id, "member", db)
    if not added:
        raise HTTPException(status_code=400, detail=msg)
    return {"status": "joined", "group_id": group_id}


@router.post(
    "/internal/users/{user_id}/purge",
    dependencies=[Depends(verify_internal_service_secret)],
)
async def purge_user_groups(
    user_id: str,
    db: AsyncSession = Depends(get_async_session),
):
    """Remove user memberships and anonymize cache."""
    await db.execute(delete(GroupMember).where(GroupMember.user_id == user_id))
    await db.execute(
        update(GroupsCache)
        .where(GroupsCache.user_id == user_id)
        .values(username="Deleted User", bio=None, avatar_url=None)
    )
    await db.commit()
    return {"status": "purged", "service": "groups"}


@router.get(
    "/internal/users/{user_id}/export",
    dependencies=[Depends(verify_internal_service_secret)],
)
async def export_user_groups(
    user_id: str,
    db: AsyncSession = Depends(get_async_session),
):
    res = await db.execute(select(GroupMember).where(GroupMember.user_id == user_id))
    return {
        "memberships": [
            {"group_id": m.group_id, "role": m.role, "joined_at": str(m.joined_at)}
            for m in res.scalars().all()
        ]
    }
