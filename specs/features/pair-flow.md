# Feature: Point pairs — puzzle point and answer point

**Status:** Done

## Problem Statement
MVP1 put the puzzle and its keypad at one point: walk there, solve, done. The
walk was therefore over before the puzzle was read. The game this becomes has
two places per puzzle — a **puzzle point** that hands out the task and an
**answer point** where the code is typed — so the walk happens *between*
knowing the puzzle and being able to answer it, which is the part that makes it
a game rather than a form.

Three things follow, and none of them fit the MVP1 model:

- The player must be able to re-read the puzzle while standing somewhere else,
  so a drawn puzzle has to outlive the screen that showed it.
- The answer point must not exist for a player who has not collected its
  puzzle, or the route can be short-circuited by walking to it first.
- There may be several pairs at once, each independent, so a single `SOLVED`
  state naming one point is no longer enough.

The puzzle itself stops being arithmetic the code knows about. Today it is
drawn by `generatePuzzle`; later an AI agent supplies it over a network. Only
its answer stays a number.

## Proposed Change

### The data: places, and nothing else
`points.json` gains two fields per point and loses nothing:

```
interface EscapePoint {
  id: string;
  name: string;
  coordinates: Coordinates;
  radiusMeters: number;
  role: 'puzzle' | 'answer';   // new
  pairId: string;              // new — the two points of a pair share it
}
```

A pair is two points sharing a `pairId`, one of each role. Pairing by a shared
id rather than by one point naming the other keeps the link symmetrical: there
is no "owning" end to keep in step, and adding a pair is adding two points.

**No puzzle text and no answer are stored in the file.** They do not exist
until the player collects them, and after `RESET` they do not exist again.

### The puzzle: a source, like GPS and the camera
`src/adapters/puzzleSource.ts`. AGENTS.md puts every source behind its own
adapter returning a plain typed record, and a puzzle is now a source:

```
interface Puzzle {
  text: string;     // what the player reads, Finnish
  answer: number;   // 0..999999 — one to six digits
}

type DrawResult =
  | { ok: true; puzzle: Puzzle }
  | { ok: false; reason: string };

interface PuzzleSource {
  draw(pairId: string): Promise<DrawResult>;
}
```

Asynchronous from the first line, because the later implementation answers over
a network and a synchronous interface would have to be broken to admit it. A
result rather than a thrown error, because the caller has to render the failure
in Finnish either way.

`Puzzle` loses `left` and `right`: an agent's puzzle has no operands. The local
implementation wraps `generatePuzzle` and renders `"5 + 2 = ?"` into `text`,
so `ar-panel.md` AC2 still holds without being touched.

**The one-to-six-digit rule is enforced here and nowhere else.** The adapter
validates what the source returned before the game sees it, so a future agent
cannot put a seven-digit answer into a keypad that accepts six.

### The state: screens plus progress
A drawn puzzle outlives the screen that showed it, so `GameState` stops being a
union of four situations and becomes progress with a screen on top:

```
interface PairProgress {
  pairId: string;
  puzzle: Puzzle;      // drawn once, kept until RESET
  solved: boolean;
}

interface GameState {
  screen: Screen;
  pairs: PairProgress[];
  notice?: string;     // why the last thing failed, in Finnish
}

type Screen =
  | { kind: 'MAP' }
  | { kind: 'NEAR'; point: EscapePoint }
  | { kind: 'PUZZLE'; pairId: string }
  | { kind: 'ANSWER'; pairId: string; input: string }
  | { kind: 'SOLVED'; pairId: string };
```

`pairs` is the progress and the memory: a pair absent from it has not been
collected, and a pair present in it is never drawn again.

Events:

```
type GameEvent =
  | { kind: 'LOCATION_CHANGED'; coordinates: Coordinates }
  | { kind: 'PUZZLE_DRAWN'; pairId: string; puzzle: Puzzle }
  | { kind: 'PUZZLE_FAILED' }
  | { kind: 'SHOW_PUZZLE'; pairId: string }
  | { kind: 'CLOSE_PUZZLE' }
  | { kind: 'OPEN_ANSWER' }
  | { kind: 'DIGIT_PRESSED'; digit: string }
  | { kind: 'CLEAR' }
  | { kind: 'SUBMIT' }
  | { kind: 'RESET' };
```

`OPEN_PUZZLE` is gone. Pressing `Avaa tehtävä` no longer transitions anything
by itself: the shell asks the source and dispatches `PUZZLE_DRAWN` when it
resolves, which is how an `await` stays out of a pure function.

