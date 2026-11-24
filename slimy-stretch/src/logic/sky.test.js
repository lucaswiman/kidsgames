import { describe, expect, it } from 'vitest';
import { isPlatformKind, isSolidKind, isStickyKind, parseLevel, TileKind } from './level.js';
import { Slime } from './slime.js';
import { SlimeShots } from './slimeShot.js';
import { findHazard } from './hazards.js';
import { END_RADIUS, MAX_STRETCH, TILE } from './constants.js';
import { solveLevel } from './solver.js';
import { circleHitsSolid, findStickSpot } from './collision.js';
import {
  BASKET_SIT,
  FLUFF_SOFT,
  FLUFF_TIME,
  KITE_SINK,
  KITE_STRING,
  kiteHang,
  kiteLandings,
  LIGHTNING_EVERY,
  LIGHTNING_STAGGER,
  lightningState,
  RAINBOW_RIDE,
  rainbowArc,
  SkyStuff,
} from './sky.js';

function slimeAt(x, y) {
  const slime = new Slime({ x, y });
  slime.falling = null;
  return slime;
}

/** Run the slime and the sky together; returns the hurts that happened. */
function run(sky, slime, level, seconds, blobs = [], startTime = null) {
  const hurts = [];
  let time = startTime ?? sky.time;
  for (let t = 0; t < seconds; t += 1 / 60) {
    time += 1 / 60;
    slime.update(1 / 60, level);
    const h = sky.update(1 / 60, slime, blobs, time);
    if (h) {
      hurts.push(h);
    }
  }
  return hurts;
}

describe('the sky map', () => {
  it('knows lightning clouds, sleeping clouds, fluffy clouds and kites', () => {
    const level = parseLevel({
      id: 'sky',
      type: 'normal',
      map: ['..!...k..', '.........', '.@@..fff.', '.S.....E.', '#########'],
    });
    expect(level.tiles[0][2]).toBe(TileKind.STORM);
    expect(level.tiles[2][1]).toBe(TileKind.SLEEPY);
    expect(level.tiles[2][5]).toBe(TileKind.FLUFFY);
    expect(level.stormClouds).toHaveLength(1);
    expect(level.kites).toHaveLength(1);
    // Storm clouds and sleeping clouds are solid but slippery.
    expect(isSolidKind(TileKind.STORM)).toBe(true);
    expect(isStickyKind(TileKind.STORM)).toBe(false);
    expect(isSolidKind(TileKind.SLEEPY)).toBe(true);
    expect(isStickyKind(TileKind.SLEEPY)).toBe(false);
    // Fluffy clouds are one-way platforms; floating islands are solid and sticky.
    expect(isPlatformKind(TileKind.FLUFFY)).toBe(true);
    expect(isSolidKind(TileKind.SKY_ISLAND)).toBe(true);
    expect(isStickyKind(TileKind.SKY_ISLAND)).toBe(true);
  });

  it('lets you fall right out of the sky', () => {
    const level = parseLevel({ id: 'fall', type: 'normal', map: ['S....E', '......'] });
    const slime = new Slime(level.start);
    for (let t = 0; t < 2; t += 1 / 60) {
      slime.update(1 / 60, level);
    }
    expect(findHazard(level, slime, [], 0, null)).toBe('fell');
  });
});

