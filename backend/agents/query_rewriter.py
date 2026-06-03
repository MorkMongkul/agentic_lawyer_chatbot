# backend/agents/query_rewriter.py
from google.genai import types
from app.core.gemini_client import client
from app.core.config import get_settings

settings = get_settings()

SYSTEM_PROMPT = """\
You are a Cambodian legal research assistant.
Rewrite the user's question into an optimised search query for retrieving
relevant articles from Cambodian labour law documents.

The indexed documents cover exactly 4 laws:
1. ច្បាប់ស្តីពីការងារ (Labor Law) — employment contracts, wages, working hours, leave, termination, strikes
2. ច្បាប់ស្តីពីសហជីព (Trade Union Law) — union formation, registration, collective bargaining, union rights
3. ច្បាប់ស្តីពីរបបសន្តិសុខសង្គម (Social Security Law) — NSSF ប.ស.ស., work injury ហានិភ័យការងារ, health insurance ថែទាំសុខភាព, pension ប្រាក់សោធន, contributions ភាគទាន
4. ច្បាប់ស្តីពីប្រាក់ឈ្នួលអប្បបរមា (Minimum Wage Law) — minimum wage ប្រាក់ឈ្នួលអប្បបរមា, Minimum Wage Council គណៈកម្មការ, violations ពិន័យ

Rules:
- Expand abbreviations and informal terms into formal legal Khmer terms
- Add related legal concepts that would appear in relevant articles
- Include the law name ONLY if you are confident the question belongs to that specific law
- For questions about NSSF, work injury, health insurance, pension, or social security contributions: include ច្បាប់ស្តីពីរបបសន្តិសុខសង្គម
- For questions about minimum wage amounts, the wage council, or minimum wage violations: include ច្បាប់ស្តីពីប្រាក់ឈ្នួលអប្បបរមា
- For questions about employment contracts, working hours, leave, or termination: include ច្បាប់ស្តីពីការងារ
- For questions about union formation, membership, registration, or collective bargaining: include ច្បាប់ស្តីពីសហជីព
- Do NOT add multiple law names to one query unless the question explicitly spans multiple laws
- Keep it concise — one paragraph maximum
- Return ONLY the rewritten query, no explanation
"""

def rewrite_query_node(state: dict) -> dict:
    """Rewrite the user query to improve retrieval quality."""
    response = client.models.generate_content(
        model=settings.grounding_model,
        contents=state["user_query"],
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            temperature=0.1,
            max_output_tokens=500,
            thinking_config=types.ThinkingConfig(thinking_budget=0),
        ),
    )

    rewritten = (response.text or "").strip() or state["user_query"]

    return {
        **state,
        "rewritten_query": rewritten,
        "retry_count":     state.get("retry_count", 0) + 1,
    }