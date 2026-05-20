"""
Run once to build all three indexes from law_chunks_v2.jsonl.

From the backend/ folder:
    python -m data_pipeline.build_index
"""
import asyncio, asyncpg
import json, time, pickle, re, sqlite3
import numpy as np
import faiss
from pathlib import Path
from google.genai import types
from rank_bm25 import BM25Okapi

from app.core.gemini_client import client
from app.core.config import get_settings


settings = get_settings()


# ── Helpers ───────────────────────────────────────────────────────────────────

def embed_documents(texts: list[str]) -> list[list[float]]:
    """Embed a batch of chunks for storage — RETRIEVAL_DOCUMENT task."""
    result = client.models.embed_content(
        model=settings.embedding_model,
        contents=texts,
        config=types.EmbedContentConfig(
            task_type="RETRIEVAL_DOCUMENT",
            output_dimensionality=settings.embed_dimensions,
        ),
    )
    return [e.values for e in result.embeddings]


def tokenize_khmer(text: str) -> list[str]:
    tokens = re.findall(r"[\u1780-\u17FF]+", text)
    return tokens if tokens else text.split()


# ── Index builders ────────────────────────────────────────────────────────────

def embed_with_retry(texts: list[str], max_retries: int = 5) -> list[list[float]]:
    """
    Embed with exponential backoff on 429 rate limit errors.
    Free tier limit: 5 RPM for gemini-embedding-001.
    """
    for attempt in range(max_retries):
        try:
            result = client.models.embed_content(
                model=settings.embedding_model,
                contents=texts,
                config=types.EmbedContentConfig(
                    task_type="RETRIEVAL_DOCUMENT",
                    output_dimensionality=settings.embed_dimensions,
                ),
            )
            return [e.values for e in result.embeddings]

        except genai_errors.ClientError as e:
            if e.status_code == 429:
                # Exponential backoff: 15s, 30s, 60s, 120s ...
                wait = (2 ** attempt) * 15 + random.uniform(0, 5)
                print(f"  ⚠  Rate limited. Waiting {wait:.0f}s before retry {attempt+1}/{max_retries}...")
                time.sleep(wait)
            else:
                raise  # re-raise non-rate-limit errors immediately

    raise RuntimeError(f"Failed after {max_retries} retries")


def build_faiss(chunks: list[dict], out: Path):
    print(f"\n[FAISS] Embedding {len(chunks)} chunks...")
    print(f"  Using batch_size=5, delay=13s between batches (free tier: 5 RPM)")

    embeddings = []
    batch_size = 5     # ← reduced from 50 to 5
    delay = 13         # ← 13 seconds between batches = ~4.6 req/min (safe under 5 RPM)

    for i in range(0, len(chunks), batch_size):
        batch = chunks[i : i + batch_size]
        vecs  = embed_with_retry([c["embed_text"] for c in batch])
        embeddings.extend(vecs)

        done = min(i + batch_size, len(chunks))
        pct  = done / len(chunks) * 100
        # Estimate remaining time
        remaining_batches = (len(chunks) - done) / batch_size
        eta_min = (remaining_batches * delay) / 60
        print(f"  {done}/{len(chunks)} ({pct:.0f}%)  — ETA: ~{eta_min:.1f} min remaining")

        if done < len(chunks):   # no need to wait after the last batch
            time.sleep(delay)

    matrix = np.array(embeddings, dtype="float32")
    faiss.normalize_L2(matrix)

    index = faiss.IndexFlatIP(matrix.shape[1])
    index.add(matrix)

    faiss.write_index(index, str(out / "faiss.index"))
    with open(out / "chunks.pkl", "wb") as f:
        pickle.dump(chunks, f)

    print(f"[FAISS] Done — {len(chunks)} vectors, dim={matrix.shape[1]}")


async def build_neon(chunks: list[dict]):
    """Insert all article metadata into Neon PostgreSQL."""
    print("\n[Neon] Inserting metadata into PostgreSQL...")

    pool = await asyncpg.create_pool(dsn=settings.database_url)

    async with pool.acquire() as conn:
        # Create table if not exists
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS articles (
                chunk_id        TEXT PRIMARY KEY,
                law_name        TEXT,
                law_name_en     TEXT,
                article_number  TEXT,
                article_title   TEXT,
                chapter         TEXT,
                section         TEXT,
                sub_section     TEXT,
                page_number     INTEGER,
                pdf_filename    TEXT,
                text_content    TEXT
            )
        """)

        # Batch upsert all chunks
        await conn.executemany("""
            INSERT INTO articles
                (chunk_id, law_name, law_name_en, article_number,
                 article_title, chapter, section, sub_section,
                 page_number, pdf_filename, text_content)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
            ON CONFLICT (chunk_id) DO UPDATE SET
                text_content = EXCLUDED.text_content,
                page_number  = EXCLUDED.page_number
        """, [
            (
                c["chunk_id"], c["law_name"], c["law_name_en"],
                c["article_number"], c["article_title"],
                c["chapter"], c["section"], c["sub_section"],
                c["page_number"], c["pdf_filename"], c["text"],
            )
            for c in chunks
        ])

    await pool.close()
    print(f"[Neon] Done — {len(chunks)} articles inserted")


def build_sqlite(chunks, out):
    """Run the async Neon insert synchronously."""
    asyncio.run(build_neon(chunks))

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    jsonl = Path("law_chunks.jsonl")
    out   = Path(settings.index_dir)
    out.mkdir(parents=True, exist_ok=True)

    if not jsonl.exists():
        raise FileNotFoundError(
            f"Cannot find {jsonl}\n"
            "Make sure law_chunks.jsonl is in the backend/ folder."
        )

    chunks = [json.loads(line) for line in open(jsonl, encoding="utf-8")]
    print(f"Loaded {len(chunks)} chunks from {jsonl}")

    build_faiss(chunks, out)
    build_bm25(chunks, out)
    build_sqlite(chunks, out)

    print("\n✔  All indexes built:")
    print(f"   {out}/faiss.index")
    print(f"   {out}/bm25.pkl")
    print(f"   {out}/metadata.db")


if __name__ == "__main__":
    main()