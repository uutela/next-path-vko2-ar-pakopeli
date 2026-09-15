# INBOX

One line per thing noticed while working. Not implemented, not detoured into.

- ~~RESOLVED~~ `proximity.md` AC6 claimed to pin the inclusive boundary ("standing exactly
  on the radius counts as inside"), but its coordinate measures 19.999997645 m
  against a 20 m radius, so the test passes with `<` as well as `<=`. The
  criterion did not prove what it said it proved. Resolved by correcting the
  spec first: the inclusivity claim was dropped and the criterion now states
  what its coordinate actually tests, with the exact-boundary behaviour left
  explicitly unspecified.
- ~~RESOLVED~~ `checkAnswer` used `parseInt`, which stops at the first non-digit, so
  `"7abc"`, `"7.9"`, `"+7"` and `"7e0"` all count as 7. No criterion covers
  these and the keypad cannot produce them — `appendDigit` only ever appends
  `0`-`9`. Resolved by hardening rather than closing: the spec gained AC13
  first, then the tests, then the implementation. The reason is the PRD —
  later projects read this repo as an example, and a domain function that
  silently accepts `"7abc"` is a worse example than one that does not.
- ~~RESOLVED~~ `loadStoredPoints` guarded unparseable JSON and non-arrays but
  not the shape of what was inside, so `[{"id":"p2","foo":1}]` reached
  `isWithinRadius` and threw `TypeError: Cannot destructure property
  'latitude' of 'undefined'` on the first location update — the app dying
  seconds after launch with no way back but clearing device storage. Filed
  here as a robustness note; the step 8 audit found it was a crash. Resolved
  by `isEscapePoint`, a pure guard covering shape *and* values, with AC11 to
  AC13.
- ~~RESOLVED~~ The map had no `Camera` and opened on a hard-coded Senaatintori,
  so a point anywhere else was off screen and the player saw a map of
  somewhere they were not. AC5 passed regardless — a marker per point is true
  whether or not the marker is in view — and no criterion said where the map
  should look. Filed here and left, which is why it was still true when it
  made a real diagnosis take an hour. Resolved by `initialCentre`, a pure
  function both platforms share: AC12, AC13 and AC14.
- ~~RESOLVED~~ `ArScreen` built the AR scene as a closure — `const scene = () => <ViroARScene><PuzzlePanel …/></ViroARScene>`
  — and Viro is given it once through `initialScene`. If Viro calls it only at
  mount, the panel would keep the props it captured then, and the typed input
  would never update on screen. No criterion covers the panel *inside* the AR
  scene (every panel criterion renders `PuzzlePanel` directly), so nothing
  catches this. **Confirmed from Viro's source, not left as a hypothesis:**
  `initialScene` is stored in the constructor and never re-read, while
  `viroAppProps` is refreshed every render by Viro's own admission. Resolved by
  a full cycle — `ar-panel.md` gained AC16, the test reproduces both behaviours
  so a frozen closure cannot hide, and `PuzzleScene` is now a module-level
  component fed through `viroAppProps`.
- ~~RESOLVED~~ The web map loaded its data but painted nothing, because
  `maplibre-gl`'s stylesheet was absent from the document. `Map.web.tsx` said
  in its own comment that the web build must load it, and nothing did — the
  same shape as the `ArScreen.web.tsx` omission: an obligation written down
  and enforced by no criterion. AC10 fixed that, and it turned out to be half
  the cause. The rest is the entry below.
- ~~RESOLVED~~ **`@reactvision/react-viro` and `@maplibre/maplibre-react-native` could not both
  be prebuilt.** Verified by isolation: MapLibre alone succeeds, Viro alone
  succeeds, both together fail in either plugin order with
  `[ios.podfile]: withIosPodfileBaseMod: Failed to match "/post_install do
  \|installer\|/"`. Viro's iOS plugin writes the Podfile directly through
  `withDangerousMod` and `fs.writeFile`, while MapLibre's operates on Expo's
  managed Podfile contents; MapLibre then sees a Podfile with no `post_install`
  block. This blocks every native build, so the AR half has never run. It
  touches a PRD decision — anchored AR *and* a MapLibre map — so it is a
  decision, not a bug fix. **Resolved by patching Viro.** Its iOS plugin read
  and wrote the Podfile with callback-based `fs.readFile`/`fs.writeFile` inside
  an async mod that returned before either completed, so the write landed at an
  arbitrary later time. Alone it usually won the race; beside another Podfile
  plugin it did not. `patches/@reactvision+react-viro+2.58.1.patch` makes both
  calls synchronous, and `postinstall: patch-package` reapplies it. Both
  libraries now prebuild and pod-install together: ViroReact 2.58.1, ViroKit
  1.0 and MapLibreReactNative 11.3.10 across 248 pods.
- **The app cannot run in the iOS simulator on Apple Silicon.** Viro's plugin
  sets `EXCLUDED_ARCHS[sdk=iphonesimulator*] = arm64`, which lands in the
  generated `project.pbxproj` at two places, leaving no architecture for a
  simulator build on an arm64 Mac. `xcodebuild -showdestinations` lists no
  concrete simulator even with an iPhone 17 Pro booted — only the placeholder.
  So the plan to drive the map screen with Appium in the simulator does not
  work, and every native run needs a physical device.
- ~~RESOLVED~~ **The web map still drew only its background** after the
  stylesheet was added. `maplibre-gl` 6 resolves its worker against
  `import.meta.url`, Metro does not rewrite that, and the dev server answered
  `/node_modules/expo/maplibre-gl-worker.mjs` with the app's own `index.html`
  — HTTP 200, `text/html`. A worker built from an HTML document dies on
  creation, and MapLibre without its worker processes no tiles at all, which
  is why not a single `.pbf` was ever requested and why no error appeared
  anywhere. AC11 points `setWorkerUrl` at a copy in `public/`, and **both**
  files are copied: the worker is an ES module whose first line imports
  `./maplibre-gl-shared.mjs`, and a module worker whose sibling import cannot
  resolve dies just as silently. The map now draws streets, buildings and
  labels, and the smoke run is green on tiles.
- Answers are compared as numbers (`checkAnswer` parses base 10), which is why
  `puzzle.md` AC8 accepts `"07"` for 7. That is right while answers come from
  `generatePuzzle`. The day an agent hands out a code whose leading zeros are
  meaningful — `"000042"` as distinct from `"42"` — the answer has to become a
  string and AC8 has to be revisited. Noted, not implemented.
- The puzzle source is async, so it can hang as well as fail. `pair-flow.md`
  AC23 covers a rejection with `PUZZLE_FAILED`, but a source that never
  resolves leaves the player standing at the point with no puzzle and no
  notice. A timeout belongs in the adapter, not the state machine. Noted, not
  implemented.
- ~~RESOLVED~~ **The browser smoke run was reported red on the forked tree. It
  was not.** Every run had gone to `http://localhost:8081`, which the smoke
  script defaults to and where a dev server for the *week 1* repository was
  already listening: `npx expo start` had printed "Port 8081 is running
  ar-pakopeli in another window /Users/null/Projects/next-path-vko1-ar-pakopeli"
  and then "Skipping dev server", so this project's server never started and
  every check ran against a different application. Repeating a wrong
  measurement is what made it look inherited — the stashed-clean control run
  hit the same foreign server. Started on port 8082 instead, this repo passes
  all fourteen checks with 0 console errors and 0 page errors. **No longer a matter of
  remembering:** `scripts/browser-smoke.mjs` now asks the dev server for its
  own project root before running a single check, and exits 1 if it is not this
  repository — proven against both servers. A forgotten port fails loudly
  instead of reporting someone else's app.
- An `expo-location` web defect was diagnosed in detail — instrumented
  `navigator.geolocation`, library source read, a replacement adapter written
  and tested — and none of it was real: it was the week 1 app being measured.
  The adapter was removed rather than kept "in case". The lesson is cheaper
  than the four rounds it cost: confirm the process under test belongs to the
  repository under test, before instrumenting anything.
