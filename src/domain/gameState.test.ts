import { transition } from './gameState';
import { actionablePoints, visiblePoints } from './pairs';
import type { EscapePoint, GameState, Puzzle, TransitionContext } from './types';

const LON = 24.9384;

const PUZZLE_A: EscapePoint = {
  id: 'a-puzzle',
  name: 'Tehtävä',
  coordinates: { latitude: 60.1699, longitude: LON },
  radiusMeters: 20,
  role: 'puzzle',
  pairId: 'a',
};
const ANSWER_A: EscapePoint = {
  ...PUZZLE_A,
  id: 'a-answer',
  name: 'Vastaus',
  coordinates: { latitude: 60.171, longitude: LON },
  role: 'answer',
};
const PUZZLE_B: EscapePoint = { ...PUZZLE_A, id: 'b-puzzle', coordinates: { latitude: 60.172, longitude: LON }, pairId: 'b' };
const ANSWER_B: EscapePoint = { ...ANSWER_A, id: 'b-answer', coordinates: { latitude: 60.173, longitude: LON }, pairId: 'b' };

/** 19 m from PUZZLE_A. */
const NEAR_PUZZLE_A = { latitude: 60.1700708711, longitude: LON };
/** 19 m from ANSWER_A. */
const NEAR_ANSWER_A = { latitude: 60.1708291289, longitude: LON };
/** 100 m from PUZZLE_A and 22 m from ANSWER_A — outside both. */
const FAR = { latitude: 60.1707993216, longitude: LON };

const DRAWN_A: Puzzle = { text: '5 + 2 = ?', answer: 7 };
const DRAWN_B: Puzzle = { text: '9 + 3 = ?', answer: 12 };

const ctx: TransitionContext = { points: [PUZZLE_A, ANSWER_A, PUZZLE_B, ANSWER_B] };

const EMPTY: GameState = { screen: { kind: 'MAP' }, pairs: [] };
const COLLECTED_A: GameState = {
  screen: { kind: 'MAP' },
  pairs: [{ pairId: 'a', puzzle: DRAWN_A, solved: false }],
};
const SOLVED_A: GameState = {
  screen: { kind: 'MAP' },
  pairs: [{ pairId: 'a', puzzle: DRAWN_A, solved: true }],
};

const at = (state: GameState, coordinates: { latitude: number; longitude: number }) =>
  transition(state, { kind: 'LOCATION_CHANGED', coordinates }, ctx);

describe('transition — reaching points', () => {
  it('AC1: a puzzle point in range offers itself', () => {
    expect(at(EMPTY, NEAR_PUZZLE_A)).toEqual({
      screen: { kind: 'NEAR', point: PUZZLE_A },
      pairs: [],
    });
  });

  it('AC2: an answer point whose puzzle is not collected is inert', () => {
    expect(at(EMPTY, NEAR_ANSWER_A)).toEqual(EMPTY);
  });

  it('AC9: a collected answer point is reachable', () => {
    expect(at(COLLECTED_A, NEAR_ANSWER_A).screen).toEqual({ kind: 'NEAR', point: ANSWER_A });
  });

  it('AC8: a solved pair offers nothing at either of its points', () => {
    expect(at(SOLVED_A, NEAR_PUZZLE_A).screen).toEqual({ kind: 'MAP' });
    expect(at(SOLVED_A, NEAR_ANSWER_A).screen).toEqual({ kind: 'MAP' });
  });

  it('AC19: the nearest actionable point wins when two are in range', () => {
    const closer: EscapePoint = {
      ...PUZZLE_B,
      coordinates: { latitude: 60.1700888575, longitude: LON },
    };

    const state = transition(
      EMPTY,
      { kind: 'LOCATION_CHANGED', coordinates: NEAR_PUZZLE_A },
      { points: [PUZZLE_A, closer] },
    );

    expect(state.screen).toEqual({ kind: 'NEAR', point: closer });
  });

  it('walking out of range returns to the map', () => {
    const near = at(EMPTY, NEAR_PUZZLE_A);

    expect(at(near, FAR).screen).toEqual({ kind: 'MAP' });
  });
});

