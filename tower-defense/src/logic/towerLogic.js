function dist(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

// Returns the closest living enemy within range, or null.
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

// Returns true when the tower is ready to fire.
export function canFire(cooldownUntil, now) {
  return now >= cooldownUntil;
}

// Returns the next cooldown timestamp.
export function nextCooldown(now, fireRate) {
  return now + fireRate;
}
