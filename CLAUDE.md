# CLAUDE.md — Agentic RAG Legal Chatbot (Cambodia)

## Project Overview

An agentic RAG (Retrieval-Augmented Generation) chatbot specializing in Cambodian labour law.
Users ask legal questions in Khmer and receive formal, cited answers with clickable references
that open the source PDF at the exact article page.

**Status:** Backend complete and working. Frontend mostly complete with a few wiring gaps.

**App Name:** Niti (displayed in sidebar)

---

## Tech Stack

### Backend
- **Framework:** FastAPI + Uvicorn (async)
- **Language:** Python 3.11
- **AI SDK:** `google-genai` v2.4.0 (NOT the legacy `google-generativeai`)
- **Agent:** LangGraph v1.2.0 (StateGraph)
- **Vector DB:** FAISS (faiss-cpu v1.13.2, local index files)
- **Keyword search:** rank-bm25 v0.2.2
- **Database:** Neon PostgreSQL (serverless) via `asyncpg` v0.31.0
- **ORM:** Raw asyncpg (no SQLAlchemy, though it is installed as a transitive dep)

### Frontend
- **Framework:** React 19 + Vite 8
- **Styling:** CSS variables via `index.css` + inline styles on every component (Tailwind is installed but NOT used in components)
- **PDF rendering:** pdfjs-dist v5.7.284 (worker loaded from unpkg CDN)
- **Markdown:** react-markdown v10.1.0
- **Fonts:** `Kantumruy Pro` (Khmer), `DM Sans` (Latin UI), `Poppins` — loaded via Google Fonts in `index.html`
- **HTTP:** Fetch API with ReadableStream (SSE); `axios` is installed but unused

---

## Project Structure

```
agentics_rag_lawyer_chatbot/
├── backend/
│   ├── .env                          # GEMINI_API_KEY, DATABASE_URL
│   ├── law_chunks.jsonl              # 622 parsed law articles (read-only)
│   ├── data/
│   │   ├── raw/
│   │   │   └── cambodian_labor_laws.pdf   # Combined PDF (204 pages, all 4 laws)
│   │   └── index/
│   │       ├── faiss.index           # 622 vectors, dim=768 (read-only)
│   │       ├── chunks.pkl            # Chunk metadata list (read-only)
│   │       └── bm25.pkl             # BM25 index + tokenized corpus (read-only)
│   ├── app/
│   │   ├── main.py                   # FastAPI app, CORS, lifespan (DB pool init)
│   │   ├── core/
│   │   │   ├── config.py             # Settings (pydantic-settings, lru_cache, reads .env)
│   │   │   ├── database.py           # asyncpg pool singleton, init_db, get_db dependency
│   │   │   └── gemini_client.py      # Shared genai.Client() singleton
│   │   └── api/routes/
│   │       ├── chat.py               # POST /api/chat (SSE), POST /api/chat/session,
│   │       │                         # GET /api/chat/{session_id}/history
│   │       ├── documents.py          # GET /api/documents/{filename} (whitelist-guarded)
│   │       └── health.py             # GET /api/health
│   ├── agents/
│   │   ├── orchestrator.py           # LangGraph StateGraph — compiled singleton
│   │   ├── intent_classifier.py      # Classifies query intent (legal_qa, article_lookup, etc.)
│   │   ├── query_rewriter.py         # Expands Khmer legal terms for better retrieval
│   │   ├── retrieval_agent.py        # Hybrid FAISS + BM25 search with RRF fusion
│   │   ├── grounding_agent.py        # Checks if retrieved chunks answer the query
│   │   └── response_agent.py         # Two-step: generate Khmer answer → extract citations
│   └── data_pipeline/
│       ├── parse_law_v2.py           # Parses raw txt → LegalChunk objects
│       └── build_index.py            # Embeds chunks → FAISS + BM25 + Neon DB
│
└── frontend/
    ├── index.html                    # Google Fonts: Kantumruy Pro, DM Sans, Poppins
    ├── vite.config.js                # Proxy /api/* → localhost:8000
    ├── package.json                  # React 19, pdfjs-dist 5.7, react-markdown 10
    └── src/
        ├── App.jsx                   # Root: sidebar/theme state, session list (demo)
        ├── services/api.js           # API calls + SSE ReadableStream client
        ├── assets/
        │   └── Logo.jsx              # SVG logo component (#BAEC17 brand color)
        ├── hooks/
        │   ├── useChat.js            # Message state, SSE event dispatch, session create
        │   └── usePDFViewer.js       # PDF panel open/close + citation state
        └── components/
            ├── Sidebar/Sidebar.jsx   # Collapsible sidebar (64px collapsed / 260px open)
            ├── Chat/
            │   ├── ChatWindow.jsx    # Header, message list, auto-scroll, input bar
            │   ├── MessageBubble.jsx # User/AI bubbles; citations hidden during streaming
            │   ├── CitationChip.jsx  # Clickable chip → opens PDF at article page
            │   ├── TypingIndicator.jsx
            │   └── WelcomeScreen.jsx # 4-card grid of law categories + subtitle
            └── PDFViewer/
                └── PDFViewer.jsx     # Slides in from right; canvas render via pdfjs-dist
```

