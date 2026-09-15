import { render, screen } from '@testing-library/react';
import { createElement, useRef } from 'react';
import type { ReactNode } from 'react';
import { ArScreen } from './ArScreen';
import type { CameraAdapter, CameraPermission } from '../adapters/camera';
import type { EscapePoint, GameState } from '../domain/types';

/**
 * Faithful to two behaviours read out of ViroARSceneNavigator's own source,
 * because the defect AC16 guards against lives in the gap between them:
 *
 *   1. `initialScene` is stored in the constructor and never re-read, so the
 *      scene component is captured once, at mount.
 *   2. `viroAppProps` is refreshed on every render — Viro's own comment calls
 *      it "the latest given props on every render".
 *
 * A stand-in that simply called `initialScene.scene` again each render would
 * make a frozen closure look fine.
 */
vi.mock('@reactvision/react-viro', () => ({
  ViroMaterials: { createMaterials: () => undefined },
  ViroARSceneNavigator: ({
    initialScene,
    viroAppProps,
  }: {
    initialScene: { scene: (props: { sceneNavigator: unknown }) => ReactNode };
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
  ViroFlexView: ({ children, viroTag }: { children?: ReactNode; viroTag?: string }) =>
    createElement('div', { 'data-testid': viroTag }, children),
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

const PUZZLE_STATE = {
  kind: 'PUZZLE',
  point: POINT,
  puzzle: { text: '5 + 2 = ?', answer: 7 },
  input: '',
} satisfies Extract<GameState, { kind: 'PUZZLE' }>;

function cameraAdapter(permission: CameraPermission) {
  const requests: number[] = [];
  const camera: CameraAdapter = {
    permission,
    request: () => requests.push(1),
  };
  return { camera, requests };
}

describe('ArScreen', () => {
  it('AC1: opening the puzzle starts the camera', () => {
    const { camera } = cameraAdapter('granted');

    render(
      createElement(ArScreen, {
        state: PUZZLE_STATE,
        onEvent: () => undefined,
        audio: { play: () => undefined },
        camera,
      }),
    );

    expect(screen.getAllByTestId('camera-preview')).toHaveLength(1);
  });

  it('AC11: denied camera permission explains itself and shows no keypad', () => {
    const { camera } = cameraAdapter('denied');

    render(
      createElement(ArScreen, {
        state: PUZZLE_STATE,
        onEvent: () => undefined,
        audio: { play: () => undefined },
        camera,
      }),
    );

    expect(screen.getByText('Kamera tarvitaan tehtävän avaamiseen.')).toBeTruthy();
    expect(screen.queryAllByTestId(/^key-/)).toHaveLength(0);
  });

  it('AC16: the panel inside the AR scene sees the current state', () => {
    const { camera } = cameraAdapter('granted');
    const props = (input: string) => ({
      state: { ...PUZZLE_STATE, input },
      onEvent: () => undefined,
      audio: { play: () => undefined },
      camera,
    });

    const view = render(createElement(ArScreen, props('')));
    expect(screen.getByTestId('input-display').textContent).toBe('');

    view.rerender(createElement(ArScreen, props('12')));

    expect(screen.getByTestId('input-display').textContent).toBe('12');
  });

  it('AC11: undetermined permission is requested exactly once', () => {
    const { camera, requests } = cameraAdapter('undetermined');

    render(
      createElement(ArScreen, {
        state: PUZZLE_STATE,
        onEvent: () => undefined,
        audio: { play: () => undefined },
        camera,
      }),
    );

    expect(requests).toHaveLength(1);
  });
});
