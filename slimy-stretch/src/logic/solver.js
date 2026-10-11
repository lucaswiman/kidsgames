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
import { TileKind } from './level.js';
import { canReach } from './slime.js';
import { TONGUE_RADIUS, touchesBox } from './tongue.js';
import { CANNON_ENTER, CLAW_HANG, CLAW_RADIUS, simulateDrop, simulateShot } from './warehouse.js';

const CANNON_ANGLES = 72;

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

/** Where the slime lands after being dropped at `p` (one-way platforms catch it). */
export function dropPoint(level, p) {
  return (
    simulateDrop(level, p) ||
    castCircle(level, p, { x: p.x, y: level.pixelHeight + TILE * 4 }, END_RADIUS, 2)
  );
}

function explore(level) {
  const blockers = buildLasers(level).filter(l => l.off <= 0);
  const safe = (a, b) =>
    a.y <= level.pixelHeight &&
    b.y <= level.pixelHeight &&
    !segmentTouchesDeadly(level, a, b, END_RADIUS * 0.6, 8) &&
    !blockers.some(l => segmentSegmentDist(a, b, l.from, l.to) < END_RADIUS);

  const start = dropPoint(level, level.start);
  const seen = new Set();
  const key = p => `${Math.round(p.x / GRID)},${Math.round(p.y / GRID)}`;
  const reached = [];
  start.moves = 0;
  const queue = [start];
  seen.add(key(start));

  const visit = (spot, moves) => {
    if (spot && !seen.has(key(spot))) {
      seen.add(key(spot));
      spot.moves = moves;
      queue.push(spot);
    }
  };
  // Can the slime, stuck at `a`, stretch an end to touch point `q`?
  const canStretchTo = (a, q, radius) => {
    if (dist(a, q) > MAX_STRETCH + radius) {
      return false;
    }
    const tip = castCircle(level, a, clampToRange(a, q, MAX_STRETCH), END_RADIUS, 4);
    return dist(tip, q) < radius && safe(a, tip);
  };
  const cannonLandings = [];
  const landingsFor = i => {
    if (!cannonLandings[i]) {
      cannonLandings[i] = [];
      for (let k = 0; k < CANNON_ANGLES; k++) {
        const angle = -Math.PI + (k * 2 * Math.PI) / CANNON_ANGLES;
        const shot = simulateShot(level, level.cannons[i], angle);
        if (shot) {
          cannonLandings[i].push({ x: shot.x, y: shot.y });
        }
      }
    }
    return cannonLandings[i];
  };
  // Only nice claws count: mean ones drop you somewhere bad.
  const niceClaws = (level.def.claws || [])
    .filter(c => c.nice)
    .map(c => {
      const y = (c.row + 1) * TILE + CLAW_HANG;
      return { ...c, y, landing: simulateDrop(level, { x: (c.drop + 0.5) * TILE, y: y + 12 }) };
    });

  while (queue.length) {
    const anchor = queue.shift();
    reached.push(anchor);
    level.cannons.forEach((cannon, i) => {
      if (canStretchTo(anchor, cannon, CANNON_ENTER)) {
        for (const spot of landingsFor(i)) {
          visit({ ...spot }, anchor.moves + 2);
        }
      }
    });
    for (const claw of niceClaws) {
      if (!claw.landing || seen.has(key(claw.landing))) {
        continue;
      }
      for (let col = claw.from; col <= claw.to; col++) {
        if (canStretchTo(anchor, { x: (col + 0.5) * TILE, y: claw.y }, CLAW_RADIUS + END_RADIUS)) {
          visit({ ...claw.landing }, anchor.moves + 2);
          break;
        }
      }
    }
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

  return { start, reached, movesTo, canTouch, safe };
}

/** A copy of the level with eaten boxes removed and gates open or (deadly) closed. */
function levelView(level, eaten, openColors) {
  const tiles = level.tiles.map(row => row.slice());
  level.boxes.forEach((b, i) => {
    if (eaten.has(i)) {
      tiles[b.row][b.col] = TileKind.EMPTY;
    }
  });
  for (const g of level.gates) {
    // A closed gate zaps you, which the checker treats like lava.
    tiles[g.row][g.col] = openColors.has(g.color) ? TileKind.EMPTY : TileKind.LAVA;
  }
  return { ...level, tiles };
}

export function solveLevel(level) {
  // Keep exploring until no new box can be eaten and no new gate opened.
  const eaten = new Set();
  const openColors = new Set();
  let view;
  let result;
  for (;;) {
    view = levelView(level, eaten, openColors);
    result = explore(view);
    let changed = false;
    level.boxes.forEach((box, i) => {
      if (!eaten.has(i) && tongueCanReach(view, result.reached, box, result.safe)) {
        eaten.add(i);
        changed = true;
      }
    });
    for (const key of level.keys) {
      const got =
        key.inBox !== undefined ? eaten.has(key.inBox) : result.canTouch(key, ITEM_RADIUS);
      if (got && !openColors.has(key.color)) {
        openColors.add(key.color);
        changed = true;
      }
    }
    if (!changed) {
      break;
    }
  }
  const item = (it, radius) =>
    it.inBox !== undefined ? eaten.has(it.inBox) : result.canTouch(it, radius);
  return {
    start: result.start,
    reached: result.reached,
    exit: level.exit ? result.canTouch(level.exit, TILE / 2) : true,
    exitMoves: level.exit ? result.movesTo(level.exit, TILE / 2) : 0,
    tokens: level.tokens.map(t => item(t, ITEM_RADIUS)),
    cores: level.cores.map(c => item(c, ITEM_RADIUS)),
    checkpoints: level.checkpoints.map(c => result.canTouch(c, TILE / 2)),
    keys: level.keys.map(k => item(k, ITEM_RADIUS)),
    boxes: level.boxes.map((_b, i) => eaten.has(i)),
  };
}

/** Can the tongue reach `box` from any spot the slime can get to? */
function tongueCanReach(level, reached, box, safe) {
  return reached.some(a => {
    if (dist(a, box) > MAX_STRETCH + TILE) {
      return false;
    }
    const tip = castCircle(level, a, clampToRange(a, box, MAX_STRETCH), TONGUE_RADIUS, 4);
    return touchesBox(tip, box) && safe(a, tip);
  });
}
