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
- `scripts/ensure-local-points.mjs` printed a template that had stopped being
  valid: no `role`, no `pairId`, and a single point where the game now needs a
  whole pair. Anyone following it got a point dropped silently by
  `isEscapePoint` or by `withCompletePairs`, with nothing on screen to say why.
  Introduced in rounds 3 and 4, when the fields became required, and not
  noticed until someone asked how the local file works. Corrected: the template
  is a whole pair and names the three ways a point disappears without an error.
- **Two actionable points at the same distance are resolved by array order,
  and the player cannot see that.** `nearestPointInRange` keeps the first point
  with a strictly smaller distance, so when a pair's puzzle point and answer
  point sit at the same coordinates the puzzle point always wins and the answer
  point can never be reached — `Syötä koodi` never appears and the pair is
  unfinishable. Found by a browser run against a local pair whose two points
  were in the same place: the smoke timed out waiting for the offer.
  Two candidate rules, neither implemented: a pair's puzzle point could stop
  being actionable once its puzzle has been drawn (it has nothing left to
  hand out), or a tie could prefer the point the player has not yet used.
  The first also removes an oddity that exists today — standing at a collected
  puzzle point still offers `Avaa tehtävä`, which re-shows the puzzle rather
  than collecting anything.
- ~~RESOLVED~~ The shadowing above is fixed: `actionablePoints` now drops the
  puzzle point of a pair whose puzzle has been drawn (`pair-flow.md` AC28).
  Proven by the browser run that previously timed out — it walks a pair whose
  two points share a location through to the congratulation.
- `AppShell.collect` checks `progressFor` before asking the source, which no
  longer prevents anything: a collected puzzle point is not actionable, so the
  callback cannot fire for a known pair. It also never protected against the
  case that would matter — two taps before the state updates both see no
  progress and both call `draw`. Correctness holds either way, because
  `transition` keeps the first puzzle (AC4); the cost is one wasted call, which
  will be a network round trip once the source is an agent. Noted, not changed.
- ~~RESOLVED~~ **Three seed points were named after places they were not at.**
  `points.json` called its first point `Senaatintori`, but the coordinates came
  from a week 1 test fixture — a number chosen to make a distance assertion
  exact — roughly 800 m from the real Senate Square, near Mannerheimintie. The
  points added in round 15 were derived by adding metres to that wrong origin
  and given landmark names of their own, so the invention compounded. Found by
  someone who recognised the street on the map, not by any test: no criterion
  can check that a name matches a place. Resolved by renaming rather than
  moving — the distances are what the tests and the smoke run rely on, and a
  name that describes the point cannot be wrong about a place it does not
  claim.
- **An "offline" test made a real network call with a real key, and passed for
  the wrong reason.** `agents/puzzle-agent` tests deleted `GEMINI_API_KEY` with
  `monkeypatch.delenv` and then imported the subagent — but importing it runs
  `load_agent_environment()`, which loads `.env.local` from a parent directory
  and puts the key straight back. The test only failed because the model
  answered 404. The key is now forced absent at `api_key()`, the function that
  reads it, and a separate test refuses socket connections for the whole
  offline path. Anything in this kit that deletes env vars to simulate "no key"
  has the same hole.
- ~~RESOLVED~~ **`gemini-2.5-flash` answers `404 NOT_FOUND`, and the key is
  not the reason.** The first note here said only "404 for the key on this
  machine", which is true and points the next reader at the wrong thing.
  `client.models.list()` succeeds with that key and does not return
  `gemini-2.5-flash` at all: the 2.5 line survives only as native-audio
  variants, and the text models are the 3.x generation. A bad or truncated key
  answers 401 or 403, never 404 on a model name — that difference is the whole
  diagnosis. The agent's default is now `gemini-3.5-flash`, the most stable
  non-preview flash the key lists, still overridable with `GEMINI_MODEL`.
  **The kit itself still defaults to `gemini-2.5-flash`** in
  `agents/gemini_agent.py` and `agents/homework-coach-agent/subagents/coach_narrator.py`;
  those are the upstream author's files and are left unmodified.
