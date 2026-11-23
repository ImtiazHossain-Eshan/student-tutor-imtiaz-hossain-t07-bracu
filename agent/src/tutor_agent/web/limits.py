"""Usage limits for a public deployment.

A hosted tutor spends the owner's API quota on every question, so anyone on the internet must
not be able to drain it. Limits are kept in memory (one server process); a restart resets them,
which is acceptable for a free-tier course assistant.
"""
from __future__ import annotations

import time
from collections import defaultdict, deque


class Limits:
    def __init__(self, per_minute: int, per_day: int, global_per_day: int, clock=time.monotonic):
        self.per_minute, self.per_day, self.global_per_day = per_minute, per_day, global_per_day
        self.clock = clock
        self.hits: dict[str, deque[float]] = defaultdict(deque)
        self.all: deque[float] = deque()

    def check(self, client: str) -> str | None:
        """Record one question from `client`; return a message for the student if it is over a limit."""
        now = self.clock()
        day_ago = now - 86400
        hits = self.hits[client]
        while hits and hits[0] < day_ago:
            hits.popleft()
        while self.all and self.all[0] < day_ago:
            self.all.popleft()
        if self.global_per_day and len(self.all) >= self.global_per_day:
            return "The tutor has answered its daily limit of questions. Please try again tomorrow, or ask your ST."
        if self.per_day and len(hits) >= self.per_day:
            return "You have reached today's question limit. Please come back tomorrow, or bring it to a consultation."
        if self.per_minute and sum(1 for t in hits if t > now - 60) >= self.per_minute:
            return "That is a lot of questions in a minute. Please wait a moment and ask again."
        hits.append(now)
        self.all.append(now)
        return None


def client_ip(headers, peer: str | None, trust_proxy: bool) -> str:
    """The visitor's address. Behind a host's proxy (Render, etc.) it is the first X-Forwarded-For entry."""
    if trust_proxy:
        fwd = headers.get("x-forwarded-for", "")
        if fwd:
            return fwd.split(",")[0].strip()
    return peer or "unknown"
