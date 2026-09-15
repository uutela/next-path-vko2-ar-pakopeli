#!/usr/bin/env python3
"""Load a household JSON snapshot from a file or stdin."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict


def load_household_json(path: str | None, stdin_text: str | None) -> Dict[str, Any]:
    """Parse household JSON from a file path or raw text."""
    if path:
        raw = Path(path).read_text(encoding="utf-8")
    elif stdin_text:
        raw = stdin_text
    else:
        raw = sys.stdin.read()
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError("Household JSON must be an object")
    if "members" not in data or "tasks" not in data:
        raise ValueError("Household JSON must include members and tasks")
    return data


def main() -> None:
    parser = argparse.ArgumentParser(description="Load household snapshot JSON")
    parser.add_argument("--path", default=None, help="Path to household JSON file")
    args = parser.parse_args()
    try:
        household = load_household_json(args.path, None if args.path else sys.stdin.read())
        print(
            json.dumps(
                {
                    "status": "success",
                    "member_count": len(household.get("members") or []),
                    "task_count": len(household.get("tasks") or []),
                    "data": household,
                }
            )
        )
        sys.exit(0)
    except Exception as exc:
        print(json.dumps({"status": "error", "error": str(exc)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