### Two selectors, both pure
`src/domain/pairs.ts`:

- `visiblePoints(state, points)` — what the map draws: every puzzle point, plus
  the answer point of every collected pair. Sorted by `id`.
- `actionablePoints(state, points)` — what proximity may offer: the same, minus
  both points of a solved pair. Sorted by `id`.

They differ by exactly one rule: a solved pair stays on the map and stops
offering anything. `transition` narrows to `actionablePoints` before looking
for the nearest point in range, which is what makes an uncollected answer point
inert rather than merely unmarked.

## Acceptance Criteria

Throughout:

- `PUZZLE_A` is `{ id: "a-puzzle", name: "Tehtävä", coordinates: { latitude: 60.1699, longitude: 24.9384 }, radiusMeters: 20, role: "puzzle", pairId: "a" }`
- `ANSWER_A` is `{ id: "a-answer", name: "Vastaus", coordinates: { latitude: 60.1710, longitude: 24.9384 }, radiusMeters: 20, role: "answer", pairId: "a" }`
- `PUZZLE_B` and `ANSWER_B` are the same with `b-` ids, `pairId: "b"` and latitudes `60.1720` and `60.1730`
- `NEAR_PUZZLE_A` is `{ latitude: 60.1700708711, longitude: 24.9384 }` — 19 m from `PUZZLE_A`
- `NEAR_ANSWER_A` is `{ latitude: 60.1708291289, longitude: 24.9384 }` — 19 m from `ANSWER_A`
- `FAR` is `{ latitude: 60.1707993216, longitude: 24.9384 }` — 100 m from `PUZZLE_A` and 22 m from `ANSWER_A`, so outside both
- `DRAWN_A` is `{ text: "5 + 2 = ?", answer: 7 }` and `DRAWN_B` is `{ text: "9 + 3 = ?", answer: 12 }`
- `EMPTY` is `{ screen: { kind: "MAP" }, pairs: [] }`
- `COLLECTED_A` is `{ screen: { kind: "MAP" }, pairs: [{ pairId: "a", puzzle: DRAWN_A, solved: false }] }`
- `ctx.points` is `[PUZZLE_A, ANSWER_A, PUZZLE_B, ANSWER_B]` unless stated otherwise

### AC1: A puzzle point in range offers itself
**Given** `EMPTY`
**When** `transition(state, { kind: "LOCATION_CHANGED", coordinates: NEAR_PUZZLE_A }, ctx)` is called
**Then** it returns `{ screen: { kind: "NEAR", point: PUZZLE_A }, pairs: [] }`

Arriving is not collecting. `LOCATION_CHANGED` reaches `NEAR` and stops there,
so the puzzle is drawn by a button press and never by GPS wobble alone — which
is the whole of that decision, stated where it can fail.

### AC2: An answer point whose puzzle is not collected is inert
**Given** `EMPTY`
**When** `LOCATION_CHANGED` is sent with `NEAR_ANSWER_A`
**Then** the returned state is deep-equal to `EMPTY` — `screen.kind` is `"MAP"`, not `"NEAR"`

This is the criterion that stops the route being short-circuited. A player who
walks to the answer point first is standing at nothing.

### AC3: A drawn puzzle is stored against its pair and shown
**Given** state `{ screen: { kind: "NEAR", point: PUZZLE_A }, pairs: [] }`
**When** `transition(state, { kind: "PUZZLE_DRAWN", pairId: "a", puzzle: DRAWN_A }, ctx)` is called
**Then** it returns `{ screen: { kind: "PUZZLE", pairId: "a" }, pairs: [{ pairId: "a", puzzle: { text: "5 + 2 = ?", answer: 7 }, solved: false }] }`

### AC4: A pair is drawn once and never redrawn
**Given** `COLLECTED_A`
**When** `PUZZLE_DRAWN` is sent with `pairId: "a"` and `puzzle: { text: "9 + 9 = ?", answer: 18 }`
**Then** `pairs` still holds exactly `{ pairId: "a", puzzle: { text: "5 + 2 = ?", answer: 7 }, solved: false }`, and `screen` is `{ kind: "PUZZLE", pairId: "a" }`

The second draw is discarded, not stored beside the first. A code that changed
while the player walked to the answer point would be unanswerable and would
look like a broken keypad.

### AC5: With nothing collected, only puzzle points are on the map
**Given** `EMPTY` and `ctx.points`
**When** `visiblePoints(state, points)` is called
**Then** the returned ids are exactly `["a-puzzle", "b-puzzle"]`

