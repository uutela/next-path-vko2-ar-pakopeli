# prompts2.md

Every message from the user that drove week 2 of this project, in order and
verbatim, as part of the next-path week 2 exercise. Answers chosen from a
multiple choice prompt are marked as selections rather than typed text. A `→`
line after each entry summarises what was answered and what it changed.

Course-step prompts are quoted in full. Nothing here is paraphrased.

The assistant's own replies are not reproduced — this is a record of what
drove the work, not a transcript. Messages that answer a question the file
does not show carry an *In reply to* line naming the question they settle.

Week 1 is a separate record and is not repeated here: `prompts.md`, unchanged
from the fork, is the week 1 submission and stays frozen.

---

## Where the submission lives

| Asked for | Here |
|---|---|
| Repository | https://github.com/uutela/next-path-vko2-ar-pakopeli |
| Week 1 record (forked, frozen) | `prompts.md` |
| Week 2 prompts | this file |
| Spec and acceptance criteria | `specs/features/` |
| INBOX | `INBOX.md` |

---

## Setting up week 2

### 1
> Moi lähdetään tekemään next path kurssin vko 2 -harjoitusta tänne. Meillä on
> täällä forkki vko1 -reposta. Kerätään kaikki promptit talteen. Pitäisikö ne
> laittaa nyt vko:lla 2 tiedostoon prompts2.md

→ Yes, and this file is it. `prompts.md` is a finished week 1 submission — its
header, its "where the submission lives" table and its reflection all describe
week 1 and point at the vko1 repository — so week 2 entries are collected here
instead of appended there, and the week 1 record stays exactly as it was
submitted.

### 2
> Nyt pitäisi myös asentaa npm-paketit:  npm install

→ 680 packages, exit 0. `postinstall` reapplied
`patches/@reactvision+react-viro+2.58.1.patch`, created the empty local point
file and copied MapLibre's two worker files into `public/`. Verified green on
the spot: `npx tsc --noEmit` exit 0, `npm test` 14 files and 133 tests passing,
exit 0. `npm audit` reports 12 moderate advisories inherited from the week 1
fork; nothing was upgraded, because changing this Expo/Viro/MapLibre pin
without a reason is how a working native build stops working.

---

## Designing the round loop

### 3
> Lue ensin repo: specs/features/ (erityisesti ar-panel.md, puzzle.md,
> points-store.md), src/domain/puzzle.ts, src/domain/points.ts ja
> src/domain/gameState.ts. Älä toteuta vielä mitään.
>
> Kirjoita sitten repon juureen looppi.md, jossa on kolme osaa:
>
> 1. Askeleet jotka ajetaan joka kierroksella. Pohjana: poimi korkeimman
>    prioriteetin avoin tehtävä, tee sille speksi jos epäselvä, toteuta
>    TDD:llä, aja yksikkötestit ja typecheck puhtaaksi, katselmoi, testaa
>    selaimessa, merkitse tehdyksi.
>    TÄRKEÄÄ: selaintestaus koskee vain web-käyttöliittymää. AR-paneelia ei voi
>    todentaa selaimessa, koska kameraa ei ole. AR-koodia saa muuttaa, mutta se
>    katetaan yksikkötesteillä, eikä tehtävää saa merkitä tehdyksi sellaisen
>    AR-käytöksen perusteella jota ei voitu havaita.
>
> 2. Guardrailit ennen tehtävälistaa: kierros- ja aikakatto, kaksi peräkkäistä
>    samaa virhettä pysäyttää, uudet ideat yhtenä rivinä INBOX.md:hen eikä
>    toteuteta, ei kosketa .env / .env.local / points.local.json -tiedostoihin.
>
> 3. Tehtävälista taulukkona (Prio | Status | Task). Tavoite on mekaniikka,
>    jossa kartalla on kaksi pistettä: tehtäväpiste näyttää pulman, ja siitä
>    aukeaa vastauspiste johon vastaus syötetään. Pulma renderöityy myös
>    ar-versissa normaalina tekstipohjaisena käyttöliittymän eikä ar-moodissa.
>    Vastaukset pysyvät toistaiseksi numeroina, mutta nykyinen kahden merkin
>    raja appendDigitissä pitää saada pois. checkAnswer säilyy ainoana
>    paikkana jossa vastaus ratkaistaan.
>
> Jokaisen tehtävärivin on kerrottava mistä tietää että se on valmis —
> konkreettinen havainto tai komento, ei mielipide. Pilko tehtävät niin että
> yksi kierros ehtii tehdä yhden.
>
> Kerro lopuksi mitä oletuksia jouduit tekemään pelin rakenteesta.

