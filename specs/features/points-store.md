# Feature: Point storage and admin editor

**Status:** Done

## Problem Statement
Points have to come from somewhere, and from two places at once: a file in
the repo so the game has content on a fresh install, and an in-app editor so
an admin standing in a park can mark a point where they are rather than
guessing coordinates off a map. Points created in the field must survive a
restart, or the editor is a demo rather than a tool. Solved progress must
*not* survive, so the same route can be walked again.

## Proposed Change
A pure merge function plus one adapter.

`src/domain/points.ts`:
- `mergePoints(seed: EscapePoint[], stored: EscapePoint[]): EscapePoint[]` —
  every seed point, overridden by a stored point with the same `id`, plus
  stored points whose `id` is not in the seed. Result sorted by `id` so the
  order is deterministic.

`src/adapters/pointStore.ts` — the only module that touches device storage.
It is a factory over a minimal key-value interface rather than a pair of free
functions, so tests pass an in-memory fake and production passes AsyncStorage:

- `createPointStore(storage: KeyValueStore): PointStore`
- `PointStore.loadStoredPoints(): Promise<EscapePoint[]>`
- `PointStore.saveStoredPoints(points: EscapePoint[]): Promise<void>`

`KeyValueStore` is `{ getItem(key): Promise<string | null>; setItem(key, value): Promise<void> }`
— the subset of AsyncStorage this adapter needs. Depending on the subset
rather than the package means the tests do not need AsyncStorage installed,
which matters because `specs/tech-stack.md` defers installing it until the
code that uses it is written.

An earlier version of this spec named the two functions as free exports with
no storage argument. That cannot be tested against a fake without mocking the
AsyncStorage module, which would have forced the package to be installed for
the sake of the tests alone.

`src/data/points.json` holds the committed seed — a public square, chosen
because the repository is public. `src/data/points.local.json` holds points
that must not be committed, and is gitignored and created empty by
`postinstall`; the root `App.tsx` merges it over the seed with the same
`mergePoints` rule, so a matching id replaces and any other id adds. A point is
a place someone stands, and AGENTS.md is explicit that the player's location
never leaves the device. Solved state is never written by
either function: it lives only in `GameState`, in memory.

## Acceptance Criteria

Throughout, `SEED_A` is `{ id: "p1", name: "Puisto", coordinates: { latitude: 60.1699, longitude: 24.9384 }, radiusMeters: 20, role: "puzzle", pairId: "a" }`.

`PUZZLE_A`, `ANSWER_A`, `PUZZLE_B` and `ANSWER_B` are the pair fixtures of
`pair-flow.md`, used unchanged here so one set of coordinates means the same
thing in both specs.

### AC1: With nothing stored, the seed is the whole list
**Given** `seed = [SEED_A]` and `stored = []`
**When** `mergePoints(seed, stored)` is called
**Then** it returns `[SEED_A]`

### AC2: A stored point with a new id is added
**Given** `seed = [SEED_A]` and `stored = [{ id: "p2", name: "Kentta", coordinates: { latitude: 60.1710, longitude: 24.9400 }, radiusMeters: 20, role: "answer", pairId: "a" }]`
**When** `mergePoints(seed, stored)` is called
**Then** it returns both points, ordered `["p1", "p2"]` by `id`

### AC3: A stored point overrides a seed point with the same id
**Given** `seed = [SEED_A]` and `stored = [{ id: "p1", name: "Siirretty", coordinates: { latitude: 60.1800, longitude: 24.9384 }, radiusMeters: 30, role: "puzzle", pairId: "a" }]`
**When** `mergePoints(seed, stored)` is called
**Then** it returns exactly one point, with `name: "Siirretty"`, `radiusMeters: 30` and `latitude: 60.1800`

### AC4: Two empty lists produce an empty list
**Given** `seed = []` and `stored = []`
**When** `mergePoints(seed, stored)` is called
**Then** it returns `[]`

### AC5: The result is sorted by id regardless of input order
**Given** `seed = []` and `stored` containing ids in the order `["p3", "p1", "p2"]`
**When** `mergePoints(seed, stored)` is called
**Then** the returned ids are `["p1", "p2", "p3"]`

### AC6: Merging does not mutate its inputs
**Given** any `seed` and `stored`
**When** `mergePoints` is called
**Then** both argument arrays are deep-equal to what they were before the call

### AC7: A saved point is returned by the next load
**Given** an empty store
**When** `saveStoredPoints([SEED_A])` resolves and `loadStoredPoints()` is then called
**Then** it resolves to `[SEED_A]`

### AC8: An empty store loads as an empty list, not an error
**Given** a store that has never been written
**When** `loadStoredPoints()` is called
**Then** it resolves to `[]` and nothing is thrown

