"""The measuring tool, measured: offline, fake models, a temp store and file."""

from __future__ import annotations

import sys
from pathlib import Path

AGENT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AGENT_DIR))

from eval.run_eval import main, recorders  # noqa: E402
from memory.memory import MemoryStore  # noqa: E402

PUZZLES = [
    {"text": "Liisalla on 12 euroa. Han ostaa kirjan 7 eurolla. Paljonko jaa?", "answer": 5},
    {"text": "Sarjassa 2, 4, 8, 16 mika luku seuraa?", "answer": 32},
    {"text": "Suorakulmion sivut ovat 9 ja 4 metria. Mika on pinta-ala?", "answer": 36},
]


def test_each_solver_answer_is_paired_with_the_attempt_it_solved():
    """AC20: a failed writer attempt makes no solver call and shifts nothing."""
    failure = TimeoutError("writer timed out")
    drafts = iter([failure, PUZZLES[0]])

    def write(avoid=None):
        draft = next(drafts)
        if isinstance(draft, Exception):
            raise draft
        return draft

    writer, solver, attempts = recorders(write, lambda text: 7)

    try:
        writer()
    except TimeoutError:
        pass
    solver(writer()["text"])

    first, second = attempts()
    assert first["payload"] is failure
    assert "solved" not in first
    assert second["payload"] == PUZZLES[0]
    assert second["solved"] == 7


def test_the_eval_waits_between_requests_and_not_before_the_first(tmp_path):
    """AC21: a delay keeps a run inside a per-minute quota."""
    drafts = iter(PUZZLES)
    answers = {puzzle["text"]: puzzle["answer"] for puzzle in PUZZLES}
    slept = []

    main(
        ["3", "--delay", "5"],
        write=lambda avoid=None: next(drafts),
        solve=lambda text: answers[text],
        store=MemoryStore(data_dir=tmp_path / "data"),
        out=tmp_path / "eval.md",
        sleep=slept.append,
    )

    assert slept == [5, 5]
