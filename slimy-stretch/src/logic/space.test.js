import { describe, expect, it } from 'vitest';
import {
  inZeroG,
  isBouncyKind,
  isSolidKind,
  isStickyKind,
  parseLevel,
  TileKind,
  tileAt,
} from './level.js';
import { Slime } from './slime.js';
import { findHazard } from './hazards.js';
import { END_RADIUS, MAX_STRETCH, TILE, ZERO_G_FLING } from './constants.js';
import { solveLevel } from './solver.js';
import { HAMMOCK_SPEED, IslandStuff, MOON_ROCK_SPEED, simulateBounce } from './island.js';
import { SkyStuff } from './sky.js';
import { Tongue } from './tongue.js';
import {
  ASTEROID_WARN,
  asteroidWarning,
  BLACK_HOLE_RANGE,
  CARRY_REACH,
  PLANT_CHOMP,
  PLANT_OPEN,
  PLANT_REST,
  simulateBooster,
  SpaceStuff,
  UFO_BEAM,
  UFO_EVERY,
  UFO_WARN,
} from './space.js';

function slimeAt(x, y) {
  const slime = new Slime({ x, y });
  slime.falling = null;
  return slime;
}

/** Middle of tile (col, row), in pixels. */
const at = (col, row) => ({ x: (col + 0.5) * TILE, y: (row + 0.5) * TILE });

/** Run the slime and the space stuff together; returns the hurts that happened. */
function run(space, slime, level, seconds, extra = () => {}) {
  const hurts = [];
  let time = space.time;
  for (let t = 0; t < seconds; t += 1 / 60) {
    time += 1 / 60;
    slime.wind.x = 0;
    space.pullSlime(slime);
    slime.update(1 / 60, level);
    const h = space.update(1 / 60, slime, time);
    extra();
    if (h) {
      hurts.push(h);
    }
  }
  return hurts;
}

/** Drag the end nearest `from` to `to` and hold it there for a moment. */
function stretch(slime, level, from, to, seconds = 0.6, before = () => {}) {
  slime.grab(from);
  slime.moveFinger(to);
  for (let t = 0; t < seconds; t += 1 / 60) {
    before();
    slime.update(1 / 60, level);
  }
}

describe('the space map', () => {
  it('knows black holes, plants, gravity switches, moon rocks and rocket boosters', () => {
    const level = parseLevel({
      id: 'space',
      type: 'normal',
      boosters: ['right', 'up-left'],
      zeroG: [{ from: [5, 0], to: [3, 1] }],
      map: ['.0..p..+..', '.g.D...+..', 'S.......E.', '##########'],
    });
    expect(level.blackHoles).toHaveLength(1);
    expect(level.plants).toHaveLength(1);
    expect(level.switches).toHaveLength(1);
    expect(level.moonRocks).toHaveLength(1);
    expect(level.tiles[1][3]).toBe(TileKind.MOON_ROCK);
    // Moon rocks are solid, sticky and bouncy; black holes and plants aren't solid.
    expect(isSolidKind(TileKind.MOON_ROCK)).toBe(true);
    expect(isStickyKind(TileKind.MOON_ROCK)).toBe(true);
    expect(isBouncyKind(TileKind.MOON_ROCK)).toBe(true);
    expect(level.tiles[0][1]).toBe(TileKind.EMPTY);
    expect(level.tiles[0][4]).toBe(TileKind.EMPTY);
    // Boosters point the way def.boosters says, in reading order.
    expect(level.boosters.map(b => b.dir)).toEqual(['right', 'up-left']);
    expect(level.boosters[0].angle).toBeCloseTo(0);
    expect(level.boosters[1].angle).toBeCloseTo((-3 * Math.PI) / 4);
    // The zero gravity zone covers the tiles between its corners.
    expect(inZeroG(level, at(3, 0))).toBe(true);
    expect(inZeroG(level, at(5, 1))).toBe(true);
    expect(inZeroG(level, at(2, 1))).toBe(false);
    expect(inZeroG(level, at(4, 2))).toBe(false);
  });

  it('complains about a booster pointing a way that does not exist', () => {
    expect(() => parseLevel({ id: 'bad', boosters: ['sideways'], map: ['S+E', '###'] })).toThrow(
      /booster direction/
    );
  });
});

