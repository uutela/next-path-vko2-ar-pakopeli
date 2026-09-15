# AGENTS.md — Agent kit

> Copy this file with `gemini_agent.py` into any project. Every agent lives in its own
> folder and follows the same layout so CLI, API, UI, tools, and memory stay consistent.

---

## Agent structure

Place each agent in `agents/{agent-name}/`:

```
agents/
├── AGENTS.md
├── gemini_agent.py          # Optional Gemini CLI template
└── {agent-name}/
    ├── {agent_name}.py      # Main CLI (required)
    ├── agent_env.py         # Load .env / .env.local (recommended)
    ├── {domain}_core.py     # Deterministic domain logic (recommended)
    ├── requirements.txt
    ├── .env.example
    ├── ui/
    │   ├── app.py           # Flask UI
    │   └── templates/
    ├── api/
    │   └── main.py          # FastAPI
    ├── tools/               # Standalone CLI tools (JSON stdout)
    ├── skills/              # Markdown skill docs
    ├── subagents/           # Task-specific CLIs
    ├── memory/
    │   ├── memory.py
    │   ├── *_schema.json
    │   └── data/            # Local state (gitignore contents)
    └── tests/
```

**Reference example:** [`homework-coach-agent/`](homework-coach-agent/) — family chore coach (who does what, who has done the most). Copy that tree when starting a new agent.

---

## Naming

| Component | Convention | Example (homework coach) |
|-----------|------------|--------------------------|
| Folder | kebab-case | `homework-coach-agent/` |
| Main CLI | snake_case | `homework_coach_agent.py` |
| Domain core | snake_case | `homework_core.py` |
| Subagent / tool | snake_case | `assignment_planner.py`, `ask_coach.py` |
| Skill | kebab-case | `daily-assignment-planning.md` |
| Schema | snake_case | `coaching_session_schema.json` |

---

## Requirements

### 1. Main agent (`{agent_name}.py`)

- argparse CLI
- `--chat` and a single-query positional prompt
- Load skills from `skills/`
- Read/write memory via `memory/memory.py`
- Delegate to `subagents/` when a task is a distinct step
- Prefer calling `*_core.py` for facts; optional Gemini for wording only

`gemini_agent.py` (this folder) is a **Gemini chat/plan template**. Domain agents may copy patterns from it; they do not have to import it. The homework coach does not — it calls `homework_core.py` directly.

```python
#!/usr/bin/env python3
"""
{Agent Name} CLI

Usage:
  python {agent_name}.py --chat
  python {agent_name}.py "your query"
  python {agent_name}.py --help
"""
```

### 2. Domain core (`{domain}_core.py`)

Keep rankings, schedules, and other numbers in tested Python. The model must not invent totals. Homework coach: `homework_core.py` + `tests/test_homework_core.py`.

### 3. UI (`ui/`)

- `app.py` — Flask
- Templates in `ui/templates/`
- Same answers as the CLI/API (call core or HTTP to the API)

### 4. API (`api/`)

- `main.py` — FastAPI + Pydantic
- `GET /health`
- Domain routes that accept a JSON snapshot (or equivalent) and return structured facts plus a prose `answer`

```python
@app.get("/health")
async def health():
    return {"status": "ok"}
```

### 5. Tools (`tools/`)

Each tool is a standalone script: argparse, JSON on stdout, exit 0/1.

### 6. Skills (`skills/`)

```markdown
---
name: skill-name
description: When to use this skill
tools: [tool1, tool2]
---

## Purpose
## When to Use
## Tools Required
## Example
```

### 7. Subagents (`subagents/`)

Independent CLIs. JSON stdout. The main agent invokes them with subprocess.

### 8. Memory (`memory/`)

- `memory.py` — CLI + library for persist/list/get
- `*_schema.json` — document the records
- `data/` — gitignore payload files; keep `.gitkeep`

### 9. Tests (`tests/`)

Pytest (and API tests with FastAPI `TestClient`) for core rules and HTTP contracts. Domain tests must pass without a Gemini key.

---

## Gemini (optional)

Use Gemini for search, URL context, narration, or `--plan`. Do not use it as the source of truth for domain numbers.

Keys (any one): `GEMINI_API_KEY`, `GOOGLE_AI_STUDIO_KEY`, `GOOGLE_API_KEY`.

Built-in tools (see `gemini_agent.py`):

- `google_search` — grounded web search
- `url_context` — fetch/analyze URLs
- `code_execution` — run model-generated code
- Custom `function_declarations` — your CLI tools via `execute_custom_function`

---

## Registered agents (this workspace)

Add a row when you create an agent. Other projects that copy this kit should replace the table.

| Agent | Description | Status |
|-------|-------------|--------|
| `homework-coach-agent` | **Reference example.** Who should do which chore and when; who has done the most. CLI, FastAPI `:8001`, Flask `:5001`. | Active |

---

## Run

From the repo root (adjust name and ports):

```bash
# CLI
python3 agents/{agent-name}/{agent_name}.py --chat
python3 agents/{agent-name}/{agent_name}.py "your query"

# API (homework coach uses python3 .../api/main.py which binds :8001)
python3 agents/{agent-name}/api/main.py

# Flask UI
python3 agents/{agent-name}/ui/app.py
```

Convention in this example: API **8001**, Flask **5001**. Pick free ports per machine.

---

## Environment

Load `.env` then `.env.local` from the agent folder and parents (`agent_env.py` in the example).

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | No* | Gemini key (`GOOGLE_AI_STUDIO_KEY` / `GOOGLE_API_KEY` also work) |
| `GEMINI_MODEL` | No | Override default model for `gemini_agent.py` |
| `DATABASE_URL` | No | If the agent uses Postgres |
| `CHROMA_HOST` / `CHROMA_PORT` | No | If the agent uses ChromaDB |

\*Required only for Gemini wording/search. Homework coach plans and rankings work without a key.

---

## Workflow: new agent

1. **Scaffold**
   ```bash
   mkdir -p agents/{agent-name}/{ui/templates,api,tools,skills,subagents,memory/data,tests}
   cp agents/homework-coach-agent/agent_env.py agents/{agent-name}/
   ```
2. **Core + tests** — domain rules in `{domain}_core.py`, pytest first.
3. **Skills** — one markdown file per job the agent does.
4. **Tools + subagents** — JSON CLIs; main agent orchestrates.
5. **Memory** — schemas + `memory.py` + empty `data/.gitkeep`.
6. **API + UI** — FastAPI and Flask, same payload as CLI.
7. **Register** — add a row to the table above.
8. **Verify in a browser** — exercise the Flask UI (and host-app page if you embed one). HTTP unit tests are not a substitute for the main click path.

Do not copy host-app routes, ports, or product names from the homework coach unless they apply. The kit is the folder shape and the core-first rule; the example is one domain.
