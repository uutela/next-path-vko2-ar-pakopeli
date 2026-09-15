# Feature: Game state machine

**Status:** Superseded by `pair-flow.md`

> **Superseded.** This spec describes the MVP1 state machine: four situations,
> one point that both asks and answers, and `transition` drawing the puzzle
> itself. `pair-flow.md` replaces it — `GameState` is now
> `{ screen, pairs, notice? }`, a pair is two points, and drawing happens
> outside the pure function because the source is asynchronous.
>
> Kept rather than deleted, because the reasoning below is still the reasoning:
> AC5 (a puzzle stays open when the player drifts out of range) and AC13 (the
> nearest point wins) survive unchanged in `pair-flow.md` as AC18 and AC19.
> Where the two disagree, `pair-flow.md` is current and this file is history.
> Nothing here should be read as describing the code as it stands.

## Problem Statement
The game has four situations — looking at the map, standing at a point,
solving the puzzle, and having solved it — and the rules for moving between
them are the whole game. Scattering those rules across screen components
would make them untestable and would put GPS in the middle of the logic. They
belong in one pure function.

## Proposed Change
`src/domain/gameState.ts` exports the `GameState` union and one function:

```
transition(state: GameState, event: GameEvent, ctx: TransitionContext): GameState
```

`ctx` carries `points: EscapePoint[]` and `rng: () => number`. The function
reads nothing else — no clock, no network, no GPS. Events are
`LOCATION_CHANGED`, `OPEN_PUZZLE`, `DIGIT_PRESSED`, `CLEAR`, `SUBMIT` and
`RESET`.

`GameState` is a discriminated union, so the compiler forces every state to be
handled and no state can carry a field that does not belong to it:

```
type GameState =
  | { kind: 'MAP' }
  | { kind: 'NEAR'; point: EscapePoint }
  | { kind: 'PUZZLE'; point: EscapePoint; puzzle: Puzzle; input: string }
  | { kind: 'SOLVED'; point: EscapePoint }
```

## Acceptance Criteria

Throughout, `POINT` is `{ id: "p1", name: "Testipiste", coordinates: { latitude: 60.1699, longitude: 24.9384 }, radiusMeters: 20 }`, `INSIDE` is `{ latitude: 60.1700708711, longitude: 24.9384 }` (19 m) and `OUTSIDE` is `{ latitude: 60.1707993216, longitude: 24.9384 }` (100 m).

### AC1: Walking into range opens the point
**Given** state `{ kind: 'MAP' }` and `ctx.points = [POINT]`
**When** `transition(state, { kind: 'LOCATION_CHANGED', coordinates: INSIDE }, ctx)` is called
**Then** it returns `{ kind: 'NEAR', point: POINT }`

### AC2: Staying out of range keeps the map
**Given** state `{ kind: 'MAP' }` and `ctx.points = [POINT]`
**When** the same event is sent with `OUTSIDE`
**Then** it returns `{ kind: 'MAP' }`

### AC3: Walking out of range closes the point again
**Given** state `{ kind: 'NEAR', point: POINT }`
**When** the same event is sent with `OUTSIDE`
**Then** it returns `{ kind: 'MAP' }`

### AC4: Opening the puzzle draws one and clears the input
**Given** state `{ kind: 'NEAR', point: POINT }` and `ctx.rng` returning `0.5` then `0.2`
**When** `transition(state, { kind: 'OPEN_PUZZLE' }, ctx)` is called
**Then** it returns `{ kind: 'PUZZLE', point: POINT, puzzle: { left: 5, right: 2, answer: 7 }, input: "" }`

### AC5: Walking away does not close an open puzzle
**Given** state `{ kind: 'PUZZLE', point: POINT, puzzle: { left: 5, right: 2, answer: 7 }, input: "" }`
**When** `LOCATION_CHANGED` is sent with `OUTSIDE`
**Then** the returned state is identical to the given state

### AC6: A pressed digit lands in the input
**Given** state `PUZZLE` with `input: "1"`
**When** `transition(state, { kind: 'DIGIT_PRESSED', digit: "2" }, ctx)` is called
**Then** the returned state has `input: "12"` and every other field unchanged

### AC7: The correct answer solves the point
**Given** state `PUZZLE` with `puzzle.answer: 7` and `input: "7"`
**When** `transition(state, { kind: 'SUBMIT' }, ctx)` is called
**Then** it returns `{ kind: 'SOLVED', point: POINT }`

### AC8: A wrong answer clears the input and keeps the same puzzle
**Given** state `PUZZLE` with `puzzle = { left: 5, right: 2, answer: 7 }` and `input: "8"`
**When** `transition(state, { kind: 'SUBMIT' }, ctx)` is called
**Then** it returns `{ kind: 'PUZZLE', point: POINT, puzzle: { left: 5, right: 2, answer: 7 }, input: "" }` — the operands do not change

### AC9: Submitting an empty input is not an error
**Given** state `PUZZLE` with `input: ""`
**When** `SUBMIT` is sent
**Then** the returned state is identical to the given state and nothing is thrown

### AC10: A solved point stays solved when the player walks away
**Given** state `{ kind: 'SOLVED', point: POINT }`
**When** `LOCATION_CHANGED` is sent with `OUTSIDE`
**Then** it returns `{ kind: 'SOLVED', point: POINT }`

