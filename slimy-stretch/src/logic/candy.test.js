import { describe, expect, it } from 'vitest';
import {
  isBouncyKind,
  isDeadlyKind,
  isPlatformKind,
  isSolidKind,
  isStickyKind,
  parseLevel as parseMap,
  TileKind,
} from './level.js';
import { Slime } from './slime.js';
import { findHazard } from './hazards.js';
import { END_RADIUS, TILE } from './constants.js';
import { solveLevel } from './solver.js';
import { IslandStuff, simulateBounce } from './island.js';
import {
  CANE_PERIOD,
  CandyStuff,
  CARAMEL_HOLD,
  GUMBALL_EVERY,
  GUMBALL_WARN,
  LOLLIPOP_BOOST,
  LOLLIPOP_REGROW,
  LOLLIPOP_TIME,
  MARSH_BOUNCE,
  MARSH_SQUISH_TIME,
  MELT_TIME,
  REFREEZE_TIME,
  ROPE_SPEED,
  ropeDrop,
  SOUR_EVERY,
  SOUR_RAIN,
  SOUR_WARN,
  sourState,
} from './candy.js';

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

/** Run the slime and the candy stuff together; returns the hurts that happened. */
function run(candy, slime, level, seconds, extra = () => {}) {
  const hurts = [];
  let time = candy.time;
  for (let t = 0; t < seconds; t += 1 / 60) {
    time += 1 / 60;
    slime.update(1 / 60, level);
    const h = candy.update(1 / 60, slime, time);
    extra();
    if (h) {
      hurts.push(h);
    }
  }
  return hurts;
}

/** Run until `done()` is true (or `max` seconds pass). */
function runUntil(candy, slime, level, done, max = 5, extra = () => {}) {
  for (let t = 0; t < max && !done(); t += 1 / 60) {
    run(candy, slime, level, 1 / 60, extra);
  }
}

/** Drag the end nearest `from` to `to`, hold it a moment, and let go. */
function stretchTo(slime, level, candy, from, to) {
  expect(slime.grab(from)).toBe(true);
  slime.moveFinger(to);
  run(candy, slime, level, 0.4);
  slime.release(level);
}

describe('candy map characters', () => {
  const level = parseLevel({
    id: 'candy-chars',
    map: ['##########', '#w..|..:.#', '#......:.#', '#.9....:.#', '#S.iyt8j.#', '##hhh#####'],
  });

  it('turns each character into the right kind of tile', () => {
    expect(level.tiles[5][2]).toBe(TileKind.CHOCOLATE);
    expect(level.tiles[4][3]).toBe(TileKind.ICE_CREAM);
    expect(level.tiles[4][4]).toBe(TileKind.GUMDROP);
    expect(level.tiles[4][5]).toBe(TileKind.CARAMEL);
    expect(level.tiles[4][6]).toBe(TileKind.MARSHMALLOW);
    expect(level.tiles[4][7]).toBe(TileKind.GUMBALL);
    expect(level.tiles[1][1]).toBe(TileKind.SOUR_CLOUD);
    // Candy canes, licorice and lollipops aren't tiles.
    expect(level.tiles[1][4]).toBe(TileKind.EMPTY);
    expect(level.tiles[1][7]).toBe(TileKind.EMPTY);
    expect(level.tiles[3][2]).toBe(TileKind.EMPTY);
  });

  it('knows what each candy tile does', () => {
    expect(isDeadlyKind(TileKind.CHOCOLATE)).toBe(true);
    expect(isSolidKind(TileKind.CHOCOLATE)).toBe(false);
    for (const kind of [TileKind.CARAMEL, TileKind.GUMDROP, TileKind.MARSHMALLOW]) {
      expect(isSolidKind(kind)).toBe(true);
      expect(isStickyKind(kind)).toBe(true);
    }
    expect(isStickyKind(TileKind.GUMBALL)).toBe(true);
    expect(isBouncyKind(TileKind.GUMDROP)).toBe(true);
    expect(isBouncyKind(TileKind.MARSHMALLOW)).toBe(false);
    // Ice cream is a one-way platform; sour clouds are slippery.
    expect(isPlatformKind(TileKind.ICE_CREAM)).toBe(true);
    expect(isSolidKind(TileKind.SOUR_CLOUD)).toBe(true);
    expect(isStickyKind(TileKind.SOUR_CLOUD)).toBe(false);
  });

  it('finds the candy things', () => {
    expect(level.candyCanes).toHaveLength(1);
    expect(level.lollipops).toHaveLength(1);
    expect(level.gumballMachines).toHaveLength(1);
    // A column of licorice is one rope.
    expect(level.ropes).toEqual([{ col: 7, x: 7.5 * TILE, top: TILE, bottom: 4 * TILE }]);
  });
});

