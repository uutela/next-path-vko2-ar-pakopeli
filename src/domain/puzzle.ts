import type { Puzzle } from './types';

const MIN_OPERAND = 1;
const MAX_OPERAND = 9;
/**
 * An answer is a code of at most six digits — a maximum, not a length, so a
 * shorter answer is a valid answer and nothing is zero-padded. The puzzle
 * source refuses anything longer before the game sees it.
 * See specs/features/puzzle.md AC12 and specs/features/pair-flow.md AC21.
 */
const MAX_INPUT_LENGTH = 6;
const DIGITS_ONLY = /^\d+$/;

function drawOperand(rng: () => number): number {
  const span = MAX_OPERAND - MIN_OPERAND + 1;
  return Math.floor(rng() * span) + MIN_OPERAND;
}

/**
 * Draws one addition task. Randomness is injected so the function stays pure
 * and every criterion can state an exact expected value.
 *
 * The result is a question and a code, not a sum: an agent supplies the same
 * record later and has no operands to put in it.
 * See specs/features/puzzle.md.
 */
export function generatePuzzle(rng: () => number): Puzzle {
  const left = drawOperand(rng);
  const right = drawOperand(rng);

  return { text: `${left} + ${right} = ?`, answer: left + right };
}

/**
 * Whether the typed input is the puzzle's answer. The input must be all
 * digits once trimmed: `parseInt` alone would read `"7abc"` and `"7.9"` as 7.
 */
export function checkAnswer(puzzle: Puzzle, input: string): boolean {
  const trimmed = input.trim();
  if (!DIGITS_ONLY.test(trimmed)) {
    return false;
  }
  return Number.parseInt(trimmed, 10) === puzzle.answer;
}

/** Appends one digit to the typed input, refusing to grow past six. */
export function appendDigit(input: string, digit: string): string {
  if (input.length >= MAX_INPUT_LENGTH) {
    return input;
  }
  return input + digit;
}
