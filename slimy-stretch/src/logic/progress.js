// Remembers which levels are unlocked and the best score on each one.
// Storage can be missing (private browsing), so every access is guarded.

const KEY = 'slimy-stretch-progress-v1';

export function emptyProgress() {
  return { unlocked: 1, best: {}, muted: false };
}

export function loadProgress(storage = globalThis.localStorage) {
  try {
    const raw = storage && storage.getItem(KEY);
    if (!raw) {
      return emptyProgress();
    }
    return { ...emptyProgress(), ...JSON.parse(raw) };
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(progress, storage = globalThis.localStorage) {
  try {
    if (storage) {
      storage.setItem(KEY, JSON.stringify(progress));
    }
  } catch {
    // Nothing we can do; the game still works, it just won't remember.
  }
}

/** Score for finishing a level. Tokens are the main way to score more. */
export function scoreLevel({ tokens, seconds, deaths }) {
  const timeBonus = Math.max(0, 600 - Math.floor(seconds) * 5);
  return Math.max(100, 1000 + tokens * 250 + timeBonus - deaths * 50);
}

/** Record a finished level. Returns true if it was a new best score. */
export function recordFinish(progress, levelIndex, levelId, result) {
  progress.unlocked = Math.max(progress.unlocked, levelIndex + 2);
  const prev = progress.best[levelId];
  if (!prev || result.score > prev.score) {
    progress.best[levelId] = { score: result.score, tokens: result.tokens };
    return true;
  }
  return false;
}
