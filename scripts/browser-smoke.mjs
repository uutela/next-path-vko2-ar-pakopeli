/**
 * Walks the web build through the map half of the game and reports what it
 * saw. Read-only: it never fixes anything, it only looks.
 *
 *   node scripts/browser-smoke.mjs [url] [outDir]
 *
 * The AR half is not reachable here — Viro is a native renderer and ARKit
 * anchoring is native-only, which specs/PRD.md states as a decision rather
 * than a gap. See the report this prints for what that costs.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.argv[2] ?? 'http://localhost:8081';
const OUT = process.argv[3] ?? '.smoke';

/**
 * Derived from the points the app actually uses, so a local override in
 * points.local.json is walked to rather than missed. The values are never
 * printed: a point is a place someone stands.
 */
const { readFileSync } = await import('node:fs');
const readPoints = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return [];
  }
};
const byId = new Map();
for (const p of [...readPoints('src/data/points.json'), ...readPoints('src/data/points.local.json')]) {
  byId.set(p.id, p);
}
const all = [...byId.values()];
const PUZZLE_POINT = all.find((p) => p.role === 'puzzle');
const ANSWER_POINT = all.find((p) => p.role === 'answer' && p.pairId === PUZZLE_POINT?.pairId);
if (!PUZZLE_POINT || !ANSWER_POINT) {
  throw new Error('no whole pair to walk: need a puzzle point and its answer point');
}
/** Metres to degrees of latitude, so the offsets below are exact. */
const DEG = 1 / 111_194.93;
const near = (point) => ({
  latitude: point.coordinates.latitude + 19 * DEG,
  longitude: point.coordinates.longitude,
});
const INSIDE = near(PUZZLE_POINT);
const AT_ANSWER = near(ANSWER_POINT);
const FAR = {
  latitude: PUZZLE_POINT.coordinates.latitude - 500 * DEG,
  longitude: PUZZLE_POINT.coordinates.longitude,
};

/**
 * Refuse to measure a different application.
 *
 * The default port is Expo's, so a second checkout of this project answers on
 * it just as readily as this one — and a fork of a fork looks identical from
 * the outside. Every check in a whole session once ran against the week 1 repo
 * on port 8081 while this project's own server had printed "Port 8081 is
 * running ar-pakopeli in another window" and quietly skipped starting. The
 * runs were green, red and reproducible, and none of them were about this
 * code.
 *
 * Metro names its own project root when asked to resolve a module it does not
 * have, which is the one thing the server will say about itself.
 */
const assertServerIsThisProject = async (url) => {
  const here = process.cwd();
  let root;
  try {
    const probe = await fetch(`${url}/index.bundle?platform=web&dev=true`);
    const body = await probe.text();
    root = JSON.parse(body).originModulePath?.replace(/\/+\.?$/, '');
  } catch {
    root = undefined;
  }

  if (root === here) {
    console.log(`  server root: ${root}`);
    return;
  }

  console.error(
    root === undefined
      ? `\nREFUSING TO RUN: could not establish which project answers ${url}.`
      : `\nREFUSING TO RUN: ${url} is serving a different project.\n  it serves: ${root}\n  expected:  ${here}`,
  );
  console.error(`  Start this project's server first, on a port nothing else holds:`);
  console.error(`    npx expo start --web --port 8082`);
  console.error(`    node scripts/browser-smoke.mjs http://localhost:8082 .smoke\n`);
  process.exit(1);
};

console.log(`→ checking who answers ${URL}`);
await assertServerIsThisProject(URL);

const results = [];
const record = (id, expected, actual) =>
  results.push({ id, expected, actual, ok: expected === actual });

mkdirSync(OUT, { recursive: true });

// No camera flags and no camera permission: the web build asks for neither,
// which is the point of dropping it. Geolocation is still needed, and still
// needs a secure context outside localhost.
const browser = await chromium.launch();
const context = await browser.newContext({
  permissions: ['geolocation'],
  geolocation: FAR,
  locale: 'fi-FI',
});
const page = await context.newPage();

const consoleErrors = [];
const pageErrors = [];
/** Vector tile requests. Zero of them means the map has no data to draw. */
const tileRequests = [];
page.on('response', (r) => /\.pbf(\?|$)/.test(r.url()) && tileRequests.push(r.status()));
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
page.on('pageerror', (e) => pageErrors.push(e.message));

console.log(`→ opening ${URL}`);
// Not `networkidle`: map tiles and Metro's HMR socket keep the network busy,
// so it never settles. Wait for the document, then for the app to paint.
const response = await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120_000 });
console.log(`  HTTP ${response?.status()}`);

// The bundle is built on first request, and it is 3.5 MB.
await page
  .getByText('© OpenMapTiles Data from OpenStreetMap')
  .waitFor({ timeout: 120_000 })
  .catch(() => console.log('  (attribution never appeared)'));
await page.waitForTimeout(3_000);
await page.screenshot({ path: `${OUT}/01-loaded.png`, fullPage: true });

const bodyText = await page.locator('body').innerText().catch(() => '');
console.log(`  body text: ${JSON.stringify(bodyText.slice(0, 200))}`);

// AC1 — the map state shows the map screen.
record(
  'app-shell AC1 attribution present',
  true,
  await page.getByText('© OpenMapTiles Data from OpenStreetMap').count() === 1,
);
record('app-shell AC1 no offer while far', 0, await page.getByText('Avaa tehtävä').count());

record(
  'pair-flow only the puzzle point is on the map before collecting',
  1,
  await page.locator('.maplibregl-marker').count(),
);

