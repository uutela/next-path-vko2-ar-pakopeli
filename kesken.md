# kesken.md — what is unfinished or unverified

A submission appendix, assembled from the repository's actual state: `INBOX.md`,
`looppi-loki.md`, the test runs and the git history. Nothing has been softened
and nothing has been added.

Two things are kept apart here, because blurring them is exactly how a project
comes to look more finished than it is:

- **Verified** — run, and the command that showed it.
- **Written but unverified** — the code exists and is tested as far as a test
  can reach, but nobody has watched it work in the environment it is for.

---

## 1. Verified, and by what evidence

| Claim | Evidence | Run |
|---|---|---|
| The unit tests pass | `npm test` → **180 tests, 16 files** | just now |
| The types hold | `npx tsc --noEmit` → exit 0 | just now |
| The agent's tests pass with no network and no API key | `pytest` → **47 tests, 0.3 s**, one of which refuses socket connections for the whole path | just now |
| The web game walks the whole pair route | `node scripts/browser-smoke.mjs http://localhost:8082 .smoke` → **20 checks, 0 console errors, 0 page errors** | previous round |
| The puzzle point hands out a puzzle as text with no keypad, the answer point appears only once earned, and the code is typed there | named checks in the smoke run | previous round |
| A stationary player is offered the answer point without moving | an `AppShell` test that delivers a position **once** and never moves the player | just now |
| The agent produces a puzzle with the live model | the 2026-09-23 eval: **19 of 20 accepted**, all 19 answers checked by hand; the refusal was network, not a puzzle | 2026-09-23 |

One of these was also checked by hand: the first live puzzle was a
coin-splitting problem answering 30. Sixteen taken, fourteen left, nine taken,
five left, five taken, chest empty. It comes out exactly.

---

## 2. Written but unverified

### 2.1 The AR half has never been run on a device

**Actual state:** the repository has no `ios/` and no `android/` directory,
which means `expo prebuild` has never been run here. The app has never been
installed on a phone, and installing it was never attempted.

Every piece of AR evidence is a unit test, and those tests show **what the
component asks Viro to draw** — not what it looks like on a device. The
anchored panel renders through a stand-in that turns every Viro element into a
`div`. That proves the component asks for twelve keys, the right dimensions and
a double-sided material. It proves that none of them is visible.

Unverified, therefore: anchoring, surface tracking, legibility in daylight,
whether a key can be hit at arm's length, and whether the panel stays put when
you walk around it.

The browser cannot verify any of this: **the web build loads no Viro at all**,
which is deliberate (`ar-panel.md` AC17), because Viro's web files require a
dependency that is not published and that would take down the whole bundle.

`INBOX.md` also carries an open blocker inherited from week 1: **the app cannot
run in the iOS simulator on Apple Silicon**, because Viro's plugin sets
`EXCLUDED_ARCHS[sdk=iphonesimulator*] = arm64`. Every native run needs a
physical device.

### 2.2 The agent's puzzles have never been seen in the game

> **Found 2026-09-23:** the web build could never have shown one. The agent
> sent no CORS headers, so the browser discarded every answer and the game fell
> back. Fixed (`puzzle-agent.md` AC22, AC23) and a real browser page on :8082
> has now read a live puzzle. The chain through the game's screens is still
> unwalked, and a draw can outlast the 25 s timeout.

**Actual state:** the agent has been shown to work **on its own, from the
command line**, and through its API tests. It has never once been seen through
the game.

Every browser run was made with the agent switched off. The smoke output says
so directly: the most recent reading was `the puzzle reads: "6 + 7 = ?"` — the
local arithmetic generator's puzzle, not the agent's. The run contains a named
check, `puzzle-agent absent: the local generator still produced the puzzle`,
which proves **the fallback**, not the agent.

So the whole chain is unverified: a puzzle written by the agent → HTTP →
`PuzzleSource` → the game's state machine → the puzzle screen → the answer
point's keypad → `checkAnswer`. Every piece is tested separately; the chain has
never been walked once.

### 2.3 Why: the quota ran out

The shared API key's free tier allows 20 requests per day per model.

