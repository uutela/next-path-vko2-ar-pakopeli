#!/usr/bin/env python3
"""Build today's and this week's assignment plan from a household snapshot."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

AGENT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AGENT_DIR))

from homework_core import build_day_plan, build_week_plan, date_today


def _load(raw: str) -> dict:
    path = Path(raw)
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return json.loads(raw)


def main() -> None:
    parser = argparse.ArgumentParser(description="Plan who should do what and when")
    parser.add_argument("--household-json", required=True)
    parser.add_argument("--date", default=None)
    parser.add_argument("--locale", default="en")
    args = parser.parse_args()

    try:
        household = _load(args.household_json)
        date_str = args.date or date_today()
        plan = build_day_plan(household, date_str, args.locale)
        week = build_week_plan(household, date_str, args.locale)
        print(json.dumps({"status": "success", "data": {"plan": plan, "week_plan": week}}, indent=2))
        sys.exit(0)
    except Exception as exc:
        print(json.dumps({"status": "error", "error": str(exc)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