describe('asteroids', () => {
  const map = [
    '..............',
    '..............',
    '..S........E..',
    '#.............',
    '##############',
  ];
  const lane = { row: 1, dir: 1, every: 5 };

  it('blink at the edge first as a warning, then fly along their lane', () => {
    const level = parseLevel({ id: 'a', map, asteroids: [lane] });
    const space = new SpaceStuff(level);
    const slime = slimeAt(at(2, 3).x, at(2, 3).y);
    expect(asteroidWarning(lane, 0.5)).toBe(true);
    run(space, slime, level, ASTEROID_WARN * 0.8);
    expect(space.lanes[0].state).toBe('warn');
    expect(space.lanes[0].rocks).toEqual([]);
    run(space, slime, level, ASTEROID_WARN * 0.4);
    expect(space.lanes[0].rocks).toHaveLength(1);
    const rock = space.lanes[0].rocks[0];
    const x = rock.x;
    run(space, slime, level, 0.5);
    expect(rock.x).toBeGreaterThan(x + 100);
    expect(rock.y).toBeCloseTo(at(0, 1).y);
  });

  it('hurt a slime in their lane, but not one above or below it', () => {
    const level = parseLevel({ id: 'a', map, asteroids: [lane] });
    const inLane = slimeAt(at(5, 1).x, at(5, 1).y);
    expect(run(new SpaceStuff(level), inLane, level, 3)).toContain('asteroid');
    const below = slimeAt(at(5, 3).x, at(5, 3).y + 6);
    expect(run(new SpaceStuff(level), below, level, 3)).toEqual([]);
  });

  it('keep coming, even before the last one is gone', () => {
    const level = parseLevel({ id: 'a', map, asteroids: [{ row: 1, dir: -1, every: 1.5 }] });
    const space = new SpaceStuff(level);
    run(space, slimeAt(at(2, 3).x, at(2, 3).y), level, 3.2);
    expect(space.lanes[0].rocks.length).toBe(2);
    expect(space.lanes[0].rocks[0].x).toBeLessThan(space.lanes[0].rocks[1].x);
  });

  it('smash into the first wall in their way', () => {
    const walled = map.map(r => r.slice());
    walled[1] = '.......#......';
    const level = parseLevel({ id: 'a', map: walled, asteroids: [lane] });
    const space = new SpaceStuff(level);
    const behind = slimeAt(at(10, 1).x, at(10, 1).y);
    const hurts = run(space, behind, level, 4);
    expect(hurts).toEqual([]);
    expect(space.takeEvents().some(e => e.type === 'crash')).toBe(true);
  });
});

describe('black holes', () => {
  const map = [
    '#################',
    '#...............#',
    '#...............#',
    '#...........0...#',
    '#...............#',
    '#S.............E#',
    '#################',
  ];

  it('pull the end you are dragging toward them, but you can still stretch away', () => {
    const level = parseLevel({ id: 'bh', map });
    const space = new SpaceStuff(level);
    const hole = space.holes[0];
    const anchor = { x: hole.x - 3 * TILE, y: hole.y };
    const target = { x: anchor.x, y: anchor.y - 150 };
    // Without the black hole the end goes right to your finger...
    const plain = slimeAt(anchor.x, anchor.y);
    stretch(plain, level, anchor, target);
    // ...with it, the end gets tugged toward the hole.
    const pulled = slimeAt(anchor.x, anchor.y);
    stretch(pulled, level, anchor, target, 0.6, () => {
      pulled.wind.x = 0;
      space.pullSlime(pulled);
    });
    expect(pulled.heldEnd.x).toBeGreaterThan(plain.heldEnd.x + 5);
    expect(Math.hypot(pulled.heldEnd.x - hole.x, pulled.heldEnd.y - hole.y)).toBeLessThan(
      Math.hypot(plain.heldEnd.x - hole.x, plain.heldEnd.y - hole.y)
    );
    // Stretching straight away from it still works.
    const away = slimeAt(anchor.x, anchor.y);
    stretch(away, level, anchor, { x: anchor.x - 150, y: anchor.y }, 0.6, () => {
      away.wind.x = 0;
      space.pullSlime(away);
    });
    expect(away.heldEnd.x).toBeLessThan(anchor.x - 100);
  });

  it('never yank a stuck slime off the wall', () => {
    const level = parseLevel({ id: 'bh', map });
    const space = new SpaceStuff(level);
    // Stuck to the ceiling, right next to the black hole's pull.
    const slime = slimeAt(at(12, 1).x - 40, TILE + END_RADIUS + 1);
    slime.ends[1].x += 40;
    const before = slime.ends.map(e => ({ ...e }));
    const hurts = run(space, slime, level, 3);
    expect(hurts).toEqual([]);
    expect(slime.isFalling).toBe(false);
    expect(slime.ends.map(e => ({ ...e }))).toEqual(before);
  });

  it('pull a falling slime in, and touching the middle hurts', () => {
    const level = parseLevel({ id: 'bh', map });
    const space = new SpaceStuff(level);
    const hole = space.holes[0];
    // Dropped a little to the side of it, the slime curves in.
    const slime = slimeAt(hole.x - 40, hole.y - 2 * TILE);
    slime.knockLoose(0, 0);
    run(space, slime, level, 0.1);
    expect(slime.falling.vx).toBeGreaterThan(0);
    expect(run(space, slime, level, 1)).toContain('blackhole');
  });

  it('leave a slime alone outside their range', () => {
    const level = parseLevel({ id: 'bh', map });
    const space = new SpaceStuff(level);
    const slime = slimeAt(at(1, 5).x, at(1, 5).y);
    slime.knockLoose(0, 0);
    run(space, slime, level, 0.2);
    expect(Math.hypot(at(1, 5).x - space.holes[0].x, 0)).toBeGreaterThan(BLACK_HOLE_RANGE);
    expect(slime.falling ? slime.falling.vx : 0).toBe(0);
  });

  it('count as deadly for the level checker', () => {
    const level = parseLevel({
      id: 'bh',
      map: [
        '###########',
        '#.........#',
        '#.........#',
        '#.........#',
        '#.........#',
        '#.........#',
        '#.........#',
        '#S...0...E#',
        '###########',
      ],
    });
    // The only way past is through the middle of the black hole... or over it.
    expect(solveLevel(level).exit).toBe(true);
    const blocked = parseLevel({
      id: 'bh2',
      map: ['#######', '#..0..#', '#..0..#', '#S.0.E#', '#######'],
    });
    expect(solveLevel(blocked).exit).toBe(false);
  });
});

