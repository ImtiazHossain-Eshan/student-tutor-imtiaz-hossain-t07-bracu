"""The model-facing half of the agent: classify, answer, grade.

The graph depends on the `Brain` protocol, not on Gemini, so the control flow can be
unit-tested with a scripted fake and the model can be swapped without touching the graph.
"""
from __future__ import annotations

from typing import Literal, Protocol

from pydantic import BaseModel, Field

from tutor_agent.agent import prompts

Intent = Literal["concept", "lab_help", "logistics", "off_topic"]


class Route(BaseModel):
    intent: Intent
    injection: bool = False
    search_query: str = Field(description="short keyword query for the course material")
    scope: Literal["theory", "lab", "logistics", "all"] = "all"
    language: Literal["java", "python"] = "java"
    day: str | None = None


class Grade(BaseModel):
    grounded: bool
    unsupported_claims: list[str] = Field(default_factory=list)
    better_query: str = ""


class Brain(Protocol):
    async def classify(self, question: str) -> Route: ...
    async def answer(self, question: str, intent: str, evidence: str, tutor: str, language: str = "java") -> str: ...
    async def grade(self, question: str, draft: str, evidence: str) -> Grade: ...


PROVIDERS = ("gemini", "groq")


def split_model(spec: str) -> tuple[str, str]:
    """'groq:llama-x' -> ('groq', 'llama-x'). A bare name is a Gemini model (older settings)."""
    provider, _, name = spec.partition(":")
    return (provider, name) if name and provider in PROVIDERS else ("gemini", spec)


def make_chat(spec: str, keys: dict[str, str | None], *, temperature: float, timeout: float,
              max_retries: int, rate_limiter=None):
    provider, name = split_model(spec)
    if provider == "groq":
        from langchain_groq import ChatGroq

        # Groq's free tier answers a burst with 429 + retry-after of a few seconds; waiting is faster
        # than failing over to another provider, so Groq always gets at least two retries.
        return ChatGroq(model=name, api_key=keys.get("groq"), temperature=temperature, timeout=timeout,
                        max_retries=max(max_retries, 2), rate_limiter=rate_limiter)
    from langchain_google_genai import ChatGoogleGenerativeAI

    return ChatGoogleGenerativeAI(model=name, google_api_key=keys.get("gemini"), temperature=temperature,
                                  timeout=timeout, max_retries=max_retries, rate_limiter=rate_limiter)


class ChatBrain:
    """A chat model (Gemini or Groq) behind the Brain protocol. Every call has a timeout and falls
    back down a list of models, so an overloaded model costs a few seconds instead of a hung answer."""

    def __init__(self, models: list[str], keys: dict[str, str | None], timeout: float = 45.0,
                 max_retries: int = 1, requests_per_minute: float = 0):
        from langchain_core.rate_limiters import InMemoryRateLimiter

        models = list(dict.fromkeys(m for m in models if keys.get(split_model(m)[0])))
        if not models:
            raise ValueError("No chat model has an API key. Set GOOGLE_API_KEY or GROQ_API_KEY.")
        # one limiter per model, shared by classify, answer and grade: free-tier limits are per model
        limiters = {m: InMemoryRateLimiter(requests_per_second=requests_per_minute / 60,
                                           check_every_n_seconds=0.1, max_bucket_size=1)
                    for m in models} if requests_per_minute else {}

        def chain(temperature: float, schema=None):
            runs = []
            for m in models:
                llm = make_chat(m, keys, temperature=temperature, timeout=timeout, max_retries=max_retries,
                                rate_limiter=limiters.get(m))
                if schema:
                    # Groq's models reject LangChain's default tool-call method for structured output
                    # (measured 23 Nov 2026); its JSON-schema mode works for every chat model it serves.
                    method = "json_schema" if split_model(m)[0] == "groq" else None
                    llm = llm.with_structured_output(schema, method=method) if method else llm.with_structured_output(schema)
                runs.append(llm)
            return runs[0].with_fallbacks(runs[1:]) if len(runs) > 1 else runs[0]

        self.models = models
        self.llm = chain(0.2)
        self._route = chain(0, Route)
        self._grade = chain(0, Grade)

    @classmethod
    def from_settings(cls, s, first: str | None = None, **overrides) -> "ChatBrain":
        """`first` puts one model at the front (the student's choice); the rest stay as fallbacks."""
        models = s.available_models()
        if first:
            models = [first, *[m for m in models if m != first]]
        kw = dict(timeout=s.llm_timeout, max_retries=s.llm_max_retries, requests_per_minute=s.llm_requests_per_minute)
        kw.update(overrides)
        return cls(models, s.api_keys(), **kw)


    async def classify(self, question: str) -> Route:
        return await self._route.ainvoke(prompts.CLASSIFY.format(question=question))

    async def answer(self, question: str, intent: str, evidence: str, tutor: str, language: str = "java") -> str:
        msg = await self.llm.ainvoke(prompts.ANSWER.format(
            question=question, intent=intent, evidence=evidence, tutor=tutor, language=language))
        return _text(msg.content)

    async def grade(self, question: str, draft: str, evidence: str) -> Grade:
        return await self._grade.ainvoke(prompts.GRADE.format(question=question, draft=draft, evidence=evidence))


# Some models write non-breaking or figure hyphens (U+2011 in "10G-33L"); students copy room codes and code.
_HYPHENS = str.maketrans({chr(0x2010): "-", chr(0x2011): "-", chr(0x2012): "-", chr(0xA0): " ", chr(0x202F): " "})


def _text(content) -> str:
    if not isinstance(content, str):
        # Gemini can return a list of content blocks
        content = "".join(b.get("text", "") if isinstance(b, dict) else str(b) for b in content)
    return content.translate(_HYPHENS).strip()


GeminiBrain = ChatBrain  # older name, kept for callers and docs
