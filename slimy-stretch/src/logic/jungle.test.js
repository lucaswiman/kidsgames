import { describe, expect, it } from 'vitest';
import { isPlatformKind, parseLevel, TileKind } from './level.js';
import { Slime } from './slime.js';
import { IslandStuff, simulateBounce } from './island.js';
import { SlimeShots } from './slimeShot.js';
import { findHazard } from './hazards.js';
import { END_RADIUS, MAX_STRETCH, TILE } from './constants.js';
import {
  JungleStuff,
  LEAF_BACK,
  LEAF_TIP_TIME,
  LEAFY_REGROW,
  logRideY,
  MONKEY_EVERY,
  MONKEY_SCARED_TIME,
  QUICKSAND_REACH,
  QUICKSAND_SINK_TIME,
  SNAKE_REST,
  simulateLaunch,
  vineLandings,
  vineTip,
  VINE_HANG,
  zipGrip,
} from './jungle.js';

function slimeAt(x, y) {
  const slime = new Slime({ x, y });
  slime.falling = null;
  return slime;
}

/** Run the slime and the jungle together; returns the hurts that happened. */
function run(jungle, slime, level, seconds, finger = null) {
  const hurts = [];
  for (let t = 0; t < seconds; t += 1 / 60) {
    slime.update(1 / 60, level);
    const h = jungle.update(1 / 60, slime, typeof finger === 'function' ? finger() : finger);
    if (h) {
      hurts.push(h);
    }
  }
  return hurts;
}

describe('the jungle map', () => {
  it('knows quicksand, monkeys, snakes, leafy traps, snake pits, flowers and leaves', () => {
    const level = parseLevel({
      id: 'j',
      type: 'normal',
      map: ['#########', '#m..s...#', '#.......#', '#S.*__.E#', '#qq%%####', '###xx####'],
    });
    expect(level.tiles[4][1]).toBe(TileKind.QUICKSAND);
    expect(level.tiles[4][3]).toBe(TileKind.LEAFY);
    expect(level.tiles[5][3]).toBe(TileKind.SNAKE_PIT);
    expect(level.tiles[3][3]).toBe(TileKind.FLOWER);
    expect(level.tiles[3][4]).toBe(TileKind.LEAF);
    expect(isPlatformKind(TileKind.LEAF)).toBe(true);
    expect(level.monkeys).toHaveLength(1);
    expect(level.snakes).toHaveLength(1);
    expect(level.leafyTraps).toHaveLength(2);
  });
});

describe('quicksand', () => {
  const map = ['##########', '#........#', '#........#', '#S......E#', '#qqq######', '##########'];

  it('makes your stretch much shorter while you are in it', () => {
    const level = parseLevel({ id: 'q', type: 'normal', map });
    const jungle = new JungleStuff(level);
    const slime = slimeAt(2.5 * TILE, 4 * TILE - END_RADIUS);
    run(jungle, slime, level, 0.1);
    expect(jungle.reachScale).toBe(QUICKSAND_REACH);
    // It stacks with missing slime blobs.
    const shots = new SlimeShots();
    expect(shots.reach(2) * jungle.reachScale).toBeCloseTo(MAX_STRETCH * 0.5 * QUICKSAND_REACH);
  });

  it('swallows you if you stay in it for more than 3 seconds', () => {
    const level = parseLevel({ id: 'q2', type: 'normal', map });
    const jungle = new JungleStuff(level);
    const slime = slimeAt(2.5 * TILE, 4 * TILE - END_RADIUS);
    expect(run(jungle, slime, level, QUICKSAND_SINK_TIME - 0.2)).toEqual([]);
    expect(jungle.sink).toBeGreaterThan(0.9);
    expect(run(jungle, slime, level, 0.4)).toContain('quicksand');
  });

  it('lets go of you when you climb out, and starts over next time', () => {
    const level = parseLevel({ id: 'q3', type: 'normal', map });
    const jungle = new JungleStuff(level);
    const slime = slimeAt(2.5 * TILE, 4 * TILE - END_RADIUS);
    run(jungle, slime, level, 2);
    // Climb out onto the wall next to it.
    slime.ends.forEach(e => (e.x = 6.5 * TILE));
    run(jungle, slime, level, 0.1);
    expect(jungle.sinkTimer).toBe(0);
    expect(jungle.reachScale).toBe(1);
    slime.ends.forEach(e => (e.x = 2.5 * TILE));
    expect(run(jungle, slime, level, 2)).toEqual([]);
  });

  it('only holds back the end that is stuck in it', () => {
    const level = parseLevel({ id: 'q4', type: 'normal', map });
    const jungle = new JungleStuff(level);
    const slime = slimeAt(2.5 * TILE, 4 * TILE - END_RADIUS);
    slime.ends[1].x = 6.5 * TILE;
    // Pull the tail out of the quicksand: you're not stuck in it any more.
    slime.grab({ x: 2.5 * TILE, y: 3.5 * TILE });
    run(jungle, slime, level, 0.1);
    expect(jungle.reachScale).toBe(1);
  });
});

