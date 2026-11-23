"""How the agent reaches the course: through the MCP server, as an MCP client.

`CourseTools` is the small interface the graph needs. `MCPCourseTools` implements it by
starting `tutor-mcp` over stdio and calling its tools through langchain-mcp-adapters,
so the agent uses exactly the same tools any other MCP client would.
"""
from __future__ import annotations

import json
import sys
from contextlib import asynccontextmanager
from typing import Protocol


class CourseTools(Protocol):
    async def search(self, query: str, scope: str = "all", k: int = 5, language: str = "any") -> list[dict]: ...
    async def hours(self, day: str | None = None) -> dict: ...


def _parse(result) -> list:
    """MCP tool results arrive as content blocks; each text block is one JSON value."""
    if isinstance(result, str):
        result = [{"type": "text", "text": result}]
    out = []
    for block in result:
        text = block.get("text") if isinstance(block, dict) else getattr(block, "text", None)
        if text is None:
            continue
        try:
            out.append(json.loads(text))
        except json.JSONDecodeError:
            out.append(text)
    return out


class MCPCourseTools:
    def __init__(self, tools):
        self._tools = {t.name: t for t in tools}

    async def search(self, query: str, scope: str = "all", k: int = 5, language: str = "any") -> list[dict]:
        res = await self._tools["search_course_material"].ainvoke(
            {"query": query, "scope": scope, "k": k, "language": language})
        return [r for r in _parse(res) if isinstance(r, dict)]

    async def hours(self, day: str | None = None) -> dict:
        args = {"day": day} if day else {}
        parsed = _parse(await self._tools["get_consultation_hours"].ainvoke(args))
        return parsed[0] if parsed and isinstance(parsed[0], dict) else {}


@asynccontextmanager
async def mcp_course_tools():
    """Start the course MCP server as a subprocess and yield tools bound to one session."""
    from langchain_mcp_adapters.client import MultiServerMCPClient
    from langchain_mcp_adapters.tools import load_mcp_tools

    client = MultiServerMCPClient(
        {"course": {"transport": "stdio", "command": sys.executable, "args": ["-m", "tutor_agent.mcp_server.server"]}}
    )
    async with client.session("course") as session:
        yield MCPCourseTools(await load_mcp_tools(session))
