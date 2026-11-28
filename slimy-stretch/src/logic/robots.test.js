import { describe, expect, it } from 'vitest';
import { isSolidKind, isStickyKind, parseLevel as parseMap, TileKind } from './level.js';
import { Slime } from './slime.js';
import { END_RADIUS, TILE } from './constants.js';
import { solveLevel } from './solver.js';
import { floatingPlatforms, SkyStuff } from './sky.js';
import {
  ALARM_TIME,
  ARM_HOLD,
  ARM_LUNGE,
  ARM_MISS_REST,
  ARM_REACH,
  ARM_REST,
  ARM_WINDUP,
  armSwingSpot,
  armToss,
  BOLT_SPEED,
  clearLine,
  inSearchlight,
  PATROL_SPEED,
  RobotsStuff,
  SNIPER_AIM,
  SNIPER_LOCK,
  SNIPER_REST,
  SPARK_QUIET,
  SPARK_SHOWER,
  SPARK_STAGGER,
  SPARK_WARN,
  sparkBottom,
  sparkState,
  simulateSpring,
  simulateToss,
  TUBE_SPEED,
  weldingTorches,
} from './robots.js';

/** Little test maps don't all need an exit door. */
function parseLevel(def) {
  return parseMap(def.map.some(r => r.includes('E')) ? def : { ...def, type: 'boss' });
}

function slimeAt(x, y) {
  const slime = new Slime({ x, y });
  slime.falling = null;
  return slime;
}

/** Middle of tile (col, row), in pixels. */
const at = (col, row) => ({ x: (col + 0.5) * TILE, y: (row + 0.5) * TILE });

/** Where a slime end sits on top of the floor in row `row`, in column `col`. */
const onTop = (col, row) => ({ x: (col + 0.5) * TILE, y: row * TILE - END_RADIUS - 1 });

/** Run the slime and the robots together; returns the hurts. */
function run(robots, slime, level, seconds, sky = null) {
  const hurts = [];
  let t = robots.time;
  for (let k = 0; k < Math.round(seconds * 60); k++) {
    t += 1 / 60;
    if (sky) {
      sky.update(1 / 60, slime, [], t);
    }
    slime.update(1 / 60, level);
    const h = robots.update(1 / 60, slime, t);
    if (h) {
      hurts.push(h);
    }
  }
  return hurts;
}

const types = robots => robots.takeEvents().map(e => e.type);

describe('robot factory map characters', () => {
  it('parses robot arms, welding torches, patrol robots, alarm doors, snipers and springs', () => {
    const level = parseLevel({
      id: 't',
      map: ['###"####', '#S(5]6,#', '########'],
      springs: ['up-right'],
    });
    expect(level.robotArms).toEqual([{ ...at(2, 1), col: 2, row: 1 }]);
    expect(level.torches).toEqual([{ ...at(3, 0), col: 3, row: 0 }]);
    expect(level.patrols).toEqual([{ ...at(3, 1), col: 3, row: 1 }]);
    expect(level.alarmDoors).toEqual([{ col: 4, row: 1 }]);
    expect(level.snipers).toEqual([{ ...at(5, 1), col: 5, row: 1 }]);
    expect(level.springs[0]).toMatchObject({ ...at(6, 1), col: 6, row: 1, dir: 'up-right' });
    // Welding torches are part of the ceiling; the rest stand in open space.
    expect(level.tiles[0][3]).toBe(TileKind.WALL);
    for (let col = 2; col <= 6; col++) {
      expect(level.tiles[1][col]).toBe(TileKind.EMPTY);
    }
    // A slammed alarm door is solid, but too slippery to stick to.
    expect(isSolidKind(TileKind.ALARM_DOOR)).toBe(true);
    expect(isStickyKind(TileKind.ALARM_DOOR)).toBe(false);
  });

  it('points spring pads up unless the level says otherwise, and catches mistakes', () => {
    const map = ['######', '#S,.,#', '######'];
    const level = parseLevel({ id: 't', map, springs: ['left'] });
    expect(level.springs.map(s => s.dir)).toEqual(['left', 'up']);
    expect(level.springs[0].angle).toBeCloseTo(Math.PI);
    expect(() => parseLevel({ id: 't', map, springs: ['sideways'] })).toThrow(/spring direction/);
    expect(() => parseLevel({ id: 't', map, springs: ['up', 'up', 'up'] })).toThrow(/more/);
  });

  it('makes robot helpers and lifts floating platforms', () => {
    const platforms = floatingPlatforms({
      lifts: [{ col: 4, from: 9, to: 2 }],
      helpers: [{ at: [3, 7], to: 10 }],
    });
    expect(platforms).toEqual([
      { from: [4, 9], to: [4, 2], width: 2, speed: 70, lift: true },
      { from: [3, 7], to: [10, 7], width: 1, speed: 50, helper: true },
    ]);
  });
});

