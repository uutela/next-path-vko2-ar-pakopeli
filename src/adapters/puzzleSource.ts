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

/** The puzzle drawn on the device, from injected randomness. */
export function createLocalPuzzleSource(rng: () => number): PuzzleSource {
  return {
    async draw(): Promise<DrawResult> {
      return { ok: true, puzzle: generatePuzzle(rng) };
    },
  };
}