---

## Agent Pipeline (Logic Flow)

### State

```python
class AgentState(TypedDict):
    # Input
    user_query:             str
    session_id:             str
    conversation_history:   list[dict]   # last 6 messages from DB (3 exchanges)

    # Intent
    intent:                 str          # legal_qa | article_lookup | definition | recent_news | greeting
    article_number:         str | None   # populated only for article_lookup

    # Retrieval
    rewritten_query:        str
    retrieved_chunks:       list[dict]
    is_grounded:            bool
    retry_count:            int          # incremented by rewrite_query_node; max 2 retries

    # Output
    final_answer:           str          # plain Khmer text (NEVER JSON)
    citations:              list[dict]
    used_web_search:        bool         # always False currently; reserved for future
```

### Flow Graph

```
classify_intent
    ├── article_lookup  → direct_lookup ─────────────────────────────────┐
    ├── legal_qa / definition → rewrite_query → retrieve → ground_check  │
    │                              ↑                  │                  │
    │                              └── retry_count<2 ─┘                  │
    │                                  retry_count≥2 ────────────────────┤
    └── greeting / recent_news ──────────────────────────────────────────┤
                                                                         ▼
                                                                      generate → END
```

### Node-by-node behaviour

| Node | Model used | Key behaviour |
|---|---|---|
| `classify_intent` | `gemini-2.5-flash` | Returns JSON `{intent, article_number}`; retries up to 3× on 429 with backoff; defaults to `legal_qa` on error |
| `rewrite_query` | `gemini-2.5-flash` | Expands informal Khmer to formal legal terms; increments `retry_count` |
| `retrieve` | `gemini-embedding-001` | Dense FAISS (top 20) + BM25 (top 20) fused via RRF → top 5 chunks |
| `direct_lookup` | none | In-memory scan of `_chunks` list by exact `article_number` match; sets `is_grounded=True` |
| `ground_check` | `gemini-2.5-flash` | Checks if chunks answer the query (200-char preview); fallback = trust chunks exist |
| `generate` | `gemini-2.5-flash` | Step 1: generate plain Khmer answer. Step 2: separate call to extract citation JSON |

### Retry logic

`rewrite_query_node` increments `retry_count` before retrieve/ground. Max 2 retries:
- attempt 0 → retry_count=1 → ground fails → retry
- attempt 1 → retry_count=2 → ground fails → `2 < 2` is False → generate anyway

---

## SSE Streaming (Simulated)

**Important:** Streaming is simulated, not true token streaming. The backend runs the full
agent graph synchronously (in `run_in_executor`), then chunks the completed answer into 8-character
pieces with 10ms sleep between each. The user sees no text until the entire LLM call completes.

```
POST /api/chat → full agent run (~5-15s) → stream 8-char chunks
```

SSE event sequence:
```json
{"type": "status",    "message": "កំពុងស្វែងរក..."}
{"type": "status",    "message": "កំពុងបង្កើតចម្លើយ..."}
{"type": "token",     "content": "chunk of khmer text (8 chars)"}
...repeated for every 8-char slice...
{"type": "citations", "data": [{...citation objects...}]}
{"type": "done",      "session_id": "uuid"}
{"type": "error",     "message": "error description"}
```

Frontend consumes via `ReadableStream` + line-by-line `data: ...` parsing in `services/api.js`.

---

## Citation Object Format

```json
{
  "ref_num": 1,
  "article_number": "93",
  "law_name": "ច្បាប់ស្តីពីការងារ",
  "law_name_en": "Labor Law",
  "page_number": 29,
  "pdf_filename": "cambodian_labor_laws.pdf",
  "article_title": ""
}
```

Citation chips (`CitationChip.jsx`) are rendered only after `message.streaming === false`.
Clicking opens `PDFViewer` at `citation.page_number` using the pdfjs-dist canvas renderer.

---

## Key Code Conventions

