import { describe, expect, it } from 'vitest';
import { parseLevel } from './level.js';
import { buildLasers, chaserPosition, findHazard, laserState } from './hazards.js';
import { Slime } from './slime.js';

const level = parseLevel({
  id: 'hazards',
  type: 'normal',
  laserTimings: [{ on: 1, off: 2 }],
  map: ['##########', '#...d....#', '#........#', '#.S....E.#', '####WW####', '##########'],
});

function slimeAt(x, y) {
  const slime = new Slime({ x, y });
  slime.falling = null;
  return slime;
}

describe('lasers', () => {
  it('fire from the emitter down until they hit a wall (they go through water)', () => {
    const [laser] = buildLasers(level);
    expect(laser.from).toEqual({ x: 4.5 * 48, y: 2 * 48 });
    expect(laser.to).toEqual({ x: 4.5 * 48, y: 5 * 48 });
  });

  it('blink on, then off, with a warning before turning on', () => {
    const [laser] = buildLasers(level);
    expect(laserState(laser, 0.5)).toBe('on');
    expect(laserState(laser, 1.5)).toBe('off');
    expect(laserState(laser, 2.8)).toBe('warn');
    expect(laserState(laser, 3.2)).toBe('on');
  });

  it('only hurt the slime when on', () => {
    const lasers = buildLasers(level);
    const slime = slimeAt(4.5 * 48, 3.5 * 48);
    expect(findHazard(level, slime, lasers, 0.5, null)).toBe('laser');
    expect(findHazard(level, slime, lasers, 1.5, null)).toBe(null);
  });
});

describe('fluids', () => {
  it('water hurts, spikes do not', () => {
    const lasers = [];
    expect(findHazard(level, slimeAt(4.8 * 48, 4.2 * 48), lasers, 0, null)).toBe('fluid');
    const spikes = parseLevel({ id: 's', type: 'normal', map: ['####', '#S^E', '####'] });
    expect(findHazard(spikes, slimeAt(2.5 * 48, 1.6 * 48), lasers, 0, null)).toBe(null);
  });
});

describe('chasers', () => {
  it('rising water starts below the level and comes up after the delay', () => {
    const chaser = { kind: 'rise', delay: 2, speed: 10 };
    expect(chaserPosition(chaser, level, 1).y).toBe(level.pixelHeight + 48);
    expect(chaserPosition(chaser, level, 12).y).toBe(level.pixelHeight + 48 - 100);
  });

  it('a rolling snowball catches a slime it reaches', () => {
    const chaser = { kind: 'roll', delay: 0, speed: 100, row: 3, radius: 1 };
    const slime = slimeAt(2.5 * 48, 3.6 * 48);
    expect(findHazard(level, slime, [], 0, chaser)).toBe(null);
    expect(findHazard(level, slime, [], 1.6, chaser)).toBe('chaser');
  });
});
