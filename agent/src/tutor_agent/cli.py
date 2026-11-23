"""Ask the agent from the terminal.

    tutor-ask "Why does my loop throw ArrayIndexOutOfBoundsException?"
    tutor-ask --trace "When is online consultation?"
    tutor-ask                       # interactive
"""
from __future__ import annotations

import argparse
import asyncio
import sys

from tutor_agent.agent.brain import ChatBrain
from tutor_agent.agent.graph import ask, build_graph
from tutor_agent.agent.tools import mcp_course_tools
from tutor_agent.config import get_settings


def _print(result: dict, show_trace: bool) -> None:
    print("\n" + result.get("answer", "").strip())
    if result.get("sources"):
        print("\nSources:")
        for s in result["sources"]:
            print(f"  {s}")
    if show_trace:
        print("\nTrace:")
        for t in result.get("trace", []):
            print(f"  - {t}")
    print()


async def _run(questions: list[str], show_trace: bool) -> None:
    s = get_settings()
    if not s.has_llm:
        sys.exit("No API key. Put GOOGLE_API_KEY and/or GROQ_API_KEY in .env (see .env.example).")
    brain = ChatBrain.from_settings(s)
    async with mcp_course_tools() as tools:
        graph = build_graph(brain, tools, k=s.retrieve_k, max_attempts=s.max_retrieval_attempts)
        if questions:
            for q in questions:
                _print(await ask(graph, q, tools, on_error="reply"), show_trace)
            return
        print("CSE110 Tutor Agent. Ask a question, or press Enter on an empty line to quit.")
        while True:
            try:
                q = input("> ").strip()
            except EOFError:
                break
            if not q:
                break
            _print(await ask(graph, q, tools, on_error="reply"), show_trace)


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("question", nargs="*", help="question to ask (omit for interactive mode)")
    ap.add_argument("--trace", action="store_true", help="show the path the agent took through the graph")
    args = ap.parse_args(argv)
    q = " ".join(args.question).strip()
    asyncio.run(_run([q] if q else [], args.trace))


if __name__ == "__main__":
    main()
