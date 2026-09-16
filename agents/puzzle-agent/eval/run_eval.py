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

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

AGENT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AGENT_DIR))

from memory.memory import MemoryStore  # noqa: E402
from puzzle_agent import draw  # noqa: E402
from puzzle_core import check_schema, is_duplicate, similarity  # noqa: E402
from subagents.puzzle_solver import solve as real_solver  # noqa: E402
from subagents.puzzle_writer import write_puzzle as real_writer  # noqa: E402

RUNS = int(sys.argv[1]) if len(sys.argv) > 1 else 20
OUT = Path(__file__).resolve().parent / f"eval-{datetime.now().strftime('%Y-%m-%d')}.md"

calls = {"writer": 0, "solver": 0}


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


def append(block: str) -> None:
    with open(OUT, "a", encoding="utf-8") as handle:
        handle.write(block)


def main() -> int:
    store = MemoryStore()
    started = time.time()
    before = len(store.list_puzzles())

    append(
        f"# Puzzle agent eval — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}\n\n"
        f"{RUNS} puzzles drawn in a row against the live model, through the same\n"
        f"`draw()` the game calls: real writer, real solver, real memory.\n\n"
        f"Memory held {before} puzzles before this run.\n\n"
        f"Measurement only. Nothing was tuned from what it found.\n\n---\n\n"
    )

    outcomes: List[Dict[str, Any]] = []

    for index in range(1, RUNS + 1):
        previous = list(store.texts())
        drawn: List[Any] = []
        solved: List[Any] = []

        def writer(avoid=None):
            calls["writer"] += 1
            try:
                payload = real_writer(avoid=avoid)
            except Exception as error:  # noqa: BLE001
                drawn.append(error)
                raise
            drawn.append(payload)
            return payload

        def solver(text):
            calls["solver"] += 1
            try:
                answer = real_solver(text)
            except Exception as error:  # noqa: BLE001
                solved.append(error)
                raise
            solved.append(answer)
            return answer

        result = draw(writer=writer, solver=solver, store=store)

        lines = [f"## {index}\n"]
        for attempt, payload in enumerate(drawn, start=1):
            answer_of = solved[attempt - 1] if attempt - 1 < len(solved) else None
            reason = verdict_for(payload, previous, answer_of)
            if isinstance(payload, Exception):
                lines.append(f"**Attempt {attempt}** — {reason}\n")
                continue
            text = str(payload.get("text", "")).strip()
            lines.append(f"**Attempt {attempt}** — {reason}\n")
            lines.append(f"\n> {text if text else '(empty text)'}\n")
            lines.append(f"\n- writer's answer: `{payload.get('answer')!r}`\n")
            if attempt - 1 < len(solved):
                lines.append(f"- solver read: `{solved[attempt - 1]!r}`\n")
            lines.append("\n")

        if result.get("ok"):
            lines.append(f"**Result: accepted after {result['attempts']} attempt(s).**\n\n---\n\n")
            outcomes.append({"ok": True, "attempts": result["attempts"]})
        else:
            lines.append(f"**Result: refused.** {result['reason']}\n\n---\n\n")
            outcomes.append({"ok": False, "reason": result["reason"]})

        append("".join(lines))
        print(f"{index}/{RUNS} {'ok' if result.get('ok') else 'REFUSED'}", flush=True)

    first_try = sum(1 for o in outcomes if o["ok"] and o["attempts"] == 1)
    retried = sum(1 for o in outcomes if o["ok"] and o["attempts"] > 1)
    refused = sum(1 for o in outcomes if not o["ok"])

    append(
        "## Summary\n\n"
        f"| | |\n|---|---|\n"
        f"| Puzzles requested | {RUNS} |\n"
        f"| Accepted on the first attempt | {first_try} |\n"
        f"| Accepted after a retry | {retried} |\n"
        f"| Refused after three attempts | {refused} |\n"
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
