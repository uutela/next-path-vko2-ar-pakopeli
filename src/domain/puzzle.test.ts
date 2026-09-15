import { appendDigit, checkAnswer, generatePuzzle } from './puzzle';
import { scriptedRng } from '../testing/scriptedRng';
import type { Puzzle } from './types';

const PUZZLE: Puzzle = { left: 5, right: 2, answer: 7 };

describe('generatePuzzle', () => {
  it('AC1: the lowest draw produces 1 + 1', () => {
    expect(generatePuzzle(scriptedRng(0))).toEqual({ left: 1, right: 1, answer: 2 });
  });

  it('AC2: the highest draw produces 9 + 9', () => {
    expect(generatePuzzle(scriptedRng(0.9999999))).toEqual({ left: 9, right: 9, answer: 18 });
  });

  it('AC3: a mid-range draw maps to the documented operands', () => {
    expect(generatePuzzle(scriptedRng(0.5, 0.2))).toEqual({ left: 5, right: 2, answer: 7 });
  });

  it('AC4: the generator draws exactly twice', () => {
    let calls = 0;
    const counting = () => {
      calls += 1;
      return 0.5;
    };

    generatePuzzle(counting);

    expect(calls).toBe(2);
  });

  it('AC5: the answer is always the sum, and operands stay in 1..9', () => {
    for (let i = 0; i < 100; i++) {
      const puzzle = generatePuzzle(scriptedRng(i / 100, (99 - i) / 100));

      expect(puzzle.answer).toBe(puzzle.left + puzzle.right);
      expect(Number.isInteger(puzzle.left)).toBe(true);
      expect(Number.isInteger(puzzle.right)).toBe(true);
      expect(puzzle.left).toBeGreaterThanOrEqual(1);
      expect(puzzle.left).toBeLessThanOrEqual(9);
      expect(puzzle.right).toBeGreaterThanOrEqual(1);
      expect(puzzle.right).toBeLessThanOrEqual(9);
    }
  });
});

describe('checkAnswer', () => {
  it('AC6: the correct answer is accepted', () => {
    expect(checkAnswer(PUZZLE, '7')).toBe(true);
  });

  it('AC7: a wrong answer is rejected', () => {
    expect(checkAnswer(PUZZLE, '8')).toBe(false);
  });

  it('AC8: a leading zero is still the same number', () => {
    expect(checkAnswer(PUZZLE, '07')).toBe(true);
  });

  it('AC9: empty input is rejected, not an error', () => {
    expect(() => checkAnswer(PUZZLE, '')).not.toThrow();
    expect(checkAnswer(PUZZLE, '')).toBe(false);
  });

  it('AC6: surrounding whitespace is ignored', () => {
    expect(checkAnswer(PUZZLE, '7 ')).toBe(true);
  });

  it('AC13: trailing letters are rejected', () => {
    expect(checkAnswer(PUZZLE, '7abc')).toBe(false);
  });

  it('AC13: a decimal point is rejected', () => {
    expect(checkAnswer(PUZZLE, '7.9')).toBe(false);
  });

  it('AC13: a leading sign is rejected', () => {
    expect(checkAnswer(PUZZLE, '+7')).toBe(false);
  });

  it('AC13: exponent notation is rejected', () => {
    expect(checkAnswer(PUZZLE, '7e0')).toBe(false);
  });
});

describe('appendDigit', () => {
  it('AC10: a digit is appended to empty input', () => {
    expect(appendDigit('', '5')).toBe('5');
  });

  it('AC11: a second digit is appended', () => {
    expect(appendDigit('1', '2')).toBe('12');
  });

  it('AC14: a third digit is appended', () => {
    expect(appendDigit('12', '3')).toBe('123');
  });

  it('AC12: the sixth digit reaches the cap without passing it', () => {
    expect(appendDigit('12345', '6')).toBe('123456');
  });

  it('AC12: a seventh digit is ignored', () => {
    expect(appendDigit('123456', '7')).toBe('123456');
  });
});
