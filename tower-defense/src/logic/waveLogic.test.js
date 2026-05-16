import { enemiesForWave, SPAWN_INTERVAL_MS } from './waveLogic.js';

describe('enemiesForWave', () => {
  it('returns 7 for wave 1', () => {
    expect(enemiesForWave(1)).toBe(7);
  });

  it('returns 9 for wave 2', () => {
    expect(enemiesForWave(2)).toBe(9);
  });

  it('returns 25 for wave 10', () => {
    expect(enemiesForWave(10)).toBe(25);
  });

  it('each wave spawns more enemies than the previous', () => {
    for (let wave = 1; wave < 10; wave++) {
      expect(enemiesForWave(wave + 1)).toBeGreaterThan(enemiesForWave(wave));
    }
  });
});

describe('SPAWN_INTERVAL_MS', () => {
  it('is 600', () => {
    expect(SPAWN_INTERVAL_MS).toBe(600);
  });
});
