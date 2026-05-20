# backend/app/api/routes/health.py
from fastapi import APIRouter
from app.core.database import get_pool

router = APIRouter(tags=["health"])

@router.get("/health")
async def health():
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {e}"

    return {
        "status":   "ok",
        "database": db_status,
    }