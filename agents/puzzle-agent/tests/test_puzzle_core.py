"""Every rule the model is not allowed to decide, driven by a fake model."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

AGENT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AGENT_DIR))

from puzzle_core import (  # noqa: E402
    MAX_ATTEMPTS,
    check_schema,
    generate_puzzle,
    is_duplicate,
    similarity,
)


def puzzle(text: str = "Liisalla on 3 omenaa ja han saa 4 lisaa. Montako?", answer: int = 7):
    return {"text": text, "answer": answer}


class FakeWriter:
    """A model that returns scripted payloads and counts its calls."""

    def __init__(self, *payloads):
        self.payloads = list(payloads)
        self.calls = 0

    def __call__(self, avoid=None):
        self.calls += 1
        index = min(self.calls - 1, len(self.payloads) - 1)
        return self.payloads[index]


def solver_returning(*answers):
    """A second model that solves the text alone. Never sees the answer."""
    seen = {"calls": 0, "texts": []}

    def solve(text: str):
        seen["texts"].append(text)
        index = min(seen["calls"], len(answers) - 1)
        seen["calls"] += 1
        return answers[index]

    solve.seen = seen
    return solve


# --- schema -----------------------------------------------------------------


def test_schema_accepts_a_well_formed_puzzle():
    assert check_schema(puzzle()).ok


@pytest.mark.parametrize(
    "payload",
    [
        {"text": "", "answer": 7},
        {"text": "   ", "answer": 7},
        {"text": "Kysymys?"},
        {"answer": 7},
        {"text": 7, "answer": 7},
        {"text": "Kysymys?", "answer": "7"},
        {"text": "Kysymys?", "answer": 7.5},
        {"text": "Kysymys?", "answer": True},
        {"text": "Kysymys?", "answer": -1},
        {"text": "Kysymys?", "answer": 1000000},
        "not a dict",
        None,
    ],
)
def test_schema_rejects_everything_else(payload):
    assert not check_schema(payload).ok


def test_schema_accepts_the_boundaries_of_one_to_six_digits():
    assert check_schema(puzzle(answer=0)).ok
    assert check_schema(puzzle(answer=999999)).ok


# --- duplicates --------------------------------------------------------------


def test_similarity_is_one_for_the_same_text():
    assert similarity("Liisalla on 3 omenaa", "Liisalla on 3 omenaa") == 1.0


def test_a_reworded_repeat_is_a_duplicate():
    earlier = ["Liisalla on 3 omenaa ja han saa 4 lisaa. Montako omenaa?"]
    assert is_duplicate("Liisalla on 3 omenaa ja han saa 4 lisaa. Montako?", earlier)


def test_a_different_puzzle_is_not_a_duplicate():
    earlier = ["Liisalla on 3 omenaa ja han saa 4 lisaa. Montako omenaa?"]
    assert not is_duplicate("Juna kulkee 60 km tunnissa. Matka kestaa 2 tuntia.", earlier)


# --- the loop ----------------------------------------------------------------


def test_a_good_puzzle_is_returned_on_the_first_attempt():
    writer = FakeWriter(puzzle())
    result = generate_puzzle(writer, solver_returning(7), previous=[])

    assert result.ok
    assert result.puzzle == {"text": puzzle()["text"], "answer": 7}
    assert writer.calls == 1


def test_the_solver_is_given_the_text_alone():
    solver = solver_returning(7)
    generate_puzzle(FakeWriter(puzzle()), solver, previous=[])

    assert solver.seen["texts"] == [puzzle()["text"]]


def test_a_puzzle_the_solver_disagrees_with_is_rejected():
    writer = FakeWriter(puzzle(answer=7))
    result = generate_puzzle(writer, solver_returning(8, 8, 8), previous=[])

    assert not result.ok
    assert "solve-back" in result.reason
    assert writer.calls == MAX_ATTEMPTS


def test_a_bad_puzzle_then_a_good_one_costs_one_retry():
    writer = FakeWriter({"text": "", "answer": 7}, puzzle())
    result = generate_puzzle(writer, solver_returning(7), previous=[])

    assert result.ok
    assert writer.calls == 2
    assert result.attempts == 2


def test_a_duplicate_is_rejected_and_reported():
    result = generate_puzzle(
        FakeWriter(puzzle()), solver_returning(7), previous=[puzzle()["text"]]
    )

    assert not result.ok
    assert "duplicate" in result.reason


def test_three_failures_refuse_rather_than_invent():
    writer = FakeWriter({"text": "", "answer": 7})
    result = generate_puzzle(writer, solver_returning(7), previous=[])

    assert not result.ok
    assert result.puzzle is None
    assert writer.calls == MAX_ATTEMPTS
    assert result.reason


def test_a_writer_that_raises_is_a_refusal_not_a_crash():
    def exploding(avoid=None):
        raise TimeoutError("model timed out")

    result = generate_puzzle(exploding, solver_returning(7), previous=[])

    assert not result.ok
    assert "model timed out" in result.reason


def test_a_solver_that_raises_is_a_refusal_not_a_pass():
    def exploding(text):
        raise TimeoutError("solver timed out")

    result = generate_puzzle(FakeWriter(puzzle()), exploding, previous=[])

    assert not result.ok
    assert result.puzzle is None


def test_ten_consecutive_puzzles_pass_every_check():
    """The goal of this build: ten in a row, schema, solve-back and duplicate."""
    # Ten genuinely different puzzles. An earlier version of this fixture
    # varied only two numbers in one sentence, and the duplicate check
    # rejected the second one — correctly. The rule bites, so the fixture has
    # to be what the goal actually asks for.
    drawn = [
        {"text": "Liisalla on 12 euroa. Han ostaa kirjan 7 eurolla. Paljonko jaa?", "answer": 5},
        {"text": "Juna kulkee 60 kilometria tunnissa. Montako kilometria se kulkee kolmessa tunnissa?", "answer": 180},
        {"text": "Aiti on nyt 32 ja tytar 8. Kuinka vanha aiti on kun tytar tayttaa 20?", "answer": 44},
        {"text": "Takin hinta on 80 euroa ja siita annetaan 25 prosentin alennus. Mika on uusi hinta?", "answer": 60},
        {"text": "Sarjassa 2, 4, 8, 16 mika luku seuraa?", "answer": 32},
        {"text": "Pihalla on kanoja ja lampaita, yhteensa 7 paata ja 20 jalkaa. Montako lammasta?", "answer": 3},
        {"text": "Kolme ystavaa jakaa 24 karkkia tasan. Montako kukin saa?", "answer": 8},
        {"text": "Suorakulmion sivut ovat 9 ja 4 metria. Mika on sen pinta-ala neliometreina?", "answer": 36},
        {"text": "Kello on 14 ja elokuva alkaa 150 minuutin kuluttua. Monelta tunnilta se alkaa?", "answer": 16},
        {"text": "Pullo ja korkki maksavat yhteensa 110 senttia. Pullo maksaa 100 senttia enemman kuin korkki. Paljonko korkki maksaa?", "answer": 5},
    ]
    writer = FakeWriter(*drawn)
    solver = solver_returning(*[p["answer"] for p in drawn])

    previous: list[str] = []
    for expected in drawn:
        result = generate_puzzle(writer, solver, previous=previous)

        assert result.ok, result.reason
        assert result.puzzle == expected
        previous.append(result.puzzle["text"])

    assert len(previous) == 10
    assert writer.calls == 10