describe('monkeys and bananas', () => {
  const map = [
    '##############',
    '#............#',
    '#.m..........#',
    '#.##.........#',
    '#............#',
    '#S..........E#',
    '##############',
  ];

  it('throw bananas at you when you come close, and they hurt', () => {
    const level = parseLevel({ id: 'm', type: 'normal', map });
    const jungle = new JungleStuff(level);
    const slime = slimeAt(6.5 * TILE, 6 * TILE - END_RADIUS);
    const hurts = run(jungle, slime, level, 4);
    expect(hurts).toContain('banana');
  });

  it("don't throw when you're far away", () => {
    const level = parseLevel({ id: 'm2', type: 'normal', map: map.map(r => r + '.........') });
    const jungle = new JungleStuff(level);
    const slime = slimeAt(21.5 * TILE, 6 * TILE - END_RADIUS);
    expect(run(jungle, slime, level, 5)).toEqual([]);
    expect(jungle.bananas).toHaveLength(0);
  });

  it('hide for a while when a slime shot hits them', () => {
    const level = parseLevel({ id: 'm3', type: 'normal', map });
    const jungle = new JungleStuff(level);
    const slime = slimeAt(6.5 * TILE, 6 * TILE - END_RADIUS);
    jungle.scareMonkey(jungle.monkeys[0]);
    expect(run(jungle, slime, level, MONKEY_SCARED_TIME - 0.5)).toEqual([]);
    expect(jungle.bananas).toHaveLength(0);
    run(jungle, slime, level, 1);
    expect(jungle.monkeys[0].state).not.toBe('hiding');
  });

  it('throw again every few seconds', () => {
    const level = parseLevel({ id: 'm4', type: 'normal', map });
    const jungle = new JungleStuff(level);
    const slime = slimeAt(6.5 * TILE, 6 * TILE - END_RADIUS);
    let throws = 0;
    for (let t = 0; t < 2 + MONKEY_EVERY * 2.5; t += 1 / 60) {
      jungle.update(1 / 60, slime);
      throws += jungle.takeEvents().filter(e => e.type === 'throw').length;
    }
    expect(throws).toBeGreaterThanOrEqual(2);
  });

  it('a banana caught with the tongue gives back slime a seagull took', () => {
    const level = parseLevel({ id: 'm5', type: 'normal', map });
    const jungle = new JungleStuff(level);
    const island = new IslandStuff(level);
    island.lost = 2;
    island.spares = [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
    ];
    jungle.throwBanana(jungle.monkeys[0], { x: 6.5 * TILE, y: 5.5 * TILE });
    const b = jungle.bananas[0];
    expect(jungle.catchBanana({ x: b.x + 5, y: b.y }, 8)).toBe(true);
    expect(jungle.bananas).toHaveLength(0);
    expect(jungle.eatBanana(island, new SlimeShots())).toBe('lost');
    expect(island.lost).toBe(1);
    // The extra blob of you out in the level disappears.
    expect(island.spares).toHaveLength(1);
  });

  it('otherwise a banana brings back a slime shot blob, or is just a snack', () => {
    const level = parseLevel({ id: 'm6', type: 'normal', map });
    const jungle = new JungleStuff(level);
    const island = new IslandStuff(level);
    const shots = new SlimeShots();
    shots.fire({ x: 100, y: 100 }, { x: 200, y: 100 });
    expect(jungle.eatBanana(island, shots)).toBe('shot');
    expect(shots.blobs).toHaveLength(0);
    expect(jungle.eatBanana(island, shots)).toBe('snack');
  });

  it('a banana splats on a wall', () => {
    const level = parseLevel({ id: 'm7', type: 'normal', map });
    const jungle = new JungleStuff(level);
    jungle.throwBanana(jungle.monkeys[0], { x: 0.5 * TILE, y: 2.5 * TILE });
    run(jungle, slimeAt(12.5 * TILE, 1.5 * TILE), level, 1.5);
    expect(jungle.bananas).toHaveLength(0);
  });
});

