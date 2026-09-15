# Feature: App shell

**Status:** Done

## Problem Statement
Every piece of the game exists and is tested, and nothing joins them. `App.tsx`
is still the placeholder written in step 5, so starting the app shows a title
and the words "Ei vielä pisteitä." Until the shell exists there is no app to
walk through, and step 7 has nothing to look at.

The shell owns three things no feature spec covers: which screen the current
state implies, where location updates come from, and where the point list is
assembled.

## Proposed Change

`src/ui/AppShell.tsx` — the composition, with every source injected so it can
be rendered in a test with no device:

```
AppShell({ seed, pointStore, location, audio, camera, rng })
```

It holds one `GameState` and updates it only by calling `transition`,
subscribes to `location` for the life of the component, and renders
`MapScreen` or `ArScreen` according to `state.kind`. The point list arrives
asynchronously and is read through a ref rather than baked into a reducer, so
that `transition` keeps taking its context as an argument and stays pure.

`src/adapters/location.ts` — a `LocationSource` is
`{ watch(onChange: (c: Coordinates) => void): () => void }`, returning its own
unsubscribe. `createMockLocationSource(coordinates[])` walks a scripted list
and is a development and testing tool; the demo runs on real GPS.

Root `App.tsx` stays thin: it builds the real adapters and renders `AppShell`.
Nothing else in the tree constructs an adapter.

## Acceptance Criteria

Throughout, `POINT` is the seed point at `{ latitude: 60.1699, longitude: 24.9384 }` with `radiusMeters: 20`; `INSIDE` is `{ latitude: 60.1700708711, longitude: 24.9384 }`, 19 m away; `OUTSIDE` is `{ latitude: 60.1707993216, longitude: 24.9384 }`, 100 m away.

### AC1: The map state shows the map screen
**Given** `AppShell` rendered with a location source that emits nothing
**When** the first render settles
**Then** the text `© OpenMapTiles Data from OpenStreetMap` is present, and no node reads `Avaa tehtävä` or `5 + 2 = ?`

### AC2: Walking into range offers the puzzle
**Given** `AppShell` rendered with `seed = [POINT]`
**When** the location source emits `INSIDE`
**Then** exactly one element with the text `Avaa tehtävä` is present

### AC3: Collecting at the puzzle point shows the puzzle as plain text
**Given** the state reached in AC2 and a puzzle source scripted to draw `5 + 2 = ?`
**When** the `Avaa tehtävä` element is pressed and the draw resolves
**Then** exactly one node reads `5 + 2 = ?`, no node reads `Avaa tehtävä`, and no camera preview is present

The source is asynchronous, so the puzzle arrives after the press rather than
during it. And there is no camera here: the puzzle is read while walking to
somewhere else, so it is ordinary text on every platform. See `pair-flow.md`.

### AC4: Walking to the answer point and typing the code reaches the congratulation
**Given** the state reached in AC3
**When** the player returns to the map, walks into the answer point's radius, presses `Syötä koodi`, and presses `7` then `OK`
**Then** exactly one node reads `Oikein! Laatikko aukesi.`

The route is the feature: the puzzle is handed out at one point and answered
at another, so this criterion walks between them rather than solving on the
spot.

### AC5: Stored points are merged with the seed, and loaded once
**Given** `seed = [POINT]` and a point store holding one point with `id: "p2"`
**When** `AppShell` has mounted and settled
**Then** the map renders two markers, and the store's `loadStoredPoints` has been called exactly once

### AC6: The location subscription is cancelled on unmount
**Given** `AppShell` mounted with a location source that records its unsubscribe
**When** the component unmounts
**Then** the unsubscribe has been called exactly once

### AC7: Solved progress does not survive a restart
**Given** a point solved as in AC4
**When** `AppShell` is unmounted and mounted again with the same point store
**Then** no node reads `Oikein! Laatikko aukesi.`, and the map attribution is present

### AC8: The mock location source emits its scripted coordinates in order
**Given** `createMockLocationSource([INSIDE, OUTSIDE])`
**When** `watch` is called with a recording callback and the source is advanced twice
**Then** the callback has received `INSIDE` then `OUTSIDE`, in that order

### AC9: A cancelled mock source stops emitting
**Given** `createMockLocationSource([INSIDE, OUTSIDE])` advanced once and then cancelled
**When** the source is advanced again
**Then** the callback has been called exactly once

### AC10: A device that never moves still gets a position
**Given** `createLocationSource` over a provider whose current position is `INSIDE` and which never reports a change
**When** `watch` is called with a recording callback
**Then** the callback receives `INSIDE` exactly once

The app watched for position *changes* and never asked for the position it
already had: `watchPositionAsync` with `distanceInterval: 1` notifies after a
metre of movement, and `getCurrentPositionAsync` was never called. A laptop on
a desk therefore produced no position at all, the state machine stayed in
`MAP`, and the screen showed a map and nothing else.

