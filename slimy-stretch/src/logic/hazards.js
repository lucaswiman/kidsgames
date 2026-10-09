import { END_RADIUS, TILE } from './constants.js';
import { dist, pointSegmentDist, segmentTouchesDeadly } from './collision.js';
import { isSolidKind, tileAt } from './level.js';

const LASER_WARN_TIME = 0.5;
const DEFAULT_LASER_TIMING = { on: 2, off: 2, offset: 0 };

/**
 * Build the lasers for a level. Each beam starts at its emitter and goes
 * until it hits something solid. `def.laserTimings[i]` sets how long the
 * i-th laser (in reading order) stays on and off.
 */
export function buildLasers(level) {
  const timings = level.def.laserTimings || [];
  return level.lasers.map((laser, i) => {
    let col = laser.col + laser.dx;
    let row = laser.row + laser.dy;
    while (!isSolidKind(tileAt(level, col, row)) && row < level.height) {
      col += laser.dx;
      row += laser.dy;
    }
    const half = TILE / 2;
    const ex = (laser.col + 0.5) * TILE;
    const ey = (laser.row + 0.5) * TILE;
    const hx = (col + 0.5) * TILE;
    const hy = (row + 0.5) * TILE;
    return {
      ...laser,
      ...DEFAULT_LASER_TIMING,
      ...timings[i],
      from: { x: ex + laser.dx * half, y: ey + laser.dy * half },
      to: { x: hx - laser.dx * half, y: hy - laser.dy * half },
    };
  });
}

/** 'on', 'warn' (about to turn on) or 'off'. */
export function laserState(laser, time) {
  if (laser.off <= 0) {
    return 'on';
  }
  const period = laser.on + laser.off;
  const t = (((time + laser.offset) % period) + period) % period;
  if (t < laser.on) {
    return 'on';
  }
  return t > period - LASER_WARN_TIME ? 'warn' : 'off';
}

/** Where the chasing hazard is at `time` seconds into the level. */
export function chaserPosition(chaser, level, time) {
  const t = Math.max(0, time - (chaser.delay || 0));
  if (chaser.kind === 'rise') {
    // `y` is the top surface of the rising water or lava.
    const startY = level.pixelHeight + TILE;
    return { y: Math.max(chaser.stopY ?? -Infinity, startY - chaser.speed * t) };
  }
  // A rolling ball moving right along row `row`.
  const radius = chaser.radius * TILE;
  return { x: -radius + chaser.speed * t, y: (chaser.row + 1) * TILE - radius, radius };
}

function pointHitByChaser(chaser, pos, p) {
  if (chaser.kind === 'rise') {
    return p.y + END_RADIUS * 0.5 > pos.y;
  }
  return dist(p, pos) < pos.radius + END_RADIUS * 0.6;
}

/**
 * What (if anything) is hurting the slime right now.
 * Returns 'fluid' (lava/water), 'laser', 'chaser', 'fell' or null.
 */
export function findHazard(level, slime, lasers, time, chaser) {
  const [a, b] = slime.ends;
  if (segmentTouchesDeadly(level, a, b, END_RADIUS * 0.6)) {
    return 'fluid';
  }
  for (const laser of lasers) {
    if (laserState(laser, time) !== 'on') {
      continue;
    }
    // Close enough to the beam either at an end or along the stretchy body.
    const hit =
      pointSegmentDist(a, laser.from, laser.to) < END_RADIUS ||
      pointSegmentDist(b, laser.from, laser.to) < END_RADIUS ||
      segmentHitsBeam(a, b, laser);
    if (hit) {
      return 'laser';
    }
  }
  if (chaser) {
    const pos = chaserPosition(chaser, level, time);
    if (slime.bodyPoints(12).some(p => pointHitByChaser(chaser, pos, p))) {
      return 'chaser';
    }
  }
  if (a.y > level.pixelHeight + TILE && b.y > level.pixelHeight + TILE) {
    return 'fell';
  }
  return null;
}

function segmentHitsBeam(a, b, laser) {
  // Sample the body; the body is thinner than the ends.
  const n = Math.max(1, Math.ceil(dist(a, b) / 8));
  for (let i = 1; i < n; i++) {
    const p = { x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n };
    if (pointSegmentDist(p, laser.from, laser.to) < 6) {
      return true;
    }
  }
  return false;
}

/** Indexes of items (tokens, cores, ...) the slime is touching. */
export function touchedItems(slime, items, radius) {
  const touched = [];
  const pts = slime.bodyPoints(10);
  items.forEach((item, i) => {
    if (item.taken) {
      return;
    }
    const isEnd = slime.ends.some(e => dist(e, item) < radius + END_RADIUS);
    if (isEnd || pts.some(p => dist(p, item) < radius + 4)) {
      touched.push(i);
    }
  });
  return touched;
}

/** True if either end is touching the exit door. */
export function touchingExit(slime, exit) {
  return slime.ends.some(
    e => Math.abs(e.x - exit.x) < TILE / 2 + END_RADIUS && Math.abs(e.y - exit.y) < TILE * 0.75
  );
}
