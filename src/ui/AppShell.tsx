import { useCallback, useEffect, useRef, useState } from 'react';
import { ArScreen } from './ArScreen';
import { MapScreen } from './MapScreen';
import { PuzzleScreen } from './PuzzleScreen';
import { transition } from '../domain/gameState';
import { progressFor } from '../domain/pairs';
import { mergePoints, withCompletePairs } from '../domain/points';
import type { LocationSource } from '../adapters/location';
import type { AudioPlayer } from '../adapters/audio';
import type { CameraAdapter } from '../adapters/camera';
import type { PointStore } from '../adapters/pointStore';
import type { PuzzleSource } from '../adapters/puzzleSource';
import type { Coordinates, EscapePoint, GameEvent, GameState } from '../domain/types';

export interface AppShellProps {
  seed: EscapePoint[];
  pointStore: PointStore;
  location: LocationSource;
  audio: AudioPlayer;
  camera: CameraAdapter;
  puzzleSource: PuzzleSource;
}

const INITIAL: GameState = { screen: { kind: 'MAP' }, pairs: [] };

/**
 * The composition. Holds one GameState, changes it only through `transition`,
 * and picks the screen the state implies. Every source is injected, so this
 * renders in a test with no device.
 *
 * Drawing a puzzle happens here rather than in `transition`: the source is
 * asynchronous, a pure function cannot await, and the result arrives back as
 * an event. See specs/features/pair-flow.md.
 */
export function AppShell({
  seed,
  pointStore,
  location,
  audio,
  camera,
  puzzleSource,
}: AppShellProps) {
  const [state, setState] = useState<GameState>(INITIAL);
  const [points, setPoints] = useState<EscapePoint[]>(seed);
  // Kept here rather than in GameState: where the player is does not change
  // what the game allows, only where the map opens. It never leaves the
  // device. See specs/features/map-view.md AC12.
  const [player, setPlayer] = useState<Coordinates>();

  // The point list arrives asynchronously, so it is read through a ref rather
  // than captured by the dispatch closure. `transition` keeps taking its
  // context as an argument and stays pure.
  const pointsRef = useRef(points);
  pointsRef.current = points;
  const stateRef = useRef(state);
  stateRef.current = state;

  const playerRef = useRef<Coordinates>(undefined);
  playerRef.current = player;

  const dispatch = useCallback((event: GameEvent) => {
    const ctx = { points: pointsRef.current };
    setState((previous) => transition(previous, event, ctx));

    // Returning to the map re-asks where the player is standing. Proximity is
    // only ever recomputed from a LOCATION_CHANGED, and a device that is not
    // moving sends no more of them — so without this, someone who collected a
    // puzzle and closed it stood on the answer point and was offered nothing.
    // See specs/features/pair-flow.md AC29.
    const backToMap = event.kind === 'CLOSE_PUZZLE' || event.kind === 'RESET';
    const coordinates = playerRef.current;
    if (backToMap && coordinates) {
      setState((previous) => transition(previous, { kind: 'LOCATION_CHANGED', coordinates }, ctx));
    }
  }, []);

  const collect = useCallback(
    (pairId: string) => {
      // A pair already collected is shown, never drawn again — the same rule
      // `transition` enforces, applied here so the source is not asked at all.
      const known = progressFor(stateRef.current, pairId);
      if (known !== undefined) {
        dispatch({ kind: 'SHOW_PUZZLE', pairId });
        return;
      }
      void puzzleSource
        .draw(pairId)
        .then((result) => {
          dispatch(
            result.ok
              ? { kind: 'PUZZLE_DRAWN', pairId, puzzle: result.puzzle }
              : { kind: 'PUZZLE_FAILED' },
          );
        })
        .catch(() => dispatch({ kind: 'PUZZLE_FAILED' }));
    },
    [puzzleSource, dispatch],
  );

  useEffect(() => {
    let cancelled = false;
    void pointStore.loadStoredPoints().then((stored) => {
      if (!cancelled) {
        setPoints(withCompletePairs(mergePoints(seed, stored)));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pointStore, seed]);

  useEffect(
    () =>
      location.watch((coordinates) => {
        setPlayer(coordinates);
        dispatch({ kind: 'LOCATION_CHANGED', coordinates });
      }),
    [location, dispatch],
  );

  const { screen } = state;

  if (screen.kind === 'PUZZLE') {
    const progress = progressFor(state, screen.pairId);
    const source = points.find((p) => p.pairId === screen.pairId && p.role === 'puzzle');
    return progress === undefined ? null : (
      <PuzzleScreen
        puzzle={progress.puzzle}
        pointName={source?.name ?? ''}
        onEvent={dispatch}
      />
    );
  }

  if (screen.kind === 'ANSWER' || screen.kind === 'SOLVED') {
    const progress = progressFor(state, screen.pairId);
    return progress === undefined ? null : (
      <ArScreen
        screen={screen}
        puzzle={progress.puzzle}
        onEvent={dispatch}
        audio={audio}
        camera={camera}
      />
    );
  }

  return (
    <MapScreen
      state={state}
      points={points}
      onEvent={dispatch}
      onCollect={collect}
      player={player}
    />
  );
}