No test could have caught it, because catching it required *not* moving —
Playwright's geolocation override works by changing the position, which is
exactly the movement the real app was waiting for. It took someone sitting
still to find it.

### AC11: Movement after the first position is delivered too
**Given** the same source, watched
**When** the provider reports a change to `OUTSIDE`
**Then** the callback has received `INSIDE` and then `OUTSIDE`, in that order

### AC12: Cancelling before the first position arrives delivers nothing
**Given** `createLocationSource` over a provider whose current position has not yet resolved
**When** `watch` is cancelled and the provider then resolves
**Then** the callback is never called

### AC13: A position that never arrives says why
**Given** `createLocationSource(provider, report)` where the provider's `getCurrent` rejects with `new Error('location permission was not granted')`
**When** `watch` is called
**Then** `report` is called exactly once with that error, and the position callback is never called

### AC14: A failing watch says why too
**Given** the same, where `watch` rejects with `new Error('no position available')`
**When** `watch` is called
**Then** `report` has been called with that error

The adapter used to end both promises with `.catch(() => undefined)`, which
made a denied permission, a device with no fix and a timeout indistinguishable
from "still looking" — to the player *and* to whoever was debugging. That
silence is what turned a one-line problem into an hour of probing the browser,
the WebGL context, MapLibre's worker and Viro's source.

Two separate decisions live here and only one had been made. Not showing the
player a location status is a scope decision, and it stands. Throwing the
reason away was never decided at all; it was a reflex to avoid an unhandled
rejection.

`report` defaults to a local `console.warn`. It carries the reason a position
failed, never a position — the guardrail in AGENTS.md is that the player's
location never leaves the device, and this does not send anything anywhere.

## Files to Modify
| File | Change |
|---|---|
| `src/adapters/location.ts` | `LocationSource`, `createMockLocationSource`, and `createLocationSource` over a `PositionProvider` |
| `src/adapters/location.test.ts` | New. AC8 and AC9 |
| `src/ui/AppShell.tsx` | New. The composition: reducer, subscription, screen routing |
| `src/ui/AppShell.test.tsx` | New. AC1–AC7 |
| `App.tsx` | Replaces the placeholder: builds the real adapters and renders `AppShell` |

## Risk
- **What could break:** everything, because this is the first file that joins
  the parts. The failure mode it guards against is a green test suite and a
  dead app, which is exactly the state the repo is in right now.
- **The root `App.tsx` is not covered by any criterion.** It builds the real
  `expo-location`, `expo-camera` and `expo-audio` adapters, none of which run
  under jsdom. It is kept to a handful of lines for that reason, and it is the
  first thing to suspect if the app misbehaves while the tests pass.
- **Rollback:** restore the placeholder `App.tsx`. `AppShell` and the location
  adapter are additive; nothing already green depends on them.

## Testing Strategy (MANDATORY)
| Function | Case | Given | When | Then |
|---|---|---|---|---|
| `AppShell` | happy path | no location emitted | rendered | attribution present, no `Avaa tehtävä`, no puzzle text (AC1) |
| `AppShell` | happy path | seed with one point | location emits `INSIDE` | one `Avaa tehtävä` (AC2) |
| `AppShell` | happy path | near a point, camera granted | `Avaa tehtävä` pressed | one `5 + 2 = ?`, no offer left (AC3) |
| `AppShell` | happy path | puzzle open | keys `7` then `OK` | one `Oikein! Laatikko aukesi.` (AC4) |
| `AppShell` | happy path | store holds `p2` | mounted | two markers, one `loadStoredPoints` call (AC5) |
| `AppShell` | edge case | store empty | mounted | one marker (AC5) |
| `AppShell` | edge case | mounted | unmounted | unsubscribe called once (AC6) |
| `AppShell` | edge case | a solved point | remounted | no congratulation, attribution present (AC7) |
| `createMockLocationSource` | happy path | two coordinates | advanced twice | both delivered in order (AC8) |
| `createMockLocationSource` | edge case | cancelled after the first | advanced again | callback called once (AC9) |
| `createMockLocationSource` | boundary | empty list | advanced | callback never called, no throw |
| `createLocationSource` | happy path | provider with a current position, no changes | watched | that position once (AC10) |
| `createLocationSource` | happy path | provider reports a change | watched | current then changed, in order (AC11) |
| `createLocationSource` | edge case | cancelled before the current position resolves | provider resolves | callback never called (AC12) |
| `createLocationSource` | error case | `getCurrent` rejects | watched | `report` called once with the error, no position (AC13) |
| `createLocationSource` | error case | `watch` rejects | watched | `report` called with the error (AC14) |

## Spec Readiness checklist
- [x] Every AC has a precise expected value — no "works correctly"
- [x] Another person could write a test from each AC without asking
- [x] Every AC can fail — one that cannot fail proves nothing
- [x] Error and edge cases have ACs of their own
- [x] Every AC appears in the testing strategy table
