# Agents kit

This folder is a **portable pattern** for building domain agents: CLI + tools + skills + memory + FastAPI + Flask UI. Copy `AGENTS.md` and `gemini_agent.py` into any repo, then add one folder per agent.

The reference implementation in this workspace is [`homework-coach-agent/`](homework-coach-agent/).

---

## Layout

```
agents/
├── AGENTS.md                 # Structure, naming, and create-agent workflow
├── gemini_agent.py           # Optional Gemini CLI template (chat / query / plan)
├── README.md                 # This file
└── {agent-name}/             # One folder per agent (see AGENTS.md)
```

Each agent is self-contained: its own `requirements.txt`, env files, tests, API, and UI. The host app (if any) talks to the agent over HTTP — it does not import Python.

---

## Create an agent

1. Read [`AGENTS.md`](AGENTS.md).
2. Copy the folder layout from `homework-coach-agent/` (or `mkdir` the same tree).
3. Put **deterministic domain rules** in a `*_core.py` module. Use Gemini only for wording, search, or narration.
4. Expose the same answers through CLI, FastAPI, and Flask.
5. Register the agent in the table in `AGENTS.md`.

```bash
mkdir -p agents/my-agent/{ui/templates,api,tools,skills,subagents,memory/data,tests}
cp agents/homework-coach-agent/agent_env.py agents/my-agent/
# Copy gemini_agent.py into the agent folder only if you want a Gemini chat CLI.
```

---

## Example: homework-coach-agent

Family chore coach: who should do what, and who has done the most. Numbers come from `homework_core.py` (same rotation/points rules as the TypeScript app). Gemini is optional.

```bash
python3 -m pip install -r agents/homework-coach-agent/requirements.txt
python3 -m pytest agents/homework-coach-agent/tests -q

# CLI (works without an API key)
python3 agents/homework-coach-agent/homework_coach_agent.py "Who should do dishes today?"

# API  → http://127.0.0.1:8001
python3 agents/homework-coach-agent/api/main.py

# Flask UI → http://127.0.0.1:5001
python3 agents/homework-coach-agent/ui/app.py
```

Optional: copy `agents/homework-coach-agent/.env.example` to `.env.local` and set `GEMINI_API_KEY` if you want narrated wording.

In this workspace the family app also embeds Coach at `/coach` and proxies `POST /agent-api/coach/ask` in production. That host-app wiring is **not** required for the kit — any client can POST household JSON to the FastAPI.

---

## Gemini CLI template

`gemini_agent.py` is a generic chat/query/plan client. Domain agents do **not** have to use it; the homework coach does not. Use it when you want Gemini built-in tools (search, URL context, code execution) or a `--plan` JSON outline.

```bash
export GEMINI_API_KEY=<your_key>   # or GOOGLE_AI_STUDIO_KEY / GOOGLE_API_KEY
python3 agents/gemini_agent.py --chat
python3 agents/gemini_agent.py "What time is it in Helsinki?"
python3 agents/gemini_agent.py --plan "Add a weekly chore rotation"
```

Extend it by filling `CUSTOM_FUNCTION_DECLARATIONS` and `execute_custom_function()` — that is the hook for agent-specific CLI tools.

---

## Principles

- **Core first.** Deterministic facts (assignments, totals, rankings) live in code and tests, not in the model.
- **Three surfaces.** CLI, API, and UI should return the same structured result.
- **Skills are docs.** Markdown in `skills/` tells the agent (and humans) when to use which tool.
- **Memory is local.** JSON/SQLite/Chroma under `memory/data/` — gitignore the data, keep schemas.
- **Gemini is optional.** An agent that cannot start without a key is harder to test and ship.
