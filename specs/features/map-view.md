# Feature: Map view

**Status:** Done

## Problem Statement
The player needs to see where the point is before walking to it. The map must
work on iOS, Android and web from one set of decisions, must need no API key
or account, and must carry the attribution the tile licence requires — an
attribution that is missing is a licence breach, not a cosmetic bug.

## Proposed Change
One shared configuration module and two platform implementations resolved by
React Native's platform extensions:

- `src/config/map.ts` — the single source of the style URL and the
  attribution string. Nothing else in the app hard-codes either
- `src/ui/Map.tsx` — native, using `@maplibre/maplibre-react-native`
- `src/ui/Map.web.tsx` — web, using `maplibre-gl` with `react-map-gl`

Both render one marker per point and centre on the player. Both import the
style URL from `src/config/map.ts`; neither declares its own.

## Acceptance Criteria

### AC1: The style URL is defined exactly once
**Given** the source tree
**When** it is searched for the string `tiles.openfreemap.org`
**Then** the only match is in `src/config/map.ts`, and its exported value is `https://tiles.openfreemap.org/styles/liberty`

### AC2: Both platform maps read the shared constant
**Given** `src/ui/Map.tsx` and `src/ui/Map.web.tsx`
**When** their imports are inspected
**Then** both import `MAP_STYLE_URL` from `src/config/map.ts`

### AC3: The attribution string is exactly as the licence requires
**Given** `src/config/map.ts`
**When** the exported `MAP_ATTRIBUTION` is read
**Then** it is exactly `© OpenMapTiles Data from OpenStreetMap`

### AC4: The attribution is visible on the map
**Given** the map view rendered with one point
**When** the rendered output is queried for the text `© OpenMapTiles Data from OpenStreetMap`
**Then** exactly one text node reads `© OpenMapTiles Data from OpenStreetMap`, its computed `fontSize` is at least `11`, its computed `opacity` is at least `0.8`, and its `display` is not `none`

### AC5: One marker is rendered per point
**Given** the map view rendered with `points = [SEED_A, SEED_B]`
**When** the rendered output is queried for markers
**Then** exactly two markers are present, at the coordinates of `SEED_A` and `SEED_B`

### AC6: An empty point list renders a map with no markers
**Given** the map view rendered with `points = []`
**When** the rendered output is queried for markers
**Then** zero markers are present, the map container node is present in the render tree with a resolved style declaring `flex: 1`, and nothing is thrown

### AC7: No API key is present anywhere
**Given** the source tree
**When** it is searched for `apiKey`, `api_key`, `access_token` and `accessToken`
**Then** there are no matches

### AC8: Standing at a point offers what that point is for
**Given** state whose screen is `{ kind: 'NEAR', point }`
**When** `MapScreen` is rendered
**Then** exactly one pressable element is present: `Avaa tehtävä` when `point.role` is `"puzzle"`, and `Syötä koodi` when it is `"answer"`

Pressing `Avaa tehtävä` calls `onCollect(point.pairId)` and dispatches
**nothing**: collecting is not a transition, because the source is
asynchronous and the drawn puzzle comes back as its own event. Pressing
`Syötä koodi` dispatches `OPEN_ANSWER` exactly once. See `pair-flow.md`.

### AC15: The map draws what the player has earned
**Given** a state with pair `"a"` collected and points `[PUZZLE_A, ANSWER_A, PUZZLE_B, ANSWER_B]`
**When** `MapScreen` is rendered
**Then** it draws three markers — both points of pair `"a"` and the puzzle point of pair `"b"` — and none for `b-answer`

An answer point the player has not earned is not merely unmarked: it does not
exist for them. The map draws `visiblePoints(state, points)` rather than the
whole list.

### AC16: A collected puzzle can be re-read from the map
**Given** a state with pair `"a"` collected and unsolved
**When** `MapScreen` is rendered
**Then** exactly one element reads `Näytä pulma`, and pressing it dispatches `SHOW_PUZZLE` with `pairId: "a"` exactly once

