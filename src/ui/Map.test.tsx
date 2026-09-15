import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { Map } from './Map';
import { initialCentre } from '../config/map';
import type { EscapePoint } from '../domain/types';

/** Records what our component asks MapLibre to draw, without a native module. */
const markerCalls: Array<[number, number]> = [];

/** Records what our component asks MapLibre's camera to look at. */
const cameraCalls: Array<[number, number] | undefined> = [];

vi.mock('@maplibre/maplibre-react-native', async () => {
  const { useState } = await import('react');

  return {
    Map: ({ children }: { children?: ReactNode }) =>
      createElement('div', { 'data-testid': 'map-container' }, children),
    // Recorded once per *mount*, not per render: the camera takes an initial
    // view state, so what matters is how often a new one is read, and that is
    // what AC18 is about. A useState initialiser runs exactly once per mount.
    Camera: ({ initialViewState }: { initialViewState?: { center?: [number, number] } }) => {
      useState(() => cameraCalls.push(initialViewState?.center));
      return null;
    },
    Marker: ({ lngLat }: { lngLat: [number, number] }) => {
      markerCalls.push(lngLat);
      return createElement('div', { 'data-testid': 'marker' });
    },
  };
});

const POINT_A: EscapePoint = {
  id: 'p1',
  name: 'Puisto',
  coordinates: { latitude: 60.1699, longitude: 24.9384 },
  radiusMeters: 20,
  role: 'puzzle',
  pairId: 'a',
};
const POINT_B: EscapePoint = {
  id: 'p2',
  name: 'Kentta',
  coordinates: { latitude: 60.171, longitude: 24.94 },
  radiusMeters: 20,
  role: 'puzzle',
  pairId: 'a',
};

beforeEach(() => {
  markerCalls.length = 0;
  cameraCalls.length = 0;
});

describe('Map', () => {
  it('AC4: the attribution is visible on the map', () => {
    render(createElement(Map, { points: [POINT_A] }));

    const node = screen.getByText('© OpenMapTiles Data from OpenStreetMap');
    const style = getComputedStyle(node);

    expect(Number.parseFloat(style.fontSize)).toBeGreaterThanOrEqual(11);
    expect(Number.parseFloat(style.opacity || '1')).toBeGreaterThanOrEqual(0.8);
    expect(style.display).not.toBe('none');
  });

  it('AC5: one marker is rendered per point', () => {
    render(createElement(Map, { points: [POINT_A, POINT_B] }));

    expect(screen.getAllByTestId('marker')).toHaveLength(2);
    expect(markerCalls).toEqual([
      [POINT_A.coordinates.longitude, POINT_A.coordinates.latitude],
      [POINT_B.coordinates.longitude, POINT_B.coordinates.latitude],
    ]);
  });

  it('AC14: the map centres where initialCentre says', () => {
    render(createElement(Map, { points: [POINT_A, POINT_B] }));

    expect(cameraCalls).toEqual([initialCentre([POINT_A, POINT_B], undefined)]);
  });

  it('AC12: with a position known, the map centres on the player', () => {
    const player = { latitude: 60.4, longitude: 25.1 };
    render(createElement(Map, { points: [POINT_A, POINT_B], player }));

    expect(cameraCalls).toEqual([[25.1, 60.4]]);
  });

  it('AC18: a position arriving after mount re-mounts the map, once', () => {
    const player = { latitude: 60.4, longitude: 25.1 };
    const view = render(createElement(Map, { points: [POINT_A, POINT_B] }));
    expect(cameraCalls).toEqual([initialCentre([POINT_A, POINT_B], undefined)]);

    view.rerender(createElement(Map, { points: [POINT_A, POINT_B], player }));
    expect(cameraCalls).toEqual([initialCentre([POINT_A, POINT_B], undefined), [25.1, 60.4]]);

    // Moving again does not re-centre: the key is the presence of a position,
    // not the position itself.
    view.rerender(
      createElement(Map, {
        points: [POINT_A, POINT_B],
        player: { latitude: 60.5, longitude: 25.2 },
      }),
    );
    expect(cameraCalls).toHaveLength(2);
  });

  it('AC6: an empty point list renders a map with no markers', () => {
    expect(() => render(createElement(Map, { points: [] }))).not.toThrow();

    expect(screen.queryAllByTestId('marker')).toHaveLength(0);
    expect(screen.getByTestId('map-container')).toBeTruthy();
  });
});