describe('chocolate rivers', () => {
  const def = {
    id: 'choc',
    map: [
      '..............',
      '..............',
      '..............',
      '.S..........E.',
      '#####hhhh#####',
      '#####hhhh#####',
    ],
  };

  it('are deadly to touch', () => {
    const level = parseLevel(def);
    const slime = slimeAt(at(6, 4).x, at(6, 4).y - 10);
    expect(findHazard(level, slime, [], 0, null)).toBe('fluid');
  });

  it("can't be crossed if they're too wide to stretch over", () => {
    const narrow = parseLevel({ ...def, map: def.map.map(r => r.replace('hhhh', 'hhh#')) });
    expect(solveLevel(narrow).exit).toBe(true);
    const wide = parseLevel({
      ...def,
      map: def.map.map(r => r.replace('#####hhhh', '##hhhhhhh')),
    });
    expect(solveLevel(wide).exit).toBe(false);
  });
});

describe('sticky caramel', () => {
  const def = {
    id: 'caramel',
    map: ['##########', '#........#', '#........#', '#S.......#', '##tttt####', '##########'],
  };

  it('holds a slime that lands on it still for a few seconds, then lets go', () => {
    const level = parseLevel(def);
    const candy = new CandyStuff(level);
    const slime = new Slime(at(3, 2));
    const events = [];
    const collect = () => events.push(...candy.takeEvents());
    runUntil(candy, slime, level, () => !slime.isFalling, 2, collect);
    run(candy, slime, level, 0.05, collect);
    expect(events.map(e => e.type)).toContain('caramel');
    expect(slime.glued).toBe(true);
    // You can't stretch while the caramel holds you.
    expect(slime.grab(at(5, 3))).toBe(false);
    run(candy, slime, level, CARAMEL_HOLD - 0.3);
    expect(slime.glued).toBe(true);
    run(candy, slime, level, 0.5, collect);
    expect(slime.glued).toBe(false);
    expect(events.map(e => e.type)).toContain('caramelFree');
    expect(slime.grab(at(5, 3))).toBe(true);
  });

  it('catches the end you stretch onto it, but not an end boinging back after a miss', () => {
    const level = parseLevel(def);
    const candy = new CandyStuff(level);
    const slime = slimeAt(onTop(7, 4).x, onTop(7, 4).y);
    run(candy, slime, level, 0.2);
    expect(slime.glued).toBe(false);
    // Stretch over onto the caramel: stuck!
    stretchTo(slime, level, candy, onTop(7, 4), onTop(5, 4));
    run(candy, slime, level, 0.1);
    expect(slime.glued).toBe(true);
    run(candy, slime, level, CARAMEL_HOLD + 0.1);
    expect(slime.glued).toBe(false);
    // Bring the other end over too, then miss a stretch up into the air: the
    // end boings back onto the caramel, but that doesn't catch you again.
    stretchTo(slime, level, candy, onTop(7, 4), onTop(4, 4));
    run(candy, slime, level, CARAMEL_HOLD + 0.2);
    expect(slime.glued).toBe(false);
    stretchTo(slime, level, candy, onTop(4, 4), at(4, 1.6));
    expect(slime.ends.some(e => e.state === 'snapping')).toBe(true);
    run(candy, slime, level, 0.5);
    expect(slime.ends.every(e => e.state === 'stuck')).toBe(true);
    expect(slime.glued).toBe(false);
  });

  it('lets go if the slime is knocked loose', () => {
    const level = parseLevel(def);
    const candy = new CandyStuff(level);
    const slime = new Slime(at(3, 2));
    run(candy, slime, level, 0.6);
    expect(slime.glued).toBe(true);
    slime.knockLoose(0, -300);
    run(candy, slime, level, 0.05);
    expect(candy.caramel).toBe(0);
    expect(slime.glued).toBe(false);
  });

  it('is just a normal sticky spot to the level checker', () => {
    const level = parseLevel({
      id: 'caramel-solve',
      map: ['........', '.S....E.', '###tt###'],
    });
    expect(solveLevel(level).exit).toBe(true);
  });
});

