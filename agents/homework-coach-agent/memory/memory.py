#!/usr/bin/env python3
"""Memory CLI and store for homework-coach-agent."""

from __future__ import annotations

import argparse
import json
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"


class MemoryStore:
    """File-based memory for snapshots, coaching sessions, and insights."""

    def __init__(self) -> None:
        DATA_DIR.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

    def _path(self, name: str) -> Path:
        return DATA_DIR / f"{name}.json"

    def _load(self, name: str) -> Dict[str, Any]:
        path = self._path(name)
        if not path.exists():
            return {}
        with open(path, "r", encoding="utf-8") as handle:
            return json.load(handle)

    def _save(self, name: str, data: Dict[str, Any]) -> None:
        path = self._path(name)
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(data, handle, indent=2)

    def save_snapshot(self, household: Dict[str, Any], source: str = "api") -> Dict[str, Any]:
        data = self._load("household_snapshots")
        snapshot_id = str(uuid.uuid4())
        payload = {
            "snapshot_id": snapshot_id,
            "household": household,
            "source": source,
            "created_at": self._now(),
        }
        data["latest"] = payload
        data[snapshot_id] = payload
        self._save("household_snapshots", data)
        return payload

    def get_latest_snapshot(self) -> Optional[Dict[str, Any]]:
        return self._load("household_snapshots").get("latest")

    def add_session(self, session: Dict[str, Any]) -> Dict[str, Any]:
        data = self._load("coaching_sessions")
        session_id = session.get("session_id") or str(uuid.uuid4())
        payload = {
            "session_id": session_id,
            "query_text": session["query_text"],
            "intent": session.get("intent", "both"),
            "locale": session.get("locale", "en"),
            "answer": session.get("answer", ""),
            "created_at": session.get("created_at") or self._now(),
        }
        data[session_id] = payload
        self._save("coaching_sessions", data)
        return payload

    def list_sessions(self, limit: int = 20) -> List[Dict[str, Any]]:
        rows = list(self._load("coaching_sessions").values())
        rows.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return rows[:limit]

    def save_insight(self, insight: Dict[str, Any]) -> Dict[str, Any]:
        data = self._load("contribution_insights")
        insight_id = insight.get("insight_id") or str(uuid.uuid4())
        payload = {
            "insight_id": insight_id,
            "reference_date": insight["reference_date"],
            "most_active_ids": insight.get("most_active_ids", []),
            "members": insight.get("members", []),
            "created_at": insight.get("created_at") or self._now(),
        }
        data["latest"] = payload
        data[insight_id] = payload
        self._save("contribution_insights", data)
        return payload

    def get_latest_insight(self) -> Optional[Dict[str, Any]]:
        return self._load("contribution_insights").get("latest")


def _json_loads(value: str) -> Any:
    try:
        return json.loads(value)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON: {exc}") from exc


def main() -> None:
    parser = argparse.ArgumentParser(description="Memory CLI for homework-coach-agent")
    subparsers = parser.add_subparsers(dest="command", required=True)

    snap_save = subparsers.add_parser("snapshot-save", help="Store a household snapshot")
    snap_save.add_argument("--household-json", required=True)
    snap_save.add_argument("--source", default="cli")

    subparsers.add_parser("snapshot-latest", help="Get the latest household snapshot")

    session_add = subparsers.add_parser("session-add", help="Record a coaching session")
    session_add.add_argument("--session-json", required=True)

    session_list = subparsers.add_parser("session-list", help="List coaching sessions")
    session_list.add_argument("--limit", type=int, default=20)

    insight_save = subparsers.add_parser("insight-save", help="Store contribution insight")
    insight_save.add_argument("--insight-json", required=True)

    subparsers.add_parser("insight-latest", help="Get the latest contribution insight")

    args = parser.parse_args()
    store = MemoryStore()

    try:
        if args.command == "snapshot-save":
            result = store.save_snapshot(_json_loads(args.household_json), args.source)
        elif args.command == "snapshot-latest":
            result = store.get_latest_snapshot()
        elif args.command == "session-add":
            result = store.add_session(_json_loads(args.session_json))
        elif args.command == "session-list":
            result = store.list_sessions(args.limit)
        elif args.command == "insight-save":
            result = store.save_insight(_json_loads(args.insight_json))
        elif args.command == "insight-latest":
            result = store.get_latest_insight()
        else:
            raise ValueError(f"Unsupported command: {args.command}")
    except Exception as exc:
        print(json.dumps({"status": "error", "error": str(exc)}))
        sys.exit(1)

    print(json.dumps({"status": "success", "data": result}, indent=2))
    sys.exit(0)


if __name__ == "__main__":
    main()