describe('robot arms', () => {
  const map = [
    '##############',
    '#............#',
    '#............#',
    '#............#',
    '#S.....(.....#',
    '##############',
  ];

  it('winds up when you come near, then grabs you and tosses you away', () => {
    const level = parseLevel({ id: 't', map, arms: [{ toss: 'up-left' }] });
    const robots = new RobotsStuff(level);
    const far = slimeAt(onTop(2, 5).x, onTop(2, 5).y);
    run(robots, far, level, 1);
    // Too far away: nothing happens.
    expect(robots.arms[0].state).toBe('idle');
    const slime = slimeAt(onTop(5, 5).x, onTop(5, 5).y);
    run(robots, slime, level, 1 / 60);
    expect(robots.arms[0].state).toBe('windup');
    expect(types(robots)).toContain('armWindup');
    // A warning first: it doesn't grab you yet.
    run(robots, slime, level, ARM_WINDUP - 0.1);
    expect(slime.frozen).toBe(false);
    run(robots, slime, level, 0.1 + ARM_LUNGE);
    expect(robots.arms[0].state).toBe('hold');
    expect(robots.inArm).toBe(0);
    expect(slime.frozen).toBe(true);
    expect(types(robots)).toContain('armGrab');
    run(robots, slime, level, ARM_HOLD + 0.05);
    // WHEE! Tossed up and to the left, sticking to the first sticky thing it hits.
    expect(types(robots)).toContain('armToss');
    expect(slime.isFalling).toBe(true);
    expect(slime.falling.vx).toBeLessThan(0);
    expect(slime.falling.vy).toBeLessThan(0);
    expect(robots.arms[0].state).toBe('rest');
    run(robots, slime, level, 2);
    expect(slime.isFalling).toBe(false);
    expect(slime.center.x).toBeLessThan(at(7, 4).x);
  });

  it('misses if you move away during the wind-up, then rests', () => {
    const level = parseLevel({ id: 't', map });
    const robots = new RobotsStuff(level);
    const slime = slimeAt(onTop(5, 5).x, onTop(5, 5).y);
    run(robots, slime, level, 1 / 60);
    expect(robots.arms[0].state).toBe('windup');
    // Scoot away!
    slime.spawn(onTop(1, 5));
    slime.falling = null;
    run(robots, slime, level, ARM_WINDUP + ARM_LUNGE + 0.05);
    expect(types(robots)).toContain('armMiss');
    expect(slime.frozen).toBe(false);
    expect(robots.arms[0].state).toBe('rest');
    // While it rests you can sneak right past it.
    slime.spawn(onTop(6, 5));
    slime.falling = null;
    run(robots, slime, level, ARM_MISS_REST - 0.2);
    expect(robots.arms[0].state).toBe('rest');
    run(robots, slime, level, 0.4);
    expect(robots.arms[0].state).not.toBe('rest');
  });

  it('rests longer after a toss', () => {
    expect(ARM_REST).toBeGreaterThan(ARM_MISS_REST);
  });

  it("can't reach through walls or farther than its reach", () => {
    const level = parseLevel({
      id: 't',
      map: ['##########', '#S..#(...#', '##########'],
    });
    const robots = new RobotsStuff(level);
    const slime = slimeAt(onTop(3, 2).x, onTop(3, 2).y);
    run(robots, slime, level, 1);
    expect(robots.arms[0].state).toBe('idle');
    expect(clearLine(level, at(3, 1), at(5, 1))).toBe(false);
    expect(ARM_REACH).toBeLessThan(3 * TILE);
  });

  it('tosses the way the level says, at its speed, and the toss can be simulated', () => {
    const level = parseLevel({ id: 't', map, arms: [{ toss: 'right', speed: 500 }] });
    const toss = armToss(level, 0);
    expect(toss).toMatchObject({ dir: 'right', speed: 500, x: 1, y: 0 });
    expect(armToss(parseLevel({ id: 't', map }), 0)).toMatchObject({ dir: 'up', speed: 750 });
    // A toss to the right lands against the right wall.
    const spot = armSwingSpot(level, level.robotArms[0], toss);
    const landing = simulateToss(level, spot, toss);
    expect(landing.x).toBeGreaterThan(level.robotArms[0].x + TILE);
  });

  it('lets go if something else grabs the slime, and smashed arms stop working', () => {
    const level = parseLevel({ id: 't', map });
    const robots = new RobotsStuff(level);
    const slime = slimeAt(onTop(5, 5).x, onTop(5, 5).y);
    run(robots, slime, level, ARM_WINDUP + ARM_LUNGE + 0.02);
    expect(robots.inArm).toBe(0);
    // Something else lets go of the slime (like splitting in two).
    slime.frozen = false;
    run(robots, slime, level, 1 / 60);
    expect(robots.inArm).toBe(null);
    expect(robots.arms[0].state).toBe('rest');
    const rect = { left: at(7, 4).x - 30, right: at(7, 4).x + 30, top: 150, bottom: 230 };
    expect(robots.smashRobots(rect)).toBe(1);
    expect(robots.arms[0].broken).toBe(true);
    robots.arms[0].state = 'idle';
    run(robots, slimeAt(onTop(6, 5).x, onTop(6, 5).y), level, 2);
    expect(robots.arms[0].state).toBe('idle');
  });
});

