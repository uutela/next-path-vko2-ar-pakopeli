#!/usr/bin/env python3
"""Subagent: rank who has done the most this ISO week."""

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
    parser = argparse.ArgumentParser(description="Contribution analyst subagent")
    parser.add_argument("--household-json", required=True)
    parser.add_argument("--date", default=None)
    args = parser.parse_args()

    household = _load(args.household_json)
    out = {
        "status": "success",
        "subagent": "contribution_analyst",
        "data": analyze_contributions(household, args.date or date_today()),
    }
    print(json.dumps(out))
    sys.exit(0)


if __name__ == "__main__":
    main()
