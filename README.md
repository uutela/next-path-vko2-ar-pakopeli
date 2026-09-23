# AR Pakopeli — week 2

A location-based AR escape game, and an AI agent that invents its puzzles.
Built as the **week 2 exercise of the next-path course** (Saranen &
ModernPath, autumn 2026). Week 1 built the game and lives in a separate
repository: [next-path-vko1-ar-pakopeli](https://github.com/uutela/next-path-vko1-ar-pakopeli).

## What it is

The map shows **pairs** of points. A **puzzle point** hands out a task, and only
then does its **answer point** appear on the map; the code is typed there — in
a world-anchored AR panel on a phone, on a plain screen in a browser. The walk
between the two points is the game: you read the puzzle in one place and answer
it in another.

Week 1 drew the puzzle from an arithmetic generator. Week 2 replaced it with
`agents/puzzle-agent`, which writes Finnish brain teasers with Gemini. The
model writes and solves; tested Python decides whether a puzzle may be used —
schema, a duplicate check against memory, and a solve-back that sends the text
alone to a second call and rejects it if the two arrive at different numbers.
Three attempts, then a refusal with a reason. It never invents a puzzle to fill
a gap.

## Running it

    npm install
    npx expo start --web --port 8082
    node scripts/browser-smoke.mjs http://localhost:8082 .smoke

Not port 8081: that is Expo's default, and a second checkout of this project
answers on it just as readily. The smoke script asks the dev server for its own
project root and refuses to run against a different one.

    npm test          # 180 unit tests
    npx tsc --noEmit  # types

The agent is a separate process and optional. Without it the game falls back to
the arithmetic generator and says so in the console:

    python3 -m venv agents/puzzle-agent/.venv
    agents/puzzle-agent/.venv/bin/pip install -r agents/puzzle-agent/requirements.txt
    agents/puzzle-agent/.venv/bin/python agents/puzzle-agent/api/main.py   # :8002
    agents/puzzle-agent/.venv/bin/python -m pytest agents/puzzle-agent/tests

The agent's tests pass offline with no API key. A live model needs
`GEMINI_API_KEY` in `agents/puzzle-agent/.env.local`, which is gitignored. The
agent reads env files from its own folder only; a key in the repository root
is not seen.

## What is verified, and what is not

Verified: 180 unit tests, 40 agent tests offline, 20 browser checks with no
console or page errors, and seven real puzzles drawn against a live model.

**Not verified: the AR half has never run on a device, and the agent's puzzles
have never been seen in the game.** `kesken.md` says exactly what, why, and
what the evidence for each claim actually is.

## The files

| File | What it is |
|---|---|
| `AGENTS.md` | How to work in this repo — the operating manual the model reads |
| `specs/features/` | One spec per feature, acceptance criteria before code |
| `kesken.md` | What is unfinished or unverified, and what the loop got wrong |
| `turvallisuus.md` | Security review: the "fatal three", and why this agent is two of three |
| `INBOX.md` | Everything noticed while working and deliberately not fixed |
| `looppi.md` | The loop the exercise ran: steps, guardrails, task list |
| `looppi-loki.md` | One row per round: task, tests, typecheck, browser, outcome |
| `prompts2.md` | Every prompt that drove week 2, verbatim |

## The exercise

Week 2 was about **loop engineering**: writing the steps and the task list into
a file and letting the tool run it, instead of prompting round by round. The
interesting parts are in `kesken.md` — including the four rounds the loop spent
on a bug that did not exist, because its browser checks were measuring a
different repository.
