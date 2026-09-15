# Feature: Puzzle agent

**Status:** Done

## Problem Statement
The game's puzzles are sums of two single digits. They were right for MVP1 and
they are wrong for a route: a player walks between two points with the puzzle
in their head, and `5 + 2 = ?` does not survive the walk as something worth
solving. A model can write a better one. A model cannot be trusted to say
whether what it wrote is usable.

Those are two different jobs, and the whole design is keeping them apart.

## Proposed Change
`agents/puzzle-agent/`, built on the kit in `agents/AGENTS.md`, reached over
HTTP by `src/adapters/agentPuzzleSource.ts` behind the existing `PuzzleSource`
interface. Nothing in `domain/` changes.

**The model writes and solves. `puzzle_core.py` decides.**

- `subagents/puzzle_writer.py` — asks Gemini for one Finnish puzzle as JSON.
- `subagents/puzzle_solver.py` — given a text **alone**, returns a number.
- `puzzle_core.py` — schema, duplicate, solve-back, retry, refusal. No imports
  of `genai` anywhere in it.
- `memory/memory.py` — the puzzles already issued, so a repeat can be refused.
- `api/main.py` — `GET /health`, `POST /puzzle`, port 8002.

The rules the model is told, in `SYSTEM_PROMPT`: Finnish; word, age, money,
sequence and reasoning puzzles; solvable with pen and paper in a few minutes
with a basic school education; arithmetic and percentages only, nothing needing
a calculator; the answer follows from the text alone; exactly one valid answer;
an integer of 1 to 6 digits.

## Acceptance Criteria

### AC1: The schema is checked before anything else
**Given** `check_schema(payload)` for a non-object, an empty `text`, a missing `answer`, a string answer, `7.5`, `True`, `-1` and `1000000`
**When** it is called
**Then** it returns `ok = False` for every one, and `ok = True` for `{"text": "...", "answer": 0}` and `{"text": "...", "answer": 999999}`

`True` is an `int` in Python and is not an answer. The range is the one the
keypad already enforces in `src/adapters/puzzleSource.ts`.

### AC2: The solve-back sees the text and nothing else
**Given** a writer returning `{"text": T, "answer": 7}`
**When** a puzzle is generated
**Then** the solver has been called exactly once, with `T` and no other argument

### AC3: A puzzle the solver disagrees with is refused
**Given** a writer that always answers `7` and a solver that always answers `8`
**When** a puzzle is generated
**Then** the result is a refusal whose reason contains `solve-back`, and the writer was called exactly `MAX_ATTEMPTS` times

### AC4: A reworded repeat is a duplicate
**Given** `is_duplicate(text, previous)` where `previous` holds the same puzzle with one word changed
**When** it is called
**Then** it returns `True`; for a puzzle about something else it returns `False`

### AC5: One bad draw costs one retry, not the request
**Given** a writer returning an invalid payload and then a valid one
**When** a puzzle is generated
**Then** the result is the valid puzzle and `attempts` is `2`

### AC6: Three failures refuse rather than invent
**Given** a writer that always returns an invalid payload
**When** a puzzle is generated
**Then** the result has `ok = False`, `puzzle` is `None`, a non-empty reason, and the writer was called exactly three times

### AC7: A model that raises is a refusal, never a crash and never a puzzle
**Given** a writer that raises `TimeoutError`, and separately a solver that raises
**When** a puzzle is generated
**Then** each is a refusal naming the failure, and nothing is written to memory

### AC8: Without a key the agent refuses visibly
**Given** `api_key()` returning `None`
**When** the real writer or the real solver is used
**Then** the result is a refusal containing `no Gemini API key`, and memory is untouched

### AC9: Ten consecutive puzzles pass every check
**Given** ten genuinely different puzzles from a fake writer and a solver that agrees with each
**When** ten puzzles are drawn in a row through the agent
**Then** every one has `ok = True`, memory holds ten records, and all ten texts are distinct

An earlier version of this criterion used ten puzzles that differed only in two
numbers. The duplicate check refused the second one, correctly, and the fixture
was the thing that was wrong.

### AC10: Memory is what makes the eleventh a duplicate
**Given** one puzzle already drawn and stored
**When** the writer returns that same puzzle again
**Then** the result is a refusal containing `duplicate`, and memory still holds one record

### AC11: The offline suite opens no socket
**Given** `socket.connect` and `socket.create_connection` replaced with a raising stand-in
**When** a puzzle is drawn through the agent with fake models
**Then** it succeeds, having opened no connection

This criterion exists because the suite went online once: deleting
`GEMINI_API_KEY` does not work, since importing a subagent runs
`load_agent_environment()` and loads `.env.local` from a parent directory.

### AC12: The game gets the puzzle the agent drew
**Given** an agent answering `{ ok: true, puzzle: { text, answer } }`
**When** `createAgentPuzzleSource(...).draw("a")` is called
**Then** it resolves to `{ ok: true, puzzle: { text, answer } }`, having POSTed to `/puzzle?pair_id=a`

### AC13: A refusal falls back to the local generator, and is reported
**Given** an agent that refuses, is unreachable, answers HTTP 500, answers without a text, or answers with seven digits
**When** `draw` is called
**Then** the game receives the local generator's puzzle in every case, and `report` has been called once with the reason

The agent never invents a puzzle. The game must still open one at a point a
player has walked to, so a refusal falls back to a different source — honestly
labelled, and reported rather than swallowed, because a fallback nobody can see
is indistinguishable from an agent that works.

### AC14: A slow agent does not strand the player
**Given** an agent that never answers and `timeoutMs` of 10
**When** `draw` is called
**Then** the request is aborted and the local generator's puzzle is returned