### API Client (google-genai v2.4.0)
```python
# ALWAYS use this pattern — never use google.generativeai (legacy)
from google import genai
from google.genai import types

client = genai.Client()  # singleton in app/core/gemini_client.py

# Embedding
result = client.models.embed_content(
    model="gemini-embedding-001",
    contents=["text to embed"],
    config=types.EmbedContentConfig(
        task_type="RETRIEVAL_DOCUMENT",  # or "RETRIEVAL_QUERY"
        output_dimensionality=768,
    ),
)
embeddings = [e.values for e in result.embeddings]

# Generation
response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents="your prompt",
    config=types.GenerateContentConfig(
        system_instruction="...",
        temperature=0.1,
        max_output_tokens=8192,
    ),
)
text = response.text
```

### Models in use
| Purpose | Model | Notes |
|---|---|---|
| Embedding | `gemini-embedding-001` | dim=768, task_type required |
| Generation | `gemini-2.5-flash` | Main response model; 8192 token limit |
| Grounding / intent / rewrite / citation extraction | `gemini-2.5-flash` | flash-lite was retired (20/day limit) |

### Database (asyncpg — no ORM)
```python
from app.core.database import get_db
from fastapi import Depends
import asyncpg

@router.post("/endpoint")
async def handler(conn: asyncpg.Connection = Depends(get_db)):
    rows = await conn.fetch("SELECT * FROM articles WHERE law_name_en = $1", "Labor Law")
```

### LangGraph node pattern
```python
def my_node(state: dict) -> dict:
    # Always spread full state — never return partial
    return {**state, "key": new_value}
```

---

## Database Schema (Neon PostgreSQL)

`chat_sessions` and `chat_messages` are **auto-created** by `init_db` in `database.py` on startup.
The `articles` table is **manually created** by `build_index.py` (one-time setup).

```sql
-- Auto-created by init_db on every startup (CREATE TABLE IF NOT EXISTS)
CREATE TABLE chat_sessions (
    session_id  TEXT PRIMARY KEY,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE chat_messages (
    id          BIGSERIAL PRIMARY KEY,
    session_id  TEXT REFERENCES chat_sessions(session_id) ON DELETE CASCADE,
    role        TEXT NOT NULL CHECK (role IN ('user','assistant')),
    content     TEXT NOT NULL,
    citations   JSONB DEFAULT '[]',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_session ON chat_messages(session_id, created_at);

-- Manually created by build_index.py (populated once, never updated at runtime)
CREATE TABLE articles (
    chunk_id        TEXT PRIMARY KEY,  -- e.g. "labor_law__art_74"
    law_name        TEXT,              -- Khmer name
    law_name_en     TEXT,              -- English name
    article_number  TEXT,
    article_title   TEXT,
    chapter         TEXT,
    section         TEXT,
    sub_section     TEXT,
    page_number     INTEGER,           -- Page in cambodian_labor_laws.pdf
    pdf_filename    TEXT               -- Always "cambodian_labor_laws.pdf"
);
```

**Note:** The `articles` table is NOT queried at runtime by agents. Articles are loaded from
`chunks.pkl` into memory. The DB table is for reference / future use.

---

## Laws Indexed (622 articles total)

| Law (Khmer) | Law (English) | Articles | Page range in PDF |
|---|---|---|---|
| ច្បាប់ស្តីពីការងារ | Labor Law | 393 | pp. 7–99 |
| ច្បាប់ស្តីពីសហជីព | Trade Union Law | 100 | pp. 107–139 |
| ច្បាប់ស្តីពីរបបសន្តិសុខសង្គម | Social Security Law | 100 | pp. 147–175 |
| ច្បាប់ស្តីពីប្រាក់ឈ្នួលអប្បបរមា | Minimum Wage Law | 29 | pp. 191–198 |

**PDF:** `cambodian_labor_laws.pdf` (204 pages, combined all 4 laws)
**Served at:** `GET /api/documents/cambodian_labor_laws.pdf`

---

## Environment Variables

```env
# backend/.env
GEMINI_API_KEY=your_key_here
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

`config.py` uses `pydantic-settings` with `lru_cache`, so settings are read once.
`gemini_client.py` explicitly sets `os.environ["GEMINI_API_KEY"]` so `genai.Client()` can find it.

---

## Running the project

```bash
# Backend (from backend/ folder)
source venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Frontend (from frontend/ folder)
npm run dev
# → http://localhost:5173
# → proxies /api/* to http://localhost:8000
```

---

## Commands

### Backend
```bash
cd backend && source venv/bin/activate

# Run dev server
uvicorn app.main:app --reload --port 8000

