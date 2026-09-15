# looppi.md — the round loop for the two-point mechanic

Written in English like every other document in this repo; the prompts it came
from are Finnish and are recorded in `prompts2.md`. `AGENTS.md` still governs —
this file says which task to pick and how a round ends, not how to work.

One round does **one** task from the list in part 3. Tasks are cut so that one
round finishes one.

---

## 1. Steps run every round

1. **Pick** the topmost row in the task list whose Status is `TODO`. Do not
   skip ahead, do not take two.
2. **Spec, if the task is unclear.** If the task changes behaviour that no
   acceptance criterion covers, run the `spec` workflow first:
   `specs/features/<name>.md` from `specs/TEMPLATE.md`, every AC
   Given/When/Then with an exact expected value, and the Spec Readiness
   checklist genuinely ticked. Correcting an existing spec counts as this
   step. Commit the spec before touching `src/`.
3. **TDD**, per AGENTS.md, one AC at a time: RED (write the failing test for
   this AC alone, name it after the AC, run it, confirm it fails for the
   missing behaviour and not a broken import) → GREEN (smallest change that
   passes, run the whole suite) → REFACTOR (tests stay green).
4. **Clean run.** `npm test` and `npx tsc --noEmit` both exit 0, both run just
   now. An exit code that was not observed this round is not green.
5. **Review.** Compare the diff against the spec: which AC each change serves,
   what changed that no AC asked for, which tests prove what. End with
   `APPROVED` or `CHANGES_REQUIRED` — a verdict, not prose. `CHANGES_REQUIRED`
   keeps the task `TODO` and the round continues into a fix or stops on a cap.
6. **Browser test — web UI only.** Start the web build (`npm run web`) and run
   `node scripts/browser-smoke.mjs`, which walks the map half against
   `http://localhost:8081` and reports every check plus console and page
   errors. Required only for tasks that change something a browser can see.
7. **Mark done.** Status `TODO` → `DONE` in this file, spec Status `Draft` →
   `In Progress` → `Done`, and commit.

### What browser testing does and does not cover

Browser testing covers the **web UI only**. The AR panel cannot be verified in
a browser: there is no camera, the web build imports no Viro at all
(`ar-panel.md` AC17, AC20), and `ArScreen.web.tsx` deliberately renders the
panel on a plain background instead.

AR code **may** be changed. It is covered by **unit tests only** — the anchored
panel renders through a stand-in that turns every Viro element into a `div`, so
those tests prove what the component asks Viro to draw and never how Viro draws
it.

**No task may be marked `DONE` on the strength of AR behaviour that nobody
could observe.** If the only evidence for a task is how the panel would look on
a device, the task stays open and says so. The device is a separate field
round, not a round of this loop.

---

## 2. Guardrails

Read before the task list, and they outrank it.

- **Round cap: one task per round, eight rounds per session.** On the eighth,
  stop and report what is left, however close the ninth looks.
- **Time cap: 45 minutes per task.** Over it, stop and report — do not start
  the next task to make up time.
- **Two consecutive identical errors stop the loop.** Same failing test, same
  type error, same console error twice in a row: stop and report. Do not
  thrash.
- **New ideas go to `INBOX.md` as one line.** Not implemented, not detoured
  into, not this round.
- **Never touch `.env`, `.env.local` or `src/data/points.local.json`.** The
  local point file is hand-typed, gitignored and holds a place someone stands;
  `postinstall` creates it empty and nothing else may write it.
- **Never "fix" a failing test by editing the test.** The spec decides which of
  the two is wrong, and the spec is corrected first. This is how the
  two-character cap comes out: `puzzle.md` AC12 changes before
  `puzzle.test.ts` does.
- **Never run a command that deletes data.**
- **The player's location never leaves the device** — no analytics, no remote
  logging, no third party.

---

## 3. Task list

Goal: the map holds **pairs** of points. A **puzzle point** hands out a puzzle;
only then does its **answer point** appear on the map, and only on arriving
there does it open — an anchored AR panel with a keypad. The answer is
**at most six digits and may be shorter** — `5 + 2` is answered `7`, not
`000007`. The puzzle stays re-readable after it has been collected.
`points.json` holds the pairs and there may be several. `checkAnswer` stays the
only place an answer is decided.

