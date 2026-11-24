import { describe, expect, it } from 'vitest';
import { Slime } from './slime.js';
import { SafeTrail, touching } from './split.js';
import { TILE } from './constants.js';

function slimeAt(x, y) {
  const slime = new Slime({ x, y });
  slime.falling = null;
  return slime;
}

describe('split', () => {
  it('remembers safe spots and splits into the newest and an older one', () => {
    const trail = new SafeTrail();
    for (let i = 0; i < 6; i++) {
      trail.record(0.5, slimeAt(TILE * (1 + i), TILE * 3), true);
    }
    const [a, b] = trail.splitSpots({ x: 0, y: 0 });
    expect(a.x).toBe(TILE * 6);
    expect(a.x - b.x).toBeGreaterThan(TILE * 2);
  });

  it("doesn't remember spots where something was hurting the slime", () => {
    const trail = new SafeTrail();
    trail.record(0.5, slimeAt(TILE, TILE), false);
    expect(trail.spots).toHaveLength(0);
    const [a, b] = trail.splitSpots({ x: 5, y: 6 });
    expect(a).toEqual({ x: 5, y: 6 });
    expect(b).toEqual({ x: 5, y: 6 });
  });

  it('halves merge when they touch', () => {
    expect(touching(slimeAt(100, 100), slimeAt(120, 100))).toBe(true);
    expect(touching(slimeAt(100, 100), slimeAt(300, 100))).toBe(false);
  });
});
