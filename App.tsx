import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer } from 'expo-audio';
import { useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useMemo } from 'react';
import { AppShell } from './src/ui/AppShell';
import { createPointStore } from './src/adapters/pointStore';
import { createAgentPuzzleSource } from './src/adapters/agentPuzzleSource';
import { createLocalPuzzleSource } from './src/adapters/puzzleSource';
import { PUZZLE_AGENT_ENDPOINT, PUZZLE_AGENT_TIMEOUT_MS } from './src/config/agent';
import seedPoints from './src/data/points.json';
import localPoints from './src/data/points.local.json';
import { composeSeed } from './src/domain/points';
import type { AudioPlayer } from './src/adapters/audio';
import type { CameraAdapter } from './src/adapters/camera';
import { createLocationSource } from './src/adapters/location';
import type { PositionProvider } from './src/adapters/location';
import type { EscapePoint } from './src/domain/types';

/**
 * The one file no acceptance criterion covers: it builds the real adapters,
 * none of which run under jsdom. Kept thin for that reason — if the tests are
 * green and the app misbehaves, suspect this file first.
 * See specs/features/app-shell.md.
 */

/**
 * The committed seed, overridden by a local file that is never committed.
 * A point is a place someone stands, and AGENTS.md says the player's location
 * never leaves the device — so points.local.json is gitignored and created
 * empty by postinstall. Merging is the same rule the store already uses: a
 * matching id replaces, any other id adds. See specs/features/points-store.md.
 */
const SEED = composeSeed(seedPoints, localPoints);

/**
 * Real GPS, as a provider. The rule that matters — deliver the position we
 * already have, then deliver changes — lives in createLocationSource, where it
 * is tested. This only fetches. The mock source is for development.
 */
function createExpoPositionProvider(): PositionProvider {
  const granted = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  };

  return {
    async getCurrent() {
      if (!(await granted())) {
        throw new Error('location permission was not granted');
      }
      const { coords } = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      return { latitude: coords.latitude, longitude: coords.longitude };
    },

    async watch(onChange) {
      if (!(await granted())) {
        return () => undefined;
      }
      const subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 1 },
        ({ coords }) => onChange({ latitude: coords.latitude, longitude: coords.longitude }),
      );
      return () => subscription.remove();
    },
  };
}

// One sound, created once. The adapter ignores the asset argument because
// there is nothing else to play.
const fanfarePlayer = createAudioPlayer(require('./assets/fanfare.wav'));

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();

  const location = useMemo(() => createLocationSource(createExpoPositionProvider()), []);
  const pointStore = useMemo(() => createPointStore(AsyncStorage), []);
  // The agent writes the puzzles; the arithmetic generator is what the game
  // falls back to when the agent refuses or is not running. A refusal is
  // reported rather than swallowed — a fallback nobody can see is
  // indistinguishable from an agent that works.
  const puzzleSource = useMemo(
    () =>
      createAgentPuzzleSource({
        endpoint: PUZZLE_AGENT_ENDPOINT,
        fallback: createLocalPuzzleSource(Math.random),
        timeoutMs: PUZZLE_AGENT_TIMEOUT_MS,
        report: (reason) => console.warn('[puzzle-agent]', reason),
      }),
    [],
  );
  const audio = useMemo<AudioPlayer>(() => ({ play: () => fanfarePlayer.play() }), []);

  const camera = useMemo<CameraAdapter>(
    () => ({
      permission: permission?.status ?? 'undetermined',
      request: () => {
        void requestPermission();
      },
    }),
    [permission, requestPermission],
  );

  return (
    <AppShell
      seed={SEED}
      pointStore={pointStore}
      location={location}
      audio={audio}
      camera={camera}
      puzzleSource={puzzleSource}
    />
  );
}
