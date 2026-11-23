from __future__ import annotations

import pytest

from tutor_agent.agent.brain import Grade, Route


class FakeBrain:
    """Scripted model: routes, answers and grades exactly as a test tells it to."""

    def __init__(self, route: Route, answers: list[str], grades: list[Grade] | None = None):
        self.route = route
        self.answers = list(answers)
        self.grades = list(grades or [])
        self.calls: list[str] = []

    async def classify(self, question: str) -> Route:
        self.calls.append("classify")
        return self.route

    async def answer(self, question: str, intent: str, evidence: str, tutor: str, language: str = "java") -> str:
        self.calls.append("answer")
        self.last_evidence = evidence
        return self.answers.pop(0) if self.answers else "fallback [1]"

    async def grade(self, question: str, draft: str, evidence: str) -> Grade:
        self.calls.append("grade")
        return self.grades.pop(0) if self.grades else Grade(grounded=True)


class FakeTools:
    def __init__(self, passages: list[dict] | None = None, slots: list[dict] | None = None):
        self.passages = passages if passages is not None else [
            {"id": "a", "source": "05_arrays.md", "location": "ArrayIndexOutOfBoundsException", "kind": "theory",
             "title": "Arrays", "text": "Indices run from 0 to length - 1.", "score": 0.03}
        ]
        self.slots = slots if slots is not None else [
            {"day": "Saturday", "time": "12:30 PM", "activity": "Offline consultation", "location": "10G-33L", "type": "offline"}
        ]
        self.searches: list[tuple[str, str]] = []
        self.languages: list[str] = []

    async def search(self, query: str, scope: str = "all", k: int = 5, language: str = "any") -> list[dict]:
        self.searches.append((query, scope))
        self.languages.append(language)
        if language == "any":
            return self.passages
        return [p for p in self.passages if p.get("language", "java") in (language, "any")]

    async def hours(self, day: str | None = None) -> dict:
        return {"tutor": "Imtiaz Hossain (T07)", "term": "Fall 2026", "slots": self.slots}


@pytest.fixture
def concept_route() -> Route:
    return Route(intent="concept", search_query="array index out of bounds", scope="theory")
