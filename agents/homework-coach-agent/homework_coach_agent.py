#!/usr/bin/env python3
"""
Homework Coach Agent CLI

Usage:
  python homework_coach_agent.py --chat
  python homework_coach_agent.py "Who should do dishes today?"
  python homework_coach_agent.py --household household.json "Who has done the most?"
  python homework_coach_agent.py --help
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

from agent_env import load_agent_environment

load_agent_environment()

AGENT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(AGENT_DIR))
sys.path.insert(0, str(AGENT_DIR / "memory"))

from homework_core import answer_query, date_today
from memory import MemoryStore


def load_skills() -> Dict[str, str]:
    """Load markdown skills from the skills folder."""
    skills_dir = AGENT_DIR / "skills"
    loaded: Dict[str, str] = {}
    for path in sorted(skills_dir.glob("*.md")):
        loaded[path.stem] = path.read_text(encoding="utf-8")
    return loaded


def run_subagent(name: str, args: List[str], stdin_text: Optional[str] = None) -> Dict[str, Any]:
    """Run a subagent script and parse structured JSON output."""
    script = AGENT_DIR / "subagents" / f"{name}.py"
    if not script.exists():
        raise FileNotFoundError(f"Subagent not found: {name}")

    result = subprocess.run(
        [sys.executable, str(script)] + args,
        input=stdin_text,
        text=True,
        capture_output=True,
        cwd=str(AGENT_DIR),
        timeout=120,
    )
    if result.returncode != 0:
        detail = result.stderr.strip() or result.stdout.strip() or "subagent failed"
        raise RuntimeError(f"{name} failed: {detail}")
    return json.loads(result.stdout)


def load_household(path: Optional[str], inline_json: Optional[str]) -> Dict[str, Any]:
    """Load household from --household file, --household-json, or latest memory snapshot."""
    if inline_json:
        return json.loads(inline_json)
    if path:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    snapshot = MemoryStore().get_latest_snapshot()
    if snapshot and snapshot.get("household"):
        return snapshot["household"]
    return {"members": [], "tasks": [], "completions": [], "overrides": []}


def polish_answer(query: str, result: Dict[str, Any], locale: str, use_gemini: bool) -> str:
    """Optionally rewrite the template answer with Gemini via the narrator subagent."""
    if not use_gemini:
        return result["answer"]
    facts = {
        "intent": result.get("intent"),
        "plan": result.get("plan"),
        "week_plan": result.get("week_plan"),
        "contributions": result.get("contributions"),
    }
    narrated = run_subagent(
        "coach_narrator",
        ["--query", query, "--facts-json", json.dumps(facts), "--locale", locale, "--use-gemini"],
    )
    return narrated.get("data", {}).get("answer") or result["answer"]


def run_coach(
    query: str,
    household: Dict[str, Any],
    date_str: Optional[str],
    locale: str,
    use_gemini: bool,
) -> Dict[str, Any]:
    """Plan + analyze + answer, then persist the session."""
    load_skills()
    result = answer_query(household, query, date=date_str or date_today(), locale=locale)
    result["answer"] = polish_answer(query, result, locale, use_gemini)

    memory = MemoryStore()
    memory.save_snapshot(household, source="cli")
    memory.add_session(
        {
            "query_text": query,
            "intent": result.get("intent"),
            "locale": locale,
            "answer": result.get("answer"),
        }
    )
    memory.save_insight(
        {
            "reference_date": result["contributions"]["reference_date"],
            "most_active_ids": result["contributions"]["most_active_ids"],
            "members": result["contributions"]["members"],
        }
    )
    return result


def print_readable(result: Dict[str, Any]) -> None:
    """Print a kitchen-tablet-friendly CLI answer."""
    if result.get("status") != "success":
        print(result.get("message") or result.get("error") or "Unknown error")
        return
    print(result.get("answer", ""))
    plan = result.get("plan") or {}
    if plan.get("open_pool") or any(row.get("tasks") for row in plan.get("by_member") or []):
        print("\n— Today —")
        for row in plan.get("by_member") or []:
            for task in row.get("tasks") or []:
                mark = "✓" if task.get("completed") else "○"
                print(f"  {mark} {row.get('member_name')}: {task.get('title')} ({task.get('when')})")
        for task in plan.get("open_pool") or []:
            print(f"  ○ Anyone: {task.get('title')}")
    contrib = result.get("contributions") or {}
    if contrib.get("members"):
        print("\n— This week —")
        for row in contrib["members"]:
            star = " ★" if row.get("member_id") in contrib.get("most_active_ids", []) else ""
            print(
                f"  {row.get('member_name')}: {row.get('week_completions')} chores, "
                f"{row.get('week_points')} pts{star}"
            )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Homework Coach Agent")
    parser.add_argument("query", nargs="?", help="Family question")
    parser.add_argument("--chat", action="store_true", help="Interactive chat mode")
    parser.add_argument("--household", default=None, help="Path to household JSON snapshot")
    parser.add_argument("--household-json", default=None, help="Inline household JSON")
    parser.add_argument("--date", default=None, help="YYYY-MM-DD (default: today)")
    parser.add_argument("--locale", default="en", choices=["en", "fi"])
    parser.add_argument("--json", action="store_true", help="Output raw JSON")
    parser.add_argument(
        "--gemini",
        action="store_true",
        default=bool(os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_AI_STUDIO_KEY")),
        help="Polish the answer with Gemini when a key is available",
    )
    parser.add_argument("--no-gemini", action="store_true", help="Never call Gemini")
    return parser


def run_single(args: argparse.Namespace) -> int:
    try:
        household = load_household(args.household, args.household_json)
        query = args.query or "Who should do what today?"
        result = run_coach(
            query=query,
            household=household,
            date_str=args.date,
            locale=args.locale,
            use_gemini=bool(args.gemini) and not args.no_gemini,
        )
        if args.json:
            print(json.dumps(result, indent=2))
        else:
            print_readable(result)
        return 0 if result.get("status") == "success" else 1
    except Exception as exc:
        payload = {"status": "error", "error": str(exc)}
        if args.json:
            print(json.dumps(payload, indent=2))
        else:
            print(str(exc))
        return 1


def run_chat(args: argparse.Namespace) -> int:
    print("Homework Coach chat. Type 'exit' to quit.")
    while True:
        try:
            line = input("coach> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            return 0
        if not line:
            continue
        if line.lower() in {"exit", "quit"}:
            return 0
        single = argparse.Namespace(
            query=line,
            chat=False,
            household=args.household,
            household_json=args.household_json,
            date=args.date,
            locale=args.locale,
            json=args.json,
            gemini=args.gemini,
            no_gemini=args.no_gemini,
        )
        run_single(single)


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    if args.chat:
        code = run_chat(args)
    else:
        code = run_single(args)
    sys.exit(code)


if __name__ == "__main__":
    main()