describe('transition — collecting the puzzle', () => {
  it('AC3: a drawn puzzle is stored against its pair and shown', () => {
    const near = at(EMPTY, NEAR_PUZZLE_A);

    expect(transition(near, { kind: 'PUZZLE_DRAWN', pairId: 'a', puzzle: DRAWN_A }, ctx)).toEqual({
      screen: { kind: 'PUZZLE', pairId: 'a' },
      pairs: [{ pairId: 'a', puzzle: { text: '5 + 2 = ?', answer: 7 }, solved: false }],
    });
  });

  it('AC4: a pair is drawn once and never redrawn', () => {
    const again = transition(
      COLLECTED_A,
      { kind: 'PUZZLE_DRAWN', pairId: 'a', puzzle: { text: '9 + 9 = ?', answer: 18 } },
      ctx,
    );

    expect(again.pairs).toEqual([{ pairId: 'a', puzzle: DRAWN_A, solved: false }]);
    expect(again.screen).toEqual({ kind: 'PUZZLE', pairId: 'a' });
  });

  it('AC11: the puzzle can be re-read from the map', () => {
    const shown = transition(COLLECTED_A, { kind: 'SHOW_PUZZLE', pairId: 'a' }, ctx);

    expect(shown.screen).toEqual({ kind: 'PUZZLE', pairId: 'a' });
    expect(shown.pairs).toEqual(COLLECTED_A.pairs);
  });

  it('AC12: an uncollected pair cannot be re-read', () => {
    expect(transition(EMPTY, { kind: 'SHOW_PUZZLE', pairId: 'a' }, ctx)).toEqual(EMPTY);
  });

  it('AC13: closing the puzzle returns to the map', () => {
    const shown = transition(COLLECTED_A, { kind: 'SHOW_PUZZLE', pairId: 'a' }, ctx);

    expect(transition(shown, { kind: 'CLOSE_PUZZLE' }, ctx).screen).toEqual({ kind: 'MAP' });
  });

  it('AC23: a failed draw says so and leaves the player where they are', () => {
    const near = at(EMPTY, NEAR_PUZZLE_A);
    const failed = transition(near, { kind: 'PUZZLE_FAILED' }, ctx);

    expect(failed.screen).toEqual({ kind: 'NEAR', point: PUZZLE_A });
    expect(failed.pairs).toEqual([]);
    expect(failed.notice).toBe('Tehtävän haku epäonnistui. Yritä uudelleen.');
  });

  it('AC24: a later success clears the notice', () => {
    const near = at(EMPTY, NEAR_PUZZLE_A);
    const failed = transition(near, { kind: 'PUZZLE_FAILED' }, ctx);
    const drawn = transition(failed, { kind: 'PUZZLE_DRAWN', pairId: 'a', puzzle: DRAWN_A }, ctx);

    expect(drawn.notice).toBeUndefined();
    expect(drawn.screen).toEqual({ kind: 'PUZZLE', pairId: 'a' });
  });
});