- **The agent endpoint is `localhost` and a phone is not the development
  machine.** `src/config/agent.ts` points at `http://localhost:8002`, which is
  right for the web build and wrong on a device, where it is the phone itself.
  A device run needs the machine's address on the same network. The game does
  not break — an unreachable agent falls back to the local generator and says
  so — but the agent will simply never be used on a phone until this is set.
- The kit's `agents/homework-coach-agent/memory/data/` is still not gitignored
  by name; the pattern added for `agents/*/memory/data/*` now covers it, but
  the example agent's own `.gitkeep` was committed before that rule existed.
- **The 20-puzzle eval measured the API quota, not the puzzles.** The key's
  free tier ran out during request 6; requests 7 to 20 all failed with `429
  RESOURCE_EXHAUSTED` and never got a puzzle written. Five puzzle texts exist
  out of twenty requested. 59 model calls, 241 s. Four puzzles passed every
  check; one request died on 503s and two 20-second timeouts. **No attempt was
  ever rejected by the schema check or the duplicate check**, and solve-back
  reached a verdict at most five times — so this run says almost nothing about
  how often the model writes an unusable puzzle. A rerun needs either a paid
  tier or a delay between requests; both are decisions for the person who asked
  for the measurement, so nothing was changed.
- **The eval harness pairs solver calls to the wrong attempt.**
  `eval/run_eval.py` records writer calls and solver calls in two lists and
  pairs them by attempt number; a failed writer attempt makes no solver call,
  so every later pairing in that request is off by one. Request 1 is labelled
  "solve-back — solver said None" on the attempt it was accepted on. The
  `Result:` lines come from the loop and are correct; the per-attempt verdict
  lines are not. Corrected in the eval file's header, left unfixed in the code.
- **Three attempts against a rate-limited API is three refusals, not three
  tries.** `MAX_ATTEMPTS` retries immediately, so a 429 becomes three 429s in a
  row and the player is told the agent gave up. Whether retries should back off,
  or whether a quota error should stop retrying at all, is a design decision —
  recorded, not taken.
- ~~RESOLVED~~ **`agent_env.py` loads every `.env` and `.env.local` from here to the
  filesystem root.** Now loads its own folder only — `puzzle-agent.md` AC16,
  AC17; the key moved to `agents/puzzle-agent/.env.local`. The walk is `while directory != directory.parent`, so on
  this machine it reads six directories and loads two files; on another it
  loads whatever happens to sit on the path. The agent needs one value from
  them, the API key. Everything else those files hold ends up in the process
  environment of a program that talks to a third party. The file comes from the
  kit and is copied unchanged into every agent built on it. Not a vulnerability
  today — nothing puts environment values into a prompt — but it is the widest
  private-data surface the agent has, and it is wider than its job.
- **The model's own output re-enters prompts by two routes**, and one of them
  goes through a file. The written puzzle is sent to the solver
  (`SOLVER_PROMPT + text`), and past puzzles come back from
  `memory/data/issued_puzzles.json` into the writer's "do not repeat these"
  block. The blast radius today is narrow: the solver's reply is reduced to the
  first integer by a regex and compared, it has no tools and no file access, and
  the writer's output passes `check_schema` first. The worst case is an
  unusable puzzle passing solve-back, not an exfiltration. But
  `issued_puzzles.json` is a prompt-injection surface, and that matters the day
  anything other than the agent can write to it.
- **The kit advertises `google_search`, `url_context` and `code_execution`** in
  `agents/AGENTS.md`. This agent uses none of them, which is why it sits at two
  of the fatal three rather than all three. Adopting the first two would put
  untrusted content straight into a prompt that runs beside loaded environment
  files and an outbound HTTPS client. Worth a deliberate decision rather than a
  copy-paste from the example.
