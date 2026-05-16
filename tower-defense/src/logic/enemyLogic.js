const BASE_HP = 60;
const BASE_SPEED = 80;
const BASE_REWARD = 10;

export function enemyStats(wave) {
  const hpScale = 1 + (wave - 1) * 0.3;
  return {
    hp: Math.round(BASE_HP * hpScale),
    maxHp: Math.round(BASE_HP * hpScale),
    speed: BASE_SPEED + wave * 5,
    reward: BASE_REWARD + wave * 2,
  };
}

export function advancePath(t, speed, pathLength, delta) {
  return Math.min(1, t + (speed * delta) / (pathLength * 1000));
}

export function hpRatio(hp, maxHp) {
  return Math.max(0, hp / maxHp);
}
