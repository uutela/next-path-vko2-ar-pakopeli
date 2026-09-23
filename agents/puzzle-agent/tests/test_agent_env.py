"""Where the agent's environment comes from: its own folder and nowhere else."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

AGENT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AGENT_DIR))

from agent_env import load_agent_environment  # noqa: E402


@pytest.fixture
def no_key(monkeypatch):
    """The key absent for the test, and whatever was there restored after.

    `setenv` first so that monkeypatch records the original value — `delenv`
    on an absent variable records nothing, and a value the loader then sets
    would leak into every test that runs after this one.
    """
    monkeypatch.setenv("GEMINI_API_KEY", "placeholder")
    monkeypatch.delenv("GEMINI_API_KEY")


def test_a_key_above_the_agent_folder_is_not_loaded(tmp_path, no_key):
    """AC16: a parent's `.env.local` never reaches the agent's process."""
    (tmp_path / ".env.local").write_text("GEMINI_API_KEY=from-parent\n")
    agent_dir = tmp_path / "agent"
    agent_dir.mkdir()

    load_agent_environment(agent_dir)

    assert "GEMINI_API_KEY" not in os.environ


def test_the_agent_folder_env_local_is_loaded_over_env(tmp_path, no_key):
    """AC17: the key in the agent's own `.env.local` is the one used."""
    (tmp_path / ".env").write_text("GEMINI_API_KEY=from-env\n")
    (tmp_path / ".env.local").write_text("GEMINI_API_KEY=from-local\n")

    load_agent_environment(tmp_path)

    assert os.environ["GEMINI_API_KEY"] == "from-local"
