import { isEscapePoint } from '../domain/points';
import type { EscapePoint } from '../domain/types';

const STORAGE_KEY = 'ar-pakopeli.points';

/** The subset of AsyncStorage this adapter needs. */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface PointStore {
  loadStoredPoints(): Promise<EscapePoint[]>;
  saveStoredPoints(points: EscapePoint[]): Promise<void>;
}

/**
 * The only module that touches device storage. Writes exactly the six fields
 * of an EscapePoint and nothing else, which is what keeps solved progress out
 * of storage by construction rather than by discipline.
 *
 * The list is explicit, so adding a field to EscapePoint without adding it
 * here silently drops it: `role` and `pairId` were saved as nothing and the
 * point failed validation on the next load, which in the field would look like
 * a point that simply vanished.
 * See specs/features/points-store.md.
 */
export function createPointStore(storage: KeyValueStore): PointStore {
  return {
    async loadStoredPoints(): Promise<EscapePoint[]> {
      const raw = await storage.getItem(STORAGE_KEY);
      if (raw === null) {
        return [];
      }
      try {
        const parsed: unknown = JSON.parse(raw);
        // Shape-checked one by one rather than cast: an array of the wrong
        // things used to reach the game and crash it. See AC13.
        return Array.isArray(parsed) ? parsed.filter(isEscapePoint) : [];
      } catch {
        // A corrupt store falls back to the seed rather than crashing the app.
        return [];
      }
    },

    async saveStoredPoints(points: EscapePoint[]): Promise<void> {
      const stripped = points.map(({ id, name, coordinates, radiusMeters, role, pairId }) => ({
        id,
        name,
        coordinates,
        radiusMeters,
        role,
        pairId,
      }));
      await storage.setItem(STORAGE_KEY, JSON.stringify(stripped));
    },
  };
}
