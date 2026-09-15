# Feature: Arithmetic puzzle

**Status:** Done

## Problem Statement
The panel needs a puzzle that is different each time but never hard: two
single-digit numbers to add. Because the operands are drawn at random, the
generator cannot call `Math.random` itself — an acceptance criterion could
then never state an exact expected value, and the spec would be unfalsifiable.

## Proposed Change
Three pure functions in `src/domain/puzzle.ts`:

- `generatePuzzle(rng: () => number): Puzzle` — calls `rng` exactly twice;
  each operand is `Math.floor(rng() * 9) + 1`, so both land in 1..9 and the
  answer in 2..18. It returns `{ text, answer }`: the text the player reads,
  `"<first> + <second> = ?"`, and the answer as a number

  `Puzzle` has no `left` and `right`. An agent's puzzle has no operands — it
  has a question and a code — and `pair-flow.md` makes the agent a later
  implementation of the same source. A record the local generator can fill but
  the agent cannot is the wrong record.
- `checkAnswer(puzzle: Puzzle, input: string): boolean` — parses `input` as a
  base-10 integer and compares it to `puzzle.answer`
- `appendDigit(input: string, digit: string): string` — appends one digit,
  refusing to grow past six characters, since an answer is at most six digits

In production `rng` is `Math.random`. In tests it is a function returning a
scripted sequence. Randomness is injected, never taken.

## Acceptance Criteria

### AC1: The lowest draw produces 1 + 1
**Given** an `rng` returning `0` on every call
**When** `generatePuzzle(rng)` is called
**Then** it returns `{ text: "1 + 1 = ?", answer: 2 }`

### AC2: The highest draw produces 9 + 9
**Given** an `rng` returning `0.9999999` on every call
**When** `generatePuzzle(rng)` is called
**Then** it returns `{ text: "9 + 9 = ?", answer: 18 }`

### AC3: A mid-range draw maps to the documented operands
**Given** an `rng` returning `0.5` then `0.2`
**When** `generatePuzzle(rng)` is called
**Then** it returns `{ text: "5 + 2 = ?", answer: 7 }`

### AC4: The generator draws exactly twice
**Given** an `rng` that counts its calls
**When** `generatePuzzle(rng)` is called once
**Then** the counter reads exactly `2`

### AC5: The answer is always the sum of the numbers the text names
**Given** an `rng` returning any sequence of values in `[0, 1)`
**When** `generatePuzzle(rng)` is called
**Then** `text` matches `/^[1-9] \+ [1-9] = \?$/` and `answer` equals the sum of the two numbers in it

### AC6: The correct answer is accepted
**Given** `puzzle = { text: "5 + 2 = ?", answer: 7 }`
**When** `checkAnswer(puzzle, "7")` is called
**Then** it returns `true`

### AC7: A wrong answer is rejected
**Given** the same puzzle
**When** `checkAnswer(puzzle, "8")` is called
**Then** it returns `false`

### AC8: A leading zero is still the same number
**Given** the same puzzle
**When** `checkAnswer(puzzle, "07")` is called
**Then** it returns `true`

### AC9: Empty input is rejected, not an error
**Given** the same puzzle
**When** `checkAnswer(puzzle, "")` is called
**Then** it returns `false` and nothing is thrown

### AC10: A digit is appended to empty input
**Given** `input = ""`
**When** `appendDigit(input, "5")` is called
**Then** it returns `"5"`

### AC11: A second digit is appended
**Given** `input = "1"`
**When** `appendDigit(input, "2")` is called
**Then** it returns `"12"`

### AC12: A seventh digit is ignored
**Given** `input = "123456"`
**When** `appendDigit(input, "7")` is called
**Then** it returns `"123456"` unchanged

This criterion used to cap the input at two characters, because the largest
answer an addition of two single digits can have is 18. That stopped being the
rule when the answer became a code entered at a separate point: `pair-flow.md`
sets the cap at six digits, a maximum rather than a length, so a shorter answer
is still a valid answer and nothing is zero-padded.

The cap was corrected here before `puzzle.test.ts` was touched. A test changed
to match the code would have proved only that the code does what it does.

### AC14: A third digit is appended
**Given** `input = "12"`
**When** `appendDigit(input, "3")` is called
**Then** it returns `"123"`

The case AC12 used to forbid. It has a criterion of its own because the old
cap is exactly what this change removes, and a boundary that moved needs both
of its sides pinned.

