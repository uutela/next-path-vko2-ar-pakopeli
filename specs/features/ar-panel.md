# Feature: AR puzzle panel

**Status:** Done

## Problem Statement
This is the feature the whole project exists for: standing at the point, the
player raises the phone and a panel anchored in the world shows a sum and a
keypad. It is also the riskiest — anchored AR needs camera permission,
surface tracking and daylight, none of which can be verified from a desk.
Everything that *can* be decided without the device is therefore specified
here as text and value, so field testing is left to test only what genuinely
needs the field.

## Proposed Change
`src/ui/ArScreen.tsx` opens the camera and hosts an anchored panel rendered by
`src/ui/PuzzlePanel.tsx`. The panel is one object: puzzle text on top, the
keypad below, both anchored together. Pressing a key means touching the
screen where that key appears.

All text the player reads is Finnish; identifiers and comments are English.
The screen holds no game rules — it renders `GameState` and sends
`GameEvent`s to `transition`.

## Acceptance Criteria

Throughout, the panel is rendered with `screen` = `{ kind: 'ANSWER', pairId: "a", input: "" }` and `puzzle` = `{ text: "5 + 2 = ?", answer: 7 }`. The criteria below name this pair of props `PUZZLE_STATE` for continuity with the text that follows.

**The panel serves the answer point.** Since `pair-flow.md`, the puzzle is
handed out at one point and answered at another: the puzzle itself is read on
an ordinary React Native screen, and this anchored panel is the keypad at the
answer point. It therefore takes a screen and a puzzle rather than a state that
carried both — the panel still holds no rules, which is why every criterion
below survived the change unedited.

### AC1: Opening the puzzle starts the camera
**Given** the camera adapter reports permission `granted` and state `PUZZLE_STATE`
**When** `ArScreen` is rendered
**Then** exactly one camera preview is present

This slot previously held "standing at a point offers to open the puzzle",
which put the `Avaa tehtävä` button on this screen. That could not work: the
AR screen appears only in `PUZZLE` and `SOLVED`, so a button rendered here
could never be pressed in `NEAR`, the state that fires it. It now lives in
`map-view.md` as AC8 and AC9.

### AC2: The panel states the sum in the documented format
**Given** `PUZZLE_STATE`
**When** the panel is rendered
**Then** exactly one text node reads `5 + 2 = ?`

### AC3: The keypad has twelve keys
**Given** `PUZZLE_STATE`
**When** the panel is rendered
**Then** it contains exactly twelve pressable keys, labelled `0`–`9`, `C` and `OK`

### AC4: A pressed digit appears in the input display
**Given** `PUZZLE_STATE`
**When** the key labelled `7` is pressed
**Then** a `DIGIT_PRESSED` event with `digit: "7"` is dispatched exactly once, and the input display reads `7`

### AC5: The input display is empty when the input is empty
**Given** `PUZZLE_STATE` with `input: ""`
**When** the panel is rendered
**Then** the input display node exists and its text is the empty string

### AC6: Pressing OK submits
**Given** `PUZZLE_STATE` with `input: "7"`
**When** the key labelled `OK` is pressed
**Then** a `SUBMIT` event is dispatched exactly once

### AC7: Solving replaces the panel text with the congratulation
**Given** state `{ kind: 'SOLVED', point: POINT }`
**When** the panel is rendered
**Then** exactly one text node reads `Oikein! Laatikko aukesi.`, and no node reads `5 + 2 = ?`

### AC8: The fanfare plays once on solving
**Given** the panel rendered in `PUZZLE_STATE`
**When** the state changes to `{ kind: 'SOLVED', point: POINT }`
**Then** the audio adapter's `play` is called exactly once with the fanfare asset

### AC9: The fanfare does not replay on re-render
**Given** the panel already rendered in the `SOLVED` state with the fanfare played
**When** the panel re-renders with the same state
**Then** the audio adapter's `play` has still been called exactly once in total

### AC10: A wrong answer keeps the puzzle on screen
**Given** `PUZZLE_STATE` with `input: "8"`
**When** `OK` is pressed and the state machine returns `input: ""`
**Then** the text node still reads `5 + 2 = ?`, the input display is empty, and no congratulation text is present

### AC11: Denied camera permission explains itself and does not open the panel
**Given** the camera adapter reports permission `denied`
**When** the screen is rendered in `PUZZLE_STATE`
**Then** exactly one text node reads `Kamera tarvitaan tehtävän avaamiseen.`, and no keypad key is present

