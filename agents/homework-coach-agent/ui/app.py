#!/usr/bin/env python3
"""Flask UI for homework-coach-agent (standalone dashboard)."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from flask import Flask, render_template, request

AGENT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AGENT_DIR))
sys.path.insert(0, str(AGENT_DIR / "memory"))

from agent_env import load_agent_environment
from homework_core import answer_query, date_today
from memory import MemoryStore

load_agent_environment()

UI_DIR = Path(__file__).resolve().parent
app = Flask(
    __name__,
    template_folder=str(UI_DIR / "templates"),
    static_folder=str(UI_DIR / "static"),
)
app.config["SECRET_KEY"] = os.environ.get("FLASK_SECRET", "homework-coach-secret")
app.config["PORT"] = int(os.environ.get("PORT", os.environ.get("FLASK_RUN_PORT", "5001")))

memory = MemoryStore()

SAMPLE_HOUSEHOLD = {
    "members": [
        {"id": "m1", "name": "Emma", "color": "#3B82F6"},
        {"id": "m2", "name": "Dad", "color": "#22C55E"},
    ],
    "tasks": [
        {
            "id": "dishes",
            "title": "Dishes",
            "icon": "🍽️",
            "schedule": {"type": "daily"},
            "assignment": {"type": "rotation", "memberIds": ["m1", "m2"]},
            "points": 10,
            "active": True,
        },
        {
            "id": "tidy",
            "title": "Tidy",
            "icon": "🧹",
            "schedule": {"type": "daily"},
            "assignment": {"type": "pool"},
            "points": 10,
            "active": True,
        },
    ],
    "completions": [],
    "overrides": [],
}


def _parse_household(raw: str) -> dict:
    raw = (raw or "").strip()
    if not raw:
        snapshot = memory.get_latest_snapshot()
        if snapshot and snapshot.get("household"):
            return snapshot["household"]
        return SAMPLE_HOUSEHOLD
    return json.loads(raw)


@app.route("/", methods=["GET", "POST"])
def home_view() -> str:
    query = "Who should do what today?"
    locale = "en"
    date_str = date_today()
    household_text = json.dumps(SAMPLE_HOUSEHOLD, indent=2)
    result = None
    error = None

    if request.method == "POST":
        query = request.form.get("query", query)
        locale = request.form.get("locale", "en")
        date_str = request.form.get("date") or date_today()
        household_text = request.form.get("household_json", household_text)
        try:
            household = _parse_household(household_text)
            result = answer_query(household, query, date=date_str, locale=locale)
            memory.save_snapshot(household, source="ui")
            memory.add_session(
                {
                    "query_text": query,
                    "intent": result.get("intent"),
                    "locale": locale,
                    "answer": result.get("answer"),
                }
            )
        except Exception as exc:
            error = str(exc)

    return render_template(
        "home_view.html",
        query=query,
        locale=locale,
        date=date_str,
        household_json=household_text,
        result=result,
        error=error,
    )


@app.route("/sessions")
def sessions_view() -> str:
    return render_template("sessions_view.html", sessions=memory.list_sessions(20))


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=app.config["PORT"], debug=False)
