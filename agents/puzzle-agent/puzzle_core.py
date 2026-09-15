"""Deterministic puzzle rules for puzzle-agent.

Every decision about whether a puzzle is usable lives here, in tested Python.
The model writes Finnish and solves a text; it never decides whether an answer
is valid, whether a puzzle repeats an earlier one, or whether to give up.

See agents/AGENTS.md ("the model must not invent totals") and
specs/features/puzzle-agent.md.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional

#: Attempts per request, and then a refusal. Never a fourth call.
MAX_ATTEMPTS = 3

#: The keypad in the game takes at most six digits, and six is a maximum:
#: a shorter answer is a valid answer. Matches `validating()` in
#: src/adapters/puzzleSource.ts, which refuses anything else at the boundary.
MIN_ANSWER = 0
MAX_ANSWER = 999_999

#: Above this, two puzzles are the same puzzle reworded. Chosen so that
#: swapping a word or two still counts as a repeat, while two puzzles about
#: different things do not — see the criteria in tests/test_puzzle_core.py.
DUPLICATE_THRESHOLD = 0.6

_WORD = re.compile(r"[^\W_]+", re.UNICODE)


@dataclass(frozen=True)
class Check:
    """Whether something passed, and in plain words why not."""

    ok: bool
    reason: str = ""


@dataclass(frozen=True)
class Result:
    """A puzzle, or a refusal with a reason. Never both, never neither."""

    ok: bool
    puzzle: Optional[Dict[str, Any]] = None
    reason: str = ""
    attempts: int = 0


def check_schema(payload: Any) -> Check:
    """Shape and range, before anything else looks at the puzzle."""
    if not isinstance(payload, dict):
        return Check(False, "schema: not an object")

    text = payload.get("text")
    if not isinstance(text, str) or not text.strip():
        return Check(False, "schema: text must be a non-empty string")

    answer = payload.get("answer")
    # bool is an int in Python, and True is not an answer.
    if isinstance(answer, bool) or not isinstance(answer, int):
        return Check(False, "schema: answer must be an integer")
    if answer < MIN_ANSWER or answer > MAX_ANSWER:
        return Check(False, f"schema: answer must have 1 to 6 digits, got {answer}")

    return Check(True)


def _tokens(text: str) -> set:
    """Words, case-folded and stripped of accents, so wording is what differs."""
    folded = unicodedata.normalize("NFKD", text.casefold())
    stripped = "".join(ch for ch in folded if not unicodedata.combining(ch))
    return set(_WORD.findall(stripped))


def similarity(a: str, b: str) -> float:
    """Jaccard overlap of the words in two puzzles, 0.0 to 1.0."""
    first, second = _tokens(a), _tokens(b)
    if not first and not second:
        return 1.0
    union = first | second
    if not union:
        return 1.0
    return len(first & second) / len(union)


def is_duplicate(text: str, previous: List[str]) -> bool:
    """Whether this puzzle is one the player has already been given."""
    return any(similarity(text, earlier) >= DUPLICATE_THRESHOLD for earlier in previous)


def _solve_back(solver: Callable[[str], Any], text: str, answer: int) -> Check:
    """Ask a second model to solve the text alone, and compare the numbers.

    The solver is given no answer and no shared context: if the two numbers
    agree, the text carries its answer on its own, which is the property the
    game needs and the writing model cannot be trusted to judge.
    """
    solved = solver(text)
    if isinstance(solved, bool) or not isinstance(solved, int):
        return Check(False, f"solve-back: solver returned {solved!r}, not an integer")
    if solved != answer:
        return Check(False, f"solve-back: writer said {answer}, solver said {solved}")
    return Check(True)


def generate_puzzle(
    writer: Callable[..., Any],
    solver: Callable[[str], Any],
    previous: List[str],
    max_attempts: int = MAX_ATTEMPTS,
) -> Result:
    """One good puzzle, or a refusal naming the last thing that went wrong.

    Both models are injected, so every criterion runs with no network and no
    key. A model that raises — a timeout, a refused key — is a refusal here,
    never a crash and never a puzzle invented to fill the gap.
    """
    reason = "no attempt was made"

    for attempt in range(1, max_attempts + 1):
        try:
            payload = writer(avoid=list(previous))
        except Exception as error:  # noqa: BLE001 - any model failure is a refusal
            reason = f"writer failed: {error}"
            continue

        schema = check_schema(payload)
        if not schema.ok:
            reason = schema.reason
            continue

        text = payload["text"].strip()
        answer = payload["answer"]

        if is_duplicate(text, previous):
            reason = "duplicate: too close to a puzzle already given"
            continue

        try:
            solved = _solve_back(solver, text, answer)
        except Exception as error:  # noqa: BLE001
            reason = f"solve-back failed: {error}"
            continue

        if not solved.ok:
            reason = solved.reason
            continue

        return Result(True, puzzle={"text": text, "answer": answer}, attempts=attempt)

    return Result(False, reason=f"gave up after {max_attempts} attempts — {reason}")
