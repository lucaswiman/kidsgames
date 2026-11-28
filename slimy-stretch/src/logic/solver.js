import { END_RADIUS, ITEM_RADIUS, MAX_STRETCH, STICK_SEARCH, TILE } from './constants.js';
import {
  castCircle,
  circleTouches,
  clampToRange,
  dist,
  findStickSpot,
  segmentSegmentDist,
  segmentTouchesDeadly,
} from './collision.js';
import { buildLasers } from './hazards.js';
import { gravityDir, inZeroG, isBouncyKind, outOfWorld, TileKind } from './level.js';
import { canReach } from './slime.js';
import { TONGUE_RADIUS, touchesBox } from './tongue.js';
import { PICK_RADIUS, pickaxe } from './cave.js';
import { simulateVent } from './factory.js';
import { BLOB_RADIUS } from './slimeShot.js';
import { simulateBounce } from './island.js';
import { CANNON_ENTER, CLAW_HANG, CLAW_RADIUS, simulateDrop, simulateShot } from './warehouse.js';
import {
  logRange,
  logRideY,
  QUICKSAND_REACH,
  swingingVines,
  touchingQuicksand,
  VINE_GRAB,
  vineLandings,
  vineTip,
  ZIP_GRAB,
  ZIP_HANG,
  zipGrip,
} from './jungle.js';
import {
  BALLOON_GRAB,
  balloonPath,
  BASKET_SIT,
  floatingPlatforms,
  islandEnds,
  KITE_GRAB,
  KITE_STRING,
  kiteLandings,
  RAINBOW_GRAB,
  RAINBOW_RIDE,
  rainbowArc,
  sleepingClouds,
} from './sky.js';
import {
  BOOSTER_ENTER,
  PAD_RADIUS,
  padCenter,
  ROCK_RADIUS,
  ROCK_THROW_RANGE,
  simulateBooster,
  simulateFling,
  SWITCH_RADIUS,
} from './space.js';
import { MARSH_BOUNCE, ropeDrop, ROPE_GRAB } from './candy.js';
import { BOOKCASE_RADIUS, furnitureCells, furnitureRides } from './haunted.js';

const CANNON_ANGLES = 72;

/**
 * Checks that a level can be finished, by playing it the way a kid would:
 * from every spot the slime can stick, try stretching in lots of directions
 * and letting go, using the same sticking rules as the real game. Timed
 * lasers and chasers are ignored (you can wait for a laser to turn off), but
 * always-on lasers block. So are monkeys and snakes (you can wait for them
 * too), but quicksand cuts how far you can stretch. Lightning clouds zap on
 * a timer too, and fluffy clouds count as normal platforms (you can always
 * move off one before you sink through). In space, asteroids and UFOs are
 * ignored too (you can wait for them, and a UFO only sets you back), the
 * middles of black holes and alien plants that can't be withered count as
 * deadly (their pull and chomping are ignored), and in zero gravity letting
 * go of a stretch in the air floats you off in that direction. In Candyland,
 * chocolate is deadly, caramel is a normal sticky spot (it only holds you for
 * a moment), ice cream scoops count as normal platforms (like fluffy clouds),
 * gumdrops bounce you like hammocks, sitting on a marshmallow springs you up
 * a little, and touching a licorice rope slides you down to its bottom.
 * Gumball machines, candy canes and sour clouds are on timers, so they're
 * ignored, and so are lollipops (their longer stretch doesn't last). In the
 * haunted house, creaky floorboards are solid, but from one you only get one
 * more stretch (onto something that isn't a floorboard) before it vanishes,
 * or you can wait and fall through it. Haunted furniture is solid where it
 * starts, and you can ride it to either end of its path (its shoves are
 * ignored: you can wait for it). Spider webs are sticky spots in the air (the
 * real game physics catches a slime falling or flying into one); they only
 * hold you still for a moment. Chandeliers are vines, dumbwaiters are
 * elevators, beds bounce like hammocks, secret bookcases work like
 * teleporters, and spooky paintings are just decoration.
 */

