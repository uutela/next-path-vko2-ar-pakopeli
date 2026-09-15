#!/usr/bin/env python3
"""
Puzzle Agent CLI

Invents the puzzles the AR escape game hands out, in Finnish, and proves each
one is usable before returning it.

Usage:
  python puzzle_agent.py --chat
  python puzzle_agent.py "anna pulma"
  python puzzle_agent.py --help

The model writes and solves. Every decision about whether a puzzle may be used
is made in puzzle_core.py, in tested Python. When no good puzzle can be
produced, this refuses with a reason — it never invents one instead.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Callable, Dict, Optional

AGENT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(AGENT_DIR))

from agent_env import load_agent_environment  # noqa: E402
from memory.memory import MemoryStore  # noqa: E402
from puzzle_core import MAX_ATTEMPTS, generate_puzzle  # noqa: E402

load_agent_environment()


def draw(
    writer: Optional[Callable[..., Any]] = None,
    solver: Optional[Callable[[str], Any]] = None,
    store: Optional[MemoryStore] = None,
    max_attempts: int = MAX_ATTEMPTS,
) -> Dict[str, Any]:
    """One puzzle as a JSON-ready result, or a refusal with a reason.

    Both models and the store are injected, so the whole path runs in a test
    with no network and no key.
    """
    if writer is None:
        from subagents.puzzle_writer import write_puzzle as writer  # noqa: PLC0415
    if solver is None:
        from subagents.puzzle_solver import solve as solver  # noqa: PLC0415
    memory = store if store is not None else MemoryStore()

    result = generate_puzzle(writer, solver, previous=memory.texts(), max_attempts=max_attempts)

    if not result.ok:
        return {"ok": False, "reason": result.reason}

    memory.remember(result.puzzle, attempts=result.attempts)
    return {"ok": True, "puzzle": result.puzzle, "attempts": result.attempts}


def _print(result: Dict[str, Any]) -> int:
    print(json.dumps(result, ensure_ascii=False))
    return 0 if result.get("ok") else 1


def _chat() -> int:
    print('puzzle-agent. Enter draws a puzzle, "q" quits.')
    while True:
        try:
            line = input("> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            return 0
        if line in {"q", "quit", "exit"}:
            return 0
        result = draw()
        if result.get("ok"):
            puzzle = result["puzzle"]
            print(f"{puzzle['text']}  (vastaus {puzzle['answer']}, yrityksiä {result['attempts']})")
        else:
            print(f"ei pulmaa: {result['reason']}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("prompt", nargs="?", help="any text; the agent draws one puzzle")
    parser.add_argument("--chat", action="store_true", help="interactive loop")
    args = parser.parse_args()

    if args.chat:
        return _chat()
    return _print(draw())


if __name__ == "__main__":
    raise SystemExit(main())