→ `looppi.md` written: seven round steps, ten guardrails, twelve tasks. Read
first, as asked — the three named domain modules, all three named specs, and
also `game-state.md`, `map-view.md`, `AppShell.tsx`, `ArScreen.tsx` and
`scripts/browser-smoke.mjs`, because a task list that does not match the
existing seams is a list of guesses. Nothing implemented.

Four things the current code decides *against* the target mechanic, which is
why the list starts with a spec rather than a change: `GameState` has one
`PUZZLE` state carrying both the puzzle and the input, so one point currently
does both jobs; `EscapePoint` has no role, so nothing distinguishes a task
point from an answer point; `appendDigit` caps input at two characters and
`puzzle.md` AC12 *requires* that cap, so the spec has to be corrected before
the test; and the anchored panel is currently the only puzzle renderer on
native.

Every "done when" is a command or an observable, and the two checks that
touch existing behaviour were run before being written down — the `checkAnswer`
grep lists exactly three files today, so the row asserts that it still lists
three. Assumptions reported separately in the reply.

### 4
*In reply to: six assumptions about the game structure, listed after `looppi.md` was written — the answer point's timing, whether AR survives, the point role, the input cap, where the puzzle comes from, and which point wins when both are in range*

> Ehdotan että vastauspiste ilmestyy vasta kun pulmapisteestä on saatu itse
> pulma. Sen jälkeen pulma pitää saada uudestaan näkyviin, mutta vastauspiste
> avautuu vasta kun sinne menee). 2 siis juuri noin et vastauspiste on
> ar-juttu. En ymmärrä kohtaa 3. 4. 6 merkkiä hyvä. 5. tehtäväpisteen pulma voi
> olla ihan mitä tahansa meiltä tulee myöhemmmin ai agentilta. Mutta sen vastaus
> pitää olla se 6 numeroinen numero jonka voi syöttää vastauspisteessä. Ja
> lisäksi jotenkin siis pitää pisteet antaa et on sekä puzzlepiste että
> vastauspiste. Ne tulee sinne jsoniin ja voi olla siis monta paria. Mikä jää
> epäselväksi?

→ The mechanic changed shape and `looppi.md` was rewritten around it: points
come in **pairs** in `points.json`, several of them; the answer point is hidden
until its puzzle has been collected and opens only on arrival; the puzzle text
is arbitrary — later from an AI agent — and only its six-digit answer is a
number. That retires the arithmetic as the source of the puzzle, which is why
`generatePuzzle`'s fate became a spec decision rather than an implementation
detail, and it changes `checkAnswer`: a six-digit code has leading zeros, so
`"000042"` and `"42"` must stop being the same answer. Twelve tasks became
sixteen.

Assumption 3 was answered by reading rather than deciding. It asked what
becomes of a point already saved on the device with no role. `saveStoredPoints`
is defined and tested but **called from nowhere** — the admin editor
`points-store.md` describes was never built, so no device has ever stored a
point and the question is empty. Said so rather than specifying a migration
for data that does not exist.

### 5
*In reply to: a proposal that the puzzle point carry `puzzle: { text, answer }` in `points.json`*

> eikai jsonissa ole pulmaa eikä vastausta. Ne tulee agentilta tai
> generaPuzzlelta¨

