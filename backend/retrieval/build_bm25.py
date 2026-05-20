# backend/retrieval/build_bm25.py
import json, pickle, re
from rank_bm25 import BM25Okapi
from pathlib import Path

def tokenize_khmer(text: str) -> list[str]:
    """Split Khmer text on spaces; keep only Khmer Unicode block tokens."""
    tokens = re.findall(r'[\u1780-\u17FF]+', text)
    return tokens if tokens else text.split()

def build_bm25_index(jsonl_path: str, output_dir: str = "data/index"):
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    chunks = [json.loads(l) for l in open(jsonl_path, encoding="utf-8")]

    corpus = [tokenize_khmer(c["embed_text"]) for c in chunks]
    bm25   = BM25Okapi(corpus)

    with open(f"{output_dir}/bm25.pkl", "wb") as f:
        pickle.dump({"bm25": bm25, "chunks": chunks, "corpus": corpus}, f)

    print(f"BM25 index built — {len(chunks)} documents")

if __name__ == "__main__":
    build_bm25_index("law_chunks_v2.jsonl")