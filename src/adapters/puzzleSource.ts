import { generatePuzzle } from '../domain/puzzle';
import type { Puzzle } from '../domain/types';

/**
 * A drawn puzzle, or why there is none. A result rather than a thrown error:
 * the caller has to show the player something in Finnish either way.
 */
export type DrawResult = { ok: true; puzzle: Puzzle } | { ok: false; reason: string };

/**
 * Where a puzzle comes from.
 *
 * Asynchronous from the first line. The local implementation below needs no
 * await, but the later one asks an agent over a network, and a synchronous
 * interface would have to be broken to admit it.
 * See specs/features/pair-flow.md.
 */
export interface PuzzleSource {
  draw(pairId: string): Promise<DrawResult>;
}

/** The largest code the keypad can hold: six digits, and six is a maximum. */
const MAX_ANSWER = 999999;

/**
 * The one place the one-to-six-digit rule is enforced.
 *
 * A shorter answer is a valid answer — nothing is padded — but a longer one
 * would be unanswerable, because `appendDigit` stops at six and the player
 * could never type the seventh. The keypad and the source agree here by
 * construction rather than by luck, which matters because the later source is
 * an agent that has never read this file.
 * See specs/features/pair-flow.md AC20 to AC22.
 */
export function validating(source: PuzzleSource): PuzzleSource {
  return {
    async draw(pairId: string): Promise<DrawResult> {
      const result = await source.draw(pairId);
      if (!result.ok) {
        return result;
      }
      const { answer } = result.puzzle;
      const usable = Number.isInteger(answer) && answer >= 0 && answer <= MAX_ANSWER;

      return usable ? result : { ok: false, reason: 'answer out of range' };
    },
  };
}

/** The puzzle drawn on the device, from injected randomness. */
export function createLocalPuzzleSource(rng: () => number): PuzzleSource {
  // Validated like any other source. This one cannot break the contract
  // today; the point is that nothing downstream has to know which source it
  // is talking to.
  return validating({
    async draw(): Promise<DrawResult> {
      return { ok: true, puzzle: generatePuzzle(rng) };
    },
  });
}
