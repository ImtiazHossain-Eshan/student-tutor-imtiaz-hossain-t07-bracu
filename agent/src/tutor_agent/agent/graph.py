"""The agent as a LangGraph state machine.

    guard ──► classify ──► off_topic ─────────────────────────────► END
                 │
                 ├──► (logistics) hours ──┐
                 │                         ▼
                 └──► retrieve ──► answer ──► grade ──► finalize ──► END
                         ▲                      │
                         └──── rewrite ◄────────┘  (not grounded, attempts left)

guard      deterministic prompt-injection screen, before any model sees the message
classify   model routes the message and writes a search query
retrieve   MCP search_course_material
hours      MCP get_consultation_hours (plus a logistics search)
answer     model drafts an answer from numbered evidence, with citations
grade      model judges groundedness; code checks every citation points at real evidence
rewrite    retry retrieval with the grader's better query, widened to all material
finalize   cited answer, or an honest "not found" that points to consultation hours
"""
from __future__ import annotations

import re
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from tutor_agent.agent import prompts
from tutor_agent.agent.brain import Brain
from tutor_agent.agent.tools import CourseTools

INJECTION = re.compile(
    r"ignore (all |any |the )?(previous|prior|above) (instructions|rules)|system prompt|developer mode|"
    r"you are now|jailbreak|reveal (your|the) (instructions|prompt)|disregard (your|all) (rules|instructions)",
    re.I,
)
CITE = re.compile(r"\[(\d+)\]")


class AgentState(TypedDict, total=False):
    question: str
    intent: str
    scope: str
    language: str
    day: str | None
    query: str
    attempts: int
    passages: list[dict]
    schedule: dict
    draft: str
    grounded: bool
    unsupported: list[str]
    better_query: str
    answer: str
    sources: list[str]
    trace: list[str]


def format_evidence(passages: list[dict], schedule: dict | None) -> str:
    items = []
    for p in passages:
        where = f", {p['location']}" if p.get("location") else ""
        lang = p.get("language", "java")
        tag = p["kind"] if lang == "any" else f"{p['kind']}, {lang}"
        items.append(f"({tag}) {p['source']}{where}\n{p['text']}")
    if schedule and schedule.get("slots"):
        lines = "\n".join(f"- {s['day']} {s['time']}: {s['activity']} at {s['location']}" for s in schedule["slots"])
        items.append(f"(logistics) ST website routine, {schedule.get('term', '')}\nTutor: {schedule.get('tutor')}\n{lines}")
    return "\n\n".join(f"[{i}] {t}" for i, t in enumerate(items, start=1)) or "(no evidence found)"


def evidence_labels(passages: list[dict], schedule: dict | None) -> list[str]:
    labels = [
        f"{p['source']}" + (f", {p['location']}" if p.get("location") else "")
        + (" (earlier Python offering)" if p.get("language") == "python" else "")
        for p in passages
    ]
    if schedule and schedule.get("slots"):
        labels.append("ST website routine")
    return labels


FENCE = re.compile(r"```([A-Za-z]+)[^\n]*\n.*?```\n?", re.S)


def strip_unbacked_code(draft: str, passages: list[dict]) -> tuple[str, int]:
    """Remove java/python code blocks in a language none of the evidence is written in.

    A model asked about Java with only Python material can "helpfully" add Java from general
    knowledge; that is exactly the ungrounded content this agent promises not to give. Prompts ask
    for this, and this check enforces it. Returns the cleaned draft and how many blocks it removed.
    """
    have = {p.get("language") for p in passages} - {None, "any"}
    if not have:
        return draft, 0
    removed = 0

    def keep(m: re.Match) -> str:
        nonlocal removed
        lang = m.group(1).lower()
        if lang in ("java", "python") and lang not in have:
            removed += 1
            return ""
        return m.group(0)

    return FENCE.sub(keep, draft).strip(), removed


CODE = re.compile(r"```.*?(```|$)|`[^`\n]*`", re.S)


def citation_numbers(draft: str) -> set[int]:
    """The [n] citations in a draft, ignoring code: `t[0]` or `nums[1]` is indexing, not a citation."""
    return {int(x) for x in CITE.findall(CODE.sub(" ", draft))}


