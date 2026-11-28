import { describe, expect, it } from 'vitest';
import { isSolidKind, isStickyKind, parseLevel as parseMap, TileKind } from './level.js';
import { Slime } from './slime.js';
import { END_RADIUS, TILE } from './constants.js';
import { solveLevel } from './solver.js';
import { STREAM_SPEED, WarehouseStuff } from './warehouse.js';
import {
  buildCircuits,
  CABLE_SPEED,
  cablePath,
  CIRCUIT_QUIET,
  CIRCUIT_STAGGER,
  CIRCUIT_WARN,
  circuitPulse,
  circuitState,
  ComputerStuff,
  CURSOR_HANG,
  GLITCH_FLICKER,
  GLITCH_OFF,
  GLITCH_ON,
  GLITCH_STAGGER,
  glitchState,
  pointAlong,
  POPUP_OPEN,
  POPUP_WARN,
  popupState,
  popupWindows,
  VIRUS_CHASE,
  VIRUS_SPEED,
} from './computer.js';

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

/** Run the slime and the computer together from level time `from`; returns the hurts. */
function run(computer, slime, level, seconds, from = computer.time) {
  const hurts = [];
  let t = from;
  for (let k = 0; k < seconds * 60; k++) {
    t += 1 / 60;
    slime.update(1 / 60, level);
    const h = computer.update(1 / 60, slime, t);
    if (h) {
      hurts.push(h);
    }
  }
  return hurts;
}

describe('computer map characters', () => {
  it('parses data streams, glitchy blocks, viruses and circuits', () => {
    const level = parseLevel({
      id: 't',
      map: ['#######', '#S.e;.#', '#}}?{{#', '#######'],
    });
    expect(level.tiles[2][1]).toBe(TileKind.STREAM_RIGHT);
    expect(level.tiles[2][4]).toBe(TileKind.STREAM_LEFT);
    expect(level.tiles[2][3]).toBe(TileKind.GLITCH);
    expect(level.glitches).toEqual([{ col: 3, row: 2 }]);
    expect(level.viruses).toEqual([{ ...at(3, 1), col: 3, row: 1 }]);
    expect(level.circuitCells).toEqual([{ col: 4, row: 1 }]);
    // Viruses and circuits aren't solid; streams, glitchy blocks and open pop-ups are.
    expect(level.tiles[1][3]).toBe(TileKind.EMPTY);
    for (const kind of [
      TileKind.STREAM_RIGHT,
      TileKind.STREAM_LEFT,
      TileKind.GLITCH,
      TileKind.POPUP,
    ]) {
      expect(isSolidKind(kind)).toBe(true);
      expect(isStickyKind(kind)).toBe(true);
    }
  });
});

describe('data streams', () => {
  it('carry a stuck slime along, faster than a conveyor belt', () => {
    const level = parseLevel({ id: 't', map: ['##########', '#S.......#', '#}}}}}}}}#'] });
    const slime = slimeAt(onTop(2, 2).x, onTop(2, 2).y);
    const warehouse = new WarehouseStuff(level);
    for (let i = 0; i < 30; i++) {
      warehouse.update(1 / 60, slime);
    }
    expect(slime.ends[0].x - onTop(2, 2).x).toBeCloseTo(STREAM_SPEED / 2, 0);
  });

  it('flow left too', () => {
    const level = parseLevel({ id: 't', map: ['##########', '#S.......#', '#{{{{{{{{#'] });
    const slime = slimeAt(onTop(6, 2).x, onTop(6, 2).y);
    new WarehouseStuff(level).update(0.5, slime);
    expect(slime.ends[0].x).toBeLessThan(onTop(6, 2).x);
  });
});

