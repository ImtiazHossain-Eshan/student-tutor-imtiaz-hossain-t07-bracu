"""Split Sections into retrieval-sized Chunks.

Rules:
  - Split on paragraph boundaries, packing paragraphs up to `max_chars`.
  - Never split inside a fenced code block unless the block alone is too long,
    and then only on line boundaries, so Java stays compilable-looking.
  - Carry `overlap` characters of the previous chunk forward, so an idea that
    straddles a boundary is still findable from either side.
  - Chunk ids are stable hashes of (source, location, text): rebuilding the
    index with unchanged files gives identical ids, which keeps eval results comparable.
"""
from __future__ import annotations

import hashlib
import re

from tutor_agent.documents import Chunk, Section

FENCE = re.compile(r"```.*?```", re.S)


def _blocks(text: str) -> list[str]:
    """Paragraphs, with each fenced code block kept as one block."""
    out: list[str] = []
    pos = 0
    for m in FENCE.finditer(text):
        out.extend(p for p in re.split(r"\n\s*\n", text[pos:m.start()]) if p.strip())
        out.append(m.group(0))
        pos = m.end()
    out.extend(p for p in re.split(r"\n\s*\n", text[pos:]) if p.strip())
    return [b.strip() for b in out]


def _split_long(block: str, max_chars: int) -> list[str]:
    """Break an oversized block on line boundaries (code) or sentences (prose)."""
    is_code = block.startswith("```")
    units = block.split("\n") if is_code else re.split(r"(?<=[.!?])\s+", block)
    joiner = "\n" if is_code else " "
    pieces, cur = [], ""
    for u in units:
        if cur and len(cur) + len(u) + 1 > max_chars:
            pieces.append(cur)
            cur = u
        else:
            cur = f"{cur}{joiner}{u}" if cur else u
    if cur:
        pieces.append(cur)
    if is_code and len(pieces) > 1:  # re-fence every piece
        lang = block.split("\n", 1)[0]
        fixed = []
        for i, p in enumerate(pieces):
            p = p if i == 0 else f"{lang}\n{p}"
            fixed.append(p if p.rstrip().endswith("```") else p + "\n```")
        pieces = fixed
    return pieces


def _chunk_id(section: Section, text: str, n: int) -> str:
    h = hashlib.sha1(f"{section.language}|{section.kind}|{section.source}|{section.location}|{n}|{text}".encode()).hexdigest()
    return h[:16]


def chunk_section(section: Section, max_chars: int = 1100, overlap: int = 150) -> list[Chunk]:
    blocks: list[str] = []
    for b in _blocks(section.text):
        blocks.extend(_split_long(b, max_chars) if len(b) > max_chars else [b])

    texts: list[str] = []
    cur = ""
    for b in blocks:
        if cur and len(cur) + len(b) + 2 > max_chars:
            texts.append(cur)
            tail = cur[-overlap:] if overlap and not cur.rstrip().endswith("```") else ""
            # start the overlap on a word boundary
            tail = tail[tail.find(" ") + 1:] if " " in tail else tail
            cur = f"{tail}\n\n{b}" if tail else b
        else:
            cur = f"{cur}\n\n{b}" if cur else b
    if cur:
        texts.append(cur)

    return [
        Chunk(
            id=_chunk_id(section, t, n),
            text=t,
            source=section.source,
            kind=section.kind,
            location=section.location,
            title=section.title,
            language=section.language,
        )
        for n, t in enumerate(texts)
    ]


def chunk_sections(sections: list[Section], max_chars: int = 1100, overlap: int = 150) -> list[Chunk]:
    chunks: list[Chunk] = []
    for s in sections:
        chunks.extend(chunk_section(s, max_chars, overlap))
    return chunks
