import { describe, expect, it } from 'vitest';
import { parseLevel, TileKind } from './level.js';
import { Slime } from './slime.js';
import { CanyonStuff, CRUMBLE_TIME, REGROW_TIME, windAmount } from './canyon.js';

function slimeAt(x, y) {
  const slime = new Slime({ x, y });
  slime.falling = null;
  return slime;
}

function run(canyon, slime, seconds, level) {
  const hits = [];
  for (let t = 0; t < seconds; t += 1 / 60) {
    slime.update(1 / 60, level);
    const hit = canyon.update(1 / 60, slime);
    if (hit) {
      hits.push(hit);
    }
  }
  return hits;
}

describe('crumbling rocks', () => {
  const map = ['########', '#.....E#', '#......#', '#.S....#', '#XXXXXX#', '########'];

  it('crumble 3 seconds after you stick, then grow back', () => {
    const level = parseLevel({ id: 'crumble', type: 'normal', map });
    const canyon = new CanyonStuff(level);
    // Sitting on the crumbling floor.
    const slime = slimeAt(3.5 * 48, 4 * 48 - 15);
    run(canyon, slime, CRUMBLE_TIME - 0.2, level);
    expect(level.tiles[4][3]).toBe(TileKind.CRUMBLE);
    run(canyon, slime, 0.4, level);
    expect(level.tiles[4][3]).toBe(TileKind.EMPTY);
    expect(canyon.takeEvents()).toContain('crumble');
    // With nothing to hold onto, the slime falls.
    expect(slime.isFalling).toBe(true);
    slime.falling = null;
    slime.spawn({ x: 6 * 48 + 24, y: 48 + 24 });
    slime.falling = null;
    run(canyon, slime, REGROW_TIME + 0.2, level);
    expect(level.tiles[4][3]).toBe(TileKind.CRUMBLE);
  });

  it('an end that loses its rock boings back to the other end', () => {
    const level = parseLevel({ id: 'crumble2', type: 'normal', map });
    const canyon = new CanyonStuff(level);
    const slime = slimeAt(3.5 * 48, 4 * 48 - 15);
    // Other end hanging on the solid left wall.
    slime.ends[1].x = 48 + 15;
    slime.ends[1].y = 2.5 * 48;
    // Only the crumble under end 0 matters here; keep the left wall end safe.
    run(canyon, slime, CRUMBLE_TIME + 0.2, level);
    expect(slime.isFalling).toBe(false);
    expect(slime.ends[0].state === 'snapping' || slime.stretch < 1).toBe(true);
  });
});

describe('keys and laser gates', () => {
  const map = ['##########', '#.......E#', '#.S.1..a.#', '##########'];

  it('a gate zaps you if you do not have its key', () => {
    const level = parseLevel({ id: 'gate', type: 'normal', map });
    const canyon = new CanyonStuff(level);
    const slime = slimeAt(7.5 * 48, 2.5 * 48);
    expect(canyon.update(1 / 60, slime)).toBe('gate');
  });

  it('carrying the key turns the gate off for good', () => {
    const level = parseLevel({ id: 'gate2', type: 'normal', map });
    const canyon = new CanyonStuff(level);
    const slime = slimeAt(4.5 * 48, 2.5 * 48);
    canyon.update(1 / 60, slime);
    expect(canyon.carried).toEqual(['red']);
    slime.ends.forEach(e => {
      e.x = 7.5 * 48;
    });
    expect(canyon.update(1 / 60, slime)).toBe(null);
    expect(canyon.gates[0].open).toBe(true);
    expect(canyon.carried).toEqual([]);
    expect(canyon.update(1 / 60, slime)).toBe(null);
  });

  it('a key of the wrong color does not open a gate', () => {
    const level = parseLevel({
      id: 'gate3',
      type: 'normal',
      map: ['##########', '#.......E#', '#.S.2..a.#', '##########'],
    });
    const canyon = new CanyonStuff(level);
    const slime = slimeAt(4.5 * 48, 2.5 * 48);
    canyon.update(1 / 60, slime);
    slime.ends.forEach(e => {
      e.x = 7.5 * 48;
    });
    expect(canyon.update(1 / 60, slime)).toBe('gate');
  });
});

describe('metal boxes', () => {
  it('eating a box removes it and gives you what was inside', () => {
    const level = parseLevel({
      id: 'box',
      type: 'normal',
      boxItems: ['key-blue', 'token'],
      map: ['########', '#..M..M#', '#S....E#', '########'],
    });
    const canyon = new CanyonStuff(level);
    expect(level.tokens[0].inBox).toBe(1);
    canyon.eatBox(0);
    expect(level.tiles[1][3]).toBe(TileKind.EMPTY);
    expect(canyon.carried).toEqual(['blue']);
    expect(canyon.eatBox(1)).toBe('token');
    expect(canyon.eatBox(1)).toBe(null);
  });
});

describe('boulders', () => {
  it('fall from ceiling cracks and crush a slime underneath', () => {
    const level = parseLevel({
      id: 'boulder',
      type: 'normal',
      boulderEvery: 2,
      map: ['###O###', '#E....#', '#.....#', '#.....#', '#..S..#', '#######'],
    });
    const canyon = new CanyonStuff(level);
    const slime = slimeAt(3.5 * 48, 5 * 48 - 15);
    const hits = run(canyon, slime, 4, level);
    expect(hits).toContain('boulder');
    expect(canyon.crushedBy).toBeTruthy();
  });

  it('miss a slime that is out of the way', () => {
    const level = parseLevel({
      id: 'boulder2',
      type: 'normal',
      boulderEvery: 2,
      map: ['###O###', '#....E#', '#.....#', '#.....#', '#S....#', '#######'],
    });
    const canyon = new CanyonStuff(level);
    const slime = slimeAt(1.5 * 48, 5 * 48 - 15);
    expect(run(canyon, slime, 4, level)).toEqual([]);
    expect(canyon.takeEvents()).toContain('thud');
  });
});

describe('wind', () => {
  it('blows in gusts', () => {
    const wind = { every: 5, gust: 2, strength: 90, dir: 1 };
    expect(windAmount(wind, 1)).toBeCloseTo(1, 5);
    expect(windAmount(wind, 3)).toBe(0);
    expect(windAmount(null, 1)).toBe(0);
  });

  it('pushes the end you are dragging', () => {
    const level = parseLevel({
      id: 'wind',
      type: 'normal',
      map: ['##########', '#.......E#', '#........#', '#...S....#', '##########'],
    });
    const calm = slimeAt(4.5 * 48, 4 * 48 - 15);
    const windy = slimeAt(4.5 * 48, 4 * 48 - 15);
    windy.wind.x = 80;
    for (const s of [calm, windy]) {
      s.grab(s.ends[0], 0);
      for (let i = 0; i < 60; i++) {
        s.moveFinger({ x: 4.5 * 48, y: 2 * 48 }, i / 60);
        s.update(1 / 60, level);
      }
    }
    expect(windy.heldEnd.x - calm.heldEnd.x).toBeGreaterThan(50);
  });
});
