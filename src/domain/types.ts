/** A point on the earth, as reported by the location adapter. */
export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * What a point is for. A pair is one of each, sharing a `pairId`: the puzzle
 * point hands out the task and the answer point takes the code.
 * See specs/features/pair-flow.md.
 */
export type PointRole = 'puzzle' | 'answer';

/** A place the player must reach, and how close counts as reaching it. */
export interface EscapePoint {
  id: string;
  name: string;
  coordinates: Coordinates;
  radiusMeters: number;
  role: PointRole;
  pairId: string;
}

/** One arithmetic task: two operands and the sum they add up to. */
export interface Puzzle {
  left: number;
  right: number;
  answer: number;
}

/**
 * The four situations the game can be in. A discriminated union, so the
 * compiler forces every state to be handled and no state carries a field that
 * does not belong to it. See specs/features/game-state.md.
 */
export type GameState =
  | { kind: 'MAP' }
  | { kind: 'NEAR'; point: EscapePoint }
  | { kind: 'PUZZLE'; point: EscapePoint; puzzle: Puzzle; input: string }
  | { kind: 'SOLVED'; point: EscapePoint };

/** Everything that can happen to the game. */
export type GameEvent =
  | { kind: 'LOCATION_CHANGED'; coordinates: Coordinates }
  | { kind: 'OPEN_PUZZLE' }
  | { kind: 'DIGIT_PRESSED'; digit: string }
  | { kind: 'CLEAR' }
  | { kind: 'SUBMIT' }
  | { kind: 'RESET' };

/** What a transition needs from outside itself. Both are created once. */
export interface TransitionContext {
  points: EscapePoint[];
  rng: () => number;
}