### AC15: The agent's answer passes the same six-digit contract
**Given** an agent answering with `answer: 1000000`
**When** `draw` is called
**Then** the reason reported contains `answer out of range` and the local puzzle is returned

The agent is one more source. `validating()` does not care which source it is
talking to — that is why it wraps this one too.

## Files to Modify
| File | Change |
|---|---|
| `agents/puzzle-agent/puzzle_core.py` | New. Schema, similarity, duplicate, solve-back, retry, refusal |
| `agents/puzzle-agent/puzzle_agent.py` | New. CLI with `--chat`, injectable models and store |
| `agents/puzzle-agent/subagents/puzzle_writer.py` | New. Gemini writes one puzzle; timeout; no fallback puzzle |
| `agents/puzzle-agent/subagents/puzzle_solver.py` | New. Gemini solves a text alone at temperature 0 |
| `agents/puzzle-agent/memory/` | New. Issued puzzles, schema, gitignored data |
| `agents/puzzle-agent/api/main.py` | New. `GET /health`, `POST /puzzle`, port 8002 |
| `agents/puzzle-agent/tools/generate_puzzle.py` | New. JSON on stdout, exit 0/1 |
| `agents/puzzle-agent/skills/puzzle-generation.md` | New. The job and the rules |
| `agents/puzzle-agent/tests/` | New. 38 tests, offline, fake models |
| `src/adapters/agentPuzzleSource.ts` | New. `PuzzleSource` over HTTP, with fallback and reporting |
| `src/config/agent.ts` | New. Endpoint and timeout |
| `App.tsx` | Builds the agent source with the local generator as fallback |
| `scripts/browser-smoke.mjs` | Checks that an absent agent still produces a puzzle |

## Risk
- **The agent has not been run against a live model.** Everything here is
  proven against fakes. The one accidental live call returned `404 NOT_FOUND`
  for `gemini-2.5-flash` on this machine's key — recorded in `INBOX.md`, model
  left configurable, default unchanged rather than guessed at.
- **A fallback can hide a broken agent.** Mitigated, not removed: every refusal
  is reported, and the smoke run checks the absent-agent path by name.
- **`localhost` is the phone on a phone.** The agent will never be reached from
  a device until `src/config/agent.ts` points at the development machine. In
  `INBOX.md`.
- **The player's location never reaches the agent.** The only thing sent is
  `pair_id`, which is an identifier from a committed file. AGENTS.md is
  explicit about this and it is why the agent is not told where the point is.
- **Rollback:** point `App.tsx` back at `createLocalPuzzleSource(Math.random)`.
  The agent is a separate process and a separate folder; nothing in `domain/`
  knows it exists.

## Testing Strategy (MANDATORY)
| Function | Case | Given | When | Then |
|---|---|---|---|---|
| `check_schema` | error case | twelve malformed payloads | called | `ok = False` for each (AC1) |
| `check_schema` | boundary | answers `0` and `999999` | called | `ok = True` (AC1) |
| `generate_puzzle` | happy path | writer and solver agree | called | the puzzle, `attempts = 1` (AC2) |
| `generate_puzzle` | happy path | solver recording its input | called | solver saw the text alone (AC2) |
| `generate_puzzle` | error case | solver disagrees | called | refusal naming solve-back, three attempts (AC3) |
| `is_duplicate` | edge case | same puzzle, one word changed | called | `True` (AC4) |
| `is_duplicate` | happy path | a puzzle about something else | called | `False` (AC4) |
| `generate_puzzle` | edge case | invalid then valid | called | valid puzzle, `attempts = 2` (AC5) |
| `generate_puzzle` | error case | always invalid | called | refusal, `puzzle is None`, three calls (AC6) |
| `generate_puzzle` | error case | writer raises; solver raises | called | refusal naming it (AC7) |
| `draw` | error case | `api_key()` returns `None` | called | refusal containing `no Gemini API key` (AC8) |
| `draw` | happy path | ten different puzzles | drawn in a row | ten successes, ten stored, ten distinct (AC9) |
| `draw` | edge case | a puzzle already stored | drawn again | refusal containing `duplicate` (AC10) |
| `draw` | property | sockets refused | called | succeeds with no connection (AC11) |
| `draw` | error case | refusal is not stored | called | memory empty (AC7) |
| `MemoryStore` | error case | corrupt store file | `texts()` | `[]`, no crash |
| `createAgentPuzzleSource` | happy path | agent answers a puzzle | `draw("a")` | that puzzle, POST to `/puzzle?pair_id=a` (AC12) |
| `createAgentPuzzleSource` | error case | refusal, unreachable, HTTP 500, no text | `draw` | local puzzle, reason reported (AC13) |
| `createAgentPuzzleSource` | edge case | agent never answers | `draw` with `timeoutMs` 10 | local puzzle (AC14) |
| `createAgentPuzzleSource` | boundary | agent answers seven digits | `draw` | reason contains `answer out of range` (AC15) |
| `createAgentPuzzleSource` | edge case | agent and fallback both refuse | `draw` | the fallback's refusal, not the agent's |
| `api` | happy path | `GET /health` | called | `200 {"status": "ok"}` |
| `api` | error case | no key | `POST /puzzle` | `200` with `ok: false` and a reason |

## Spec Readiness checklist
- [x] Every AC has a precise expected value — no "works correctly"
- [x] Another person could write a test from each AC without asking
- [x] Every AC can fail — one that cannot fail proves nothing
- [x] Error and edge cases have ACs of their own
- [x] Every AC appears in the testing strategy table
