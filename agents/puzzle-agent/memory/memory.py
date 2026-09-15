#!/usr/bin/env python3
"""Memory CLI and store for puzzle-agent: the puzzles already handed out.

Its only job in the rules is the duplicate check — a puzzle the player has
already seen is not a new puzzle. Kept in a file under data/, which is
gitignored: what a player was asked is their business.
"""

from __future__ import annotations

import argparse
import json
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
STORE = "issued_puzzles"


class MemoryStore:
    """File-based memory. No database, no network, no data leaving the folder."""

    def __init__(self, data_dir: Path | None = None) -> None:
        self.data_dir = Path(data_dir) if data_dir else DATA_DIR
        self.data_dir.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

    def _path(self) -> Path:
        return self.data_dir / f"{STORE}.json"

    def list_puzzles(self) -> List[Dict[str, Any]]:
        path = self._path()
        if not path.exists():
            return []
        try:
            with open(path, "r", encoding="utf-8") as handle:
                data = json.load(handle)
        except (json.JSONDecodeError, OSError):
            # A corrupt store means no history, never a crash: the worst case
            # is one repeated puzzle, which is better than a game that cannot
            # open one at all.
            return []
        return data if isinstance(data, list) else []

    def texts(self) -> List[str]:
        return [item["text"] for item in self.list_puzzles() if isinstance(item.get("text"), str)]

    def remember(self, puzzle: Dict[str, Any], attempts: int = 1) -> Dict[str, Any]:
        record = {
            "id": str(uuid.uuid4()),
            "text": puzzle["text"],
            "answer": puzzle["answer"],
            "issued_at": self._now(),
            "attempts": attempts,
        }
        items = self.list_puzzles()
        items.append(record)
        with open(self._path(), "w", encoding="utf-8") as handle:
            json.dump(items, handle, indent=2, ensure_ascii=False)
        return record


def main() -> int:
    parser = argparse.ArgumentParser(description="puzzle-agent memory")
    parser.add_argument("command", choices=["list", "count"])
    args = parser.parse_args()

    store = MemoryStore()
    if args.command == "count":
        print(json.dumps({"issued": len(store.list_puzzles())}))
    else:
        print(json.dumps(store.list_puzzles(), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