describe('lightning clouds', () => {
  const map = [
    '...!......!...',
    '..............',
    '..............',
    '..............',
    '.S..........E.',
    '##############',
  ];

  it('flicker as a warning, then zap straight down', () => {
    const cloud = { offset: 0 };
    expect(lightningState(cloud, 1)).toBe('calm');
    expect(lightningState(cloud, LIGHTNING_EVERY - 1.2)).toBe('warn');
    expect(lightningState(cloud, LIGHTNING_EVERY - 0.3)).toBe('zap');
    expect(lightningState(cloud, LIGHTNING_EVERY + 1)).toBe('calm');
  });

  it('take turns, and the later ones wait before their first zap', () => {
    const level = parseLevel({ id: 'l0', type: 'normal', map });
    const sky = new SkyStuff(level);
    const [a, b] = sky.storms;
    expect(b.offset).toBe(LIGHTNING_STAGGER);
    for (let t = 0; t < 20; t += 0.05) {
      expect(lightningState(a, t) === 'zap' && lightningState(b, t) === 'zap').toBe(false);
    }
    expect(lightningState(b, LIGHTNING_EVERY - 0.3)).toBe('calm');
  });

  it('hurt a slime under the bolt, only while zapping', () => {
    const level = parseLevel({ id: 'l1', type: 'normal', map });
    const sky = new SkyStuff(level);
    const under = slimeAt(3.5 * TILE, 5 * TILE - END_RADIUS);
    // Calm, then the warning: nothing happens yet.
    expect(run(sky, under, level, LIGHTNING_EVERY - 0.7, [], 0)).toEqual([]);
    const events = sky.takeEvents().map(e => e.type);
    expect(events).toContain('rumble');
    expect(events).not.toContain('zap');
    expect(run(sky, under, level, 0.5)).toContain('lightning');
    expect(sky.storms[0].bottom).toBe(5 * TILE);
  });

  it('leave a slime next to the bolt alone', () => {
    const level = parseLevel({ id: 'l2', type: 'normal', map });
    const sky = new SkyStuff(level);
    const beside = slimeAt(5.5 * TILE, 5 * TILE - END_RADIUS);
    expect(run(sky, beside, level, LIGHTNING_EVERY * 3, [], 0)).toEqual([]);
  });

  it('stop at the first solid thing below them', () => {
    const level = parseLevel({
      id: 'l3',
      type: 'normal',
      map: ['...!....', '........', '...#....', '.S....E.', '########'],
    });
    const sky = new SkyStuff(level);
    expect(sky.storms[0].bottom).toBe(2 * TILE);
    // Hiding under the rock is safe.
    const hiding = slimeAt(3.5 * TILE, 4 * TILE - END_RADIUS);
    expect(run(sky, hiding, level, LIGHTNING_EVERY * 2, [], 0)).toEqual([]);
  });
});

describe('sleeping clouds', () => {
  const map = ['.....@@...', '.....@@...', '.....@@...', '.S...@@.E.', '##########'];

  it('block the way and you can not stick to them', () => {
    const level = parseLevel({ id: 'c0', type: 'normal', map });
    const sky = new SkyStuff(level);
    expect(sky.clouds).toHaveLength(1);
    expect(sky.clouds[0].tiles).toHaveLength(8);
    // Let go right next to it and there's nothing to stick to.
    expect(findStickSpot(level, { x: 5 * TILE - 16, y: 1.5 * TILE }, END_RADIUS, 34)).toBe(null);
    expect(circleHitsSolid(level, { x: 5.5 * TILE, y: 3.5 * TILE }, END_RADIUS)).toBe(true);
  });

  it('wake up when a slime shot hits them, fly away, and the blob comes back', () => {
    const level = parseLevel({ id: 'c1', type: 'normal', map });
    const sky = new SkyStuff(level);
    const slime = slimeAt(1.5 * TILE, 4 * TILE - END_RADIUS);
    const shots = new SlimeShots();
    shots.fire(slime.ends[0], { x: 6 * TILE, y: 2 * TILE });
    expect(shots.count).toBe(1);
    for (let t = 0; t < 1 && sky.clouds[0].state === 'asleep'; t += 1 / 60) {
      shots.update(1 / 60, level, slime);
      sky.update(1 / 60, slime, shots.blobs);
    }
    expect(sky.clouds[0].state).toBe('flying');
    // The blob is back, so the slime has its full reach right away.
    expect(shots.count).toBe(0);
    expect(shots.reach()).toBe(MAX_STRETCH);
    expect(sky.takeEvents().map(e => e.type)).toEqual(['wake', 'blobBack']);
    // Its tiles are empty now, and it floats up and off the top.
    expect(level.tiles[2][5]).toBe(TileKind.EMPTY);
    run(sky, slime, level, 4);
    expect(sky.clouds[0].state).toBe('gone');
    expect(solveLevel(level).exit).toBe(true);
  });

  it('wake up together: every tile of one cloud goes', () => {
    const level = parseLevel({ id: 'c2', type: 'normal', map });
    const sky = new SkyStuff(level);
    const blobs = [{ x: 5 * TILE - 10, y: 3.5 * TILE, state: 'falling' }];
    sky.update(1 / 60, slimeAt(TILE, TILE), blobs);
    for (const t of sky.clouds[0].tiles) {
      expect(level.tiles[t.row][t.col]).toBe(TileKind.EMPTY);
    }
    expect(blobs).toHaveLength(0);
  });

  it('can be woken by the level checker', () => {
    const level = parseLevel({ id: 'c3', type: 'normal', map });
    expect(solveLevel(level).sleepingClouds).toEqual([true]);
  });
});