// AC2 — walking into range offers the puzzle.
console.log('→ moving to 19 m from the point');
await context.setGeolocation(INSIDE);
await page.waitForTimeout(4_000);
await page.screenshot({ path: `${OUT}/02-near.png`, fullPage: true });
const offers = await page.getByText('Avaa tehtävä').count();
record('app-shell AC2 offer appears in range', 1, offers);

// map-view AC5/AC6 — the map itself, not just its attribution.
const canvases = await page.locator('canvas').count();
record('map-view a map canvas is rendered', true, canvases > 0);
const canvasBox = canvases > 0 ? await page.locator('canvas').first().boundingBox() : null;
record(
  'map-view the map canvas has area',
  true,
  Boolean(canvasBox && canvasBox.width > 0 && canvasBox.height > 0),
);

// A canvas with area is not a canvas with a map on it — the blank map that
// prompted map-view AC10 passed both checks above. A PNG of a uniform image
// compresses to a few hundred bytes; a drawn map does not, so the encoded
// size separates them without needing a decoder.
const canvasShot = canvases > 0 ? await page.locator('canvas').first().screenshot() : null;
console.log(`  canvas png: ${canvasShot?.length ?? 0} bytes, vector tiles fetched: ${tileRequests.length}`);
record('map-view the map canvas is actually painted', true, (canvasShot?.length ?? 0) > 5_000);
// The size check alone was too lenient: a background colour and one marker
// already cleared it while the map had fetched no tiles at all, because its
// container had zero height. Tile requests are the check that would have
// caught that.
record('map-view the map fetches vector tiles', true, tileRequests.length > 0);
record('map-view every tile request succeeds', true, tileRequests.every((s) => s < 400));

// The whole puzzle, played on web. No camera and no anchoring here — both are
// native-only by the PRD, and the puzzle is neither.
if (offers > 0) {
  console.log('→ collecting the puzzle at the puzzle point');
  await page.getByText('Avaa tehtävä').first().click();
  await page.waitForTimeout(3_000);
  await page.screenshot({ path: `${OUT}/03-puzzle.png`, fullPage: true });

  // pair-flow: the puzzle is plain text on every platform, and the keypad is
  // somewhere else entirely — at the answer point.
  const sum = await page.getByTestId('puzzle-text').textContent().catch(() => null);
  console.log(`  the puzzle reads: ${JSON.stringify(sum)}`);
  record('pair-flow the puzzle point hands out a puzzle', true, /^\d \+ \d = \?$/.test(sum ?? ''));
  record('pair-flow no keypad at the puzzle point', 0, await page.getByTestId(/^key-(?!row-)/).count());
  record('ar-panel AC20 no camera on web', 0, await page.locator('video').count());

  console.log('→ back to the map, which now shows the answer point');
  await page.getByText('Takaisin kartalle').click();
  await page.waitForTimeout(1_000);
  // MapLibre draws its own marker elements on web; `marker` is the native
  // map's testID and does not exist here.
  record(
    'pair-flow the answer point appears once earned',
    2,
    await page.locator('.maplibregl-marker').count(),
  );
  record('pair-flow the puzzle can be re-read from the map', 1, await page.getByText('Näytä pulma').count());

  console.log('→ walking to the answer point');
  await context.setGeolocation(AT_ANSWER);
  await page.waitForTimeout(4_000);
  await page.screenshot({ path: `${OUT}/04-at-answer.png`, fullPage: true });
  record('pair-flow the answer point offers the keypad', 1, await page.getByText('Syötä koodi').count());

  await page.getByText('Syötä koodi').click();
  await page.waitForTimeout(2_000);
  // Keys only: `key-row-0` and friends share the prefix.
  record('ar-panel AC3 twelve keys', 12, await page.getByTestId(/^key-(?!row-)/).count());

  // Solve it: read the operands off the screen and type the answer.
  const [left, right] = (sum ?? '').match(/\d/g)?.map(Number) ?? [];
  const answer = String((left ?? 0) + (right ?? 0));
  console.log(`→ typing ${answer}, then OK`);
  for (const digit of answer) {
    await page.getByTestId(`key-${digit}`).click();
  }
  record('ar-panel AC4 input display shows what was typed', answer, await page.getByTestId('input-display').innerText());

  await page.getByTestId('key-OK').click();
  await page.waitForTimeout(1_500);
  await page.screenshot({ path: `${OUT}/05-solved.png`, fullPage: true });
  record('ar-panel AC7 congratulation appears', 1, await page.getByText('Oikein! Laatikko aukesi.').count());
  record('ar-panel AC12 reset control appears', 1, await page.getByText('Aloita alusta').count());
} else {
  record('ar-panel AC20 no camera on web', 0, 'not reached — no offer to click');
}

console.log('\n──────── results ────────');
for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.id}`);
  if (!r.ok) console.log(`        expected ${JSON.stringify(r.expected)}, saw ${JSON.stringify(r.actual)}`);
}
console.log(`\nconsole errors: ${consoleErrors.length}`);
consoleErrors.slice(0, 10).forEach((e) => console.log(`  ! ${e.slice(0, 300)}`));
console.log(`page errors: ${pageErrors.length}`);
pageErrors.slice(0, 10).forEach((e) => console.log(`  !! ${e.slice(0, 300)}`));
console.log(`\nscreenshots in ${OUT}/`);

await browser.close();
process.exit(results.every((r) => r.ok) && pageErrors.length === 0 ? 0 : 1);