**`points.json` holds places and nothing else** — no puzzle text, no answer.
The puzzle is produced at run time: `generatePuzzle` today, an AI agent later.
It therefore lives behind an adapter like every other source, and because an
agent answers over a network, that adapter is asynchronous from the start —
which moves the drawing out of `transition`, since a pure function cannot
await. A puzzle is drawn **once per pair** and kept; redrawing it while the
player walks to the answer point would change the code under their feet.

Settled, so Prio 1 specifies rather than asks:

- **Pairs are independent.** Each is solved on its own; collecting one pair's
  puzzle reveals only that pair's answer point. No chain, no order.
- **The answer point is on the map once its puzzle is collected**, and opens —
  the anchored panel — only inside its radius. Visible before it is reachable,
  or the player cannot walk to it.
- **The puzzle is re-read from a control on the map**, not by walking back. It
  is needed while standing at the answer point, which is somewhere else.
- **Collecting is a button press at the puzzle point**, as `NEAR` → `Avaa
  tehtävä` is today. Nothing opens on GPS wobble alone.
- **Six digits is a maximum, not a length.** A shorter answer is a valid
  answer, so nothing is zero-padded and `generatePuzzle` keeps its easy sum.

Prio 1 is next. `DONE` only when the row's own evidence has been observed. The
list is longer than one session's round cap; it carries over.

