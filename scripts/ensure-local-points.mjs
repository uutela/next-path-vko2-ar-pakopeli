/**
 * Creates src/data/points.local.json if it is missing, as an empty list.
 *
 * That file is gitignored on purpose. A point is a place someone stands, and
 * AGENTS.md is explicit that the player's location never leaves the device —
 * a home address does not belong in a public repository. The committed seed in
 * points.json is a public square for that reason.
 *
 * Runs from postinstall, so a fresh clone builds without anyone editing it.
 */
import { existsSync, writeFileSync } from 'node:fs';

const TARGET = new URL('../src/data/points.local.json', import.meta.url);

if (existsSync(TARGET)) {
  process.exit(0);
}

writeFileSync(TARGET, '[]\n');
console.log(`Created ${TARGET.pathname} — local points, never committed.

To play somewhere other than the seed, put a WHOLE PAIR in it: a puzzle point
that hands out the task and an answer point where the code is typed. Both
share a pairId.

[
  {
    "id": "local-puzzle",
    "name": "Tehtäväpiste",
    "coordinates": { "latitude": 0, "longitude": 0 },
    "radiusMeters": 20,
    "role": "puzzle",
    "pairId": "local"
  },
  {
    "id": "local-answer",
    "name": "Vastauspiste",
    "coordinates": { "latitude": 0, "longitude": 0 },
    "radiusMeters": 20,
    "role": "answer",
    "pairId": "local"
  }
]

An "id" that matches one in points.json replaces that point; any other id
adds one. Leave it as [] to play the committed seed.

Three ways a point disappears with no error anywhere:
  - no "role" or no "pairId"      — dropped by isEscapePoint
  - a pair with only one member   — dropped by withCompletePairs
  - two points of the same role sharing a pairId — that is not a pair

Put the two points far enough apart to be worth walking: the pair exists so
that the puzzle is read in one place and answered in another.`);
