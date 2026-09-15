import { createLocalPuzzleSource } from './puzzleSource';
import { scriptedRng } from '../testing/scriptedRng';

describe('createLocalPuzzleSource', () => {
  it('draws a puzzle with no agent and no network', async () => {
    const result = await createLocalPuzzleSource(scriptedRng(0.5, 0.2)).draw('a');

    expect(result).toEqual({ ok: true, puzzle: { text: '5 + 2 = ?', answer: 7 } });
  });

  it('draws again for a second pair', async () => {
    const source = createLocalPuzzleSource(scriptedRng(0.5, 0.2, 0, 0));

    await source.draw('a');

    expect(await source.draw('b')).toEqual({ ok: true, puzzle: { text: '1 + 1 = ?', answer: 2 } });
  });
});