describe('transition — answering', () => {
  const atAnswerPoint = (state: GameState) => at(state, NEAR_ANSWER_A);
  const opened = (state: GameState) =>
    transition(atAnswerPoint(state), { kind: 'OPEN_ANSWER' }, ctx);

  it('AC10: opening the answer point starts an empty input', () => {
    expect(opened(COLLECTED_A).screen).toEqual({ kind: 'ANSWER', pairId: 'a', input: '' });
  });

  it('AC14: the correct code solves that pair and only that pair', () => {
    const twoPairs: GameState = {
      screen: { kind: 'ANSWER', pairId: 'a', input: '7' },
      pairs: [
        { pairId: 'a', puzzle: DRAWN_A, solved: false },
        { pairId: 'b', puzzle: DRAWN_B, solved: false },
      ],
    };

    const solved = transition(twoPairs, { kind: 'SUBMIT' }, ctx);

    expect(solved.screen).toEqual({ kind: 'SOLVED', pairId: 'a' });
    expect(solved.pairs).toEqual([
      { pairId: 'a', puzzle: DRAWN_A, solved: true },
      { pairId: 'b', puzzle: DRAWN_B, solved: false },
    ]);
  });

  it('AC15: a wrong code clears the input and keeps the same puzzle', () => {
    const wrong: GameState = {
      screen: { kind: 'ANSWER', pairId: 'a', input: '8' },
      pairs: COLLECTED_A.pairs,
    };

    const after = transition(wrong, { kind: 'SUBMIT' }, ctx);

    expect(after.screen).toEqual({ kind: 'ANSWER', pairId: 'a', input: '' });
    expect(after.pairs[0]?.puzzle).toEqual(DRAWN_A);
  });

  it('AC16: submitting an empty input is not an error', () => {
    const empty = opened(COLLECTED_A);

    expect(() => transition(empty, { kind: 'SUBMIT' }, ctx)).not.toThrow();
    expect(transition(empty, { kind: 'SUBMIT' }, ctx)).toEqual(empty);
  });

  it('AC17: a seventh digit is refused', () => {
    const full: GameState = {
      screen: { kind: 'ANSWER', pairId: 'a', input: '123456' },
      pairs: COLLECTED_A.pairs,
    };

    expect(transition(full, { kind: 'DIGIT_PRESSED', digit: '7' }, ctx).screen).toEqual(full.screen);
  });

  it('a pressed digit lands in the input', () => {
    const typed = transition(opened(COLLECTED_A), { kind: 'DIGIT_PRESSED', digit: '7' }, ctx);

    expect(typed.screen).toEqual({ kind: 'ANSWER', pairId: 'a', input: '7' });
  });

  it('clear empties the input without redrawing the puzzle', () => {
    const typed = transition(opened(COLLECTED_A), { kind: 'DIGIT_PRESSED', digit: '7' }, ctx);
    const cleared = transition(typed, { kind: 'CLEAR' }, ctx);

    expect(cleared.screen).toEqual({ kind: 'ANSWER', pairId: 'a', input: '' });
    expect(cleared.pairs).toEqual(COLLECTED_A.pairs);
  });

  it('AC18: walking away does not close an open input', () => {
    const typed = transition(opened(COLLECTED_A), { kind: 'DIGIT_PRESSED', digit: '1' }, ctx);

    expect(at(typed, FAR)).toEqual(typed);
  });
});

describe('transition — progress', () => {
  it('AC25: reset starts the whole game over', () => {
    const played: GameState = {
      screen: { kind: 'SOLVED', pairId: 'a' },
      pairs: [{ pairId: 'a', puzzle: DRAWN_A, solved: true }],
      notice: 'jotain',
    };

    expect(transition(played, { kind: 'RESET' }, ctx)).toEqual({
      screen: { kind: 'MAP' },
      pairs: [],
    });
  });

  it('AC26: transition never mutates the state it was given', () => {
    const before = JSON.parse(JSON.stringify(COLLECTED_A)) as GameState;

    transition(COLLECTED_A, { kind: 'PUZZLE_DRAWN', pairId: 'b', puzzle: DRAWN_B }, ctx);
    transition(COLLECTED_A, { kind: 'SHOW_PUZZLE', pairId: 'a' }, ctx);
    at(COLLECTED_A, NEAR_ANSWER_A);

    expect(COLLECTED_A).toEqual(before);
  });

  it('AC27: an event that does not apply leaves the state untouched', () => {
    for (const event of [
      { kind: 'SUBMIT' },
      { kind: 'CLEAR' },
      { kind: 'DIGIT_PRESSED', digit: '1' },
      { kind: 'OPEN_ANSWER' },
      { kind: 'CLOSE_PUZZLE' },
    ] as const) {
      expect(transition(EMPTY, event, ctx)).toEqual(EMPTY);
    }
  });
});

