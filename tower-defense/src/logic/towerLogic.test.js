import { findTarget, canFire, nextCooldown } from './towerLogic.js';

function makeEnemy(x, y, { dead = false, reachedEnd = false } = {}) {
  return {
    x,
    y,
    isDead: () => dead,
    reachedEnd: () => reachedEnd,
  };
}

describe('findTarget', () => {
  it('returns null when enemies array is empty', () => {
    expect(findTarget(0, 0, [], 120)).toBeNull();
  });

  it('returns null when no enemy is within range', () => {
    const enemy = makeEnemy(300, 300);
    expect(findTarget(0, 0, [enemy], 120)).toBeNull();
  });

  it('returns the nearest in-range enemy', () => {
    const enemy = makeEnemy(50, 0);
    expect(findTarget(0, 0, [enemy], 120)).toBe(enemy);
  });

  it('skips dead enemies', () => {
    const dead = makeEnemy(10, 0, { dead: true });
    expect(findTarget(0, 0, [dead], 120)).toBeNull();
  });

  it('skips enemies that have reached the end', () => {
    const ended = makeEnemy(10, 0, { reachedEnd: true });
    expect(findTarget(0, 0, [ended], 120)).toBeNull();
  });

  it('picks the closer of two valid enemies', () => {
    const near = makeEnemy(30, 0);
    const far = makeEnemy(100, 0);
    expect(findTarget(0, 0, [far, near], 120)).toBe(near);
  });
});

describe('canFire', () => {
  it('returns true when cooldown has passed', () => {
    expect(canFire(500, 1000)).toBe(true);
  });

  it('returns false when still cooling down', () => {
    expect(canFire(1500, 1000)).toBe(false);
  });

  it('returns true at the exact moment cooldown expires', () => {
    expect(canFire(1000, 1000)).toBe(true);
  });
});

describe('nextCooldown', () => {
  it('returns now plus fireRate', () => {
    expect(nextCooldown(1000, 800)).toBe(1800);
  });
});