describe('glitchy blocks', () => {
  // The glitchy block in column 2 blinks off this long into the level.
  const off = GLITCH_ON + 2 * GLITCH_STAGGER + 0.1;

  it('blink off on a timer, flickering first, one column after another', () => {
    const block = { col: 0, row: 0 };
    expect(glitchState(block, 0.5)).toBe('on');
    expect(glitchState(block, GLITCH_ON - GLITCH_FLICKER / 2)).toBe('flicker');
    expect(glitchState(block, GLITCH_ON + 0.5)).toBe('off');
    // The next column over blinks a little later.
    const next = { col: 1, row: 0 };
    expect(glitchState(next, GLITCH_ON + GLITCH_STAGGER / 2)).toBe('flicker');
    // Every block starts out there, and the further ones wait their turn.
    expect(glitchState({ col: 7, row: 0 }, 0.1)).toBe('on');
    expect(glitchState({ col: 7, row: 0 }, 7 * GLITCH_STAGGER + GLITCH_ON + 0.1)).toBe('off');
  });

  it('vanish, and anything stuck to them lets go', () => {
    const level = parseLevel({ id: 't', map: ['#####', '#S..#', '#.?.#', '#...#', '#####'] });
    const computer = new ComputerStuff(level);
    const p = onTop(2, 2);
    const slime = slimeAt(p.x, p.y);
    run(computer, slime, level, off - 0.5, 0);
    expect(level.tiles[2][2]).toBe(TileKind.GLITCH);
    expect(slime.isFalling).toBe(false);
    computer.update(1 / 60, slime, off);
    expect(level.tiles[2][2]).toBe(TileKind.EMPTY);
    expect(slime.isFalling).toBe(true);
    expect(computer.takeEvents().map(e => e.type)).toContain('glitchOff');
  });

  it('come back on time, but not while the slime is in the way', () => {
    const level = parseLevel({ id: 't', map: ['#####', '#S..#', '#.?.#', '#...#', '#####'] });
    const computer = new ComputerStuff(level);
    const slime = slimeAt(at(1, 1).x, at(1, 1).y);
    computer.update(1 / 60, slime, off);
    expect(level.tiles[2][2]).toBe(TileKind.EMPTY);
    const inTheWay = slimeAt(at(2, 2).x, at(2, 2).y);
    computer.update(1 / 60, inTheWay, off + GLITCH_OFF);
    expect(level.tiles[2][2]).toBe(TileKind.EMPTY);
    computer.update(1 / 60, slime, off + GLITCH_OFF + 0.1);
    expect(level.tiles[2][2]).toBe(TileKind.GLITCH);
  });
});

describe('pop-up windows', () => {
  const def = {
    id: 't',
    popups: [{ at: [2, 3], width: 3, open: 4, closed: 3 }],
    map: ['#######', '#S....#', '#.....#', '#.....#', '#.....#', '#######'],
  };

  it('are solid and sticky while open, and close on a timer', () => {
    const level = parseLevel(def);
    const computer = new ComputerStuff(level);
    expect(level.tiles[3].slice(2, 5)).toEqual([TileKind.POPUP, TileKind.POPUP, TileKind.POPUP]);
    const [popup] = popupWindows(def);
    expect(popupState(popup, POPUP_OPEN - POPUP_WARN - 0.1)).toBe('open');
    expect(popupState(popup, POPUP_OPEN - POPUP_WARN / 2)).toBe('closing');
    expect(popupState(popup, POPUP_OPEN + 1)).toBe('closed');
    // Something sitting on it falls when it closes.
    const p = onTop(3, 3);
    const slime = slimeAt(p.x, p.y);
    run(computer, slime, level, 1, 0);
    expect(slime.isFalling).toBe(false);
    computer.update(1 / 60, slime, POPUP_OPEN + 0.1);
    expect(level.tiles[3][3]).toBe(TileKind.EMPTY);
    expect(slime.isFalling).toBe(true);
    expect(computer.takeEvents().map(e => e.type)).toContain('popupClose');
  });

  it('pop open again later', () => {
    const level = parseLevel(def);
    const computer = new ComputerStuff(level);
    const slime = slimeAt(at(1, 1).x, at(1, 1).y);
    computer.update(1 / 60, slime, POPUP_OPEN + 0.1);
    computer.takeEvents();
    computer.update(1 / 60, slime, 7.1);
    expect(level.tiles[3][4]).toBe(TileKind.POPUP);
    expect(computer.takeEvents().map(e => e.type)).toContain('popupOpen');
  });
});

