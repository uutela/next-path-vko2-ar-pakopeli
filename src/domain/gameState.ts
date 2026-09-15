import { distanceMeters, isWithinRadius } from './distance';
import { actionablePoints, progressFor } from './pairs';
import { appendDigit, checkAnswer } from './puzzle';
import type {
  Coordinates,
  EscapePoint,
  GameEvent,
  GameState,
  PairProgress,
  Screen,
  TransitionContext,
} from './types';

const DRAW_FAILED = 'Tehtävän haku epäonnistui. Yritä uudelleen.';

/** The actionable point in range whose centre is closest, or undefined. */
function nearestPointInRange(
  coordinates: Coordinates,
  points: EscapePoint[],
): EscapePoint | undefined {
  let nearest: EscapePoint | undefined;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const point of points) {
    if (!isWithinRadius(coordinates, point)) {
      continue;
    }
    const distance = distanceMeters(coordinates, point.coordinates);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = point;
    }
  }

  return nearest;
}

/** The same progress with one pair replaced. Never mutates. */
function withPair(pairs: PairProgress[], pairId: string, change: (p: PairProgress) => PairProgress) {
  return pairs.map((pair) => (pair.pairId === pairId ? change(pair) : pair));
}

/** A state with a new screen, keeping progress and dropping any stale notice. */
function showing(state: GameState, screen: Screen): GameState {
  return { screen, pairs: state.pairs };
}

/**
 * The only place a game rule lives. Pure: no clock, no network, no GPS, and
 * no randomness — a puzzle is drawn outside and arrives as an event, because
 * the source is asynchronous and a pure function cannot await.
 * See specs/features/pair-flow.md.
 */
export function transition(
  state: GameState,
  event: GameEvent,
  ctx: TransitionContext,
): GameState {
  switch (event.kind) {
    case 'RESET':
      // A reset walks the same route again from nothing: progress lives in
      // memory and this is how it ends. See AC25.
      return { screen: { kind: 'MAP' }, pairs: [] };

    case 'LOCATION_CHANGED': {
      // An open input survives the walk: GPS wobble must not close the panel
      // mid-answer. See AC18.
      if (state.screen.kind === 'ANSWER' || state.screen.kind === 'PUZZLE') {
        return state;
      }
      if (state.screen.kind === 'SOLVED') {
        return state;
      }
      const point = nearestPointInRange(
        event.coordinates,
        actionablePoints(state, ctx.points),
      );
      return showing(state, point ? { kind: 'NEAR', point } : { kind: 'MAP' });
    }

    case 'PUZZLE_DRAWN': {
      // Drawn once per pair and kept. A code that changed while the player
      // walked to the answer point would be unanswerable. See AC4.
      const known = progressFor(state, event.pairId);
      const pairs = known
        ? state.pairs
        : [...state.pairs, { pairId: event.pairId, puzzle: event.puzzle, solved: false }];

      return { screen: { kind: 'PUZZLE', pairId: event.pairId }, pairs };
    }

    case 'PUZZLE_FAILED':
      return { ...state, notice: DRAW_FAILED };

    case 'SHOW_PUZZLE':
      return progressFor(state, event.pairId) === undefined
        ? state
        : showing(state, { kind: 'PUZZLE', pairId: event.pairId });

    case 'CLOSE_PUZZLE':
      return state.screen.kind === 'PUZZLE' ? showing(state, { kind: 'MAP' }) : state;

    case 'OPEN_ANSWER': {
      const { screen } = state;
      if (screen.kind !== 'NEAR' || screen.point.role !== 'answer') {
        return state;
      }
      return progressFor(state, screen.point.pairId) === undefined
        ? state
        : showing(state, { kind: 'ANSWER', pairId: screen.point.pairId, input: '' });
    }

    case 'DIGIT_PRESSED': {
      const { screen } = state;
      if (screen.kind !== 'ANSWER') {
        return state;
      }
      return showing(state, { ...screen, input: appendDigit(screen.input, event.digit) });
    }

    case 'CLEAR': {
      const { screen } = state;
      if (screen.kind !== 'ANSWER' || screen.input === '') {
        // An already empty input is returned as-is, so React sees no change.
        return state;
      }
      return showing(state, { ...screen, input: '' });
    }

    case 'SUBMIT': {
      const { screen } = state;
      if (screen.kind !== 'ANSWER' || screen.input === '') {
        return state;
      }
      const progress = progressFor(state, screen.pairId);
      if (progress === undefined) {
        return state;
      }
      // checkAnswer is the only place an answer is decided.
      if (!checkAnswer(progress.puzzle, screen.input)) {
        return showing(state, { ...screen, input: '' });
      }
      return {
        screen: { kind: 'SOLVED', pairId: screen.pairId },
        pairs: withPair(state.pairs, screen.pairId, (pair) => ({ ...pair, solved: true })),
      };
    }
  }
}
