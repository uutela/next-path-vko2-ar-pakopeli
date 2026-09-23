# turvallisuus.md — the fatal three, checked

A submission appendix. An assessment of `agents/puzzle-agent` against the three
properties from the course material:

1. **Access to private data** — reads files, a database, messages
2. **Exposure to untrusted content** — reads text it did not write itself
3. **The ability to communicate outward** — network calls, writing files

Everything below was read from the code for this review, not recalled. Two
points were checked specifically because they were asked for, and one of them
changed the verdict.

---

## 1. Inventory

| Part | 1. Private data | 2. Untrusted content | 3. Outward channel | What it actually does |
|---|---|---|---|---|
| `agent_env.py` | **yes** | no | no | Loads `.env` and `.env.local` from the agent folder only (until 2026-09-23: **from every parent directory up to the filesystem root**) |
| `puzzle_core.py` | no | no | no | Pure functions. No files, no network, no `genai` import at all |
| `puzzle_agent.py` | no | no | no | Orchestration. Calls the core, the memory and the two subagents |
| `subagents/puzzle_writer.py` | no | see §3 | **yes** | HTTPS to Google's Gemini API |
| `subagents/puzzle_solver.py` | no | see §3 | **yes** | HTTPS to the same API |
| `memory/memory.py` | partly | see §3 | **yes** | Reads and writes `memory/data/issued_puzzles.json` — inside its own folder only |
| `api/main.py` | no | **no** (see §2) | no | `GET /health`, `POST /puzzle`. Listens on `127.0.0.1:8002` |
| `tools/generate_puzzle.py` | no | no | no | Prints JSON on stdout |
| `eval/run_eval.py` | no | no | yes | Measurement harness. Writes into `eval/` |

**What the agent does not have, checked:** no `subprocess`, no `os.system`, no
`exec` and no `eval`, no `requests`, `urllib` or `httpx`. The only network
connection is `genai.Client`, in two places. The only disk writes are its own
`memory/data/` and `eval/`.

**The agent does not read the game's data at all.** No `points.json`, no
`points.local.json`, no player location, no repository source. That matters,
because `AGENTS.md` says the player's location never leaves the device — and the
agent is not a route by which it could, because it never sees it.

---

## 2. Checked in code: does a request field reach a prompt?

**It does not.** From `api/main.py`:

```python
async def puzzle(pair_id: str = "") -> Dict[str, Any]:
    return draw()
```

`pair_id` is accepted and **left unused**. `draw()` is called with no arguments,
and its signature has no `pair_id` parameter at all — it takes only the writer,
the solver, the store and the attempt count.

The endpoint has no other fields. No body, no header, no text from the player.
**Not one character from outside reaches a model prompt.**

This is the point that would have made the agent three of the fatal three: text
written by a player, inside a prompt, is category 2 directly. There is none.

The API also listens on `127.0.0.1` only, so it is not visible on the local
network.

---

## 3. Checked in code: does the model's own output reach a second prompt?

**It does, by two routes.**

**Route A — writer to solver.** `puzzle_solver.py:52`:

```python
contents=SOLVER_PROMPT + text
```

`text` is the puzzle the model itself wrote. It is appended verbatim to a second
model call's prompt. That is the whole idea of the solve-back: the text is sent
alone, with no answer, and if the second call arrives at a different number, the
text does not carry its answer.

**Route B — memory back to the writer.** `puzzle_writer.py:85-86`:

```python
recent = "\n".join(f"- {text}" for text in avoid[-10:])
avoid_block = f"\n\nÄlä toista näitä äläkä kirjoita niiden kaltaisia:\n{recent}"
```

`avoid` comes from `memory.texts()` — the puzzles issued earlier, written by the
model and stored on disk. The model's output therefore travels through a file
and back into the next call's prompt.

### What it can do there

This is the question that decides how serious it is, and the answer is bounded —
not because the model is trusted, but because **the exit path is narrow**:

- The solver's reply is reduced by a regular expression to **the first integer**,
  and that is compared to the number the writer claimed. Nothing else from the
  solver's text is used for anything.
- The solver has no tools, no function calls, no file access and no search. Its
  `GenerateContentConfig` carries a temperature and nothing more.
- The writer's output passes `check_schema` before it reaches anything: it must
  be an object, `text` a string, `answer` an integer between 0 and 999999.

**The worst credible consequence:** an instruction embedded in a puzzle text
makes the solver print a chosen number, the solve-back agrees, and **an unusable
puzzle passes the check**. That is a correctness attack, not a data leak:
nothing private leaves, because nothing private is in the prompt.

A second, more theoretical one: if some other process could write to
`memory/data/issued_puzzles.json`, its contents would reach the writer's prompt
by route B. Today only the agent writes it, but **that file is a
prompt-injection surface**, and it is worth knowing before the memory is shared
with anything else.

---

## 4. Two of three, or three?

**Two of three.** The rule of thumb holds.

| | Met | On what basis |
|---|---|---|
| 1. Access to private data | **yes, narrowly** | `agent_env.py` loads `.env` and `.env.local` from the agent folder only, where the key now lives. Until 2026-09-23 it loaded every parent directory up to the root — on another machine, whatever happened to sit on the path. It does not read the game's data at all |
| 2. Exposure to untrusted content | **not from outside** | No request field reaches a prompt. No search, no URL fetching, no player text. The model's own output travels into prompts by two routes (§3), which is the weak, self-referential form of this property — not attacker-controlled content |
| 3. Ability to communicate outward | **yes** | HTTPS to Google's API. File writes inside its own folder only |

The combination of 1 and 3 is manageable, because the thing that would make it a
leak channel is missing: **nothing feeds the agent an instruction from outside.**
The key goes to Google because that is what the key is for; nothing else private
is in a prompt, because a prompt contains only fixed instruction text and the
model's own earlier puzzles.

### What would turn this into three

Any one of these would do it, and the first two would be easy to do by accident:

- **Passing `pair_id`, or any request field, into the prompt.** A one-line
  change, and player-controlled text would be in a prompt.
- **Adopting the Gemini tools the kit advertises.** `agents/AGENTS.md` lists
  `google_search`, `url_context` and `code_execution`. The first two put
  untrusted content straight into a prompt; the third adds code execution. This
  agent uses none of them.
- **Letting the agent read the game's files**, for instance point names to
  localise the puzzles. `points.local.json` is a place where somebody stands.
- **Binding the API to `0.0.0.0`** for device testing. Anyone on the local
  network could then call it.

---

## 5. What was recorded, and what was not changed

No code was touched. Three entries in `INBOX.md`:

1. `agent_env.py` walks to the filesystem root and loads every environment file
   it finds, though the agent needs one key. *Fixed 2026-09-23 —
   `puzzle-agent.md` AC16, AC17.*
2. The model's output returns to a prompt by two routes, and the memory file is
   a prompt-injection surface if anything else can write to it.
3. The kit's own examples advertise search, URL context and code execution;
   adopting any of them in this agent would turn this assessment into three of
   three.

None of these is a vulnerability today. They are the places where the next
change could make one.
