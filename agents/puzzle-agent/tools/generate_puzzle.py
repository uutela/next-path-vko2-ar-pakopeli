#!/usr/bin/env python3
"""Standalone tool: draw one puzzle, print JSON, exit 0 or 1."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

AGENT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AGENT_DIR))

from puzzle_agent import draw  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Draw one Finnish puzzle for the escape game.")
    parser.add_argument("--attempts", type=int, default=3, help="generation attempts before refusing")
    args = parser.parse_args()

    result = draw(max_attempts=args.attempts)
    print(json.dumps(result, ensure_ascii=False))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