**Measured, not estimated:** the writer and the solver use the **same model**
(`gemini-3.5-flash`, the same `DEFAULT_MODEL` in both subagents). Every accepted
puzzle therefore costs at least **two** of the day's requests — one to write it,
one for the solve-back. Retries cost more.

Before the first `429`, three CLI draws had been made (3 writes + 3 solves) and
the eval had made 9 write attempts + 3 solves — eighteen calls in total. The
429s began after that, which matches a 20-request limit almost exactly.

From which it follows directly: **a twenty-puzzle eval could not have completed**
on the free tier under any settings. The quota is good for roughly ten puzzles a
day, if not one of them needs a retry.

### 2.4 The eval measured the quota, not puzzle quality

> **Superseded 2026-09-23.** Rerun with a new key and 15 s pacing: no 429,
> 19/20 accepted, all 19 right by hand. The checks still never rejected
> anything, and a draw averaged about 33 s against the game's 25 s. See
> `agents/puzzle-agent/eval/eval-2026-09-23.md`. The section below is the
> first run, kept as it was.

20 requests, 59 model calls, 241 seconds:

| | |
|---|---|
| Accepted on the first attempt | 2 |
| Accepted after a retry | 2 |
| Refused | 16 |

**Five puzzle texts were written out of twenty requested.** The quota ran out
during request 6; requests 7 to 20 all failed with `429 RESOURCE_EXHAUSTED`
without the model ever being asked to write. Request 2 died on 503s and two
20-second timeouts.

Two numbers say the same thing: 54 writer calls, but only **5 solver calls**.

**What can be concluded:** the path works end to end, refusal works, and four
puzzles passed every check.

**What cannot:** how often the model writes an unusable puzzle. **No attempt was
ever rejected by the schema check or the duplicate check**, and solve-back
reached a verdict at most five times. The figure 16/20 measures an API quota,
not model quality, and reading it as a quality metric would be wrong.

### 2.5 The eval harness has a known, unfixed pairing bug

> **Fixed 2026-09-23** — `puzzle-agent.md` AC20.

`agents/puzzle-agent/eval/run_eval.py` records writer calls and solver calls in
two separate lists and pairs them by attempt number. When a writer attempt
fails, no solver call happens, and **every later pairing in that request is off
by one.**

Visible consequence: request 1 is labelled `solve-back — solver said None` on
the very attempt it was accepted on.

The `Result:` lines come from the real loop and are correct. The per-attempt
verdict lines are not. A correction is written at the top of the eval file as a
warning; **the code was not fixed**, because fixing it and re-running is the
decision of whoever asked for the measurement.

### 2.6 The agent's address is `localhost`

`src/config/agent.ts` points at `http://localhost:8002`. That is right for the
web build and for a simulator. **On a phone, `localhost` is the phone itself**,
where no agent is running.

The game does not break: an unreachable agent falls back to the local generator
and says so in the console. But on a device the agent **will never be used**
until the address points at the development machine on the same network. This
has not been tried.

### 2.7 Three successful live draws are not a sample

Three CLI draws were made before the eval, all accepted on the first attempt.
That proves the path works. It says nothing about probabilities.

Seven live puzzles have been seen in total. None has been rejected by the
duplicate check, which does not mean the check is unnecessary — it means it has
not yet been tested.

---

## 3. What the loop got wrong

Two concrete rounds, both from `looppi-loki.md` and `INBOX.md`, and a third
found afterwards.

### 3.1 The browser checks measured the wrong repository for a whole session

The smoke script defaults to `http://localhost:8081`. A dev server for the
**week 1 repository** was already listening on that port. This project's own
`npx expo start` printed, into a log file:

```
› Port 8081 is running ar-pakopeli in another window
  /Users/null/Projects/next-path-vko1-ar-pakopeli (pid 25836)
› Skipping dev server
```

Nobody read that line. Every check measured a different application.

The loop made it worse itself: a "control run", stashing the changes and
running "against the clean tree", hit **the same foreign server**. A repeated
measurement is not an independent one, and it turned a wrong result into
apparent proof that the defect was inherited from the fork.

