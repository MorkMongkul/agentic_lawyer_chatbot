import pickle, re
import numpy as np
import faiss
from google.genai import types

from app.core.gemini_client import client
from app.core.config import get_settings

settings = get_settings()


class HybridRetriever:

    def __init__(self):
        d = settings.index_dir

        # FAISS
        self.index  = faiss.read_index(f"{d}/faiss.index")
        with open(f"{d}/chunks.pkl", "rb") as f:
            self.chunks = pickle.load(f)

        # BM25
        with open(f"{d}/bm25.pkl", "rb") as f:
            data = pickle.load(f)
        self.bm25 = data["bm25"]

    def _embed_query(self, query: str) -> np.ndarray:
        # RETRIEVAL_QUERY — different optimisation from RETRIEVAL_DOCUMENT
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

    @staticmethod
    def _tokenize(text: str) -> list[str]:
        tokens = re.findall(r"[\u1780-\u17FF]+", text)
        return tokens if tokens else text.split()

    @staticmethod
    def _rrf(vec_hits, bm25_hits, k=60, top_n=5) -> list[dict]:
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

    def search(self, query: str) -> list[dict]:
        # Dense search
        vec = self._embed_query(query)
        scores, idxs = self.index.search(vec, settings.vector_candidates)
        vec_hits = [(scores[0][i], self.chunks[idxs[0][i]])
                    for i in range(len(idxs[0]))]

        # Sparse BM25 search
        tokens     = self._tokenize(query)
        bm25_sc    = self.bm25.get_scores(tokens)
        top_bm25   = sorted(range(len(bm25_sc)),
                            key=lambda i: bm25_sc[i], reverse=True)
        bm25_hits  = [self.chunks[i] for i in top_bm25[:settings.bm25_candidates]]

        return self._rrf(vec_hits, bm25_hits, top_n=settings.retrieval_top_k)