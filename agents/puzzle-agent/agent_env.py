"""Load .env / .env.local from this agent folder, and from nowhere else."""

from __future__ import annotations

from pathlib import Path


def load_agent_environment(agent_dir: Path | None = None) -> None:
    """Load `.env` then `.env.local` from the agent folder; `.env.local` wins.

    The kit's version walked to the filesystem root and loaded every env file
    on the way. The agent needs one value, the API key, and a walk hands a
    program that talks to a third party whatever the parents hold.
    """
    from dotenv import load_dotenv

    if agent_dir is None:
        agent_dir = Path(__file__).resolve().parent

    for name in (".env", ".env.local"):
        path = agent_dir / name
        if path.is_file():
            load_dotenv(path, override=True)
