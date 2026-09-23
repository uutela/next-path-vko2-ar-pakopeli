"""The HTTP contract, offline. The game reads exactly this shape."""

from __future__ import annotations

import sys
from pathlib import Path

from fastapi.testclient import TestClient

AGENT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AGENT_DIR))

from api.main import app  # noqa: E402

client = TestClient(app)


def test_health_is_ok():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_a_refusal_is_a_200_with_a_reason(monkeypatch):
    """No key, so the agent refuses — and a refusal is an answer, not a 500."""
    for name in ("GEMINI_API_KEY", "GOOGLE_AI_STUDIO_KEY", "GOOGLE_API_KEY"):
        monkeypatch.delenv(name, raising=False)

    response = client.post("/puzzle")

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is False
    assert body["puzzle"] is None
    assert "reason" in body and body["reason"]


def test_a_drawn_puzzle_has_the_shape_the_game_expects(monkeypatch):
    import puzzle_agent

    def fake_draw(**_kwargs):
        return {"ok": True, "puzzle": {"text": "Liisalla on 12 euroa. Paljonko jaa?", "answer": 5}, "attempts": 1}

    monkeypatch.setattr("api.main.draw", fake_draw)

    body = client.post("/puzzle").json()

    assert body["ok"] is True
    assert body["puzzle"] == {"text": "Liisalla on 12 euroa. Paljonko jaa?", "answer": 5}
    assert body["attempts"] == 1


def fake_draw(**_kwargs):
    return {"ok": True, "puzzle": {"text": "Liisalla on 12 euroa. Paljonko jaa?", "answer": 5}, "attempts": 1}


def test_the_web_build_may_read_the_answer(monkeypatch):
    """AC22: without this header the browser discards the response."""
    monkeypatch.setattr("api.main.draw", fake_draw)

    response = client.post("/puzzle", headers={"Origin": "http://localhost:8082"})

    assert response.headers.get("access-control-allow-origin") == "http://localhost:8082"


def test_any_other_origin_is_not_allowed(monkeypatch):
    """AC23: the agent answers the game, not any page that happens to ask."""
    monkeypatch.setattr("api.main.draw", fake_draw)

    response = client.post("/puzzle", headers={"Origin": "http://example.com"})

    assert "access-control-allow-origin" not in response.headers