### AC12: The reset control returns to the map
**Given** state `{ kind: 'SOLVED', point: POINT }`
**When** the element with the text `Aloita alusta` is pressed
**Then** a `RESET` event is dispatched exactly once

### AC13: The clear key empties a mistyped input
**Given** `PUZZLE_STATE` with `input: "12"`
**When** the key labelled `C` is pressed
**Then** a `CLEAR` event is dispatched exactly once, and the input display reads the empty string

### AC14: The clear key on empty input is harmless
**Given** `PUZZLE_STATE` with `input: ""`
**When** the key labelled `C` is pressed
**Then** a `CLEAR` event is dispatched exactly once, the input display is still empty, and nothing is thrown

### AC15: Every key is large enough to hit at arm's length
**Given** `PUZZLE_STATE`
**When** the panel is rendered and each key's style is read
**Then** every one of the twelve keys is at least `0.24` wide and `0.24` high in Viro's units, and `PANEL_DISTANCE_METRES` is at most `2.8`

Viro measures its layout in metres of world space, not in React Native points,
even though `ViroStyle` is declared as `ViewStyle & ShadowStyleIOS` and so
accepts `minWidth` without complaint. An earlier version of this criterion
asked for 48 x 48 points; written against a Viro panel that would have meant
48 metres, and the test would have passed while asserting nonsense — the worst
kind of green.

The numbers are an angular size, and only the angle matters to a player: a
0.24 m key at 2.4 m subtends 5.72 degrees, which is exactly what a 0.06 m key
at 0.6 m subtended. Four times the geometry at four times the distance looks
identical.

The panel was built at the smaller scale first and the device showed why that
fails. Viro's text is sized in points against world units, and at a 0.06 m key
no font size worked: 8 rendered nothing at all, and 12 already overflowed the
key and was clipped to fragments. The title at 14 spilled off the top of a
0.44 m panel, which put one glyph at roughly 0.08 m — taller than a key. The
geometry was too small for the type, so the geometry moved rather than the
type.

That is also why the distance bound is 2.8 m rather than arm's length. Nothing
is reached out and touched here: a key is aimed at by pointing the phone, and
the angle is what decides whether it can be hit.

### AC16: The panel inside the AR scene sees the current state
**Given** `ArScreen` rendered with camera permission `granted` and `PUZZLE_STATE` with `input: ""`
**When** it re-renders with `input: "12"`
**Then** the panel's input display reads `12`

Every other panel criterion renders `PuzzlePanel` directly, so none of them
cross the AR navigator — and that seam is where the state can be lost.
`ViroARSceneNavigator` stores `initialScene` in its **constructor** and never
re-reads it, while its own comment marks `viroAppProps` as the channel
"updated with the latest given props on every render". A scene passed as a
closure is therefore frozen at mount: the player would press keys, the state
machine would update, and the anchored panel would show the input it had when
the camera opened.

Testing this needs a stand-in that reproduces both behaviours — capture the
scene once, refresh `viroAppProps` every render. A stand-in that simply calls
the scene function again each time would hide the defect entirely.

### AC17: The web build never reaches Viro
**Given** the source tree
**When** the non-test files importing `@reactvision/react-viro` are listed
**Then** they are exactly `src/ui/ArScreen.tsx` and `src/ui/PuzzlePanel.tsx`, and neither `src/ui/ArScreen.web.tsx` nor `src/ui/PuzzlePanel.web.tsx` imports any of them

`specs/architecture.md` already required this — "the AR screen has no web
implementation; on web the app shows the map and says so" — but nothing
enforced it, and the rule was broken without any test noticing. `AppShell`
imported `ArScreen` unconditionally, Metro resolved Viro's `.web.js` files,
and a peer dependency that **is not published at all** (`npm view
@reactvision/viro-web-renderer` returns 404) took down the whole web bundle,
map screen included. A criterion exists here because an architecture rule with
no criterion is a comment.

### AC18: The web panel behaves exactly like the anchored one
**Given** `PuzzlePanel` resolved for web
**When** the panel criteria AC2 to AC14 are run against it unchanged
**Then** every one passes, with the same texts, the same twelve keys, the same events and the same single fanfare

The two panels are separate implementations of one behaviour, so the suite is
written once and run against both rather than copied. Anything that differs
between them is a rendering primitive, never a rule: the rules live in
`domain/` and neither panel holds any.

### AC19: Every web key is large enough to press
**Given** `PuzzlePanel` resolved for web, rendered with `PUZZLE_STATE`
**When** each key's style is read
**Then** every one of the twelve keys has both `minWidth` and `minHeight` of at least `48`