### AC6: Collecting a puzzle reveals that pair's answer point and no other
**Given** `COLLECTED_A` and `ctx.points`
**When** `visiblePoints(state, points)` is called
**Then** the returned ids are exactly `["a-answer", "a-puzzle", "b-puzzle"]` — `b-answer` is absent

### AC7: A solved pair stays on the map
**Given** state `COLLECTED_A` with `solved: true`
**When** `visiblePoints(state, points)` is called
**Then** the returned ids are exactly `["a-answer", "a-puzzle", "b-puzzle"]`

### AC8: A solved pair offers nothing at either of its points
**Given** state `COLLECTED_A` with `solved: true`
**When** `actionablePoints(state, points)` is called
**Then** the returned ids are exactly `["b-puzzle"]`, and a `LOCATION_CHANGED` at `NEAR_PUZZLE_A` returns a state whose `screen` is `{ kind: "MAP" }`

### AC28: A puzzle point stops offering once its puzzle is drawn
**Given** `COLLECTED_A` — pair `"a"` collected and unsolved
**When** `actionablePoints(state, points)` is called
**Then** the returned ids are exactly `["a-answer", "b-puzzle"]` — `a-puzzle` is absent, and a `LOCATION_CHANGED` at `NEAR_PUZZLE_A` returns a state whose `screen` is `{ kind: "MAP" }`

A puzzle point has one thing to give and gives it once. While it kept
offering, it also **shadowed its own answer point**: `nearestPointInRange`
keeps the first point with a strictly smaller distance, so two actionable
points at the same distance are separated by array order, which is invisible
to the player. A pair whose two points share a location could therefore never
be finished — the puzzle point won every tie and `Syötä koodi` never appeared.
Found by a browser run that timed out waiting for it.

The puzzle stays reachable: `Näytä pulma` on the map is what re-reads it, and
that is where it belongs, because the player needs it while standing somewhere
else entirely.

### AC9: A collected answer point is reachable
**Given** `COLLECTED_A`
**When** `LOCATION_CHANGED` is sent with `NEAR_ANSWER_A`
**Then** `screen` is `{ kind: "NEAR", point: ANSWER_A }`

### AC10: Opening the answer point starts an empty input
**Given** state `{ screen: { kind: "NEAR", point: ANSWER_A }, pairs: COLLECTED_A.pairs }`
**When** `transition(state, { kind: "OPEN_ANSWER" }, ctx)` is called
**Then** `screen` is `{ kind: "ANSWER", pairId: "a", input: "" }`

### AC11: The puzzle can be re-read from the map
**Given** `COLLECTED_A`
**When** `transition(state, { kind: "SHOW_PUZZLE", pairId: "a" }, ctx)` is called
**Then** `screen` is `{ kind: "PUZZLE", pairId: "a" }` and `pairs` is deep-equal to what it was

### AC12: An uncollected pair cannot be re-read
**Given** `EMPTY`
**When** `SHOW_PUZZLE` is sent with `pairId: "a"`
**Then** the returned state is deep-equal to `EMPTY` and nothing is thrown

### AC13: Closing the puzzle returns to the map
**Given** state `{ screen: { kind: "PUZZLE", pairId: "a" }, pairs: COLLECTED_A.pairs }`
**When** `transition(state, { kind: "CLOSE_PUZZLE" }, ctx)` is called
**Then** `screen` is `{ kind: "MAP" }` and `pairs` is deep-equal to what it was

### AC14: The correct code solves that pair and only that pair
**Given** state `{ screen: { kind: "ANSWER", pairId: "a", input: "7" }, pairs: [{ pairId: "a", puzzle: DRAWN_A, solved: false }, { pairId: "b", puzzle: DRAWN_B, solved: false }] }`
**When** `transition(state, { kind: "SUBMIT" }, ctx)` is called
**Then** `screen` is `{ kind: "SOLVED", pairId: "a" }`, pair `a` has `solved: true`, and pair `b` still has `solved: false`

### AC15: A wrong code clears the input and keeps the same puzzle
**Given** state `{ screen: { kind: "ANSWER", pairId: "a", input: "8" }, pairs: COLLECTED_A.pairs }`
**When** `SUBMIT` is sent
**Then** `screen` is `{ kind: "ANSWER", pairId: "a", input: "" }` and `pairs[0].puzzle` is still `{ text: "5 + 2 = ?", answer: 7 }`

