import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { MapScreen } from './MapScreen';
import type { EscapePoint, GameEvent, GameState } from '../domain/types';

vi.mock('@maplibre/maplibre-react-native', () => ({
  Map: ({ children }: { children?: ReactNode }) =>
    createElement('div', { 'data-testid': 'map-container' }, children),
  Camera: () => null,
  Marker: () => createElement('div', { 'data-testid': 'marker' }),
}));

const POINT: EscapePoint = {
  id: 'p1',
  name: 'Puisto',
  coordinates: { latitude: 60.1699, longitude: 24.9384 },
  radiusMeters: 20,
  role: 'puzzle',
  pairId: 'a',
};

describe('MapScreen', () => {
  it('AC8: standing at a point offers to open the puzzle', () => {
    const events: GameEvent[] = [];
    const collected: string[] = [];

    render(
      createElement(MapScreen, {
        state: { screen: { kind: 'NEAR', point: POINT }, pairs: [] },
        points: [POINT],
        onEvent: (event: GameEvent) => events.push(event),
        onCollect: (pairId: string) => collected.push(pairId),
      }),
    );

    const button = screen.getByText('Avaa tehtävä');
    button.click();

    // Collecting is not a transition: the source is asked first, and the
    // drawn puzzle comes back as an event. See specs/features/pair-flow.md.
    expect(events).toEqual([]);
    expect(collected).toEqual(['a']);
  });

  it('AC9: the offer is absent when no point is in range', () => {
    render(
      createElement(MapScreen, {
        state: { screen: { kind: 'MAP' }, pairs: [] },
        points: [POINT],
        onEvent: () => undefined,
        onCollect: () => undefined,
      }),
    );

    expect(screen.queryByText('Avaa tehtävä')).toBeNull();
  });
});

const ANSWER_POINT: EscapePoint = {
  ...POINT,
  id: 'a-answer',
  name: 'Vastaus',
  coordinates: { latitude: 60.171, longitude: 24.9384 },
  role: 'answer',
};
const PUZZLE_B: EscapePoint = { ...POINT, id: 'b-puzzle', pairId: 'b' };
const ANSWER_B: EscapePoint = { ...ANSWER_POINT, id: 'b-answer', pairId: 'b' };
const COLLECTED_A: GameState = {
  screen: { kind: 'MAP' },
  pairs: [{ pairId: 'a', puzzle: { text: '5 + 2 = ?', answer: 7 }, solved: false }],
};

const mount = (state: GameState, points: EscapePoint[], events: GameEvent[] = []) =>
  render(
    createElement(MapScreen, {
      state,
      points,
      onEvent: (event: GameEvent) => events.push(event),
      onCollect: () => undefined,
    }),
  );

describe('MapScreen — roles and what the player has earned', () => {
  it('AC8: an answer point offers the keypad rather than the task', () => {
    const events: GameEvent[] = [];
    mount({ ...COLLECTED_A, screen: { kind: 'NEAR', point: ANSWER_POINT } }, [POINT, ANSWER_POINT], events);

    expect(screen.queryByText('Avaa tehtävä')).toBeNull();
    screen.getByText('Syötä koodi').click();

    expect(events).toEqual([{ kind: 'OPEN_ANSWER' }]);
  });

  it('AC15: the map draws what the player has earned', () => {
    mount(COLLECTED_A, [POINT, ANSWER_POINT, PUZZLE_B, ANSWER_B]);

    expect(screen.getAllByTestId('marker')).toHaveLength(3);
  });

  it('AC16: a collected puzzle can be re-read from the map', () => {
    const events: GameEvent[] = [];
    mount(COLLECTED_A, [POINT, ANSWER_POINT], events);

    screen.getByText('Näytä pulma').click();

    expect(events).toEqual([{ kind: 'SHOW_PUZZLE', pairId: 'a' }]);
  });
});
