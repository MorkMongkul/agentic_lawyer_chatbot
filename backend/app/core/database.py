# backend/app/core/database.py
import asyncpg
from app.core.config import get_settings

settings = get_settings()
_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            dsn=settings.database_url,
            min_size=1,
            max_size=10,
            command_timeout=60,
        )
    return _pool


async def close_pool():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


async def get_db():
    """FastAPI dependency — yields a single connection from the pool."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        yield conn


async def init_db(pool: asyncpg.Pool):
    """Create all tables on startup if they don't exist."""
    async with pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS chat_sessions (
                session_id   TEXT PRIMARY KEY,
                created_at   TIMESTAMPTZ DEFAULT NOW(),
                updated_at   TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS chat_messages (
                id           BIGSERIAL PRIMARY KEY,
                session_id   TEXT REFERENCES chat_sessions(session_id) ON DELETE CASCADE,
                role         TEXT        NOT NULL CHECK (role IN ('user','assistant')),
                content      TEXT        NOT NULL,
                citations    JSONB       DEFAULT '[]',
                created_at   TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_messages_session
                ON chat_messages(session_id, created_at);

            -- Auth: associate sessions with a Clerk user (NULL = anonymous)
            ALTER TABLE chat_sessions
                ADD COLUMN IF NOT EXISTS user_id TEXT;

            CREATE INDEX IF NOT EXISTS idx_sessions_user
                ON chat_sessions(user_id, updated_at DESC);

            -- Free-tier quota for anonymous visitors, keyed by an httpOnly cookie id
            CREATE TABLE IF NOT EXISTS anonymous_usage (
                anon_id        TEXT PRIMARY KEY,
                question_count INTEGER     NOT NULL DEFAULT 0,
                created_at     TIMESTAMPTZ DEFAULT NOW(),
                updated_at     TIMESTAMPTZ DEFAULT NOW()
            );
        """)