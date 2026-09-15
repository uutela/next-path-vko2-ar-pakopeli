import type { Coordinates, EscapePoint } from '../domain/types';

/**
 * Tile style and the attribution its licence requires.
 *
 * OpenFreeMap needs no account and no API key, and permits commercial use.
 * It has no SLA, so this URL is kept here and nowhere else: switching to
 * self-hosted tiles is then a one-line change. See specs/features/map-view.md.
 */
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

/** Mandatory. Rendering the map without this is a licence breach. */
export const MAP_ATTRIBUTION = '© OpenMapTiles Data from OpenStreetMap';

/** Close enough that a 20 m radius is a meaningful part of the screen. */
export const MAP_ZOOM = 15;

/**
 * Where the map looks when there is neither a position nor a point. Central
 * Helsinki, near Mannerheimintie — it was labelled Senate Square for a while
 * and is about 800 m from it. See specs/features/points-store.md.
 */
export const MAP_FALLBACK_CENTRE: [number, number] = [24.9384, 60.1699];

/**
 * Where the map opens: the player, when the player is known.
 *
 * A map centred anywhere else shows the player somewhere they are not. This
 * file has said so since week 1 while the function did the opposite — it
 * centred on the first point, so someone playing a route of their own got a
 * map of the seed's city with their own point far off screen.
 *
 * The position arrives asynchronously and may never arrive, so the first point
 * is the fallback and the named constant is the fallback after that.
 * See specs/features/map-view.md AC12, AC13 and AC17.
 */
export function initialCentre(
  points: EscapePoint[],
  player: Coordinates | undefined,
): [number, number] {
  if (player) {
    return [player.longitude, player.latitude];
  }
  const first = points[0];
  if (!first) {
    return MAP_FALLBACK_CENTRE;
  }
  return [first.coordinates.longitude, first.coordinates.latitude];
}
