"""Turn one run of the LangGraph agent into a stream of step events for the web inspector.

Each event describes a node that has just finished: its name, how long it took, its trace
line, and a small, safe summary of what it decided or found. The graph runs nodes one at a
time, so the time between two updates is the time the node took.
"""
from __future__ import annotations

import time
from collections.abc import AsyncIterator

from tutor_agent.agent import prompts
from tutor_agent.agent.graph import _next_slot, evidence_labels
from tutor_agent.agent.tools import CourseTools

PASSAGE_PREVIEW = 320  # characters of each retrieved passage shown in the inspector


def _detail(node: str, update: dict, state: dict) -> dict:
    """What the inspector shows when a step is opened. Only data the step produced."""
    if node == "classify":
        return {k: update.get(k) for k in ("intent", "scope", "language", "query", "day")}
    if node in ("retrieve",):
        return {"query": state.get("query"), "scope": state.get("scope"), "passages": [
            {"source": p.get("source"), "location": p.get("location"), "kind": p.get("kind"),
             "language": p.get("language"), "matched_by": p.get("matched_by", []),
             "text": (p.get("text") or "")[:PASSAGE_PREVIEW]}
            for p in update.get("passages", [])]}
    if node == "hours":
        sched = update.get("schedule") or {}
        return {"slots": sched.get("slots", []), "faq": len(update.get("passages", []))}
    if node == "grade":
        return {"grounded": update.get("grounded"), "unsupported": update.get("unsupported", [])}
    if node == "rewrite":
        return {"query": update.get("query"), "scope": update.get("scope")}
    if node == "answer":
        return {"chars": len(update.get("draft", ""))}
    return {}


def _outcome(state: dict) -> str:
    intent = state.get("intent")
    if intent == "guardrail":
        return "refused"
    if intent == "off_topic":
        return "off_topic"
    if state.get("answer", "").startswith(prompts.NOT_FOUND.split(",")[0]):
        return "not_in_material"
    if intent == "lab_help":
        return "hint"
    return "grounded"


async def stream_run(graph, question: str, tools: CourseTools | None = None) -> AsyncIterator[dict]:
    state: dict = {"question": question, "trace": []}
    t_start = last = time.perf_counter()
    yield {"type": "start", "question": question}
    first_token_ms = None
    try:
        # "messages" streams the answer node's tokens as the model writes them (the draft, before the
        # grounding check); "updates" reports each node when it finishes.
        async for mode, data in graph.astream({"question": question, "trace": []}, stream_mode=["updates", "messages"]):
            if mode == "messages":
                chunk, meta = data
                if meta.get("langgraph_node") != "answer":
                    continue  # classify and grade are structured calls, not text for the student
                if state.get("intent") == "lab_help":
                    continue  # never stream a lab draft: it may hold a solution the grader rejects
                text = _token_text(getattr(chunk, "content", ""))
                if text:
                    if first_token_ms is None:
                        first_token_ms = round((time.perf_counter() - t_start) * 1000)
                    yield {"type": "token", "text": text}
                continue
            for node, update in data.items():
                now = time.perf_counter()
                update = update or {}
                state.update(update)
                trace = update.get("trace") or []
                yield {"type": "step", "node": node, "ms": round((now - last) * 1000),
                       "line": trace[-1] if trace else node, "detail": _detail(node, update, state)}
                last = now
    except Exception as exc:  # every model unavailable: an honest reply, never a stack trace
        hours = ""
        if tools is not None:
            try:
                hours = _next_slot(await tools.hours())
            except Exception:
                pass
        yield {"type": "done", "outcome": "busy", "intent": "error", "answer": prompts.BUSY.format(hours=hours),
               "sources": [], "error": f"{type(exc).__name__}: {str(exc)[:200]}",
               "total_ms": round((time.perf_counter() - t_start) * 1000)}
        return
    yield {"type": "done", "outcome": _outcome(state), "intent": state.get("intent"),
           "language": state.get("language"), "answer": state.get("answer", ""),
           "sources": state.get("sources", []),
           "evidence": evidence_labels(state.get("passages", []), state.get("schedule")),
           "first_token_ms": first_token_ms, "total_ms": round((time.perf_counter() - t_start) * 1000)}


def _token_text(content) -> str:
    if isinstance(content, str):
        return content
    # some providers send a list of content blocks
    return "".join(b.get("text", "") if isinstance(b, dict) and b.get("type", "text") == "text" else ""
                   for b in content or [])
