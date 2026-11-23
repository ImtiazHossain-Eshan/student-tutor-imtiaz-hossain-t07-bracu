"""BM25 over chunks, with a tokenizer that understands Java identifiers.

Students type "array index out of bounds" while the slides say
`ArrayIndexOutOfBoundsException`; splitting camelCase keeps both findable.

BM25 uses the Lucene IDF, log(1 + (N - n + 0.5) / (n + 0.5)), which stays positive
even for a term that appears in most chunks ("loop" in a loops chapter). The classic
Robertson IDF goes negative there and silently drops the best matches on small corpora.
"""
from __future__ import annotations

import math
import re
from collections import Counter

from tutor_agent.documents import Chunk

STOP = {
    "the", "a", "an", "of", "to", "and", "in", "is", "it", "for", "on", "with", "as", "at", "by", "or", "be",
    "this", "that", "are", "was", "what", "how", "do", "does", "i", "me", "my", "can", "you", "your", "we",
    "if", "then", "so", "please", "explain", "tell", "about", "why", "when", "which",
}
_WORD = re.compile(r"[A-Za-z_][A-Za-z0-9_]*|\d+")
_CAMEL = re.compile(r"[A-Z]+(?=[A-Z][a-z])|[A-Z]?[a-z]+|[A-Z]+|\d+")


def tokenize(text: str) -> list[str]:
    out: list[str] = []
    for word in _WORD.findall(text):
        lower = word.lower()
        parts = [p.lower() for p in _CAMEL.findall(word.replace("_", " "))]
        if len(parts) > 1:
            out.append(lower)  # keep the whole identifier too
            out.extend(parts)
        else:
            out.append(lower)
    return [t for t in out if t not in STOP and (len(t) > 1 or t.isdigit())]


class LexicalIndex:
    def __init__(self, chunks: list[Chunk], k1: float = 1.5, b: float = 0.75):
        self.chunks = chunks
        self.k1, self.b = k1, b
        # Title words count twice: a slide titled "Nested Loops" is about nested loops.
        docs = [tokenize(f"{c.title} {c.title} {c.text}") for c in chunks]
        self.tf = [Counter(d) for d in docs]
        self.lengths = [len(d) for d in docs]
        self.avg_len = sum(self.lengths) / len(docs) if docs else 0.0
        df = Counter(t for d in self.tf for t in d)
        n = len(docs)
        self.idf = {t: math.log(1 + (n - f + 0.5) / (f + 0.5)) for t, f in df.items()}

    def _score(self, i: int, terms: list[str]) -> float:
        tf, length = self.tf[i], self.lengths[i] or 1
        s = 0.0
        for t in terms:
            f = tf.get(t, 0)
            if f:
                s += self.idf[t] * f * (self.k1 + 1) / (f + self.k1 * (1 - self.b + self.b * length / self.avg_len))
        return s

    def search(self, query: str, k: int = 10, kinds: set[str] | None = None,
               languages: set[str] | None = None) -> list[tuple[int, float]]:
        """`languages` filters course material; chunks marked "any" (ST routine, FAQ) always pass."""
        terms = tokenize(query)
        if not terms or not self.chunks:
            return []
        scored = []
        for i, c in enumerate(self.chunks):
            if kinds is not None and c.kind not in kinds:
                continue
            if languages is not None and c.language not in languages and c.language != "any":
                continue
            s = self._score(i, terms)
            if s > 0:
                scored.append((i, s))
        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[:k]
