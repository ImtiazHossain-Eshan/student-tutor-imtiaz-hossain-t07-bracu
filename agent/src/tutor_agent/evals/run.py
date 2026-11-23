"""Evaluate retrieval and the full agent against a set of labelled questions.

    tutor-eval retrieval                 # no API key needed: hit@k and MRR of the search index
    tutor-eval agent                     # full agent over MCP (needs GOOGLE_API_KEY or GROQ_API_KEY)
    tutor-eval agent --cases evals/cases_course.jsonl

Case fields (JSON Lines):
  id, category, question
  expect_intent       the route the classifier should pick (or a list of acceptable routes)
  expect_sources      file names; retrieval passes if any appears in the top k
  should_decline      the agent must refuse or say it could not find the answer
  must_contain_any    the answer must mention at least one of these
  must_not_contain    the answer must mention none of these (prompt leaks, etc.)
  no_full_solution    the answer must not hand over a complete Java program

Results are written to evals/results/<timestamp>-<suite>.json and a Markdown summary.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import re
import time
from collections import defaultdict
from datetime import datetime
from pathlib import Path

from tutor_agent.agent import prompts
from tutor_agent.config import PROJECT_ROOT, get_settings

DEFAULT_CASES = PROJECT_ROOT / "evals" / "cases_sample.jsonl"
RESULTS = PROJECT_ROOT / "evals" / "results"
DECLINES = (prompts.NOT_FOUND.split(",")[0], prompts.OFF_TOPIC[:40], prompts.GUARDRAIL[:30])
FULL_PROGRAM = re.compile(r"public\s+static\s+void\s+main", re.M)
CODE_BLOCK = re.compile(r"```\w*\n(.*?)```", re.S)
RETRY_PAUSE = 30  # seconds before retrying a case that hit an API error
MAX_SNIPPET_LINES = 7  # a hint may show a short example; 8+ lines of code is treated as a handed-over solution


def gives_full_solution(answer: str) -> bool:
    if FULL_PROGRAM.search(answer):
        return True
    return any(len([ln for ln in b.splitlines() if ln.strip()]) > MAX_SNIPPET_LINES for b in CODE_BLOCK.findall(answer))


def load_cases(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def declined(answer: str) -> bool:
    return any(answer.startswith(d) for d in DECLINES)


# ---------- retrieval ----------

def eval_retrieval(cases: list[dict], k: int) -> dict:
    from tutor_agent.retrieval.hybrid import HybridIndex

    s = get_settings()
    embedder = None
    if s.has_embeddings:
        from tutor_agent.retrieval.vector import make_embedder

        embedder = make_embedder(s.google_api_key, s.embedding_model)
    ix = HybridIndex(s.index_dir, embedder)
    rows = []
    for c in cases:
        if not c.get("expect_sources"):
            continue
        hits = ix.search(c["question"], k=k)
        names = [h.chunk.source.split("/")[-1] for h in hits]
        rank = next((i for i, n in enumerate(names, 1) if n in c["expect_sources"]), None)
        rows.append({"id": c["id"], "question": c["question"], "rank": rank, "top": names})
    ix.close()
    n = len(rows)
    summary = {
        "mode": ix.mode, "k": k, "cases": n,
        "hit_at_1": round(sum(r["rank"] == 1 for r in rows) / n, 3) if n else None,
        f"hit_at_{k}": round(sum(r["rank"] is not None for r in rows) / n, 3) if n else None,
        "mrr": round(sum(1 / r["rank"] for r in rows if r["rank"]) / n, 3) if n else None,
        "misses": [r for r in rows if r["rank"] is None],
    }
    return {"summary": summary, "rows": rows}


# ---------- full agent ----------

def check_case(c: dict, out: dict) -> dict:
    ans = out.get("answer", "")
    checks: dict[str, bool] = {}
    if "expect_intent" in c:
        want = c["expect_intent"]
        checks["route"] = out.get("intent") in (want if isinstance(want, list) else [want])
    if c.get("should_decline") is not None:
        checks["decline"] = declined(ans) == bool(c["should_decline"])
    elif c.get("category") in {"concept", "lab_help", "logistics"}:
        checks["answered"] = not declined(ans)
    if c.get("must_contain_any"):
        checks["contains"] = any(x.lower() in ans.lower() for x in c["must_contain_any"])
    if c.get("must_not_contain"):
        checks["no_leak"] = not any(x.lower() in ans.lower() for x in c["must_not_contain"])
    if c.get("no_full_solution"):
        checks["no_full_solution"] = not gives_full_solution(ans)
    if not declined(ans) and out.get("intent") not in {"off_topic", "guardrail"}:
        checks["cited"] = bool(out.get("sources"))
    return checks


async def _run_agent(cases: list[dict]) -> list[dict]:
    from tutor_agent.agent.brain import ChatBrain
    from tutor_agent.agent.graph import ask, build_graph
    from tutor_agent.agent.tools import mcp_course_tools

    s = get_settings()
    brain = ChatBrain.from_settings(s)
    rows = []
    async with mcp_course_tools() as tools:
        graph = build_graph(brain, tools, k=s.retrieve_k, max_attempts=s.max_retrieval_attempts)
        for c in cases:
            t0 = time.perf_counter()
            out, err = {}, None
            for attempt in range(2):  # an API outage is retried once after a pause, then recorded as an error
                try:
                    out, err = await ask(graph, c["question"]), None
                    break
                except Exception as exc:  # record, keep going
                    out, err = {}, f"{type(exc).__name__}: {exc}"
                    if attempt == 0:
                        await asyncio.sleep(RETRY_PAUSE)
            secs = round(time.perf_counter() - t0, 2)
            checks = check_case(c, out) if not err else {"error": False}
            rows.append({"id": c["id"], "category": c.get("category"), "question": c["question"],
                         "intent": out.get("intent"), "answer": out.get("answer"), "sources": out.get("sources"),
                         "trace": out.get("trace"), "checks": checks, "passed": all(checks.values()),
                         "seconds": secs, "error": err})
            print(f"  {'PASS' if rows[-1]['passed'] else 'FAIL'} {c['id']} ({secs}s) {[k for k, v in checks.items() if not v]}"
                  + (f"  {err[:200]}" if err else ""), flush=True)
    return rows


def eval_agent(cases: list[dict]) -> dict:
    if not get_settings().has_llm:
        raise SystemExit("The agent eval needs GOOGLE_API_KEY or GROQ_API_KEY. `tutor-eval retrieval` runs without one.")
    rows = asyncio.run(_run_agent(cases))
    by_check: dict[str, list[bool]] = defaultdict(list)
    by_cat: dict[str, list[bool]] = defaultdict(list)
    for r in rows:
        if r["error"]:
            continue
        for k, v in r["checks"].items():
            by_check[k].append(v)
        by_cat[r["category"]].append(r["passed"])
    rate = lambda xs: round(sum(xs) / len(xs), 3) if xs else None  # noqa: E731
    ran = [r for r in rows if not r["error"]]
    summary = {
        "cases": len(rows), "passed": sum(r["passed"] for r in rows), "pass_rate": rate([r["passed"] for r in rows]),
        # API outages (overload, quota) say nothing about the agent's behaviour, so report them apart
        "api_errors": len(rows) - len(ran), "pass_rate_excluding_api_errors": rate([r["passed"] for r in ran]),
        "by_check": {k: rate(v) for k, v in sorted(by_check.items())},
        "by_category": {k: rate(v) for k, v in sorted(by_cat.items())},
        "median_seconds": sorted(r["seconds"] for r in rows)[len(rows) // 2] if rows else None,
        "failures": [{"id": r["id"], "failed": [k for k, v in r["checks"].items() if not v], "trace": r["trace"]}
                     for r in ran if not r["passed"]],
        "errors": [{"id": r["id"], "error": (r["error"] or "")[:200]} for r in rows if r["error"]],
    }
    return {"summary": summary, "rows": rows}


def _write(suite: str, result: dict) -> Path:
    RESULTS.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    path = RESULTS / f"{stamp}-{suite}.json"
    path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    md = [f"# {suite} eval, {stamp}", "", "```json", json.dumps(result["summary"], indent=2, ensure_ascii=False), "```"]
    path.with_suffix(".md").write_text("\n".join(md), encoding="utf-8")
    return path


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("suite", choices=["retrieval", "agent"])
    ap.add_argument("--cases", type=Path, default=DEFAULT_CASES)
    ap.add_argument("-k", type=int, default=5)
    args = ap.parse_args(argv)
    cases = load_cases(args.cases)
    result = eval_retrieval(cases, args.k) if args.suite == "retrieval" else eval_agent(cases)
    path = _write(args.suite, result)
    print(json.dumps(result["summary"], indent=2, ensure_ascii=False))
    print(f"\nSaved {path}")


if __name__ == "__main__":
    main()