describe('snakes', () => {
  const map = [
    '############',
    '#....s.....#',
    '#..........#',
    '#..........#',
    '#S........E#',
    '############',
  ];

  it('snap down at you after a warning, then pull back up and rest', () => {
    const level = parseLevel({ id: 's', type: 'normal', map });
    const jungle = new JungleStuff(level);
    const snake = jungle.snakes[0];
    const slime = slimeAt(5.5 * TILE, 3.5 * TILE);
    expect(run(jungle, slime, level, 0.3)).toEqual([]);
    expect(snake.state).toBe('warn');
    expect(run(jungle, slime, level, 1)).toContain('snake');
    // Move away; it pulls back up and rests for a bit.
    slime.ends.forEach(e => (e.x = 9.5 * TILE));
    run(jungle, slime, level, 1);
    expect(snake.state).toBe('rest');
    // While it rests you can sneak right under it.
    slime.ends.forEach(e => (e.x = 5.5 * TILE));
    expect(run(jungle, slime, level, SNAKE_REST - 1.2)).toEqual([]);
  });

  it('miss you if you get out of the way in time', () => {
    const level = parseLevel({ id: 's2', type: 'normal', map });
    const jungle = new JungleStuff(level);
    const slime = slimeAt(5.5 * TILE, 3.5 * TILE);
    run(jungle, slime, level, 0.2);
    slime.ends.forEach(e => (e.x = 8.5 * TILE));
    expect(run(jungle, slime, level, 2)).toEqual([]);
  });

  it("can't reach through the floor", () => {
    const level = parseLevel({
      id: 's3',
      type: 'normal',
      map: ['#######', '#..s..#', '#.....#', '#S.#.E#', '#######'],
    });
    const jungle = new JungleStuff(level);
    expect(jungle.snakes[0].reach).toBeLessThan(2 * TILE);
  });
});

describe('leafy traps', () => {
  const map = [
    '##########',
    '#........#',
    '#........#',
    '#S..%%..E#',
    '####..####',
    '####xx####',
    '##########',
  ];

  it('break as soon as you stick to them and drop you into the snake pit', () => {
    const level = parseLevel({ id: 'l', type: 'normal', map });
    const jungle = new JungleStuff(level);
    const slime = slimeAt(4.5 * TILE, 4 * TILE - END_RADIUS);
    jungle.update(1 / 60, slime);
    expect(slime.isFalling).toBe(true);
    // Both leafy tiles fall in together.
    expect(level.tiles[3][4]).toBe(TileKind.EMPTY);
    expect(level.tiles[3][5]).toBe(TileKind.EMPTY);
    let hazard = null;
    for (let t = 0; t < 2 && !hazard; t += 1 / 60) {
      slime.update(1 / 60, level);
      jungle.update(1 / 60, slime);
      hazard = findHazard(level, slime, [], t, null);
    }
    expect(hazard).toBe('fluid');
  });

  it('grow back after a while', () => {
    const level = parseLevel({ id: 'l2', type: 'normal', map });
    const jungle = new JungleStuff(level);
    jungle.breakTrap(jungle.traps[0]);
    const away = slimeAt(1.5 * TILE, 3.5 * TILE);
    run(jungle, away, level, LEAFY_REGROW - 0.5);
    expect(level.tiles[3][4]).toBe(TileKind.EMPTY);
    run(jungle, away, level, 1);
    expect(level.tiles[3][4]).toBe(TileKind.LEAFY);
  });
});