describe('UFOs', () => {
  const map = [
    '####################',
    '#..................#',
    '#..................#',
    '#..................#',
    '#..................#',
    '#S................E#',
    '####################',
  ];
  const ufoDef = { row: 1, from: 8, to: 8, drop: [2, 4] };

  it('flicker as a warning, then switch on a tractor beam down to the floor', () => {
    const level = parseLevel({ id: 'u', map, ufos: [ufoDef] });
    const space = new SpaceStuff(level);
    const slime = slimeAt(at(1, 5).x, at(1, 5).y + 9);
    const ufo = space.ufos[0];
    run(space, slime, level, UFO_EVERY - UFO_WARN - 0.1);
    expect(ufo.state).toBe('patrol');
    run(space, slime, level, 0.3);
    expect(ufo.state).toBe('warn');
    run(space, slime, level, UFO_WARN);
    expect(ufo.state).toBe('beam');
    expect(ufo.bottom).toBe(6 * TILE);
    run(space, slime, level, UFO_BEAM);
    expect(ufo.state).toBe('patrol');
  });

  it('grab a slime in the beam, carry it up and away, and drop it at its drop spot', () => {
    const level = parseLevel({ id: 'u', map, ufos: [ufoDef] });
    const space = new SpaceStuff(level);
    const ufo = space.ufos[0];
    const slime = slimeAt(ufo.x, 6 * TILE - END_RADIUS - 1);
    // Nothing happens while it only flickers.
    run(space, slime, level, UFO_EVERY - UFO_WARN + UFO_WARN * 0.9);
    expect(slime.frozen).toBe(false);
    run(space, slime, level, 0.3);
    expect(space.ufoRide).toBe(0);
    expect(slime.frozen).toBe(true);
    // Lifted up toward the UFO...
    run(space, slime, level, 0.5);
    expect(slime.center.y).toBeLessThan(5 * TILE);
    // ...carried over to the drop spot and let go.
    let dropped = false;
    run(space, slime, level, 4, () => {
      dropped = dropped || space.events.some(e => e.type === 'ufoDrop');
    });
    expect(dropped).toBe(true);
    expect(space.ufoRide).toBe(null);
    expect(slime.frozen).toBe(false);
    expect(Math.abs(slime.center.x - at(2, 4).x)).toBeLessThan(2);
    // It falls down to the floor under the drop spot.
    expect(slime.isFalling).toBe(false);
    expect(Math.abs(slime.center.y - (6 * TILE - END_RADIUS))).toBeLessThan(2);
  });

  it('leave a slime that is not under the beam alone', () => {
    const level = parseLevel({ id: 'u', map, ufos: [ufoDef] });
    const space = new SpaceStuff(level);
    const slime = slimeAt(at(4, 5).x, at(4, 5).y + 9);
    run(space, slime, level, UFO_EVERY + UFO_BEAM + 1);
    expect(space.ufoRide).toBe(null);
    expect(slime.frozen).toBe(false);
  });
});

