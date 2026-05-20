# backend/app/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import get_pool, close_pool, init_db
from app.api.routes import chat, documents, health


@asynccontextmanager
async def lifespan(app: FastAPI):
    pool = await get_pool()
    await init_db(pool)
    print("  Database connected and tables ready")
    yield
    await close_pool()
    print("  Database pool closed")


app = FastAPI(
    title="Cambodian Legal RAG API",
    description="Agentic RAG chatbot for Cambodian labour law",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router,    prefix="/api")
app.include_router(chat.router,      prefix="/api")
app.include_router(documents.router, prefix="/api")