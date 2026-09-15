#!/usr/bin/env python3
"""Subagent: ask Gemini to write one Finnish puzzle.

The model writes and nothing else. Whether the puzzle is usable is decided by
puzzle_core.py, which this module does not import back into the decision.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout
from pathlib import Path
from typing import Any, Dict, List, Optional

AGENT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AGENT_DIR))

from agent_env import load_agent_environment  # noqa: E402

load_agent_environment()

# gemini-2.5-flash answers 404 NOT_FOUND: models.list no longer returns it at
# all, and the 2.5 line survives only as native-audio variants. The key is
# fine — a bad key answers 401 or 403, not 404 on a model name. Overridable
# with GEMINI_MODEL. See INBOX.md.
DEFAULT_MODEL = "gemini-3.5-flash"
DEFAULT_TIMEOUT_SECONDS = 20.0

SYSTEM_PROMPT = """Kirjoitat yhden pulman suomeksi pakopeliin.

Säännöt:
- Suomeksi. Hauskoja päättelytehtäviä: sanallisia ongelmia, ikä- ja
  rahatehtäviä, lukujonoja, yksinkertaista päättelyä.
- Ratkeaa kynällä ja paperilla muutamassa minuutissa peruskoulun tiedoilla.
  Vain laskutoimituksia ja prosentteja — ei trigonometriaa, juuria,
  logaritmeja eikä mitään mikä vaatii laskinta.
- Vastauksen on seurattava pelkästä tekstistä, ei ulkopuolisesta tiedosta.
- Täsmälleen yksi kelvollinen vastaus.
- Vastaus on kokonaisluku, 1-6 numeroa.

Vastaa pelkkänä JSON-objektina, ilman koodilohkoa:
{"text": "<pulma suomeksi>", "answer": <kokonaisluku>}"""


def api_key() -> Optional[str]:
    return (
        os.environ.get("GEMINI_API_KEY")
        or os.environ.get("GOOGLE_AI_STUDIO_KEY")
        or os.environ.get("GOOGLE_API_KEY")
    )


def _parse(raw: str) -> Dict[str, Any]:
    """Whatever the model returned, as an object. Invalid JSON is not a puzzle."""
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("```")[1] if "```" in text[3:] else text[3:]
        text = text.removeprefix("json").strip()
    return json.loads(text)


def write_puzzle(
    avoid: Optional[List[str]] = None,
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
) -> Dict[str, Any]:
    """One drawn puzzle, or an exception. Never a fabricated fallback.

    An exception here is a refusal upstream: puzzle_core turns it into a reason
    the player can be shown. Inventing a puzzle when the model is unavailable
    is the one thing this agent must not do.
    """
    key = api_key()
    if not key:
        raise RuntimeError("no Gemini API key: set GEMINI_API_KEY")

    from google import genai
    from google.genai import types

    client = genai.Client(api_key=key)
    avoid_block = ""
    if avoid:
        recent = "\n".join(f"- {text}" for text in avoid[-10:])
        avoid_block = f"\n\nÄlä toista näitä äläkä kirjoita niiden kaltaisia:\n{recent}"

    def call() -> str:
        response = client.models.generate_content(
            model=os.environ.get("GEMINI_MODEL", DEFAULT_MODEL),
            contents=SYSTEM_PROMPT + avoid_block,
            config=types.GenerateContentConfig(temperature=1.0, response_mime_type="application/json"),
        )
        return response.text or ""

    # A hard ceiling on the call, so a hanging model is a refusal and not a
    # game that never opens its puzzle. See the guardrails in the spec.
    with ThreadPoolExecutor(max_workers=1) as pool:
        try:
            raw = pool.submit(call).result(timeout=timeout)
        except FutureTimeout as error:
            raise TimeoutError(f"writer timed out after {timeout}s") from error

    return _parse(raw)


def main() -> int:
    parser = argparse.ArgumentParser(description="Write one Finnish puzzle with Gemini.")
    parser.add_argument("--avoid", action="append", default=[], help="a puzzle not to repeat")
    parser.add_argument("--timeout", type=float, default=DEFAULT_TIMEOUT_SECONDS)
    args = parser.parse_args()

    try:
        print(json.dumps(write_puzzle(args.avoid, args.timeout), ensure_ascii=False))
        return 0
    except Exception as error:  # noqa: BLE001
        print(json.dumps({"error": str(error)}, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