describe('bouncy gumdrops', () => {
  const def = {
    id: 'gumdrop',
    map: [
      '##########',
      '#........#',
      '#........#',
      '#........#',
      '#........#',
      '#........#',
      '#S..y....#',
      '##########',
    ],
  };

  it('bounce a slime sitting on top up high, like a hammock', () => {
    const level = parseLevel(def);
    const island = new IslandStuff(level);
    const slime = slimeAt(onTop(4, 6).x, onTop(4, 6).y);
    island.update(1 / 60, slime, 0);
    expect(slime.isFalling).toBe(true);
    expect(slime.falling.vy).toBeLessThan(-900);
    const landing = simulateBounce(level, onTop(4, 6));
    // Up to the ceiling, where it sticks.
    expect(landing.y).toBeLessThan(2 * TILE);
  });

  it('let the level checker reach things up high', () => {
    // Slippery walls, and a ledge too high to stretch up to.
    const room = {
      id: 'gumdrop-room',
      map: [
        '##########',
        'I...E....I',
        'I..###...I',
        'I........I',
        'I........I',
        'I........I',
        'I........I',
        'I........I',
        'IS..y....I',
        '##########',
      ],
    };
    expect(solveLevel(parseLevel(room)).exit).toBe(true);
    const noGumdrop = { ...room, map: room.map.map(r => r.replace('y', '.')) };
    expect(solveLevel(parseLevel(noGumdrop)).exit).toBe(false);
  });
});

describe('marshmallows', () => {
  const def = {
    id: 'marsh',
    map: ['IIIIIIIIII', 'I........I', 'I........I', 'I........I', 'I.......SI', 'II888#####'],
  };

  it('squish down while you sit on them, then spring you up a little', () => {
    const level = parseLevel(def);
    const candy = new CandyStuff(level);
    const slime = slimeAt(onTop(3, 5).x, onTop(3, 5).y);
    run(candy, slime, level, MARSH_SQUISH_TIME / 2);
    const m = candy.marshmallows[0];
    expect(candy.squish(m)).toBeGreaterThan(0.4);
    expect(candy.squish(m)).toBeLessThan(0.6);
    expect(slime.isFalling).toBe(false);
    const events = [];
    let launched = null;
    run(candy, slime, level, MARSH_SQUISH_TIME / 2 + 0.05, () => {
      events.push(...candy.takeEvents());
      if (slime.isFalling && !launched) {
        launched = { ...slime.falling };
      }
    });
    expect(events.map(e => e.type)).toContain('spring');
    expect(launched.vy).toBeCloseTo(-MARSH_BOUNCE, -1);
    // It only goes up a little way (about 2.5 tiles), then lands back down.
    let top = Infinity;
    run(candy, slime, level, 0.4, () => {
      top = Math.min(top, slime.center.y);
    });
    expect(onTop(3, 5).y - top).toBeGreaterThan(1.5 * TILE);
    expect(onTop(3, 5).y - top).toBeLessThan(3 * TILE);
  });

  it("don't spring while you're in the middle of a stretch, and puff back up when you leave", () => {
    const level = parseLevel(def);
    const candy = new CandyStuff(level);
    const slime = slimeAt(onTop(3, 5).x, onTop(3, 5).y);
    slime.ends[1].x = onTop(5, 5).x;
    slime.grab(onTop(5, 5));
    slime.moveFinger(at(6, 4));
    run(candy, slime, level, MARSH_SQUISH_TIME + 0.3);
    expect(slime.isFalling).toBe(false);
    expect(candy.squish(candy.marshmallows[0])).toBe(1);
    // Let go, and boing! Now it springs you up.
    slime.release(level);
    run(candy, slime, level, 0.05);
    expect(slime.isFalling).toBe(true);
  });

  it('springs back up once nobody is sitting on it', () => {
    const level = parseLevel(def);
    const candy = new CandyStuff(level);
    const slime = slimeAt(onTop(3, 5).x, onTop(3, 5).y);
    run(candy, slime, level, 1);
    expect(candy.squish(candy.marshmallows[0])).toBeGreaterThan(0.5);
    slime.holdAt(at(8, 4).x, onTop(8, 5).y);
    slime.frozen = false;
    run(candy, slime, level, 0.5);
    expect(candy.squish(candy.marshmallows[0])).toBe(0);
  });

  it('give the level checker a little bounce', () => {
    // From the marshmallow pit (with icy walls) only the spring reaches the ledge.
    const pit = {
      id: 'marsh-pit',
      map: [
        'IIIIIIII',
        'I......I',
        'I...E..I',
        'I..###.I',
        'I......I',
        'I......I',
        'I......I',
        'I......I',
        'I.S....I',
        'I8888888',
      ],
    };
    expect(solveLevel(parseLevel(pit)).exit).toBe(true);
    const noSpring = { ...pit, map: pit.map.map(r => r.replace(/8/g, 'I')) };
    expect(solveLevel(parseLevel(noSpring)).exit).toBe(false);
  });
});

