# backend/agents/response_agent.py
import json, re
from google.genai import types
from app.core.gemini_client import client
from app.core.config import get_settings

settings = get_settings()

ANSWER_PROMPT = """\
អ្នកជាមេធាវីជំនាញច្បាប់កម្ពុជា។ ផ្តល់ចម្លើយជាផ្លូវការ គ្រប់ជ្រុងជ្រោយ ជាភាសាខ្មែរ។

ក្បួនខ្នាត:
- ដកស្រង់មាត្រាច្បាប់ដែលពាក់ព័ន្ធដោយប្រើទម្រង់ [N] ដែល N គឺជាលេខយោងខាងក្រោម
- ប្រើភាសាច្បាប់ជំនាញ ប៉ុន្តែអាចយល់បាន
- បញ្ចប់ដោយផ្ដល់ដំបូន្មានជាក់លាក់
- មិនបង្កើតព័ត៌មានដែលគ្មាននៅក្នុងឯកសារ

ឆ្លើយតបជាអត្ថបទធម្មតា មិនមែន JSON។
"""

CITATION_PROMPT = """\
Extract citations from this legal answer as JSON array only.
Return ONLY a valid JSON array, nothing else.

Format:
[
  {
    "ref_num": 1,
    "article_number": "95",
    "law_name": "ច្បាប់ស្តីពីការងារ",
    "law_name_en": "Labor Law",
    "page_number": 30,
    "pdf_filename": "cambodian_labor_laws.pdf",
    "article_title": ""
  }
]

If no citations found, return: []
"""

def _build_context(chunks: list[dict]) -> str:
    if not chunks:
        return "គ្មានឯកសារច្បាប់ដែលពាក់ព័ន្ធ។"
    parts = []
    for i, c in enumerate(chunks):
        title = f" — {c['article_title']}" if c.get("article_title") else ""
        parts.append(
            f"[{i+1}] {c['law_name']} — មាត្រា {c['article_number']}{title} "
            f"(ទំព័រ {c['page_number']})\n{c['text']}"
        )
    return "\n\n".join(parts)

def _build_history(history: list[dict]) -> str:
    if not history:
        return ""
    lines = [f"{m['role'].upper()}: {m['content']}" for m in history[-4:]]
    return "ប្រវត្តិការសន្ទនា:\n" + "\n".join(lines) + "\n\n"

def _extract_citations(answer: str, chunks: list[dict]) -> list[dict]:
    """Extract citations using fast model — separate call, no token pressure."""
    if not chunks:
        return []

    # Build reference list for the model
    refs = "\n".join([
        f"[{i+1}] {c['law_name']} Art.{c['article_number']} p.{c['page_number']}"
        for i, c in enumerate(chunks)
    ])

    prompt = f"Answer:\n{answer}\n\nAvailable references:\n{refs}"

    try:
        response = client.models.generate_content(
            model=settings.grounding_model,   # fast model for citation extraction
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=CITATION_PROMPT,
                response_mime_type="application/json",
                temperature=0.0,
                max_output_tokens=500,
            ),
        )
        text = response.text.strip()
        # Strip fences if present
        text = re.sub(r'^```json\s*', '', text, flags=re.MULTILINE)
        text = re.sub(r'^```\s*',     '', text, flags=re.MULTILINE)
        citations = json.loads(text.strip())

        # Enrich citations with full data from retrieved chunks
        chunk_map = {str(i+1): c for i, c in enumerate(chunks)}
        for cit in citations:
            ref = chunk_map.get(str(cit.get("ref_num", "")), {})
            if ref:
                cit["article_number"] = ref["article_number"]
                cit["law_name"]       = ref["law_name"]
                cit["law_name_en"]    = ref["law_name_en"]
                cit["page_number"]    = ref["page_number"]
                cit["article_title"]  = ref.get("article_title", "")
            cit["pdf_filename"] = "cambodian_labor_laws.pdf"

        print(f"[CITATIONS] Extracted {len(citations)} citations")
        return citations

    except Exception as e:
        print(f"[CITATIONS] Failed: {e}")
        # Fallback: return all retrieved chunks as citations
        return [
            {
                "ref_num":        i + 1,
                "article_number": c["article_number"],
                "law_name":       c["law_name"],
                "law_name_en":    c["law_name_en"],
                "page_number":    c["page_number"],
                "pdf_filename":   "cambodian_labor_laws.pdf",
                "article_title":  c.get("article_title", ""),
            }
            for i, c in enumerate(chunks)
        ]

def generate_node(state: dict) -> dict:
    chunks  = state.get("retrieved_chunks", [])
    context = _build_context(chunks)
    history = _build_history(state.get("conversation_history", []))
    intent  = state.get("intent", "legal_qa")

    print(f"[GENERATE] intent={intent}, chunks={len(chunks)}")

    if intent == "greeting":
        return {
            **state,
            "final_answer": "សូមស្វាគមន៍! ខ្ញុំជាជំនួយការច្បាប់កម្ពុជា។ តើខ្ញុំអាចជួយអ្វីបានទាក់ទងនឹងច្បាប់ការងារ ច្បាប់សហជីព ច្បាប់សន្តិសុខសង្គម ឬច្បាប់ប្រាក់ឈ្នួលអប្បបរមា?",
            "citations": [],
        }

    if intent == "recent_news":
        return {
            **state,
            "final_answer": "សំណួររបស់អ្នកទាក់ទងនឹងព័ត៌មានថ្មីៗ ដែលខ្ញុំប្រហែលជាមិនមានទិន្នន័យចុងក្រោយបំផុត។ សូមពិនិត្យមើលគេហទំព័រផ្លូវការរបស់ក្រសួងការងារ។",
            "citations": [],
        }

    prompt = (
        f"{history}"
        f"ឯកសារច្បាប់ដែលពាក់ព័ន្ធ:\n{context}\n\n"
        f"សំណួររបស់អ្នកប្រើ: {state['user_query']}"
    )

    # Step 1 — Generate plain Khmer answer (no JSON pressure)
    response = client.models.generate_content(
        model=settings.generation_model,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=ANSWER_PROMPT,
            temperature=0.1,
            max_output_tokens=8192,   # ← much higher, no JSON overhead
        ),
    )

    answer = response.text.strip()
    print(f"[GENERATE] Answer: {len(answer)} chars")

    # Step 2 — Extract citations separately (fast, no token pressure)
    citations = _extract_citations(answer, chunks)

    return {
        **state,
        "final_answer": answer,
        "citations":    citations,
    }