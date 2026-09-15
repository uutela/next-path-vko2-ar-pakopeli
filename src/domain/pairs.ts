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
 * What proximity may offer. The same list, minus both points of a solved pair:
 * a solved pair stays on the map and stops asking for anything.
 * See specs/features/pair-flow.md AC8.
 */
export function actionablePoints(state: GameState, points: EscapePoint[]): EscapePoint[] {
  return visiblePoints(state, points).filter(
    (point) => progressFor(state, point.pairId)?.solved !== true,
  );
}
