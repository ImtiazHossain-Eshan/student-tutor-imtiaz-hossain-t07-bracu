"""Turn course files into Sections: one per PDF page, slide, notebook heading, document or source file.

Supported: .pdf, .pptx, .docx, .ipynb, .md, .txt, .java, .py. Anything else is reported and skipped.
"""
from __future__ import annotations

import json
import logging
import re
from collections.abc import Iterator
from dataclasses import replace
from pathlib import Path

from tutor_agent.documents import Kind, Language, Section

log = logging.getLogger(__name__)

TEXT_SUFFIXES = {".md", ".txt"}
CODE_SUFFIXES = {".java": "java", ".py": "python"}
SUPPORTED = {".pdf", ".pptx", ".docx", ".ipynb"} | TEXT_SUFFIXES | set(CODE_SUFFIXES)
HEADING = re.compile(r"^\s*(#{1,3})\s+(.+)")


def _clean(text: str) -> str:
    text = text.replace("\x00", " ").replace("\r", "")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _in_fence(lines: list[str]) -> bool:
    return sum(1 for ln in lines if ln.strip().startswith("```")) % 2 == 1


_SEPARATOR = re.compile(r"^[=\-_*~.]{3,}$")
_LINE_END = (".", ":", "!", "?", ";")


def _reflow_fragmented(text: str) -> str:
    """Some PDFs (Word exports, some slide decks) extract one word per line. Join the words
    back into lines, breaking after sentence ends, colons and ===== separators. Pages that
    already extract as normal lines are returned unchanged."""
    lines = [ln.strip() for ln in text.splitlines()]
    filled = [ln for ln in lines if ln]
    if len(filled) < 15 or sum(len(ln.split()) == 1 for ln in filled) / len(filled) < 0.6:
        return text
    out: list[str] = []
    cur: list[str] = []

    def flush():
        if cur:
            out.append(" ".join(cur))
            cur.clear()

    for ln in lines:
        if not ln:
            flush()
            if out and out[-1]:
                out.append("")
        elif _SEPARATOR.match(ln):
            flush()
            out.append(ln)
        else:
            cur.append(ln)
            if ln.endswith(_LINE_END):
                flush()
    flush()
    return re.sub(r" ([.,;:!?)])", r"\1", "\n".join(out))


def load_pdf(path: Path, rel: str, kind: Kind) -> Iterator[Section]:
    from pypdf import PdfReader

    for i, page in enumerate(PdfReader(str(path)).pages, start=1):
        text = _clean(_reflow_fragmented(page.extract_text() or ""))
        if text:
            yield Section(text=text, source=rel, kind=kind, location=f"page {i}", title=path.stem)


def load_pptx(path: Path, rel: str, kind: Kind) -> Iterator[Section]:
    from pptx import Presentation

    for i, slide in enumerate(Presentation(str(path)).slides, start=1):
        parts = []
        for shape in slide.shapes:
            if shape.has_text_frame:
                parts.append(shape.text_frame.text)
            if getattr(shape, "has_table", False) and shape.has_table:
                for row in shape.table.rows:
                    parts.append(" | ".join(cell.text for cell in row.cells))
        if slide.has_notes_slide and slide.notes_slide.notes_text_frame is not None:
            notes = slide.notes_slide.notes_text_frame.text.strip()
            if notes:
                parts.append(f"Notes: {notes}")
        text = _clean("\n".join(parts))
        if text:
            yield Section(text=text, source=rel, kind=kind, location=f"slide {i}", title=path.stem)


def load_docx(path: Path, rel: str, kind: Kind) -> Iterator[Section]:
    import docx

    d = docx.Document(str(path))
    parts = [p.text for p in d.paragraphs]
    for table in d.tables:
        for row in table.rows:
            parts.append(" | ".join(cell.text for cell in row.cells))
    text = _clean("\n".join(parts))
    if text:
        yield Section(text=text, source=rel, kind=kind, title=path.stem)


def load_text(path: Path, rel: str, kind: Kind) -> Iterator[Section]:
    text = _clean(path.read_text(encoding="utf-8", errors="replace"))
    if not text:
        return
    if path.suffix.lower() != ".md":
        yield Section(text=text, source=rel, kind=kind, title=path.stem)
        return
    # Markdown: one section per heading, so citations can say which part of the notes.
    doc_title = path.stem
    heading, buf = "", []
    for line in text.split("\n"):
        m = HEADING.match(line)
        if m and not _in_fence(buf):
            if len(m.group(1)) == 1:
                doc_title = m.group(2).strip()
            if "\n".join(buf).strip():
                yield Section(text="\n".join(buf).strip(), source=rel, kind=kind, location=heading, title=doc_title)
            heading, buf = m.group(2).strip(), [line]
        else:
            buf.append(line)
    if "\n".join(buf).strip():
        yield Section(text="\n".join(buf).strip(), source=rel, kind=kind, location=heading, title=doc_title)


def load_code(path: Path, rel: str, kind: Kind) -> Iterator[Section]:
    code = path.read_text(encoding="utf-8", errors="replace").replace("\r", "").rstrip()
    if code:
        # Fenced, so the chunker keeps code intact and the model sees it as code.
        lang = CODE_SUFFIXES[path.suffix.lower()]
        yield Section(text=f"```{lang}\n{code}\n```", source=rel, kind=kind, title=path.stem)


def load_ipynb(path: Path, rel: str, kind: Kind) -> Iterator[Section]:
    """Markdown and code cells in order, outputs dropped; one section per markdown heading."""
    nb = json.loads(path.read_text(encoding="utf-8", errors="replace"))
    lang = (nb.get("metadata", {}).get("language_info") or {}).get("name") or "python"
    heading, buf = "", []

    def flush() -> Section | None:
        text = _clean("\n\n".join(buf))
        return Section(text=text, source=rel, kind=kind, location=heading, title=path.stem) if text else None

    for cell in nb.get("cells", []):
        src = "".join(cell.get("source", []))
        if not src.strip():
            continue
        if cell.get("cell_type") == "markdown":
            m = HEADING.match(src)
            if m:
                sec = flush()
                if sec:
                    yield sec
                heading, buf = m.group(2).strip().splitlines()[0][:80], []
            buf.append(src)
        elif cell.get("cell_type") == "code":
            buf.append(f"```{lang}\n{src.rstrip()}\n```")
    sec = flush()
    if sec:
        yield sec


LOADERS = {".pdf": load_pdf, ".pptx": load_pptx, ".docx": load_docx, ".ipynb": load_ipynb}
LOADERS.update({s: load_text for s in TEXT_SUFFIXES})
LOADERS.update({s: load_code for s in CODE_SUFFIXES})


def load_folder(folder: Path, kind: Kind, language: Language = "java") -> list[Section]:
    """Load every supported file under `folder`, sorted by path so builds are reproducible."""
    sections: list[Section] = []
    if not folder.exists():
        return sections
    for path in sorted(p for p in folder.rglob("*") if p.is_file()):
        if path.name.startswith((".", "~$")):
            continue
        loader = LOADERS.get(path.suffix.lower())
        if loader is None:
            log.warning("skipped unsupported file: %s", path)
            continue
        rel = path.relative_to(folder).as_posix()
        try:
            sections.extend(replace(sec, language=language) for sec in loader(path, rel, kind))
        except Exception as exc:  # a broken file should not stop the build
            log.warning("could not read %s: %s", path, exc)
    return sections
