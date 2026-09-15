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

    render(
      createElement(MapScreen, {
        state: { kind: 'NEAR', point: POINT },
        points: [POINT],
        onEvent: (event: GameEvent) => events.push(event),
      }),
    );

    const button = screen.getByText('Avaa tehtävä');
    button.click();

    expect(events).toEqual([{ kind: 'OPEN_PUZZLE' }]);
  });

  it('AC9: the offer is absent when no point is in range', () => {
    render(
      createElement(MapScreen, {
        state: { kind: 'MAP' },
        points: [POINT],
        onEvent: () => undefined,
      }),
    );

    expect(screen.queryByText('Avaa tehtävä')).toBeNull();
  });
});
