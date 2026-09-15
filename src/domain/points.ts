import type { EscapePoint } from './types';

/**
 * Seed points from the repo, overridden by points stored on the device.
 * A stored point with the same id wins; the result is sorted by id so the
 * order never depends on how either list happened to be built.
 * See specs/features/points-store.md.
 */
export function mergePoints(seed: EscapePoint[], stored: EscapePoint[]): EscapePoint[] {
  const byId = new Map<string, EscapePoint>();

  for (const point of seed) {
    byId.set(point.id, point);
  }
  for (const point of stored) {
    byId.set(point.id, point);
  }

  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Whether a value read back from storage is a point the game can use.
 *
 * Shape *and* values: a stored `{ id: "p2", foo: 1 }` used to survive as far
 * as `isWithinRadius` and throw on the first location update, and a stored
 * latitude of 91 would throw one step later inside `distanceMeters`. Either
 * killed the app seconds after launch, with no way back but clearing device
 * storage. See specs/features/points-store.md AC11 to AC13.
 */
export function isEscapePoint(value: unknown): value is EscapePoint {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const point = value as Partial<EscapePoint>;
  const { coordinates } = point;

  return (
    typeof point.id === 'string' &&
    point.id.length > 0 &&
    (point.role === 'puzzle' || point.role === 'answer') &&
    typeof point.pairId === 'string' &&
    point.pairId.length > 0 &&
    typeof point.name === 'string' &&
    typeof point.radiusMeters === 'number' &&
    point.radiusMeters > 0 &&
    typeof coordinates === 'object' &&
    coordinates !== null &&
    typeof coordinates.latitude === 'number' &&
    coordinates.latitude >= -90 &&
    coordinates.latitude <= 90 &&
    typeof coordinates.longitude === 'number' &&
    coordinates.longitude >= -180 &&
    coordinates.longitude <= 180
  );
}

/**
 * The committed seed, overridden by a local file that is typed in by hand.
 *
 * Both are validated. `points.json` is reviewed, but `points.local.json` is
 * edited by a person and is the likeliest source of a malformed point in the
 * whole system — a typed latitude of `"kuusikymmentä"` would otherwise reach
 * `isWithinRadius` and kill the app on the first location update, exactly as a
 * corrupt store did. See specs/features/points-store.md AC14.
 */
export function composeSeed(repo: unknown, local: unknown): EscapePoint[] {
  const valid = (value: unknown): EscapePoint[] =>
    Array.isArray(value) ? value.filter(isEscapePoint) : [];

  // Completeness is judged after merging: the committed seed is public and the
  // local file is not, so a real route's answer point may live only in the
  // local file. See specs/features/points-store.md AC21 and AC22.
  return withCompletePairs(mergePoints(valid(repo), valid(local)));
}

/**
 * Only the points that belong to a whole pair, sorted by id.
 *
 * A puzzle point with no answer point hands out a code that can never be
 * entered, and an answer point with no puzzle point can never be revealed.
 * Both are mistakes in a hand-typed file that the game cannot explain to the
 * player, so they are dropped before the map draws them — the same treatment a
 * malformed point already gets.
 * See specs/features/points-store.md AC18 to AC20.
 */
export function withCompletePairs(points: EscapePoint[]): EscapePoint[] {
  const byPair = new Map<string, EscapePoint[]>();

  for (const point of points) {
    const members = byPair.get(point.pairId) ?? [];
    members.push(point);
    byPair.set(point.pairId, members);
  }

  const complete = [...byPair.values()].filter(
    (members) =>
      members.filter((p) => p.role === 'puzzle').length === 1 &&
      members.filter((p) => p.role === 'answer').length === 1,
  );

  return complete.flat().sort((a, b) => a.id.localeCompare(b.id));
}
