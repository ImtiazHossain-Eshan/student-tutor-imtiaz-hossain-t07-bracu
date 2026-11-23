"""End-to-end: build a BM25 index from the sample data, start the MCP server over stdio,
and call its tools through langchain-mcp-adapters exactly as the agent does."""
from __future__ import annotations

import asyncio
import os
import subprocess
import sys

import pytest

from tutor_agent.agent.tools import MCPCourseTools


@pytest.fixture(scope="module")
def index_env(tmp_path_factory):
    index_dir = tmp_path_factory.mktemp("index")
    env = {**os.environ, "TUTOR_INDEX_DIR": str(index_dir), "GOOGLE_API_KEY": ""}
    subprocess.run([sys.executable, "-m", "tutor_agent.ingest.build", "--sample", "--no-vectors"],
                   env=env, check=True, capture_output=True)
    return env


async def _call(env):
    from langchain_mcp_adapters.client import MultiServerMCPClient
    from langchain_mcp_adapters.tools import load_mcp_tools

    client = MultiServerMCPClient({"course": {"transport": "stdio", "command": sys.executable,
                                              "args": ["-m", "tutor_agent.mcp_server.server"], "env": env}})
    async with client.session("course") as session:
        raw = await load_mcp_tools(session)
        tools = MCPCourseTools(raw)
        hits = await tools.search("array index out of bounds", scope="theory", k=3)
        lab = await tools.search("prime", scope="lab", k=3)
        hours = await tools.hours("Saturday")
        return sorted(t.name for t in raw), hits, lab, hours


def test_mcp_tools_over_stdio(index_env):
    names, hits, lab, hours = asyncio.run(_call(index_env))
    assert names == ["get_consultation_hours", "list_course_sources", "search_course_material"]
    assert hits[0]["source"] == "05_arrays.md" and hits[0]["kind"] == "theory"
    assert all(h["kind"] == "lab" for h in lab)
    assert hours["slots"] and all(s["day"] == "Saturday" for s in hours["slots"])
    assert all(s["type"] != "class" for s in hours["slots"])
