"""Hybrid retrieval: BM25 and vector search, fused with reciprocal rank fusion (RRF).

RRF scores a chunk as sum(1 / (k + rank)) over the rankings it appears in. It
needs no score calibration between BM25 and cosine similarity, which live on
unrelated scales, and it rewards chunks that both methods agree on.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path

from tutor_agent.documents import Chunk
from tutor_agent.retrieval.lexical import LexicalIndex

RRF_K = 60
log = logging.getLogger(__name__)


@dataclass
class Hit:
    chunk: Chunk
    score: float
    lexical_rank: int | None = None
    vector_rank: int | None = None

    def to_dict(self) -> dict:
        return {
            "id": self.chunk.id,
            "source": self.chunk.source,
            "location": self.chunk.location,
            "kind": self.chunk.kind,
            "language": self.chunk.language,
            "title": self.chunk.title,
            "text": self.chunk.text,
            "score": round(self.score, 5),
            "matched_by": [m for m, r in (("bm25", self.lexical_rank), ("vector", self.vector_rank)) if r is not None],
        }


def rrf(rankings: list[list[int]], k: int = RRF_K) -> dict[int, float]:
    fused: dict[int, float] = {}
    for ranking in rankings:
        for rank, idx in enumerate(ranking, start=1):
            fused[idx] = fused.get(idx, 0.0) + 1.0 / (k + rank)
    return fused


class HybridIndex:
    """Loads a built index directory: chunks.jsonl, manifest.json and (optionally) qdrant/."""

    def __init__(self, index_dir: Path, embedder=None):
        self.dir = index_dir
        manifest = index_dir / "manifest.json"
        if not manifest.exists():
            raise FileNotFoundError(f"No index at {index_dir}. Run `tutor-ingest` first.")
        self.manifest = json.loads(manifest.read_text(encoding="utf-8"))
        lines = (index_dir / "chunks.jsonl").read_text(encoding="utf-8").splitlines()
        self.chunks = [Chunk.from_dict(json.loads(line)) for line in lines if line.strip()]
        self.lexical = LexicalIndex(self.chunks)
        self.embedder = embedder
        self.vector = None
        if embedder is not None and self.manifest.get("has_vectors"):
            from tutor_agent.retrieval.vector import VectorIndex

            self.vector = VectorIndex(index_dir / "qdrant")

    @property
    def mode(self) -> str:
        return "hybrid" if self.vector is not None else "bm25"

    def search(self, query: str, k: int = 5, kinds: set[str] | None = None, pool: int = 20,
               languages: set[str] | None = None) -> list[Hit]:
        lex = self.lexical.search(query, pool, kinds, languages)
        rankings = [[i for i, _ in lex]]
        vec: list[tuple[int, float]] = []
        if self.vector is not None:
            from tutor_agent.retrieval.vector import embed_query

            try:
                qv = embed_query(self.embedder, query, self.manifest.get("embedding_dim"))
            except Exception as exc:  # quota or network: answer from BM25 rather than fail the student
                log.warning("query embedding failed (%s), using BM25 only for this search", type(exc).__name__)
                qv = None
            if qv is not None:
                vec = self.vector.search(qv, pool, kinds, languages)
                rankings.append([i for i, _ in vec])
        fused = rrf(rankings)
        lex_rank = {i: r for r, (i, _) in enumerate(lex, start=1)}
        vec_rank = {i: r for r, (i, _) in enumerate(vec, start=1)}
        ordered = sorted(fused.items(), key=lambda x: x[1], reverse=True)[:k]
        return [Hit(self.chunks[i], s, lex_rank.get(i), vec_rank.get(i)) for i, s in ordered]

    def close(self) -> None:
        if self.vector is not None:
            self.vector.close()
