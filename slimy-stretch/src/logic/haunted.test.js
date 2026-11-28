import { describe, expect, it } from 'vitest';
import {
  isBouncyKind,
  isCatchingKind,
  isDeadlyKind,
  isPlatformKind,
  isSolidKind,
  isStickyKind,
  parseLevel as parseMap,
  TileKind,
} from './level.js';
import { Slime } from './slime.js';
import { END_RADIUS, TILE } from './constants.js';
import { solveLevel } from './solver.js';
import { IslandStuff, simulateBounce } from './island.js';
import { JungleStuff, swingingVines, VINE_HANG, vineTip } from './jungle.js';
import { DUMBWAITER_SPEED, floatingPlatforms, SkyStuff } from './sky.js';
import {
  BOARD_GONE,
  BOOKCASE_SPIN,
  CREAK_TIME,
  EYE_LOOK,
  FURNITURE_PAUSE,
  furnitureCells,
  furnitureRides,
  HauntedStuff,
  paintingLook,
  WEB_HOLD,
} from './haunted.js';

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

/** Run the slime and the haunted house together; returns the hurts that happened. */
function run(haunted, slime, level, seconds) {
  const hurts = [];
  for (let t = 0; t < seconds; t += 1 / 60) {
    slime.update(1 / 60, level);
    const h = haunted.update(1 / 60, slime);
    if (h) {
      hurts.push(h);
    }
  }
  return hurts;
}

describe('haunted house map characters', () => {
  const level = parseLevel({
    id: 'haunted-chars',
    map: ['#########', '#..[..&.#', '#S.4/...#', '#########'],
  });

  it('turns each character into the right kind of tile', () => {
    expect(level.tiles[2][3]).toBe(TileKind.BED);
    expect(level.tiles[2][4]).toBe(TileKind.FLOORBOARD);
    expect(level.tiles[1][6]).toBe(TileKind.WEB);
    // Paintings are just decoration, in front of the wallpaper.
    expect(level.tiles[1][3]).toBe(TileKind.EMPTY);
  });

  it('knows what each haunted tile does', () => {
    for (const kind of [TileKind.FLOORBOARD, TileKind.BED, TileKind.FURNITURE]) {
      expect(isSolidKind(kind)).toBe(true);
      expect(isStickyKind(kind)).toBe(true);
      expect(isDeadlyKind(kind)).toBe(false);
    }
    expect(isBouncyKind(TileKind.BED)).toBe(true);
    expect(isBouncyKind(TileKind.FLOORBOARD)).toBe(false);
    // You can stretch right through a web, but it's sticky and catches you.
    expect(isSolidKind(TileKind.WEB)).toBe(false);
    expect(isStickyKind(TileKind.WEB)).toBe(true);
    expect(isCatchingKind(TileKind.WEB)).toBe(true);
    expect(isCatchingKind(TileKind.WALL)).toBe(false);
    expect(isPlatformKind(TileKind.WEB)).toBe(false);
  });

  it('finds the haunted things', () => {
    expect(level.floorboards).toEqual([{ col: 4, row: 2 }]);
    expect(level.webs).toHaveLength(1);
    expect(level.paintings).toEqual([{ ...at(3, 1), col: 3, row: 1 }]);
  });
});