describe('circuits', () => {
  const map = ['#########', '#S......#', '#.......#', '#;;;....#', '#########', '#########'];

  it('group side-by-side wires into one circuit, in order along the wire', () => {
    const level = parseLevel({ id: 't', map: ['#######', '#;;..;#', '#S....#', '#######'] });
    const circuits = buildCircuits(level);
    expect(circuits).toHaveLength(2);
    expect(circuits[0].cells.map(c => c.col)).toEqual([1, 2]);
    // These hang from the ceiling; circuits take turns.
    expect(circuits[0].cells[0].side).toBe('ceiling');
    expect(circuits[1].offset).toBe(CIRCUIT_STAGGER);
  });

  it('a wire up a wall lies against the wall', () => {
    const level = parseLevel({ id: 't', map: ['####', '#;.#', '#;.#', '#.S#', '####'] });
    const [circuit] = buildCircuits(level);
    expect(circuit.cells.map(c => c.side)).toEqual(['left', 'left']);
    expect(circuit.strips[0].right - circuit.strips[0].left).toBeLessThan(TILE / 2);
  });

  it('light up as a warning, then zap, then go quiet', () => {
    const level = parseLevel({ id: 't', map });
    const [circuit] = buildCircuits(level);
    expect(circuitState(circuit, 1)).toBe('quiet');
    expect(circuitState(circuit, CIRCUIT_QUIET + 0.5)).toBe('warn');
    expect(circuitPulse(circuit, CIRCUIT_QUIET + 0.5)).toBeCloseTo(0.5);
    expect(circuitState(circuit, CIRCUIT_QUIET + CIRCUIT_WARN + 0.5)).toBe('zap');
    expect(circuitState(circuit, CIRCUIT_QUIET + CIRCUIT_WARN + 1.5)).toBe('quiet');
  });

  it('only hurt a slime touching them while they zap', () => {
    const level = parseLevel({ id: 't', map });
    const computer = new ComputerStuff(level);
    const on = slimeAt(onTop(2, 4).x, onTop(2, 4).y);
    expect(run(computer, on, level, CIRCUIT_QUIET + CIRCUIT_WARN - 0.1, 0)).toEqual([]);
    expect(computer.update(1 / 60, on, CIRCUIT_QUIET + CIRCUIT_WARN + 0.2)).toBe('circuit');
    // Right next to the wire is safe, and so is floating above it.
    const beside = slimeAt(onTop(5, 4).x, onTop(5, 4).y);
    expect(computer.update(1 / 60, beside, CIRCUIT_QUIET + CIRCUIT_WARN + 0.3)).toBe(null);
    const above = slimeAt(at(2, 2).x, at(2, 2).y);
    expect(computer.update(1 / 60, above, CIRCUIT_QUIET + CIRCUIT_WARN + 0.4)).toBe(null);
    expect(computer.hurts(on)).toBe('circuit');
    expect(computer.hurts(beside)).toBe(null);
  });

  it('can have their own timings', () => {
    const level = parseLevel({ id: 't', circuitTimings: [{ quiet: 5, offset: 2 }], map });
    const [circuit] = buildCircuits(level);
    expect(circuitState(circuit, 2.9)).toBe('quiet');
    expect(circuitState(circuit, 3.5)).toBe('warn');
  });
});

describe('viruses', () => {
  const map = ['############', '#S.........#', '#..........#', '#....e.....#', '############'];

  it('crawl back and forth along their floor', () => {
    const level = parseLevel({ id: 't', map });
    const computer = new ComputerStuff(level);
    const far = slimeAt(at(1, 1).x, at(1, 1).y);
    far.frozen = true;
    const start = computer.viruses[0].x;
    run(computer, far, level, 1, 0);
    expect(computer.viruses[0].x - start).toBeCloseTo(VIRUS_SPEED, 0);
    expect(computer.viruses[0].y).toBe(at(5, 3).y);
    // ...turning around at the walls.
    run(computer, far, level, 20);
    expect(computer.viruses[0].x).toBeLessThan(10 * TILE);
    expect(computer.viruses[0].x).toBeGreaterThan(TILE);
  });

  it('crawl up and down walls too', () => {
    const level = parseLevel({ id: 't', map: ['####', '#S.#', '#..#', '#e.#', '#..#', '#..#'] });
    const computer = new ComputerStuff(level);
    expect(computer.viruses[0].axis).toBe('y');
  });

  it('chase you slowly when you get near, and hurt when they touch you', () => {
    const level = parseLevel({ id: 't', map });
    const computer = new ComputerStuff(level);
    const p = onTop(8, 4);
    const slime = slimeAt(p.x, p.y);
    const start = computer.viruses[0].x;
    run(computer, slime, level, 1, 0);
    expect(computer.viruses[0].state).toBe('chase');
    expect(computer.viruses[0].x - start).toBeCloseTo(VIRUS_CHASE, 0);
    expect(computer.takeEvents().map(e => e.type)).toContain('virusChase');
    const hurts = run(computer, slime, level, 4);
    expect(hurts).toContain('virus');
    expect(computer.hurts(slime)).toBe('virus');
  });

  it('get deleted for good by a slime shot', () => {
    const level = parseLevel({ id: 't', map });
    const computer = new ComputerStuff(level);
    computer.shootAt({ x: at(5, 3).x + 10, y: at(5, 3).y });
    expect(computer.viruses[0].state).toBe('deleted');
    expect(computer.takeEvents().map(e => e.type)).toEqual(['virusDelete']);
    const slime = slimeAt(at(5, 3).x, at(5, 3).y);
    expect(run(computer, slime, level, 1, 0)).toEqual([]);
    expect(computer.poof(computer.viruses[0])).toBe(1);
    computer.resetAfterDeath();
    expect(computer.viruses[0].state).toBe('deleted');
  });

  it('crawl back home after you lose a life', () => {
    const level = parseLevel({ id: 't', map });
    const computer = new ComputerStuff(level);
    const slime = slimeAt(onTop(8, 4).x, onTop(8, 4).y);
    run(computer, slime, level, 1, 0);
    computer.resetAfterDeath();
    expect(computer.viruses[0].x).toBe(at(5, 3).x);
  });
});

