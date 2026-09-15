#!/usr/bin/env python3
"""FastAPI API for homework-coach-agent."""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

AGENT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AGENT_DIR))
sys.path.insert(0, str(AGENT_DIR / "memory"))

from agent_env import load_agent_environment
from homework_core import analyze_contributions, answer_query, build_day_plan, build_week_plan, date_today
from memory import MemoryStore

load_agent_environment()

app = FastAPI(
    title="Homework Coach Agent API",
    version="1.0.0",
    description="Tell a family who should do what homework, when, and who has done the most.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

memory = MemoryStore()


class CoachAskRequest(BaseModel):
    household: Dict[str, Any]
    query: str = "Who should do what today?"
    date: Optional[str] = None
    locale: str = "en"


class HouseholdBody(BaseModel):
    household: Dict[str, Any]
    date: Optional[str] = None
    locale: str = "en"


@app.get("/health")
async def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/coach/ask")
async def coach_ask(payload: CoachAskRequest) -> Dict[str, Any]:
    result = answer_query(
        payload.household,
        payload.query,
        date=payload.date or date_today(),
        locale=payload.locale,
    )
    memory.save_snapshot(payload.household, source="api")
    memory.add_session(
        {
            "query_text": payload.query,
            "intent": result.get("intent"),
            "locale": payload.locale,
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


@app.post("/coach/plan")
async def coach_plan(payload: HouseholdBody) -> Dict[str, Any]:
    date_str = payload.date or date_today()
    return {
        "status": "success",
        "plan": build_day_plan(payload.household, date_str, payload.locale),
        "week_plan": build_week_plan(payload.household, date_str, payload.locale),
    }


@app.post("/coach/contributions")
async def coach_contributions(payload: HouseholdBody) -> Dict[str, Any]:
    date_str = payload.date or date_today()
    return {
        "status": "success",
        "contributions": analyze_contributions(payload.household, date_str),
    }


@app.post("/household/snapshot")
async def save_snapshot(payload: HouseholdBody) -> Dict[str, Any]:
    stored = memory.save_snapshot(payload.household, source="api")
    return {"status": "success", "snapshot_id": stored["snapshot_id"]}


@app.get("/sessions")
async def list_sessions(limit: int = 20) -> Dict[str, Any]:
    rows = memory.list_sessions(limit)
    return {"count": len(rows), "sessions": rows}


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", os.environ.get("API_PORT", "8001")))
    uvicorn.run(app, host="0.0.0.0", port=port)