describe('welding torches', () => {
  const map = ['#"#"##', '#....#', '#S...#', '######'];

  it('stays quiet, glows as a warning, then showers sparks, taking turns', () => {
    const level = parseLevel({ id: 't', map });
    const [a, b] = weldingTorches(level);
    expect(sparkState(a, 0)).toBe('quiet');
    expect(sparkState(a, SPARK_QUIET + 0.1)).toBe('warn');
    expect(sparkState(a, SPARK_QUIET + SPARK_WARN + 0.1)).toBe('shower');
    const period = SPARK_QUIET + SPARK_WARN + SPARK_SHOWER;
    expect(sparkState(a, period + 0.1)).toBe('quiet');
    // The second torch is a bit later.
    expect(b.offset).toBeCloseTo(SPARK_STAGGER);
    expect(sparkState(b, SPARK_QUIET - SPARK_STAGGER + 0.1)).toBe('warn');
    // A level can change how long a torch stays quiet.
    const slow = weldingTorches({ ...level, def: { ...level.def, sparkTimings: [{ quiet: 5 }] } });
    expect(slow[0].quiet).toBe(5);
    expect(sparkState(slow[0], 4)).toBe('quiet');
  });

  it('showers straight down to the first solid thing, and the sparks hurt', () => {
    const level = parseLevel({ id: 't', map });
    expect(sparkBottom(level, level.torches[0])).toBe(3 * TILE);
    const robots = new RobotsStuff(level);
    const under = slimeAt(onTop(1, 3).x, onTop(1, 3).y);
    const hurts = run(robots, under, level, SPARK_QUIET + SPARK_WARN - 0.05);
    expect(hurts).toEqual([]);
    expect(types(robots)).toContain('sparkWarn');
    expect(run(robots, under, level, 0.2)).toContain('sparks');
    expect(types(robots)).toContain('sparks');
    // Off to the side you're fine.
    const robots2 = new RobotsStuff(level);
    const beside = slimeAt(onTop(2, 3).x, onTop(2, 3).y);
    expect(run(robots2, beside, level, SPARK_QUIET + SPARK_WARN + 0.5)).toEqual([]);
  });
});

