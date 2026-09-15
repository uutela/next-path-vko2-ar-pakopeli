---
name: puzzle-generation
description: Write one Finnish brain teaser for the AR escape game, and prove it is usable before handing it over
tools: [puzzle_writer, puzzle_solver, memory]
---

## Purpose

The game hands a player a puzzle at one point and takes the answer at another.
The puzzle has to be readable on a phone in daylight, solvable on the walk
between the two points, and have exactly one answer — because the answer is
typed into a keypad that accepts nothing else.

## When to Use

Every time a player collects a puzzle at a puzzle point. One call, one puzzle.

## Tools Required

- `subagents/puzzle_writer.py` — writes the puzzle. Writing is all it does.
- `subagents/puzzle_solver.py` — solves the text alone, for the solve-back check.
- `memory/memory.py` — the puzzles already handed out.

## The rules the model is told

- Finnish. Word problems, age and money problems, number sequences, simple
  reasoning.
- Solvable with pen and paper in a few minutes with a basic school education.
  Arithmetic and percentages only — no trigonometry, roots, logarithms, or
  anything needing a calculator.
- The answer follows from the text alone, never from outside knowledge.
- Exactly one valid answer, an integer of 1 to 6 digits.

## The checks the model does not get to make

Three, all in `puzzle_core.py`, all tested against a fake model:

1. **Schema** — an object, `text` a non-empty string, `answer` an integer of
   1 to 6 digits. `True` is not an answer even though Python calls it an int.
2. **Solve-back** — the text is sent alone to a second call, with no answer and
   no shared context. Two different numbers means the text does not carry its
   answer, whatever the writer claimed.
3. **Duplicate** — word overlap against the puzzles already issued. A puzzle
   reworded is the same puzzle.

At most three attempts. Then a refusal with a reason, never an invented puzzle.

## Example

```bash
python3 agents/puzzle-agent/puzzle_agent.py "anna pulma"
{"ok": true, "puzzle": {"text": "Liisalla on 12 euroa...", "answer": 5}, "attempts": 1}
```

With no key, or when three attempts fail:

```json
{"ok": false, "reason": "gave up after 3 attempts — writer failed: no Gemini API key: set GEMINI_API_KEY"}
```
