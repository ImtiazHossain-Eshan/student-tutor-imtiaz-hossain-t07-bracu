"""Dense retrieval: Gemini embeddings stored in a local, file-backed Qdrant collection.

Optional by design. Without GOOGLE_API_KEY the index is built lexical-only and
every caller still works; the manifest records which mode an index was built in.

Free-tier friendly:
  - Embeddings are requested in batches under the per-minute quota, and a 429 is
    retried after the delay the API asks for.
  - Every vector is cached on disk by (model, dimension, chunk id). Chunk ids are
    content hashes, so rebuilding with unchanged files costs no API calls, and an
    interrupted build resumes where it stopped.
"""
from __future__ import annotations

import json
import logging
import re
import time
from pathlib import Path

from qdrant_client import QdrantClient, models

from tutor_agent.documents import Chunk

log = logging.getLogger(__name__)
COLLECTION = "cse110"
BATCH = 50
PER_MINUTE = 90  # free tier allows 100 embed requests per minute; stay under it


def make_embedder(api_key: str, model: str):
    from langchain_google_genai import GoogleGenerativeAIEmbeddings

    return GoogleGenerativeAIEmbeddings(model=model, google_api_key=api_key)


def _retry_delay(exc: Exception) -> float | None:
    msg = str(exc)
    if "RESOURCE_EXHAUSTED" not in msg and "429" not in msg:
        return None
    m = re.search(r"retry in ([\d.]+)s", msg) or re.search(r"'retryDelay': '(\d+)s'", msg)
    return float(m.group(1)) + 1 if m else 30.0


class QuotaExhausted(RuntimeError):
    """The API asked us to wait longer than is worth sleeping for (the daily quota is used up)."""

    def __init__(self, delay: float):
        super().__init__(f"embedding quota exhausted; the API asks to retry in {delay / 3600:.1f} h")
        self.delay = delay


MAX_WAIT = 120.0  # per-minute limits clear within a minute; anything longer is a daily limit


def with_retry(fn, *args, attempts: int = 6, **kwargs):
    for i in range(attempts):
        try:
            return fn(*args, **kwargs)
        except Exception as exc:
            delay = _retry_delay(exc)
            if delay is None:
                raise
            if delay > MAX_WAIT:
                raise QuotaExhausted(delay) from exc
            if i == attempts - 1:
                raise
            log.warning("rate limited, waiting %.0fs (attempt %d/%d)", delay, i + 1, attempts)
            time.sleep(delay)


def embed_query(embedder, text: str, dim: int | None) -> list[float]:
    return with_retry(embedder.embed_query, text, task_type="RETRIEVAL_QUERY", output_dimensionality=dim)


def _embed_text(c: Chunk) -> str:
    return f"{c.title}\n{c.text}" if c.title else c.text


class EmbeddingCache:
    def __init__(self, path: Path):
        self.path = path
        self.vectors: dict[str, list[float]] = {}
        if path.exists():
            for line in path.read_text(encoding="utf-8").splitlines():
                if line.strip():
                    row = json.loads(line)
                    self.vectors[row["id"]] = row["v"]

    def add(self, items: list[tuple[str, list[float]]]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.path, "a", encoding="utf-8") as fh:
            for cid, v in items:
                self.vectors[cid] = v
                fh.write(json.dumps({"id": cid, "v": [round(x, 6) for x in v]}) + "\n")


def embed_chunks(chunks: list[Chunk], embedder, dim: int, cache: EmbeddingCache) -> list[list[float] | None]:
    """Vectors for every chunk, from the cache or the API. If the daily quota runs
    out part-way, the missing ones come back as None; the next build fills them in."""
    todo = [c for c in chunks if c.id not in cache.vectors]
    if todo:
        log.info("embedding %d new chunks (%d cached)", len(todo), len(chunks) - len(todo))
    window_start, sent = time.monotonic(), 0
    for start in range(0, len(todo), BATCH):
        batch = todo[start:start + BATCH]
        if sent + len(batch) > PER_MINUTE:  # wait out the rest of the minute
            wait = 61 - (time.monotonic() - window_start)
            if wait > 0:
                log.info("pausing %.0fs for the per-minute quota (%d/%d done)", wait, start, len(todo))
                time.sleep(wait)
            window_start, sent = time.monotonic(), 0
        try:
            vecs = with_retry(embedder.embed_documents, [_embed_text(c) for c in batch],
                              task_type="RETRIEVAL_DOCUMENT", output_dimensionality=dim)
        except QuotaExhausted as exc:
            log.warning("%s: indexing the %d cached vectors now; run tutor-ingest again later for the other %d",
                        exc, len(chunks) - len(todo) + start, len(todo) - start)
            break
        cache.add([(c.id, v) for c, v in zip(batch, vecs)])
        sent += len(batch)
    return [cache.vectors.get(c.id) for c in chunks]


class VectorIndex:
    def __init__(self, path: Path):
        self.client = QdrantClient(path=str(path))

    @classmethod
    def build(cls, path: Path, chunks: list[Chunk], embedder, dim: int,
              cache: EmbeddingCache) -> tuple["VectorIndex", int]:
        """Returns the index and how many chunks are still missing a vector (0 when complete).
        Point ids are chunk positions, so a partial index still lines up with chunks.jsonl."""
        vectors = embed_chunks(chunks, embedder, dim, cache)
        missing = sum(v is None for v in vectors)
        if missing == len(chunks):
            raise QuotaExhausted(0) if chunks else ValueError("no chunks")
        idx = cls(path)
        if idx.client.collection_exists(COLLECTION):
            idx.client.delete_collection(COLLECTION)
        idx.client.create_collection(
            COLLECTION, vectors_config=models.VectorParams(size=dim, distance=models.Distance.COSINE)
        )
        idx.client.upsert(
            COLLECTION,
            points=[
                models.PointStruct(id=i, vector=v, payload={"kind": c.kind, "language": c.language, "chunk_id": c.id})
                for i, (c, v) in enumerate(zip(chunks, vectors)) if v is not None
            ],
        )
        return idx, missing

    def search(self, query_vector: list[float], k: int = 10, kinds: set[str] | None = None,
               languages: set[str] | None = None) -> list[tuple[int, float]]:
        must = []
        if kinds:
            must.append(models.FieldCondition(key="kind", match=models.MatchAny(any=sorted(kinds))))
        if languages:
            must.append(models.FieldCondition(key="language", match=models.MatchAny(any=sorted(languages | {"any"}))))
        flt = models.Filter(must=must) if must else None
        res = self.client.query_points(COLLECTION, query=query_vector, limit=k, query_filter=flt)
        return [(int(p.id), float(p.score)) for p in res.points]

    def close(self) -> None:
        self.client.close()
