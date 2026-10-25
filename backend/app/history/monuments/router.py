from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_async_session
from app.core.deps import CurrentUser, get_current_user, verify_internal_service_secret
from .catalogue import find_monument
from .models import MonumentFavorite, MonumentTourCompletion
from .schemas import CompletionRequest, CompletionResponse, FavoriteResponse
from .service import purge_learning, export_learning

router = APIRouter(prefix="/api/monuments", tags=["Monument learning"])
internal_router = APIRouter(prefix="/internal/users", dependencies=[Depends(verify_internal_service_secret)])


@internal_router.post("/{user_id}/purge")
async def purge_records(user_id: str, db: AsyncSession = Depends(get_async_session)):
    await purge_learning(db, user_id)
    await db.commit()
    return {"status": "purged"}


@internal_router.get("/{user_id}/export")
async def export_records(user_id: str, db: AsyncSession = Depends(get_async_session)):
    return await export_learning(db, user_id)


def require_monument(monument_id):
    monument = find_monument(monument_id)
    if monument is None:
        raise HTTPException(status_code=404, detail="Monument is not in the supported collection")
    return monument


async def insert_once(db, model, values):
    """Atomic idempotent insert on the application's PostgreSQL/SQLite dialects."""
    dialect = db.get_bind().dialect.name
    if dialect not in {"sqlite", "postgresql"}:
        raise RuntimeError("Unsupported monument learning database dialect")
    insert = sqlite_insert if dialect == "sqlite" else pg_insert
    statement = insert(model).values(**values).on_conflict_do_nothing(
        index_elements=[column.name for column in model.__table__.primary_key.columns]
    )
    await db.execute(statement)
    await db.commit()
    key = tuple(values[column.name] for column in model.__table__.primary_key.columns)
    return await db.get(model, key)


@router.get("/favorites", response_model=list[FavoriteResponse])
async def favorites(user: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_async_session)):
    result = await db.execute(select(MonumentFavorite).where(MonumentFavorite.user_id == user.id).order_by(MonumentFavorite.monument_id))
    return result.scalars().all()


@router.put("/favorites/{monument_id}", response_model=FavoriteResponse)
async def save_favorite(monument_id: str, user: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_async_session)):
    require_monument(monument_id)
    return await insert_once(db, MonumentFavorite, {"user_id": user.id, "monument_id": monument_id})


@router.delete("/favorites/{monument_id}")
async def remove_favorite(monument_id: str, user: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_async_session)):
    require_monument(monument_id)
    await db.execute(delete(MonumentFavorite).where(MonumentFavorite.user_id == user.id, MonumentFavorite.monument_id == monument_id))
    await db.commit()
    return {"monument_id": monument_id, "saved": False}


@router.get("/progress", response_model=list[CompletionResponse])
async def progress(user: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_async_session)):
    result = await db.execute(select(MonumentTourCompletion).where(MonumentTourCompletion.user_id == user.id).order_by(MonumentTourCompletion.monument_id, MonumentTourCompletion.tour_revision))
    return result.scalars().all()


@router.put("/progress/{monument_id}", response_model=CompletionResponse)
async def complete_tour(monument_id: str, body: CompletionRequest, user: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_async_session)):
    monument = require_monument(monument_id)
    if body.tour_revision != monument["tour_revision"]:
        raise HTTPException(status_code=409, detail="The tour has changed. Reload the explorer before saving completion.")
    # Self-reported learning completion, never a quiz score or wallet reward.
    return await insert_once(db, MonumentTourCompletion, {"user_id": user.id, "monument_id": monument_id, "tour_revision": body.tour_revision})
