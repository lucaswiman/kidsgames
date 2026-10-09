import { describe, expect, it } from 'vitest';
import { emptyProgress, loadProgress, recordFinish, saveProgress, scoreLevel } from './progress.js';

function fakeStorage() {
  const data = {};
  return {
    getItem: k => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

describe('progress', () => {
  it('tokens raise the score', () => {
    const base = scoreLevel({ tokens: 0, seconds: 30, deaths: 0 });
    expect(scoreLevel({ tokens: 2, seconds: 30, deaths: 0 })).toBe(base + 500);
  });

  it('unlocks the next level and keeps the best score', () => {
    const p = emptyProgress();
    expect(recordFinish(p, 0, '1-1', { score: 1000, tokens: 1 })).toBe(true);
    expect(p.unlocked).toBe(2);
    expect(recordFinish(p, 0, '1-1', { score: 500, tokens: 0 })).toBe(false);
    expect(p.best['1-1'].score).toBe(1000);
  });

  it('saves and loads', () => {
    const storage = fakeStorage();
    const p = emptyProgress();
    p.unlocked = 5;
    saveProgress(p, storage);
    expect(loadProgress(storage).unlocked).toBe(5);
  });

  it('still works when storage is broken', () => {
    const broken = {
      getItem: () => {
        throw new Error('nope');
      },
      setItem: () => {
        throw new Error('nope');
      },
    };
    expect(loadProgress(broken)).toEqual(emptyProgress());
    expect(() => saveProgress(emptyProgress(), broken)).not.toThrow();
  });
});
