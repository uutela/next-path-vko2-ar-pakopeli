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

/**
 * One task: what the player reads, and the code that answers it.
 *
 * No operands. An agent's puzzle has a question and a code, not a sum, and
 * the agent is a later implementation of the same source — a record only the
 * local generator could fill would be the wrong record.
 * See specs/features/puzzle.md and specs/features/pair-flow.md.
 */
export interface Puzzle {
  text: string;
  answer: number;
}

/** A pair the player has collected: the puzzle drawn for it, and whether it is solved. */
export interface PairProgress {
  pairId: string;
  puzzle: Puzzle;
  solved: boolean;
}

/**
 * What the player is looking at. A screen names a pair rather than carrying
 * it, because the puzzle outlives the screen: it is read at one point and
 * answered at another. See specs/features/pair-flow.md.
 */
export type Screen =
  | { kind: 'MAP' }
  | { kind: 'NEAR'; point: EscapePoint }
  | { kind: 'PUZZLE'; pairId: string }
  | { kind: 'ANSWER'; pairId: string; input: string }
  | { kind: 'SOLVED'; pairId: string };

/**
 * Progress, with a screen on top. `pairs` is both: a pair absent from it has
 * not been collected, and a pair present in it is never drawn again.
 */
export interface GameState {
  screen: Screen;
  pairs: PairProgress[];
  notice?: string;
}

/** Everything that can happen to the game. */
export type GameEvent =
  | { kind: 'LOCATION_CHANGED'; coordinates: Coordinates }
  | { kind: 'PUZZLE_DRAWN'; pairId: string; puzzle: Puzzle }
  | { kind: 'PUZZLE_FAILED' }
  | { kind: 'SHOW_PUZZLE'; pairId: string }
  | { kind: 'CLOSE_PUZZLE' }
  | { kind: 'OPEN_ANSWER' }
  | { kind: 'DIGIT_PRESSED'; digit: string }
  | { kind: 'CLEAR' }
  | { kind: 'SUBMIT' }
  | { kind: 'RESET' };

/**
 * What a transition needs from outside itself. No `rng`: drawing a puzzle is
 * asynchronous and lives in the shell, which sends the result in as an event.
 */
export interface TransitionContext {
  points: EscapePoint[];
}
