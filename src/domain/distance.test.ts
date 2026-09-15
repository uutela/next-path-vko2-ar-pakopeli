import { distanceMeters, isWithinRadius } from './distance';
import type { EscapePoint } from './types';

const REFERENCE = { latitude: 60.1699, longitude: 24.9384 };
/** 19 m, 20 m and 21 m due north of REFERENCE — see specs/features/proximity.md. */
const NORTH_19_M = { latitude: 60.1700708711, longitude: 24.9384 };
const NORTH_20_M = { latitude: 60.1700798643, longitude: 24.9384 };
const NORTH_21_M = { latitude: 60.1700888575, longitude: 24.9384 };

const POINT: EscapePoint = {
  id: 'p1',
  name: 'Testipiste',
  coordinates: REFERENCE,
  radiusMeters: 20,
  role: 'puzzle',
  pairId: 'a',
};

describe('distanceMeters', () => {
  it('AC1: identical coordinates are zero metres apart', () => {
    expect(distanceMeters(REFERENCE, { ...REFERENCE })).toBe(0);
  });

  it('AC2: a known 20 m north offset measures 20 m', () => {
    expect(Math.abs(distanceMeters(REFERENCE, NORTH_20_M) - 20.0)).toBeLessThanOrEqual(0.01);
  });

  it('AC3: a thousandth of a degree of latitude at the equator measures 111.194927 m', () => {
    const a = { latitude: 0, longitude: 0 };
    const b = { latitude: 0.001, longitude: 0 };

    expect(Math.abs(distanceMeters(a, b) - 111.194927)).toBeLessThanOrEqual(0.001);
  });

  it('AC4: distance is symmetric', () => {
    const forward = distanceMeters(REFERENCE, NORTH_21_M);
    const backward = distanceMeters(NORTH_21_M, REFERENCE);

    expect(Math.abs(forward - backward)).toBeLessThanOrEqual(1e-9);
  });

  it('AC8: latitude above 90 is rejected', () => {
    expect(() => distanceMeters({ latitude: 91, longitude: 0 }, { latitude: 0, longitude: 0 }))
      .toThrow(new RangeError('latitude must be between -90 and 90'));
  });

  it('AC8: latitude below -90 is rejected', () => {
    expect(() => distanceMeters({ latitude: -91, longitude: 0 }, { latitude: 0, longitude: 0 }))
      .toThrow(new RangeError('latitude must be between -90 and 90'));
  });

  it('AC9: longitude above 180 is rejected', () => {
    expect(() => distanceMeters({ latitude: 0, longitude: 181 }, { latitude: 0, longitude: 0 }))
      .toThrow(new RangeError('longitude must be between -180 and 180'));
  });
});

describe('isWithinRadius', () => {
  it('AC5: a player inside the radius is within it', () => {
    expect(isWithinRadius(NORTH_19_M, POINT)).toBe(true);
  });

  it('AC6: a player just inside the radius is within it', () => {
    // 19.999997645 m against a 20 m radius. Behaviour at exactly radiusMeters
    // is unspecified on purpose — see specs/features/proximity.md.
    expect(isWithinRadius(NORTH_20_M, POINT)).toBe(true);
  });

  it('AC7: a player outside the radius is not within it', () => {
    expect(isWithinRadius(NORTH_21_M, POINT)).toBe(false);
  });

  it('AC5: a player standing on the point is within it', () => {
    expect(isWithinRadius(REFERENCE, POINT)).toBe(true);
  });
});
