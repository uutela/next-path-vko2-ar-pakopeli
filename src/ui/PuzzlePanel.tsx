import { ViroFlexView, ViroMaterials, ViroNode, ViroText } from '@reactvision/react-viro';
import { useEffect, useRef } from 'react';
import { FANFARE } from '../adapters/audio';
import type { AudioPlayer } from '../adapters/audio';
import type { GameEvent, GameState } from '../domain/types';

/**
 * Viro lays out in metres of world space, not React Native points, and only
 * the angle matters to a player: a 0.24 m key at 2.4 m subtends 5.72 degrees,
 * exactly what a 0.06 m key at 0.6 m subtended.
 *
 * The panel was built at that smaller scale first and the device showed why it
 * fails. Viro sizes text in points against world units, and at a 0.06 m key no
 * font size worked — 8 rendered nothing, 12 already overflowed the key and was
 * clipped to fragments, and the title at 14 spilled off the top of the panel.
 * The geometry was too small for the type, so the geometry moved.
 * See specs/features/ar-panel.md AC15.
 */
export const PANEL_DISTANCE_METRES = 2.4;
export const KEY_SIZE = 0.24;

/** The telephone arrangement, as rows rather than as a consequence of
 * wrapping, so the layout is structural and cannot drift with a width. */
const KEY_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['C', '0', 'OK'],
] as const;

export interface PuzzlePanelProps {
  state: Extract<GameState, { kind: 'PUZZLE' } | { kind: 'SOLVED' }>;
  onEvent: (event: GameEvent) => void;
  audio: AudioPlayer;
}

function eventForKey(label: string): GameEvent {
  if (label === 'OK') {
    return { kind: 'SUBMIT' };
  }
  if (label === 'C') {
    return { kind: 'CLEAR' };
  }
  return { kind: 'DIGIT_PRESSED', digit: label };
}

/** The anchored panel: puzzle text, the typed input, and the keypad. */
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
      <ViroNode position={[0, 0, -PANEL_DISTANCE_METRES]}>
        <ViroFlexView viroTag="panel" materials={['puzzlePanel']} style={panel} />
        <ViroText text="Oikein! Laatikko aukesi." position={[0, 0.24, LAYER]} style={title} />
        <ViroFlexView
          viroTag="reset"
          position={[0, -0.2, LAYER]}
          onClick={() => onEvent({ kind: 'RESET' })}
          style={wideKey}
        >
          <ViroText text="Aloita alusta" style={keyLabel} />
        </ViroFlexView>
      </ViroNode>
    );
  }

  return (
    <ViroNode position={[0, 0, -PANEL_DISTANCE_METRES]}>
      <ViroFlexView viroTag="panel" materials={['puzzlePanel']} style={panel} />
      <ViroText
        text={state.puzzle.text}
        position={[0, 0.7, LAYER]}
        style={title}
      />
      <ViroFlexView viroTag="input-display" position={[0, 0.44, LAYER]} style={display}>
        <ViroText text={state.input} style={title} />
      </ViroFlexView>
      {KEY_ROWS.map((row, rowIndex) => (
        <ViroNode
          key={row.join('')}
          viroTag={`key-row-${rowIndex}`}
          position={[0, ROW_Y[rowIndex] ?? 0, LAYER]}
        >
          {row.map((label, columnIndex) => (
            <ViroFlexView
              key={label}
              viroTag={`key-${label}`}
              position={[COLUMN_X[columnIndex] ?? 0, 0, 0]}
              onClick={() => onEvent(eventForKey(label))}
              style={key}
            >
              <ViroText text={label} style={keyLabel} />
            </ViroFlexView>
          ))}
        </ViroNode>
      ))}
    </ViroNode>
  );
}

/**
 * Every size is in metres of world space, and every ViroText carries an
 * explicit width and height. Viro gives an unsized text box roughly a metre
 * on a side, which inside a 0.36 m panel overflowed the column and clipped
 * away the title, the input and eleven of the twelve keys — on the device the
 * panel showed only its background, the input strip and one key.
 *
 * Nothing in jsdom can see this: the tests render Viro through a stand-in that
 * turns every element into a div, so they prove what the component asks Viro
 * to draw and never how Viro draws it.
 */
/**
 * Laid out by hand in metres of world space, not by nested flex.
 *
 * The device showed why: a panel of nested ViroFlexViews drew its background
 * and stacked every label on top of every other in the middle, at roughly
 * three times the intended size. Viro positions nodes in 3D reliably; it did
 * not lay this out. So each row is a ViroNode at a known height and each key
 * sits at a known offset within it, and the background is a sibling quad
 * rather than a container.
 *
 * `fontSize` was read off the photograph rather than guessed again: one glyph
 * covered about 0.11 of a 0.3 m panel at fontSize 18, and a glyph has to fit a
 * 0.06 m key, so it needed to be about three times smaller.
 */

/**
 * Both faces drawn, so walking behind the panel does not make it vanish — a
 * Viro quad is single-sided by default. Unlit, because the scene has no lights
 * and a surface that depends on one would go black indoors.
 * See specs/features/ar-panel.md AC23.
 */
export const PANEL_MATERIAL = {
  diffuseColor: '#faf9f7',
  cullMode: 'None' as const,
  lightingModel: 'Constant' as const,
};

ViroMaterials.createMaterials({ puzzlePanel: PANEL_MATERIAL });

/** Just in front of the background quad, so nothing z-fights with it. */
const LAYER = 0.008;

const COLUMN_X = [-0.28, 0, 0.28];
const ROW_Y = [0.12, -0.16, -0.44, -0.72];

const panel = {
  width: 1.2,
  height: 1.76,
  backgroundColor: '#faf9f7',
};
const title = {
  width: 1.1,
  height: 0.24,
  fontSize: 16,
  color: '#1a1a1a',
  textAlign: 'center' as const,
  textAlignVertical: 'center' as const,
};
const display = {
  width: 0.8,
  height: 0.2,
  backgroundColor: '#ffffff',
  justifyContent: 'center' as const,
  alignItems: 'center' as const,
};
const key = {
  width: KEY_SIZE,
  height: KEY_SIZE,
  backgroundColor: '#e7e5e4',
  justifyContent: 'center' as const,
  alignItems: 'center' as const,
};
const wideKey = { ...key, width: 0.8 };
const keyLabel = {
  width: KEY_SIZE,
  height: KEY_SIZE,
  fontSize: 16,
  color: '#1a1a1a',
  textAlign: 'center' as const,
  textAlignVertical: 'center' as const,
};