describe('cables', () => {
  const def = {
    id: 't',
    cables: [
      {
        a: [2, 3],
        b: [9, 3],
        path: [
          [2, 1],
          [9, 1],
        ],
      },
    ],
    map: ['############', '#..........#', '#S.........#', '#..........#', '############'],
  };

  it('zoom the slime along the cable and out of the other plug', () => {
    const level = parseLevel(def);
    const computer = new ComputerStuff(level);
    const slime = slimeAt(onTop(2, 4).x, onTop(2, 4).y);
    computer.update(1 / 60, slime, 0);
    expect(computer.riding).toBeTruthy();
    expect(slime.frozen).toBe(true);
    expect(computer.takeEvents().map(e => e.type)).toEqual(['cableIn']);
    // Halfway along it's up in the bend at the top.
    const length = 2 * 2 * TILE + 7 * TILE;
    run(computer, slime, level, length / 2 / CABLE_SPEED);
    expect(slime.ends[0].y).toBeCloseTo(at(5, 1).y, 0);
    run(computer, slime, level, length / CABLE_SPEED);
    expect(computer.riding).toBe(null);
    expect(computer.takeEvents().map(e => e.type)).toContain('cableOut');
    run(computer, slime, level, 1);
    expect(slime.isFalling).toBe(false);
    expect(slime.ends[0].x).toBeCloseTo(at(9, 3).x, 0);
  });

  it("don't send you straight back until you've moved off the plug", () => {
    const level = parseLevel(def);
    const computer = new ComputerStuff(level);
    const slime = slimeAt(onTop(2, 4).x, onTop(2, 4).y);
    run(computer, slime, level, 3, 0);
    expect(slime.ends[0].x).toBeCloseTo(at(9, 3).x, 0);
    expect(computer.riding).toBe(null);
  });

  it('have a path through their bends', () => {
    expect(cablePath(def.cables[0])).toEqual([at(2, 3), at(2, 1), at(9, 1), at(9, 3)]);
    expect(pointAlong([at(0, 0), at(2, 0)], TILE)).toEqual(at(1, 0));
    expect(pointAlong([at(0, 0), at(2, 0)], 3 * TILE)).toBe(null);
  });
});

describe('mouse cursors', () => {
  const def = {
    id: 't',
    cursors: [{ from: [2, 2], to: [6, 2], drop: [10, 2] }],
    map: ['#############', '#...........#', '#...........#', '#S..........#', '#############'],
  };

  it('grab a slime that touches the tip and drag it to the drop spot', () => {
    const level = parseLevel(def);
    const computer = new ComputerStuff(level);
    const slime = slimeAt(at(2, 2).x, at(2, 2).y + 20);
    computer.update(1 / 60, slime, 0);
    expect(computer.inCursor).toBe(0);
    expect(slime.frozen).toBe(true);
    run(computer, slime, level, 4);
    expect(computer.inCursor).toBe(null);
    const events = computer.takeEvents().map(e => e.type);
    expect(events).toContain('cursorGrab');
    expect(events).toContain('cursorDrop');
    run(computer, slime, level, 1);
    expect(slime.isFalling).toBe(false);
    expect(slime.ends[0].x).toBeCloseTo(at(10, 2).x, 0);
    expect(slime.ends[0].y).toBeGreaterThan(at(10, 2).y + CURSOR_HANG);
  });

  it('swoop back and forth while nobody is near', () => {
    const level = parseLevel(def);
    const computer = new ComputerStuff(level);
    const far = slimeAt(at(11, 3).x, at(11, 3).y);
    run(computer, far, level, 2, 0);
    expect(computer.cursors[0].x).toBeGreaterThan(at(2, 2).x + TILE);
    run(computer, far, level, 6);
    expect(computer.inCursor).toBe(null);
  });
});