describe('patrol robots and alarm doors', () => {
  const map = ['################', '#..............#', '#S.......5..]..#', '################'];

  it('walks back and forth along its floor', () => {
    const level = parseLevel({ id: 't', map });
    const robots = new RobotsStuff(level);
    const slime = slimeAt(onTop(14, 3).x, 60);
    slime.frozen = true; // out of sight
    const x0 = robots.patrols[0].x;
    run(robots, slime, level, 1);
    expect(robots.patrols[0].x).toBeCloseTo(x0 + PATROL_SPEED, 0);
    // It turns around at the wall.
    run(robots, slime, level, 6);
    expect(robots.patrols[0].dir).toBe(-1);
  });

  it('sets off the alarm when its searchlight spots you: the doors slam shut, then open', () => {
    const level = parseLevel({ id: 't', map });
    const robots = new RobotsStuff(level);
    const p = robots.patrols[0];
    // Right in front of it, in the beam.
    const slime = slimeAt(p.x + 90, onTop(0, 3).y);
    expect(inSearchlight(level, p, 0, slime.center)).toBe(true);
    // Behind it: it can't see you.
    expect(inSearchlight(level, p, 0, { x: p.x - 90, y: slime.center.y })).toBe(false);
    run(robots, slime, level, 1 / 60);
    expect(types(robots)).toEqual(expect.arrayContaining(['alarm', 'doorSlam']));
    expect(robots.alarm).toBeGreaterThan(0);
    expect(level.tiles[2][12]).toBe(TileKind.ALARM_DOOR);
    // It never hurts you.
    expect(run(robots, slime, level, ALARM_TIME - 0.5)).toEqual([]);
    expect(level.tiles[2][12]).toBe(TileKind.ALARM_DOOR);
    run(robots, slime, level, 0.6);
    expect(types(robots)).toContain('alarmOff');
    expect(level.tiles[2][12]).toBe(TileKind.EMPTY);
  });

  it("doesn't slam a door on the slime: it waits until the slime is out of the way", () => {
    const level = parseLevel({ id: 't', map });
    const robots = new RobotsStuff(level);
    const slime = slimeAt(at(12, 2).x, onTop(12, 3).y);
    robots.soundAlarm(robots.patrols[0], slime);
    expect(level.tiles[2][12]).toBe(TileKind.EMPTY);
    slime.spawn(onTop(14, 3));
    slime.falling = null;
    run(robots, slime, level, 0.1);
    expect(level.tiles[2][12]).toBe(TileKind.ALARM_DOOR);
  });

  it("can't see through walls, and the alarm stops when you lose a life", () => {
    const level = parseLevel({
      id: 't',
      map: ['############', '#S.5..#....#', '############'],
    });
    const robots = new RobotsStuff(level);
    const p = robots.patrols[0];
    expect(inSearchlight(level, p, 0, { x: at(8, 1).x, y: at(8, 1).y })).toBe(false);
    const open = parseLevel({ id: 't', map });
    const r2 = new RobotsStuff(open);
    r2.soundAlarm(r2.patrols[0], slimeAt(onTop(1, 3).x, onTop(1, 3).y));
    r2.resetAfterDeath();
    expect(r2.alarm).toBe(0);
    expect(open.tiles[2][12]).toBe(TileKind.EMPTY);
  });

  it('treats alarm doors as open in the level checker (you can wait for the alarm)', () => {
    const level = parseMap({
      id: 't',
      map: ['########', '#......#', '#S.5]E.#', '########'],
    });
    expect(solveLevel(level).exit).toBe(true);
  });
});

