"""The unit everything else passes around: a chunk of course material with its provenance."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Literal

Kind = Literal["theory", "lab", "logistics"]
# "any" is for material that is not language-specific (the ST routine and FAQ).
Language = Literal["java", "python", "any"]


@dataclass(frozen=True)
class Section:
    """One loader output: a page, slide, file or record, before chunking."""

    text: str
    source: str  # file name relative to its kind folder, e.g. "Lecture 04 - Loops.pdf"
    kind: Kind
    location: str = ""  # "page 3", "slide 7", "lines 1-40", "FAQ"
    title: str = ""
    language: Language = "java"


@dataclass(frozen=True)
class Chunk:
    id: str
    text: str
    source: str
    kind: Kind
    location: str = ""
    title: str = ""
    language: Language = "java"
    meta: dict = field(default_factory=dict)

    def citation(self) -> str:
        where = f", {self.location}" if self.location else ""
        return f"{self.source}{where}"

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "Chunk":
        return cls(**d)