describe('fluffy clouds', () => {
  const map = ['..........', '..........', '.S.ffff.E.', '##.....###', '##.....###', '##.....###'];
  const top = 2 * TILE;

  it('hold you up for a while, and you slowly sink in', () => {
    const level = parseLevel({ id: 'f0', type: 'normal', map });
    const sky = new SkyStuff(level);
    const slime = slimeAt(4.5 * TILE, top - END_RADIUS - 1);
    run(sky, slime, level, FLUFF_TIME * 0.6);
    expect(slime.isFalling).toBe(false);
    expect(slime.ends[0].y).toBeGreaterThan(top - END_RADIUS - 1 + 3);
    expect(sky.fluffSink(sky.fluffs[0])).toBeGreaterThan(0.5);
  });

  it('let you sink right through after 2 seconds, then firm up again', () => {
    const level = parseLevel({ id: 'f1', type: 'normal', map });
    const sky = new SkyStuff(level);
    const slime = slimeAt(4.5 * TILE, top - END_RADIUS - 1);
    run(sky, slime, level, FLUFF_TIME + 0.1);
    expect(sky.fluffs[0].state).toBe('soft');
    expect(level.tiles[2][4]).toBe(TileKind.EMPTY);
    expect(slime.isFalling).toBe(true);
    // The slime falls through and out of the sky; the cloud firms up again.
    run(sky, slime, level, FLUFF_SOFT);
    expect(sky.fluffs[0].state).toBe('firm');
    expect(level.tiles[2][4]).toBe(TileKind.FLUFFY);
  });

  it('only let go of you if you stay: moving off in time is safe', () => {
    const level = parseLevel({ id: 'f2', type: 'normal', map });
    const sky = new SkyStuff(level);
    const slime = slimeAt(4.5 * TILE, top - END_RADIUS - 1);
    run(sky, slime, level, FLUFF_TIME - 0.5);
    // Climb onto the wall next to it, and the timer starts over.
    slime.ends.forEach(e => {
      e.x = 8.5 * TILE;
      e.y = 3 * TILE - END_RADIUS - 1;
    });
    run(sky, slime, level, 0.2);
    expect(sky.fluffs[0].sat).toBe(0);
    expect(sky.fluffs[0].state).toBe('firm');
  });

  it('let just the end on them go when the other end is on a wall', () => {
    const level = parseLevel({ id: 'f3', type: 'normal', map });
    const sky = new SkyStuff(level);
    const slime = slimeAt(6.5 * TILE, top - END_RADIUS - 1);
    slime.ends[1].x = 8.5 * TILE;
    slime.ends[1].y = 3 * TILE - END_RADIUS - 1;
    run(sky, slime, level, FLUFF_TIME + 0.2);
    expect(slime.isFalling).toBe(false);
    expect(slime.ends[0].x).toBeCloseTo(8.5 * TILE);
  });
});

