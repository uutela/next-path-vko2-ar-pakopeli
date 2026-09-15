#!/usr/bin/env python3
"""Subagent: turn structured facts into a family-friendly coaching answer.

Uses Gemini when GEMINI_API_KEY is set; otherwise deterministic templates.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict

AGENT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AGENT_DIR))

from agent_env import load_agent_environment
from homework_core import render_answer

load_agent_environment()

DEFAULT_MODEL = "gemini-2.5-flash"


def narrate_with_gemini(
    query: str,
    facts: Dict[str, Any],
    locale: str,
    template_answer: str,
) -> str:
    """Ask Gemini to rephrase facts; fall back to the template on any error."""
    api_key = (
        os.environ.get("GEMINI_API_KEY")
        or os.environ.get("GOOGLE_AI_STUDIO_KEY")
        or os.environ.get("GOOGLE_API_KEY")
    )
    if not api_key:
        return template_answer

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)
        language = "Finnish" if locale == "fi" else "English"
        prompt = (
            f"You are a kind family homework coach on a kitchen tablet. "
            f"Answer in {language}. Use ONLY these facts. Do not invent names or chores.\n"
            f"Question: {query}\n"
            f"Facts JSON: {json.dumps(facts, ensure_ascii=False)}\n"
            f"Keep it short (2-6 sentences). Celebrate effort; never shame anyone."
        )
        response = client.models.generate_content(
            model=os.environ.get("GEMINI_MODEL", DEFAULT_MODEL),
            contents=prompt,
            config=types.GenerateContentConfig(temperature=0.4),
        )
        text = (response.text or "").strip()
        return text or template_answer
    except Exception:
        return template_answer


def main() -> None:
    parser = argparse.ArgumentParser(description="Coach narrator subagent")
    parser.add_argument("--query", required=True)
    parser.add_argument("--facts-json", required=True)
    parser.add_argument("--locale", default="en")
    parser.add_argument("--use-gemini", action="store_true")
    args = parser.parse_args()

    facts_path = Path(args.facts_json)
    facts = json.loads(facts_path.read_text(encoding="utf-8") if facts_path.exists() else args.facts_json)
    template = render_answer(
        args.query,
        facts.get("plan") or {},
        facts.get("week_plan") or {},
        facts.get("contributions") or {},
        facts.get("intent") or "both",
        args.locale,
    )
    answer = (
        narrate_with_gemini(args.query, facts, args.locale, template)
        if args.use_gemini
        else template
    )
    print(
        json.dumps(
            {
                "status": "success",
                "subagent": "coach_narrator",
                "data": {"answer": answer, "template_answer": template},
            }
        )
    )
    sys.exit(0)


if __name__ == "__main__":
    main()
