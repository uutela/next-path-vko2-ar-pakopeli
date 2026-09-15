import { transition } from './gameState';
import { scriptedRng } from '../testing/scriptedRng';
import type { EscapePoint, GameEvent, GameState, TransitionContext } from './types';

const REFERENCE = { latitude: 60.1699, longitude: 24.9384 };
/** 19 m from REFERENCE, and 2 m from POINT_B. */
const INSIDE = { latitude: 60.1700708711, longitude: 24.9384 };
/** 100 m from REFERENCE — outside every radius below. */
const OUTSIDE = { latitude: 60.1707993216, longitude: 24.9384 };

const POINT: EscapePoint = {
  id: 'p1',
  name: 'Testipiste',
  coordinates: REFERENCE,
  radiusMeters: 20,
  role: 'puzzle',
  pairId: 'a',
};

const POINT_B: EscapePoint = {
  id: 'p2',
  name: 'Lahempi',
  coordinates: { latitude: 60.1700888575, longitude: 24.9384 },
  radiusMeters: 20,
  role: 'puzzle',
  pairId: 'a',
};

/** Draws 5 + 2 = 7, matching the puzzle used throughout these criteria. */
const ctx = (): TransitionContext => ({ points: [POINT], rng: scriptedRng(0.5, 0.2) });

const PUZZLE_STATE: GameState = {
  kind: 'PUZZLE',
  point: POINT,
  puzzle: { text: '5 + 2 = ?', answer: 7 },
  input: '',
};

