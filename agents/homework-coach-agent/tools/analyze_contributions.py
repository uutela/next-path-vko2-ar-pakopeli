#!/usr/bin/env python3
"""Analyze who has completed the most chores this ISO week."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

AGENT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AGENT_DIR))

from homework_core import analyze_contributions, date_today


def _load(raw: str) -> dict:
    path = Path(raw)
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return json.loads(raw)


def main() -> None:
    parser = argparse.ArgumentParser(description="Analyze household contributions")
    parser.add_argument("--household-json", required=True)
    parser.add_argument("--date", default=None)
    args = parser.parse_args()

    try:
        household = _load(args.household_json)
        result = analyze_contributions(household, args.date or date_today())
        print(json.dumps({"status": "success", "data": result}, indent=2))
        sys.exit(0)
    except Exception as exc:
        print(json.dumps({"status": "error", "error": str(exc)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