describe('alien plants', () => {
  const map = ['##########', '#........#', '#........#', '#S...p..E#', '##########'];

  it('open wide when you come close, then chomp, and only the chomp hurts', () => {
    const level = parseLevel({ id: 'p', map });
    const space = new SpaceStuff(level);
    const plant = space.plants[0];
    expect(plant.face).toEqual({ x: 0, y: -1 });
    // Right up against it.
    const slime = slimeAt(plant.x - 20, plant.y + 9);
    expect(run(space, slime, level, PLANT_OPEN * 0.8)).toEqual([]);
    expect(plant.state).toBe('open');
    const hurts = run(space, slime, level, PLANT_OPEN * 0.2 + PLANT_CHOMP * 0.5);
    expect(plant.state).toBe('chomp');
    expect(hurts).toContain('plant');
  });

  it('rest after a chomp before they can chomp again', () => {
    const level = parseLevel({ id: 'p', map });
    const space = new SpaceStuff(level);
    const plant = space.plants[0];
    const slime = slimeAt(plant.x - 20, plant.y + 9);
    run(space, slime, level, PLANT_OPEN + PLANT_CHOMP + 0.05);
    expect(plant.state).toBe('rest');
    expect(run(space, slime, level, PLANT_REST - 0.1)).toEqual([]);
    expect(plant.state).toBe('rest');
  });

  it('chomp at nothing when you are a little way off', () => {
    const level = parseLevel({ id: 'p', map });
    const space = new SpaceStuff(level);
    const plant = space.plants[0];
    // Close enough to make it open, but not touching its mouth.
    const slime = slimeAt(plant.x - 62, plant.y + 9);
    const hurts = run(space, slime, level, PLANT_OPEN + PLANT_CHOMP + 0.1);
    expect(space.takeEvents().some(e => e.type === 'chomp')).toBe(true);
    expect(hurts).toEqual([]);
  });

  it('wither for good when a thrown moon rock hits them', () => {
    const level = parseLevel({
      id: 'p',
      map: ['##########', '#........#', '#........#', '#SD..p..E#', '##########'],
    });
    const space = new SpaceStuff(level);
    const plant = space.plants[0];
    const slime = slimeAt(at(1, 3).x, at(1, 3).y + 9);
    expect(space.grabRock({ x: at(2, 3).x - 30, y: at(2, 3).y })).toBe(true);
    space.throwRock(slime.center, plant);
    run(space, slime, level, 1.2);
    expect(plant.state).toBe('withered');
    // It doesn't come back, even after you die.
    space.resetAfterDeath();
    run(space, slimeAt(plant.x - 30, plant.y + 9), level, 3);
    expect(plant.state).toBe('withered');
  });

  it('can be hit by a rock thrown along a low tunnel', () => {
    const level = parseLevel({
      id: 'p',
      map: ['############', '#S.D......E#', '############', '#....p.....#', '############'],
    });
    const space = new SpaceStuff(level);
    const plant = space.plants[0];
    // Lying on the floor of the tunnel, a few tiles from the plant.
    const slime = slimeAt(at(9, 3).x, 4 * TILE - END_RADIUS - 1);
    space.grabRock({ x: at(3, 1).x - 30, y: at(3, 1).y });
    space.throwRock(slime.center, plant);
    run(space, slime, level, 1);
    expect(plant.state).toBe('withered');
  });

  it('block the way for the level checker, unless a moon rock can wither them', () => {
    const corridor = ['#########', '#S..p..E#', '#########'];
    expect(solveLevel(parseLevel({ id: 'p1', map: corridor })).exit).toBe(false);
    // (The rock is up in the ceiling, where the tongue can reach it.)
    const withRock = ['#########', '##D######', '#S..p..E#', '#########'];
    const result = solveLevel(parseLevel({ id: 'p2', map: withRock }));
    expect(result.plants).toEqual([true]);
    expect(result.exit).toBe(true);
  });
});

