"""The CSE110 Tutor Agent in a browser.

    tutor-web                     # http://127.0.0.1:8110
    tutor-web --port 9000 --open  # another port, and open the browser

One page (static/index.html) and three endpoints:
  GET  /api/info   what is indexed and which models are in use
  POST /api/ask    {"question": "..."} -> newline-delimited JSON, one event per graph step
  GET  /healthz    "ok" once the course server is up (for a host's health check)

Hosted publicly it also enforces CORS (TUTOR_ALLOWED_ORIGINS) and per-visitor and daily
question limits, so strangers cannot drain the API quota.

The MCP course server is started once, when this server starts, and every question reuses
the same session. Questions are answered one at a time, which also keeps the free-tier
rate limits predictable.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import webbrowser
from contextlib import asynccontextmanager
from pathlib import Path

from starlette.applications import Starlette
from starlette.requests import Request
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import FileResponse, JSONResponse, PlainTextResponse, StreamingResponse
from starlette.routing import Route

from tutor_agent.config import get_settings

STATIC = Path(__file__).parent / "static"
MAX_QUESTION = 2000


def _info(s, brain_models: list[str]) -> dict:
    manifest_path = s.index_dir / "manifest.json"
    m = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}
    vectors = bool(m.get("has_vectors"))
    return {
        "retrieval": "hybrid" if vectors else "bm25",
        "chunks": m.get("chunks"), "vectors_missing": m.get("vectors_missing", 0),
        "by_kind": m.get("by_kind", {}), "by_language": m.get("by_language", {}),
        "sources": len(m.get("sources", [])), "built_at": m.get("built_at"),
        "embedding_model": m.get("embedding_model"), "models": brain_models,
        "tutor": "Imtiaz Hossain (T07)",
    }


def with_context(question: str, previous: str) -> str:
    """Follow-ups like "give me an example of that" only make sense with the question before.
    The agent is single-turn, so the previous question rides along as labelled context. Only the
    question, never the previous answer, so every answer is still grounded in fresh retrieval."""
    if not previous:
        return question
    return f"(Earlier in this chat the student asked: {previous})\nFollow-up question: {question}"


def create_app() -> Starlette:
    from tutor_agent.agent.brain import ChatBrain, split_model
    from tutor_agent.agent.graph import build_graph
    from tutor_agent.agent.tools import mcp_course_tools
    from tutor_agent.web.limits import Limits, client_ip
    from tutor_agent.web.run_stream import stream_run

    s = get_settings()
    if not s.has_llm:
        raise SystemExit("No API key. Put GOOGLE_API_KEY and/or GROQ_API_KEY in .env (see .env.example).")
    ctx: dict = {"graphs": {}}
    models = s.available_models()
    limits = Limits(s.limit_per_minute, s.limit_per_day, s.global_per_day)

    def graph_for(model: str):
        """One graph per chosen model, built on first use. The chosen model goes first; every other
        available model stays behind it as a fallback. Interactive use: no client-side pacing (that is
        for the eval's bursts) and a short timeout, so a stuck model hands over quickly."""
        if model not in ctx["graphs"]:
            brain = ChatBrain.from_settings(s, first=model, timeout=min(s.llm_timeout, 15.0), requests_per_minute=0)
            ctx["graphs"][model] = build_graph(brain, ctx["tools"], k=s.retrieve_k, max_attempts=s.max_retrieval_attempts)
        return ctx["graphs"][model]

    @asynccontextmanager
    async def lifespan(app):
        # Interactive use: no client-side pacing (that is for the eval's bursts; here one person asks
        # at a time) and a shorter timeout, so a stuck model hands over to the next fallback quickly.
        async with mcp_course_tools() as tools:
            ctx.update(tools=tools, lock=asyncio.Lock())
            graph_for(models[0])
            yield

    async def index(request: Request):
        return FileResponse(STATIC / "index.html", headers={"Cache-Control": "no-store"})

    async def info(request: Request):
        info = _info(s, models)
        offered = models if s.show_model_menu else models[:1]
        info["choices"] = [{"id": m, "provider": split_model(m)[0], "name": split_model(m)[1]} for m in offered]
        return JSONResponse(info)

    async def healthz(request: Request):
        return PlainTextResponse("ok" if "tools" in ctx else "starting", status_code=200 if "tools" in ctx else 503)

    async def ask(request: Request):
        try:
            body = await request.json()
        except Exception:
            return JSONResponse({"error": "Send JSON like {\"question\": \"...\"}."}, status_code=400)
        q = str(body.get("question", "")).strip()
        if not q:
            return JSONResponse({"error": "Type a question first."}, status_code=400)
        if len(q) > MAX_QUESTION:
            return JSONResponse({"error": f"Keep the question under {MAX_QUESTION} characters."}, status_code=400)
        q = with_context(q, str(body.get("previous", "")).strip()[:MAX_QUESTION])
        model = str(body.get("model") or models[0])
        if model not in models or (not s.show_model_menu and model != models[0]):
            return JSONResponse({"error": f"Unknown model {model!r}."}, status_code=400)
        over = limits.check(client_ip(request.headers, request.client.host if request.client else None, s.trust_proxy))
        if over:
            return JSONResponse({"error": over}, status_code=429)

        async def events():
            async with ctx["lock"]:
                async for ev in stream_run(graph_for(model), q, ctx["tools"]):
                    if ev["type"] == "done":
                        ev["model"] = model
                    yield json.dumps(ev, ensure_ascii=False) + "\n"

        return StreamingResponse(events(), media_type="application/x-ndjson",
                                 headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"})

    origins = [o.strip().rstrip("/") for o in s.allowed_origins.split(",") if o.strip()]
    middleware = [Middleware(CORSMiddleware, allow_origins=origins, allow_methods=["GET", "POST"],
                             allow_headers=["Content-Type"])] if origins else []
    return Starlette(routes=[Route("/", index), Route("/api/info", info), Route("/healthz", healthz),
                             Route("/api/ask", ask, methods=["POST"])],
                     middleware=middleware, lifespan=lifespan)


def main(argv: list[str] | None = None) -> None:
    import uvicorn

    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--host", default=os.environ.get("HOST", "127.0.0.1"))
    ap.add_argument("--port", type=int, default=int(os.environ.get("PORT", 8110)))  # hosts set PORT
    ap.add_argument("--open", action="store_true", help="open the page in the default browser")
    args = ap.parse_args(argv)
    if args.open:
        webbrowser.open(f"http://{args.host}:{args.port}/")
    uvicorn.run(create_app(), host=args.host, port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
