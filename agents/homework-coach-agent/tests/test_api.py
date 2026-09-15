#!/usr/bin/env python3
"""API tests for homework-coach-agent."""

from __future__ import annotations

import sys
from pathlib import Path

from fastapi.testclient import TestClient

AGENT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AGENT_DIR))
sys.path.insert(0, str(AGENT_DIR / "api"))

from main import app  # noqa: E402

client = TestClient(app)

ISO = "2026-09-02T10:00:00.000Z"

HOUSEHOLD = {
    "members": [
        {"id": "m1", "name": "Emma", "color": "#3B82F6", "avatar": None, "createdAt": ISO, "updatedAt": ISO},
        {"id": "m2", "name": "Dad", "color": "#22C55E", "avatar": None, "createdAt": ISO, "updatedAt": ISO},
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
            "createdAt": ISO,
            "updatedAt": ISO,
        }
    ],
    "completions": [],
    "overrides": [],
    "rewards": [],
    "redemptions": [],
    "settings": {"weekStartsOn": 1, "locale": "en"},
    "meta": {"schemaVersion": 1, "lastModified": ISO},
}


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ask_returns_plan_and_contributions():
    response = client.post(
        "/coach/ask",
        json={
            "household": HOUSEHOLD,
            "query": "Who should do what today?",
            "date": "2026-09-02",
            "locale": "en",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["answer"]
    assert body["plan"]["date"] == "2026-09-02"
    assert isinstance(body["contributions"]["members"], list)


def test_ask_empty_household_mentions_setup():
    response = client.post(
        "/coach/ask",
        json={
            "household": {"members": [], "tasks": [], "completions": [], "overrides": []},
            "query": "Who should do what?",
            "date": "2026-09-02",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert "Setup" in body["answer"]
    assert body["plan"]["by_member"] == []