describe('zero gravity', () => {
  const map = [
    '##############',
    '#............#',
    '#............#',
    '#............#',
    '#............#',
    '#S..........E#',
    '##############',
  ];
  const zeroG = [{ from: [1, 1], to: [12, 4] }];

  it('lets a loose slime float in a straight line until it bumps into something and sticks', () => {
    const level = parseLevel({ id: 'z', map, zeroG });
    const slime = slimeAt(at(6, 3).x, at(6, 3).y);
    slime.knockLoose(200, -100);
    for (let t = 0; t < 0.3; t += 1 / 60) {
      slime.update(1 / 60, level);
    }
    // No gravity: it keeps going just as it was.
    expect(slime.falling.vx).toBe(200);
    expect(slime.falling.vy).toBe(-100);
    for (let t = 0; t < 4 && slime.isFalling; t += 1 / 60) {
      slime.update(1 / 60, level);
    }
    // ...and sticks to the ceiling it floated into.
    expect(slime.isFalling).toBe(false);
    expect(slime.center.y).toBeLessThan(TILE + END_RADIUS + 5);
  });

  it('flings you off the way you were stretching when you let go in the air', () => {
    const level = parseLevel({ id: 'z', map, zeroG });
    const anchor = { x: at(1, 3).x - 9, y: at(1, 3).y };
    const slime = slimeAt(anchor.x, anchor.y);
    stretch(slime, level, anchor, { x: anchor.x + 150, y: anchor.y });
    slime.release(level);
    expect(slime.isFalling).toBe(true);
    expect(slime.falling.vx).toBeCloseTo(ZERO_G_FLING);
    expect(slime.falling.vy).toBeCloseTo(0);
    for (let t = 0; t < 6 && slime.isFalling; t += 1 / 60) {
      slime.update(1 / 60, level);
    }
    // All the way across to the far wall.
    expect(slime.isFalling).toBe(false);
    expect(slime.center.x).toBeGreaterThan(12 * TILE);
    expect(slime.center.y).toBeCloseTo(anchor.y, 0);
  });

  it('still boings back outside the zone', () => {
    const level = parseLevel({ id: 'z', map, zeroG: [{ from: [8, 1], to: [12, 5] }] });
    const anchor = { x: at(1, 3).x - 9, y: at(1, 3).y };
    const slime = slimeAt(anchor.x, anchor.y);
    stretch(slime, level, anchor, { x: anchor.x + 150, y: anchor.y });
    slime.release(level);
    expect(slime.isFalling).toBe(false);
    expect(slime.ends.some(e => e.state === 'snapping')).toBe(true);
  });

  it('lets a slime that is floating very slowly drift down instead of getting stuck', () => {
    const level = parseLevel({ id: 'z', map, zeroG: [{ from: [1, 1], to: [12, 5] }] });
    const slime = slimeAt(at(6, 2).x, at(6, 2).y);
    slime.knockLoose(0, 0);
    for (let t = 0; t < 8 && slime.isFalling; t += 1 / 60) {
      slime.update(1 / 60, level);
    }
    expect(slime.isFalling).toBe(false);
    expect(slime.center.y).toBeGreaterThan(5 * TILE);
  });

  it('turns gravity back on when you float out of the zone', () => {
    const level = parseLevel({ id: 'z', map, zeroG: [{ from: [1, 1], to: [5, 5] }] });
    const slime = slimeAt(at(3, 2).x, at(3, 2).y);
    slime.knockLoose(300, 0);
    for (let t = 0; t < 0.6; t += 1 / 60) {
      slime.update(1 / 60, level);
    }
    expect(slime.center.x).toBeGreaterThan(6 * TILE);
    expect(slime.falling.vy).toBeGreaterThan(100);
  });

  it('lets the level checker float across', () => {
    const def = {
      id: 'zz',
      map: [
        'IIIIIIIIIIIII',
        'I...........I',
        'I.....E.....I',
        'I....###....I',
        'I...........I',
        'I...........I',
        'I...........I',
        'I...........I',
        'I...........I',
        'IS..........I',
        'I#LLLLLLLLLLI',
        'IIIIIIIIIIIII',
      ],
    };
    // Floating up from the start is the only way to the exit's platform.
    expect(solveLevel(parseLevel(def)).exit).toBe(false);
    expect(solveLevel(parseLevel({ ...def, zeroG: [{ from: [1, 1], to: [11, 9] }] })).exit).toBe(
      true
    );
  });
});

