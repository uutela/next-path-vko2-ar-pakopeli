import { createAgentPuzzleSource } from './agentPuzzleSource';
import type { DrawResult, PuzzleSource } from './puzzleSource';

const AGENT_PUZZLE = { text: 'Liisalla on 12 euroa. Hän ostaa kirjan 7 eurolla. Paljonko jää?', answer: 5 };
const LOCAL_PUZZLE = { text: '5 + 2 = ?', answer: 7 };

/** The local generator, standing in for the one the game already has. */
const fallback: PuzzleSource = {
  draw: async (): Promise<DrawResult> => ({ ok: true, puzzle: LOCAL_PUZZLE }),
};

const respondingWith = (body: unknown, status = 200) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

function reporter() {
  const reasons: string[] = [];
  return { reasons, report: (reason: string) => reasons.push(reason) };
}

describe('createAgentPuzzleSource', () => {
  it('returns the puzzle the agent drew', async () => {
    const source = createAgentPuzzleSource({
      endpoint: 'http://localhost:8002',
      fallback,
      fetchImpl: respondingWith({ ok: true, puzzle: AGENT_PUZZLE, attempts: 1 }),
    });

    await expect(source.draw('a')).resolves.toEqual({ ok: true, puzzle: AGENT_PUZZLE });
  });

  it('asks the agent for the pair that wants a puzzle', async () => {
    const seen: Array<{ url: string; method?: string }> = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      seen.push({ url: String(url), method: init?.method });
      return new Response(JSON.stringify({ ok: true, puzzle: AGENT_PUZZLE }), { status: 200 });
    }) as unknown as typeof fetch;

    await createAgentPuzzleSource({ endpoint: 'http://localhost:8002', fallback, fetchImpl }).draw('b');

    expect(seen).toHaveLength(1);
    expect(seen[0]?.url).toBe('http://localhost:8002/puzzle?pair_id=b');
    expect(seen[0]?.method).toBe('POST');
  });

  it('falls back to the local generator when the agent refuses, and says why', async () => {
    const { reasons, report } = reporter();
    const source = createAgentPuzzleSource({
      endpoint: 'http://localhost:8002',
      fallback,
      fetchImpl: respondingWith({ ok: false, reason: 'gave up after 3 attempts — solve-back: writer said 7, solver said 8' }),
      report,
    });

    await expect(source.draw('a')).resolves.toEqual({ ok: true, puzzle: LOCAL_PUZZLE });
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toContain('solve-back');
  });

  it('falls back when the agent is not running at all', async () => {
    const { reasons, report } = reporter();
    const source = createAgentPuzzleSource({
      endpoint: 'http://localhost:8002',
      fallback,
      fetchImpl: (async () => {
        throw new TypeError('fetch failed');
      }) as unknown as typeof fetch,
      report,
    });

    await expect(source.draw('a')).resolves.toEqual({ ok: true, puzzle: LOCAL_PUZZLE });
    expect(reasons[0]).toContain('fetch failed');
  });

  it('falls back on an HTTP error', async () => {
    const { reasons, report } = reporter();
    const source = createAgentPuzzleSource({
      endpoint: 'http://localhost:8002',
      fallback,
      fetchImpl: respondingWith({ detail: 'boom' }, 500),
      report,
    });

    await expect(source.draw('a')).resolves.toEqual({ ok: true, puzzle: LOCAL_PUZZLE });
    expect(reasons[0]).toContain('500');
  });

  it('falls back when the agent answers with something that is not a puzzle', async () => {
    const source = createAgentPuzzleSource({
      endpoint: 'http://localhost:8002',
      fallback,
      fetchImpl: respondingWith({ ok: true, puzzle: { text: '', answer: 5 } }),
    });

    await expect(source.draw('a')).resolves.toEqual({ ok: true, puzzle: LOCAL_PUZZLE });
  });

  it('refuses an agent answer of more than six digits, and falls back', async () => {
    const { reasons, report } = reporter();
    const source = createAgentPuzzleSource({
      endpoint: 'http://localhost:8002',
      fallback,
      fetchImpl: respondingWith({ ok: true, puzzle: { text: 'Montako?', answer: 1000000 } }),
      report,
    });

    await expect(source.draw('a')).resolves.toEqual({ ok: true, puzzle: LOCAL_PUZZLE });
    expect(reasons[0]).toContain('answer out of range');
  });

  it('gives up on a slow agent rather than leaving the player waiting', async () => {
    const { reasons, report } = reporter();
    const source = createAgentPuzzleSource({
      endpoint: 'http://localhost:8002',
      fallback,
      timeoutMs: 10,
      fetchImpl: ((_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        })) as unknown as typeof fetch,
      report,
    });

    await expect(source.draw('a')).resolves.toEqual({ ok: true, puzzle: LOCAL_PUZZLE });
    expect(reasons).toHaveLength(1);
  });

  it('never returns a refusal of its own: the game always gets a puzzle', async () => {
    const source = createAgentPuzzleSource({
      endpoint: 'http://localhost:8002',
      fallback: { draw: async () => ({ ok: false, reason: 'local generator failed too' }) },
      fetchImpl: respondingWith({ ok: false, reason: 'no Gemini API key' }),
    });

    await expect(source.draw('a')).resolves.toEqual({ ok: false, reason: 'local generator failed too' });
  });
});
