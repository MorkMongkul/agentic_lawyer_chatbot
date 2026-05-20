# CLAUDE.md — Agentic RAG Legal Chatbot (Cambodia)

## Project Overview

An agentic RAG (Retrieval-Augmented Generation) chatbot specializing in Cambodian labour law.
Users ask legal questions in Khmer and receive formal, cited answers with clickable references
that open the source PDF at the exact article page.

**Status:** Backend complete and working. Frontend in progress.

---

## Tech Stack

### Backend
- **Framework:** FastAPI + Uvicorn (async)
- **Language:** Python 3.11
- **AI SDK:** `google-genai` v2.4.0 (NOT the legacy `google-generativeai`)
- **Agent:** LangGraph (StateGraph)
- **Vector DB:** FAISS (local index files)
- **Keyword search:** rank-bm25
- **Database:** Neon PostgreSQL (serverless) via `asyncpg`
- **ORM:** Raw asyncpg (no SQLAlchemy)

### Frontend
- **Framework:** React 18 + Vite
- **Styling:** Inline styles (no Tailwind classes used in practice)
- **PDF rendering:** pdfjs-dist
- **Markdown:** react-markdown
- **Font:** Noto Sans Khmer (Google Fonts)
- **HTTP:** Fetch API with SSE streaming

---

## Project Structure

```
agentics_rag_lawyer_chatbot/
├── backend/
│   ├── .env                          # GEMINI_API_KEY, DATABASE_URL
│   ├── law_chunks.jsonl              # 622 parsed law articles
│   ├── data/
│   │   ├── raw/
│   │   │   └── cambodian_labor_laws.pdf   # Combined PDF (204 pages, all 4 laws)
│   │   └── index/
│   │       ├── faiss.index           # 622 vectors, dim=768
│   │       ├── chunks.pkl            # Chunk metadata
│   │       └── bm25.pkl              # BM25 keyword index
│   ├── app/
│   │   ├── main.py                   # FastAPI app, CORS, lifespan
│   │   ├── core/
│   │   │   ├── config.py             # Settings (pydantic-settings, reads .env)
│   │   │   ├── database.py           # asyncpg pool, init_db, get_db dependency
│   │   │   └── gemini_client.py      # Shared genai.Client() instance
│   │   └── api/routes/
│   │       ├── chat.py               # POST /api/chat (SSE), POST /api/chat/session
│   │       ├── documents.py          # GET /api/documents/{filename}
│   │       └── health.py             # GET /api/health
│   ├── agents/
│   │   ├── orchestrator.py           # LangGraph StateGraph — main agent loop
│   │   ├── intent_classifier.py      # Classifies query intent (legal_qa, article_lookup, etc.)
│   │   ├── query_rewriter.py         # Expands Khmer legal terms for better retrieval
│   │   ├── retrieval_agent.py        # Hybrid FAISS + BM25 search with RRF fusion
│   │   ├── grounding_agent.py        # Checks if retrieved chunks are relevant
│   │   └── response_agent.py         # Generates formal Khmer answer + extracts citations
│   └── data_pipeline/
│       ├── parse_law_v2.py           # Parses raw txt → LegalChunk objects
│       └── build_index.py            # Embeds chunks → FAISS + BM25 + Neon DB
│
└── frontend/
    └── src/
        ├── App.jsx                   # Root: sidebar state, session management
        ├── services/api.js           # API calls + SSE streaming client
        ├── hooks/
        │   ├── useChat.js            # Message state, SSE stream handler
        │   └── usePDFViewer.js       # PDF panel open/close state
        └── components/
            ├── Sidebar/Sidebar.jsx   # Sessions list, law filters, collapse toggle
            ├── Chat/
            │   ├── ChatWindow.jsx    # Header, messages list, input bar
            │   ├── MessageBubble.jsx # User/AI bubbles with react-markdown
            │   ├── CitationChip.jsx  # Clickable [N] Article chip → opens PDF
            │   ├── TypingIndicator.jsx
            │   └── WelcomeScreen.jsx # Empty state with law cards + suggestions
            └── PDFViewer/
                └── PDFViewer.jsx     # PDF.js canvas, page nav, slides in from right
```

---

## Key Conventions

### API Client (google-genai v2.4.0)
```python
# ALWAYS use this pattern — never use google.generativeai (legacy)
from google import genai
from google.genai import types

client = genai.Client()  # reads GEMINI_API_KEY from env automatically

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
| Generation | `gemini-2.5-flash` | Main response model |
| Grounding/intent | `gemini-2.5-flash` | flash-lite hit free tier limit (20/day) |

### Database (asyncpg — no ORM)
```python
# Always use the dependency injection pattern
from app.core.database import get_db
from fastapi import Depends
import asyncpg

@router.post("/endpoint")
async def handler(conn: asyncpg.Connection = Depends(get_db)):
    rows = await conn.fetch("SELECT * FROM articles WHERE law_name_en = $1", "Labor Law")