describe('vines', () => {
  const map = [
    '################',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#....###.......#',
    '#S...###......E#',
    '################',
  ];
  const vines = [{ at: [9, 1], length: 4 }];

  it('grab you when you touch the bottom, and swing higher when you pump', () => {
    const level = parseLevel({ id: 'v', type: 'normal', map, vines });
    const jungle = new JungleStuff(level);
    const vine = jungle.vines[0];
    const tip = vineTip(vine);
    const slime = slimeAt(tip.x, tip.y);
    jungle.update(1 / 60, slime);
    expect(jungle.onVine).toBe(0);
    expect(slime.frozen).toBe(true);
    // Hold your finger out to the right to pump the swing.
    let biggest = 0;
    run(jungle, slime, level, 6, () => {
      biggest = Math.max(biggest, Math.abs(vine.angle));
      return { x: vineTip(vine).x + 200, y: vineTip(vine).y };
    });
    expect(biggest).toBeGreaterThan(1);
    expect(biggest).toBeLessThanOrEqual(70 * (Math.PI / 180) + 1e-9);
    // The slime swings along with the vine.
    const now = vineTip(vine);
    expect(slime.center.x).toBeCloseTo(now.x);
    expect(slime.center.y).toBeCloseTo(now.y + VINE_HANG);
  });

  it('fling you when you let go, and you stick to whatever you hit', () => {
    const level = parseLevel({ id: 'v2', type: 'normal', map, vines });
    const jungle = new JungleStuff(level);
    const vine = jungle.vines[0];
    const slime = slimeAt(vineTip(vine).x, vineTip(vine).y);
    jungle.update(1 / 60, slime);
    vine.angle = -0.3;
    vine.omega = 3; // swinging right, fast
    expect(jungle.letGoVine(slime)).toBe(true);
    expect(jungle.onVine).toBe(null);
    expect(slime.isFalling).toBe(true);
    expect(slime.falling.vx).toBeGreaterThan(300);
    expect(slime.falling.sticky).toBe(true);
    // It doesn't grab you again straight away.
    run(jungle, slime, level, 0.3);
    expect(jungle.onVine).toBe(null);
    run(jungle, slime, level, 2);
    expect(slime.isFalling).toBe(false);
    expect(slime.center.x).toBeGreaterThan(vineTip(vine).x + TILE);
  });

  it('can take you somewhere you could never stretch to', () => {
    const level = parseLevel({ id: 'v3', type: 'normal', map, vines });
    const jungle = new JungleStuff(level);
    const landings = vineLandings(level, jungle.vines[0]);
    expect(landings.length).toBeGreaterThan(5);
    // Way up high on the right wall.
    expect(landings.some(p => p.x > 13.5 * TILE && p.y < 4 * TILE)).toBe(true);
  });
});

describe('floating logs', () => {
  const map = [
    '############',
    '#..........#',
    '#..........#',
    '#S........E#',
    '###WWWWWW###',
    '############',
  ];
  const logs = [{ row: 4, from: 3, to: 8 }];

  it('are solid on top, and the river is still deadly around them', () => {
    const level = parseLevel({ id: 'g', type: 'normal', map, logs });
    new JungleStuff(level);
    expect(level.tiles[4][3]).toBe(TileKind.LOG);
    expect(level.tiles[4][4]).toBe(TileKind.LOG);
    expect(level.tiles[4][5]).toBe(TileKind.WATER);
  });

  it('carry you along the river', () => {
    const level = parseLevel({ id: 'g2', type: 'normal', map, logs });
    const jungle = new JungleStuff(level);
    const log = jungle.logs[0];
    const slime = slimeAt(log.x, logRideY(4));
    run(jungle, slime, level, 2);
    expect(slime.center.x).toBeGreaterThan(4 * TILE + 100);
    expect(slime.center.x).toBeCloseTo(log.x, 0);
    expect(findHazard(level, slime, [], 0, null)).toBe(null);
    // ...all the way to the other bank, and back again.
    run(jungle, slime, level, 1.5);
    expect(slime.center.x).toBeGreaterThan(7.5 * TILE);
    run(jungle, slime, level, 4);
    expect(slime.center.x).toBeLessThan(5 * TILE);
    expect(slime.isFalling).toBe(false);
  });
});