Points here, not metres. AC15 measures the Viro panel in world space because
that is what Viro lays out in; this one measures ordinary React Native views
in points. Same intent, different unit.

### AC20: The web puzzle screen shows the panel and no camera
**Given** the `ArScreen` resolved for web and `PUZZLE_STATE`
**When** it is rendered, with the camera adapter reporting `denied`
**Then** the panel's puzzle text `5 + 2 = ?` is present, no `video` element exists, and no node reads `Kamera tarvitaan tehtävän avaamiseen.`

The camera permission is deliberately the *denied* one here: web must not
consult it at all. An earlier pair of criteria had web open a camera preview
and explain a denied permission; both are gone, because the web build now uses
no camera. A camera needs a permission prompt and a secure context, and asking
a stranger for either before they can try a puzzle is the opposite of easy.

### AC22: The keypad is laid out as a telephone keypad
**Given** either panel implementation rendered with `PUZZLE_STATE`
**When** the keypad's rows are read
**Then** there are exactly four rows of exactly three keys, reading `1 2 3`, `4 5 6`, `7 8 9`, `C 0 OK`

`specs/ui-ux.md` has always shown this layout and given the reason — a player
should not have to read a keypad — but nothing enforced it, and the web panel
rendered four columns of three because its keys wrapped on width. AC3 did not
catch it: twelve keys in the right order can still be in the wrong shape. The
rows are therefore structural rather than a consequence of wrapping, so the
criterion can be checked without a layout engine.

### AC23: The panel is visible from behind
**Given** the anchored panel rendered with `PUZZLE_STATE`
**When** the material it applies to its background is read
**Then** that material has `cullMode: 'None'`

A Viro quad is single-sided by default, so walking around the panel made it
disappear — reported from the field. `cullMode: 'None'` draws both faces, which
makes the box findable from any direction. The text on the far side is
mirrored, which is what a flat sign does and is not worth a second panel.

The criterion asserts the material rather than the appearance, because no test
here can see a pixel: the anchored panel is rendered through a stand-in that
turns Viro into `div`s. What it *can* prove is that the component asks for a
double-sided surface, and the field is where the rest is confirmed.

## Files to Modify
| File | Change |
|---|---|
| `src/ui/ArScreen.tsx` | New. Camera, permission handling, hosts the panel |
| `src/ui/PuzzlePanel.tsx` | New. Anchored panel: puzzle text, input display, keypad |
| `src/ui/PuzzlePanel.test.tsx` | New. AC1–AC10 and AC12–AC15 against the rendered output |
| `src/ui/ArScreen.test.tsx` | New. AC11 with a fake camera adapter |
| `src/ui/ArScreen.web.tsx` | The puzzle panel on a plain background; no camera |
| `src/ui/PuzzlePanel.web.tsx` | New. The same panel drawn as React Native views |
| `src/ui/panelBehaviour.ts` | New. The panel suite AC2–AC14, run against both implementations |
| `src/ui/ArScreen.web.test.tsx` | AC17 and AC20 |
| `src/ui/PuzzlePanel.web.test.tsx` | New. AC18 and AC19 |
| `src/adapters/audio.ts` | New. `play(asset)` behind an adapter so AC8 and AC9 are testable |
| `scripts/generate-fanfare.mjs` | New. Synthesises the fanfare from a score in the source; no dependencies |
| `assets/fanfare.wav` | Generated by that script. 1.45 s, mono, 44.1 kHz, 16-bit PCM |

## Risk
- **What could break:** this screen is where the anchored panel, the camera
  and the state machine meet. AC1–AC12 all run in a test renderer without a
  device, so a break here is caught before the field, but none of them prove
  the panel is *anchored* — only that it renders the right things.
- **Field-only risks, which no AC above covers:** surface tracking in bright
  sunlight, on grass or plain asphalt, and whether the panel is legible
  against a bright sky. These need a visit to the demo location before the
  demo. Key size used to be on this list; AC15 moved most of it onto the desk,
  since a target too small to hit is the failure most likely to ruin a demo
  and the least excusable to discover outdoors.
- **What AC15 does not prove.** It asserts the styles that produce a 48 point
  target, not the pixels that result. jsdom has no layout engine, so no test
  here can measure anything — see `specs/tech-stack.md`. A style that is
  correct but overridden by a parent, or a panel scaled down in 3D space,
  would still pass. The rendered size is confirmed once, on the device, at
  the same field visit as tracking and legibility.