The cost was three browser runs against the wrong server, one replacement
adapter written TDD with four criteria and a fake, and the unwinding of it.
`git log -S"createBrowserPositionProvider"` finds nothing: the work never even
reached the history, because it was removed before a commit.

Fixed later so that it cannot recur: the smoke script asks the server for its
own project root and exits 1 unless it is this repository. Verified three ways.
That fix exists because a human interrupted the run to ask whether the port
problem had actually been fixed or had only been written into `INBOX.md`. It had
only been written down. **The loop was content to record a finding and move on.**

### 3.2 The round cap was never applied, and eight tasks went into one round

`looppi.md`'s guardrail says: *"Round cap: one task per round, eight rounds per
session."* The file was re-read from disk at the start of every round. **The cap
was never applied.** The `/goal` call's cap ("stop after 8 turns") was tracked
instead, and the two were conflated — two caps in two different units.

Row 7 of the log does prios 7 to 14: eight tasks in one round. The technical
reason was real — changing the shape of `GameState` broke compilation, and the
tasks could not be finished separately — but that justifies bundling two or
three rows, not eight. The decision to take all eight came from the turn budget.

In that same round the **RED-GREEN rhythm was lost**: the implementation was
written before the tests. The tests were transcribed from `pair-flow.md`,
written in round 1 before any of that code existed — defensible, but not the
same thing. Twice already in that session a technique had been used that would
have solved it: a stub that compiles and does nothing, so the red is a
behavioural failure. It was not tried here.

The round boundary silently became **"one commit" instead of "one task"**, while
the wording in `looppi.md` stayed as it was.

### 3.3 The log was written afterwards, not round by round

`git log -- looppi-loki.md` shows it: **rows 1 to 7 were all written in a single
commit** at the end of the big round, and rows 8 to 10 in the last one. Ten
numbered rounds are a reconstruction in two batches, not ten entries made as
rounds ended.

The cause was structural: writing the log row was part of the step that marks a
task done, so it could only ever have been written for rounds that succeeded.
Fixed later into a step of its own, run whatever the outcome, with a column for
how the round ended.

The same failure repeated in `prompts2.md`: recording stopped when the loop
ended, and eight commits went unrecorded. Filled in afterwards, and the file
says that it is a reconstruction.

---

## 4. Open items in INBOX.md

Thirteen open entries. The ones that affect how the game behaves:

- **The app cannot run in the iOS simulator on Apple Silicon** (from week 1).
- **Answers are compared as numbers**, so `"07"` answers 7. Right for as long as
  answers come from the arithmetic generator, wrong the day an agent issues a
  code whose leading zeros are meaningful.
- **The puzzle source can hang as well as fail.** There is a timeout in the
  adapter, but `PUZZLE_FAILED` covers only a rejection.
- **Three attempts against a rate-limited API is three refusals**, not three
  tries: `MAX_ATTEMPTS` retries immediately, so one 429 becomes three.
- **`AppShell.collect`'s check does not prevent a double tap** — two presses
  before the state updates both call the source.
- **The kit's own files still default to `gemini-2.5-flash`**, which does not
  exist for this key. They belong to the kit's author and were left unmodified.

Left as they are on 2026-09-23, by decision rather than oversight:

- **A live draw takes longer than the game waits.** 33 s on average in the
  eval and 46 s for one draw from the browser, against a 25 s timeout. Past
  it the game shows the local arithmetic puzzle instead of the agent's.
- **One API test goes online for whoever has a key.** Run alone,
  `test_api.py::test_a_refusal_is_a_200_with_a_reason` reloads the key from
  `agents/puzzle-agent/.env.local` and calls Gemini. Without a key — anyone
  cloning the repository — it passes as intended.
- **The slides are not hosted by the repository.** There is no GitHub Pages;
  the README links `docs/esitys.html` through raw.githack.com, a third-party
  service that serves files from public repositories as they are.

---

## 5. In short

The game works end to end in a browser, with 180 unit tests and 20 browser
checks green. The agent works from the command line and produces real, checked
puzzles.

**These two have never been seen working together**, and neither has been seen
on a phone. That is the project's actual state.
