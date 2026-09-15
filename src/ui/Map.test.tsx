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

vi.mock('@maplibre/maplibre-react-native', () => ({
  Map: ({ children }: { children?: ReactNode }) =>
    createElement('div', { 'data-testid': 'map-container' }, children),
  Camera: ({ initialViewState }: { initialViewState?: { center?: [number, number] } }) => {
    cameraCalls.push(initialViewState?.center);
    return null;
  },
  Marker: ({ lngLat }: { lngLat: [number, number] }) => {
    markerCalls.push(lngLat);
    return createElement('div', { 'data-testid': 'marker' });
  },
}));

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

    expect(cameraCalls).toEqual([initialCentre([POINT_A, POINT_B])]);
  });

  it('AC6: an empty point list renders a map with no markers', () => {
    expect(() => render(createElement(Map, { points: [] }))).not.toThrow();

    expect(screen.queryAllByTestId('marker')).toHaveLength(0);
    expect(screen.getByTestId('map-container')).toBeTruthy();
  });
});