describe('hot air balloons', () => {
  const def = {
    id: 'b',
    type: 'normal',
    balloons: [
      {
        path: [
          [2, 4],
          [2, 1],
          [9, 1],
          [9, 3],
        ],
      },
    ],
    map: [
      '............',
      '............',
      '............',
      '............',
      '.S..........',
      '###......#E#',
      '.........###',
    ],
  };

  it('carry you along their path and drop you off at the end, then go back', () => {
    const level = parseLevel(def);
    const sky = new SkyStuff(level);
    const balloon = sky.balloons[0];
    expect(balloon.state).toBe('ready');
    const slime = slimeAt(1.5 * TILE, 5 * TILE - END_RADIUS);
    // Stretch an end over to the basket.
    slime.grab(slime.ends[0]);
    slime.moveFinger({ x: 2.5 * TILE, y: 4.5 * TILE });
    run(sky, slime, level, 0.3);
    expect(balloon.state).toBe('riding');
    expect(sky.ride).toEqual({ kind: 'balloon', index: 0 });
    expect(slime.frozen).toBe(true);
    // Halfway along it's high up in the air, with the slime in the basket.
    run(sky, slime, level, 2);
    expect(slime.ends[0].y).toBeCloseTo(balloon.y - BASKET_SIT);
    expect(balloon.y).toBeCloseTo(1.5 * TILE);
    // At the end it drops you off on the ledge.
    run(sky, slime, level, 3);
    expect(sky.takeEvents().map(e => e.type)).toEqual(['balloonGrab', 'balloonDrop']);
    expect(sky.ride).toBe(null);
    expect(slime.frozen).toBe(false);
    expect(slime.isFalling).toBe(false);
    expect(slime.ends[0].x).toBeCloseTo(9.5 * TILE);
    expect(slime.ends[0].y).toBeCloseTo(5 * TILE - END_RADIUS, -1);
    // Then it floats back to the start, empty.
    expect(balloon.state).toBe('return');
    run(sky, slime, level, 6);
    expect(balloon.state).toBe('ready');
    expect(balloon.x).toBeCloseTo(2.5 * TILE);
    expect(balloon.y).toBeCloseTo(4.5 * TILE);
  });

  it('are used by the level checker to get across', () => {
    const level = parseLevel(def);
    expect(solveLevel(level).exit).toBe(true);
    expect(solveLevel(parseLevel({ ...def, balloons: [] })).exit).toBe(false);
  });
});

describe('rainbow slides', () => {
  const def = {
    id: 'r',
    type: 'normal',
    rainbows: [{ from: [2, 4], to: [11, 4] }],
    map: [
      '..............',
      '..............',
      '..............',
      '..............',
      '.S............',
      '###........#E#',
      '...........###',
    ],
  };

  it('zoom you along the arc to the far end and drop you there', () => {
    const level = parseLevel(def);
    const sky = new SkyStuff(level);
    const slime = slimeAt(1.5 * TILE, 5 * TILE - END_RADIUS);
    slime.grab(slime.ends[0]);
    slime.moveFinger({ x: 2.5 * TILE, y: 4.5 * TILE });
    run(sky, slime, level, 0.3);
    expect(sky.ride).toEqual({ kind: 'rainbow', index: 0 });
    // Up over the top of the arc...
    const arc = rainbowArc(def.rainbows[0]);
    const highest = Math.min(...arc.map(p => p.y));
    let top = Infinity;
    for (let t = 0; t < 2 && sky.ride; t += 1 / 60) {
      run(sky, slime, level, 1 / 60);
      top = Math.min(top, slime.ends[0].y);
    }
    expect(top).toBeCloseTo(highest - RAINBOW_RIDE, -1);
    // ...and dropped off at the other end.
    run(sky, slime, level, 1);
    expect(sky.ride).toBe(null);
    expect(slime.isFalling).toBe(false);
    expect(slime.ends[0].x).toBeCloseTo(11.5 * TILE);
    expect(slime.ends[0].y).toBeCloseTo(5 * TILE - END_RADIUS, -1);
    expect(sky.takeEvents().map(e => e.type)).toEqual(['rainbowGrab', 'rainbowDrop']);
  });

  it('are used by the level checker to get across', () => {
    expect(solveLevel(parseLevel(def)).exit).toBe(true);
    expect(solveLevel(parseLevel({ ...def, rainbows: [] })).exit).toBe(false);
  });
});

