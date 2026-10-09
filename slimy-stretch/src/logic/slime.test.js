import { describe, expect, it } from 'vitest';
import { parseLevel } from './level.js';
import { Slime } from './slime.js';
import { MAX_STRETCH } from './constants.js';

// A small room: floor of wall tiles, an ice wall on the right, a sticky wall on the left.
const room = parseLevel({
  id: 'test',
  type: 'normal',
  map: [
    '############',
    '#..........I',
    '#..........I',
    '#..........I',
    '#..........I',
    '#.S......E.I',
    '############',
  ],
});

function landedSlime() {
  const slime = new Slime(room.start);
  for (let i = 0; i < 120 && slime.isFalling; i++) {
    slime.update(1 / 60, room);
  }
  slime.takeEvents();
  return slime;
}

function drag(slime, to, frames = 90) {
  slime.grab(slime.ends[0], 0);
  for (let i = 1; i <= frames; i++) {
    slime.moveFinger(to, i / 60);
    slime.update(1 / 60, room);
  }
  return slime.release(room);
}

describe('Slime', () => {
  it('falls from the start and lands on the floor', () => {
    const slime = landedSlime();
    expect(slime.isFalling).toBe(false);
    expect(Math.abs(slime.ends[0].y - (6 * 48 - 14))).toBeLessThan(3);
  });

  it('stretches toward the finger but no farther than the max', () => {
    const slime = landedSlime();
    const start = { ...slime.ends[0] };
    slime.grab(start, 0);
    for (let i = 0; i < 90; i++) {
      slime.moveFinger({ x: start.x + 1000, y: start.y - 60 }, i / 60);
      slime.update(1 / 60, room);
    }
    expect(slime.stretch).toBeLessThanOrEqual(MAX_STRETCH + 0.5);
    expect(slime.stretch).toBeGreaterThan(MAX_STRETCH - 5);
  });

  it('boings back when let go in mid-air', () => {
    const slime = landedSlime();
    const home = { ...slime.ends[0] };
    drag(slime, { x: home.x + 100, y: home.y - 120 });
    expect(slime.takeEvents()).toContain('snap');
    for (let i = 0; i < 30; i++) {
      slime.update(1 / 60, room);
    }
    expect(slime.stretch).toBeLessThan(1);
    expect(slime.ends[0].x).toBeCloseTo(home.x, 0);
  });

  it('sticks to a wall when let go next to it', () => {
    const slime = landedSlime();
    const home = { ...slime.ends[0] };
    drag(slime, { x: home.x + 150, y: home.y });
    expect(slime.takeEvents()).toContain('stick');
    expect(slime.stretch).toBeGreaterThan(140);
  });

  it('sticks when let go close to (but not touching) a wall', () => {
    const slime = landedSlime();
    // The left wall's face is at x=48, so the end can rest at x=62. Let go a bit away.
    slime.ends[0].x = slime.ends[1].x = 90;
    slime.ends[0].y = slime.ends[1].y = 4 * 48;
    slime.grab(slime.ends[0], 0);
    slime.moveFinger({ x: 90, y: 3 * 48 }, 0.1);
    for (let i = 0; i < 60; i++) {
      slime.update(1 / 60, room);
    }
    slime.release(room);
    expect(slime.takeEvents()).toContain('stick');
    expect(slime.ends[0].x).toBeLessThan(70);
  });

  it("can't stick to ice", () => {
    const slime = landedSlime();
    slime.ends[0].x = slime.ends[1].x = 9 * 48;
    slime.ends[0].y = slime.ends[1].y = 6 * 48 - 14;
    // Stretch up the ice wall on the right, away from the floor.
    slime.grab(slime.ends[0], 0);
    for (let i = 0; i < 60; i++) {
      slime.moveFinger({ x: 12 * 48, y: 2 * 48 }, i / 60);
      slime.update(1 / 60, room);
    }
    expect(slime.heldEnd.x).toBeGreaterThan(11 * 48 - 20);
    slime.release(room);
    expect(slime.takeEvents()).toContain('snap');
  });

  it('can be grabbed again while still boinging back', () => {
    const slime = landedSlime();
    const home = { ...slime.ends[0] };
    drag(slime, { x: home.x + 100, y: home.y - 120 });
    expect(slime.grab(home, 1)).toBe(true);
  });

  it('slides along a wall instead of stopping dead', () => {
    const slime = landedSlime();
    const home = { ...slime.ends[0] };
    // Finger is inside the floor; the end should slide along the floor toward it.
    slime.grab(home, 0);
    for (let i = 0; i < 60; i++) {
      slime.moveFinger({ x: home.x + 150, y: home.y + 60 }, i / 60);
      slime.update(1 / 60, room);
    }
    expect(slime.heldEnd.x).toBeGreaterThan(home.x + 120);
    expect(Math.abs(slime.heldEnd.y - home.y)).toBeLessThan(3);
  });

  it('measures finger speed for flicks', () => {
    const slime = landedSlime();
    slime.grab({ x: 100, y: 100 }, 0);
    slime.moveFinger({ x: 200, y: 100 }, 0.1);
    expect(slime.fingerVelocity().x).toBeCloseTo(1000, 0);
  });
});
