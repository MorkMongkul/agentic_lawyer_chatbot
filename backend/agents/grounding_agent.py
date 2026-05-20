# backend/agents/grounding_agent.py
import json
from google.genai import types
from app.core.gemini_client import client
from app.core.config import get_settings

settings = get_settings()

SYSTEM_PROMPT = """\
You are a relevance checker for a Cambodian legal RAG system.
Given a user question and retrieved legal article excerpts,
determine if the articles contain enough information to answer the question.

Return ONLY valid JSON:
{"is_relevant": true} or {"is_relevant": false}
"""

def grounding_node(state: dict) -> dict:
    """Check if retrieved chunks are relevant enough to answer the query."""
    chunks = state.get("retrieved_chunks", [])

    # No chunks retrieved at all
    if not chunks:
        return {**state, "is_grounded": False}

    # Build context preview (first 200 chars of each chunk)
    context = "\n\n".join([
        f"[{i+1}] {c['law_name_en']} Art.{c['article_number']}: {c['text'][:200]}"
        for i, c in enumerate(chunks)
    ])

    prompt = f"Question: {state['user_query']}\n\nRetrieved articles:\n{context}"

    response = client.models.generate_content(
        model=settings.grounding_model,   # fast model
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            response_mime_type="application/json",
            temperature=0.0,
            max_output_tokens=20,
        ),
    )

    try:
        result      = json.loads(response.text.strip())
        is_grounded = result.get("is_relevant", False)
    except Exception:
        is_grounded = bool(chunks)  # fallback: trust if chunks exist

    return {**state, "is_grounded": is_grounded}