- **The fanfare carries no licence risk**: it is synthesised by
  `scripts/generate-fanfare.mjs`, which is in the repo, so the asset is our
  own work with no third-party terms attached. Regenerating it is one
  command, and changing how it sounds is editing a score in source.
- **A generated WAV is uncompressed** — 128 KB for 1.45 s. Acceptable for one
  asset; if more sounds are added later, this is the point to reconsider.
- **Rollback:** delete `ArScreen.tsx` and fall back to rendering
  `PuzzlePanel` over a plain camera preview without anchoring. This is the
  documented cut in the PRD, and the panel and its tests survive it.

## Testing Strategy (MANDATORY)
| Function | Case | Given | When | Then |
|---|---|---|---|---|
| `ArScreen` | happy path | permission `granted`, `PUZZLE` | rendered | one camera preview (AC1) |
| `PuzzlePanel` | happy path | puzzle `5 + 2` | rendered | text `5 + 2 = ?` (AC2) |
| `PuzzlePanel` | happy path | `PUZZLE_STATE` | rendered | twelve keys, `0`–`9`, `C` and `OK` (AC3) |
| `PuzzlePanel` | happy path | `PUZZLE_STATE` | key `7` pressed | one `DIGIT_PRESSED` with `"7"`, display reads `7` (AC4) |
| `PuzzlePanel` | boundary | `input: ""` | rendered | display present, text empty (AC5) |
| `PuzzlePanel` | happy path | `input: "7"` | key `OK` pressed | one `SUBMIT` (AC6) |
| `PuzzlePanel` | happy path | `SOLVED` | rendered | text `Oikein! Laatikko aukesi.`, no puzzle text (AC7) |
| `PuzzlePanel` | happy path | `PUZZLE` → `SOLVED` | state changes | `play` called once (AC8) |
| `PuzzlePanel` | edge case | already `SOLVED` | re-rendered | `play` still called once in total (AC9) |
| `PuzzlePanel` | error case | wrong answer submitted | state returns `input: ""` | puzzle text unchanged, display empty, no congratulation (AC10) |
| `ArScreen` | error case | camera permission `denied` | rendered | text `Kamera tarvitaan tehtävän avaamiseen.`, no keys (AC11) |
| `ArScreen` | error case | camera permission `undetermined` | rendered | permission is requested exactly once |
| `ArScreen` | edge case | permission `granted`, input `""` then `"12"` | re-rendered | panel input display reads `12` (AC16) |
| source tree | happy path | all non-test files | searched for the Viro import | only `ArScreen.tsx` and `PuzzlePanel.tsx` (AC17) |
| source tree | happy path | both `.web.tsx` files | imports inspected | neither imports Viro (AC17) |
| `PuzzlePanel` (web) | happy path | the shared panel suite | run against the web panel | AC2–AC14 all pass (AC18) |
| `PuzzlePanel` (web) | boundary | `PUZZLE_STATE` | each key's style read | every key `minWidth` and `minHeight` >= 48 (AC19) |
| both panels | happy path | `PUZZLE_STATE` | keypad rows read | four rows of three, `1 2 3` / `4 5 6` / `7 8 9` / `C 0 OK` (AC22) |
| `PuzzlePanel` (anchored) | happy path | the panel material | read | `cullMode: 'None'` (AC23) |
| `ArScreen` (web) | happy path | permission `denied`, `PUZZLE_STATE` | rendered | panel text present, no `video`, no camera notice (AC20) |
| `PuzzlePanel` | happy path | `SOLVED` | `Aloita alusta` pressed | one `RESET` (AC12) |
| `PuzzlePanel` | happy path | `PUZZLE_STATE` with `input: "12"` | key `C` pressed | one `CLEAR`, display empty (AC13) |
| `PuzzlePanel` | edge case | `PUZZLE_STATE` with `input: ""` | key `C` pressed | one `CLEAR`, display still empty, no throw (AC14) |
| `PuzzlePanel` | boundary | `PUZZLE_STATE` | each key's style read | every key >= 0.06 x 0.06 Viro units, `PANEL_DISTANCE_METRES` <= 0.7 (AC15) |

## Spec Readiness checklist
- [x] Every AC has a precise expected value — no "works correctly"
- [x] Another person could write a test from each AC without asking
- [x] Every AC can fail — one that cannot fail proves nothing
- [x] Error and edge cases have ACs of their own
- [x] Every AC appears in the testing strategy table
