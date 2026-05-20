# backend/agents/query_rewriter.py
from google.genai import types
from app.core.gemini_client import client
from app.core.config import get_settings

settings = get_settings()

SYSTEM_PROMPT = """\
You are a Cambodian legal research assistant.
Rewrite the user's question into an optimised search query for retrieving
relevant articles from Cambodian labour law documents.

Rules:
- Expand abbreviations and informal terms into formal legal Khmer terms
- Add related legal concepts that would appear in relevant articles
- Include the law name if inferable (ច្បាប់ស្តីពីការងារ, ច្បាប់ស្តីពីសហជីព, etc.)
- Keep it concise — one paragraph maximum
- Return ONLY the rewritten query, no explanation
"""

def rewrite_query_node(state: dict) -> dict:
    """Rewrite the user query to improve retrieval quality."""
    response = client.models.generate_content(
        model=settings.grounding_model,   # fast model is fine for rewriting
        contents=state["user_query"],
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            temperature=0.1,
            max_output_tokens=200,
        ),
    )

    return {
        **state,
        "rewritten_query": response.text.strip(),
        "retry_count":     state.get("retry_count", 0) + 1,
    }