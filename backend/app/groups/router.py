"""
FastAPI router for Groups endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.groups.schemas import CreateGroupRequest, GroupResponse
from app.groups.service import create_group, get_user_groups, add_group_member
from app.core.database import get_async_session
from app.core.deps import get_current_user, CurrentUser

router = APIRouter(prefix="/api/groups", tags=["Groups"])


@router.post("", response_model=GroupResponse, status_code=status.HTTP_201_CREATED)
async def create_new_group(
    req: CreateGroupRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    try:
        return await create_group(req, current_user.id, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=list[GroupResponse])
async def list_my_groups(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    return await get_user_groups(current_user.id, db)


@router.post("/{group_id}/join", status_code=status.HTTP_200_OK)
async def join_group(
    group_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    added, msg = await add_group_member(group_id, current_user.id, "member", db)
    if not added:
        raise HTTPException(status_code=400, detail=msg)
    return {"status": "joined", "group_id": group_id}
