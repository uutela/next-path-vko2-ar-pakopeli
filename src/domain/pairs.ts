import type { EscapePoint, GameState } from './types';

/** The pair's progress, or undefined if the player has not collected it. */
export function progressFor(state: GameState, pairId: string) {
  return state.pairs.find((pair) => pair.pairId === pairId);
}

const byId = (a: EscapePoint, b: EscapePoint) => a.id.localeCompare(b.id);

/**
 * What the map draws: every puzzle point, plus the answer point of every pair
 * whose puzzle has been collected. An answer point the player has not earned
 * is not merely unmarked — it does not exist for them yet.
 * See specs/features/pair-flow.md AC5 to AC7.
 */
export function visiblePoints(state: GameState, points: EscapePoint[]): EscapePoint[] {
  return points
    .filter((point) => point.role === 'puzzle' || progressFor(state, point.pairId) !== undefined)
    .sort(byId);
}

/**
 * What proximity may offer. The map's list, minus the points with nothing left
 * to give:
 *
 * - both points of a solved pair — it stays on the map and stops asking;
 * - the puzzle point of a pair whose puzzle has been drawn, because a puzzle
 *   point has one thing to hand out and hands it out once.
 *
 * The second rule is not only tidiness. While a collected puzzle point kept
 * offering, it shadowed its own answer point: `nearestPointInRange` keeps the
 * first point with a strictly smaller distance, so two actionable points at
 * the same distance are separated by array order — invisible to the player. A
 * pair whose points share a location could never be finished.
 *
 * The puzzle stays reachable through `Näytä pulma` on the map, which is where
 * it belongs: it is needed while standing somewhere else.
 * See specs/features/pair-flow.md AC8 and AC28.
 */
export function actionablePoints(state: GameState, points: EscapePoint[]): EscapePoint[] {
  return visiblePoints(state, points).filter((point) => {
    const progress = progressFor(state, point.pairId);
    if (progress === undefined) {
      return true;
    }
    return !progress.solved && point.role === 'answer';
  });
}