def cited_evidence(draft: str, passages: list[dict], schedule: dict | None) -> str:
    """The evidence items the draft cites, keeping their original numbers, for a smaller grader call."""
    full = format_evidence(passages, schedule)
    cited = citation_numbers(draft)
    items = re.split(r"\n\n(?=\[\d+\] )", full)
    kept = [it for it in items if (m := re.match(r"\[(\d+)\]", it)) and int(m.group(1)) in cited]
    return "\n\n".join(kept) if kept else full


def citations_valid(draft: str, n_evidence: int) -> bool:
    cited = citation_numbers(draft)
    return bool(cited) and all(1 <= c <= n_evidence for c in cited)


def build_graph(brain: Brain, tools: CourseTools, *, k: int = 5, max_attempts: int = 2, tutor: str = "Imtiaz Hossain (T07)"):
    def log(state: AgentState, msg: str) -> list[str]:
        return [*state.get("trace", []), msg]

    async def guard(state: AgentState) -> AgentState:
        if INJECTION.search(state["question"]):
            return {"intent": "guardrail", "trace": log(state, "guard: injection pattern, refused before any model call")}
        return {"trace": log(state, "guard: ok")}

    async def classify(state: AgentState) -> AgentState:
        r = await brain.classify(state["question"])
        intent = "off_topic" if r.injection and r.intent == "off_topic" else r.intent
        # A student who names a language in this question means it, whatever the earlier chat was about.
        earlier, _, current = state["question"].rpartition("Follow-up question:")
        if re.search(r"\bpython\b", current, re.I):
            r.language = "python"
        elif re.search(r"\bjava\b", current, re.I):
            r.language = "java"
        elif m := re.search(r"student asked, about (Python|Java):", earlier):
            r.language = m.group(1).lower()  # a follow-up stays in the conversation's language
        return {
            "intent": intent, "scope": r.scope, "language": r.language, "day": r.day,
            "query": r.search_query or state["question"], "attempts": 0,
            "trace": log(state, f"classify: {intent} scope={r.scope} lang={r.language} query={r.search_query!r}"
                                         + (" (injection flagged)" if r.injection else "")),
        }

    async def retrieve(state: AgentState) -> AgentState:
        scope = state.get("scope", "all")
        if scope == "logistics" and state.get("intent") != "logistics":
            scope = "all"
        lang = state.get("language", "java")
        passages = await tools.search(state["query"], scope=scope, k=k, language=lang)
        note = f"retrieve: {len(passages)} passages for {state['query']!r} in {scope}/{lang}"
        if not [p for p in passages if p.get("language") != "any"]:
            # nothing in the student's language: fall back to the other offering, labelled as such
            passages = await tools.search(state["query"], scope=scope, k=k, language="any")
            note += f"; none in {lang}, widened to all languages ({len(passages)})"
        return {"passages": passages, "attempts": state.get("attempts", 0) + 1, "trace": log(state, note)}

    async def hours(state: AgentState) -> AgentState:
        schedule = await tools.hours(state.get("day"))
        passages = await tools.search(state["query"], scope="logistics", k=3)
        return {"schedule": schedule, "passages": passages, "attempts": state.get("attempts", 0) + 1,
                "trace": log(state, f"hours: {len(schedule.get('slots', []))} slots, {len(passages)} FAQ passages")}

    async def answer(state: AgentState) -> AgentState:
        evidence = format_evidence(state.get("passages", []), state.get("schedule"))
        draft = await brain.answer(state["question"], state["intent"], evidence, tutor, state.get("language", "java"))
        draft, removed = strip_unbacked_code(draft, state.get("passages", []))
        note = f", removed {removed} code block(s) in a language the material does not cover" if removed else ""
        return {"draft": draft, "trace": log(state, f"answer: drafted {len(draft)} chars{note}")}

    async def grade(state: AgentState) -> AgentState:
        passages, schedule = state.get("passages", []), state.get("schedule")
        n = len(evidence_labels(passages, schedule))
        if n == 0:
            return {"grounded": False, "unsupported": ["no evidence"], "better_query": state["query"],
                    "trace": log(state, "grade: no evidence")}
        if state["draft"].strip().startswith(prompts.NOT_IN_MATERIAL):
            # the model says the evidence does not cover the question: decided in code, no grader call
            return {"grounded": False, "unsupported": ["evidence does not cover the question"],
                    "better_query": state["query"], "trace": log(state, "grade: answer model found nothing relevant")}
        g = await brain.grade(state["question"], state["draft"], cited_evidence(state["draft"], passages, schedule))
        cites_ok = citations_valid(state["draft"], n)
        # A "not grounded" verdict that names no unsupported claim gives nothing to act on, and small
        # graders return it for correct drafts; the citation check below still has to pass.
        grounded = cites_ok and (g.grounded or not g.unsupported_claims)
        why = "" if grounded else (" (citations invalid)" if not cites_ok else f" unsupported={g.unsupported_claims[:2]}")
        return {"grounded": grounded, "unsupported": g.unsupported_claims, "better_query": g.better_query or state["query"],
                "trace": log(state, f"grade: grounded={grounded}{why}")}

    async def rewrite(state: AgentState) -> AgentState:
        q = state.get("better_query") or state["query"]
        if q.strip().lower() == state["query"].strip().lower():
            q = state["question"]  # grader had nothing better: search the student's own words
        return {"query": q, "scope": "all", "trace": log(state, f"rewrite: retry with {q!r} across all material")}

    async def finalize(state: AgentState) -> AgentState:
        if state.get("grounded"):
            labels = evidence_labels(state.get("passages", []), state.get("schedule"))
            cited = sorted(citation_numbers(state["draft"]))
            sources = [f"[{i}] {labels[i - 1]}" for i in cited if 1 <= i <= len(labels)]
            return {"answer": state["draft"], "sources": sources, "trace": log(state, "finalize: grounded answer")}
        try:
            hrs = _next_slot(await tools.hours(None))
        except Exception:
            hrs = ""
        return {"answer": prompts.NOT_FOUND.format(hours=hrs), "sources": [],
                "trace": log(state, "finalize: not grounded after retries, declined to guess")}

    async def off_topic(state: AgentState) -> AgentState:
        text = prompts.GUARDRAIL if state.get("intent") == "guardrail" else prompts.OFF_TOPIC
        return {"answer": text, "sources": [], "trace": log(state, f"refuse: {state.get('intent')}")}

    def after_guard(state: AgentState) -> str:
        return "off_topic" if state.get("intent") == "guardrail" else "classify"

    def after_classify(state: AgentState) -> str:
        return {"off_topic": "off_topic", "logistics": "hours"}.get(state["intent"], "retrieve")

    def after_grade(state: AgentState) -> str:
        if state.get("grounded") or state.get("attempts", 0) >= max_attempts or state.get("intent") == "logistics":
            return "finalize"
        return "rewrite"

    g = StateGraph(AgentState)
    for name, fn in [("guard", guard), ("classify", classify), ("retrieve", retrieve), ("hours", hours),
                     ("answer", answer), ("grade", grade), ("rewrite", rewrite), ("finalize", finalize),
                     ("off_topic", off_topic)]:
        g.add_node(name, fn)
    g.add_edge(START, "guard")
    g.add_conditional_edges("guard", after_guard, ["classify", "off_topic"])
    g.add_conditional_edges("classify", after_classify, ["off_topic", "hours", "retrieve"])
    g.add_edge("retrieve", "answer")
    g.add_edge("hours", "answer")
    g.add_edge("answer", "grade")
    g.add_conditional_edges("grade", after_grade, ["finalize", "rewrite"])
    g.add_edge("rewrite", "retrieve")
    g.add_edge("finalize", END)
    g.add_edge("off_topic", END)
    return g.compile()


def _next_slot(schedule: dict) -> str:
    """' (Saturday 12:30 PM in 10G-33L, or see the full routine)' for the first offline slot, else ''."""
    first = [s for s in schedule.get("slots", []) if s.get("type") == "offline"][:1]
    if not first:
        return ""
    return f" ({first[0]['day']} {first[0]['time']} in {first[0]['location']}, or see the full routine)"


async def ask(graph, question: str, tools: CourseTools | None = None, on_error: str = "raise") -> AgentState:
    """Run one question through the graph.

    on_error="reply" is for students: if every model is unavailable (overloaded, out of quota,
    timed out), they get an honest "try again" with a real consultation slot instead of a crash.
    The eval keeps the default "raise", so outages are counted as errors, never as answers.
    """
    try:
        return await graph.ainvoke({"question": question, "trace": []})
    except Exception as exc:
        if on_error != "reply":
            raise
        hours = ""
        if tools is not None:
            try:
                hours = _next_slot(await tools.hours())
            except Exception:
                pass
        return {"question": question, "intent": "error", "answer": prompts.BUSY.format(hours=hours),
                "sources": [], "trace": [f"error: {type(exc).__name__}: {str(exc)[:160]}"]}
