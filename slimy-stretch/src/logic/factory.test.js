import { describe, expect, it } from 'vitest';
import { parseLevel, TileKind } from './level.js';
import { Slime } from './slime.js';
import { FactoryStuff, simulateVent, ventState } from './factory.js';
import { TILE } from './constants.js';

function slimeAt(x, y) {
  const slime = new Slime({ x, y });
  slime.falling = null;
  return slime;
}

function run(factory, slime, level, seconds, blobs = []) {
  const hurts = [];
  for (let t = 0; t < seconds; t += 1 / 60) {
    slime.update(1 / 60, level);
    const h = factory.update(1 / 60, slime, blobs);
    if (h) {
      hurts.push(h);
    }
  }
  return hurts;
}

describe('stamping presses', () => {
  const map = ['###A####', '#......#', '#......#', '#......#', '#S....E#', '########'];

  it('squish a slime underneath them', () => {
    const level = parseLevel({ id: 'p', type: 'normal', map });
    const factory = new FactoryStuff(level);
    expect(run(factory, slimeAt(3.5 * TILE, 5 * TILE - 15), level, 4)).toContain('press');
  });

  it('leave a slime next to them alone', () => {
    const level = parseLevel({ id: 'p2', type: 'normal', map });
    const factory = new FactoryStuff(level);
    expect(run(factory, slimeAt(5.5 * TILE, 5 * TILE - 15), level, 6)).toEqual([]);
    expect(factory.presses[0].floor).toBe(5 * TILE);
  });
});

describe('saw blades', () => {
  it('roll back and forth along the floor and hurt', () => {
    const level = parseLevel({
      id: 's',
      type: 'normal',
      map: ['########', '#......#', '#S.o..E#', '########'],
    });
    const factory = new FactoryStuff(level);
    const saw = factory.saws[0];
    expect(saw.axis).toBe('x');
    const far = slimeAt(1.5 * TILE, 1.5 * TILE);
    const xs = [];
    for (let t = 0; t < 10; t += 1 / 60) {
      factory.update(1 / 60, far);
      xs.push(saw.x);
    }
    expect(Math.min(...xs)).toBeLessThan(2 * TILE);
    expect(Math.max(...xs)).toBeGreaterThan(6 * TILE);
    expect(factory.update(1 / 60, slimeAt(saw.x, saw.y))).toBe('saw');
  });

  it('roll up and down a wall', () => {
    const level = parseLevel({
      id: 's2',
      type: 'normal',
      map: ['#####', '#...#', '#o..#', '#...#', '#S.E#', '#####'],
    });
    const factory = new FactoryStuff(level);
    expect(factory.saws[0].axis).toBe('y');
  });
});

describe('steam vents', () => {
  const map = ['######', '#....#', '#.##.#', '#....#', '#....#', '#....#', '#S..E#', '##v###'];

  it('puff on and off', () => {
    expect(ventState({}, 0.5)).toBe('on');
    expect(ventState({}, 2)).toBe('off');
    expect(ventState({}, 3.3)).toBe('warn');
  });

  it('blast a slime up into the air to stick on whatever is above', () => {
    const level = parseLevel({ id: 'v', type: 'normal', map });
    const factory = new FactoryStuff(level);
    const slime = slimeAt(2.5 * TILE, 7 * TILE - 15);
    factory.update(1 / 60, slime);
    expect(slime.isFalling).toBe(true);
    const spot = simulateVent(level, { x: 2.5 * TILE, y: 7 * TILE - 15 });
    expect(spot.y).toBeLessThan(4 * TILE);
  });
});

describe('slime machines', () => {
  const def = {
    id: 'm',
    type: 'normal',
    slimeMachines: [{ at: [5, 3], shot: 'left', platform: { from: [2, 5], to: [2, 2], width: 2 } }],
    map: [
      '########',
      '#......#',
      '#......#',
      '#....I.#',
      '#......#',
      '#.##...#',
      '#S....E#',
      '########',
    ],
  };

  it('a slime shot in the shot side powers it, and its platform moves', () => {
    const level = parseLevel(def);
    const factory = new FactoryStuff(level);
    const m = factory.slimeMachines[0];
    const blob = { x: m.shotFace.x, y: m.shotFace.y, state: 'flying' };
    const slime = slimeAt(6.5 * TILE, 7 * TILE - 15);
    run(factory, slime, level, 5, [blob]);
    expect(m.powered).toBe(true);
    expect(blob.state).toBe('inMachine');
    expect(m.platform.at).toBe('to');
    expect(level.tiles[5][2]).toBe(TileKind.EMPTY);
    expect(level.tiles[2][2]).toBe(TileKind.LIFT);
  });

  it('climbing in the open side gets your blob back', () => {
    const level = parseLevel(def);
    const factory = new FactoryStuff(level);
    const m = factory.slimeMachines[0];
    const blob = { x: m.shotFace.x, y: m.shotFace.y, state: 'flying' };
    factory.update(1 / 60, slimeAt(TILE * 1.5, TILE * 6.5), [blob]);
    factory.update(1 / 60, slimeAt(m.openFace.x + 8, m.openFace.y), [blob]);
    expect(blob.gone).toBe(true);
    expect(m.powered).toBe(false);
  });
});
