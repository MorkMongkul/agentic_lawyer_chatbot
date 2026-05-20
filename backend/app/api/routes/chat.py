# backend/app/api/routes/chat.py
import json
import uuid
import asyncio
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import asyncpg

from app.core.database import get_db
from agents.orchestrator import agent_graph
from app.core.database import get_db, get_pool

router = APIRouter(tags=["chat"])


# ── Request / Response schemas ────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message:    str
    session_id: str | None = None   # None = new session


class SessionResponse(BaseModel):
    session_id: str


# ── Session helpers ───────────────────────────────────────────────────────────

async def get_or_create_session(
    session_id: str | None,
    conn: asyncpg.Connection
) -> str:
    """Return existing session_id or create a new one."""
    if session_id:
        exists = await conn.fetchval(
            "SELECT session_id FROM chat_sessions WHERE session_id = $1",
            session_id
        )
        if exists:
            await conn.execute(
                "UPDATE chat_sessions SET updated_at = NOW() WHERE session_id = $1",
                session_id
            )
            return session_id

    # Create new session
    new_id = str(uuid.uuid4())
    await conn.execute(
        "INSERT INTO chat_sessions (session_id) VALUES ($1)",
        new_id
    )
    return new_id


async def get_conversation_history(
    session_id: str,
    conn: asyncpg.Connection,
    limit: int = 6   # last 3 exchanges
) -> list[dict]:
    """Fetch recent messages for context."""
    rows = await conn.fetch("""
        SELECT role, content
        FROM chat_messages
        WHERE session_id = $1
        ORDER BY created_at DESC
        LIMIT $2
    """, session_id, limit)

    # Reverse so oldest first
    return [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]


async def save_messages(
    session_id: str,
    user_message: str,
    assistant_answer: str,
    citations: list[dict],
    conn: asyncpg.Connection,
):
    """Save user + assistant messages to database."""
    await conn.executemany("""
        INSERT INTO chat_messages (session_id, role, content, citations)
        VALUES ($1, $2, $3, $4)
    """, [
        (session_id, "user",      user_message,     json.dumps([])),
        (session_id, "assistant", assistant_answer, json.dumps(citations)),
    ])


# ── SSE streaming ─────────────────────────────────────────────────────────────

def sse_event(data: dict) -> str:
    """Format a Server-Sent Event."""
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


async def stream_agent_response(
    message:    str,
    session_id: str,
    history:    list[dict],
) -> AsyncGenerator[str, None]:
    try:
        yield sse_event({"type": "status", "message": "កំពុងស្វែងរក..."})
        await asyncio.sleep(0.05)

        # Run agent graph
        loop   = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, lambda: agent_graph.invoke({
            "user_query":           message,
            "session_id":           session_id,
            "conversation_history": history,
            "intent":               "",
            "article_number":       None,
            "rewritten_query":      "",
            "retrieved_chunks":     [],
            "is_grounded":          False,
            "retry_count":          0,
            "final_answer":         "",
            "citations":            [],
            "used_web_search":      False,
        }))

        # These are now guaranteed clean (parsed inside response_agent)
        answer    = result.get("final_answer", "")
        citations = result.get("citations", [])

        yield sse_event({"type": "status", "message": "កំពុងបង្កើតចម្លើយ..."})
        await asyncio.sleep(0.05)

        # Stream clean Khmer text
        for i in range(0, len(answer), 8):
            yield sse_event({"type": "token", "content": answer[i:i+8]})
            await asyncio.sleep(0.01)

        yield sse_event({"type": "citations", "data": citations})
        yield sse_event({"type": "done", "session_id": session_id})

        # Save to DB
        try:
            pool = await get_pool()
            async with pool.acquire() as conn:
                await save_messages(session_id, message, answer, citations, conn)
        except Exception as e:
            print(f"Warning: DB save failed: {e}")

    except Exception as e:
        import traceback
        traceback.print_exc()
        yield sse_event({"type": "error", "message": str(e)})


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/chat/session", response_model=SessionResponse)
async def create_session(conn: asyncpg.Connection = Depends(get_db)):
    """Create a new chat session before starting a conversation."""
    session_id = await get_or_create_session(None, conn)
    return {"session_id": session_id}


@router.post("/chat")
async def chat(
    request: ChatRequest,
    conn:    asyncpg.Connection = Depends(get_db),
):
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    session_id = await get_or_create_session(request.session_id, conn)
    history    = await get_conversation_history(session_id, conn)

    return StreamingResponse(
        stream_agent_response(request.message, session_id, history),
        media_type="text/event-stream",
        headers={
            "Cache-Control":               "no-cache",
            "X-Accel-Buffering":           "no",
            "Access-Control-Allow-Origin": "*",
        }
    )


@router.get("/chat/{session_id}/history")
async def get_history(
    session_id: str,
    conn: asyncpg.Connection = Depends(get_db),
):
    """Get full conversation history for a session."""
    rows = await conn.fetch("""
        SELECT role, content, citations, created_at
        FROM chat_messages
        WHERE session_id = $1
        ORDER BY created_at ASC
    """, session_id)

    if not rows:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "session_id": session_id,
        "messages": [
            {
                "role":      r["role"],
                "content":   r["content"],
                "citations": json.loads(r["citations"]) if r["citations"] else [],
                "timestamp": r["created_at"].isoformat(),
            }
            for r in rows
        ]
    }