describe('visiblePoints and actionablePoints', () => {
  it('AC5: with nothing collected, only puzzle points are on the map', () => {
    expect(visiblePoints(EMPTY, ctx.points).map((p) => p.id)).toEqual(['a-puzzle', 'b-puzzle']);
  });

  it('AC6: collecting a puzzle reveals only its own answer point', () => {
    expect(visiblePoints(COLLECTED_A, ctx.points).map((p) => p.id)).toEqual([
      'a-answer',
      'a-puzzle',
      'b-puzzle',
    ]);
  });

  it('AC7: a solved pair stays on the map', () => {
    expect(visiblePoints(SOLVED_A, ctx.points).map((p) => p.id)).toEqual([
      'a-answer',
      'a-puzzle',
      'b-puzzle',
    ]);
  });

  it('AC8: a solved pair is not actionable', () => {
    expect(actionablePoints(SOLVED_A, ctx.points).map((p) => p.id)).toEqual(['b-puzzle']);
  });
});

describe('several pairs at once', () => {
  it('AC6: collecting pair A does not reveal pair B’s answer point', () => {
    const collectedA = transition(
      EMPTY,
      { kind: 'PUZZLE_DRAWN', pairId: 'a', puzzle: DRAWN_A },
      ctx,
    );

    expect(visiblePoints(collectedA, ctx.points).map((p) => p.id)).toEqual([
      'a-answer',
      'a-puzzle',
      'b-puzzle',
    ]);
    // Back to the map first: walking while reading the puzzle deliberately
    // changes nothing, so the inertness has to be tested from the map.
    const onMap = transition(collectedA, { kind: 'CLOSE_PUZZLE' }, ctx);

    expect(at(onMap, { latitude: 60.1730708711, longitude: LON }).screen).toEqual({ kind: 'MAP' });
  });

  it('two pairs keep their own puzzles, and one answer does not open the other', () => {
    const both: GameState = {
      screen: { kind: 'ANSWER', pairId: 'b', input: '7' },
      pairs: [
        { pairId: 'a', puzzle: DRAWN_A, solved: false },
        { pairId: 'b', puzzle: DRAWN_B, solved: false },
      ],
    };

    // 7 answers pair a, not pair b: a wrong code clears the input.
    const after = transition(both, { kind: 'SUBMIT' }, ctx);

    expect(after.screen).toEqual({ kind: 'ANSWER', pairId: 'b', input: '' });
    expect(after.pairs.every((pair) => !pair.solved)).toBe(true);
  });
});

describe('a puzzle point that has already given its puzzle', () => {
  it('AC28: it is no longer actionable', () => {
    expect(actionablePoints(COLLECTED_A, ctx.points).map((p) => p.id)).toEqual([
      'a-answer',
      'b-puzzle',
    ]);
  });

  it('AC28: standing there offers nothing', () => {
    expect(at(COLLECTED_A, NEAR_PUZZLE_A).screen).toEqual({ kind: 'MAP' });
  });

  it('AC28: it no longer shadows its own answer point at the same distance', () => {
    // Both points of pair "a" in one place, and the puzzle point sorted
    // first — the real seed is p1/p2, which is exactly this order. With the
    // ids the other way round the tie resolves in the answer point's favour
    // by accident, and the test proves nothing.
    const samePlace = [
      { ...PUZZLE_A, id: 'p1', coordinates: PUZZLE_A.coordinates },
      { ...ANSWER_A, id: 'p2', coordinates: PUZZLE_A.coordinates },
    ];

    const state = transition(
      COLLECTED_A,
      { kind: 'LOCATION_CHANGED', coordinates: NEAR_PUZZLE_A },
      { points: samePlace },
    );

    expect(state.screen).toEqual({ kind: 'NEAR', point: samePlace[1] });
  });
});
