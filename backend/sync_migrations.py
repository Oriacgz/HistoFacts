"""
Quick utility to sync the local PostgreSQL database alembic_version table to the current migration head.
"""
import asyncio
from sqlalchemy import text
from app.core.database import engine

HEAD_REVISION = "c7d8e9f0a1b2"


async def main():
    print(f">> Syncing database alembic_version table to head: {HEAD_REVISION}...")
    async with engine.begin() as conn:
        # Ensure alembic_version table exists
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS alembic_version (
                version_num VARCHAR(32) NOT NULL,
                CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
            );
        """))
        # Clear any stale or orphaned revision IDs
        await conn.execute(text("DELETE FROM alembic_version;"))
        # Insert current head revision
        await conn.execute(text(f"INSERT INTO alembic_version (version_num) VALUES ('{HEAD_REVISION}');"))
    
    print(">> Successfully synced alembic_version to current head!")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
