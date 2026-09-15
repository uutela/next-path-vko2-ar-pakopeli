import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { MapScreen } from './MapScreen';
import type { EscapePoint, GameEvent } from '../domain/types';

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