### AC13: Input containing anything but digits is rejected
**Given** `puzzle = { text: "5 + 2 = ?", answer: 7 }`
**When** `checkAnswer(puzzle, "7abc")` is called
**Then** it returns `false`

The same holds for `"7.9"`, `"+7"` and `"7e0"`, each of which a bare
`parseInt` would read as 7. Surrounding whitespace stays acceptable — AC6
covers `"7 "` — so the rule is that the input must be all digits *after*
trimming.

Nothing in MVP1 can produce such input: `appendDigit` only ever appends `0`-`9`
and the keypad has no other keys. This criterion exists because the PRD says
later projects read this repo as an example, and a domain function that
silently accepts `"7abc"` is a worse example than one that does not.

## Files to Modify
| File | Change |
|---|---|
| `src/domain/types.ts` | `Puzzle` is `{ text: string; answer: number }` — no operands |
| `src/adapters/puzzleSource.ts` | New. The async source `generatePuzzle` now sits behind |
| `src/domain/puzzle.ts` | New. `generatePuzzle`, `checkAnswer`, `appendDigit` |
| `src/domain/puzzle.test.ts` | New. One test per row of the testing strategy |

## Risk
- **What could break:** nothing depends on this yet. The trap is writing
  `Math.random()` inside `generatePuzzle` — every AC above becomes untestable
  the moment that happens, and the failure is silent.
- **Six-character input** assumes no answer ever exceeds six digits. That is
  no longer an assumption about arithmetic but a contract: `pair-flow.md` AC21
  has the puzzle source reject a seven-digit answer before the game sees it, so
  the keypad and the source agree by construction rather than by luck.
- **No clear or backspace key** — see the open question in `ar-panel.md`.
- **Rollback:** delete the two files.

## Testing Strategy (MANDATORY)
| Function | Case | Given | When | Then |
|---|---|---|---|---|
| `generatePuzzle` | boundary | `rng` returns `0` | called | `{ text: "1 + 1 = ?", answer: 2 }` (AC1) |
| `generatePuzzle` | boundary | `rng` returns `0.9999999` | called | `{ text: "9 + 9 = ?", answer: 18 }` (AC2) |
| `generatePuzzle` | happy path | `rng` returns `0.5`, `0.2` | called | `{ text: "5 + 2 = ?", answer: 7 }` (AC3) |
| `generatePuzzle` | happy path | counting `rng` | called once | counter is `2` (AC4) |
| `generatePuzzle` | property | 100 scripted draws in `[0,1)` | called | text matches the pattern, `answer` is the sum in it (AC5) |
| `checkAnswer` | happy path | answer `7`, input `"7"` | called | `true` (AC6) |
| `checkAnswer` | error case | answer `7`, input `"8"` | called | `false` (AC7) |
| `checkAnswer` | edge case | answer `7`, input `"07"` | called | `true` (AC8) |
| `checkAnswer` | error case | answer `7`, input `""` | called | `false`, no throw (AC9) |
| `checkAnswer` | edge case | answer `7`, input `"7 "` | called | `true` — surrounding whitespace ignored |
| `checkAnswer` | error case | answer `7`, input `"7abc"` | called | `false` (AC13) |
| `checkAnswer` | error case | answer `7`, input `"7.9"` | called | `false` (AC13) |
| `checkAnswer` | error case | answer `7`, input `"+7"` | called | `false` (AC13) |
| `checkAnswer` | error case | answer `7`, input `"7e0"` | called | `false` (AC13) |
| `appendDigit` | happy path | `""` + `"5"` | called | `"5"` (AC10) |
| `appendDigit` | happy path | `"1"` + `"2"` | called | `"12"` (AC11) |
| `appendDigit` | happy path | `"12"` + `"3"` | called | `"123"` (AC14) |
| `appendDigit` | boundary | `"12345"` + `"6"` | called | `"123456"` — the cap is reached, not passed (AC12) |
| `appendDigit` | boundary | `"123456"` + `"7"` | called | `"123456"` (AC12) |

## Spec Readiness checklist
- [x] Every AC has a precise expected value — no "works correctly"
- [x] Another person could write a test from each AC without asking
- [x] Every AC can fail — one that cannot fail proves nothing
- [x] Error and edge cases have ACs of their own
- [x] Every AC appears in the testing strategy table