describe('copy-paste pads', () => {
  const def = {
    id: 't',
    copyPads: [{ copy: [3, 3], paste: [9, 3] }],
    map: ['############', '#..........#', '#..........#', '#S.........#', '############'],
  };

  it('pop a copy of you out of the paste pad, leaving the old you behind', () => {
    const level = parseLevel(def);
    const computer = new ComputerStuff(level);
    const p = onTop(3, 4);
    const slime = slimeAt(p.x, p.y);
    computer.update(1 / 60, slime, 0);
    const [e] = computer.takeEvents();
    expect(e.type).toBe('copy');
    expect(e.ends[0]).toEqual({ x: p.x, y: p.y });
    expect(slime.falling).toMatchObject(at(9, 3));
  });

  it('only work once (until you lose a life)', () => {
    const level = parseLevel(def);
    const computer = new ComputerStuff(level);
    const p = onTop(3, 4);
    computer.update(1 / 60, slimeAt(p.x, p.y), 0);
    computer.takeEvents();
    computer.update(1 / 60, slimeAt(p.x, p.y), 1);
    expect(computer.takeEvents()).toEqual([]);
    computer.resetAfterDeath();
    computer.update(1 / 60, slimeAt(p.x, p.y), 2);
    expect(computer.takeEvents().map(e => e.type)).toEqual(['copy']);
  });
});

describe('level checker inside the computer', () => {
  it('rides cables both ways', () => {
    const map = [
      '##############',
      '#.....#......#',
      '#.....#......#',
      '#S....#....E.#',
      '##############',
    ];
    expect(solveLevel(parseLevel({ id: 't', type: 'normal', map })).exit).toBe(false);
    const cables = [
      {
        a: [4, 3],
        b: [8, 3],
        path: [
          [4, 0],
          [8, 0],
        ],
      },
    ];
    expect(solveLevel(parseLevel({ id: 't', type: 'normal', cables, map })).exit).toBe(true);
  });

  it('takes copy pads one way only', () => {
    const map = [
      '##############',
      '#.....#......#',
      '#.....#......#',
      '#S....#....E.#',
      '##############',
    ];
    const there = { id: 't', type: 'normal', copyPads: [{ copy: [4, 3], paste: [8, 3] }], map };
    expect(solveLevel(parseLevel(there)).exit).toBe(true);
    const back = { id: 't', type: 'normal', copyPads: [{ copy: [8, 3], paste: [4, 3] }], map };
    expect(solveLevel(parseLevel(back)).exit).toBe(false);
  });

  it('lets the mouse cursor carry you to its drop spot', () => {
    const map = [
      '##############',
      '#.....#......#',
      '#.....#......#',
      '#S....#....E.#',
      '##############',
    ];
    const cursors = [{ from: [2, 1], to: [4, 1], drop: [9, 1] }];
    expect(solveLevel(parseLevel({ id: 't', type: 'normal', cursors, map })).exit).toBe(true);
  });

  it('only gives you one more stretch from a glitchy block', () => {
    // Glitchy blocks over a gap of water: one is a fine stepping stone, but
    // hopping from one to the next would need perfect timing.
    const one = [
      'IIIIIIIIIIIIIII',
      '#.............#',
      '#.............#',
      '#S.....?.....E#',
      '####WWWWWWW####',
    ];
    expect(solveLevel(parseLevel({ id: 't', type: 'normal', map: one })).exit).toBe(true);
    const two = [
      'IIIIIIIIIIIIIIIIIIII',
      '#..................#',
      '#..................#',
      '#S.....?...?......E#',
      '####WWWWWWWWWWW#####',
    ];
    expect(solveLevel(parseLevel({ id: 't', type: 'normal', map: two })).exit).toBe(false);
    // (With plain walls there instead, it's easy.)
    const walls = two.map(row => row.replace(/\?/g, '#'));
    expect(solveLevel(parseLevel({ id: 't', type: 'normal', map: walls })).exit).toBe(true);
  });

  it('counts pop-up windows as open, with the same one-more-stretch rule', () => {
    const map = [
      'IIIIIIIIIIIIIIII',
      '#..............#',
      '#.............E#',
      '#S.........#####',
      '####WWWWWWW#####',
    ];
    const one = { id: 't', type: 'normal', popups: [{ at: [7, 3], width: 3 }], map };
    expect(solveLevel(parseLevel(one)).exit).toBe(true);
    expect(solveLevel(parseLevel({ id: 't', type: 'normal', map })).exit).toBe(false);
  });

  it('falls through a glitchy block when it vanishes', () => {
    const map = ['#######', '#S....#', '###?###', '#.....#', '#....E#', '#######'];
    expect(solveLevel(parseLevel({ id: 't', type: 'normal', map })).exit).toBe(true);
  });
});
