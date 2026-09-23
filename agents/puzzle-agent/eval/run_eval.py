#!/usr/bin/env python3
"""Measure the agent against the live model. Measures only — changes nothing.

The loop is the game's: `draw()` calls `generate_puzzle`, which calls the real
writer and the real solver and consults the real memory. The writer and solver
are wrapped in recorders so that every attempt can be reported, and each
attempt's verdict is recomputed afterwards with the same pure functions the
loop used — `check_schema` and `is_duplicate` are deterministic, so reading
their verdict again is reading the same verdict, not a second opinion.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

AGENT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AGENT_DIR))

from memory.memory import MemoryStore  # noqa: E402
from puzzle_agent import draw  # noqa: E402
from puzzle_core import check_schema, is_duplicate, similarity  # noqa: E402
from subagents.puzzle_solver import solve as real_solver  # noqa: E402
from subagents.puzzle_writer import write_puzzle as real_writer  # noqa: E402

EVAL_DIR = Path(__file__).resolve().parent


def verdict_for(payload: Any, previous: List[str], solved: Any) -> str:
    """Why the loop rejected this attempt, in the loop's own order."""
    if isinstance(payload, Exception):
        return f"writer raised — {payload}"
    schema = check_schema(payload)
    if not schema.ok:
        return f"schema — {schema.reason}"
    text = payload["text"].strip()
    if is_duplicate(text, previous):
        closest = max((similarity(text, earlier) for earlier in previous), default=0.0)
        return f"duplicate — closest earlier puzzle scores {closest:.2f}"
    if isinstance(solved, Exception):
        return f"solve-back raised — {solved}"
    if solved != payload["answer"]:
        return f"solve-back — writer said {payload['answer']}, solver said {solved}"
    return "accepted"


def recorders(
    write: Callable[..., Any], solve: Callable[[str], Any]
) -> Tuple[Callable[..., Any], Callable[[str], Any], Callable[[], List[Dict[str, Any]]]]:
    """A writer and a solver that record what they did, and the attempts so far.

    Each attempt is `{"payload": ...}`, plus `"solved"` when the solver ran.
    The solver writes onto the attempt the writer opened. Two lists paired by
    index went wrong the first time a writer failed: it makes no solver call,
    and every later answer landed on the attempt before its own.
    """
    recorded: List[Dict[str, Any]] = []

    def writer(avoid=None):
        attempt: Dict[str, Any] = {}
        recorded.append(attempt)
        try:
            attempt["payload"] = write(avoid=avoid)
        except Exception as error:  # noqa: BLE001
            attempt["payload"] = error
            raise
        return attempt["payload"]

    def solver(text):
        attempt = recorded[-1]
        try:
            attempt["solved"] = solve(text)
        except Exception as error:  # noqa: BLE001
            attempt["solved"] = error
            raise
        return attempt["solved"]

    return writer, solver, lambda: list(recorded)


def main(
    argv: Optional[List[str]] = None,
    write: Callable[..., Any] = real_writer,
    solve: Callable[[str], Any] = real_solver,
    store: Optional[MemoryStore] = None,
    out: Optional[Path] = None,
    sleep: Callable[[float], None] = time.sleep,
) -> int:
    parser = argparse.ArgumentParser(description="Draw puzzles against the live model and report each attempt.")
    parser.add_argument("runs", nargs="?", type=int, default=20, help="puzzles to request")
    parser.add_argument("--delay", type=float, default=0.0, help="seconds to wait between requests")
    args = parser.parse_args(argv)

    store = store if store is not None else MemoryStore()
    out = out if out is not None else EVAL_DIR / f"eval-{datetime.now().strftime('%Y-%m-%d')}.md"
    runs = args.runs
    calls = {"writer": 0, "solver": 0}

    def append(block: str) -> None:
        with open(out, "a", encoding="utf-8") as handle:
            handle.write(block)

    started = time.time()
    before = len(store.list_puzzles())

    append(
        f"# Puzzle agent eval — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}\n\n"
        f"{runs} puzzles drawn in a row against the live model, through the same\n"
        f"`draw()` the game calls: real writer, real solver, real memory.\n\n"
        f"Memory held {before} puzzles before this run. "
        f"Requests were paced {args.delay:g} s apart.\n\n"
        f"Measurement only. Nothing was tuned from what it found.\n\n---\n\n"
    )

    outcomes: List[Dict[str, Any]] = []

    for index in range(1, runs + 1):
        if index > 1 and args.delay > 0:
            sleep(args.delay)
        previous = list(store.texts())
        writer, solver, attempts = recorders(write, solve)

        result = draw(writer=writer, solver=solver, store=store)
        recorded = attempts()
        calls["writer"] += len(recorded)
        calls["solver"] += sum(1 for attempt in recorded if "solved" in attempt)

        lines = [f"## {index}\n"]
        for number, attempt in enumerate(recorded, start=1):
            payload = attempt["payload"]
            reason = verdict_for(payload, previous, attempt.get("solved"))
            if isinstance(payload, Exception):
                lines.append(f"**Attempt {number}** — {reason}\n")
                continue
            text = str(payload.get("text", "")).strip()
            lines.append(f"**Attempt {number}** — {reason}\n")
            lines.append(f"\n> {text if text else '(empty text)'}\n")
            lines.append(f"\n- writer's answer: `{payload.get('answer')!r}`\n")
            if "solved" in attempt:
                lines.append(f"- solver read: `{attempt['solved']!r}`\n")
            lines.append("\n")

        if result.get("ok"):
            lines.append(f"**Result: accepted after {result['attempts']} attempt(s).**\n\n---\n\n")
            outcomes.append({"ok": True, "attempts": result["attempts"]})
        else:
            lines.append(f"**Result: refused.** {result['reason']}\n\n---\n\n")
            outcomes.append({"ok": False, "reason": result["reason"]})

        append("".join(lines))
        print(f"{index}/{runs} {'ok' if result.get('ok') else 'REFUSED'}", flush=True)

    first_try = sum(1 for o in outcomes if o["ok"] and o["attempts"] == 1)
    retried = sum(1 for o in outcomes if o["ok"] and o["attempts"] > 1)
    refused = sum(1 for o in outcomes if not o["ok"])

    append(
        "## Summary\n\n"
        f"| | |\n|---|---|\n"
        f"| Puzzles requested | {runs} |\n"
        f"| Accepted on the first attempt | {first_try} |\n"
        f"| Accepted after a retry | {retried} |\n"
        f"| Refused | {refused} |\n"
        f"| Model calls — writer | {calls['writer']} |\n"
        f"| Model calls — solver | {calls['solver']} |\n"
        f"| Model calls — total | {calls['writer'] + calls['solver']} |\n"
        f"| Wall clock | {time.time() - started:.0f} s |\n"
        f"| Memory before / after | {before} / {len(store.list_puzzles())} |\n\n"
    )
    print(json.dumps({"first_try": first_try, "retried": retried, "refused": refused, "calls": calls}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