describe('gravity switches', () => {
  const map = [
    '##########',
    '#........#',
    '#........#',
    '#........#',
    '#.g......#',
    '#S......E#',
    '##########',
  ];

  it('flip which way is down: you let go and fall up to the ceiling', () => {
    const level = parseLevel({ id: 'g', map });
    const space = new SpaceStuff(level);
    const floorY = 6 * TILE - END_RADIUS - 1;
    const slime = slimeAt(at(1, 5).x, floorY);
    // Stretch up and touch the switch.
    stretch(slime, level, slime.ends[1], level.switches[0]);
    run(space, slime, level, 1 / 60);
    expect(level.gravity).toBe(-1);
    run(space, slime, level, 1.5);
    expect(slime.isFalling).toBe(false);
    expect(slime.center.y).toBeLessThan(TILE + END_RADIUS + 2);
    // Touching it again (after moving off) flips it back.
    const top = slime.ends[0];
    slime.grab(top);
    slime.moveFinger(level.switches[0]);
    run(space, slime, level, 0.6);
    expect(level.gravity).toBe(1);
  });

  it('turn the top of the world into the way out while flipped', () => {
    const level = parseLevel({ id: 'g', map: ['S...E', '#####'] });
    expect(tileAt(level, 2, -1)).toBe(TileKind.ICE);
    expect(tileAt(level, 2, 5)).toBe(TileKind.EMPTY);
    level.gravity = -1;
    expect(tileAt(level, 2, -1)).toBe(TileKind.EMPTY);
    expect(tileAt(level, 2, 5)).toBe(TileKind.ICE);
    expect(tileAt(level, -1, 0)).toBe(TileKind.ICE);
    // Fall up off the top and you've fallen out of the world.
    const slime = slimeAt(at(1, 0).x, at(1, 0).y);
    slime.knockLoose(0, 0);
    for (let t = 0; t < 1; t += 1 / 60) {
      slime.update(1 / 60, level);
    }
    expect(slime.center.y).toBeLessThan(0);
    expect(findHazard(level, slime, [], 0, null)).toBe('fell');
  });

  it('go back to normal when you die', () => {
    const level = parseLevel({ id: 'g', map });
    const space = new SpaceStuff(level);
    level.gravity = -1;
    space.resetAfterDeath();
    expect(level.gravity).toBe(1);
  });

  it('are used by the level checker', () => {
    // The exit is on the ceiling of a room you can only get up to by falling up.
    const def = {
      id: 'gg',
      map: [
        'I#########I',
        'I....E....I',
        'I.........I',
        'I.........I',
        'I.........I',
        'I.........I',
        'I.........I',
        'I.........I',
        'I.........I',
        'IS........I',
        'I#########I',
        'IIIIIIIIIII',
      ],
    };
    expect(solveLevel(parseLevel(def)).exit).toBe(false);
    const flipped = def.map.slice();
    flipped[8] = 'Ig........I';
    expect(solveLevel(parseLevel({ ...def, map: flipped })).exit).toBe(true);
  });
});

describe('teleporters', () => {
  const map = [
    '##############',
    '#............#',
    '#............#',
    '#............#',
    '#S..........E#',
    '##############',
  ];
  const teleporters = [{ a: [3, 4], b: [11, 2] }];

  it('pop you out of the other pad, and rest until you step off', () => {
    const level = parseLevel({ id: 't', map, teleporters });
    const space = new SpaceStuff(level);
    const floorY = 5 * TILE - END_RADIUS - 1;
    const slime = slimeAt(at(1, 4).x, floorY);
    stretch(slime, level, slime.ends[1], at(3, 4));
    run(space, slime, level, 1 / 60);
    expect(space.takeEvents().some(e => e.type === 'teleport')).toBe(true);
    expect(slime.center.x).toBeCloseTo(at(11, 2).x);
    run(space, slime, level, 1.5);
    // It fell from the other pad down to the floor, and stays there.
    expect(slime.isFalling).toBe(false);
    expect(slime.center.x).toBeCloseTo(at(11, 2).x);
    expect(Math.abs(slime.center.y - (5 * TILE - END_RADIUS))).toBeLessThan(2);
    expect(space.takeEvents().some(e => e.type === 'teleport')).toBe(false);
  });

  it('do not bounce you straight back if you land on the other pad', () => {
    const level = parseLevel({ id: 't', map, teleporters: [{ a: [3, 4], b: [11, 4] }] });
    const space = new SpaceStuff(level);
    const slime = slimeAt(at(1, 4).x, 5 * TILE - END_RADIUS - 1);
    stretch(slime, level, slime.ends[1], at(3, 4));
    run(space, slime, level, 3);
    // Still sitting on the far pad.
    expect(slime.center.x).toBeCloseTo(at(11, 4).x);
    expect(space.pads[0].used).toBe(true);
    // Step off, and it works again.
    stretch(slime, level, slime.ends[0], { x: at(8, 4).x, y: slime.center.y });
    slime.release(level);
    slime.grab(at(11, 4));
    slime.moveFinger(at(8, 4));
    run(space, slime, level, 0.6);
    slime.release(level);
    run(space, slime, level, 1.2);
    expect(space.pads[0].used).toBe(false);
  });

  it('are used by the level checker', () => {
    const def = {
      id: 'tt',
      map: [
        '##############',
        '#.......#....#',
        '#.......#....#',
        '#.......#....#',
        '#.......#....#',
        '#S......#...E#',
        '##############',
      ],
    };
    expect(solveLevel(parseLevel(def)).exit).toBe(false);
    expect(solveLevel(parseLevel({ ...def, teleporters: [{ a: [4, 5], b: [10, 5] }] })).exit).toBe(
      true
    );
  });
});

