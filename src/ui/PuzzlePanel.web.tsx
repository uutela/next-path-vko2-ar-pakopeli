import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FANFARE } from '../adapters/audio';
import type { PuzzlePanelProps } from './PuzzlePanel';
import type { GameEvent } from '../domain/types';

/**
 * The same panel as PuzzlePanel.tsx, drawn as ordinary React Native views over
 * a camera preview instead of as a Viro object anchored in the world. It holds
 * no rules — those live in domain/ — so the only difference is what draws.
 * See specs/features/ar-panel.md AC18.
 */

/** Points, not metres: this panel is laid out by React Native. See AC19. */
export const KEY_MIN_SIZE = 48;

/** The telephone arrangement, as rows rather than as a consequence of
 * wrapping, so the layout is structural and cannot drift with a width. */
const KEY_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['C', '0', 'OK'],
] as const;

function eventForKey(label: string): GameEvent {
  if (label === 'OK') {
    return { kind: 'SUBMIT' };
  }
  if (label === 'C') {
    return { kind: 'CLEAR' };
  }
  return { kind: 'DIGIT_PRESSED', digit: label };
}

export function PuzzlePanel({ state, onEvent, audio }: PuzzlePanelProps) {
  const fanfarePlayed = useRef(false);

  useEffect(() => {
    if (state.kind === 'SOLVED' && !fanfarePlayed.current) {
      fanfarePlayed.current = true;
      audio.play(FANFARE);
    }
  }, [state.kind, audio]);

  if (state.kind === 'SOLVED') {
    return (
      <View style={styles.panel} testID="panel">
        <Text style={styles.title}>Oikein! Laatikko aukesi.</Text>
        <Pressable style={styles.wideKey} testID="reset" onPress={() => onEvent({ kind: 'RESET' })}>
          <Text style={styles.keyLabel}>Aloita alusta</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.panel} testID="panel">
      <Text style={styles.title}>{state.puzzle.text}</Text>
      <View style={styles.display} testID="input-display">
        <Text style={styles.title}>{state.input}</Text>
      </View>
      <View style={styles.keypad}>
        {KEY_ROWS.map((row, index) => (
          <View key={row.join('')} style={styles.keyRow} testID={`key-row-${index}`}>
            {row.map((label) => (
              <Pressable
                key={label}
                testID={`key-${label}`}
                style={styles.key}
                onPress={() => onEvent(eventForKey(label))}
              >
                <Text style={styles.keyLabel}>{label}</Text>
              </Pressable>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: 'rgba(250,249,247,0.94)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 12,
  },
  title: { fontSize: 32, fontWeight: '600', color: '#1a1a1a' },
  display: {
    minHeight: 48,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
  },
  keypad: { gap: 8 },
  keyRow: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  key: {
    minWidth: KEY_MIN_SIZE,
    minHeight: KEY_MIN_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e7e5e4',
    borderRadius: 8,
  },
  wideKey: {
    minWidth: 160,
    minHeight: KEY_MIN_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e7e5e4',
    borderRadius: 8,
  },
  keyLabel: { fontSize: 20, color: '#1a1a1a' },
});