### AC9: Unreadable stored data loads as an empty list
**Given** a store whose contents are the string `not json`
**When** `loadStoredPoints()` is called
**Then** it resolves to `[]` and nothing is thrown — a corrupt store falls back to the seed rather than crashing the app

### AC10: Solved progress is never written to the store
**Given** a point has been solved and `saveStoredPoints` has been called
**When** the stored payload is inspected
**Then** no key named `solved` appears anywhere in it

### AC11: An entry that is not a point is dropped
**Given** `isEscapePoint(value)` for each of `{ id: "p2", foo: 1 }`, `null`, `"p1"`, `42`, and a point missing `radiusMeters`
**When** it is called
**Then** it returns `false` for every one

### AC12: A point with impossible values is dropped
**Given** `isEscapePoint` for a point with `latitude: 91`, one with `longitude: -181`, and one with `radiusMeters: 0`
**When** it is called
**Then** it returns `false` for every one

### AC13: Stored entries that are not points never reach the game
**Given** a store holding `[SEED_A, { id: "p2", foo: 1 }]`
**When** `loadStoredPoints()` is called
**Then** it resolves to `[SEED_A]`

AC9 guarded unparseable JSON and JSON that is not an array, and stopped there.
An array of the wrong shape passed straight through, reached `isWithinRadius`,
and threw on the first location update:

```
TypeError: Cannot destructure property 'latitude' of 'undefined' as it is undefined.
```

Verified by running it. The app died seconds after launch with no way back
except clearing device storage. A point with a latitude of 91 does the same
thing one step later, through `distanceMeters`' own range check — so the guard
has to cover values as well as shape.

This was filed in `INBOX.md` as a robustness note. It was not a note.

### AC14: A hand-edited local file cannot crash the game
**Given** a repo seed `[SEED_A, SEED_A_ANSWER]` — a whole pair — and a local file holding `[{ id: "p1", coordinates: { latitude: "kuusikymmentä" } }]`
**When** `composeSeed(repoSeed, localSeed)` is called
**Then** it returns both seed points, ids `["p1", "p2"]`

The fixture was a single point until AC21 made `composeSeed` drop half pairs.
This criterion is about a malformed *local* entry being ignored, and a
criterion that fails for an unrelated reason proves nothing about what it
names — so the fixture became a pair rather than the rule being relaxed.

AC13 stopped the crash coming from device storage, and the same crash could
still arrive through the front door: `App.tsx` cast both JSON imports to
`EscapePoint[]` with no check. `points.json` is committed and reviewed, but
`points.local.json` is **typed in by hand** — it is the likeliest source of a
malformed point in the whole system, not the least.

Composing the seed is therefore a function in the domain rather than two casts
in the one file no criterion covers.

### AC15: A point without a usable role is not a point
**Given** `isEscapePoint(value)` for a well-formed point with `role: "bonus"`, one with `role` missing, and one with `role: 7`
**When** it is called
**Then** it returns `false` for every one

`pair-flow.md` gives every point a job: `"puzzle"` hands out the task,
`"answer"` takes the code. A point with neither belongs to no pair and can
never be reached, so it is dropped where every other malformed point is
dropped rather than reaching the map as a marker that does nothing.

### AC16: A point without a pair id is not a point
**Given** `isEscapePoint(value)` for a well-formed point with `pairId: ""`, one with `pairId` missing, and one with `pairId: null`
**When** it is called
**Then** it returns `false` for every one

### AC17: A well-formed pair member is a point
**Given** `isEscapePoint({ id: "a-puzzle", name: "Tehtävä", coordinates: { latitude: 60.1699, longitude: 24.9384 }, radiusMeters: 20, role: "puzzle", pairId: "a" })`
**When** it is called
**Then** it returns `true`

### AC18: A half pair is dropped
**Given** `withCompletePairs([PUZZLE_A, ANSWER_A, PUZZLE_B])`, where `PUZZLE_B` is the only point with `pairId: "b"`
**When** it is called
**Then** the returned ids are exactly `["a-answer", "a-puzzle"]`

A puzzle point with no answer point hands out a code that can never be
entered, and an answer point with no puzzle point can never be revealed.
Either one is a data mistake in a hand-typed file, and the game cannot tell the
player about it — so it is dropped before the map draws it, the way a malformed
point already is.

### AC19: Two points of the same role are not a pair
**Given** `withCompletePairs([PUZZLE_A, { ...PUZZLE_A, id: "a-puzzle-2" }])` — both `role: "puzzle"`, both `pairId: "a"`
**When** it is called
**Then** it returns `[]`

### AC20: Complete pairs survive untouched
**Given** `withCompletePairs([PUZZLE_A, ANSWER_A, PUZZLE_B, ANSWER_B])`
**When** it is called
**Then** the returned ids are exactly `["a-answer", "a-puzzle", "b-answer", "b-puzzle"]`