The puzzle is needed while standing at the answer point, which is somewhere
else. Walking back to read it again would be the game punishing the player for
having a memory.

### AC9: The offer is absent when no point is in range
**Given** state `{ kind: 'MAP' }`
**When** `MapScreen` is rendered
**Then** no element with the text `Avaa tehtävä` is present

AC8 and AC9 were moved here from `ar-panel.md`, where AC1 had placed the
button on the AR screen. That could not work: `specs/ui-ux.md` shows the AR
screen appearing only in `PUZZLE` and `SOLVED`, so a button rendered there
could never be pressed in `NEAR` — the state in which it fires. The map screen
is what the player is looking at when they arrive.

### AC10: The web map loads MapLibre's stylesheet
**Given** `src/ui/Map.web.tsx`
**When** its imports are inspected
**Then** it imports `maplibre-gl/dist/maplibre-gl.css`

Without it the map loads its data and paints nothing: the tiles, the style and
the sprites all arrive, the canvas is created at full size with class
`maplibregl-canvas`, and the screen stays white. `Map.web.tsx` said in its own
comment that the web build "must also load maplibre-gl's stylesheet … in the
HTML shell", and nothing ever did — a rule written down with no criterion
behind it, the same shape as the missing platform split.

AC6 did not catch it, and could not: jsdom has no layout engine, so "the
container is present with `flex: 1`" is true of a blank map as well as a
drawn one. What a browser can check is in `scripts/browser-smoke.mjs`, which
samples the canvas and fails if every pixel is the same colour.

### AC11: The web map serves MapLibre's worker as JavaScript
**Given** the source tree
**When** `src/ui/Map.web.tsx` is inspected and `public/maplibre-gl-worker.mjs` is looked for
**Then** the module calls `setWorkerUrl` with `/maplibre-gl-worker.mjs`, and that file exists

`maplibre-gl` 6 loads its worker relative to `import.meta.url`, which Metro
does not rewrite. The request went to
`/node_modules/expo/maplibre-gl-worker.mjs`, and the dev server answered every
unknown path with the app's own `index.html` — HTTP 200, `text/html`, 1280
bytes of `<!DOCTYPE html>`. The worker was created with an HTML document as
its source, failed immediately and closed, and MapLibre without its worker
processes no tiles at all. That is why AC10 fixed the stylesheet and the map
still drew only its background: two separate faults with one symptom.

Serving a copy from `public/` and pointing `setWorkerUrl` at it makes the URL
one the dev server actually has. The copy is generated by `postinstall` and
gitignored, so it cannot drift from the installed version.

### AC12: The centre is the first point
**Given** `points = [POINT_A, POINT_B]`
**When** `initialCentre(points)` is called
**Then** it returns `[POINT_A.coordinates.longitude, POINT_A.coordinates.latitude]`

### AC13: With no points the centre falls back to a named constant
**Given** `points = []`
**When** `initialCentre(points)` is called
**Then** it returns `MAP_FALLBACK_CENTRE`

### AC14: The map centres where `initialCentre` says
**Given** the map rendered with `points = [POINT_A, POINT_B]`
**When** the camera it configures is read
**Then** its `center` is `initialCentre(points)`

The map centred on a hard-coded Senaatintori, so a point anywhere else was off
screen and the player saw a map of somewhere they were not. Nothing caught it:
AC5 asserts a marker per point and passes whether or not the marker is in
view, and no criterion said where the map should look. It was filed in
`INBOX.md` as "the map has no `Camera`" and left there, which is why it was
still true when it made a real diagnosis take an hour.

The centre is a pure function so both platforms share it and it can be tested
without rendering anything — the native map reads it through MapLibre's
`Camera`, the web map through `initialViewState`.