describe('sniper robots', () => {
  const map = ['##############', '#............#', '#S.........6.#', '##############'];

  it('puts a red dot on you, follows you, locks on, then fires a bolt where you were', () => {
    const level = parseLevel({ id: 't', map });
    const robots = new RobotsStuff(level);
    const slime = slimeAt(onTop(5, 3).x, onTop(5, 3).y);
    run(robots, slime, level, 1 / 60);
    const s = robots.snipers[0];
    expect(s.state).toBe('aim');
    expect(types(robots)).toContain('sniperAim');
    // The dot follows you around.
    slime.spawn(onTop(4, 3));
    slime.falling = null;
    run(robots, slime, level, 0.2);
    expect(s.dot.x).toBeCloseTo(slime.center.x);
    run(robots, slime, level, SNIPER_AIM - 0.2);
    expect(s.state).toBe('lock');
    run(robots, slime, level, SNIPER_LOCK + 0.02);
    expect(types(robots)).toContain('sniperFire');
    expect(robots.bolts).toHaveLength(1);
    expect(Math.hypot(robots.bolts[0].vx, robots.bolts[0].vy)).toBeCloseTo(BOLT_SPEED);
    // Standing still, the bolt gets you.
    expect(run(robots, slime, level, 1)).toContain('sniper');
    expect(s.timer).toBeGreaterThan(SNIPER_REST - 1.5);
  });

  it('misses if you move away after it locks on', () => {
    const level = parseLevel({
      id: 't',
      map: [
        '##############',
        '#............#',
        '#............#',
        '#S.........6.#',
        '##############',
      ],
    });
    const robots = new RobotsStuff(level);
    const slime = slimeAt(onTop(4, 4).x, onTop(4, 4).y);
    run(robots, slime, level, SNIPER_AIM + 0.05);
    expect(robots.snipers[0].state).toBe('lock');
    // Dodge! Up onto the ceiling.
    const ceiling = { x: onTop(4, 4).x, y: TILE + END_RADIUS + 1 };
    const hurts = [];
    for (let k = 0; k < 90; k++) {
      for (const e of slime.ends) {
        Object.assign(e, ceiling);
      }
      const h = robots.update(1 / 60, slime);
      if (h) {
        hurts.push(h);
      }
    }
    expect(hurts).toEqual([]);
    expect(types(robots)).toContain('boltHit');
  });

  it("can't see you behind a wall or too far away, and stops aiming when it loses you", () => {
    const level = parseLevel({
      id: 't',
      map: ['##############', '#S...#.....6.#', '##############'],
    });
    const robots = new RobotsStuff(level);
    run(robots, slimeAt(onTop(2, 2).x, onTop(2, 2).y), level, 2);
    expect(robots.snipers[0].state).toBe('idle');
    const open = parseLevel({ id: 't', map });
    const r2 = new RobotsStuff(open);
    const slime = slimeAt(onTop(5, 3).x, onTop(5, 3).y);
    run(r2, slime, open, 0.2);
    expect(r2.snipers[0].state).toBe('aim');
    slime.frozen = true; // carried off somewhere it can't see
    run(r2, slime, open, 0.5);
    expect(r2.snipers[0].state).toBe('idle');
  });
});

describe('spring pads', () => {
  const map = ['########', '#......#', '#......#', '#......#', '#S.,...#', '########'];

  it('launches you the way it points, sticking to what you hit', () => {
    const level = parseLevel({ id: 't', map });
    const robots = new RobotsStuff(level);
    const slime = slimeAt(onTop(2, 5).x, onTop(2, 5).y);
    slime.ends[1].x = at(3, 4).x - 10;
    run(robots, slime, level, 1 / 60);
    expect(types(robots)).toContain('boing');
    expect(slime.isFalling).toBe(true);
    expect(slime.falling.vy).toBeLessThan(-900);
    // Up to the ceiling, and it sticks there.
    run(robots, slime, level, 1);
    expect(slime.isFalling).toBe(false);
    expect(slime.center.y).toBeLessThan(2 * TILE);
    const landing = simulateSpring(level, level.springs[0]);
    expect(landing.y).toBeCloseTo(slime.center.y, 0);
  });

  it('counts in the level checker like a rocket booster', () => {
    // Only a spring gets you up out of this ice pit.
    const def = {
      id: 't',
      type: 'normal',
      map: [
        '###########',
        '#.......E.#',
        '#....######',
        '#I.....I###',
        '#I.....I###',
        '#I.....I###',
        '#I.....I###',
        '#I.S.,.I###',
        '#IIIIIII###',
      ],
    };
    expect(solveLevel(parseMap(def)).exit).toBe(true);
    const noSpring = { ...def, map: def.map.map(r => r.replace(',', '.')) };
    expect(solveLevel(parseMap(noSpring)).exit).toBe(false);
  });
});

