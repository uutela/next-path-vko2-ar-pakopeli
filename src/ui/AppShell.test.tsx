import { act, render, screen, waitFor } from '@testing-library/react';
import { createElement, useRef } from 'react';
import type { ReactNode } from 'react';
import { AppShell } from './AppShell';
import type { AppShellProps } from './AppShell';
import { createMockLocationSource } from '../adapters/location';
import type { AudioPlayer } from '../adapters/audio';
import type { CameraAdapter } from '../adapters/camera';
import type { PointStore } from '../adapters/pointStore';
import type { Coordinates, EscapePoint } from '../domain/types';

vi.mock('@maplibre/maplibre-react-native', () => ({
  Map: ({ children }: { children?: ReactNode }) =>
    createElement('div', { 'data-testid': 'map-container' }, children),
  Camera: () => null,
  Marker: () => createElement('div', { 'data-testid': 'marker' }),
}));

vi.mock('@reactvision/react-viro', () => ({
  ViroMaterials: { createMaterials: () => undefined },
  ViroARSceneNavigator: ({
    initialScene,
    viroAppProps,
  }: {
    initialScene: { scene: (p: { sceneNavigator: unknown }) => ReactNode };
    viroAppProps?: unknown;
  }) => {
    const captured = useRef(initialScene.scene);
    const navigator = useRef({ viroAppProps });
    navigator.current.viroAppProps = viroAppProps;
    const Scene = captured.current;
    return createElement(
      'div',
      { 'data-testid': 'camera-preview' },
      createElement(Scene as never, { sceneNavigator: navigator.current }),
    );
  },
  ViroARScene: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  ViroFlexView: ({
    children,
    onClick,
    viroTag,
  }: {
    children?: ReactNode;
    onClick?: () => void;
    viroTag?: string;
  }) =>
    createElement(
      'div',
      { 'data-testid': viroTag, onClick: onClick ? () => onClick() : undefined },
      children,
    ),
  ViroText: ({ text }: { text: string }) => createElement('span', null, text),
  ViroNode: ({ children, viroTag }: { children?: ReactNode; viroTag?: string }) =>
    createElement('div', { 'data-testid': viroTag }, children),
}));

const POINT: EscapePoint = {
  id: 'p1',
  name: 'Puisto',
  coordinates: { latitude: 60.1699, longitude: 24.9384 },
  radiusMeters: 20,
  role: 'puzzle',
  pairId: 'a',
};
const INSIDE: Coordinates = { latitude: 60.1700708711, longitude: 24.9384 };

function fakePointStore(stored: EscapePoint[] = []) {
  let loads = 0;
  const store: PointStore = {
    loadStoredPoints: () => {
      loads += 1;
      return Promise.resolve(stored);
    },
    saveStoredPoints: () => Promise.resolve(),
  };
  return { store, loads: () => loads };
}

function scriptedRng(...values: number[]): () => number {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)] ?? 0;
}

function setup(overrides: Partial<AppShellProps> = {}) {
  const location = createMockLocationSource([INSIDE]);
  const { store, loads } = fakePointStore();
  const camera: CameraAdapter = { permission: 'granted', request: () => undefined };
  const audio: AudioPlayer = { play: () => undefined };
  const props: AppShellProps = {
    seed: [POINT],
    pointStore: store,
    location,
    audio,
    camera,
    rng: scriptedRng(0.5, 0.2),
    ...overrides,
  };
  const view = render(createElement(AppShell, props));
  return { view, props, location, loads };
}

const pressKey = (label: string) => act(() => screen.getByTestId(`key-${label}`).click());

describe('AppShell', () => {
  it('AC1: the map state shows the map screen', async () => {
    setup();

    await waitFor(() =>
      expect(screen.getByText('© OpenMapTiles Data from OpenStreetMap')).toBeTruthy(),
    );
    expect(screen.queryByText('Avaa tehtävä')).toBeNull();
    expect(screen.queryByText('5 + 2 = ?')).toBeNull();
  });

  it('AC2: walking into range offers the puzzle', async () => {
    const { location } = setup();

    act(() => location.advance());

    await waitFor(() => expect(screen.getAllByText('Avaa tehtävä')).toHaveLength(1));
  });

  it('AC3: opening the puzzle shows the AR screen', async () => {
    const { location } = setup();
    act(() => location.advance());
    await waitFor(() => screen.getByText('Avaa tehtävä'));

    act(() => screen.getByText('Avaa tehtävä').click());

    expect(screen.getAllByText('5 + 2 = ?')).toHaveLength(1);
    expect(screen.queryByText('Avaa tehtävä')).toBeNull();
  });

  it('AC4: solving the puzzle reaches the congratulation', async () => {
    const { location } = setup();
    act(() => location.advance());
    await waitFor(() => screen.getByText('Avaa tehtävä'));
    act(() => screen.getByText('Avaa tehtävä').click());

    pressKey('7');
    pressKey('OK');

    expect(screen.getAllByText('Oikein! Laatikko aukesi.')).toHaveLength(1);
  });

  it('AC5: stored points are merged with the seed, and loaded once', async () => {
    const stored: EscapePoint = { ...POINT, id: 'p2', name: 'Kentta' };
    const { store, loads } = fakePointStore([stored]);
    setup({ pointStore: store });

    await waitFor(() => expect(screen.getAllByTestId('marker')).toHaveLength(2));
    expect(loads()).toBe(1);
  });

  it('AC5: an empty store leaves the seed alone', async () => {
    setup();

    await waitFor(() => expect(screen.getAllByTestId('marker')).toHaveLength(1));
  });

  it('AC6: the location subscription is cancelled on unmount', async () => {
    let cancels = 0;
    const location = {
      watch: () => () => {
        cancels += 1;
      },
    };
    const { view } = setup({ location });
    await waitFor(() => screen.getByTestId('map-container'));

    view.unmount();

    expect(cancels).toBe(1);
  });

  it('AC7: solved progress does not survive a restart', async () => {
    const { store } = fakePointStore();
    const first = setup({ pointStore: store });
    act(() => first.location.advance());
    await waitFor(() => screen.getByText('Avaa tehtävä'));
    act(() => screen.getByText('Avaa tehtävä').click());
    pressKey('7');
    pressKey('OK');
    expect(screen.getAllByText('Oikein! Laatikko aukesi.')).toHaveLength(1);

    first.view.unmount();
    setup({ pointStore: store });

    await waitFor(() =>
      expect(screen.getByText('© OpenMapTiles Data from OpenStreetMap')).toBeTruthy(),
    );
    expect(screen.queryByText('Oikein! Laatikko aukesi.')).toBeNull();
  });
});