## Files to Modify
| File | Change |
|---|---|
| `src/config/map.ts` | New. `MAP_STYLE_URL` and `MAP_ATTRIBUTION`, exported as `const` |
| `src/ui/Map.tsx` | New. Native map with markers and attribution |
| `src/ui/Map.web.tsx` | New. Web map, same props, same constants |
| `src/ui/Map.test.tsx` | New. AC4–AC6 against the rendered output |
| `src/ui/MapScreen.tsx` | New. Composes the map with the offer to open a puzzle |
| `src/ui/MapScreen.test.tsx` | New. AC8 and AC9 |
| `src/config/map.test.ts` | New. AC1, AC3 and AC7 as source-level assertions |

## Risk
- **What could break:** an attribution that renders off-screen or behind
  another view still counts as missing. AC4 reads declared size, opacity and
  display; jsdom has no layout engine, so nothing here can measure position,
  overlap or contrast. A human confirms legibility against the map on a real
  phone — see `specs/tech-stack.md` for why the tests stop where they do.
- **OpenFreeMap has no SLA.** If the tile host is down the map is blank and
  the game is unusable. AC1 exists so that switching to self-hosted tiles is
  a one-line change rather than a hunt.
- **The web and native map libraries are different implementations** of the
  same style spec; they can diverge in rendering. Web is a bonus target, so a
  visual difference there is not a blocker.
- **Rollback:** delete the two `Map` files. The game cannot be played without
  a map, so there is no partial fallback — this is all or nothing.

## Testing Strategy (MANDATORY)
| Function | Case | Given | When | Then |
|---|---|---|---|---|
| `MAP_STYLE_URL` | happy path | the config module | read | equals the OpenFreeMap Liberty URL (AC1) |
| source tree | happy path | all files | searched for `tiles.openfreemap.org` | one match, in `src/config/map.ts` (AC1) |
| source tree | happy path | both Map files | imports inspected | both import `MAP_STYLE_URL` (AC2) |
| `MAP_ATTRIBUTION` | happy path | the config module | read | exactly `© OpenMapTiles Data from OpenStreetMap` (AC3) |
| `Map` | happy path | one point | rendered | attribution once, `fontSize` >= 11, `opacity` >= 0.8, `display` not `none` (AC4) |
| `Map` | happy path | two points | rendered | two markers at the given coordinates (AC5) |
| `Map` | boundary | zero points | rendered | zero markers, container present with `flex: 1`, no throw (AC6) |
| source tree | error case | all files | searched for key and token names | no matches (AC7) |
| source tree | happy path | `Map.web.tsx` | imports inspected | imports `maplibre-gl/dist/maplibre-gl.css` (AC10) |
| source tree | happy path | `Map.web.tsx` and `public/` | inspected | calls `setWorkerUrl('/maplibre-gl-worker.mjs')`, and the file exists (AC11) |
| `initialCentre` | happy path | two points | called | the first point's `[lng, lat]` (AC12) |
| `initialCentre` | boundary | no points | called | `MAP_FALLBACK_CENTRE` (AC13) |
| `Map` | happy path | two points | rendered | camera `center` equals `initialCentre(points)` (AC14) |
| `MapScreen` | happy path | `NEAR` | rendered | one pressable `Avaa tehtävä`; pressing dispatches one `OPEN_PUZZLE` (AC8) |
| `MapScreen` | boundary | `MAP` | rendered | no `Avaa tehtävä` element (AC9) |

| `MapScreen` | happy path | `NEAR` at an answer point | rendered | one `Syötä koodi`, press dispatches `OPEN_ANSWER` (AC8) |
| `MapScreen` | happy path | pair `a` collected, two pairs of points | rendered | three markers, none for `b-answer` (AC15) |
| `MapScreen` | happy path | pair `a` collected and unsolved | rendered | one `Näytä pulma`, press dispatches `SHOW_PUZZLE` `a` (AC16) |

## Spec Readiness checklist
- [x] Every AC has a precise expected value — no "works correctly"
- [x] Another person could write a test from each AC without asking
- [x] Every AC can fail — one that cannot fail proves nothing
- [x] Error and edge cases have ACs of their own
- [x] Every AC appears in the testing strategy table
