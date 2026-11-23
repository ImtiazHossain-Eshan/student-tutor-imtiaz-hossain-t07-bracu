from __future__ import annotations

import pytest

from tutor_agent.documents import Chunk
from tutor_agent.retrieval import vector
from tutor_agent.retrieval.vector import EmbeddingCache, QuotaExhausted, embed_chunks, with_retry


class DailyLimitEmbedder:
    """Embeds the first batch, then answers like Gemini does when the daily quota is gone."""

    def __init__(self):
        self.calls = 0

    def embed_documents(self, texts, **_):
        self.calls += 1
        if self.calls > 1:
            raise RuntimeError("429 RESOURCE_EXHAUSTED. Please retry in 69857.3s.")
        return [[0.1, 0.2] for _ in texts]


def _chunks(n: int) -> list[Chunk]:
    return [Chunk(id=f"c{i}", text=f"t{i}", source="s.md", kind="theory", location="", title="") for i in range(n)]


def test_a_daily_limit_raises_instead_of_sleeping_for_hours():
    def fn():
        raise RuntimeError("429 RESOURCE_EXHAUSTED. Please retry in 69857.3s.")

    with pytest.raises(QuotaExhausted):
        with_retry(fn)


def test_quota_mid_build_keeps_what_was_embedded(tmp_path, monkeypatch):
    monkeypatch.setattr(vector, "BATCH", 2)
    cache = EmbeddingCache(tmp_path / "cache.jsonl")
    vecs = embed_chunks(_chunks(5), DailyLimitEmbedder(), 2, cache)
    assert [v is not None for v in vecs] == [True, True, False, False, False]
    # the next build resumes from the cache file
    assert set(EmbeddingCache(tmp_path / "cache.jsonl").vectors) == {"c0", "c1"}
