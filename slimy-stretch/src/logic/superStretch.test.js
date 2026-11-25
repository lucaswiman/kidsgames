import { describe, expect, it } from 'vitest';
import { parseLevel } from './level.js';
import { Slime } from './slime.js';
import { END_RADIUS, MAX_STRETCH, TILE } from './constants.js';
import { SUPER_COOLDOWN, SUPER_RANGE, SuperStretch, superStretchTarget } from './superStretch.js';

const level = parseLevel({
  id: 'super',
  map: [
    '##############################',
    '#............................#',
    '#............................#',
    '#.............#..............#',
    '#.............#.........IIII.#',
    '#.............#..............#',
    '#............................#',
    '#S..........................E#',
    '##########hhhh################',
  ],
});

const FLOOR = 8 * TILE - END_RADIUS - 1;

function slimeAt(x, y) {
  const slime = new Slime({ x, y });
  slime.falling = null;
  return slime;
}

function run(sup, slime, seconds) {
  for (let t = 0; t < seconds; t += 1 / 60) {
    slime.update(1 / 60, level);
    sup.update(1 / 60, level, slime);
  }
}

describe('Super Stretch', () => {
  it('finds a far-away wall the slime can see in a straight line', () => {
    const from = { x: 2 * TILE, y: FLOOR };
    // The ceiling, way farther than a normal stretch.
    const spot = superStretchTarget(level, from, { x: 6 * TILE, y: 0.5 * TILE });
    expect(spot).toBeTruthy();
    expect(Math.hypot(spot.x - from.x, spot.y - from.y)).toBeGreaterThan(MAX_STRETCH * 1.5);
    expect(spot.y).toBeCloseTo(TILE + END_RADIUS, -1);
  });

  it("won't go through walls, onto ice, over chocolate or too far", () => {
    const from = { x: 2 * TILE, y: FLOOR };
    // The pillar is in the way of the spot just behind it.
    const left = { x: 10 * TILE, y: 4.5 * TILE };
    expect(superStretchTarget(level, left, { x: 14.5 * TILE, y: 4.5 * TILE })).toBeTruthy();
    expect(superStretchTarget(level, left, { x: 16 * TILE, y: 4.5 * TILE })).toBe(null);
    // Ice isn't sticky.
    const under = { x: 25.5 * TILE, y: FLOOR };
    expect(superStretchTarget(level, under, { x: 25.5 * TILE, y: 4.5 * TILE })).toBe(null);
    // Tapping empty air in the middle of nowhere.
    expect(superStretchTarget(level, from, { x: 8 * TILE, y: 5 * TILE })).toBe(null);
    // Along the floor, right over the chocolate river.
    expect(superStretchTarget(level, from, { x: 20 * TILE, y: FLOOR })).toBe(null);
    // A wall 13 tiles away is fine, but 21 tiles away is way too far.
    const hall = width =>
      parseLevel({
        id: 'super-hall',
        map: ['#'.repeat(width), `#S${'.'.repeat(width - 4)}E#`, '#'.repeat(width)],
      });
    const start = { x: 1.5 * TILE, y: 1.5 * TILE };
    expect(superStretchTarget(hall(16), start, { x: 15.5 * TILE, y: 1.5 * TILE })).toBeTruthy();
    expect(SUPER_RANGE).toBeLessThan(21 * TILE);
    expect(superStretchTarget(hall(24), start, { x: 23.5 * TILE, y: 1.5 * TILE })).toBe(null);
  });

  it('stretches the head way out, sticks it, then pulls the tail over', () => {
    const sup = new SuperStretch();
    const slime = slimeAt(2 * TILE, FLOOR);
    const tap = { x: 6 * TILE, y: 0.5 * TILE };
    expect(sup.start(level, slime, tap)).toBe(true);
    expect(sup.state).toBe('out');
    expect(slime.frozen).toBe(true);
    const head = slime.ends[slime.lead];
    const tail = slime.ends[1 - slime.lead];
    run(sup, slime, 0.1);
    // The head is on its way; the tail stays put.
    expect(head.y).toBeLessThan(FLOOR - 100);
    expect(tail.y).toBe(FLOOR);
    run(sup, slime, 1);
    expect(sup.state).toBe('idle');
    expect(slime.frozen).toBe(false);
    expect(slime.ends.every(e => e.state === 'stuck')).toBe(true);
    expect(Math.hypot(head.x - tail.x, head.y - tail.y)).toBeLessThan(1);
    expect(head.y).toBeLessThan(2 * TILE);
    // It stays stuck up there.
    run(sup, slime, 0.5);
    expect(slime.isFalling).toBe(false);
    expect(head.y).toBeLessThan(2 * TILE);
    expect(sup.takeEvents()).toEqual(['stretch', 'stick', 'done']);
  });

  it('then needs 20 seconds to rest', () => {
    const sup = new SuperStretch();
    const slime = slimeAt(2 * TILE, FLOOR);
    sup.start(level, slime, { x: 6 * TILE, y: 0.5 * TILE });
    run(sup, slime, 1);
    expect(sup.cooldown).toBeGreaterThan(SUPER_COOLDOWN - 1);
    expect(sup.ready).toBe(false);
    expect(sup.start(level, slime, { x: 2 * TILE, y: FLOOR + 20 })).toBe(false);
    run(sup, slime, SUPER_COOLDOWN);
    expect(sup.ready).toBe(true);
  });

  it("doesn't start (or start the rest) when the spot can't be reached", () => {
    const sup = new SuperStretch();
    const slime = slimeAt(2 * TILE, FLOOR);
    expect(sup.start(level, slime, { x: 8 * TILE, y: 5 * TILE })).toBe(false);
    expect(sup.cooldown).toBe(0);
    expect(slime.frozen).toBe(false);
    // Not while stuck in caramel, or falling.
    slime.glued = true;
    expect(sup.start(level, slime, { x: 6 * TILE, y: 0.5 * TILE })).toBe(false);
    slime.glued = false;
    slime.knockLoose(0, 0);
    expect(sup.start(level, slime, { x: 6 * TILE, y: 0.5 * TILE })).toBe(false);
  });

  it('stops if something else lets go of the slime partway', () => {
    const sup = new SuperStretch();
    const slime = slimeAt(2 * TILE, FLOOR);
    sup.start(level, slime, { x: 6 * TILE, y: 0.5 * TILE });
    run(sup, slime, 0.05);
    slime.spawn({ x: 2 * TILE, y: FLOOR });
    run(sup, slime, 0.05);
    expect(sup.state).toBe('idle');
    expect(sup.cooldown).toBe(0);
  });
});
