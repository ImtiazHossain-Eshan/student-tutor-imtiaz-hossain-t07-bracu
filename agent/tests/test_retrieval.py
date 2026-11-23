from __future__ import annotations

from tutor_agent.documents import Chunk, Section
from tutor_agent.ingest.chunker import chunk_section
from tutor_agent.retrieval.hybrid import rrf
from tutor_agent.retrieval.lexical import LexicalIndex, tokenize


def test_tokenizer_splits_java_identifiers_and_keeps_them_whole():
    toks = tokenize("ArrayIndexOutOfBoundsException in getMaxValue")
    assert "arrayindexoutofboundsexception" in toks
    assert {"array", "index", "out", "bounds", "exception", "max", "value"} <= set(toks)
    assert "in" not in toks


def test_student_words_find_the_exception_name():
    chunks = [
        Chunk("1", "Accessing marks[5] throws ArrayIndexOutOfBoundsException.", "arrays.md", "theory"),
        Chunk("2", "A while loop repeats while its condition is true.", "loops.md", "theory"),
    ]
    hits = LexicalIndex(chunks).search("array index out of bounds")
    assert hits and hits[0][0] == 0


def test_scope_filter():
    chunks = [Chunk("1", "loops", "a.md", "theory"), Chunk("2", "loops task", "b.md", "lab")]
    assert [i for i, _ in LexicalIndex(chunks).search("loops", kinds={"lab"})] == [1]


def test_rrf_rewards_agreement():
    fused = rrf([[0, 1, 2], [2, 0, 3]])
    assert max(fused, key=fused.get) == 0  # ranked 1st and 2nd beats 3rd and 1st
    assert fused[3] < fused[2]


def test_chunker_keeps_code_blocks_whole_and_ids_stable():
    code = "```java\n" + "\n".join(f"int x{i} = {i};" for i in range(10)) + "\n```"
    text = ("Intro paragraph about loops. " * 30) + "\n\n" + code + "\n\n" + ("Closing words. " * 30)
    s = Section(text=text, source="loops.md", kind="theory")
    a, b = chunk_section(s, max_chars=600, overlap=80), chunk_section(s, max_chars=600, overlap=80)
    assert [c.id for c in a] == [c.id for c in b]
    assert any(code in c.text for c in a)
    assert all(c.text.count("```") % 2 == 0 for c in a)


def test_oversized_code_is_split_on_lines_and_refenced():
    code = "```java\n" + "\n".join(f"System.out.println({i});" for i in range(80)) + "\n```"
    pieces = chunk_section(Section(text=code, source="Big.java", kind="lab"), max_chars=400, overlap=0)
    assert len(pieces) > 1
    assert all(p.text.startswith("```java") and p.text.rstrip().endswith("```") for p in pieces)


def test_language_filter_keeps_language_neutral_logistics():
    chunks = [Chunk("1", "for loop syntax", "j.md", "theory", language="java"),
              Chunk("2", "for loop range", "p.pdf", "theory", language="python"),
              Chunk("3", "loop help in consultation", "FAQ", "logistics", language="any")]
    got = {i for i, _ in LexicalIndex(chunks).search("loop", languages={"java"})}
    assert got == {0, 2}


def test_notebook_loader_keeps_code_and_drops_outputs(tmp_path):
    import json

    from tutor_agent.ingest.loaders import load_folder

    nb = {"metadata": {"language_info": {"name": "python"}}, "cells": [
        {"cell_type": "markdown", "source": ["# Week 3: Iterations\n", "Loops repeat."]},
        {"cell_type": "code", "source": ["for i in range(3):\n", "    print(i)"], "outputs": [{"text": "0 1 2"}]},
    ]}
    (tmp_path / "w3.ipynb").write_text(json.dumps(nb), encoding="utf-8")
    [sec] = load_folder(tmp_path, "theory", "python")
    assert sec.language == "python" and sec.location == "Week 3: Iterations"
    assert "```python\nfor i in range(3):" in sec.text and "0 1 2" not in sec.text


def test_one_word_per_line_pdf_text_is_reflowed_but_normal_text_is_not():
    from tutor_agent.ingest.loaders import _reflow_fragmented

    fragmented = "\n".join("Write a function called even_checker that takes a number and prints it .".split()) \
        + "\n=====\nExample1:\nFunction\nCall:\neven_checker(5)"
    out = _reflow_fragmented(fragmented)
    assert out.splitlines()[0] == "Write a function called even_checker that takes a number and prints it."
    assert "=====" in out.splitlines() and "Function Call:" in out
    normal = "Arrays start at index 0.\nThe last index is length - 1.\n" * 10
    assert _reflow_fragmented(normal) == normal
