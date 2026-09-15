import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { MAP_ATTRIBUTION, MAP_FALLBACK_CENTRE, MAP_STYLE_URL, initialCentre } from './map';
import type { EscapePoint } from '../domain/types';

/**
 * Built from parts so this test file does not itself contain the strings it
 * searches for — otherwise every search below would match its own source.
 */
const TILE_HOST = ['tiles', 'openfreemap', 'org'].join('.');
const KEY_NAMES = [
  ['api', 'Key'].join(''),
  ['api', '_key'].join(''),
  ['access', '_token'].join(''),
  ['access', 'Token'].join(''),
];

function sourceFiles(dir = 'src'): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      return sourceFiles(path);
    }
    return /\.tsx?$/.test(path) ? [path] : [];
  });
}

function filesContaining(needle: string): string[] {
  return sourceFiles().filter((path) => readFileSync(path, 'utf8').includes(needle));
}

const POINT_A: EscapePoint = {
  id: 'p1',
  name: 'Eka',
  coordinates: { latitude: 60.1699, longitude: 24.9384 },
  radiusMeters: 20,
  role: 'puzzle',
  pairId: 'a',
};
const POINT_B: EscapePoint = { ...POINT_A, id: 'p2', coordinates: { latitude: 60.2, longitude: 25 } };

describe('initialCentre', () => {
  it('AC12: the centre is the player, when the player is known', () => {
    expect(initialCentre([POINT_A, POINT_B], { latitude: 60.4, longitude: 25.1 })).toEqual([
      25.1, 60.4,
    ]);
  });

  it('AC17: without a position the centre is the first point', () => {
    expect(initialCentre([POINT_A, POINT_B], undefined)).toEqual([24.9384, 60.1699]);
  });

  it('AC13: with no points and no position the centre falls back to a named constant', () => {
    expect(initialCentre([], undefined)).toEqual(MAP_FALLBACK_CENTRE);
  });

  it('AC12: a known position wins even when there are no points', () => {
    expect(initialCentre([], { latitude: 60.4, longitude: 25.1 })).toEqual([25.1, 60.4]);
  });
});

describe('map configuration', () => {
  it('AC1: the style URL is defined exactly once, in src/config/map.ts', () => {
    expect(filesContaining(TILE_HOST)).toEqual(['src/config/map.ts']);
    expect(MAP_STYLE_URL).toBe(`https://${TILE_HOST}/styles/liberty`);
  });

  it('AC2: both platform maps read the shared constant', () => {
    for (const path of ['src/ui/Map.tsx', 'src/ui/Map.web.tsx']) {
      expect(readFileSync(path, 'utf8')).toContain('MAP_STYLE_URL');
    }
  });

  it('AC3: the attribution string is exactly as the licence requires', () => {
    expect(MAP_ATTRIBUTION).toBe('© OpenMapTiles Data from OpenStreetMap');
  });

  it('AC10: the web map loads MapLibre’s stylesheet', () => {
    const source = readFileSync('src/ui/Map.web.tsx', 'utf8');

    expect(source).toContain(['maplibre-gl', 'dist', 'maplibre-gl.css'].join('/'));
  });

  it('AC11: the web map serves MapLibre’s worker as JavaScript', () => {
    const source = readFileSync('src/ui/Map.web.tsx', 'utf8');

    expect(source).toContain('setWorkerUrl');
    expect(source).toContain('/maplibre-gl-worker.mjs');
    expect(existsSync('public/maplibre-gl-worker.mjs')).toBe(true);
  });

  it('AC7: no API key or access token appears anywhere in the source', () => {
    for (const name of KEY_NAMES) {
      expect(filesContaining(name)).toEqual([]);
    }
  });
});
