import { describe, expect, it } from 'vitest';
import { parseLevel, TileKind } from './level.js';
import { Slime } from './slime.js';
import {
  CHEST_TOKENS,
  CRAB_FLIP_TIME,
  GULL_WARN,
  IslandStuff,
  LOST_BLOBS,
  onSand,
  simulateBounce,
  waveState,
} from './island.js';
import { SlimeShots } from './slimeShot.js';
import { MAX_STRETCH, TILE } from './constants.js';

function slimeAt(x, y) {
  const slime = new Slime({ x, y });
  slime.falling = null;
  return slime;
}

function run(island, slime, level, seconds, start = 0) {
  const hurts = [];
  for (let t = 0; t < seconds; t += 1 / 60) {
    slime.update(1 / 60, level);
    const h = island.update(1 / 60, slime, start + t);
    if (h) {
      hurts.push(h);
    }
  }
  return hurts;
}

describe('the island map', () => {
  it('knows sand, palm trees, fronds, bridges, hammocks, crabs, coconuts and chests', () => {
    const level = parseLevel({
      id: 'p',
      type: 'normal',
      map: ['#######', '#FFQ$.#', '#Y.Z.E#', '#Y~~J.#', '#Szzzz#', '#######'],
    });
    expect(level.tiles[1][1]).toBe(TileKind.FROND);
    expect(level.tiles[2][1]).toBe(TileKind.PALM);
    expect(level.tiles[3][2]).toBe(TileKind.BRIDGE);
    expect(level.tiles[3][4]).toBe(TileKind.HAMMOCK);
    expect(level.tiles[4][2]).toBe(TileKind.SAND);
    expect(level.coconuts).toHaveLength(1);
    expect(level.crabs).toHaveLength(1);
    expect(level.chests).toHaveLength(1);
  });
});

describe('waves', () => {
  const map = ['##########', '#........#', '#.....##E#', '#S....##.#', '#zzzzz####', '##########'];
  const waves = { every: 8, from: 'left' };

  it('build up, wash in, stay a moment and wash out', () => {
    expect(waveState(waves, 0.5)).toEqual({ cover: 0, warn: true });
    expect(waveState(waves, 2).cover).toBeCloseTo(0.5);
    expect(waveState(waves, 3).cover).toBe(1);
    expect(waveState(waves, 6).cover).toBe(0);
  });

  it('get a slime that is down on the sand', () => {
    const level = parseLevel({ id: 'w', type: 'normal', map, waves });
    const island = new IslandStuff(level);
    const slime = slimeAt(3.5 * TILE, 4 * TILE - 15);
    expect(onSand(level, slime.ends[0])).toBe(true);
    expect(run(island, slime, level, 1.4)).toEqual([]);
    expect(run(island, slime, level, 2, 1.4)).toContain('wave');
  });

  it('wash harmlessly under a slime up on a rock', () => {
    const level = parseLevel({ id: 'w2', type: 'normal', map, waves });
    const island = new IslandStuff(level);
    // On top of the rock, well above the sand.
    const slime = slimeAt(6.5 * TILE, 2 * TILE - 15);
    expect(run(island, slime, level, 8)).toEqual([]);
  });
});

describe('coconuts and crabs', () => {
  it('a coconut falls on a slime that goes under its palm tree', () => {
    const level = parseLevel({
      id: 'c',
      type: 'normal',
      map: ['#######', '#.FFF.#', '#..Q..#', '#.....#', '#S...E#', '#######'],
    });
    const island = new IslandStuff(level);
    const slime = slimeAt(3.5 * TILE, 5 * TILE - 15);
    expect(run(island, slime, level, 2)).toContain('coconut');
    expect(island.coconuts[0].state).toBe('gone');
  });

  it('a crab walks back and forth and pinches', () => {
    const level = parseLevel({
      id: 'k',
      type: 'normal',
      map: ['########', '#......#', '#......#', '#S.Z..E#', '########'],
    });
    const island = new IslandStuff(level);
    const crab = island.crabs[0];
    const far = slimeAt(1.5 * TILE, 1.5 * TILE);
    const xs = [];
    for (let t = 0; t < 12; t += 1 / 60) {
      island.update(1 / 60, far, t);
      xs.push(crab.x);
    }
    expect(Math.min(...xs)).toBeLessThan(2 * TILE);
    expect(Math.max(...xs)).toBeGreaterThan(6 * TILE);
    const near = slimeAt(crab.x, crab.y);
    expect(island.update(1 / 60, near, 0)).toBe('crab');
  });

  it('a slime shot flips a crab, and then it is safe to touch for a while', () => {
    const level = parseLevel({
      id: 'k2',
      type: 'normal',
      map: ['########', '#......#', '#S.Z..E#', '########'],
    });
    const island = new IslandStuff(level);
    const crab = island.crabs[0];
    island.flipCrab(crab);
    const slime = slimeAt(crab.x, crab.y);
    expect(run(island, slime, level, CRAB_FLIP_TIME - 0.5)).toEqual([]);
    run(island, slimeAt(TILE, TILE), level, 1);
    expect(crab.state).toBe('walk');
  });

  it('a falling coconut knocks out a crab', () => {
    const level = parseLevel({
      id: 'k3',
      type: 'normal',
      map: ['#######', '#.FFF.#', '#..Q..#', '#.....#', '#S.Z.E#', '#######'],
    });
    const island = new IslandStuff(level);
    const crab = island.crabs[0];
    crab.dir = 0; // hold still under the tree
    const coconut = island.coconuts[0];
    coconut.state = 'falling';
    run(island, slimeAt(TILE * 5.5, TILE * 1.5), level, 1.5);
    expect(crab.state).toBe('ko');
  });
});