describe('creaky floorboards', () => {
  const map = ['########', '#......#', '#......#', '#..//..#', '#......#', '#S.....#', '########'];

  it('creak when you stick to them, then vanish, and you fall through', () => {
    const level = parseLevel({ id: 'fb', map });
    const haunted = new HauntedStuff(level);
    const slime = slimeAt(onTop(3, 3).x, onTop(3, 3).y);
    run(haunted, slime, level, 0.1);
    expect(haunted.boards[0].state).toBe('creak');
    expect(haunted.boards[1].state).toBe('solid'); // the one next to it is fine
    expect(haunted.takeEvents().map(e => e.type)).toEqual(['creak']);
    expect(haunted.boardShake(haunted.boards[0])).toBeGreaterThan(0);
    run(haunted, slime, level, CREAK_TIME - 0.3);
    expect(level.tiles[3][3]).toBe(TileKind.FLOORBOARD);
    expect(slime.isFalling).toBe(false);
    run(haunted, slime, level, 0.3);
    expect(haunted.boards[0].state).toBe('gone');
    expect(level.tiles[3][3]).toBe(TileKind.EMPTY);
    expect(slime.isFalling).toBe(true);
    // Down to the floor below. It doesn't hurt.
    const hurts = run(haunted, slime, level, 1);
    expect(hurts).toEqual([]);
    expect(slime.isFalling).toBe(false);
    expect(slime.center.y).toBeGreaterThan(5 * TILE);
  });

  it('come back after a few seconds, but not while you are in the way', () => {
    const level = parseLevel({ id: 'fb2', map });
    const haunted = new HauntedStuff(level);
    const slime = slimeAt(onTop(4, 3).x, onTop(4, 3).y);
    run(haunted, slime, level, CREAK_TIME + 0.1);
    expect(haunted.boards[1].state).toBe('gone');
    // Hold the slime right where the board was.
    slime.holdAt(at(4, 3).x, at(4, 3).y);
    run(haunted, slime, level, BOARD_GONE + 0.5);
    expect(haunted.boards[1].state).toBe('gone');
    slime.spawn(at(1, 5));
    run(haunted, slime, level, 0.1);
    expect(haunted.boards[1].state).toBe('solid');
    expect(level.tiles[3][4]).toBe(TileKind.FLOORBOARD);
  });

  it('let the level checker fall through them', () => {
    // The door is in the cellar: the only way down is through the floor.
    const def = {
      id: 'fb3',
      map: [
        'IIIIIIIII',
        'I.......I',
        'I.S.....I',
        'I###////I',
        'I.......I',
        'I.....E.I',
        'IIIIIIIII',
      ],
    };
    expect(solveLevel(parseLevel(def)).exit).toBe(true);
    const solid = { ...def, map: def.map.map(r => r.replace(/\//g, '#')) };
    expect(solveLevel(parseLevel(solid)).exit).toBe(false);
  });

  it("can't be crossed one after another by the level checker (they fall too fast)", () => {
    const bridge = boards => ({
      id: 'fb4',
      map: [
        'IIIIIIIIIIIIIIII',
        'I..............I',
        'I..............I',
        'IS............EI',
        `I#${boards}#I`,
        'ILLLLLLLLLLLLLLI',
        'IIIIIIIIIIIIIIII',
      ],
    });
    // A long bridge of creaky boards over lava: no way across.
    expect(solveLevel(parseLevel(bridge('////////////'))).exit).toBe(false);
    expect(solveLevel(parseLevel(bridge('############'))).exit).toBe(true);
    // A short one is fine: one quick step on a board and you're over.
    const short = {
      id: 'fb5',
      map: [
        'IIIIIIIIIIII',
        'I..........I',
        'I..........I',
        'IS.......E.I',
        'I#/////####I',
        'ILLLLLLLLLLI',
        'IIIIIIIIIIII',
      ],
    };
    expect(solveLevel(parseLevel(short)).exit).toBe(true);
  });
});

describe('haunted furniture', () => {
  const map = [
    '############',
    '#..........#',
    '#..........#',
    '#..........#',
    '#S.........#',
    '############',
  ];
  const furniture = [{ kind: 'table', at: [2, 4], to: [7, 4], speed: 100, pause: 1 }];

  it('slides back and forth, stopping at each end, and is solid where it is', () => {
    const level = parseLevel({ id: 'fu', map, furniture });
    const haunted = new HauntedStuff(level);
    const table = haunted.furniture[0];
    expect(level.tiles[4][2]).toBe(TileKind.FURNITURE);
    expect(level.tiles[4][3]).toBe(TileKind.FURNITURE);
    const slime = slimeAt(onTop(10, 5).x, onTop(10, 5).y);
    run(haunted, slime, level, 0.9);
    expect(table.x).toBe(2 * TILE); // still waiting
    run(haunted, slime, level, 0.1 + (5 * TILE) / 100 + 0.1);
    expect(table.x).toBe(7 * TILE);
    expect(level.tiles[4][2]).toBe(TileKind.EMPTY);
    expect(level.tiles[4][7]).toBe(TileKind.FURNITURE);
    expect(level.tiles[4][8]).toBe(TileKind.FURNITURE);
    // It waits, then heads back.
    run(haunted, slime, level, 0.8);
    expect(table.x).toBe(7 * TILE);
    run(haunted, slime, level, 0.5);
    expect(table.x).toBeLessThan(7 * TILE);
  });

  it('carries you along if you stick to it while it is stopped', () => {
    const level = parseLevel({ id: 'fu2', map, furniture });
    const haunted = new HauntedStuff(level);
    const slime = slimeAt(onTop(2, 4).x + 10, onTop(2, 4).y);
    const hurts = run(haunted, slime, level, 1 + (5 * TILE) / 100 + 0.2);
    expect(hurts).toEqual([]);
    expect(slime.isFalling).toBe(false);
    expect(slime.ends.every(e => e.state === 'stuck')).toBe(true);
    expect(slime.center.x).toBeCloseTo(onTop(7, 4).x + 10, 0);
    expect(slime.center.y).toBeCloseTo(onTop(7, 4).y, 0);
  });

  it('carries the end that is stuck to it, and pulls the other one off if it goes too far', () => {
    const level = parseLevel({ id: 'fu3', map, furniture });
    const haunted = new HauntedStuff(level);
    const slime = slimeAt(onTop(1, 5).x, onTop(1, 5).y);
    slime.ends[1].x = onTop(2, 4).x;
    slime.ends[1].y = onTop(2, 4).y;
    run(haunted, slime, level, 1 + (5 * TILE) / 100 + 0.2);
    expect(slime.isFalling).toBe(false);
    expect(slime.ends[1].x).toBeCloseTo(onTop(7, 4).x, 0);
    // The end on the floor couldn't reach that far, so it boinged over.
    expect(slime.ends[0].x).toBeCloseTo(slime.ends[1].x, 0);
  });

  it('shoves you along and knocks you loose if it bumps into you while it moves', () => {
    const level = parseLevel({ id: 'fu4', map, furniture });
    const haunted = new HauntedStuff(level);
    const slime = slimeAt(onTop(7, 5).x, onTop(7, 5).y);
    let shoved = null;
    const hurts = [];
    for (let t = 0; t < 4 && !shoved; t += 1 / 60) {
      slime.update(1 / 60, level);
      hurts.push(haunted.update(1 / 60, slime));
      shoved = haunted.takeEvents().find(e => e.type === 'shove');
    }
    expect(shoved).toBeTruthy();
    expect(hurts.every(h => h === null)).toBe(true);
    expect(slime.isFalling).toBe(true);
    expect(slime.falling.vx).toBeGreaterThan(0);
    expect(slime.falling.vy).toBeLessThan(0);
    // Out in front of the table, not inside it.
    expect(slime.falling.x).toBeGreaterThan(haunted.furniture[0].x + 2 * TILE);
    run(haunted, slime, level, 1);
    expect(slime.isFalling).toBe(false);
  });

  it('goes "oooo" when it starts moving near you, but not too often', () => {
    const level = parseLevel({ id: 'fu9', map, furniture });
    const haunted = new HauntedStuff(level);
    const slime = slimeAt(onTop(10, 5).x, onTop(10, 5).y);
    const haunts = [];
    for (let t = 0; t < 12; t += 1 / 60) {
      haunted.update(1 / 60, slime);
      haunts.push(...haunted.takeEvents().filter(e => e.type === 'haunt'));
    }
    // It starts moving 4 times in 12 seconds, but only says "oooo" twice.
    expect(haunts).toHaveLength(2);
  });

  it('never hurts', () => {
    const level = parseLevel({ id: 'fu5', map, furniture });
    const haunted = new HauntedStuff(level);
    const slime = slimeAt(onTop(5, 5).x, onTop(5, 5).y);
    expect(run(haunted, slime, level, 15)).toEqual([]);
  });

  it('counts as holding you up when something else checks', () => {
    // A dumbwaiter moving checks what holds the slime up; riding a table counts.
    const def = { id: 'fu6', map, furniture, dumbwaiters: [{ col: 10, from: 4, to: 1 }] };
    const level = parseLevel(def);
    const sky = new SkyStuff(level);
    const haunted = new HauntedStuff(level, sky);
    const slime = slimeAt(onTop(2, 4).x, onTop(2, 4).y);
    for (let t = 0; t < 2; t += 1 / 60) {
      slime.update(1 / 60, level);
      sky.update(1 / 60, slime);
      haunted.update(1 / 60, slime);
      sky.checkSupport(slime);
    }
    expect(slime.isFalling).toBe(false);
    expect(haunted.furnitureRiders(slime)).toEqual([true, true]);
  });

  it('can be ridden by the level checker, and is solid where it starts', () => {
    const def = {
      id: 'fu7',
      map: [
        'IIIIIIIIIIIIIIIIIIII',
        'I..................I',
        'I..................I',
        'I..................I',
        'IS...............E.I',
        '###LLLLLLLLLLLLL####',
      ],
    };
    // Lava all the way across, and nothing to stick to above it.
    expect(solveLevel(parseLevel(def)).exit).toBe(false);
    const table = [{ kind: 'table', at: [3, 4], to: [14, 4] }];
    expect(furnitureRides({ furniture: table })).toEqual([{ from: [3, 4], to: [14, 4], width: 2 }]);
    expect(furnitureCells(table[0])).toEqual([
      { col: 3, row: 4 },
      { col: 4, row: 4 },
    ]);
    expect(solveLevel(parseLevel({ ...def, furniture: table })).exit).toBe(true);
  });

  it('comes in chairs, tables and wardrobes', () => {
    const level = parseLevel({
      id: 'fu8',
      map,
      furniture: [
        { kind: 'chair', at: [2, 4], to: [4, 4] },
        { kind: 'wardrobe', at: [9, 3], to: [6, 3] },
      ],
    });
    const haunted = new HauntedStuff(level);
    expect(haunted.furniture.map(f => [f.w, f.h, f.pause])).toEqual([
      [1, 1, FURNITURE_PAUSE],
      [1, 2, FURNITURE_PAUSE],
    ]);
    expect(level.tiles[3][9]).toBe(TileKind.FURNITURE);
    expect(level.tiles[4][9]).toBe(TileKind.FURNITURE);
    // (There's no haunted sofa. Yet.)
    const sofa = parseLevel({
      id: 'x',
      map,
      furniture: [{ kind: 'sofa', at: [2, 4], to: [3, 4] }],
    });
    expect(() => new HauntedStuff(sofa)).toThrow(/sofa/);
  });
});

describe('spider webs', () => {
  const map = [
    '#########',
    '#.......#',
    '#...&...#',
    '#.......#',
    '#.......#',
    '#S......#',
    '#########',
  ];

  it('catch you when you fall into them, and hold you still for a few seconds', () => {
    const level = parseLevel({ id: 'w', map });
    const haunted = new HauntedStuff(level);
    const slime = new Slime(at(4, 1));
    run(haunted, slime, level, 0.5);
    // Caught in the web instead of falling to the floor.
    expect(slime.isFalling).toBe(false);
    expect(slime.center.y).toBeLessThan(3 * TILE);
    expect(slime.glued).toBe(true);
    expect(haunted.takeEvents().map(e => e.type)).toContain('web');
    expect(slime.grab(slime.ends[0])).toBe(false);
    run(haunted, slime, level, WEB_HOLD - 0.6);
    expect(slime.glued).toBe(true);
    expect(run(haunted, slime, level, 0.3)).toEqual([]); // webs don't hurt
    expect(slime.glued).toBe(false);
    expect(haunted.takeEvents().map(e => e.type)).toContain('webFree');
    // Free to stretch again: you're still stuck to the web, not falling.
    expect(slime.isFalling).toBe(false);
    expect(slime.grab(slime.ends[0])).toBe(true);
  });

  it('are sticky: let go of a stretch on one and you stick there (and get held)', () => {
    const level = parseLevel({ id: 'w2', map });
    const haunted = new HauntedStuff(level);
    const slime = slimeAt(onTop(4, 6).x, onTop(4, 6).y);
    run(haunted, slime, level, 0.1);
    expect(slime.grab(slime.ends[1])).toBe(true);
    const end = slime.heldEnd;
    slime.moveFinger(at(4, 2));
    run(haunted, slime, level, 0.4);
    slime.release(level);
    expect(end.state).toBe('stuck');
    expect(end.y).toBeLessThan(3 * TILE);
    run(haunted, slime, level, 0.1);
    expect(slime.glued).toBe(true);
    expect(haunted.webHold).toBeGreaterThan(0.8);
  });

  it("don't get in the way of stretching", () => {
    const level = parseLevel({ id: 'w3', map });
    const slime = slimeAt(onTop(2, 6).x, onTop(2, 6).y);
    // Stretch straight up through the web's row, right past it.
    expect(slime.grab(slime.ends[1])).toBe(true);
    slime.moveFinger(at(4, 3));
    for (let t = 0; t < 0.4; t += 1 / 60) {
      slime.update(1 / 60, level);
    }
    expect(slime.heldEnd.x).toBeCloseTo(at(4, 3).x, 0);
    expect(slime.heldEnd.y).toBeCloseTo(at(4, 3).y, 0);
  });

  it('let go when you get knocked loose', () => {
    const level = parseLevel({ id: 'w4', map });
    const haunted = new HauntedStuff(level);
    const slime = new Slime(at(4, 1));
    run(haunted, slime, level, 0.5);
    expect(slime.glued).toBe(true);
    slime.knockLoose(0, 0);
    haunted.update(1 / 60, slime);
    expect(slime.glued).toBe(false);
  });

  it('are sticky spots in the air for the level checker', () => {
    const def = {
      id: 'w5',
      map: [
        'IIIIIIIIIII',
        'I.........I',
        'I.........I',
        'I....&....I',
        'IS......E.I',
        'I#LLLLLL##I',
        'IIIIIIIIIII',
      ],
    };
    expect(solveLevel(parseLevel(def)).exit).toBe(true);
    const noWeb = { ...def, map: def.map.map(r => r.replace('&', '.')) };
    expect(solveLevel(parseLevel(noWeb)).exit).toBe(false);
  });
});

describe('spooky paintings', () => {
  const map = ['#########', '#.......#', '#...[...#', '#.......#', '#S......#', '#########'];

  it('watch you with their eyes', () => {
    const level = parseLevel({ id: 'p', map });
    const painting = level.paintings[0];
    const right = paintingLook(painting, { x: painting.x + 400, y: painting.y });
    expect(right.x).toBeCloseTo(EYE_LOOK);
    expect(right.y).toBeCloseTo(0);
    const below = paintingLook(painting, { x: painting.x, y: painting.y + 30 });
    expect(below.y).toBeGreaterThan(0);
    expect(Math.hypot(below.x, below.y)).toBeLessThanOrEqual(EYE_LOOK);
    expect(paintingLook(painting, painting)).toEqual({ x: 0, y: 0 });
    // The haunted house keeps track of where they should look.
    const haunted = new HauntedStuff(level);
    const slime = slimeAt(onTop(2, 5).x, onTop(2, 5).y);
    haunted.update(1 / 60, slime);
    expect(haunted.lookAt).toEqual(slime.center);
  });

  it('never hurt you or do anything to you (no lasers!)', () => {
    const level = parseLevel({ id: 'p2', map });
    const haunted = new HauntedStuff(level);
    // Stretch right across the painting.
    const slime = slimeAt(at(4, 2).x, at(4, 2).y);
    slime.ends[1].x = at(2, 2).x;
    const before = JSON.stringify(slime.ends);
    for (let t = 0; t < 10; t += 1 / 60) {
      expect(haunted.update(1 / 60, slime)).toBe(null);
    }
    expect(JSON.stringify(slime.ends)).toBe(before);
    expect(slime.glued || slime.frozen || slime.isFalling).toBe(false);
    expect(haunted.takeEvents()).toEqual([]);
    expect(isSolidKind(level.tiles[2][4])).toBe(false);
  });
});

describe('secret bookcases', () => {
  const map = ['############', '#....#.....#', '#....#.....#', '#S...#....E#', '############'];
  const bookcases = [{ a: [3, 3], b: [7, 3] }];

  it('spin you around into the room on the other side', () => {
    const level = parseLevel({ id: 'b', map, bookcases });
    const haunted = new HauntedStuff(level);
    const slime = slimeAt(onTop(3, 4).x, onTop(3, 4).y);
    haunted.update(1 / 60, slime);
    expect(haunted.takeEvents().map(e => e.type)).toEqual(['bookcaseSpin']);
    // Spinning: you go around with the bookcase.
    expect(slime.frozen).toBe(true);
    expect(haunted.bookcases[0].spinA).toBe(1);
    run(haunted, slime, level, BOOKCASE_SPIN - 0.1);
    expect(slime.frozen).toBe(true);
    expect(slime.center.x).toBeCloseTo(at(3, 3).x);
    run(haunted, slime, level, 0.2);
    expect(haunted.takeEvents().map(e => e.type)).toEqual(['bookcaseOut']);
    expect(slime.frozen).toBe(false);
    expect(haunted.bookcases[0].spinB).toBeGreaterThan(0.5);
    run(haunted, slime, level, 1);
    expect(slime.isFalling).toBe(false);
    expect(slime.center.x).toBeCloseTo(at(7, 3).x);
    expect(slime.center.y).toBeCloseTo(onTop(7, 4).y, 0);
  });

  it("don't spin you straight back: you have to move away first", () => {
    const level = parseLevel({ id: 'b2', map, bookcases });
    const haunted = new HauntedStuff(level);
    const slime = slimeAt(onTop(3, 4).x, onTop(3, 4).y);
    run(haunted, slime, level, BOOKCASE_SPIN + 3);
    // Sitting right by the other bookcase, but it rests.
    expect(slime.center.x).toBeCloseTo(at(7, 3).x);
    expect(haunted.spinning).toBe(null);
    haunted.takeEvents();
    // Walk off, then come back: around you go again.
    slime.ends.forEach(e => {
      e.x = onTop(9, 4).x;
    });
    run(haunted, slime, level, 0.1);
    expect(haunted.bookcases[0].used).toBe(false);
    slime.ends[1].x = onTop(7, 4).x;
    haunted.update(1 / 60, slime);
    expect(haunted.takeEvents().map(e => e.type)).toEqual(['bookcaseSpin']);
    run(haunted, slime, level, BOOKCASE_SPIN + 1);
    expect(slime.center.x).toBeCloseTo(at(3, 3).x);
  });

  it('are used by the level checker', () => {
    expect(solveLevel(parseLevel({ id: 'b3', map })).exit).toBe(false);
    expect(solveLevel(parseLevel({ id: 'b4', map, bookcases })).exit).toBe(true);
  });
});

describe('chandeliers', () => {
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
  const chandeliers = [{ at: [9, 1], length: 4 }];

  it('swing just like vines', () => {
    expect(swingingVines({ vines: [{ at: [1, 1], length: 2 }], chandeliers })).toEqual([
      { at: [1, 1], length: 2 },
      { at: [9, 1], length: 4, chandelier: true },
    ]);
    const level = parseLevel({ id: 'c', type: 'normal', map, chandeliers });
    const jungle = new JungleStuff(level);
    const chandelier = jungle.vines[0];
    expect(chandelier.chandelier).toBe(true);
    // Touch it to grab on...
    const slime = slimeAt(vineTip(chandelier).x, vineTip(chandelier).y);
    jungle.update(1 / 60, slime);
    expect(jungle.onVine).toBe(0);
    expect(jungle.takeEvents()).toEqual([
      { type: 'vineGrab', x: chandelier.x, y: vineTip(chandelier).y, chandelier: true },
    ]);
    // ...drag to swing higher...
    let biggest = 0;
    for (let t = 0; t < 5; t += 1 / 60) {
      const tip = vineTip(chandelier);
      jungle.update(1 / 60, slime, { x: tip.x + 200, y: tip.y });
      biggest = Math.max(biggest, Math.abs(chandelier.angle));
    }
    expect(biggest).toBeGreaterThan(1);
    expect(slime.center.y).toBeCloseTo(vineTip(chandelier).y + VINE_HANG);
    // ...and let go to fly off, sticking to what you hit.
    chandelier.angle = -0.3;
    chandelier.omega = 3;
    expect(jungle.letGoVine(slime)).toBe(true);
    expect(slime.falling.vx).toBeGreaterThan(300);
    expect(slime.falling.sticky).toBe(true);
    for (let t = 0; t < 2; t += 1 / 60) {
      slime.update(1 / 60, level);
      jungle.update(1 / 60, slime);
    }
    expect(slime.isFalling).toBe(false);
    expect(slime.center.x).toBeGreaterThan(vineTip(chandelier).x + TILE);
  });

  it('are used by the level checker', () => {
    const pit = {
      id: 'c2',
      type: 'normal',
      map: [
        'IIIIIIIIIIIIIIIIIIII',
        'I..................I',
        'I..................I',
        'I..................I',
        'I..................I',
        'I..................I',
        'IS................EI',
        '###LLLLLLLLLLLLLL###',
      ],
    };
    expect(solveLevel(parseLevel(pit)).exit).toBe(false);
    const chandelier = [{ at: [7, 1], length: 4 }];
    expect(solveLevel(parseLevel({ ...pit, chandeliers: chandelier })).exit).toBe(true);
  });
});

describe('dumbwaiters', () => {
  const map = ['#######', '#.....#', '#.....#', '#.....#', '#.....#', '#S....#', '#######'];
  const dumbwaiters = [{ col: 3, from: 5, to: 2 }];

  it('are 1 tile wide floating platforms that go up and down', () => {
    expect(floatingPlatforms({ dumbwaiters })).toEqual([
      { from: [3, 5], to: [3, 2], width: 1, speed: DUMBWAITER_SPEED, dumbwaiter: true },
    ]);
  });

  it('carry you between floors', () => {
    const level = parseLevel({ id: 'd', map, dumbwaiters });
    const sky = new SkyStuff(level);
    const haunted = new HauntedStuff(level, sky);
    const box = sky.islands[0];
    expect(box.dumbwaiter).toBe(true);
    expect(level.tiles[5][3]).toBe(TileKind.SKY_ISLAND);
    const slime = slimeAt(onTop(3, 5).x, onTop(3, 5).y);
    for (let t = 0; t < 1 + (3 * TILE) / DUMBWAITER_SPEED + 0.2; t += 1 / 60) {
      slime.update(1 / 60, level);
      sky.update(1 / 60, slime);
      haunted.update(1 / 60, slime);
    }
    expect(slime.isFalling).toBe(false);
    expect(slime.center.y).toBeCloseTo(onTop(3, 2).y, 0);
  });
});

describe('bouncy beds', () => {
  const map = [
    '##########',
    '#........#',
    '#........#',
    '#........#',
    '#........#',
    '#S..44...#',
    '##########',
  ];

  it('boing you up high', () => {
    const level = parseLevel({ id: 'bed', map });
    const island = new IslandStuff(level);
    const slime = slimeAt(onTop(4, 5).x, onTop(4, 5).y);
    island.update(1 / 60, slime, 0);
    expect(slime.isFalling).toBe(true);
    expect(slime.falling.vy).toBeLessThan(-500);
    // Up to the ceiling, where it sticks.
    const landing = simulateBounce(level, onTop(4, 5));
    expect(landing.y).toBeLessThan(2 * TILE);
  });

  it('are used by the level checker', () => {
    // The door is up on a high ledge you could never stretch to.
    const def = {
      id: 'bed2',
      map: [
        'IIIIIIIII',
        'I......EI',
        'I....####',
        'I.......I',
        'I.......I',
        'I.......I',
        'I.......I',
        'I.......I',
        'I.......I',
        'I.S.....I',
        'I####IIII',
      ],
    };
    expect(solveLevel(parseLevel(def)).exit).toBe(false);
    // A bed under the ledge boings you up to it.
    def.map[10] = 'I####44II';
    expect(solveLevel(parseLevel(def)).exit).toBe(true);
  });
});
