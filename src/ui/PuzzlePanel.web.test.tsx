import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { KEY_MIN_SIZE, PuzzlePanel } from './PuzzlePanel.web';
import { ANSWER_SCREEN, describePanelBehaviour } from './panelBehaviour';

// No Viro mock here, and that is the point: the web panel is ordinary React
// Native views, rendered through react-native-web.
describePanelBehaviour('PuzzlePanel (web overlay)', PuzzlePanel);

describe('PuzzlePanel (web overlay) sizing', () => {
  it('AC19: every web key is large enough to press', () => {
    expect(KEY_MIN_SIZE).toBeGreaterThanOrEqual(48);

    render(
      createElement(PuzzlePanel, {
        screen: ANSWER_SCREEN,
        puzzle: { text: '5 + 2 = ?', answer: 7 },
        onEvent: () => undefined,
        audio: { play: () => undefined },
      }),
    );

    // Keys only: `key-row-0` and friends share the prefix.
    for (const key of screen.getAllByTestId(/^key-(?!row-)/)) {
      const style = getComputedStyle(key);
      expect(Number.parseFloat(style.minWidth)).toBeGreaterThanOrEqual(48);
      expect(Number.parseFloat(style.minHeight)).toBeGreaterThanOrEqual(48);
    }
  });
});
