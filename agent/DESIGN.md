# Design: CSE110 Tutor web chat

Recorded from the built page, `src/tutor_agent/web/static/index.html`. The user first chose the Pipeline Inspector, tried six palettes, then asked for the Paper (light) palette in a simple chat layout like ChatGPT or Claude. The inspector version was replaced.

## Idea

A plain, familiar chat. The tutor's differences (sources for every answer, honesty when the material does not cover a question) stay visible but quiet: a small sources list and an optional "Show steps".

## Color (Paper, light)

| Token | Value | Role |
|---|---|---|
| `--bg` | `#f5f5f2` | Page |
| `--bubble` | `#e8e8e3` | The student's messages, inline code, hover |
| `--field` | `#ffffff` | The question box |
| `--seam` / `--seam-2` | `#dcdcd5` / `#c6c6bf` | Borders, scrollbar |
| `--text` / `--text-2` / `--text-3` | `#16181d` / `#4a4e5c` / `#6a6f7d` | Text levels |
| `--accent` | `#2f55d4` | Citation numbers and focus only |
| `--well` | `#ffffff` | Code blocks |

## Type

Atkinson Hyperlegible Next for all text (legibility for students reading code-heavy answers); Atkinson Hyperlegible Mono for code, citation numbers and step timings. Body 16px / 1.65, answers 1.7.

## Layout

- Header: "CSE110 Tutor" and **New chat**.
- Empty state: a centered greeting, the question box, four example questions as pills.
- After the first question: a 720px conversation column; the student's message in a grey bubble on the right, the answer as plain text; the question box docks at the bottom with a one-line note that answers come only from the course material.

## Model menu

Next to the product name: a button with the current model's friendly name and a chevron. It opens a 320px white card (16px radius, seam border, soft shadow) grouped by provider ("Groq", "Google Gemini"). Each row shows the model name, an optional small tag ("Fast"), a one-line note on what to expect, and a blue check on the current model. Keyboard: arrow keys move, Enter picks, Esc closes and returns focus to the button. The choice is remembered per browser. The menu hides itself when only one model is available.

## Answer anatomy

1. The answer as structured content: a one-sentence opener, bullets with bold key terms, a table for comparisons, and a short code example when the material supports one. Citation numbers are hidden on screen (the grader still uses them).
2. Follow-up buttons ("Show me a code example", "Explain it more simply", "What are common mistakes?"; for hints, "Give me another hint", "What should I try first?").
3. **Show steps · 1.9 s**, collapsed: the graph nodes, their timings, and the sources.

Code blocks follow VS Code's dark editor: a #2d2d2d header with the language (dot colored for Python or Java) and a Copy button, a #1e1e1e body highlighted by highlight.js with its `vs2015` theme.

While the agent works, three dots and a plain status ("Searching the course material…") stand in for the answer. Then the draft streams in word by word with a blinking block caret, followed by a small "Checking it against the course material…" line with a spinner while the grader runs. If the check passes, the text stays (no second fade-in); if it fails, it is replaced by the retry or the "not in the material" reply. The answer model's internal `NOT_IN_MATERIAL` signal is never shown.

## Follow-ups

The page sends the previous question with each new one, so "give me an example of that" works. Only the question is carried over, never the earlier answer; every answer is grounded in fresh retrieval.

## Rules

- No badges, panels, or dashboards on the main view.
- The accent appears only on citations and focus.
- Motion: a short fade-in for new messages; nothing under `prefers-reduced-motion`.
