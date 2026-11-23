"""The Student Tutor's own data (routine, FAQ, announcements), exported from the ST website repo.

Run `node scripts/export_st_data.mjs <path to ST_BRACU_T07>` to refresh data/st/st_data.json.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from tutor_agent.config import get_settings
from tutor_agent.documents import Section

DAYS = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
STUDENT_FACING = {"offline", "online", "lab"}  # "class" slots are the tutor's own classes


@dataclass(frozen=True)
class Slot:
    day: str
    time: str
    activity: str
    location: str
    type: str
    notes: str = ""

    def describe(self) -> str:
        note = f" ({self.notes})" if self.notes else ""
        return f"{self.day} {self.time}: {self.activity} at {self.location}{note}"


@lru_cache(maxsize=4)
def load_st_data(path: Path | None = None) -> dict:
    path = path or get_settings().st_data_dir / "st_data.json"
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def consultation_slots(day: str | None = None, mode: str = "regular", data: dict | None = None) -> list[Slot]:
    data = data if data is not None else load_st_data()
    rows = data.get("RAMADAN_SCHEDULE" if mode == "ramadan" else "REGULAR_SCHEDULE", [])
    slots = [
        Slot(r["day"], r["time"], r["activity"], r["location"], r["type"], r.get("notes", ""))
        for r in rows
        if r.get("type") in STUDENT_FACING
    ]
    if day:
        wanted = day.strip().lower()
        slots = [s for s in slots if s.day.lower().startswith(wanted[:3])]
    return sorted(slots, key=lambda s: DAYS.index(s.day) if s.day in DAYS else 99)


def tutor_info(data: dict | None = None) -> dict:
    data = data if data is not None else load_st_data()
    return data.get("TUTOR_INFO", {})


def st_sections(data: dict | None = None) -> list[Section]:
    """FAQ, announcements and the tutor profile as searchable logistics text."""
    data = data if data is not None else load_st_data()
    out: list[Section] = []
    for f in data.get("FAQ_ITEMS", []):
        out.append(Section(text=f"Q: {f['question']}\nA: {f['answer']}", source="ST website FAQ",
                           kind="logistics", location=f.get("category", ""), title=f["question"], language="any"))
    for a in data.get("INITIAL_ANNOUNCEMENTS", []):
        out.append(Section(text=f"{a['title']} ({a['date']}): {a['description']}", source="ST website announcements",
                           kind="logistics", location=a.get("category", ""), title=a["title"], language="any"))
    info = tutor_info(data)
    if info:
        text = (
            f"Student Tutor: {info.get('name')} ({info.get('initial')}), {info.get('course')}, {info.get('term')} "
            f"({info.get('termPeriod')}). Offline consultation room {info.get('offlineRoom')}, lab room "
            f"{info.get('labRoom')}, online on the {info.get('onlinePlatform')}. Email {info.get('email')}."
        )
        out.append(Section(text=text, source="ST website profile", kind="logistics", title="Student Tutor profile", language="any"))
    return out
