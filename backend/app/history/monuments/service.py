from sqlalchemy import delete, select
from .models import MonumentFavorite, MonumentTourCompletion
from .schemas import FavoriteResponse, CompletionResponse


async def purge_learning(db, user_id):
    for model in (MonumentFavorite, MonumentTourCompletion):
        await db.execute(delete(model).where(model.user_id == user_id))


async def export_learning(db, user_id):
    favorites = (await db.execute(select(MonumentFavorite).where(MonumentFavorite.user_id == user_id))).scalars().all()
    completions = (await db.execute(select(MonumentTourCompletion).where(MonumentTourCompletion.user_id == user_id))).scalars().all()
    return {"favorites": [FavoriteResponse.model_validate(row).model_dump(mode="json") for row in favorites],
            "completed_tours": [CompletionResponse.model_validate(row).model_dump(mode="json") for row in completions]}
