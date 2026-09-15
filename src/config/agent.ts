/**
 * Where the puzzle agent listens.
 *
 * The agent is a Python process started beside the app:
 *   python3 agents/puzzle-agent/api/main.py
 *
 * `localhost` is right for the web build and for a simulator. On a physical
 * phone it is the phone itself, so a device run needs this pointed at the
 * development machine's address on the same network. The game works either
 * way — an unreachable agent falls back to the local generator and says so.
 */
export const PUZZLE_AGENT_ENDPOINT = 'http://localhost:8002';

/** Long enough for two model calls, short enough not to strand a player. */
export const PUZZLE_AGENT_TIMEOUT_MS = 25_000;
