# backend/agents/retrieval_agent.py
import pickle, re
import numpy as np
import faiss
from google.genai import types
from app.core.gemini_client import client
from app.core.config import get_settings

settings = get_settings()

# ── Load indexes once at import time ─────────────────────────────────────────
_faiss_index = None
_chunks      = None
_bm25        = None

def _load_indexes():
    global _faiss_index, _chunks, _bm25
    if _faiss_index is None:
        _faiss_index = faiss.read_index(f"{settings.index_dir}/faiss.index")
        with open(f"{settings.index_dir}/chunks.pkl", "rb") as f:
            _chunks = pickle.load(f)
        with open(f"{settings.index_dir}/bm25.pkl", "rb") as f:
            data   = pickle.load(f)
            _bm25  = data["bm25"]

def _embed_query(query: str) -> np.ndarray:
    result = client.models.embed_content(
        model=settings.embedding_model,
        contents=[query],
        config=types.EmbedContentConfig(
            task_type="RETRIEVAL_QUERY",
            output_dimensionality=settings.embed_dimensions,
        ),
    )
    vec = np.array([result.embeddings[0].values], dtype="float32")
    faiss.normalize_L2(vec)
    return vec

def _tokenize(text: str) -> list[str]:
    tokens = re.findall(r"[\u1780-\u17FF]+", text)
    return tokens if tokens else text.split()

def _rrf(vec_hits, bm25_hits, k=60, top_n=5) -> list[dict]:
    """Reciprocal Rank Fusion."""
    scores: dict[str, float] = {}
    cmap:   dict[str, dict]  = {}

    for rank, (_, chunk) in enumerate(vec_hits):
        cid = chunk["chunk_id"]
        scores[cid] = scores.get(cid, 0) + 1 / (k + rank + 1)
        cmap[cid]   = chunk

    for rank, chunk in enumerate(bm25_hits):
        cid = chunk["chunk_id"]
        scores[cid] = scores.get(cid, 0) + 1 / (k + rank + 1)
        cmap[cid]   = chunk

    ranked = sorted(scores, key=lambda x: scores[x], reverse=True)
    return [cmap[cid] for cid in ranked[:top_n]]


# ── Node functions ────────────────────────────────────────────────────────────

def retrieve_node(state: dict) -> dict:
    _load_indexes()
    query = state.get("rewritten_query") or state["user_query"]

    # Dense search
    vec = _embed_query(query)
    scores, idxs = _faiss_index.search(vec, settings.vector_candidates)
    vec_hits = [(scores[0][i], _chunks[idxs[0][i]]) for i in range(len(idxs[0]))]

    # BM25 search
    tokens    = _tokenize(query)
    bm25_sc   = _bm25.get_scores(tokens)
    top_bm25  = sorted(range(len(bm25_sc)), key=lambda i: bm25_sc[i], reverse=True)
    bm25_hits = [_chunks[i] for i in top_bm25[:settings.bm25_candidates]]

    top_chunks = _rrf(vec_hits, bm25_hits, top_n=settings.retrieval_top_k)

    # Debug — print what was retrieved
    print(f"\n[RETRIEVAL] Query: {query[:60]}")
    print(f"[RETRIEVAL] Found {len(top_chunks)} chunks:")
    for c in top_chunks:
        print(f"  → {c['law_name_en']} Art.{c['article_number']} p.{c['page_number']}")

    return {**state, "retrieved_chunks": top_chunks}


def direct_lookup_node(state: dict) -> dict:
    """
    Direct article number lookup — skips semantic search entirely.
    Used when user asks 'show me article 74'.
    """
    _load_indexes()

    art_num = state.get("article_number", "")

    # Find in chunks by exact article number match
    matches = [
        c for c in _chunks
        if c["article_number"] == art_num
    ]

    # If multiple laws have same article number, return all
    return {
        **state,
        "retrieved_chunks":  matches if matches else [],
        "rewritten_query":   state["user_query"],
        "is_grounded":       bool(matches),
    }