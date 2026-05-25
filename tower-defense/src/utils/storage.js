const HIGH_SCORE_KEY = 'tower-defense-high-score';

export function saveHighScore(wave) {
  const current = loadHighScore();
  if (wave > current) {
    localStorage.setItem(HIGH_SCORE_KEY, String(wave));
  }
}

export function loadHighScore() {
  return parseInt(localStorage.getItem(HIGH_SCORE_KEY) ?? '0', 10);
}
