# Feature: Proximity detection

**Status:** Done

## Problem Statement
The game must know when the player is close enough to a point to open the
puzzle. GPS outdoors drifts by 5–20 m, so the rule has to be a plain distance
comparison against a generous radius rather than anything clever. It must
also run with no device attached, because every other feature depends on it
and waiting for a field test to learn it is wrong would cost a day.

## Proposed Change
Two pure functions in `src/domain/distance.ts`:

- `distanceMeters(a: Coordinates, b: Coordinates): number` — great-circle
  distance by the haversine formula, Earth radius 6371000 m
- `isWithinRadius(player: Coordinates, point: EscapePoint): boolean` — true
  when the distance is less than or equal to `point.radiusMeters`

Neither reads the clock, the network or the GPS. The location adapter
supplies coordinates; these functions never call it.

## Acceptance Criteria

### AC1: Identical coordinates are zero metres apart
**Given** `a = { latitude: 60.1699, longitude: 24.9384 }` and `b` with the same values
**When** `distanceMeters(a, b)` is called
**Then** it returns exactly `0`

### AC2: A known 20 m north offset measures 20 m
**Given** `a = { latitude: 60.1699, longitude: 24.9384 }` and `b = { latitude: 60.1700798643, longitude: 24.9384 }`
**When** `distanceMeters(a, b)` is called
**Then** it returns `20.0`, within a tolerance of `0.01` m

### AC3: A thousandth of a degree of latitude at the equator
**Given** `a = { latitude: 0, longitude: 0 }` and `b = { latitude: 0.001, longitude: 0 }`
**When** `distanceMeters(a, b)` is called
**Then** it returns `111.194927`, within a tolerance of `0.001` m

### AC4: Distance is symmetric
**Given** any two coordinates `a` and `b`
**When** `distanceMeters(a, b)` and `distanceMeters(b, a)` are both called
**Then** the two results are equal to within `1e-9`

### AC5: A player inside the radius is within it
**Given** a point at `{ latitude: 60.1699, longitude: 24.9384 }` with `radiusMeters: 20`, and a player at `{ latitude: 60.1700708711, longitude: 24.9384 }` (19 m away)
**When** `isWithinRadius(player, point)` is called
**Then** it returns `true`

### AC6: A player just inside the radius is within it
**Given** the same point and a player at `{ latitude: 60.1700798643, longitude: 24.9384 }`, which measures 19.999997645 m against a 20 m radius
**When** `isWithinRadius(player, point)` is called
**Then** it returns `true`

Behaviour at a distance of *exactly* `radiusMeters` is deliberately left
unspecified: both `<` and `<=` are acceptable. An earlier version of this
criterion claimed the boundary was inclusive, but its coordinate is 2.4
micrometres inside the radius, so the test passed under either comparison and
proved nothing about the boundary. Rather than manufacture a coordinate that
lands exactly on it, the claim was dropped — a difference of micrometres
cannot matter to a GPS reading that drifts by metres.

### AC7: A player outside the radius is not within it
**Given** the same point and a player at `{ latitude: 60.1700888575, longitude: 24.9384 }` (21 m away)
**When** `isWithinRadius(player, point)` is called
**Then** it returns `false`

### AC8: Latitude outside -90..90 is rejected
**Given** `a = { latitude: 91, longitude: 0 }` and `b = { latitude: 0, longitude: 0 }`
**When** `distanceMeters(a, b)` is called
**Then** it throws `RangeError` with the message `latitude must be between -90 and 90`

### AC9: Longitude outside -180..180 is rejected
**Given** `a = { latitude: 0, longitude: 181 }` and `b = { latitude: 0, longitude: 0 }`
**When** `distanceMeters(a, b)` is called
**Then** it throws `RangeError` with the message `longitude must be between -180 and 180`

## Files to Modify
| File | Change |
|---|---|
| `src/domain/types.ts` | New. `Coordinates` and `EscapePoint` interfaces shared by every feature |
| `src/domain/distance.ts` | New. `distanceMeters` and `isWithinRadius`, plus the range validation |
| `src/domain/distance.test.ts` | New. One test per row of the testing strategy |

## Risk
- **What could break:** nothing yet — this is the first module and nothing
  depends on it. The real risk is a wrong formula that only shows up in the
  field, which AC2 and AC3 exist to catch on the desk instead.
- **A 20 m radius may still be too tight** if the phone reports poor accuracy
  under trees or between buildings. The radius is a field of `EscapePoint`,
  not a constant, so widening it is data, not code.
- **Nothing pins the comparison at exactly `radiusMeters`.** This is deliberate
  — see AC6 — and it means a future change between `<` and `<=` would not be
  caught by any test. That is acceptable because no GPS reading is precise
  enough for the distinction to reach a player.
- **Rollback:** delete the two files. No other module imports them yet.

## Testing Strategy (MANDATORY)
| Function | Case | Given | When | Then |
|---|---|---|---|---|
| `distanceMeters` | happy path | identical coordinates | called | returns `0` (AC1) |
| `distanceMeters` | happy path | 20 m north offset at lat 60.1699 | called | returns `20.0` ±0.01 (AC2) |
| `distanceMeters` | happy path | 0.001° latitude at the equator | called | returns `111.194927` ±0.001 (AC3) |
| `distanceMeters` | property | any two coordinates | called both ways | results equal ±1e-9 (AC4) |
| `distanceMeters` | error case | latitude `91` | called | throws `RangeError`, message `latitude must be between -90 and 90` (AC8) |
| `distanceMeters` | error case | latitude `-91` | called | throws `RangeError`, same message (AC8) |
| `distanceMeters` | error case | longitude `181` | called | throws `RangeError`, message `longitude must be between -180 and 180` (AC9) |
| `isWithinRadius` | happy path | 19 m away, radius 20 | called | returns `true` (AC5) |
| `isWithinRadius` | boundary | 19.999997645 m away, radius 20 | called | returns `true` (AC6) |
| `isWithinRadius` | boundary | 21 m away, radius 20 | called | returns `false` (AC7) |
| `isWithinRadius` | boundary | 0 m away, radius 20 | called | returns `true` |

## Spec Readiness checklist
- [x] Every AC has a precise expected value — no "works correctly"
- [x] Another person could write a test from each AC without asking
- [x] Every AC can fail — one that cannot fail proves nothing
- [x] Error and edge cases have ACs of their own
- [x] Every AC appears in the testing strategy table