describe('hammocks', () => {
  const map = [
    '#########',
    '#.......#',
    '#...##..#',
    '#.......#',
    '#.......#',
    '#.......#',
    '#.......#',
    '#S..J..E#',
    '#########',
  ];

  it('bounce you up to stick on whatever is above', () => {
    const level = parseLevel({ id: 'h', type: 'normal', map });
    const spot = simulateBounce(level, { x: 4.5 * TILE, y: 7 * TILE - 15 });
    expect(spot).toBeTruthy();
    expect(spot.y).toBeLessThan(3.5 * TILE);
  });

  it('launch the slime when it lands on one', () => {
    const level = parseLevel({ id: 'h2', type: 'normal', map });
    const island = new IslandStuff(level);
    const slime = slimeAt(4.5 * TILE, 7 * TILE - 15);
    island.update(1 / 60, slime, 0);
    expect(slime.isFalling).toBe(true);
    expect(slime.falling.vy).toBeLessThan(-500);
  });
});

describe('seagulls', () => {
  const map = [
    '##############',
    '#............#',
    '#............#',
    '#............#',
    '#S..........E#',
    '##############',
  ];

  it('show where they will land, so you can get out of the way', () => {
    const level = parseLevel({
      id: 'g',
      type: 'normal',
      map,
      gulls: [{ from: 2, to: 10, drop: [11, 3], nice: true }],
    });
    const island = new IslandStuff(level);
    const slime = slimeAt(5.5 * TILE, 5 * TILE - 15);
    run(island, slime, level, 2.1);
    const gull = island.gulls[0];
    expect(gull.state).toBe('aim');
    // Move away before it swoops.
    slime.ends.forEach(e => (e.x = 10.5 * TILE));
    run(island, slime, level, GULL_WARN + 1);
    expect(slime.frozen).toBe(false);
  });

  it('nice ones carry you somewhere useful', () => {
    const level = parseLevel({
      id: 'g2',
      type: 'normal',
      map,
      gulls: [{ from: 2, to: 10, drop: [11, 3], nice: true }],
    });
    const island = new IslandStuff(level);
    const slime = slimeAt(5.5 * TILE, 5 * TILE - 15);
    run(island, slime, level, 2 + GULL_WARN + 4);
    expect(slime.center.x).toBeGreaterThan(10.5 * TILE);
    expect(island.lost).toBe(0);
  });

  it('mean ones eat you and barf you up smaller, with the rest of you somewhere else', () => {
    const level = parseLevel({
      id: 'g3',
      type: 'normal',
      map,
      gulls: [{ from: 2, to: 10, drop: [11, 3], nice: false }],
      blobSpots: [
        [2, 4],
        [8, 1],
        [11, 1],
      ],
    });
    const island = new IslandStuff(level);
    const slime = slimeAt(5.5 * TILE, 5 * TILE - 15);
    run(island, slime, level, 2 + GULL_WARN + 3);
    expect(island.lost).toBe(LOST_BLOBS);
    expect(island.spares).toHaveLength(LOST_BLOBS);
    const shots = new SlimeShots();
    expect(shots.reach(island.lost)).toBeCloseTo(MAX_STRETCH / 2);
    expect(shots.canFire(island.lost)).toBe(true);
    // Soak the spare blobs back up to get back to full size.
    for (const b of [...island.spares]) {
      const s = slimeAt(b.x, b.y);
      island.update(1 / 60, s, 0);
    }
    expect(island.lost).toBe(0);
  });
});

describe('treasure chests', () => {
  it('are found by touching them, once', () => {
    const level = parseLevel({ id: 't', type: 'normal', map: ['######', '#S.$E#', '######'] });
    const island = new IslandStuff(level);
    const slime = slimeAt(3.5 * TILE, 1.5 * TILE);
    expect(island.touchedChests(slime)).toHaveLength(1);
    expect(island.touchedChests(slime)).toHaveLength(0);
    expect(CHEST_TOKENS).toBe(10);
  });
});
