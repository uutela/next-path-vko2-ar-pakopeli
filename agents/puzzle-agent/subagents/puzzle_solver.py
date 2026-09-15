#!/usr/bin/env python3
"""Subagent: solve a puzzle text, seeing nothing but the text.

This is the second opinion behind the solve-back check. It is given no answer
and no shared context deliberately: if it arrives at the same number from the
text alone, the text carries its answer.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout
from pathlib import Path

AGENT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AGENT_DIR))

from agent_env import load_agent_environment  # noqa: E402
from subagents.puzzle_writer import DEFAULT_MODEL, api_key  # noqa: E402

load_agent_environment()

DEFAULT_TIMEOUT_SECONDS = 20.0

SOLVER_PROMPT = """Ratkaise tämä tehtävä. Vastaa pelkällä kokonaisluvulla,
ilman yksiköitä, ilman selitystä, ilman välimerkkejä.

Tehtävä:
"""


def solve(text: str, timeout: float = DEFAULT_TIMEOUT_SECONDS) -> int:
    """The number a second model reads out of the text, or an exception."""
    key = api_key()
    if not key:
        raise RuntimeError("no Gemini API key: set GEMINI_API_KEY")

    from google import genai
    from google.genai import types

    client = genai.Client(api_key=key)

    def call() -> str:
        response = client.models.generate_content(
            model=os.environ.get("GEMINI_MODEL", DEFAULT_MODEL),
            # Temperature 0: the solve-back is a measurement, not a second
            # opinion on style. Two runs of it should agree with each other.
            contents=SOLVER_PROMPT + text,
            config=types.GenerateContentConfig(temperature=0.0),
        )
        return response.text or ""

    with ThreadPoolExecutor(max_workers=1) as pool:
        try:
            raw = pool.submit(call).result(timeout=timeout)
        except FutureTimeout as error:
            raise TimeoutError(f"solver timed out after {timeout}s") from error

    match = re.search(r"-?\d+", raw.replace(" ", ""))
    if not match:
        raise ValueError(f"solver returned no number: {raw[:80]!r}")
    return int(match.group())


def main() -> int:
    parser = argparse.ArgumentParser(description="Solve a puzzle text with Gemini.")
    parser.add_argument("text", help="the puzzle text, alone")
    parser.add_argument("--timeout", type=float, default=DEFAULT_TIMEOUT_SECONDS)
    args = parser.parse_args()

    try:
        print(json.dumps({"answer": solve(args.text, args.timeout)}))
        return 0
    except Exception as error:  # noqa: BLE001
        print(json.dumps({"error": str(error)}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