describe('pneumatic tubes', () => {
  const def = {
    id: 't',
    type: 'normal',
    tubes: [
      {
        a: [2, 2],
        b: [8, 2],
        path: [
          [2, 1],
          [8, 1],
        ],
      },
    ],
    map: ['##########', '#....#...#', '#S...#.E.#', '##########'],
  };

  it('sucks you in at one end and shoots you out of the other', () => {
    const level = parseMap(def);
    const robots = new RobotsStuff(level);
    const slime = slimeAt(at(2, 2).x, onTop(2, 3).y);
    run(robots, slime, level, 1 / 60);
    expect(types(robots)).toContain('tubeIn');
    expect(slime.frozen).toBe(true);
    // Whoosh along the tube...
    const length = TILE + 6 * TILE + TILE;
    run(robots, slime, level, length / TUBE_SPEED + 0.1);
    expect(types(robots)).toContain('tubeOut');
    expect(robots.riding).toBe(null);
    run(robots, slime, level, 1);
    expect(slime.center.x).toBeCloseTo(at(8, 2).x, 0);
    // It doesn't suck you straight back in while you're still at the end.
    run(robots, slime, level, 2);
    expect(slime.frozen).toBe(false);
    robots.resetAfterDeath();
    expect(robots.tubes[0].used).toBe(false);
  });

  it('counts in the level checker like a cable', () => {
    expect(solveLevel(parseMap(def)).exit).toBe(true);
    expect(solveLevel(parseMap({ ...def, tubes: [] })).exit).toBe(false);
  });
});

describe('robot helpers and lifts', () => {
  it('a robot helper carries a slime stuck on top along the floor', () => {
    const level = parseLevel({
      id: 't',
      helpers: [{ at: [2, 2], to: 8 }],
      map: ['###########', '#.........#', '#S........#', '#IIIIIIIII#', '###########'],
    });
    const sky = new SkyStuff(level);
    const robots = new RobotsStuff(level, sky);
    expect(robots.helpers).toHaveLength(1);
    expect(level.tiles[2][2]).toBe(TileKind.SKY_ISLAND);
    const slime = slimeAt(onTop(2, 2).x, onTop(2, 2).y);
    run(robots, slime, level, 8, sky);
    expect(slime.center.x).toBeGreaterThan(at(6, 2).x);
    expect(slime.isFalling).toBe(false);
  });

  it('the level checker rides helpers across slippery floors and lifts up shafts', () => {
    const def = {
      id: 't',
      type: 'normal',
      helpers: [{ at: [3, 3], to: 10 }],
      map: [
        '##############',
        '#............#',
        '#............#',
        '#S...........E',
        '###IIIIIIIII##',
        '##############',
      ],
    };
    const ice = { ...def, map: def.map.map((r, i) => (i === 1 ? '#IIIIIIIIIIII#' : r)) };
    const solve = d => solveLevel(parseMap(d)).exit;
    expect(solve(ice)).toBe(true);
    expect(solve({ ...ice, helpers: [] })).toBe(false);
    const shaft = {
      id: 't',
      type: 'normal',
      lifts: [{ col: 2, from: 6, to: 2 }],
      map: [
        '#########',
        '#I.....E#',
        '#I..I####',
        '#I..I####',
        '#I..I####',
        '#I..I####',
        '#S..I####',
        '#########',
      ],
    };
    expect(solve(shaft)).toBe(true);
    expect(solve({ ...shaft, lifts: [] })).toBe(false);
    const level = parseMap(shaft);
    expect(new RobotsStuff(level, new SkyStuff(level)).lifts).toHaveLength(1);
  });
});
