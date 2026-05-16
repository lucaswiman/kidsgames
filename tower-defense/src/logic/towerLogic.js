function dist(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

export function findTarget(tx, ty, enemies, range) {
  let best = null;
  let bestDist = Infinity;
  for (const e of enemies) {
    if (e.isDead() || e.reachedEnd()) continue;
    const d = dist(tx, ty, e.x, e.y);
    if (d <= range && d < bestDist) {
      bestDist = d;
      best = e;
    }
  }
  return best;
}

export function canFire(cooldownUntil, now) {
  return now >= cooldownUntil;
}

export function nextCooldown(now, fireRate) {
  return now + fireRate;
}