# Test a specific agent node manually
python3 -c "
from agents.orchestrator import agent_graph
result = agent_graph.invoke({
    'user_query': 'ការបណ្តេញបុគ្គលិក',
    'session_id': 'test',
    'conversation_history': [],
    'intent': '', 'article_number': None,
    'rewritten_query': '', 'retrieved_chunks': [],
    'is_grounded': False, 'retry_count': 0,
    'final_answer': '', 'citations': [], 'used_web_search': False,
})
print(result['final_answer'][:200])
print(result['citations'])
"

curl http://localhost:8000/api/health
curl -X POST http://localhost:8000/api/chat/session
```

### Frontend
```bash
cd frontend
npm run dev     # http://localhost:5173
npm run build   # production build
npm run lint    # check for errors
```

---

## File Relationships (edit one → check the other)

| If you edit... | Also check... |
|---|---|
| `agents/orchestrator.py` | `app/api/routes/chat.py` — AgentState keys must match the invoke dict |
| `agents/response_agent.py` | `app/api/routes/chat.py` — `final_answer` must remain plain text |
| `agents/query_rewriter.py` | `orchestrator.py` — `retry_count` logic depends on increment happening here |
| `app/core/config.py` | Every file that imports `get_settings()` |
| `app/core/database.py` | `app/main.py` — `init_db` is called in lifespan |
| `hooks/useChat.js` | `components/Chat/ChatWindow.jsx` — prop names must match |
| `services/api.js` | `hooks/useChat.js` — SSE event types must match exactly |
| `CitationChip.jsx` | `PDFViewer.jsx` — both use `citation.law_name_en` key for the law short-name map |
| `CitationChip.jsx` | `usePDFViewer.js` — `openCitation(cit)` receives the raw citation object |

---

## Known Gotchas

1. **google-genai client is a singleton** — never create `genai.Client()` inside a function;
   always import `client` from `app/core/gemini_client.py`

2. **LangGraph nodes must return the full state** — always `{**state, "key": value}`;
   never return a partial dict

3. **asyncpg uses `$1` not `%s`** — PostgreSQL placeholders, not Python string format

4. **SSE chunking uses Python character slicing** — `answer[i:i+8]` slices by Unicode chars,
   not bytes, so Khmer text is safe. The frontend's `TextDecoder({stream: true})` reassembles
   multi-byte chars correctly.

5. **FAISS index is 0-indexed** — chunk at index N corresponds to `_chunks[N]`

6. **Khmer text needs UTF-8 everywhere** — file open, JSON dumps, DB inserts

7. **pdfjs-dist worker is loaded from unpkg CDN** — internet connectivity required;
   worker URL is pinned to the installed version via `pdfjsLib.version`

8. **Rate limits** — all models now use `gemini-2.5-flash` (flash-lite hit 20 req/day free tier).
   Intent classifier has explicit 429 retry with 10s/20s backoff (`time.sleep` — acceptable
   since it runs in `run_in_executor`, not the event loop thread)

9. **`articles` table not auto-created** — `init_db` only creates `chat_sessions` and
   `chat_messages`. The `articles` table must exist before startup (created by `build_index.py`)

10. **Duplicate import in `chat.py`** — `get_db` is imported twice (lines 13 and 14).
    Harmless but should be cleaned up.

11. **`_load_indexes()` global state** — FAISS/BM25 indexes are loaded into module-level globals
    on first request (lazy-load). Not thread-safe for multiprocessing, but fine for a single
    Uvicorn worker.

12. **CORS origins hardcoded** — only `localhost:5173` and `localhost:3000` are allowed.
    Must be updated for any production deployment.

---

## Current Issues / TODO

### Frontend — wiring gaps
- [ ] **Sessions not wired to backend** — `App.jsx` uses hardcoded demo sessions (`demo-1`, `demo-2`).
      `GET /api/chat/{session_id}/history` exists in the backend but is never called.
      `api.getHistory()` exists in `services/api.js` but is unused.
- [ ] **Switching sessions creates a new backend session** — `onSelectSession` calls
      `chat.newSession()` which hits `POST /api/chat/session` instead of loading history.
- [ ] **WelcomeScreen suggestion cards send law names as queries** — clicking a card calls
      `onSuggestion(c.title)` which submits e.g. `"ច្បាប់ស្តីពីការងារ"` as the question.
      Should send sample questions instead.
- [ ] **PDFViewer reloads full PDF on every citation click** — no caching between citations
      from the same session (204-page PDF re-fetched each time).
- [ ] Mobile responsive layout

### Frontend — already working (corrected from old TODO)
- [x] Sidebar renders correctly — collapses to 64px icon strip, expands to 260px with animation
- [x] Welcome screen shows on first load — `isWelcome = messages.length === 0`
- [x] Citation chips appear only after streaming — guarded by `!message.streaming`
- [x] Dark/light theme toggle — CSS variables + `data-theme` attribute

### Backend — known issues
- [ ] **Grounding agent uses 200-char preview** — may miss relevant content in long articles
- [ ] **No input length validation** — `chat.py` only checks for empty message
- [ ] **Simulated streaming** — full answer is generated before any tokens stream to the client
- [ ] **`used_web_search` never set to True** — field reserved for future web search capability

### Future features
- [ ] Real token streaming (switch to `generate_content_stream`)
- [ ] Load session history when switching sessions in sidebar
- [ ] PDF viewer: cache the loaded PDF document across citation changes
- [ ] More laws (civil law, criminal law, etc.)
- [ ] Multi-language support (English answers)
- [ ] User authentication
- [ ] Feedback system (thumbs up/down per response)
- [ ] Admin dashboard to add new law documents
- [ ] Export conversation as PDF
- [ ] Production CORS origins

---

## Architecture Analysis & Suggestions

### What is well-designed

- **Two-step response generation** (`response_agent.py`): Generating the Khmer answer and
  extracting citations in separate LLM calls is smart — it removes JSON format pressure from
  the main answer call, giving the model the full 8192-token budget for Khmer text.

- **RRF fusion** (`retrieval_agent.py`): Combining dense (FAISS cosine) and sparse (BM25)
  retrieval with Reciprocal Rank Fusion is appropriate for Khmer text where vocabulary coverage
  is uneven. The top-20/20 candidates fused to top-5 is a reasonable budget.

- **Singleton patterns**: `genai.Client()`, compiled `agent_graph`, `Settings` via `lru_cache`,
  and FAISS/BM25 lazy-globals are all correct. Never recreate these per request.

- **Document security**: `documents.py` uses an explicit allowlist (`ALLOWED_FILES`), preventing
  path traversal and arbitrary file reads.

- **Grounding retry loop**: The retry-then-generate-anyway pattern prevents infinite loops while
  still trying to improve retrieval quality.

### Suggestions

1. **Real streaming**: Switch `generate_content` to `generate_content_stream` in
   `response_agent.py` and yield tokens through the SSE pipe. The two-step pattern can be
   adapted: stream the answer, then run citation extraction as a second call after the stream ends.

2. **Wire up session history**: In `App.jsx`, when `onSelectSession(id)` is called, call
   `api.getHistory(id)` and load those messages into `useChat` state instead of starting fresh.

3. **Cache the PDF in PDFViewer**: Store the loaded `pdfDoc` in a `useRef` keyed to the URL.
   Only re-fetch when `pdfUrl` changes, not on every `citation` change.

4. **WelcomeScreen suggestions**: Replace law name cards with sample questions
   (e.g., `"ប្រាក់ឈ្នួលអប្បបរមាប៉ុន្មាន?"`) so clicking actually demonstrates the chatbot.

5. **Remove unused deps**: `axios` and the runtime overhead of `@tailwindcss/vite` + Tailwind
   import in `index.css` add build cost for zero benefit. Remove both if not planning to use them.

6. **Grounding context**: Expand the preview in `grounding_agent.py` from 200 to ~500 chars
   to reduce false-negative groundings on articles with long preambles.

7. **Message length validation**: Add a `max_length=4000` check in `chat.py` to prevent
   maliciously large payloads from reaching the LLM.

---

## Important Notes for AI Agents

1. **Never use `google.generativeai`** — only use `google-genai` with `from google import genai`
2. **Never modify `faiss.index`, `chunks.pkl`, `bm25.pkl`, `law_chunks.jsonl`** — pre-built, read-only
3. **All PDF citations must use `cambodian_labor_laws.pdf`** — do not change this filename
4. **Page numbers in DB are printed page numbers** (match what's physically printed in the PDF)
5. **Khmer text is always UTF-8** — ensure `encoding="utf-8"` in all file operations
6. **The agent pipeline order is fixed:** classify → (rewrite → retrieve → ground)* → generate
7. **`final_answer` must always be plain Khmer text** — never raw JSON in `final_answer`
8. **SSE events must always end with `{"type": "done"}`** — frontend depends on this to clear streaming state
9. **asyncpg uses `$1, $2` placeholders** — not `%s` or `?`
10. **React 19** is in use — not React 18. Some subtle behaviour differences in concurrent mode.
11. **Font for Khmer UI is `Kantumruy Pro`** — not Noto Sans Khmer
