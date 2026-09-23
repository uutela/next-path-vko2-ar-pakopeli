#!/usr/bin/env python3
"""FastAPI for puzzle-agent. The game talks to this over HTTP.

Convention in this workspace: the homework coach uses 8001, so this uses 8002.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

AGENT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AGENT_DIR))

from puzzle_agent import draw  # noqa: E402

#: The web build's dev server (README: port 8082). Only the browser enforces
#: CORS, so this matters for the web build alone — the native app is not
#: subject to it. Without it every draw in the browser fell back to the local
#: generator. See specs/features/puzzle-agent.md AC22, AC23.
ALLOWED_ORIGINS = ["http://localhost:8082", "http://127.0.0.1:8082"]

app = FastAPI(title="puzzle-agent", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_methods=["GET", "POST"])


class Puzzle(BaseModel):
    text: str
    answer: int


class DrawResponse(BaseModel):
    """The same shape src/adapters/puzzleSource.ts calls DrawResult."""

    ok: bool
    puzzle: Optional[Puzzle] = None
    reason: Optional[str] = None
    attempts: Optional[int] = None


@app.get("/health")
async def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/puzzle", response_model=DrawResponse)
async def puzzle(pair_id: str = "") -> Dict[str, Any]:
    """One puzzle, or a refusal. Always 200: a refusal is an answer, not an error.

    `pair_id` is accepted and unused. The game draws once per pair and keeps
    what it gets, so the agent does not need to know which pair asked.
    """
    return draw()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8002)
