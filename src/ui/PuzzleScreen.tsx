import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { GameEvent, Puzzle } from '../domain/types';

export interface PuzzleScreenProps {
  puzzle: Puzzle;
  pointName: string;
  onEvent: (event: GameEvent) => void;
}

/**
 * The puzzle as ordinary text, on every platform.
 *
 * No Viro, no camera, no anchored panel: the puzzle is read here and answered
 * somewhere else, so this screen exists to be read while walking. The AR panel
 * serves the answer point alone.
 * See specs/features/pair-flow.md and specs/features/looppi prio 12.
 */
export function PuzzleScreen({ puzzle, pointName, onEvent }: PuzzleScreenProps) {
  return (
    <View style={styles.screen}>
      <Text style={styles.source} testID="puzzle-source">
        {pointName}
      </Text>
      <Text style={styles.text} testID="puzzle-text">
        {puzzle.text}
      </Text>
      <Text style={styles.hint}>Vastaus syötetään vastauspisteellä.</Text>
      <Pressable style={styles.button} onPress={() => onEvent({ kind: 'CLOSE_PUZZLE' })}>
        <Text style={styles.buttonLabel}>Takaisin kartalle</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  source: { fontSize: 16, color: '#6b7280' },
  text: { fontSize: 32, color: '#111827', fontWeight: '600', textAlign: 'center' },
  hint: { fontSize: 16, color: '#6b7280', textAlign: 'center' },
  button: {
    minHeight: 56,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#c2410c',
    paddingHorizontal: 24,
  },
  buttonLabel: { fontSize: 20, color: '#ffffff', fontWeight: '600' },
});