describe('licorice ropes', () => {
  const def = {
    id: 'rope',
    map: [
      '##########',
      '#.....:..#',
      '#S....:..#',
      '###...:..#',
      '###...:..#',
      '###......#',
      '###......#',
      '##########',
    ],
  };

  it('slide you down to the bottom and drop you off', () => {
    const level = parseLevel(def);
    const candy = new CandyStuff(level);
    const rope = candy.ropes[0];
    const slime = slimeAt(onTop(2, 3).x, onTop(2, 3).y);
    // Stretch over to touch the rope.
    slime.grab(slime.ends[0]);
    slime.moveFinger({ x: rope.x - 10, y: 2.6 * TILE });
    const events = [];
    runUntil(
      candy,
      slime,
      level,
      () => candy.onRope !== null,
      1,
      () => events.push(...candy.takeEvents())
    );
    expect(events.map(e => e.type)).toContain('ropeGrab');
    expect(slime.frozen).toBe(true);
    expect(slime.center.x).toBe(rope.x);
    // It slides down at ROPE_SPEED...
    const y0 = slime.center.y;
    run(candy, slime, level, 0.2);
    expect(slime.center.y - y0).toBeCloseTo(ROPE_SPEED * 0.2, -1);
    // ...and lets go at the bottom, so you drop down to the floor.
    run(candy, slime, level, 2, () => events.push(...candy.takeEvents()));
    expect(events.map(e => e.type)).toContain('ropeDrop');
    expect(candy.onRope).toBe(null);
    expect(slime.frozen).toBe(false);
    expect(slime.isFalling).toBe(false);
    expect(Math.abs(slime.center.y - onTop(6, 7).y)).toBeLessThan(2);
    expect(ropeDrop(rope).y).toBeLessThan(rope.bottom);
  });

  it("doesn't catch you again until you've got off it", () => {
    const level = parseLevel({
      id: 'rope-floor',
      map: ['######', '#S.:.#', '#..:.#', '######'],
    });
    const candy = new CandyStuff(level);
    const slime = new Slime(at(3, 1));
    let grabs = 0;
    run(candy, slime, level, 3, () => {
      grabs += candy.takeEvents().filter(e => e.type === 'ropeGrab').length;
    });
    // Dropped in on it, it slides you to the floor once, and that's it.
    expect(grabs).toBe(1);
    expect(slime.frozen).toBe(false);
  });

  it('let the level checker get down a slippery shaft', () => {
    const shaft = {
      id: 'rope-shaft',
      map: [
        '##########',
        '#S...:...#',
        '####I:..I#',
        '####I:..I#',
        '####I:..I#',
        '####I:..I#',
        '####I...I#',
        '####IE..I#',
        '##########',
      ],
    };
    expect(solveLevel(parseLevel(shaft)).exit).toBe(true);
    const noRope = { ...shaft, map: shaft.map.map(r => r.replace(/:/g, '.')) };
    expect(solveLevel(parseLevel(noRope)).exit).toBe(false);
  });
});

