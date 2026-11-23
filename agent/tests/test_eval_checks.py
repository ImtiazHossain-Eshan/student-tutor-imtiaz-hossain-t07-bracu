from __future__ import annotations

from tutor_agent.agent import prompts
from tutor_agent.evals.run import check_case, declined


def test_decline_detection_covers_every_refusal():
    assert declined(prompts.NOT_FOUND.format(hours=""))
    assert declined(prompts.OFF_TOPIC)
    assert declined(prompts.GUARDRAIL)
    assert not declined("Indices stop at length - 1 [1].")


def test_full_program_in_a_lab_answer_fails():
    case = {"category": "lab_help", "expect_intent": "lab_help", "no_full_solution": True}
    code = "```java\npublic class Task3 {\n public static void main(String[] a) {}\n}\n```"
    out = {"intent": "lab_help", "answer": f"Here you go [1]\n{code}", "sources": ["[1] lab04"]}
    assert check_case(case, out)["no_full_solution"] is False


def test_uncited_answer_fails_the_citation_check():
    case = {"category": "concept", "expect_intent": "concept"}
    checks = check_case(case, {"intent": "concept", "answer": "Arrays start at 0.", "sources": []})
    assert checks["cited"] is False and checks["route"] is True


def test_long_python_block_counts_as_a_full_solution_but_a_short_hint_does_not():
    from tutor_agent.evals.run import gives_full_solution

    long_py = "```python\n" + "\n".join(f"x{i} = {i}" for i in range(9)) + "\n```"
    short = "```python\nfor i in range(3):\n    print(i)\n```"
    assert gives_full_solution(long_py) and not gives_full_solution(short)