describe('transition', () => {
  it('AC1: walking into range opens the point', () => {
    const next = transition({ kind: 'MAP' }, { kind: 'LOCATION_CHANGED', coordinates: INSIDE }, ctx());

    expect(next).toEqual({ kind: 'NEAR', point: POINT });
  });

  it('AC2: staying out of range keeps the map', () => {
    const next = transition({ kind: 'MAP' }, { kind: 'LOCATION_CHANGED', coordinates: OUTSIDE }, ctx());

    expect(next).toEqual({ kind: 'MAP' });
  });

  it('AC3: walking out of range closes the point again', () => {
    const next = transition({ kind: 'NEAR', point: POINT }, { kind: 'LOCATION_CHANGED', coordinates: OUTSIDE }, ctx());

    expect(next).toEqual({ kind: 'MAP' });
  });

  it('AC4: opening the puzzle draws one and clears the input', () => {
    const next = transition({ kind: 'NEAR', point: POINT }, { kind: 'OPEN_PUZZLE' }, ctx());

    expect(next).toEqual({
      kind: 'PUZZLE',
      point: POINT,
      puzzle: { text: '5 + 2 = ?', answer: 7 },
      input: '',
    });
  });

  it('AC5: walking away does not close an open puzzle', () => {
    const next = transition(PUZZLE_STATE, { kind: 'LOCATION_CHANGED', coordinates: OUTSIDE }, ctx());

    expect(next).toEqual(PUZZLE_STATE);
  });

  it('AC6: a pressed digit lands in the input', () => {
    const state: GameState = { ...PUZZLE_STATE, input: '1' };

    const next = transition(state, { kind: 'DIGIT_PRESSED', digit: '2' }, ctx());

    expect(next).toEqual({ ...PUZZLE_STATE, input: '12' });
  });

  it('AC7: the correct answer solves the point', () => {
    const state: GameState = { ...PUZZLE_STATE, input: '7' };

    const next = transition(state, { kind: 'SUBMIT' }, ctx());

    expect(next).toEqual({ kind: 'SOLVED', point: POINT });
  });

  it('AC8: a wrong answer clears the input and keeps the same puzzle', () => {
    const state: GameState = { ...PUZZLE_STATE, input: '8' };

    const next = transition(state, { kind: 'SUBMIT' }, ctx());

    expect(next).toEqual({
      kind: 'PUZZLE',
      point: POINT,
      puzzle: { text: '5 + 2 = ?', answer: 7 },
      input: '',
    });
  });

  it('AC9: submitting an empty input is not an error', () => {
    expect(() => transition(PUZZLE_STATE, { kind: 'SUBMIT' }, ctx())).not.toThrow();
    expect(transition(PUZZLE_STATE, { kind: 'SUBMIT' }, ctx())).toEqual(PUZZLE_STATE);
  });

  it('AC10: a solved point stays solved when the player walks away', () => {
    const next = transition({ kind: 'SOLVED', point: POINT }, { kind: 'LOCATION_CHANGED', coordinates: OUTSIDE }, ctx());

    expect(next).toEqual({ kind: 'SOLVED', point: POINT });
  });

  it('AC11: reset returns to the map from any state', () => {
    const next = transition({ kind: 'SOLVED', point: POINT }, { kind: 'RESET' }, ctx());

    expect(next).toEqual({ kind: 'MAP' });
  });

  it('AC12: submitting from the map leaves the state untouched', () => {
    expect(() => transition({ kind: 'MAP' }, { kind: 'SUBMIT' }, ctx())).not.toThrow();
    expect(transition({ kind: 'MAP' }, { kind: 'SUBMIT' }, ctx())).toEqual({ kind: 'MAP' });
  });

  it('AC12: pressing a digit while only near leaves the state untouched', () => {
    const state: GameState = { kind: 'NEAR', point: POINT };

    expect(transition(state, { kind: 'DIGIT_PRESSED', digit: '2' }, ctx())).toEqual(state);
  });

  it('AC12: clearing from the map leaves the state untouched', () => {
    expect(transition({ kind: 'MAP' }, { kind: 'CLEAR' }, ctx())).toEqual({ kind: 'MAP' });
  });

  it('AC13: the nearest point wins when two are in range', () => {
    const twoPoints: TransitionContext = { points: [POINT, POINT_B], rng: scriptedRng(0.5, 0.2) };

    const next = transition({ kind: 'MAP' }, { kind: 'LOCATION_CHANGED', coordinates: INSIDE }, twoPoints);

    expect(next).toEqual({ kind: 'NEAR', point: POINT_B });
  });

  it('AC13: an empty point list keeps the map without throwing', () => {
    const noPoints: TransitionContext = { points: [], rng: scriptedRng(0.5, 0.2) };

    expect(() => transition({ kind: 'MAP' }, { kind: 'LOCATION_CHANGED', coordinates: INSIDE }, noPoints)).not.toThrow();
    expect(transition({ kind: 'MAP' }, { kind: 'LOCATION_CHANGED', coordinates: INSIDE }, noPoints)).toEqual({ kind: 'MAP' });
  });

  it('AC14: transition never mutates the state it was given', () => {
    const states: GameState[] = [
      { kind: 'MAP' },
      { kind: 'NEAR', point: POINT },
      { ...PUZZLE_STATE, input: '1' },
      { kind: 'SOLVED', point: POINT },
    ];
    const events: GameEvent[] = [
      { kind: 'LOCATION_CHANGED', coordinates: INSIDE },
      { kind: 'LOCATION_CHANGED', coordinates: OUTSIDE },
      { kind: 'OPEN_PUZZLE' },
      { kind: 'DIGIT_PRESSED', digit: '3' },
      { kind: 'CLEAR' },
      { kind: 'SUBMIT' },
      { kind: 'RESET' },
    ];

    for (const state of states) {
      for (const event of events) {
        const before = structuredClone(state);
        transition(state, event, ctx());
        expect(state).toEqual(before);
      }
    }
  });

  it('AC15: clear empties the input without redrawing the puzzle', () => {
    const state: GameState = { ...PUZZLE_STATE, input: '12' };

    const next = transition(state, { kind: 'CLEAR' }, ctx());

    expect(next).toEqual({
      kind: 'PUZZLE',
      point: POINT,
      puzzle: { text: '5 + 2 = ?', answer: 7 },
      input: '',
    });
  });

  it('AC15: clearing an already empty input is harmless', () => {
    expect(() => transition(PUZZLE_STATE, { kind: 'CLEAR' }, ctx())).not.toThrow();
    expect(transition(PUZZLE_STATE, { kind: 'CLEAR' }, ctx())).toEqual(PUZZLE_STATE);
  });
});