### AC21: The seed the game receives holds only whole pairs
**Given** a repo seed `[PUZZLE_A, ANSWER_A, PUZZLE_B]` and an empty local file
**When** `composeSeed(repoSeed, localSeed)` is called
**Then** the returned ids are exactly `["a-answer", "a-puzzle"]` — `b-puzzle` is dropped

`withCompletePairs` is where the rule lives; this criterion is where it reaches
the game. Without it the function is correct and unused, which is the same as
absent.

### AC22: A local file may complete a pair the repo seed only half-defines
**Given** a repo seed `[PUZZLE_A]` and a local file `[ANSWER_A]`
**When** `composeSeed(repoSeed, localSeed)` is called
**Then** the returned ids are exactly `["a-answer", "a-puzzle"]`

Completeness is judged after merging, not before. The committed seed is public
and the local file is not, so the answer point of a real route can live only in
the local file — and a rule applied too early would throw away the puzzle point
for having no partner yet.

## Files to Modify
| File | Change |
|---|---|
| `src/domain/points.ts` | `mergePoints`, `isEscapePoint`, `composeSeed` and `withCompletePairs` |
| `src/domain/points.test.ts` | New. AC1–AC6 |
| `src/adapters/pointStore.ts` | New. `KeyValueStore`, `createPointStore`, and the corrupt-data fallback |
| `src/adapters/pointStore.test.ts` | New. AC7–AC10 against an in-memory fake of the storage API |
| `src/data/points.json` | New. The seed point for the demo location |

## Risk
- **What could break:** a bad merge silently hides a point, which in the
  field looks like broken GPS rather than a data problem. AC3 and AC5 pin it.
- **The seed file will contain a real location** once the demo spot is
  chosen. That is a coordinate of a public place, not a person, and the repo
  is public — worth a deliberate choice of somewhere neutral.
- **Rollback:** delete the four source files; the game falls back to reading
  `points.json` alone, since `mergePoints([], seed)` and `mergePoints(seed, [])`
  both return the seed.

## Testing Strategy (MANDATORY)
| Function | Case | Given | When | Then |
|---|---|---|---|---|
| `mergePoints` | happy path | seed with one point, nothing stored | called | the seed list (AC1) |
| `mergePoints` | happy path | stored point with a new id | called | both, ordered by id (AC2) |
| `mergePoints` | edge case | stored point reusing a seed id | called | one point, stored values win (AC3) |
| `mergePoints` | boundary | both lists empty | called | `[]` (AC4) |
| `mergePoints` | edge case | ids out of order | called | sorted `["p1","p2","p3"]` (AC5) |
| `mergePoints` | property | any inputs | called | arguments unmutated (AC6) |
| `loadStoredPoints` | happy path | a point was saved | called after save | that point (AC7) |
| `loadStoredPoints` | edge case | store never written | called | `[]`, no throw (AC8) |
| `loadStoredPoints` | error case | store holds `not json` | called | `[]`, no throw (AC9) |
| `isEscapePoint` | error case | five malformed values | called | `false` for each (AC11) |
| `isEscapePoint` | boundary | latitude 91, longitude -181, radius 0 | called | `false` for each (AC12) |
| `isEscapePoint` | happy path | a well-formed point | called | `true` |
| `loadStoredPoints` | error case | store holds one point and one non-point | called | only the point (AC13) |
| `composeSeed` | error case | local file with a malformed entry | called | only the committed seed (AC14) |
| `composeSeed` | happy path | local point overriding a seed id | called | the local point wins |
| `composeSeed` | error case | repo seed with a half pair | called | the half pair dropped (AC21) |
| `composeSeed` | happy path | repo half pair completed by the local file | called | both points kept (AC22) |
| `isEscapePoint` | error case | role `"bonus"`, role missing, role `7` | called | `false` for each (AC15) |
| `isEscapePoint` | error case | `pairId` `""`, missing, `null` | called | `false` for each (AC16) |
| `isEscapePoint` | happy path | a well-formed pair member | called | `true` (AC17) |
| `withCompletePairs` | error case | a puzzle point whose pair has no answer point | called | that point dropped (AC18) |
| `withCompletePairs` | error case | two puzzle points sharing one `pairId` | called | `[]` (AC19) |
| `withCompletePairs` | happy path | two complete pairs | called | all four, sorted by id (AC20) |
| `saveStoredPoints` | happy path | two points | called | the store holds both, ids preserved |
| `saveStoredPoints` | error case | a solved point in memory | called | payload contains no `solved` key (AC10) |

## Spec Readiness checklist
- [x] Every AC has a precise expected value — no "works correctly"
- [x] Another person could write a test from each AC without asking
- [x] Every AC can fail — one that cannot fail proves nothing
- [x] Error and edge cases have ACs of their own
- [x] Every AC appears in the testing strategy table
