import { enemyStats, advancePath, hpRatio } from './enemyLogic.js';

describe('enemyStats', () => {
  it('returns baseline stats for wave 1', () => {
    const stats = enemyStats(1);
    expect(stats.hp).toBe(60);
    expect(stats.maxHp).toBe(60);
    expect(stats.speed).toBe(85);
    expect(stats.reward).toBe(12);
  });

  it('scales HP by 1.3 for wave 2', () => {
    const stats = enemyStats(2);
    expect(stats.hp).toBe(Math.round(60 * 1.3));
    expect(stats.maxHp).toBe(Math.round(60 * 1.3));
    expect(stats.speed).toBe(90);
    expect(stats.reward).toBe(14);
  });

  it('scales HP correctly for wave 5 (2.2x)', () => {
    const stats = enemyStats(5);
    expect(stats.hp).toBe(Math.round(60 * 2.2));
    expect(stats.maxHp).toBe(Math.round(60 * 2.2));
    expect(stats.speed).toBe(105);
    expect(stats.reward).toBe(20);
  });
});

describe('advancePath', () => {
  it('advances t correctly given speed, pathLength, delta', () => {
    // (80 * 16) / (400 * 1000) = 1280 / 400000 = 0.0032
    const result = advancePath(0, 80, 400, 16);
    expect(result).toBeCloseTo(0.0032, 6);
  });

  it('clamps to 1 when result would exceed 1', () => {
    // 0.999 + 0.0032 > 1, so result should be clamped to 1
    const result = advancePath(0.999, 80, 400, 16);
    expect(result).toBe(1);
  });

  it('stays at 1 when already at 1', () => {
    const result = advancePath(1, 80, 400, 16);
    expect(result).toBe(1);
  });
});

describe('hpRatio', () => {
  it('returns 1 when hp equals maxHp', () => {
    expect(hpRatio(60, 60)).toBe(1);
  });

  it('returns 0.5 when hp is half of maxHp', () => {
    expect(hpRatio(30, 60)).toBe(0.5);
  });

  it('returns 0 when hp is 0', () => {
    expect(hpRatio(0, 60)).toBe(0);
  });

  it('clamps to 0 when hp is negative', () => {
    expect(hpRatio(-5, 60)).toBe(0);
  });
});
