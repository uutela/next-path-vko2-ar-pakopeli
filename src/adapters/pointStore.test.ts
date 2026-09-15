import { createPointStore } from './pointStore';
import type { KeyValueStore } from './pointStore';
import type { EscapePoint } from '../domain/types';

const SEED_A: EscapePoint = {
  id: 'p1',
  name: 'Puisto',
  coordinates: { latitude: 60.1699, longitude: 24.9384 },
  radiusMeters: 20,
  role: 'puzzle',
  pairId: 'a',
};

/** In-memory stand-in for AsyncStorage, with the raw payload readable. */
function fakeStorage(initial: Record<string, string> = {}) {
  const data: Record<string, string> = { ...initial };

  const storage: KeyValueStore = {
    getItem: (key) => Promise.resolve(data[key] ?? null),
    setItem: (key, value) => {
      data[key] = value;
      return Promise.resolve();
    },
  };

  return { storage, written: () => Object.values(data).join('') };
}

describe('pointStore', () => {
  it('AC7: a saved point is returned by the next load', async () => {
    const { storage } = fakeStorage();
    const store = createPointStore(storage);

    await store.saveStoredPoints([SEED_A]);

    await expect(store.loadStoredPoints()).resolves.toEqual([SEED_A]);
  });

  it('AC8: an empty store loads as an empty list, not an error', async () => {
    const store = createPointStore(fakeStorage().storage);

    await expect(store.loadStoredPoints()).resolves.toEqual([]);
  });

  it('AC9: unreadable stored data loads as an empty list', async () => {
    const { storage } = fakeStorage({ 'ar-pakopeli.points': 'not json' });
    const store = createPointStore(storage);

    await expect(store.loadStoredPoints()).resolves.toEqual([]);
  });

  it('AC7: two saved points keep their ids', async () => {
    const { storage } = fakeStorage();
    const store = createPointStore(storage);
    const second: EscapePoint = { ...SEED_A, id: 'p2', name: 'Kentta' };

    await store.saveStoredPoints([SEED_A, second]);

    const loaded = await store.loadStoredPoints();
    expect(loaded.map((p) => p.id)).toEqual(['p1', 'p2']);
  });

  it('AC13: stored entries that are not points never reach the game', async () => {
    const { storage } = fakeStorage({
      'ar-pakopeli.points': JSON.stringify([SEED_A, { id: 'p2', foo: 1 }]),
    });
    const store = createPointStore(storage);

    await expect(store.loadStoredPoints()).resolves.toEqual([SEED_A]);
  });

  it('AC10: solved progress is never written to the store', async () => {
    const { storage, written } = fakeStorage();
    const store = createPointStore(storage);
    const solvedLooking = { ...SEED_A, solved: true } as EscapePoint;

    await store.saveStoredPoints([solvedLooking]);

    expect(written()).not.toContain('solved');
  });
});