describe('bouncy flowers', () => {
  const map = [
    '#########',
    '#.......#',
    '#...##..#',
    '#.......#',
    '#.......#',
    '#.......#',
    '#.......#',
    '#S..*..E#',
    '#########',
  ];

  it('bounce you up high, just like a hammock', () => {
    const level = parseLevel({ id: 'f', type: 'normal', map });
    const spot = simulateBounce(level, { x: 4.5 * TILE, y: 7 * TILE - 15 });
    expect(spot.y).toBeLessThan(3.5 * TILE);
    const island = new IslandStuff(level);
    const slime = slimeAt(4.5 * TILE, 7 * TILE - 15);
    island.update(1 / 60, slime, 0);
    expect(slime.isFalling).toBe(true);
    expect(slime.falling.vy).toBeLessThan(-500);
  });
});

describe('ziplines', () => {
  const map = [
    '##############',
    '#............#',
    '#............#',
    '#............#',
    '#........#####',
    '#........#####',
    '#S.......#####',
    '##########...E',
    '##########...#',
    '##############',
  ];
  const ziplines = [{ from: [2, 2], to: [11, 6] }];

  it('zoom you along the cable and drop you at the end', () => {
    const level = parseLevel({
      id: 'z',
      type: 'normal',
      map: map.map((r, i) => (i === 6 ? '#S.......#....' : r)),
      ziplines,
    });
    const jungle = new JungleStuff(level);
    const zip = jungle.ziplines[0];
    const slime = slimeAt(zipGrip(zip).x, zipGrip(zip).y + 10);
    jungle.update(1 / 60, slime);
    expect(jungle.onZip).toBe(0);
    expect(slime.frozen).toBe(true);
    run(jungle, slime, level, 0.5);
    expect(slime.center.x).toBeGreaterThan(4 * TILE);
    run(jungle, slime, level, 1.5);
    expect(jungle.onZip).toBe(null);
    run(jungle, slime, level, 1);
    expect(slime.isFalling).toBe(false);
    expect(slime.center.x).toBeGreaterThan(10 * TILE);
    // The handle goes back to the start for next time.
    run(jungle, slimeAt(12 * TILE, 8 * TILE), level, 4);
    expect(zip.state).toBe('ready');
    expect(zip.x).toBe(zip.from.x);
  });
});

describe('tipping leaves', () => {
  const map = [
    '##########',
    '#........#',
    '#........#',
    '#...__...#',
    '#........#',
    '#S......E#',
    '##########',
  ];

  it('tip over if you sit on them too long, and come back up later', () => {
    const level = parseLevel({ id: 't', type: 'normal', map });
    const jungle = new JungleStuff(level);
    expect(jungle.leaves).toHaveLength(1);
    const slime = slimeAt(4.5 * TILE, 3 * TILE - END_RADIUS - 1);
    run(jungle, slime, level, LEAF_TIP_TIME - 0.2);
    expect(level.tiles[3][4]).toBe(TileKind.LEAF);
    run(jungle, slime, level, 0.8);
    expect(level.tiles[3][4]).toBe(TileKind.EMPTY);
    expect(level.tiles[3][5]).toBe(TileKind.EMPTY);
    expect(slime.isFalling).toBe(true);
    run(jungle, slime, level, 1);
    expect(slime.center.y).toBeGreaterThan(5 * TILE);
    run(jungle, slime, level, LEAF_BACK);
    expect(level.tiles[3][4]).toBe(TileKind.LEAF);
  });

  it('stay up if you only stop for a moment', () => {
    const level = parseLevel({ id: 't2', type: 'normal', map });
    const jungle = new JungleStuff(level);
    const slime = slimeAt(4.5 * TILE, 3 * TILE - END_RADIUS - 1);
    run(jungle, slime, level, 1);
    slime.ends.forEach(e => (e.y = 5.5 * TILE));
    run(jungle, slime, level, 0.2);
    slime.ends.forEach(e => (e.y = 3 * TILE - END_RADIUS - 1));
    run(jungle, slime, level, 1);
    expect(level.tiles[3][4]).toBe(TileKind.LEAF);
  });
});

describe('simulateLaunch', () => {
  it('sticks to the first sticky thing the slime flies into', () => {
    const level = parseLevel({
      id: 'sl',
      type: 'normal',
      map: ['########', '#......#', '#......#', '#S....E#', '########'],
    });
    const spot = simulateLaunch(level, { x: 2 * TILE, y: 2 * TILE }, 600, -100);
    expect(spot.x).toBeGreaterThan(6 * TILE);
  });
});
