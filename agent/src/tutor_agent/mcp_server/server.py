"""MCP server exposing the CSE110 course as tools.

Any MCP client can use it: the LangGraph agent in this repo, Claude Desktop, an IDE.

    tutor-mcp                     # stdio transport (what the agent and desktop clients use)

Tools
  search_course_material  hybrid search over theory and lab material and the ST website text
  get_consultation_hours  the Student Tutor's real routine, from the ST website data
  list_course_sources     what is indexed, and in which retrieval mode

The tools are read-only and return structured data. They never generate text:
answering is the agent's job, finding evidence is the server's.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Literal

from mcp.server.fastmcp import FastMCP

from tutor_agent.config import get_settings
from tutor_agent.retrieval.hybrid import HybridIndex
from tutor_agent.st_data import consultation_slots, tutor_info

mcp = FastMCP(
    "cse110-course",
    instructions=(
        "Tools for BRAC University CSE110 (Programming Language I, Java). Use search_course_material for course "
        "concepts and lab tasks, and get_consultation_hours for when and where to meet the Student Tutor."
    ),
)

Scope = Literal["all", "theory", "lab", "logistics"]
Lang = Literal["java", "python", "any"]


@lru_cache(maxsize=1)
def _index() -> HybridIndex:
    s = get_settings()
    embedder = None
    if s.has_embeddings:
        from tutor_agent.retrieval.vector import make_embedder

        embedder = make_embedder(s.google_api_key, s.embedding_model)
    return HybridIndex(s.index_dir, embedder)


@mcp.tool()
def search_course_material(query: str, scope: Scope = "all", k: int = 5, language: Lang = "any") -> list[dict]:
    """Search CSE110 theory notes, lab sheets and the Student Tutor's FAQ.

    CSE110 is currently taught in Java; material from the earlier Python offering is
    indexed too and every passage says which language it is.

    Args:
        query: what to look for, in the student's words or as Java terms.
        scope: "theory", "lab", "logistics" (ST FAQ and announcements) or "all".
        k: number of passages to return (1-10).
        language: "java", "python" or "any".

    Returns passages ranked best first, each with its source, location and text.
    """
    k = max(1, min(int(k), 10))
    kinds = None if scope == "all" else {scope}
    languages = None if language == "any" else {language}
    return [h.to_dict() for h in _index().search(query, k=k, kinds=kinds, languages=languages)]


@mcp.tool()
def get_consultation_hours(day: str | None = None, mode: Literal["regular", "ramadan"] = "regular") -> dict:
    """When and where students can meet the CSE110 Student Tutor.

    Args:
        day: a weekday such as "Saturday" to filter, or omit for the whole week.
        mode: "regular" or "ramadan" routine.
    """
    info = tutor_info()
    return {
        "tutor": f"{info.get('name', '')} ({info.get('initial', '')})".strip(),
        "term": f"{info.get('term', '')}, {info.get('termPeriod', '')}".strip(", "),
        "contact": {"email": info.get("email"), "discord": info.get("discordUsername")},
        "slots": [s.__dict__ for s in consultation_slots(day, mode)],
        "source": "ST website routine (ST_BRACU_T07)",
    }


@mcp.tool()
def list_course_sources() -> dict:
    """List the indexed files and how retrieval is running (hybrid or BM25 only)."""
    ix = _index()
    m = ix.manifest
    return {"mode": ix.mode, "corpus": m.get("corpus"), "chunks": m.get("chunks"),
            "by_kind": m.get("by_kind"), "by_language": m.get("by_language"), "sources": m.get("sources"), "built_at": m.get("built_at")}


def main() -> None:
    # Load the index (and with it numpy, Qdrant and the embedder) on the main thread before serving.
    # FastMCP runs tools on worker threads, and importing numpy's native extension from a worker
    # thread while the stdio loop runs can deadlock on Windows; it also spares the first student
    # the start-up cost. A missing index is reported by the tools themselves, so don't fail here.
    try:
        _index()
    except FileNotFoundError:
        pass
    try:
        mcp.run(transport="stdio")
    finally:
        if _index.cache_info().currsize:
            _index().close()


if __name__ == "__main__":
    main()