describe('rocket boosters', () => {
  const map = [
    '################',
    '#..............#',
    '#..............#',
    '#..............#',
    '#S.+..........E#',
    '################',
  ];

  it('blast you off the way they point, and you stick to what you hit', () => {
    const level = parseLevel({ id: 'b', map, boosters: ['right'] });
    const space = new SpaceStuff(level);
    const slime = slimeAt(at(1, 4).x, 5 * TILE - END_RADIUS - 1);
    stretch(slime, level, slime.ends[1], level.boosters[0]);
    run(space, slime, level, 1 / 60);
    expect(slime.isFalling).toBe(true);
    expect(slime.falling.vx).toBeGreaterThan(800);
    expect(slime.falling.vy).toBeCloseTo(0, 0);
    run(space, slime, level, 2);
    expect(slime.isFalling).toBe(false);
    expect(slime.center.x).toBeGreaterThan(level.boosters[0].x + 2 * TILE);
  });

  it('point up just as well', () => {
    const level = parseLevel({ id: 'b', map, boosters: ['up'] });
    const landing = simulateBooster(level, level.boosters[0]);
    expect(landing.x).toBeCloseTo(level.boosters[0].x);
    expect(landing.y).toBeLessThan(TILE + END_RADIUS + 4);
  });

  it('are used by the level checker', () => {
    const def = {
      id: 'bb',
      map: [
        'I###########I',
        'I...........I',
        'I.E.........I',
        'I##.........I',
        'I...........I',
        'I...........I',
        'I...........I',
        'I...........I',
        'I...........I',
        'IS........+.I',
        'I###########I',
        'IIIIIIIIIIIII',
      ],
    };
    expect(solveLevel(parseLevel({ ...def, boosters: ['down'] })).exit).toBe(false);
    expect(solveLevel(parseLevel({ ...def, boosters: ['up'] })).exit).toBe(true);
  });
});

describe('space elevators', () => {
  const map = [
    '##########',
    '#........#',
    '#........#',
    '#........#',
    '#........#',
    '#........#',
    '#S......E#',
    '##########',
  ];

  it('go up and down their shaft, carrying a slime stuck on top', () => {
    const level = parseLevel({ id: 'e', map, elevators: [{ col: 4, from: 6, to: 2 }] });
    const sky = new SkyStuff(level);
    const space = new SpaceStuff(level, sky);
    expect(space.elevators).toHaveLength(1);
    const lift = space.elevators[0];
    expect(lift.width).toBe(2);
    // Sitting on top of it at the bottom.
    const slime = slimeAt(lift.x + TILE, lift.y - END_RADIUS - 1);
    for (let t = 0; t < 4.2; t += 1 / 60) {
      slime.update(1 / 60, level);
      sky.update(1 / 60, slime);
    }
    expect(lift.y).toBeCloseTo(2 * TILE, 0);
    expect(slime.isFalling).toBe(false);
    expect(slime.center.y).toBeCloseTo(2 * TILE - END_RADIUS - 1, 0);
    expect(level.tiles[2][4]).toBe(TileKind.SKY_ISLAND);
  });

  it('are used by the level checker', () => {
    const def = {
      id: 'ee',
      map: [
        'IIIIIIIIII',
        'I.......EI',
        'I.....####',
        'I........I',
        'I........I',
        'I........I',
        'I........I',
        'I........I',
        'IS.......I',
        'I########I',
        'IIIIIIIIII',
      ],
    };
    expect(solveLevel(parseLevel(def)).exit).toBe(false);
    const lifted = { ...def, elevators: [{ col: 3, from: 8, to: 2 }] };
    expect(solveLevel(parseLevel(lifted)).exit).toBe(true);
  });
});

