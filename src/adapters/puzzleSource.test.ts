import { createLocalPuzzleSource, validating } from './puzzleSource';
import type { Puzzle } from '../domain/types';
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

/** A source that answers whatever a criterion needs it to answer. */
const sourceAnswering = (answer: number) => ({
  draw: async () => ({ ok: true as const, puzzle: { text: 'Koodi?', answer } satisfies Puzzle }),
});

describe('validating — the one-to-six-digit contract', () => {
  it('AC20: the source may answer with one to six digits', async () => {
    await expect(validating(sourceAnswering(999999)).draw('a')).resolves.toEqual({
      ok: true,
      puzzle: { text: 'Koodi?', answer: 999999 },
    });
    await expect(validating(sourceAnswering(0)).draw('a')).resolves.toEqual({
      ok: true,
      puzzle: { text: 'Koodi?', answer: 0 },
    });
  });

  it('AC21: a seven-digit answer never reaches the game', async () => {
    await expect(validating(sourceAnswering(1000000)).draw('a')).resolves.toEqual({
      ok: false,
      reason: 'answer out of range',
    });
  });

  it('AC22: an answer that is not a whole number never reaches the game', async () => {
    for (const answer of [7.5, -1, Number.NaN]) {
      await expect(validating(sourceAnswering(answer)).draw('a')).resolves.toEqual({
        ok: false,
        reason: 'answer out of range',
      });
    }
  });

  it('AC21: a failure the source reports is passed through unchanged', async () => {
    const failing = { draw: async () => ({ ok: false as const, reason: 'agent timed out' }) };

    await expect(validating(failing).draw('a')).resolves.toEqual({
      ok: false,
      reason: 'agent timed out',
    });
  });
});