### AC11: Reset returns to the map from any state
**Given** state `{ kind: 'SOLVED', point: POINT }`
**When** `transition(state, { kind: 'RESET' }, ctx)` is called
**Then** it returns `{ kind: 'MAP' }`

### AC12: An event that does not apply leaves the state untouched
**Given** state `{ kind: 'MAP' }`
**When** `transition(state, { kind: 'SUBMIT' }, ctx)` is called
**Then** the returned state is `{ kind: 'MAP' }` and nothing is thrown

### AC13: The nearest point wins when two are in range
**Given** state `{ kind: 'MAP' }` and `ctx.points = [POINT, POINT_B]`, where `POINT_B` has `id: "p2"`, `radiusMeters: 20` and coordinates `{ latitude: 60.1700888575, longitude: 24.9384 }`. From the player at `INSIDE` the distances are 19 m to `POINT` and 2 m to `POINT_B`, so both are in range
**When** `LOCATION_CHANGED` is sent with `INSIDE`
**Then** the returned state is `{ kind: 'NEAR', point: POINT_B }` — the point with the smaller distance, regardless of array order

### AC14: Transition never mutates the state it was given
**Given** any state and any event
**When** `transition` is called
**Then** the object passed in is deep-equal to what it was before the call

### AC15: Clear empties the input without redrawing the puzzle
**Given** state `PUZZLE` with `puzzle = { left: 5, right: 2, answer: 7 }` and `input: "12"`
**When** `transition(state, { kind: 'CLEAR' }, ctx)` is called
**Then** it returns `{ kind: 'PUZZLE', point: POINT, puzzle: { left: 5, right: 2, answer: 7 }, input: "" }` — the operands are the same ones, not a fresh draw

## Files to Modify
| File | Change |
|---|---|
| `src/domain/types.ts` | Add `GameState`, `GameEvent` and `TransitionContext` as `type` unions — these are unions, not object shapes, so `type` is correct here |
| `src/domain/gameState.ts` | New. `transition` and nothing else |
| `src/domain/gameState.test.ts` | New. One test per row of the testing strategy |

## Risk
- **What could break:** this is the module every screen reads. A wrong
  transition shows up as a stuck or flickering UI, which is slow to diagnose
  on a phone outdoors — hence AC5, AC10 and AC12, which pin the cases where
  nothing should happen.
- **AC5 is a deliberate choice**, not an oversight: a puzzle stays open when
  the player drifts out of range, because GPS wobble would otherwise close
  the panel mid-answer.
- **Rollback:** delete the two files; `distance.ts` and `puzzle.ts` do not
  import them.

## Testing Strategy (MANDATORY)
| Function | Case | Given | When | Then |
|---|---|---|---|---|
| `transition` | happy path | `MAP`, one point | `LOCATION_CHANGED` inside | `NEAR` with that point (AC1) |
| `transition` | happy path | `MAP`, one point | `LOCATION_CHANGED` outside | `MAP` (AC2) |
| `transition` | happy path | `NEAR` | `LOCATION_CHANGED` outside | `MAP` (AC3) |
| `transition` | happy path | `NEAR`, scripted `rng` | `OPEN_PUZZLE` | `PUZZLE`, puzzle `5 + 2`, input `""` (AC4) |
| `transition` | edge case | `PUZZLE` | `LOCATION_CHANGED` outside | unchanged (AC5) |
| `transition` | happy path | `PUZZLE`, input `"1"` | `DIGIT_PRESSED` `"2"` | input `"12"` (AC6) |
| `transition` | happy path | `PUZZLE`, answer 7, input `"7"` | `SUBMIT` | `SOLVED` (AC7) |
| `transition` | error case | `PUZZLE`, answer 7, input `"8"` | `SUBMIT` | `PUZZLE`, input `""`, same operands (AC8) |
| `transition` | error case | `PUZZLE`, input `""` | `SUBMIT` | unchanged, no throw (AC9) |
| `transition` | edge case | `SOLVED` | `LOCATION_CHANGED` outside | `SOLVED` (AC10) |
| `transition` | happy path | `SOLVED` | `RESET` | `MAP` (AC11) |
| `transition` | error case | `MAP` | `SUBMIT` | `MAP`, no throw (AC12) |
| `transition` | error case | `NEAR` | `DIGIT_PRESSED` | unchanged, no throw (AC12) |
| `transition` | edge case | `MAP`, two points in range | `LOCATION_CHANGED` | the nearer point (AC13) |
| `transition` | edge case | `MAP`, empty `ctx.points` | `LOCATION_CHANGED` inside | `MAP`, no throw |
| `transition` | happy path | `PUZZLE`, input `"12"` | `CLEAR` | input `""`, same operands (AC15) |
| `transition` | edge case | `PUZZLE`, input `""` | `CLEAR` | unchanged, no throw (AC15) |
| `transition` | error case | `MAP` | `CLEAR` | `MAP`, no throw (AC12) |
| `transition` | property | any state and event | called | input object unmutated (AC14) |

## Spec Readiness checklist
- [x] Every AC has a precise expected value — no "works correctly"
- [x] Another person could write a test from each AC without asking
- [x] Every AC can fail — one that cannot fail proves nothing
- [x] Error and edge cases have ACs of their own
- [x] Every AC appears in the testing strategy table