const DIRECTIONS = 32;
const REACHES = [50, 100, 150, MAX_STRETCH];
const GRID = 10;

/** Where the slime lands after being dropped at `p` (one-way platforms catch it). */
export function dropPoint(level, p) {
  // (Upside down, the slime falls up.)
  const away = gravityDir(level) > 0 ? level.pixelHeight + TILE * 4 : -TILE * 4;
  return simulateDrop(level, p) || castCircle(level, p, { x: p.x, y: away }, END_RADIUS, 2);
}

/**
 * Find every spot the slime can get to, starting from the level's start (or
 * from `seeds`: spots with how many moves it took to get there).
 */
function explore(level, seeds = null) {
  const blockers = buildLasers(level).filter(l => l.off <= 0);
  const safe = (a, b) =>
    !outOfWorld(level, a) &&
    !outOfWorld(level, b) &&
    !segmentTouchesDeadly(level, a, b, END_RADIUS * 0.6, 8) &&
    !blockers.some(l => segmentSegmentDist(a, b, l.from, l.to) < END_RADIUS);

  // `solverStart` starts from a spot the slime is already stuck to (used to
  // check you can get back from an item); otherwise drop in at the start.
  const start = level.solverStart ? { ...level.solverStart } : dropPoint(level, level.start);
  const seen = new Set();
  const key = p => `${Math.round(p.x / GRID)},${Math.round(p.y / GRID)}`;
  const reached = [];
  start.moves = 0;
  const queue = [];
  for (const spot of seeds || [start]) {
    if (!seen.has(key(spot))) {
      seen.add(key(spot));
      queue.push(spot);
    }
  }

  const visit = (spot, moves) => {
    if (spot && !seen.has(key(spot))) {
      seen.add(key(spot));
      spot.moves = moves;
      queue.push(spot);
    }
  };
  // Stuck in quicksand, you can't stretch as far.
  const reachFrom = a =>
    touchingQuicksand(level, a) ? MAX_STRETCH * QUICKSAND_REACH : MAX_STRETCH;
  // Can the slime, stuck at `a`, stretch an end to touch point `q`?
  const canStretchTo = (a, q, radius) => {
    const reach = reachFrom(a);
    if (dist(a, q) > reach + radius) {
      return false;
    }
    const tip = castCircle(level, a, clampToRange(a, q, reach), END_RADIUS, 4);
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
  // Hammocks: land on one and it bounces you up to wherever you stick.
  // (Upside down, only moon rocks bounce you, off their bottoms.)
  const hammocks = [];
  const upsideDown = gravityDir(level) < 0;
  level.tiles.forEach((row, r) =>
    row.forEach((kind, c) => {
      if (upsideDown && kind === TileKind.MOON_ROCK) {
        const bottom = { x: (c + 0.5) * TILE, y: (r + 1) * TILE + END_RADIUS + 1 };
        hammocks.push({ ...bottom, landing: simulateBounce(level, bottom) });
      } else if (!upsideDown && isBouncyKind(kind)) {
        const top = { x: (c + 0.5) * TILE, y: r * TILE - END_RADIUS - 1 };
        hammocks.push({ ...top, landing: simulateBounce(level, top) });
      }
    })
  );
  // Steam vents blast you up the same way.
  for (const v of level.vents) {
    const top = { x: v.x, y: v.row * TILE - END_RADIUS - 1 };
    hammocks.push({ ...top, landing: simulateVent(level, top) });
  }
  // Sit on a marshmallow long enough and it springs you up a little.
  if (!upsideDown) {
    level.tiles.forEach((row, r) =>
      row.forEach((kind, c) => {
        if (kind === TileKind.MARSHMALLOW) {
          const top = { x: (c + 0.5) * TILE, y: r * TILE - END_RADIUS - 1 };
          hammocks.push({ ...top, landing: simulateBounce(level, top, MARSH_BOUNCE) });
        }
      })
    );
  }
  // Only nice claws count: mean ones drop you somewhere bad.
  const niceClaws = (level.def.claws || [])
    .filter(c => c.nice)
    .map(c => {
      const y = (c.row + 1) * TILE + CLAW_HANG;
      return { ...c, y, landing: simulateDrop(level, { x: (c.drop + 0.5) * TILE, y: y + 12 }) };
    });

  // Vines (and chandeliers): grab the bottom, swing and let go to fly somewhere new.
  const vines = swingingVines(level.def).map(v => {
    const vine = { x: (v.at[0] + 0.5) * TILE, y: v.at[1] * TILE, length: v.length * TILE };
    return { tip: vineTip(vine, 0), vine, landings: null };
  });
  // Tipping leaves: sit on one and it tips over and drops you.
  const leaves = [];
  level.tiles.forEach((row, r) =>
    row.forEach((kind, c) => {
      if (kind !== TileKind.LEAF || row[c - 1] === TileKind.LEAF) {
        return;
      }
      let to = c;
      while (row[to + 1] === TileKind.LEAF) {
        to++;
      }
      const tiles = level.tiles.map(line => line.slice());
      tiles[r].fill(TileKind.EMPTY, c, to + 1);
      const from = { x: ((c + to + 1) / 2) * TILE, y: r * TILE - END_RADIUS - 1 };
      const landing = simulateDrop({ ...level, tiles }, from);
      leaves.push({ left: c * TILE, right: (to + 1) * TILE, y: from.y, landing });
    })
  );
  // Ziplines: grab the handle and get dropped off at the other end.
  const ziplines = (level.def.ziplines || []).map(z => {
    const end = { x: (z.to[0] + 0.5) * TILE, y: (z.to[1] + 0.5) * TILE + ZIP_HANG };
    return {
      grip: zipGrip({ x: (z.from[0] + 0.5) * TILE, y: (z.from[1] + 0.5) * TILE }),
      landing: simulateDrop(level, end),
    };
  });

  // Hot air balloons and rainbows: touch the start and get dropped off at the end.
  const rides = [];
  for (const b of level.def.balloons || []) {
    const path = balloonPath(b);
    const end = path[path.length - 1];
    rides.push({
      grab: path[0],
      radius: BALLOON_GRAB,
      landing: simulateDrop(level, { x: end.x, y: end.y - BASKET_SIT }),
    });
  }
  for (const r of level.def.rainbows || []) {
    const arc = rainbowArc(r);
    const end = arc[arc.length - 1];
    rides.push({
      grab: arc[0],
      radius: RAINBOW_GRAB,
      landing: simulateDrop(level, { x: end.x, y: end.y - RAINBOW_RIDE }),
    });
  }
  // Licorice ropes: touch one anywhere and slide down to the bottom.
  const ropes = level.ropes.map(rope => {
    const grabs = [];
    for (let y = rope.top + TILE / 4; y < rope.bottom; y += TILE / 2) {
      grabs.push({ x: rope.x, y });
    }
    return { grabs, landing: simulateDrop(level, ropeDrop(rope)) };
  });
  // Kites: grab the end of the string and let go somewhere along the way.
  const kites = level.kites.map(k => ({
    string: { x: k.x, y: k.y + KITE_STRING },
    home: k,
    landings: null,
  }));
  // Floating islands, space elevators, dumbwaiters and haunted furniture:
  // get on anywhere along the way and ride to either end.
  const platforms = [...floatingPlatforms(level.def), ...furnitureRides(level.def)];
  const islands = platforms.map(def => {
    const { from, to } = islandEnds(def);
    const width = def.width || 3;
    const tops = at => {
      const spots = [];
      for (let i = 0; i < width; i++) {
        spots.push({ x: at.x + (i + 0.5) * TILE, y: at.y - END_RADIUS - 1 });
      }
      return spots;
    };
    const along = [];
    const steps = Math.max(1, Math.ceil(dist(from, to) / (TILE / 2)));
    for (let k = 0; k <= steps; k++) {
      const at = {
        x: from.x + ((to.x - from.x) * k) / steps,
        y: from.y + ((to.y - from.y) * k) / steps,
      };
      along.push(...tops(at));
    }
    return { along, ends: [...tops(from), ...tops(to)] };
  });
  // Teleporters (and secret bookcases): touch one and you pop out of the other one.
  const pads = [];
  const pairs = [
    ...(level.def.teleporters || []).map(t => ({ ...t, radius: PAD_RADIUS })),
    ...(level.def.bookcases || []).map(t => ({ ...t, radius: BOOKCASE_RADIUS })),
  ];
  for (const t of pairs) {
    const a = padCenter(t.a);
    const b = padCenter(t.b);
    pads.push({ pad: a, radius: t.radius, landing: simulateDrop(level, b) });
    pads.push({ pad: b, radius: t.radius, landing: simulateDrop(level, a) });
  }
  // Creaky floorboards: wait on one and it vanishes, and you fall through.
  const isBoard = k => k === TileKind.FLOORBOARD;
  const onBoard = p =>
    level.floorboards.length > 0 && circleTouches(level, p, END_RADIUS + 6, isBoard);
  const trapdoors = level.floorboards.map(b => {
    const tiles = level.tiles.map(line => line.slice());
    tiles[b.row][b.col] = TileKind.EMPTY;
    const from = { x: (b.col + 0.5) * TILE, y: b.row * TILE - END_RADIUS - 1 };
    return { ...from, landing: simulateDrop({ ...level, tiles }, from) };
  });
  // Rocket boosters: touch one and it blasts you off its way.
  const boosters = level.boosters.map(b => ({ ...b, landing: simulateBooster(level, b) }));
  // Zero gravity: letting go of a stretch in the air floats you off.
  const flings = new Map();
  const flingFrom = (anchor, tip, angleIndex) => {
    const k = `${key(tip)},${angleIndex}`;
    if (!flings.has(k)) {
      flings.set(k, simulateFling(level, anchor, tip));
    }
    return flings.get(k);
  };

  while (queue.length) {
    const anchor = queue.shift();
    reached.push(anchor);
    for (const ride of rides) {
      if (ride.landing && canStretchTo(anchor, ride.grab, ride.radius)) {
        visit({ ...ride.landing }, anchor.moves + 2);
      }
    }
    for (const rope of ropes) {
      if (rope.landing && rope.grabs.some(p => canStretchTo(anchor, p, ROPE_GRAB))) {
        visit({ ...rope.landing }, anchor.moves + 2);
      }
    }
    for (const t of pads) {
      if (t.landing && canStretchTo(anchor, t.pad, t.radius + END_RADIUS)) {
        visit({ ...t.landing }, anchor.moves + 2);
      }
    }
    for (const b of boosters) {
      if (b.landing && canStretchTo(anchor, b, BOOSTER_ENTER)) {
        visit({ ...b.landing }, anchor.moves + 2);
      }
    }
    for (const kite of kites) {
      if (canStretchTo(anchor, kite.string, KITE_GRAB)) {
        kite.landings = kite.landings || kiteLandings(level, kite.home, level.def.wind);
        for (const spot of kite.landings) {
          visit({ ...spot }, anchor.moves + 3);
        }
      }
    }
    for (const island of islands) {
      if (island.along.some(spot => canStretchTo(anchor, spot, TILE * 0.75))) {
        for (const spot of island.ends) {
          visit({ ...spot }, anchor.moves + 2);
        }
      }
    }
    for (const v of vines) {
      if (canStretchTo(anchor, v.tip, VINE_GRAB)) {
        v.landings = v.landings || vineLandings(level, v.vine);
        for (const spot of v.landings) {
          visit({ ...spot }, anchor.moves + 3);
        }
      }
    }
    for (const leaf of leaves) {
      const on = anchor.x > leaf.left && anchor.x < leaf.right && Math.abs(anchor.y - leaf.y) < 8;
      if (on && leaf.landing) {
        visit({ ...leaf.landing }, anchor.moves + 1);
      }
    }
    for (const zip of ziplines) {
      if (zip.landing && canStretchTo(anchor, zip.grip, ZIP_GRAB)) {
        visit({ ...zip.landing }, anchor.moves + 2);
      }
    }
    // Floating logs: get on anywhere along the river and ride to either end.
    for (const log of level.def.logs || []) {
      const { min, max } = logRange(log);
      const y = logRideY(log.row) - 1;
      let onBoard = false;
      for (let x = min; x <= max && !onBoard; x += TILE / 2) {
        onBoard = canStretchTo(anchor, { x, y }, TILE * 0.75);
      }
      if (onBoard) {
        visit({ x: min, y }, anchor.moves + 2);
        visit({ x: max, y }, anchor.moves + 2);
      }
    }
    level.cannons.forEach((cannon, i) => {
      if (canStretchTo(anchor, cannon, CANNON_ENTER)) {
        for (const spot of landingsFor(i)) {
          visit({ ...spot }, anchor.moves + 2);
        }
      }
    });
    // Mine carts: land on top and ride to either end of the track.
    for (const cart of level.carts) {
      const top = { x: (cart.col + 0.5) * TILE, y: cart.row * TILE - END_RADIUS - 1 };
      if (canStretchTo(anchor, top, END_RADIUS + 6)) {
        for (const col of [cart.minCol, cart.maxCol]) {
          visit({ x: (col + 0.5) * TILE, y: top.y }, anchor.moves + 2);
        }
      }
    }
    for (const h of hammocks) {
      if (h.landing && Math.abs(anchor.x - h.x) < TILE / 2 + 2 && Math.abs(anchor.y - h.y) < 8) {
        visit({ ...h.landing }, anchor.moves + 1);
      }
    }
    for (const t of trapdoors) {
      if (t.landing && Math.abs(anchor.x - t.x) < TILE / 2 + 2 && Math.abs(anchor.y - t.y) < 8) {
        visit({ ...t.landing }, anchor.moves + 1);
      }
    }
    // On a creaky floorboard there's only time for one more stretch, and it
    // can't be onto another floorboard.
    const creaky = onBoard(anchor);
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
    const reachHere = reachFrom(anchor);
    const reaches = [...REACHES.filter(r => r < reachHere), reachHere];
    const allowed = p => canReach(level, anchor, p, reachHere) && safe(anchor, p);
    for (let i = 0; i < DIRECTIONS; i++) {
      const angle = (i / DIRECTIONS) * Math.PI * 2;
      for (const reach of reaches) {
        const target = {
          x: anchor.x + Math.cos(angle) * reach,
          y: anchor.y + Math.sin(angle) * reach,
        };
        const tip = castCircle(level, anchor, target, END_RADIUS, 4);
        if (!safe(anchor, tip)) {
          continue;
        }
        const spot = findStickSpot(level, tip, END_RADIUS, STICK_SEARCH, allowed);
        if (spot && creaky && onBoard(spot)) {
          continue;
        }
        if (spot && !seen.has(key(spot))) {
          seen.add(key(spot));
          // Each new spot takes two drags: stretch out, then pull the tail over.
          spot.moves = anchor.moves + 2;
          queue.push(spot);
        } else if (!spot && level.zeroG.length && inZeroG(level, tip)) {
          // Nothing to stick to in zero gravity: float off and bump into something.
          visit(flingFrom(anchor, tip, i), anchor.moves + 1);
        }
      }
    }
  }

  // Fewest drags needed to touch `target`, or Infinity if it can't be reached.
  const movesTo = (target, radius) => {
    let best = Infinity;
    for (const a of reached) {
      const reach = reachFrom(a);
      if (a.moves + 1 >= best || dist(a, target) > reach + radius + END_RADIUS) {
        continue;
      }
      const tip = castCircle(level, a, clampToRange(a, target, reach), END_RADIUS, 4);
      if (dist(tip, target) < radius + END_RADIUS && safe(a, tip)) {
        best = a.moves + 1;
      }
    }
    return best;
  };
  const canTouch = (target, radius) => movesTo(target, radius) < Infinity;
  // The spots from which an end can be stretched to touch `target`.
  const touchersOf = (target, radius) =>
    reached.filter(a => {
      const reach = reachFrom(a);
      if (dist(a, target) > reach + radius + END_RADIUS) {
        return false;
      }
      const tip = castCircle(level, a, clampToRange(a, target, reach), END_RADIUS, 4);
      return dist(tip, target) < radius + END_RADIUS && safe(a, tip);
    });

  return { start, reached, movesTo, canTouch, touchersOf, safe };
}

/**
 * Explore a level with gravity switches: first the normal way up, then, from
 * everywhere a switch can be touched, upside down (touching a switch makes
 * the slime let go and fall the new way), and back again, until nothing new
 * turns up. Levels without switches are just explored normally.
 */
function exploreWithGravity(level) {
  if (!level.switches.length) {
    return explore(level);
  }
  const views = [
    { ...level, gravity: 1 },
    { ...level, gravity: -1 },
  ];
  const seeds = [
    [level.solverStart ? { ...level.solverStart } : dropPoint(views[0], level.start)],
    [],
  ];
  seeds[0][0].moves = 0;
  const results = [null, null];
  const seedKeys = [new Set(), new Set()];
  const seedKey = p => `${Math.round(p.x / GRID)},${Math.round(p.y / GRID)}`;
  seedKeys[0].add(seedKey(seeds[0][0]));
  const changed = [true, false];
  for (let round = 0; round < 6 && (changed[0] || changed[1]); round++) {
    for (const side of [0, 1]) {
      if (!changed[side]) {
        continue;
      }
      changed[side] = false;
      results[side] = explore(views[side], seeds[side]);
      // Touch a switch (the stretched end reaches it while the other stays
      // put), let go there and fall the other way.
      const other = 1 - side;
      for (const s of level.switches) {
        for (const a of results[side].touchersOf(s, SWITCH_RADIUS)) {
          const d = dist(a, s) || 1;
          const reach = Math.max(0, d - SWITCH_RADIUS - END_RADIUS + 2);
          const tip = { x: a.x + ((s.x - a.x) / d) * reach, y: a.y + ((s.y - a.y) / d) * reach };
          const middle = { x: (a.x + tip.x) / 2, y: (a.y + tip.y) / 2 };
          const landing = simulateDrop(views[other], middle);
          if (landing && !seedKeys[other].has(seedKey(landing))) {
            seedKeys[other].add(seedKey(landing));
            landing.moves = a.moves + 1;
            seeds[other].push(landing);
            changed[other] = true;
          }
        }
      }
    }
  }
  const parts = results.filter(Boolean);
  return {
    start: parts[0].start,
    reached: parts.flatMap(r => r.reached),
    movesTo: (target, radius) => Math.min(...parts.map(r => r.movesTo(target, radius))),
    canTouch: (target, radius) => parts.some(r => r.canTouch(target, radius)),
    touchersOf: (target, radius) => parts.flatMap(r => r.touchersOf(target, radius)),
    safe: parts[0].safe,
  };
}

/**
 * A copy of the level with eaten boxes removed and gates open or (deadly)
 * closed. Leafy traps are just holes: they break as soon as you touch them.
 * Haunted furniture is where it starts out.
 */
function levelView(level, eaten, openColors, powered = new Set(), woken = [], withered = null) {
  const tiles = level.tiles.map(row => row.map(k => (k === TileKind.LEAFY ? TileKind.EMPTY : k)));
  // The middle of a black hole hurts, and so does an alien plant until a
  // thrown moon rock withers it: the checker treats them like lava.
  for (const h of level.blackHoles) {
    tiles[h.row][h.col] = TileKind.LAVA;
  }
  level.plants.forEach((p, i) => {
    if (!withered || !withered.has(i)) {
      tiles[p.row][p.col] = TileKind.LAVA;
    }
  });
  // A sleeping cloud that's been woken up has flown away.
  for (const cloud of woken) {
    for (const t of cloud.tiles) {
      tiles[t.row][t.col] = TileKind.EMPTY;
    }
  }
  // A powered slime machine has moved its platform.
  (level.def.slimeMachines || []).forEach((m, i) => {
    if (powered.has(i)) {
      const width = m.platform.width || 2;
      for (let k = 0; k < width; k++) {
        tiles[m.platform.from[1]][m.platform.from[0] + k] = TileKind.EMPTY;
      }
      for (let k = 0; k < width; k++) {
        tiles[m.platform.to[1]][m.platform.to[0] + k] = TileKind.LIFT;
      }
    }
  });
  level.boxes.forEach((b, i) => {
    if (eaten.has(i)) {
      tiles[b.row][b.col] = TileKind.EMPTY;
    }
  });
  // Haunted furniture is solid where it starts out.
  for (const f of level.def.furniture || []) {
    for (const c of furnitureCells(f)) {
      tiles[c.row][c.col] = TileKind.FURNITURE;
    }
  }
  for (const g of level.gates) {
    // A closed gate zaps you, which the checker treats like lava.
    tiles[g.row][g.col] = openColors.has(g.color) ? TileKind.EMPTY : TileKind.LAVA;
  }
  return { ...level, tiles };
}

/** Boxes a mining machine's pickaxe will smash on its own. */
function smashedBoxes(level) {
  const smashed = new Set();
  for (const machine of level.machines) {
    for (let t = 0; t < 2.4; t += 0.05) {
      const { head } = pickaxe({ ...machine, phase: 0 }, t);
      level.boxes.forEach((box, i) => {
        if (dist(head, box) < PICK_RADIUS + TILE * 0.7) {
          smashed.add(i);
        }
      });
    }
  }
  return smashed;
}

export function solveLevel(level) {
  // Keep exploring until no new box can be eaten and no new gate opened.
  // Boxes in reach of a mining machine get smashed for you.
  const smashed = level.machines.length ? smashedBoxes(level) : new Set();
  // `solverState` carries over what's already been done (eaten boxes, open
  // gates, withered plants...) when checking you can get back from an item.
  const before = level.solverState || {};
  const eaten = new Set([...smashed, ...(before.eaten || [])]);
  const openColors = new Set(before.openColors);
  const powered = new Set(before.powered);
  const machines = (level.def.slimeMachines || []).map(machineFaces);
  const clouds = sleepingClouds(level);
  const woken = new Set(before.woken);
  const withered = new Set(before.withered);
  let view;
  let result;
  // Things in eaten boxes come straight to you; things in smashed boxes drop
  // out where the box was, so you still have to get there.
  const item = (it, radius) =>
    it.inBox === undefined || smashed.has(it.inBox)
      ? result.canTouch(it, radius)
      : eaten.has(it.inBox);
  for (;;) {
    view = levelView(
      level,
      eaten,
      openColors,
      powered,
      clouds.filter((_c, i) => woken.has(i)),
      withered
    );
    result = exploreWithGravity(view);
    let changed = false;
    level.boxes.forEach((box, i) => {
      if (!eaten.has(i) && tongueCanReach(view, result.reached, box, result.safe)) {
        eaten.add(i);
        changed = true;
      }
    });
    for (const key of level.keys) {
      const got = item(key, ITEM_RADIUS);
      if (got && !openColors.has(key.color)) {
        openColors.add(key.color);
        changed = true;
      }
    }
    machines.forEach((m, i) => {
      if (!powered.has(i) && canShootInto(view, result.reached, m.shotFace)) {
        powered.add(i);
        changed = true;
      }
    });
    clouds.forEach((cloud, i) => {
      if (!woken.has(i) && canShootCloud(view, result.reached, cloud)) {
        woken.add(i);
        changed = true;
      }
    });
    // Pick up a moon rock with the tongue and throw it at a plant to wither it.
    const hasRock = level.moonRocks.some(r => tongueCanReach(view, result.reached, r, result.safe));
    level.plants.forEach((plant, i) => {
      if (hasRock && !withered.has(i) && canThrowAt(view, result.reached, plant)) {
        withered.add(i);
        changed = true;
      }
    });
    if (!changed) {
      break;
    }
  }
  return {
    start: result.start,
    reached: result.reached,
    exit: level.exit ? result.canTouch(level.exit, TILE / 2) : true,
    exitMoves: level.exit ? result.movesTo(level.exit, TILE / 2) : 0,
    tokens: level.tokens.map(t => item(t, ITEM_RADIUS)),
    cores: level.cores.map(c => item(c, ITEM_RADIUS)),
    checkpoints: level.checkpoints.map(c => result.canTouch(c, TILE / 2)),
    keys: level.keys.map(k => item(k, ITEM_RADIUS)),
    chests: level.chests.map(c => result.canTouch(c, 20)),
    blobSpots: (level.def.blobSpots || []).map(([col, row]) =>
      result.canTouch({ x: (col + 0.5) * TILE, y: (row + 0.5) * TILE }, 18)
    ),
    boxes: level.boxes.map((_b, i) => eaten.has(i)),
    // Each slime machine can be powered, and you can climb in to get your blob back.
    slimeMachines: machines.map((m, i) => powered.has(i) && result.canTouch(m.openFace, 12)),
    // Every sleeping cloud can be woken up with a slime shot.
    sleepingClouds: clouds.map((_c, i) => woken.has(i)),
    // Alien plants that a thrown moon rock can wither.
    plants: level.plants.map((_p, i) => withered.has(i)),
    touchersOf: result.touchersOf,
    state: { eaten, openColors, powered, woken, withered },
  };
}

/**
 * Can you still get to the exit after touching `target`? The slime can't let
 * go and drop on purpose, so grabbing something on a high ledge can leave you
 * stuck. Tries the few closest spots you could touch it from.
 */
export function canGetBackFrom(level, solved, target, radius) {
  const from = solved
    .touchersOf(target, radius)
    .sort((a, b) => a.moves - b.moves)
    .slice(0, 3);
  return from.some(
    a => solveLevel({ ...level, solverStart: { x: a.x, y: a.y }, solverState: solved.state }).exit
  );
}

/**
 * Can a moon rock be thrown at `plant` from any spot the slime can get to?
 * (Roughly: a straight clear line, not too far away. The rock you're
 * carrying isn't in the way any more, and neither are the others.)
 */
function canThrowAt(level, reached, plant) {
  const tiles = level.tiles.map(row =>
    row.map(k => (k === TileKind.MOON_ROCK ? TileKind.EMPTY : k))
  );
  const view = { ...level, tiles };
  return reached.some(a => {
    if (dist(a, plant) > ROCK_THROW_RANGE) {
      return false;
    }
    const end = castCircle(view, a, plant, ROCK_RADIUS, 3);
    return dist(end, plant) < TILE * 0.5;
  });
}

function machineFaces(m) {
  const [col, row] = m.at;
  const dir = m.shot === 'left' ? -1 : 1;
  return {
    shotFace: { x: (col + 0.5 + dir * 0.5) * TILE, y: (row + 0.5) * TILE },
    openFace: { x: (col + 0.5 - dir * 0.5) * TILE, y: (row + 0.5) * TILE },
  };
}

const SHOT_RANGE = 6 * TILE;

/** Can a slime shot from any spot the slime can get to fly into `face`? */
function canShootInto(level, reached, face) {
  return reached.some(a => {
    if (dist(a, face) > SHOT_RANGE) {
      return false;
    }
    const end = castCircle(level, a, face, BLOB_RADIUS, 3);
    return dist(end, face) < TILE * 0.5;
  });
}

/** Is a circle at `p` touching tile `t`? */
function touchesTile(p, r, t) {
  const cx = Math.max(t.col * TILE, Math.min(p.x, (t.col + 1) * TILE));
  const cy = Math.max(t.row * TILE, Math.min(p.y, (t.row + 1) * TILE));
  return (p.x - cx) ** 2 + (p.y - cy) ** 2 < r * r;
}

/** Can a slime shot from any spot the slime can get to hit a sleeping cloud? */
function canShootCloud(level, reached, cloud) {
  return cloud.tiles.some(t => {
    const center = { x: (t.col + 0.5) * TILE, y: (t.row + 0.5) * TILE };
    return reached.some(a => {
      if (dist(a, center) > SHOT_RANGE + TILE / 2) {
        return false;
      }
      const end = castCircle(level, a, center, BLOB_RADIUS, 3);
      return cloud.tiles.some(c => touchesTile(end, BLOB_RADIUS + 4, c));
    });
  });
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
