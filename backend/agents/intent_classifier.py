# backend/agents/intent_classifier.py
import json, time
from google.genai import types, errors as genai_errors
from app.core.gemini_client import client
from app.core.config import get_settings

settings = get_settings()

SYSTEM_PROMPT = """\
You are an intent classifier for a Cambodian legal chatbot.
Classify the user query into exactly one intent.

Intents:
- legal_qa        : general legal question requiring article retrieval
- article_lookup  : user asks for a specific article number (e.g. "មាត្រា ៧៤")
- definition      : user asks what a legal term means
- recent_news     : user asks about recent events, amendments, current rates
- greeting        : hello, thank you, chitchat, off-topic

Rules:
- If the query mentions a specific article number (មាត្រា + number), use article_lookup
- Extract the article number as an Arabic numeral if present
- Return ONLY valid JSON, no explanation

Output format:
{"intent": "<intent>", "article_number": "<number or null>"}
"""

def classify_intent_node(state: dict) -> dict:
    """Classify user intent with retry on rate limit."""
    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model=settings.grounding_model,
                contents=state["user_query"],
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    response_mime_type="application/json",
                    temperature=0.0,
                    max_output_tokens=50,
                ),
            )
            result         = json.loads(response.text.strip())
            intent         = result.get("intent", "legal_qa")
            article_number = result.get("article_number")
            break

        except genai_errors.ClientError as e:
            if e.status_code == 429 and attempt < 2:
                wait = (attempt + 1) * 10
                print(f"[INTENT] Rate limited, waiting {wait}s...")
                time.sleep(wait)
                intent         = "legal_qa"
                article_number = None
            else:
                print(f"[INTENT] Error: {e}, defaulting to legal_qa")
                intent         = "legal_qa"
                article_number = None
                break
        except Exception as e:
            print(f"[INTENT] Parse error: {e}, defaulting to legal_qa")
            intent         = "legal_qa"
            article_number = None
            break

    return {
        **state,
        "intent":         intent,
        "article_number": str(article_number) if article_number else None,
        "retry_count":    0,
    }