→ Corrected before it was built. `points.json` holds **places and nothing
else**; the puzzle is produced at run time, by `generatePuzzle` now and by an
agent later. That makes the puzzle a source like GPS and the camera, so
AGENTS.md puts it behind its own adapter returning a plain typed record — and
because an agent answers over a network, the adapter is async from the start.
A pure function cannot await, so drawing leaves `transition` and arrives as an
event instead. Two further rules followed: a puzzle is drawn **once per pair**
and kept, or the code would change under a player already walking to the
answer point; and `generatePuzzle` must now produce a six-digit answer, which
`puzzle.md` AC1–AC5 do not. Sixteen tasks became eighteen.

### 6
*In reply to: four open questions — how a pair is expressed, what several pairs mean for progress, where the puzzle is re-read, and whether collecting it needs a button press*

> 2. erikseen. 3. ehdotus ok. 4. suositus ok

→ Pairs are independent, each solved on its own. The puzzle is re-read from a
control on the map rather than by walking back to the puzzle point — it is
needed while standing at the answer point, which is somewhere else. Collecting
stays a button press, as `Avaa tehtävä` is today, so nothing opens on GPS
wobble alone. Question 1 had been overtaken by entry 5. All four are now
written into `looppi.md` above the task list, so Prio 1 specifies rather than
asks.

### 7
*In reply to: a check that "the answer point opens only on arrival" means visible on the map once the puzzle is collected, but opening only inside its radius*

> tarkennus kohtaan 1 osiossa olit tulkinnut oikein

→ Confirmed: on the map when earned, open only when reached. Visible before it
is reachable, or there is nothing to walk towards.

### 8
*In reply to: a choice between zero-padding an easy sum to six digits and drawing a genuinely six-digit calculation*

> ehdotus, pidetään et max kuusi merkkiä saa olla myös vähemmän

→ The easy sum stays and six is a **maximum**, not a length: `5 + 2` is
answered `7`, never `000007`. That removed two tasks rather than adding any.
`generatePuzzle` needs no change — its answers are 2 to 18, which already fit —
and `checkAnswer` keeps comparing numbers, so `puzzle.md` AC8 (`"07"` answers
7) survives untouched. What remains is a contract rather than a shape: the
adapter refuses a source that returns seven digits, which is the one thing a
future agent could get wrong. Eighteen tasks became seventeen.

Filed in `INBOX.md` rather than built: the day an agent issues a code whose
leading zeros are meaningful, the answer has to become a string and AC8 has to
be revisited. Numeric comparison is right today and wrong then.

---

## The rounds

### 9
*In reply to: a choice between committing the current state first or starting round 1 straight away*

> 1

→ Two commits rather than one, because they are two different things: `8414791`
is the lockfile as `npm install` left it — a single `hasInstallScript` line, no
dependency changed — and `aaac0e1` is `looppi.md`, `prompts2.md` and the INBOX
note. Committed on `main`, where this repository's whole history lives.

### 10 — slash command
> /goal every task in looppi.md is marked done, each having passed unit tests,
> typecheck, audit and a web browser check; stop after 8 turns. Record findings
> in INBOX.md and do not add new features.
>
> Re-read looppi.md from disk at the start of every round before picking a task —
> it changes during the run. Follow its steps in order, one task per round.
> AR panel behaviour cannot be verified in a browser; say so rather than claiming it.

→ The loop started. One task per round, `looppi.md` re-read from disk each
time, and the AR limit restated as an instruction rather than left in the file.

### Round 1 — Prio 1, the pair-flow spec

`specs/features/pair-flow.md`, 27 criteria, no code. Two things were checked
rather than asserted: every AC appears in the testing strategy table (a loop
over `AC1`..`AC27` found no gaps), and every coordinate fixture was run through
the repo's own haversine — 19 m, 19 m, 2 m, 100 m and 22 m, each landing where
the spec claims. A spec whose distances are wrong makes every test written from
it wrong too.

The shape the spec had to reach for: a drawn puzzle must outlive the screen
that showed it, so `GameState` stops being four situations and becomes
`{ screen, pairs, notice? }`. That is the largest change in the repo's history
and the Risk section says so. `OPEN_PUZZLE` disappears — the shell asks the
async source and dispatches `PUZZLE_DRAWN`, which is how an `await` stays out
of a pure function.

Verdict `APPROVED`. No browser check: nothing a browser can see changed.
