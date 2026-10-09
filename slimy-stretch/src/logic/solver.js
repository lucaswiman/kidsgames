import { END_RADIUS, ITEM_RADIUS, MAX_STRETCH, STICK_SEARCH, TILE } from './constants.js';
import {
  castCircle,
  clampToRange,
  dist,
  findStickSpot,
  segmentSegmentDist,
  segmentTouchesDeadly,
} from './collision.js';
import { buildLasers } from './hazards.js';
import { canReach } from './slime.js';

/**
 * Checks that a level can be finished, by playing it the way a kid would:
 * from every spot the slime can stick, try stretching in lots of directions
 * and letting go, using the same sticking rules as the real game. Timed
 * lasers and chasers are ignored (you can wait for a laser to turn off), but
 * always-on lasers block.
 */

const DIRECTIONS = 32;
const REACHES = [50, 100, 150, MAX_STRETCH];
const GRID = 10;

/** Where the slime lands after being dropped at `p`. */
export function dropPoint(level, p) {
  return castCircle(level, p, { x: p.x, y: level.pixelHeight + TILE * 4 }, END_RADIUS, 2);
}

export function solveLevel(level) {
  const blockers = buildLasers(level).filter(l => l.off <= 0);
  const safe = (a, b) =>
    !segmentTouchesDeadly(level, a, b, END_RADIUS * 0.6, 8) &&
    !blockers.some(l => segmentSegmentDist(a, b, l.from, l.to) < END_RADIUS);

  const start = dropPoint(level, level.start);
  const seen = new Set();
  const key = p => `${Math.round(p.x / GRID)},${Math.round(p.y / GRID)}`;
  const reached = [];
  start.moves = 0;
  const queue = [start];
  seen.add(key(start));

  while (queue.length) {
    const anchor = queue.shift();
    reached.push(anchor);
    const allowed = p => canReach(level, anchor, p) && safe(anchor, p);
    for (let i = 0; i < DIRECTIONS; i++) {
      const angle = (i / DIRECTIONS) * Math.PI * 2;
      for (const reach of REACHES) {
        const target = {
          x: anchor.x + Math.cos(angle) * reach,
          y: anchor.y + Math.sin(angle) * reach,
        };
        const tip = castCircle(level, anchor, target, END_RADIUS, 4);
        if (!safe(anchor, tip)) {
          continue;
        }
        const spot = findStickSpot(level, tip, END_RADIUS, STICK_SEARCH, allowed);
        if (spot && !seen.has(key(spot))) {
          seen.add(key(spot));
          // Each new spot takes two drags: stretch out, then pull the tail over.
          spot.moves = anchor.moves + 2;
          queue.push(spot);
        }
      }
    }
  }

  // Fewest drags needed to touch `target`, or Infinity if it can't be reached.
  const movesTo = (target, radius) => {
    let best = Infinity;
    for (const a of reached) {
      if (a.moves + 1 >= best || dist(a, target) > MAX_STRETCH + radius + END_RADIUS) {
        continue;
      }
      const tip = castCircle(level, a, clampToRange(a, target, MAX_STRETCH), END_RADIUS, 4);
      if (dist(tip, target) < radius + END_RADIUS && safe(a, tip)) {
        best = a.moves + 1;
      }
    }
    return best;
  };
  const canTouch = (target, radius) => movesTo(target, radius) < Infinity;

  return {
    start,
    reached,
    exit: level.exit ? canTouch(level.exit, TILE / 2) : true,
    exitMoves: level.exit ? movesTo(level.exit, TILE / 2) : 0,
    tokens: level.tokens.map(t => canTouch(t, ITEM_RADIUS)),
    cores: level.cores.map(c => canTouch(c, ITEM_RADIUS)),
    checkpoints: level.checkpoints.map(c => canTouch(c, TILE / 2)),
  };
}
