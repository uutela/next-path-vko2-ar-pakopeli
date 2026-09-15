#!/usr/bin/env python3
"""Answer a family question using planning + contribution analysis."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

AGENT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AGENT_DIR))

from homework_core import answer_query, date_today


def _load(raw: str) -> dict:
    path = Path(raw)
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return json.loads(raw)


def main() -> None:
    parser = argparse.ArgumentParser(description="Ask the homework coach")
    parser.add_argument("--household-json", required=True)
    parser.add_argument("--query", required=True)
    parser.add_argument("--date", default=None)
    parser.add_argument("--locale", default="en")
    args = parser.parse_args()

    try:
        household = _load(args.household_json)
        result = answer_query(
            household,
            args.query,
            date=args.date or date_today(),
            locale=args.locale,
        )
        print(json.dumps(result, indent=2))
        sys.exit(0 if result.get("status") == "success" else 1)
    except Exception as exc:
        print(json.dumps({"status": "error", "error": str(exc)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