### AC16: Submitting an empty input is not an error
**Given** state `{ screen: { kind: "ANSWER", pairId: "a", input: "" }, pairs: COLLECTED_A.pairs }`
**When** `SUBMIT` is sent
**Then** the returned state is deep-equal to the given state and nothing is thrown

### AC17: A seventh digit is refused
**Given** state `{ screen: { kind: "ANSWER", pairId: "a", input: "123456" }, pairs: COLLECTED_A.pairs }`
**When** `DIGIT_PRESSED` is sent with `digit: "7"`
**Then** `screen.input` is still `"123456"`

### AC18: Walking away does not close an open input
**Given** state `{ screen: { kind: "ANSWER", pairId: "a", input: "1" }, pairs: COLLECTED_A.pairs }`
**When** `LOCATION_CHANGED` is sent with `FAR`
**Then** the returned state is deep-equal to the given state

Inherited from `game-state.md` AC5 and for the same reason: GPS wobble must not
close the panel mid-answer.

### AC19: The nearest actionable point wins when two are in range
**Given** `EMPTY` and `ctx.points = [PUZZLE_A, PUZZLE_NEAR]`, where `PUZZLE_NEAR` is `PUZZLE_B` moved to `{ latitude: 60.1700888575, longitude: 24.9384 }` — from `NEAR_PUZZLE_A` the distances are 19 m to `PUZZLE_A` and 2 m to `PUZZLE_NEAR`, so both are in range
**When** `LOCATION_CHANGED` is sent with `NEAR_PUZZLE_A`
**Then** `screen` is `{ kind: "NEAR", point: PUZZLE_NEAR }`, regardless of array order

### AC20: The source accepts one to six digits
**Given** a fake source returning `{ text: "Koodi?", answer: 999999 }`, and another returning `{ text: "Koodi?", answer: 0 }`
**When** the adapter's `draw("a")` is awaited for each
**Then** each resolves to `{ ok: true, puzzle: <that puzzle> }`

### AC21: A seven-digit answer never reaches the game
**Given** a fake source returning `{ text: "Koodi?", answer: 1000000 }`
**When** `draw("a")` is awaited
**Then** it resolves to `{ ok: false, reason: "answer out of range" }`

### AC22: An answer that is not a whole number never reaches the game
**Given** fake sources returning `answer: 7.5`, `answer: -1` and `answer: Number.NaN`
**When** `draw("a")` is awaited for each
**Then** each resolves to `{ ok: false, reason: "answer out of range" }`

### AC23: A failed draw says so and leaves the player where they are
**Given** state `{ screen: { kind: "NEAR", point: PUZZLE_A }, pairs: [] }`
**When** `transition(state, { kind: "PUZZLE_FAILED" }, ctx)` is called
**Then** `screen` is still `{ kind: "NEAR", point: PUZZLE_A }`, `pairs` is `[]`, and `notice` is `"Tehtävän haku epäonnistui. Yritä uudelleen."`

### AC24: A later success clears the notice
**Given** the state returned by AC23
**When** `PUZZLE_DRAWN` is sent with `pairId: "a"` and `DRAWN_A`
**Then** `notice` is `undefined` and `screen` is `{ kind: "PUZZLE", pairId: "a" }`

### AC25: Reset starts the whole game over
**Given** state `{ screen: { kind: "SOLVED", pairId: "a" }, pairs: [{ pairId: "a", puzzle: DRAWN_A, solved: true }], notice: "jotain" }`
**When** `transition(state, { kind: "RESET" }, ctx)` is called
**Then** it returns `{ screen: { kind: "MAP" }, pairs: [], notice: undefined }`

A reset walks the same route again from nothing, which is what
`points-store.md` means by solved progress never being stored: it lives in
memory and a reset is how it ends.

### AC26: Transition never mutates the state it was given
**Given** any state and any event
**When** `transition` is called
**Then** the object passed in is deep-equal to what it was before the call

### AC27: An event that does not apply leaves the state untouched
**Given** `EMPTY`
**When** each of `SUBMIT`, `CLEAR`, `DIGIT_PRESSED`, `OPEN_ANSWER` and `CLOSE_PUZZLE` is sent
**Then** each returns a state deep-equal to `EMPTY` and nothing is thrown

### AC29: Returning to the map re-asks where the player is standing
**Given** a pair whose two points are in the same place, a player standing there, and exactly one position delivered — the player does not move again
**When** the puzzle is collected and `Takaisin kartalle` is pressed
**Then** the offer `Syötä koodi` is present without any further position

