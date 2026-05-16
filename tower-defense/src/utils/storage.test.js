import { loadHighScore, saveHighScore } from './storage.js';

beforeEach(() => {
  localStorage.clear();
});

describe('loadHighScore', () => {
  it('returns 0 when localStorage is empty', () => {
    expect(loadHighScore()).toBe(0);
  });
});

describe('saveHighScore / loadHighScore', () => {
  it('saves a score and retrieves it', () => {
    saveHighScore(5);
    expect(loadHighScore()).toBe(5);
  });

  it('does not overwrite a higher score with a lower one', () => {
    saveHighScore(5);
    saveHighScore(3);
    expect(loadHighScore()).toBe(5);
  });

  it('updates to a higher score', () => {
    saveHighScore(5);
    saveHighScore(7);
    expect(loadHighScore()).toBe(7);
  });
});
