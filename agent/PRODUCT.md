# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Python only: `tutor-web` starts a small local HTTP server inside the agent package and serves one static HTML page (no Node build). The ST website (`A:\ST_BRACU_T07\src`) is not modified.

## Users

- **CSE110 students** (BRAC University, first-year): ask about a course concept, get unstuck on a lab task, or find when to meet their Student Tutor. Often mid-lab or late in the evening, on a laptop or phone.
- **The Student Tutor, Imtiaz Hossain (T07)**, who built it: runs it locally to test it and to demonstrate to reviewers and interviewers how the agent works. For this audience the agent's route through the graph (guard, classify, retrieve, answer, grade, rewrite, finalize) is part of what is shown.

Both are served by one page: the student view by default, with the agent's trace available on demand.

## Product Purpose

A grounded teaching assistant for CSE110 that answers only from the course's own material, cites where every answer came from, gives hints instead of graded lab solutions, and says "not in the material" rather than guessing. Success: a student gets a correct, cited answer or an honest referral to a real consultation slot; a reviewer can see why the agent answered the way it did.

## Positioning

Unlike a general chatbot, every answer is tied to a numbered course source (file and page or slide), checked by a grader and a citation validator, and the agent declines when the course does not cover the question. It knows the tutor's real routine because it reads the same data as the ST website.

## Operating Context

- Runs locally (`tutor-web`), backed by the MCP course server and the hybrid index built by `tutor-ingest`.
- Free Gemini tier: answers take roughly 5 to 25 seconds; Google can return 503 "busy"; the agent then replies with a "try again" message and a consultation slot.
- Answers arrive whole, not streamed.

## Capabilities and Constraints

- Routes: concept, lab_help (hint-first), logistics (consultation hours), off_topic, guardrail (prompt injection refused before any model call).
- Every answer carries `sources` like `[2] Notes/Week 7 (Tuple _ Dictionary).ipynb, Access Values (earlier Python offering)` and a `trace` list.
- Course material is labelled java, python ("earlier Python offering") or any (logistics). CSE110 is taught in Java; current indexed material is the earlier Python offering.
- Single-turn: no conversation memory yet.

## Brand Commitments

- Name: CSE110 Tutor Agent, working for Student Tutor Imtiaz Hossain (T07), BRAC University.
- The user chose a visual identity of its own, separate from the ST website.

## Evidence on Hand

Real course files (git-ignored, BRAC University's material), the ST routine (`data/st/st_data.json`), and real eval results in `evals/results/`. No user testimonials or usage numbers exist; do not invent any.

## Product Principles

1. Grounded or silent: never present an answer the material does not support.
2. Teach, do not hand over graded work.
3. Show the source for every claim, in words a student can find in their own files.
4. Honest about the machine: when the service is busy or the answer is not in the course, say so plainly.
5. Explainable on demand: the route the agent took is visible without cluttering a student's answer.

## Accessibility & Inclusion

Students read answers that contain code; code must stay legible and copyable. Keyboard-only use must work (ask, read, open sources and trace).
