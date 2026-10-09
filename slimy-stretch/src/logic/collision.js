import { TILE } from './constants.js';
import { isDeadlyKind, isSolidKind, isStickyKind, tileAt, tileAtPoint } from './level.js';

export function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Move `point` toward `anchor` until it is no farther than `maxDist` away. */
export function clampToRange(anchor, point, maxDist) {
  const d = dist(anchor, point);
  if (d <= maxDist) {
    return { x: point.x, y: point.y };
  }
  const t = maxDist / d;
  return { x: anchor.x + (point.x - anchor.x) * t, y: anchor.y + (point.y - anchor.y) * t };
}

/** True if a circle overlaps any tile for which `test(kind)` is true. */
export function circleTouches(level, p, r, test) {
  const minCol = Math.floor((p.x - r) / TILE);
  const maxCol = Math.floor((p.x + r) / TILE);
  const minRow = Math.floor((p.y - r) / TILE);
  const maxRow = Math.floor((p.y + r) / TILE);
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      if (!test(tileAt(level, col, row))) {
        continue;
      }
      // Closest point on this tile's square to the circle center.
      const cx = Math.max(col * TILE, Math.min(p.x, (col + 1) * TILE));
      const cy = Math.max(row * TILE, Math.min(p.y, (row + 1) * TILE));
      if ((p.x - cx) ** 2 + (p.y - cy) ** 2 < r * r) {
        return true;
      }
    }
  }
  return false;
}

export function circleHitsSolid(level, p, r) {
  return circleTouches(level, p, r, isSolidKind);
}

export function circleHitsDeadly(level, p, r) {
  return circleTouches(level, p, r, isDeadlyKind);
}

/**
 * Slide a circle of radius `r` from `from` toward `to` and return the last
 * spot where it still fits without overlapping a solid tile.
 */
export function castCircle(level, from, to, r, step = 2) {
  const d = dist(from, to);
  const steps = Math.max(1, Math.ceil(d / step));
  let last = { x: from.x, y: from.y };
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const p = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
    if (circleHitsSolid(level, p, r)) {
      return last;
    }
    last = p;
  }
  return last;
}

/** True if the circle at `p` is resting against a sticky surface. */
export function isTouchingSticky(level, p, r, margin = 4) {
  return circleTouches(level, p, r + margin, isStickyKind);
}

const SEARCH_DIRS = [];
for (let i = 0; i < 16; i++) {
  const a = (i / 16) * Math.PI * 2;
  SEARCH_DIRS.push({ x: Math.cos(a), y: Math.sin(a) });
}

/**
 * Find where a released end should stick. If it is already against a sticky
 * wall it stays put. Otherwise look a short distance around for one, so kids
 * don't have to be pixel-perfect. Returns null if nothing sticky is nearby.
 * `allowed(p)` can reject spots (for example, too far from the other end).
 */
export function findStickSpot(level, p, r, searchDist, allowed = () => true) {
  if (isTouchingSticky(level, p, r) && allowed(p)) {
    return { x: p.x, y: p.y };
  }
  let best = null;
  let bestDist = Infinity;
  for (const dir of SEARCH_DIRS) {
    const target = { x: p.x + dir.x * searchDist, y: p.y + dir.y * searchDist };
    const spot = castCircle(level, p, target, r);
    const d = dist(p, spot);
    if (d < bestDist && isTouchingSticky(level, spot, r) && allowed(spot)) {
      best = spot;
      bestDist = d;
    }
  }
  return best;
}

/** True if any point along the segment (thickened by `r`) touches a deadly tile. */
export function segmentTouchesDeadly(level, a, b, r, step = 6) {
  const d = dist(a, b);
  const steps = Math.max(1, Math.ceil(d / step));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    if (circleHitsDeadly(level, p, r)) {
      return true;
    }
  }
  return false;
}

/** Shortest distance from point `p` to segment `ab`. */
export function pointSegmentDist(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  let t = len2 === 0 ? 0 : ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t));
}

function segmentsIntersect(a, b, c, d) {
  const cross = (o, p, q) => (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x);
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** Shortest distance between segments `ab` and `cd`. */
export function segmentSegmentDist(a, b, c, d) {
  if (segmentsIntersect(a, b, c, d)) {
    return 0;
  }
  return Math.min(
    pointSegmentDist(a, c, d),
    pointSegmentDist(b, c, d),
    pointSegmentDist(c, a, b),
    pointSegmentDist(d, a, b)
  );
}

/** How many pixels of the straight line from `a` to `b` pass through solid tiles. */
export function solidLengthBetween(level, a, b, step = 3) {
  const d = dist(a, b);
  const steps = Math.max(1, Math.ceil(d / step));
  let inside = 0;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (isSolidKind(tileAtPoint(level, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t))) {
      inside++;
    }
  }
  return (inside * d) / steps;
}