```

### SSE Streaming format
Events sent from backend, consumed by frontend:
```json
{"type": "status",    "message": "កំពុងស្វែងរក..."}
{"type": "token",     "content": "chunk of khmer text"}
{"type": "citations", "data": [{...citation objects...}]}
{"type": "done",      "session_id": "uuid"}
{"type": "error",     "message": "error description"}
```

### Agent State (LangGraph)
```python
class AgentState(TypedDict):
    user_query:             str
    session_id:             str
    conversation_history:   list[dict]
    intent:                 str        # legal_qa | article_lookup | recent_news | greeting
    article_number:         str | None
    rewritten_query:        str
    retrieved_chunks:       list[dict]
    is_grounded:            bool
    retry_count:            int        # max 2 retries
    final_answer:           str        # plain Khmer text (NOT JSON)
    citations:              list[dict]
    used_web_search:        bool
```

### Citation object format
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

---

## Database Schema (Neon PostgreSQL)

```sql
-- Law articles (populated once by build_index.py)
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

-- Chat sessions
CREATE TABLE chat_sessions (
    session_id  TEXT PRIMARY KEY,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages
CREATE TABLE chat_messages (
    id          BIGSERIAL PRIMARY KEY,
    session_id  TEXT REFERENCES chat_sessions(session_id) ON DELETE CASCADE,
    role        TEXT NOT NULL CHECK (role IN ('user','assistant')),
    content     TEXT NOT NULL,
    citations   JSONB DEFAULT '[]',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

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
# Activate venv first
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

# Test health endpoint
curl http://localhost:8000/api/health

# Test chat endpoint
curl -X POST http://localhost:8000/api/chat/session
```

### Frontend
```bash
cd frontend
npm run dev     # http://localhost:5173
npm run build   # production build
npm run lint    # check for errors
```

## File Relationships (edit one → check the other)

| If you edit... | Also check... |
|---|---|
| `agents/orchestrator.py` | `app/api/routes/chat.py` — AgentState keys must match |
| `agents/response_agent.py` | `app/api/routes/chat.py` — final_answer must be plain text |
| `app/core/config.py` | Every file that imports `get_settings()` |
| `app/core/database.py` | `app/main.py` — init_db is called in lifespan |
| `hooks/useChat.js` | `components/Chat/ChatWindow.jsx` — prop names must match |
| `services/api.js` | `hooks/useChat.js` — SSE event types must match |
| `CitationChip.jsx` | `PDFViewer.jsx` — citation object shape must match |


## Known Gotchas

1. **google-genai client is a singleton** — never create `genai.Client()` 
   inside a function, always import from `app/core/gemini_client.py`

2. **LangGraph nodes must return the full state** — always do `{**state, "key": value}`
   never return partial state

3. **asyncpg uses $1 not %s** — PostgreSQL placeholders, not Python string format

4. **SSE stream must not use `response.body` directly in older browsers** — 
   always use the fetch + ReadableStream pattern in `services/api.js`

5. **FAISS index is 0-indexed** — chunk at index N corresponds to `chunks[N]`

6. **Khmer text needs UTF-8 everywhere** — file open, JSON dumps, DB inserts

7. **pdfjs-dist worker path** — must match the installed version exactly,
   check `pdfjs-dist` version in package.json if PDF doesn't load

8. **Rate limits** — gemini-2.5-flash-lite has 20 req/day free tier,
   always use gemini-2.5-flash for both generation AND grounding/intent


## Current Issues / TODO

### Frontend (in progress)
- [ ] Sidebar not visible — width animation bug, needs debug
- [ ] PDF viewer not loading — needs backend to be running with PDF in data/raw/
- [ ] Welcome screen not showing on first load
- [ ] Session history should persist via GET /api/chat/{session_id}/history
- [ ] Citation chips should appear only after streaming is complete
- [ ] Mobile responsive layout

### Backend (working)
- [ ] Rate limit handling — added retry logic but flash-lite daily limit (20/day) hit
- [ ] Conversation history currently not saved correctly after SSE stream ends
- [ ] Grounding agent sometimes passes when chunks are not relevant

### Future features
- [ ] More laws (civil law, criminal law, etc.)
- [ ] Multi-language support (English + Khmer)
- [ ] User authentication
- [ ] Feedback system (thumbs up/down per response)
- [ ] Admin dashboard to add new law documents
- [ ] Export conversation as PDF

---

## Important Notes for AI Agents

1. **Never use `google.generativeai`** — only use `google-genai` with `from google import genai`
2. **Never modify `faiss.index`, `chunks.pkl`, `bm25.pkl`** — these are pre-built, read-only
3. **Never modify `law_chunks.jsonl`** — source data, don't touch
4. **All PDF citations must use `cambodian_labor_laws.pdf`** — do not change this
5. **Page numbers in DB are printed page numbers** (match what's printed in the PDF)
6. **Khmer text is always UTF-8** — ensure `encoding="utf-8"` in all file operations
7. **The agent pipeline order is fixed:** classify → rewrite → retrieve → ground → generate
8. **`final_answer` must always be plain Khmer text** — never raw JSON in final_answer
9. **SSE events must always end with `{"type": "done"}`** — frontend depends on this
10. **asyncpg uses `$1, $2` placeholders** — not `%s` or `?`