| Prio | Status | Task |
|---|---|---|
| 1 | DONE | **Spec the pair flow.** Write `specs/features/pair-flow.md` from `specs/TEMPLATE.md`, turning the four settled decisions above into criteria with exact values, plus: how a pair is linked in JSON, which states exist, that a puzzle is drawn once per pair and kept, and where the one-to-six-digit answer is enforced.<br>**Done when:** the file exists, every AC is Given/When/Then with an exact expected value, every AC appears in the testing strategy table, and `git show --stat` for its commit lists no file under `src/`. |
| 2 | DONE | **Lift the input cap to six.** Spec first: `puzzle.md` AC12 currently *requires* the two-character cap, so correct AC12 and the `MAX_INPUT_LENGTH` note before touching a test.<br>**Done when:** named tests assert `appendDigit("12", "3") === "123"` and that a seventh digit is refused, `npm test` and `npx tsc --noEmit` both exit 0. |
| 3 | TODO | **A point knows its role and its pair.** `EscapePoint` gains the role and the link tying a puzzle point to its answer point — places only, no puzzle and no answer. `isEscapePoint` validates both. `points-store.md` gains the ACs.<br>**Done when:** named tests show a point with an unknown role, and one whose pair link names no existing point, both rejected; the existing AC11–AC14 tests pass unchanged; `npm test` exits 0. |
| 4 | TODO | **One pair in the seed.** `src/data/points.json` holds a puzzle point and its answer point, linked, and carries no puzzle text and no answer.<br>**Done when:** `node -e "const p=require('./src/data/points.json');console.log(p.length, p.map(x=>x.role).join(','), JSON.stringify(p).includes('answer'))"` prints `2`, the two roles, and `false`; `npm test` exits 0; `git status --short` shows `src/data/points.local.json` unmodified. |
| 5 | TODO | **The puzzle comes from an adapter.** `src/adapters/puzzleSource.ts`: an async source returning a plain typed record — the text the player reads and the six-digit answer. `generatePuzzle` is the local implementation; the agent is a later one behind the same interface.<br>**Done when:** a named test drives the flow against a fake source with no agent and no network, `grep -rn "generatePuzzle" src \| cut -d: -f1 \| sort -u` no longer lists `src/domain/gameState.ts`, `npm test` and `npx tsc --noEmit` exit 0. |
| 6 | TODO | **Six digits is the contract, not the shape.** The source may return any answer of one to six digits; a source returning seven is rejected at the adapter, before it reaches the game. `generatePuzzle` needs no change for this — its answers are 2 to 18 — and `checkAnswer` keeps comparing numbers, so `puzzle.md` AC8 (`"07"` answers 7) still holds.<br>**Done when:** a named test drives a fake source returning a seven-digit answer and asserts it is refused, another drives a one-digit answer through to solved, `npm test` exits 0. |
| 7 | TODO | **Drawing moves out of the pure function.** `transition` stops calling the generator and receives a drawn puzzle as an event instead; it stays pure — no clock, no network, no GPS.<br>**Done when:** `transition` has no `await` and no import of the source, a named test asserts the same event twice does not redraw, `npm test` exits 0. |
| 8 | TODO | **Reaching the puzzle point hands out the puzzle, once.** Collecting it is what reveals the answer point; walking back to the puzzle point shows the same puzzle, never a new one.<br>**Done when:** a test named for each new AC passes, including a re-visit asserting the identical answer, `npm test` exits 0. |
| 9 | TODO | **An uncollected answer point does not exist for the player.** Absent from the map and inert on arrival until its own puzzle has been collected.<br>**Done when:** a named test sends `LOCATION_CHANGED` at an uncollected answer point from `MAP` and asserts the returned state is deep-equal to the given one; another asserts the map renders no marker for it; `npm test` exits 0. |
| 10 | TODO | **The map shows what the player has earned.** Puzzle points from the start, an answer point once its puzzle is collected, and the offer to act names the right thing for the role.<br>**Done when:** named tests assert the marker count before and after collecting, then `npm run web` plus `node scripts/browser-smoke.mjs` reports the same change, 0 console errors and 0 page errors. |
| 11 | TODO | **The puzzle can be read again from the map.** A control on the map screen brings the collected text back, anywhere — it is needed while standing at the answer point.<br>**Done when:** a named test collects the puzzle, walks out of range, presses the control and asserts the same text with the same answer; the browser smoke run does the same and reports it `ok`. |
| 12 | TODO | **The puzzle renders as plain text UI on native, not in AR.** The puzzle point's screen is an ordinary React Native screen on every platform — no Viro, no camera, no anchored panel.<br>**Done when:** a named test asserts the puzzle screen renders the text with no Viro element and no camera preview, the `ar-panel.md` AC17 source-tree test passes unchanged, `npm test` and `npx tsc --noEmit` exit 0. |
| 13 | TODO | **The code is entered in AR at the answer point.** The anchored panel keeps the keypad and now takes six digits; `checkAnswer` decides, nothing else.<br>**Done when:** `grep -rn "checkAnswer" src \| cut -d: -f1 \| sort -u` lists only `src/domain/gameState.ts`, `src/domain/puzzle.ts` and `src/domain/puzzle.test.ts` — the same three as today, so no UI file learned to decide an answer — a named test covers right code → solved and wrong code → input cleared, `npm test` exits 0. |
| 14 | TODO | **Walk the whole flow in the browser.** Extend `scripts/browser-smoke.mjs`: far → puzzle point → puzzle collected → answer point now on the map → walk to it → code typed → congratulation.<br>**Done when:** `node scripts/browser-smoke.mjs` prints a check for each step, every check `ok`, 0 console errors, 0 page errors. |
| 15 | TODO | **Several pairs.** A second pair in `points.json`, and whatever progress means for more than one — settled in Prio 1, proven here.<br>**Done when:** named tests cover two pairs at once, including that collecting pair A does not reveal pair B's answer point and that the two puzzles have different answers, `npm test` exits 0 and the browser smoke run stays green. |
| 16 | TODO | **Keep the anchored panel's own tests honest.** The panel serves the answer point only; its unit tests follow the changed props. Unit tests are the whole evidence here.<br>**Done when:** `npm test` exits 0 with the `ar-panel.md` panel suite green against both implementations, and this row records in one line that anchoring itself was **not** verified — that needs a device and a field round. |
| 17 | TODO | **Close the specs.** Every spec touched moves Status to `Done`, and anything noticed on the way is one line in `INBOX.md`.<br>**Done when:** `grep -n "^\*\*Status:\*\*" specs/features/*.md` shows no spec left `In Progress`, and `npm test` plus `npx tsc --noEmit` both exit 0 on the final tree. |