describe('floating islands', () => {
  const def = {
    id: 'i',
    type: 'normal',
    islands: [{ from: [3, 5], to: [11, 5], width: 3 }],
    map: [
      '..................',
      '..................',
      '..................',
      '..................',
      '.S..............E.',
      '###............###',
      '..................',
    ],
  };

  it('float back and forth, solid and sticky where they are', () => {
    const level = parseLevel(def);
    const sky = new SkyStuff(level);
    const island = sky.islands[0];
    expect(level.tiles[5][3]).toBe(TileKind.SKY_ISLAND);
    expect(level.tiles[5][5]).toBe(TileKind.SKY_ISLAND);
    expect(level.tiles[5][6]).toBe(TileKind.EMPTY);
    const far = slimeAt(1.5 * TILE, 5 * TILE - END_RADIUS);
    run(sky, far, level, 1 + (4 * TILE) / 55);
    expect(island.x).toBeCloseTo(7 * TILE, -1);
    expect(level.tiles[5][3]).toBe(TileKind.EMPTY);
    expect(level.tiles[5][8]).toBe(TileKind.SKY_ISLAND);
    run(sky, far, level, (4 * TILE) / 55 + 0.5);
    expect(island.x).toBe(11 * TILE);
    // ...and back again.
    run(sky, far, level, 0.5 + (8 * TILE) / 55 + 0.5);
    expect(island.x).toBe(3 * TILE);
  });

  it('carry a slime stuck on top along with them', () => {
    const level = parseLevel(def);
    const sky = new SkyStuff(level);
    const slime = slimeAt(4.5 * TILE, 5 * TILE - END_RADIUS - 1);
    run(sky, slime, level, 1 + (8 * TILE) / 55 + 0.1);
    expect(sky.islands[0].x).toBe(11 * TILE);
    expect(slime.isFalling).toBe(false);
    expect(slime.ends[0].x).toBeCloseTo(12.5 * TILE, 0);
    expect(slime.ends[1].x).toBeCloseTo(12.5 * TILE, 0);
    expect(slime.ends[0].y).toBeCloseTo(5 * TILE - END_RADIUS - 1);
  });

  it('pull your other end off when they carry you too far', () => {
    const level = parseLevel(def);
    const sky = new SkyStuff(level);
    const slime = slimeAt(3.5 * TILE, 5 * TILE - END_RADIUS - 1);
    slime.ends[1].x = 2.5 * TILE;
    run(sky, slime, level, 6);
    expect(slime.isFalling).toBe(false);
    expect(Math.abs(slime.ends[0].x - slime.ends[1].x)).toBeLessThan(5);
  });

  it('can float up and down too, carrying a rider', () => {
    const level = parseLevel({
      ...def,
      islands: [{ from: [7, 5], to: [7, 1], width: 2 }],
    });
    const sky = new SkyStuff(level);
    const slime = slimeAt(8 * TILE, 5 * TILE - END_RADIUS - 1);
    run(sky, slime, level, 1 + (4 * TILE) / 55 + 0.1);
    expect(sky.islands[0].y).toBe(1 * TILE);
    expect(level.tiles[1][7]).toBe(TileKind.SKY_ISLAND);
    expect(level.tiles[5][7]).toBe(TileKind.EMPTY);
    expect(slime.isFalling).toBe(false);
    expect(slime.ends[0].y).toBeCloseTo(TILE - END_RADIUS - 1);
  });

  it('are used by the level checker to get across', () => {
    expect(solveLevel(parseLevel(def)).exit).toBe(true);
    expect(solveLevel(parseLevel({ ...def, islands: [] })).exit).toBe(false);
  });
});

