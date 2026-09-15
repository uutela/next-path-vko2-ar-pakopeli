"""The whole agent, offline: no network, no API key, fake models."""

from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

import pytest

AGENT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AGENT_DIR))

from memory.memory import MemoryStore  # noqa: E402
from puzzle_agent import draw  # noqa: E402

TEN = [
    {"text": "Liisalla on 12 euroa. Han ostaa kirjan 7 eurolla. Paljonko jaa?", "answer": 5},
    {"text": "Juna kulkee 60 kilometria tunnissa. Montako kilometria kolmessa tunnissa?", "answer": 180},
    {"text": "Aiti on nyt 32 ja tytar 8. Kuinka vanha aiti on kun tytar tayttaa 20?", "answer": 44},
    {"text": "Takin hinta on 80 euroa ja alennus 25 prosenttia. Mika on uusi hinta?", "answer": 60},
    {"text": "Sarjassa 2, 4, 8, 16 mika luku seuraa?", "answer": 32},
    {"text": "Pihalla on 7 paata ja 20 jalkaa, kanoja ja lampaita. Montako lammasta?", "answer": 3},
    {"text": "Kolme ystavaa jakaa 24 karkkia tasan. Montako kukin saa?", "answer": 8},
    {"text": "Suorakulmion sivut ovat 9 ja 4 metria. Mika on pinta-ala?", "answer": 36},
    {"text": "Kello on 14 ja elokuva alkaa 150 minuutin kuluttua. Monelta se alkaa?", "answer": 16},
    {"text": "Pullo ja korkki maksavat 110 senttia. Pullo maksaa 100 senttia enemman. Korkki?", "answer": 5},
]


@pytest.fixture
def store(tmp_path):
    """A memory store in a temp folder: the agent writes nothing outside it."""
    return MemoryStore(data_dir=tmp_path / "data")


def scripted(puzzles):
    """A writer that hands out the list in order, and a solver that agrees."""
    state = {"index": 0}

    def writer(avoid=None):
        payload = puzzles[min(state["index"], len(puzzles) - 1)]
        state["index"] += 1
        return payload

    def solver(text):
        for payload in puzzles:
            if payload["text"] == text:
                return payload["answer"]
        raise AssertionError(f"solver was given a text no writer produced: {text!r}")

    return writer, solver


def test_ten_consecutive_puzzles_pass_every_check(store):
    """The goal of this build, driven through the agent rather than the core."""
    writer, solver = scripted(TEN)

    for expected in TEN:
        result = draw(writer=writer, solver=solver, store=store)

        assert result["ok"], result.get("reason")
        assert result["puzzle"] == expected

    assert len(store.list_puzzles()) == 10
    assert len({record["text"] for record in store.list_puzzles()}) == 10


def test_memory_makes_the_eleventh_a_duplicate(store):
    """A repeat of the first puzzle is refused, because memory remembers it."""
    writer, solver = scripted(TEN)
    draw(writer=writer, solver=solver, store=store)

    repeat, repeat_solver = scripted([TEN[0]])
    result = draw(writer=repeat, solver=repeat_solver, store=store)

    assert not result["ok"]
    assert "duplicate" in result["reason"]
    assert len(store.list_puzzles()) == 1


def test_no_api_key_is_a_visible_refusal_not_an_invented_puzzle(store, monkeypatch):
    """With no key the real writer raises, and that is what the player is told.

    The key is forced absent at the function that reads it, not by deleting
    environment variables. Deleting them does not work and quietly does the
    opposite: `load_agent_environment()` runs when the subagent is imported,
    which happens *after* the deletion, and loads `.env.local` from a parent
    directory — so an earlier version of this test made a real network call
    with a real key and passed for the wrong reason until the model answered
    404.
    """
    import subagents.puzzle_writer as writer_module

    monkeypatch.setattr(writer_module, "api_key", lambda: None)

    def solver(text):
        raise AssertionError("the solver must never be reached without a puzzle")

    result = draw(writer=writer_module.write_puzzle, solver=solver, store=store)

    assert not result["ok"]
    assert "no Gemini API key" in result["reason"]
    assert result.get("puzzle") is None
    assert store.list_puzzles() == []


def test_the_solver_also_refuses_without_a_key(store, monkeypatch):
    import subagents.puzzle_solver as solver_module

    monkeypatch.setattr(solver_module, "api_key", lambda: None)

    result = draw(writer=lambda avoid=None: TEN[0], solver=solver_module.solve, store=store)

    assert not result["ok"]
    assert "no Gemini API key" in result["reason"]
    assert store.list_puzzles() == []


def test_nothing_in_the_offline_suite_opens_a_socket(monkeypatch):
    """A guard, not a formality: this suite went online once already."""
    import socket

    def refuse(*args, **kwargs):
        raise AssertionError("an offline test tried to open a network connection")

    monkeypatch.setattr(socket.socket, "connect", refuse)
    monkeypatch.setattr(socket, "create_connection", refuse)

    writer, solver = scripted(TEN)
    store = MemoryStore(data_dir=Path(tempfile.mkdtemp()) / "data")
    result = draw(writer=writer, solver=solver, store=store)

    assert result["ok"]


def test_a_refusal_is_never_written_to_memory(store):
    def writer(avoid=None):
        return {"text": "", "answer": 7}

    result = draw(writer=writer, solver=lambda text: 7, store=store)

    assert not result["ok"]
    assert store.list_puzzles() == []


def test_the_writer_is_told_what_to_avoid(store):
    seen = []

    def writer(avoid=None):
        seen.append(list(avoid or []))
        return TEN[len(seen) - 1]

    def solver(text):
        return next(p["answer"] for p in TEN if p["text"] == text)

    draw(writer=writer, solver=solver, store=store)
    draw(writer=writer, solver=solver, store=store)

    assert seen[0] == []
    assert seen[1] == [TEN[0]["text"]]


def test_memory_survives_a_corrupt_store(tmp_path):
    data_dir = tmp_path / "data"
    data_dir.mkdir(parents=True)
    (data_dir / "issued_puzzles.json").write_text("not json", encoding="utf-8")

    assert MemoryStore(data_dir=data_dir).texts() == []


def test_the_result_is_json_serialisable(store):
    writer, solver = scripted(TEN)
    result = draw(writer=writer, solver=solver, store=store)

    assert json.loads(json.dumps(result, ensure_ascii=False)) == result
