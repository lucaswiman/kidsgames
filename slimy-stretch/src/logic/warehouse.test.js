import { describe, expect, it } from 'vitest';
import { parseLevel } from './level.js';
import { Slime } from './slime.js';
import { Tongue } from './tongue.js';
import { CanyonStuff } from './canyon.js';
import { simulateDrop, simulateShot, WarehouseStuff } from './warehouse.js';
import { findStickSpot } from './collision.js';
import { END_RADIUS, STICK_SEARCH } from './constants.js';

function slimeAt(x, y) {
  const slime = new Slime({ x, y });
  slime.falling = null;
  return slime;
}

function run(stuff, slime, level, seconds) {
  for (let t = 0; t < seconds; t += 1 / 60) {
    slime.update(1 / 60, level);
    stuff.update(1 / 60, slime);
  }
}

describe('conveyor belts', () => {
  const map = ['##########', '#.......E#', '#.S......#', '#..>>>...#', '#........#', '##########'];

  it('carry a slime sitting on them, then drop it off the end', () => {
    const level = parseLevel({ id: 'belt', type: 'normal', map });
    const stuff = new WarehouseStuff(level);
    const slime = slimeAt(3.5 * 48, 3 * 48 - 15);
    run(stuff, slime, level, 0.5);
    expect(slime.ends[0].x).toBeGreaterThan(3.5 * 48 + 30);
    run(stuff, slime, level, 2);
    // Carried off the right end of the belt and fell.
    expect(slime.ends[0].x).toBeGreaterThan(6 * 48);
    expect(slime.ends[0].y).toBeGreaterThan(4 * 48);
  });
});

describe('one-way platforms', () => {
  const map = ['########', '#.....E#', '#......#', '#.----.#', '#......#', '#..S...#', '########'];

  it('let you stretch up through them and stick on top', () => {
    const level = parseLevel({ id: 'plat', type: 'normal', map });
    const slime = slimeAt(3.5 * 48, 6 * 48 - 15);
    slime.grab(slime.ends[0], 0);
    for (let i = 0; i < 60; i++) {
      slime.moveFinger({ x: 3.5 * 48, y: 2.5 * 48 }, i / 60);
      slime.update(1 / 60, level);
    }
    // Went right through the platform from below.
    expect(slime.heldEnd.y).toBeLessThan(3 * 48);
    slime.release(level);
    expect(slime.takeEvents()).toContain('stick');
    expect(slime.ends[0].y).toBeCloseTo(3 * 48 - END_RADIUS - 1, 0);
  });

  it('do not let you stick to their underside', () => {
    const level = parseLevel({ id: 'plat2', type: 'normal', map });
    expect(findStickSpot(level, { x: 3.5 * 48, y: 4 * 48 + 20 }, END_RADIUS, STICK_SEARCH)).toBe(
      null
    );
  });

  it('catch a falling slime', () => {
    const level = parseLevel({ id: 'plat3', type: 'normal', map });
    const landing = simulateDrop(level, { x: 3.5 * 48, y: 1.5 * 48 });
    expect(Math.abs(landing.y - (3 * 48 - END_RADIUS))).toBeLessThan(2);
  });
});

describe('slime cannons', () => {
  const map = [
    '##############',
    '#............#',
    '#............#',
    '#............#',
    '#.SU.........#',
    '###WWWWWWWW###',
    '##############',
  ];

  it('the slime climbs in, aims and flies across the water', () => {
    const level = parseLevel({
      id: 'cannon',
      type: 'normal',
      map: [...map.slice(0, 4), '#.SU........E#', ...map.slice(5)],
    });
    const stuff = new WarehouseStuff(level);
    const slime = slimeAt(3.5 * 48, 4.5 * 48);
    stuff.update(1 / 60, slime);
    expect(stuff.inCannon).toBe(0);
    expect(slime.frozen).toBe(true);
    // A low shot that flies over the water and hits the far wall.
    stuff.aim({ x: 3.5 * 48 + 100, y: 4.5 * 48 - 36 });
    stuff.fire(slime);
    run(stuff, slime, level, 3);
    expect(slime.isFalling).toBe(false);
    // Stuck somewhere past the water.
    expect(slime.ends[0].x).toBeGreaterThan(10 * 48);
  });

  it('a shot into the water is no good', () => {
    const level = parseLevel({
      id: 'cannon2',
      type: 'normal',
      map: [...map.slice(0, 4), '#.SU........E#', ...map.slice(5)],
    });
    expect(simulateShot(level, level.cannons[0], Math.PI / 4)).toBe(null);
    expect(simulateShot(level, level.cannons[0], -Math.PI / 4)).not.toBe(null);
  });
});

describe('crane claws', () => {
  const map = [
    '##############',
    '#...........E#',
    '#............#',
    '#............#',
    '#............#',
    '#.S..........#',
    '##############',
  ];

  it('grab the slime and drop it at their drop spot', () => {
    const level = parseLevel({
      id: 'claw',
      type: 'normal',
      claws: [{ row: 0, from: 2, to: 4, drop: 10, nice: true }],
      map,
    });
    const stuff = new WarehouseStuff(level);
    const claw = stuff.claws[0];
    // Put the slime right where the claw is.
    const slime = slimeAt(claw.x, claw.y);
    stuff.update(1 / 60, slime);
    expect(stuff.inClaw).toBe(0);
    run(stuff, slime, level, 4);
    expect(stuff.inClaw).toBe(null);
    expect(slime.ends[0].x).toBeCloseTo(10.5 * 48, 0);
    expect(slime.isFalling).toBe(false);
  });
});

describe('bomb boxes', () => {
  it('hold nothing to collect, and make the tongue sore', () => {
    const level = parseLevel({
      id: 'bomb',
      type: 'normal',
      boxItems: ['bomb', 'token'],
      map: ['########', '#..M..M#', '#S....E#', '########'],
    });
    expect(level.tokens.length).toBe(1);
    const canyon = new CanyonStuff(level);
    expect(canyon.boxes[0].item).toBe('bomb');
    const tongue = new Tongue();
    tongue.blowUp(10);
    expect(tongue.start({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe(false);
    tongue.tick(10);
    expect(tongue.start({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe(true);
  });
});