describe('lollipops', () => {
  const level = parseLevel({ id: 'lolly', map: ['#######', '#S.9..#', '#######'] });

  it('make you stretch farther for a while when you lick one, then grow back', () => {
    const candy = new CandyStuff(level);
    const lolly = candy.lollipops[0];
    const slime = slimeAt(onTop(1, 2).x, onTop(1, 2).y);
    expect(candy.reachScale).toBe(1);
    expect(candy.lick({ x: lolly.x - 60, y: lolly.y })).toBe(false);
    expect(candy.lick({ x: lolly.x - 20, y: lolly.y })).toBe(true);
    expect(candy.reachScale).toBe(LOLLIPOP_BOOST);
    expect(lolly.state).toBe('gone');
    // A gone lollipop can't be licked again.
    expect(candy.lick({ x: lolly.x, y: lolly.y })).toBe(false);
    run(candy, slime, level, LOLLIPOP_TIME - 0.2);
    expect(candy.reachScale).toBe(LOLLIPOP_BOOST);
    run(candy, slime, level, 0.4);
    expect(candy.reachScale).toBe(1);
    run(candy, slime, level, LOLLIPOP_REGROW - LOLLIPOP_TIME);
    expect(lolly.state).toBe('ready');
  });
});

describe('ice cream scoops', () => {
  const def = {
    id: 'scoop',
    map: ['########', '#......#', '#......#', '#.iii..#', '#......#', '#....S.#', '########'],
  };

  it('melt if you sit on them too long, then freeze back', () => {
    const level = parseLevel(def);
    const candy = new CandyStuff(level);
    const slime = slimeAt(onTop(3, 3).x, onTop(3, 3).y);
    run(candy, slime, level, MELT_TIME - 0.2);
    expect(slime.isFalling).toBe(false);
    // You sink in a little as it melts.
    expect(slime.center.y).toBeGreaterThan(onTop(3, 3).y + 4);
    expect(candy.melt(candy.scoops[0])).toBeGreaterThan(0.8);
    run(candy, slime, level, 0.3);
    expect(level.tiles[3][3]).toBe(TileKind.EMPTY);
    // Splat, down to the floor.
    run(candy, slime, level, 1);
    expect(slime.isFalling).toBe(false);
    expect(Math.abs(slime.center.y - onTop(3, 6).y)).toBeLessThan(2);
    run(candy, slime, level, REFREEZE_TIME);
    expect(level.tiles[3][3]).toBe(TileKind.ICE_CREAM);
    expect(candy.scoops[0].state).toBe('frozen');
  });

  it("can't freeze back while the slime is in the way", () => {
    const level = parseLevel(def);
    const candy = new CandyStuff(level);
    const slime = slimeAt(onTop(3, 3).x, onTop(3, 3).y);
    run(candy, slime, level, MELT_TIME + 0.1);
    slime.holdAt(at(3, 3).x, at(3, 3).y);
    run(candy, slime, level, REFREEZE_TIME + 1);
    expect(level.tiles[3][3]).toBe(TileKind.EMPTY);
  });

  it('count as normal platforms for the level checker', () => {
    const level = parseLevel({
      id: 'scoop-solve',
      map: ['..........', '..........', '.S......E.', '###.ii.###', '###hhhh###'],
    });
    expect(solveLevel(level).exit).toBe(true);
  });
});

describe('gumball machines', () => {
  const def = {
    id: 'gumball',
    map: [
      '##############',
      '#............#',
      '#............#',
      '#............#',
      '#.j.........S#',
      '##############',
    ],
  };

  it('rattle, then shoot a gumball at where you were', () => {
    const level = parseLevel(def);
    const candy = new CandyStuff(level);
    const m = candy.machines[0];
    const slime = slimeAt(onTop(7, 5).x, onTop(7, 5).y);
    const events = [];
    run(candy, slime, level, 1.6, () => events.push(...candy.takeEvents()));
    expect(m.state).toBe('warn');
    expect(m.aim.x).toBeCloseTo(slime.center.x, 0);
    expect(events.map(e => e.type)).toContain('rattle');
    const hurts = run(candy, slime, level, GUMBALL_WARN + 1.5);
    expect(hurts).toContain('gumball');
  });

  it("miss if you move while it's rattling", () => {
    const level = parseLevel(def);
    const candy = new CandyStuff(level);
    const slime = slimeAt(onTop(7, 5).x, onTop(7, 5).y);
    run(candy, slime, level, 1.6);
    expect(candy.machines[0].state).toBe('warn');
    // Hop up onto the ceiling, out of the way.
    slime.holdAt(at(9, 1).x, TILE + END_RADIUS + 1);
    slime.frozen = false;
    const hurts = run(candy, slime, level, GUMBALL_WARN + 0.3);
    expect(candy.gumballs).toHaveLength(1);
    expect(hurts).toEqual([]);
  });

  it('bounce off walls a couple of times, then pop', () => {
    const level = parseLevel(def);
    const candy = new CandyStuff(level);
    const slime = slimeAt(-1000, -1000); // far away, so it never shoots on its own
    candy.shoot(candy.machines[0], { x: 12 * TILE, y: 4.5 * TILE });
    const events = [];
    run(candy, slime, level, 6, () => events.push(...candy.takeEvents()));
    expect(events.filter(e => e.type === 'bounce')).toHaveLength(2);
    expect(events.filter(e => e.type === 'pop')).toHaveLength(1);
    expect(candy.gumballs).toHaveLength(0);
  });

  it("don't shoot when you're far away, and wait between shots", () => {
    const level = parseLevel({ ...def, map: def.map.map(r => r.replace('j', '.')) });
    expect(new CandyStuff(level).machines).toHaveLength(0);
    const far = parseLevel({
      id: 'gumball-far',
      map: ['########################', '#j....................S#', '########################'],
    });
    const candy = new CandyStuff(far);
    const slime = slimeAt(onTop(22, 2).x, onTop(22, 2).y);
    run(candy, slime, far, GUMBALL_EVERY * 2);
    expect(candy.machines[0].state).toBe('wait');
    expect(candy.gumballs).toHaveLength(0);
  });
});