Proximity is only ever recomputed from a `LOCATION_CHANGED`, and a device on a
desk sends no more of them: `watchPositionAsync` notifies after a metre of
movement. So the screen returned to `MAP` and stayed there, with the player
standing on an answer point that never offered anything. Found by someone
testing without walking.

The shell re-dispatches the last known position when an event returns the
player to the map — `CLOSE_PUZZLE` and `RESET`. It is not `transition`'s job:
the coordinates are deliberately not in `GameState`, because where the player
is does not change what the game allows, only what proximity currently
matches. `app-shell.md` AC10 fixed the same class of problem at start-up —
"a device that never moves still gets a position" — and this is the same
mistake one screen later.

## Files to Modify
| File | Change |
|---|---|
| `src/domain/types.ts` | `EscapePoint` gains `role` and `pairId`; `Puzzle` becomes `{ text, answer }`; `GameState` becomes `{ screen, pairs, notice? }` with `Screen` as the union; `GameEvent` loses `OPEN_PUZZLE` and gains `PUZZLE_DRAWN`, `PUZZLE_FAILED`, `SHOW_PUZZLE`, `CLOSE_PUZZLE`, `OPEN_ANSWER` |
| `src/domain/pairs.ts` | New. `visiblePoints` and `actionablePoints` |
| `src/domain/gameState.ts` | `transition` rewritten against the new state; narrows to `actionablePoints`; no longer imports `generatePuzzle` |
| `src/domain/puzzle.ts` | `generatePuzzle` returns `{ text, answer }`; `MAX_INPUT_LENGTH` becomes 6; `checkAnswer` unchanged |
| `src/adapters/puzzleSource.ts` | New. `PuzzleSource`, `DrawResult`, the local implementation over `generatePuzzle`, and the one-to-six-digit validation |
| `src/domain/points.ts` | `isEscapePoint` validates `role` and `pairId` |
| `src/data/points.json` | Two points: one pair, roles and `pairId`, no puzzle and no answer |
| `src/ui/MapScreen.tsx` | Draws `visiblePoints`; the offer names the role; a control re-reads a collected puzzle |
| `src/ui/PuzzleScreen.tsx` | New. The puzzle text as plain React Native on every platform — no Viro, no camera |
| `src/ui/ArScreen.tsx`, `src/ui/PuzzlePanel.tsx` | Serve the answer point only; take `pairId` and `input` rather than a puzzle |
| `src/ui/AppShell.tsx` | Calls the source when a pair has no puzzle, dispatches `PUZZLE_DRAWN` or `PUZZLE_FAILED` |
| `scripts/browser-smoke.mjs` | Walks both points of a pair |
| `specs/features/puzzle.md` | AC12 (two-character cap) and AC1–AC5 (`left`/`right`) corrected before any test changes |
| `specs/features/game-state.md` | Superseded by this spec where they disagree; says so rather than being deleted |
| `specs/features/points-store.md` | Gains the `role` and `pairId` validation criteria |

## Risk
- **What could break: everything downstream of `GameState`.** Every screen and
  every existing `game-state.md` criterion reads the old four-variant union.
  This is the largest change in the repo's history and it is deliberate — the
  old shape cannot hold a puzzle that outlives its screen. The order in
  `looppi.md` exists for this reason: the type moves first, the pure functions
  next, the screens last.
- **`game-state.md` and this spec will disagree.** Two specs describing one
  state machine is how a codebase starts lying. The round that rewrites
  `transition` marks the superseded criteria in `game-state.md` rather than
  leaving them to be read as current.
- **The async source can hang**, not just fail. `PUZZLE_FAILED` covers a
  rejection; a source that never resolves leaves the player at the point with
  no notice and no puzzle. Out of scope here, filed in `INBOX.md`.
- **Answers are compared as numbers**, so `"07"` answers 7 — right while
  `generatePuzzle` draws them, wrong the day an agent issues a code whose
  leading zeros are meaningful. Already in `INBOX.md`.
- **Rollback:** the change is contained in `src/domain` plus the screens that
  read it; `git revert` of the rounds implementing this spec restores MVP1,
  whose tests are unchanged in kind.

