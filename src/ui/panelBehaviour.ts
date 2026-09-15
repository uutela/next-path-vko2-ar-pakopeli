import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import type { ComponentType } from 'react';
import { FANFARE } from '../adapters/audio';
import type { AudioPlayer } from '../adapters/audio';
import type { PuzzlePanelProps } from './PuzzlePanel';
import type { GameEvent, Puzzle, Screen } from '../domain/types';

/**
 * AC2 to AC14 of specs/features/ar-panel.md, written once and run against
 * both panel implementations. The anchored panel and the web overlay are two
 * renderings of one behaviour; anything that differs between them is a
 * drawing primitive, never a rule. See AC18.
 */

export const DRAWN: Puzzle = { text: '5 + 2 = ?', answer: 7 };

export const ANSWER_SCREEN = {
  kind: 'ANSWER',
  pairId: 'a',
  input: '',
} satisfies Extract<Screen, { kind: 'ANSWER' }>;

export const SOLVED_SCREEN = { kind: 'SOLVED', pairId: 'a' } satisfies Extract<
  Screen,
  { kind: 'SOLVED' }
>;

export function describePanelBehaviour(name: string, Panel: ComponentType<PuzzlePanelProps>) {
  const mount = (screenProp: PuzzlePanelProps['screen'] = ANSWER_SCREEN) => {
    const events: GameEvent[] = [];
    const played: string[] = [];
    const audio: AudioPlayer = { play: (asset) => played.push(asset) };
    const view = render(
      createElement(Panel, {
        screen: screenProp,
        puzzle: DRAWN,
        onEvent: (e: GameEvent) => events.push(e),
        audio,
      }),
    );
    return { events, played, view };
  };
  const pressKey = (label: string) => screen.getByTestId(`key-${label}`).click();
  /** Keys only: `key-row-0` and friends start with the same prefix. */
  const KEY_ONLY = /^key-(?!row-)/;

  describe(name, () => {
    it('AC2: the panel states the sum in the documented format', () => {
      mount();
      expect(screen.getByText('5 + 2 = ?')).toBeTruthy();
    });

    it('AC3: the keypad has twelve keys', () => {
      mount();
      const labels = screen.getAllByTestId(KEY_ONLY).map((n) => n.textContent);
      expect(labels).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'OK']);
    });

    it('AC22: the keypad is laid out as a telephone keypad', () => {
      mount();
      const rows = screen.getAllByTestId(/^key-row-/);

      expect(rows).toHaveLength(4);
      expect(rows.map((row) => row.textContent)).toEqual(['123', '456', '789', 'C0OK']);
    });

    it('AC4: a pressed digit is dispatched', () => {
      const { events } = mount();
      pressKey('7');
      expect(events).toEqual([{ kind: 'DIGIT_PRESSED', digit: '7' }]);
    });

    it('AC4: the input display shows the current input', () => {
      mount({ ...ANSWER_SCREEN, input: '12' });
      expect(screen.getByTestId('input-display').textContent).toBe('12');
    });

    it('AC5: the input display is empty when the input is empty', () => {
      mount();
      expect(screen.getByTestId('input-display').textContent).toBe('');
    });

    it('AC6: pressing OK submits', () => {
      const { events } = mount({ ...ANSWER_SCREEN, input: '7' });
      pressKey('OK');
      expect(events).toEqual([{ kind: 'SUBMIT' }]);
    });

    it('AC7: solving replaces the panel text with the congratulation', () => {
      mount(SOLVED_SCREEN);
      expect(screen.getByText('Oikein! Laatikko aukesi.')).toBeTruthy();
      expect(screen.queryByText('5 + 2 = ?')).toBeNull();
    });

    it('AC8: the fanfare plays once on solving', () => {
      const played: string[] = [];
      const audio: AudioPlayer = { play: (asset) => played.push(asset) };
      const view = render(
        createElement(Panel, { screen: ANSWER_SCREEN, puzzle: DRAWN, onEvent: () => undefined, audio }),
      );
      expect(played).toEqual([]);

      view.rerender(
        createElement(Panel, { screen: SOLVED_SCREEN, puzzle: DRAWN, onEvent: () => undefined, audio }),
      );

      expect(played).toEqual([FANFARE]);
    });

    it('AC9: the fanfare does not replay on re-render', () => {
      const played: string[] = [];
      // A fresh adapter object per render, which is what an inline prop gives
      // in real code. Re-rendering with the same object proves nothing: React
      // skips an effect whose dependencies have not changed.
      const panel = () =>
        createElement(Panel, {
          screen: SOLVED_SCREEN,
          puzzle: DRAWN,
          onEvent: () => undefined,
          audio: { play: (asset: string) => played.push(asset) } satisfies AudioPlayer,
        });

      const view = render(panel());
      view.rerender(panel());
      view.rerender(panel());

      expect(played).toEqual([FANFARE]);
    });

    it('AC10: a wrong answer keeps the puzzle on screen', () => {
      mount({ ...ANSWER_SCREEN, input: '' });
      expect(screen.getByText('5 + 2 = ?')).toBeTruthy();
      expect(screen.getByTestId('input-display').textContent).toBe('');
      expect(screen.queryByText('Oikein! Laatikko aukesi.')).toBeNull();
    });

    it('AC12: the reset control returns to the map', () => {
      const { events } = mount(SOLVED_SCREEN);
      screen.getByText('Aloita alusta').click();
      expect(events).toEqual([{ kind: 'RESET' }]);
    });

    it('AC13: the clear key empties a mistyped input', () => {
      const { events } = mount({ ...ANSWER_SCREEN, input: '12' });
      pressKey('C');
      expect(events).toEqual([{ kind: 'CLEAR' }]);
    });

    it('AC14: the clear key on empty input is harmless', () => {
      const { events } = mount();
      expect(() => pressKey('C')).not.toThrow();
      expect(events).toEqual([{ kind: 'CLEAR' }]);
    });
  });
}