describe('moon rocks', () => {
  const map = [
    '##############',
    '#............#',
    '#............#',
    '#............#',
    '#............#',
    '#............#',
    '#............#',
    '#S..D.......E#',
    '##############',
  ];

  it('bounce you up extra high when you land on them', () => {
    const level = parseLevel({ id: 'm', map });
    const island = new IslandStuff(level);
    const top = { x: at(4, 7).x, y: 7 * TILE - END_RADIUS - 1 };
    const slime = slimeAt(top.x, top.y);
    island.update(1 / 60, slime, 0);
    expect(slime.isFalling).toBe(true);
    expect(slime.falling.vy).toBe(-MOON_ROCK_SPEED);
    // Faster (so higher) than a hammock, all the way up to the ceiling.
    expect(MOON_ROCK_SPEED).toBeGreaterThan(HAMMOCK_SPEED);
    expect(simulateBounce(level, top).y).toBeLessThan(TILE + END_RADIUS + 2);
  });

  it('bounce you down off their bottoms when gravity is flipped', () => {
    const level = parseLevel({ id: 'm', map });
    level.gravity = -1;
    const island = new IslandStuff(level);
    const bottom = { x: at(4, 7).x, y: 7 * TILE - END_RADIUS - 1 };
    // Sitting on top doesn't bounce you upside down...
    const slime = slimeAt(bottom.x, bottom.y);
    island.update(1 / 60, slime, 0);
    expect(slime.isFalling).toBe(false);
    // ...but a rock hanging over you does.
    const hanging = parseLevel({ id: 'm2', map: ['#####', '#.D.#', '#...#', '#S.E#', '#####'] });
    hanging.gravity = -1;
    const under = slimeAt(at(2, 1).x, 2 * TILE + END_RADIUS + 1);
    new IslandStuff(hanging).update(1 / 60, under, 0);
    expect(under.isFalling).toBe(true);
    expect(under.falling.vy).toBe(MOON_ROCK_SPEED);
  });

  it('can be picked up with the tongue, and carrying one halves your reach', () => {
    const level = parseLevel({ id: 'm', map });
    const space = new SpaceStuff(level);
    const tongue = new Tongue();
    const head = { x: at(1, 7).x, y: 8 * TILE - END_RADIUS - 1 };
    tongue.start(head, at(4, 7));
    let grabbed = false;
    for (let t = 0; t < 0.5 && !grabbed; t += 1 / 60) {
      tongue.update(1 / 60, level, head, []);
      grabbed = space.grabRock(tongue.tip);
    }
    expect(grabbed).toBe(true);
    expect(level.tiles[7][4]).toBe(TileKind.EMPTY);
    expect(space.carrying).toBe(0);
    expect(space.reachScale).toBe(CARRY_REACH);
    expect(MAX_STRETCH * space.reachScale).toBe(MAX_STRETCH / 2);
  });

  it('fly in an arc to where you throw them, then poof back home', () => {
    const level = parseLevel({ id: 'm', map });
    const space = new SpaceStuff(level);
    const slime = slimeAt(at(1, 7).x, 8 * TILE - END_RADIUS - 1);
    space.grabRock({ x: at(4, 7).x - 30, y: at(4, 7).y });
    const target = at(9, 6);
    space.throwRock(slime.center, target);
    expect(space.carrying).toBe(null);
    expect(space.reachScale).toBe(1);
    const rock = space.rocks[0];
    let highest = Infinity;
    let passed = false;
    run(space, slime, level, 3, () => {
      highest = Math.min(highest, rock.y);
      passed = passed || Math.hypot(rock.x - target.x, rock.y - target.y) < 12;
    });
    // It went up in an arc first, then right through where you aimed.
    expect(highest).toBeLessThan(slime.center.y - 20);
    expect(passed).toBe(true);
    expect(rock.state).toBe('home');
    expect(level.tiles[7][4]).toBe(TileKind.MOON_ROCK);
  });

  it('go back home if you die while carrying one', () => {
    const level = parseLevel({ id: 'm', map });
    const space = new SpaceStuff(level);
    space.grabRock({ x: at(4, 7).x - 30, y: at(4, 7).y });
    space.resetAfterDeath();
    expect(space.carrying).toBe(null);
    run(space, slimeAt(at(1, 7).x, 8 * TILE - END_RADIUS - 1), level, 1 / 60);
    expect(level.tiles[7][4]).toBe(TileKind.MOON_ROCK);
    expect(space.reachScale).toBe(1);
  });
});
