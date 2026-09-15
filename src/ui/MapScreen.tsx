import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Map } from './Map';
import { visiblePoints } from '../domain/pairs';
import type { EscapePoint, GameEvent, GameState } from '../domain/types';

export interface MapScreenProps {
  state: GameState;
  points: EscapePoint[];
  onEvent: (event: GameEvent) => void;
  /** Pressing the offer at a puzzle point asks the source, which is async. */
  onCollect: (pairId: string) => void;
}

/** The map, the offer for whatever point is in range, and the collected puzzles. */
export function MapScreen({ state, points, onEvent, onCollect }: MapScreenProps) {
  const { screen } = state;
  const near = screen.kind === 'NEAR' ? screen.point : undefined;
  const unsolved = state.pairs.filter((pair) => !pair.solved);

  return (
    <View style={styles.container}>
      <Map points={visiblePoints(state, points)} />

      {state.notice === undefined ? null : (
        <Text style={styles.notice} testID="notice">
          {state.notice}
        </Text>
      )}

      {unsolved.map((pair) => (
        <Pressable
          key={pair.pairId}
          style={styles.secondary}
          testID={`show-puzzle-${pair.pairId}`}
          onPress={() => onEvent({ kind: 'SHOW_PUZZLE', pairId: pair.pairId })}
        >
          <Text style={styles.secondaryLabel}>Näytä pulma</Text>
        </Pressable>
      ))}

      {near === undefined ? null : (
        <Pressable
          style={styles.button}
          testID="point-offer"
          onPress={() =>
            near.role === 'puzzle' ? onCollect(near.pairId) : onEvent({ kind: 'OPEN_ANSWER' })
          }
        >
          <Text style={styles.buttonLabel}>
            {near.role === 'puzzle' ? 'Avaa tehtävä' : 'Syötä koodi'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  notice: { fontSize: 16, color: '#b91c1c', padding: 12, textAlign: 'center' },
  button: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#c2410c',
    paddingHorizontal: 24,
  },
  buttonLabel: { fontSize: 20, color: '#ffffff', fontWeight: '600' },
  secondary: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1f2937',
    paddingHorizontal: 24,
  },
  secondaryLabel: { fontSize: 18, color: '#ffffff' },
});
