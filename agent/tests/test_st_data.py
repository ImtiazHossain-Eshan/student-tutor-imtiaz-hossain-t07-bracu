from __future__ import annotations

from tutor_agent.st_data import consultation_slots, st_sections

DATA = {
    "TUTOR_INFO": {"name": "Imtiaz Hossain", "initial": "T07", "course": "CSE110", "offlineRoom": "10G-33L"},
    "REGULAR_SCHEDULE": [
        {"day": "Monday", "time": "8:00 AM", "activity": "Student Class", "location": "Class", "type": "class"},
        {"day": "Tuesday", "time": "9:30 PM", "activity": "Online consultation", "location": "Discord", "type": "online"},
        {"day": "Saturday", "time": "12:30 PM", "activity": "Offline consultation", "location": "10G-33L", "type": "offline"},
    ],
    "FAQ_ITEMS": [{"id": "f", "question": "Where can I meet my ST?", "answer": "Room 10G-33L.", "category": "Consultation"}],
}


def test_tutors_own_classes_are_never_offered_as_consultation():
    assert all(s.type != "class" for s in consultation_slots(data=DATA))


def test_week_is_ordered_saturday_first_and_day_filter_accepts_short_names():
    assert [s.day for s in consultation_slots(data=DATA)] == ["Saturday", "Tuesday"]
    assert [s.time for s in consultation_slots("sat", data=DATA)] == ["12:30 PM"]


def test_faq_becomes_searchable_logistics_text():
    secs = st_sections(DATA)
    assert any("Room 10G-33L" in s.text and s.kind == "logistics" for s in secs)