describe('kites', () => {
  const wind = { every: 4, gust: 3, strength: 120, dir: 1 };
  const def = {
    id: 'k',
    type: 'normal',
    wind,
    map: [
      '....................',
      '..k.................',
      '....................',
      '....................',
      '....................',
      '....................',
      '.S................E.',
      '###...........######',
      '....................',
    ],
  };
  const grabKite = sky => {
    const slime = slimeAt(1.5 * TILE, 7 * TILE - END_RADIUS);
    const string = { x: sky.kites[0].x, y: sky.kites[0].y + KITE_STRING };
    slime.grab(slime.ends[0]);
    slime.moveFinger(string);
    return slime;
  };

  it('carry you along with the wind, staying up while it blows', () => {
    const level = parseLevel(def);
    const sky = new SkyStuff(level);
    const slime = grabKite(sky);
    // Grab it just as a gust starts.
    run(sky, slime, level, 0.3, [], wind.every - 0.3);
    expect(sky.onKite).toBe(true);
    const kite = sky.kites[0];
    const start = { x: kite.x, y: kite.y };
    run(sky, slime, level, 2);
    expect(kite.x).toBeGreaterThan(start.x + 2 * TILE);
    expect(kite.y).toBeCloseTo(start.y, -1);
    expect(slime.ends[0]).toMatchObject(kiteHang(kite));
  });

  it('slowly float down when the wind stops', () => {
    const level = parseLevel({ ...def, wind: { ...wind, gust: 1 } });
    const sky = new SkyStuff(level);
    const slime = grabKite(sky);
    run(sky, slime, level, 0.3, [], 1.2);
    expect(sky.onKite).toBe(true);
    const kite = sky.kites[0];
    const start = { x: kite.x, y: kite.y };
    run(sky, slime, level, 1);
    expect(kite.x).toBeCloseTo(start.x);
    expect(kite.y - start.y).toBeCloseTo(KITE_SINK, -1);
  });

  it('drop you when you let go, then float back home', () => {
    const level = parseLevel(def);
    const sky = new SkyStuff(level);
    const slime = grabKite(sky);
    run(sky, slime, level, 0.3, [], wind.every - 0.3);
    run(sky, slime, level, 1.5);
    expect(sky.letGoKite(slime)).toBe(true);
    expect(sky.onKite).toBe(false);
    expect(slime.isFalling).toBe(true);
    expect(sky.kites[0].state).toBe('return');
    run(sky, slime, level, 8);
    expect(sky.kites[0].state).toBe('ready');
    expect(sky.kites[0].x).toBe(sky.kites[0].home.x);
  });

  it('stick you to a sticky wall they blow you into', () => {
    const level = parseLevel({
      ...def,
      map: def.map.map((row, r) =>
        r >= 3 && r <= 5 ? row.slice(0, 10) + '#' + row.slice(11) : row
      ),
    });
    const sky = new SkyStuff(level);
    const slime = grabKite(sky);
    run(sky, slime, level, 0.3, [], wind.every - 0.3);
    run(sky, slime, level, 8);
    expect(sky.onKite).toBe(false);
    expect(slime.frozen).toBe(false);
    expect(slime.ends[0].x).toBeCloseTo(10 * TILE - END_RADIUS, -1);
    expect(sky.takeEvents().map(e => e.type)).toContain('kiteStick');
  });

  it('give the level checker places to land along the way', () => {
    const level = parseLevel(def);
    const landings = kiteLandings(level, level.kites[0], wind);
    expect(landings.some(p => p.x > 14 * TILE)).toBe(true);
    expect(solveLevel(level).exit).toBe(true);
    // No kite, no way across.
    const noKite = parseLevel({ ...def, map: def.map.map(row => row.replace('k', '.')) });
    expect(solveLevel(noKite).exit).toBe(false);
  });
});