## Testing Strategy (MANDATORY)
| Function | Case | Given | When | Then |
|---|---|---|---|---|
| `transition` | happy path | `EMPTY` | `LOCATION_CHANGED` at `NEAR_PUZZLE_A` | `NEAR` with `PUZZLE_A` (AC1) |
| `transition` | error case | `EMPTY` | `LOCATION_CHANGED` at `NEAR_ANSWER_A` | deep-equal to `EMPTY` (AC2) |
| `transition` | happy path | `NEAR` at `PUZZLE_A` | `PUZZLE_DRAWN` `a`, `DRAWN_A` | pair stored, screen `PUZZLE` (AC3) |
| `transition` | edge case | `COLLECTED_A` | `PUZZLE_DRAWN` `a` with a different puzzle | first puzzle kept (AC4) |
| `visiblePoints` | boundary | `EMPTY` | called | `["a-puzzle", "b-puzzle"]` (AC5) |
| `visiblePoints` | happy path | `COLLECTED_A` | called | `["a-answer", "a-puzzle", "b-puzzle"]` (AC6) |
| `visiblePoints` | edge case | pair `a` solved | called | unchanged from AC6 (AC7) |
| `actionablePoints` | edge case | pair `a` solved | called | `["b-puzzle"]` (AC8) |
| `actionablePoints` | edge case | pair `a` collected, unsolved | called | `["a-answer", "b-puzzle"]` (AC28) |
| `transition` | edge case | pair `a` collected, at its puzzle point | `LOCATION_CHANGED` | screen `MAP` (AC28) |
| `transition` | edge case | pair `a` solved | `LOCATION_CHANGED` at `NEAR_PUZZLE_A` | screen `MAP` (AC8) |
| `transition` | happy path | `COLLECTED_A` | `LOCATION_CHANGED` at `NEAR_ANSWER_A` | `NEAR` with `ANSWER_A` (AC9) |
| `transition` | happy path | `NEAR` at `ANSWER_A` | `OPEN_ANSWER` | `ANSWER`, input `""` (AC10) |
| `transition` | happy path | `COLLECTED_A` | `SHOW_PUZZLE` `a` | screen `PUZZLE`, pairs unchanged (AC11) |
| `transition` | error case | `EMPTY` | `SHOW_PUZZLE` `a` | deep-equal to `EMPTY`, no throw (AC12) |
| `transition` | happy path | screen `PUZZLE` | `CLOSE_PUZZLE` | screen `MAP`, pairs unchanged (AC13) |
| `transition` | happy path | `ANSWER` `a` input `"7"`, two pairs | `SUBMIT` | `SOLVED` `a`, `b` untouched (AC14) |
| `transition` | error case | `ANSWER` `a` input `"8"` | `SUBMIT` | input `""`, same puzzle (AC15) |
| `transition` | error case | `ANSWER` `a` input `""` | `SUBMIT` | unchanged, no throw (AC16) |
| `transition` | boundary | `ANSWER` input `"123456"` | `DIGIT_PRESSED` `"7"` | input `"123456"` (AC17) |
| `transition` | edge case | `ANSWER` input `"1"` | `LOCATION_CHANGED` at `FAR` | unchanged (AC18) |
| `transition` | edge case | two puzzle points in range | `LOCATION_CHANGED` | the 2 m point (AC19) |
| `draw` | boundary | source answers `999999`, then `0` | awaited | `{ ok: true }` for each (AC20) |
| `draw` | error case | source answers `1000000` | awaited | `{ ok: false, reason: "answer out of range" }` (AC21) |
| `draw` | error case | source answers `7.5`, `-1`, `NaN` | awaited | `{ ok: false, reason: "answer out of range" }` for each (AC22) |
| `draw` | happy path | source answers `7` | awaited | `{ ok: true, puzzle: { text: "5 + 2 = ?", answer: 7 } }` |
| `transition` | error case | `NEAR` at `PUZZLE_A` | `PUZZLE_FAILED` | notice set, screen unchanged (AC23) |
| `transition` | happy path | the AC23 state | `PUZZLE_DRAWN` | notice `undefined` (AC24) |
| `transition` | happy path | `SOLVED` with a solved pair and a notice | `RESET` | `MAP`, `pairs: []`, no notice (AC25) |
| `transition` | property | any state and event | called | input object unmutated (AC26) |
| `transition` | error case | `EMPTY` | each of five inapplicable events | unchanged, no throw (AC27) |
| `AppShell` | edge case | one position, pair in one place | puzzle collected and closed | `Syötä koodi` present with no further position (AC29) |

## Spec Readiness checklist
- [x] Every AC has a precise expected value — no "works correctly"
- [x] Another person could write a test from each AC without asking
- [x] Every AC can fail — one that cannot fail proves nothing
- [x] Error and edge cases have ACs of their own
- [x] Every AC appears in the testing strategy table