describe('candy canes', () => {
  const def = {
    id: 'cane',
    map: ['##########', '#...|....#', '#........#', '#.......S#', '##########'],
  };

  it('hurt when they swing into you', () => {
    const level = parseLevel(def);
    const candy = new CandyStuff(level);
    // Right under the pivot, it swings through you every half swing.
    const slime = slimeAt(at(4, 3).x, at(4, 2).y + 30);
    expect(run(candy, slime, level, CANE_PERIOD)).toContain('candycane');
  });

  it('leave you alone outside their swing', () => {
    const level = parseLevel(def);
    const candy = new CandyStuff(level);
    const slime = slimeAt(onTop(8, 4).x, onTop(8, 4).y);
    expect(run(candy, slime, level, CANE_PERIOD * 2)).toEqual([]);
    // Up on the ceiling right next to the pivot is safe too (it hangs down).
    const high = slimeAt(at(6, 1).x + 10, TILE + END_RADIUS + 1);
    expect(run(new CandyStuff(level), high, level, CANE_PERIOD * 2)).toEqual([]);
  });
});

describe('sour candy clouds', () => {
  const def = {
    id: 'sour',
    map: [
      '##########',
      '#.ww.....#',
      '#........#',
      '#.....##.#',
      '#........#',
      '#.......S#',
      '##########',
    ],
  };

  it('rumble, then rain sour drops straight down for a while', () => {
    const cloud = { offset: 0 };
    const warnAt = SOUR_EVERY - SOUR_RAIN - SOUR_WARN;
    expect(sourState(cloud, warnAt - 0.1)).toBe('calm');
    expect(sourState(cloud, warnAt + 0.1)).toBe('warn');
    expect(sourState(cloud, SOUR_EVERY - SOUR_RAIN + 0.1)).toBe('rain');
    expect(sourState(cloud, SOUR_EVERY + 0.1)).toBe('calm');
  });

  it('hurt a slime out in the rain', () => {
    const level = parseLevel(def);
    const candy = new CandyStuff(level);
    expect(candy.clouds).toHaveLength(1);
    const slime = slimeAt(onTop(3, 6).x, onTop(3, 6).y);
    const events = [];
    const hurts = run(candy, slime, level, SOUR_EVERY, () => events.push(...candy.takeEvents()));
    expect(events.map(e => e.type)).toEqual(expect.arrayContaining(['rumble', 'rain']));
    expect(hurts).toContain('sour');
  });

  it("don't hurt a slime beside the cloud", () => {
    const level = parseLevel(def);
    const candy = new CandyStuff(level);
    const slime = slimeAt(onTop(5, 6).x, onTop(5, 6).y);
    expect(run(candy, slime, level, SOUR_EVERY * 2)).toEqual([]);
  });

  it('stop at the first solid thing, so you can shelter under a roof', () => {
    const level = parseLevel({
      ...def,
      map: def.map.map((r, i) => (i === 1 ? '#.....ww.#' : r)),
    });
    const candy = new CandyStuff(level);
    const slime = slimeAt(onTop(6, 6).x, onTop(6, 6).y);
    expect(run(candy, slime, level, SOUR_EVERY * 2)).toEqual([]);
  });
});
