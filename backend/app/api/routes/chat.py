# backend/app/api/routes/chat.py
import json
import uuid
import asyncio
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
import asyncpg

from app.core.database import get_db, get_pool
from app.core.auth import get_optional_user_id
from agents.orchestrator import agent_graph

router = APIRouter(tags=["chat"])

# ── Anonymous free-tier quota ─────────────────────────────────────────────────
ANON_QUESTION_LIMIT = 3
ANON_COOKIE         = "niti_anon_id"
ANON_COOKIE_MAX_AGE = 60 * 60 * 24 * 365   # 1 year


def _set_anon_cookie(response, anon_id: str) -> None:
    response.set_cookie(
        key=ANON_COOKIE,
        value=anon_id,
        max_age=ANON_COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
        path="/",
    )


# ── Request / Response schemas ────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message:    str
    session_id: str | None = None   # None = new session


class SessionResponse(BaseModel):
    session_id: str


# ── Session helpers ───────────────────────────────────────────────────────────

async def get_or_create_session(
    session_id: str | None,
    conn: asyncpg.Connection,
    user_id: str | None = None,
) -> str:
    """
    Return an existing session_id or create a new one.

    Ownership rule: a logged-in user may only reuse a session that is theirs
    or still anonymous (NULL owner). If they reuse an anonymous session, we
    claim it for them. Otherwise we create a fresh session.
    """
    if session_id:
        row = await conn.fetchrow(
            "SELECT session_id, user_id FROM chat_sessions WHERE session_id = $1",
            session_id
        )
        if row:
            owner = row["user_id"]
            if owner is None or owner == user_id:
                await conn.execute(
                    "UPDATE chat_sessions SET updated_at = NOW(), "
                    "user_id = COALESCE(user_id, $2) WHERE session_id = $1",
                    session_id, user_id,
                )
                return session_id
            # Session belongs to someone else → fall through to create a new one.

    new_id = str(uuid.uuid4())
    await conn.execute(
        "INSERT INTO chat_sessions (session_id, user_id) VALUES ($1, $2)",
        new_id, user_id,
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
async def create_session(
    conn:    asyncpg.Connection = Depends(get_db),
    user_id: str | None         = Depends(get_optional_user_id),
):
    """Create a new chat session before starting a conversation."""
    session_id = await get_or_create_session(None, conn, user_id)
    return {"session_id": session_id}


@router.post("/chat")
async def chat(
    request:      ChatRequest,
    http_request: Request,
    conn:    asyncpg.Connection = Depends(get_db),
    user_id: str | None         = Depends(get_optional_user_id),
):
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    if len(request.message) > 4000:
        raise HTTPException(status_code=400, detail="Message too long")

    # ── Anonymous quota: 3 free questions, then require sign-in ──
    anon_id: str | None = None
    if user_id is None:
        anon_id = http_request.cookies.get(ANON_COOKIE) or str(uuid.uuid4())
        used = await conn.fetchval(
            "SELECT question_count FROM anonymous_usage WHERE anon_id = $1", anon_id
        ) or 0
        if used >= ANON_QUESTION_LIMIT:
            resp = JSONResponse(
                status_code=403,
                content={
                    "error": "anonymous_limit_reached",
                    "limit": ANON_QUESTION_LIMIT,
                },
            )
            _set_anon_cookie(resp, anon_id)
            return resp
        # Count this question
        await conn.execute("""
            INSERT INTO anonymous_usage (anon_id, question_count)
            VALUES ($1, 1)
            ON CONFLICT (anon_id) DO UPDATE
            SET question_count = anonymous_usage.question_count + 1,
                updated_at     = NOW()
        """, anon_id)

    session_id = await get_or_create_session(request.session_id, conn, user_id)
    history    = await get_conversation_history(session_id, conn)

    response = StreamingResponse(
        stream_agent_response(request.message, session_id, history),
        media_type="text/event-stream",
        headers={
            "Cache-Control":               "no-cache",
            "X-Accel-Buffering":           "no",
            "Access-Control-Allow-Origin": "*",
        }
    )
    if anon_id:
        _set_anon_cookie(response, anon_id)
    return response


@router.get("/chat/sessions")
async def list_sessions(
    conn:    asyncpg.Connection = Depends(get_db),
    user_id: str | None         = Depends(get_optional_user_id),
):
    """
    List the signed-in user's chat sessions for the sidebar.
    Anonymous callers get an empty list (their sessions aren't tracked per-user).
    """
    if not user_id:
        return {"sessions": []}

    rows = await conn.fetch("""
        SELECT s.session_id,
               s.updated_at,
               (SELECT content FROM chat_messages m
                 WHERE m.session_id = s.session_id AND m.role = 'user'
                 ORDER BY m.created_at ASC LIMIT 1) AS first_message
        FROM chat_sessions s
        WHERE s.user_id = $1
        ORDER BY s.updated_at DESC
        LIMIT 50
    """, user_id)

    return {
        "sessions": [
            {
                "id":         r["session_id"],
                "title":      (r["first_message"] or "ការសន្ទនាថ្មី")[:40],
                "updated_at": r["updated_at"].isoformat(),
            }
            for r in rows
        ]
    }


@router.get("/chat/{session_id}/history")
async def get_history(
    session_id: str,
    conn:    asyncpg.Connection = Depends(get_db),
    user_id: str | None         = Depends(get_optional_user_id),
):
    """Get full conversation history for a session (owner-protected)."""
    owner = await conn.fetchval(
        "SELECT user_id FROM chat_sessions WHERE session_id = $1", session_id
    )
    # If the session is owned by a user, only that user may read it.
    if owner is not None and owner != user_id:
        raise HTTPException(status_code=403, detail="Not your session")

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