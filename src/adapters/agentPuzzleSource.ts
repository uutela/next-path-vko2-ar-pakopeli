import { validating } from './puzzleSource';
import type { DrawResult, PuzzleSource } from './puzzleSource';

export interface AgentPuzzleSourceOptions {
  /** Where the Python agent listens, e.g. `http://localhost:8002`. */
  endpoint: string;
  /** Used whenever the agent cannot be reached or will not answer. */
  fallback: PuzzleSource;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** Where a refusal goes. Local only — a reason is not a puzzle. */
  report?: (reason: string) => void;
}

const DEFAULT_TIMEOUT_MS = 20_000;

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * The puzzle, written by the agent, behind the interface the game already had.
 *
 * Two rules meet here and they look contradictory until you see which is
 * about whom. The **agent** never invents a puzzle: when it cannot produce a
 * good one it refuses with a reason, and `puzzle_core.py` is what decides. The
 * **game** must still open a puzzle at a point a player has walked to, so a
 * refusal falls back to the local arithmetic generator — a different source,
 * honestly labelled, not the agent guessing.
 *
 * Every refusal is reported rather than swallowed. A fallback nobody can see
 * is indistinguishable from an agent that works.
 *
 * The result is passed through `validating`, so an answer of more than six
 * digits is refused here too: the agent is one more source, and the contract
 * at the boundary does not care which source it is talking to.
 */
export function createAgentPuzzleSource({
  endpoint,
  fallback,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  report = () => undefined,
}: AgentPuzzleSourceOptions): PuzzleSource {
  const askTheAgent = async (pairId: string): Promise<DrawResult> => {
    // A hanging agent must not become a game that never opens its puzzle.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(
        `${endpoint}/puzzle?pair_id=${encodeURIComponent(pairId)}`,
        { method: 'POST', signal: controller.signal },
      );
      if (!response.ok) {
        return { ok: false, reason: `agent answered HTTP ${response.status}` };
      }
      const body: unknown = await response.json();
      const drawn = body as { ok?: unknown; puzzle?: unknown; reason?: unknown };

      if (drawn.ok !== true) {
        return { ok: false, reason: typeof drawn.reason === 'string' ? drawn.reason : 'agent refused' };
      }
      const puzzle = drawn.puzzle as { text?: unknown; answer?: unknown } | undefined;
      if (typeof puzzle?.text !== 'string' || puzzle.text.trim() === '') {
        return { ok: false, reason: 'agent answered without a puzzle text' };
      }
      if (typeof puzzle.answer !== 'number') {
        return { ok: false, reason: 'agent answered without a numeric answer' };
      }
      return { ok: true, puzzle: { text: puzzle.text, answer: puzzle.answer } };
    } finally {
      clearTimeout(timer);
    }
  };

  const validated = validating({
    async draw(pairId: string): Promise<DrawResult> {
      try {
        return await askTheAgent(pairId);
      } catch (error) {
        return { ok: false, reason: `agent unreachable: ${describe(error)}` };
      }
    },
  });

  return {
    async draw(pairId: string): Promise<DrawResult> {
      const result = await validated.draw(pairId);
      if (result.ok) {
        return result;
      }
      report(result.reason);
      return fallback.draw(pairId);
    },
  };
}
