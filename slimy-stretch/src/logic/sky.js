import { END_RADIUS, TILE } from './constants.js';
import {
  circleHitsSolid,
  dist,
  isSupported,
  isTouchingSticky,
  platformLanding,
} from './collision.js';
import { isSolidKind, TileKind, tileAt } from './level.js';
import { windAmount } from './canyon.js';
import { BLOB_RADIUS } from './slimeShot.js';
import { simulateDrop } from './warehouse.js';

// Things in Sky City: lightning clouds, sleeping clouds that block the way
// (a slime shot wakes them up), fluffy clouds you slowly sink through, hot air
// balloons, rainbow slides, floating islands and kites. (Wind gusts are the
// canyon's wind, see canyon.js, just stronger.) Outer Space's elevators and
// the haunted house's dumbwaiters are floating islands too.

export const LIGHTNING_EVERY = 5; // seconds between zaps from each cloud
export const LIGHTNING_WARN = 1; // it flickers and rumbles this long first
export const LIGHTNING_ZAP = 0.6; // how long the bolt lasts
export const LIGHTNING_STAGGER = 1.7; // clouds take turns, this far apart
export const BOLT_WIDTH = 10;

const CLOUD_FLY_SPEED = 40; // a woken cloud starts floating up this fast...
const CLOUD_FLY_LIFT = 220; // ...and speeds up like this

export const FLUFF_TIME = 2; // sit on a fluffy cloud this long and you sink through
export const FLUFF_SOFT = 3; // seconds before it firms up again
export const FLUFF_SINK = 8; // how far the slime sinks into the fluff

export const BALLOON_SPEED = 120;
const BALLOON_RETURN_SPEED = 150;
export const BALLOON_GRAB = 34; // how close to the basket you have to touch it
export const BASKET_SIT = 6; // the slime sits this far above the basket's middle

export const RAINBOW_SPEED = 400;
export const RAINBOW_GRAB = 34;
export const RAINBOW_RIDE = 14; // the slime slides along this far above the rainbow
const RAINBOW_STEPS = 48;

export const ISLAND_SPEED = 55;
const ISLAND_PAUSE = 1; // an island waits this long at each end of its path
export const ELEVATOR_SPEED = 70; // space elevators (see floatingPlatforms)
export const DUMBWAITER_SPEED = 60; // the haunted house's dumbwaiters (see floatingPlatforms)
export const LIFT_SPEED = 70; // the robot factory's lifts (see floatingPlatforms)
export const HELPER_SPEED = 50; // the robot factory's robot helpers (see floatingPlatforms)

export const KITE_STRING = 2.2 * TILE; // how far below the kite the end of its string hangs
export const KITE_GRAB = 30;
export const KITE_HANG = 12; // the slime hangs just under the end of the string
export const KITE_WIND = 1; // kite speed for each bit of wind strength
export const KITE_SINK = 60; // with no wind, a kite slowly floats down
const KITE_CALM = 0.05; // less wind than this and the kite starts to sink
const KITE_RETURN_SPEED = 110;
const KITE_SIZE = 16;

/** 'calm', 'warn' (flickering and rumbling) or 'zap' for a lightning cloud. */
export function lightningState(cloud, time) {
  const offset = cloud.offset || 0;
  // Clouds take turns: each one waits a little longer before its first zap.
  if (time < offset) {
    return 'calm';
  }
  const t = (time - offset) % LIGHTNING_EVERY;
  if (t >= LIGHTNING_EVERY - LIGHTNING_ZAP) {
    return 'zap';
  }
  return t >= LIGHTNING_EVERY - LIGHTNING_ZAP - LIGHTNING_WARN ? 'warn' : 'calm';
}

/** Where the bolt from a lightning cloud stops: the top of the first solid tile below. */
export function boltBottom(level, cloud) {
  for (let row = cloud.row + 1; row < level.height; row++) {
    if (isSolidKind(tileAt(level, cloud.col, row))) {
      return row * TILE;
    }
  }
  return level.pixelHeight;
}

/** Is a circle at `p` touching tile (col,row)? */
function circleTouchesTile(p, r, col, row) {
  const cx = Math.max(col * TILE, Math.min(p.x, (col + 1) * TILE));
  const cy = Math.max(row * TILE, Math.min(p.y, (row + 1) * TILE));
  return (p.x - cx) ** 2 + (p.y - cy) ** 2 < r * r;
}

/** Each bunch of sleeping cloud tiles (@) touching each other is one big cloud. */
export function sleepingClouds(level) {
  const clouds = [];
  const seen = new Set();
  level.tiles.forEach((line, r) =>
    line.forEach((kind, c) => {
      if (kind !== TileKind.SLEEPY || seen.has(`${c},${r}`)) {
        return;
      }
      const tiles = [{ col: c, row: r }];
      seen.add(`${c},${r}`);
      for (let i = 0; i < tiles.length; i++) {
        const { col, row } = tiles[i];
        for (const [dc, dr] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const k = `${col + dc},${row + dr}`;
          if (tileAt(level, col + dc, row + dr) === TileKind.SLEEPY && !seen.has(k)) {
            seen.add(k);
            tiles.push({ col: col + dc, row: row + dr });
          }
        }
      }
      clouds.push({ tiles });
    })
  );
  return clouds;
}

/** Each run of fluffy cloud tiles (f) side by side is one cloud. */
function fluffyClouds(level) {
  const clouds = [];
  level.tiles.forEach((row, r) => {
    let from = null;
    row.forEach((kind, c) => {
      if (kind === TileKind.FLUFFY && from === null) {
        from = c;
      }
      if (from !== null && (kind !== TileKind.FLUFFY || c === row.length - 1)) {
        const to = kind === TileKind.FLUFFY ? c : c - 1;
        clouds.push({ row: r, from, to, state: 'firm', sat: 0, timer: 0 });
        from = null;
      }
    });
  });
  return clouds;
}

/** The points (basket middles, in pixels) a hot air balloon floats along. */
export function balloonPath(def) {
  return def.path.map(([col, row]) => ({ x: (col + 0.5) * TILE, y: (row + 0.5) * TILE }));
}

/** Points along a rainbow, arching up between the middles of its two end tiles. */
export function rainbowArc(def) {
  const a = { x: (def.from[0] + 0.5) * TILE, y: (def.from[1] + 0.5) * TILE };
  const b = { x: (def.to[0] + 0.5) * TILE, y: (def.to[1] + 0.5) * TILE };
  const height = Math.max(1.5 * TILE, dist(a, b) * 0.3);
  const pts = [];
  for (let i = 0; i <= RAINBOW_STEPS; i++) {
    const t = i / RAINBOW_STEPS;
    pts.push({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t - Math.sin(Math.PI * t) * height,
    });
  }
  return pts;
}

/**
 * All the floating islands in a level (def.islands), plus Outer Space's
 * elevators (def.elevators), the haunted house's dumbwaiters
 * (def.dumbwaiters) and the robot factory's lifts (def.lifts), which are
 * really just floating islands that go straight up and down a shaft:
 * { col, from, to, width, speed } goes between rows `from` and `to` with its
 * left tile in column `col`. (Elevators and lifts are 2 tiles wide unless
 * they say otherwise, dumbwaiters 1.) The robot factory's robot helpers
 * (def.helpers) are floating islands 1 tile wide that walk back and forth
 * along a floor: { at: [col, row], to, speed } walks between `at` and
 * column `to`.
 */
export function floatingPlatforms(def) {
  const shaft = (e, width, speed) => ({
    from: [e.col, e.from],
    to: [e.col, e.to],
    width: e.width || width,
    speed: e.speed || speed,
  });
  const elevators = (def.elevators || []).map(e => ({
    ...shaft(e, 2, ELEVATOR_SPEED),
    elevator: true,
  }));
  const dumbwaiters = (def.dumbwaiters || []).map(e => ({
    ...shaft(e, 1, DUMBWAITER_SPEED),
    dumbwaiter: true,
  }));
  const lifts = (def.lifts || []).map(e => ({ ...shaft(e, 2, LIFT_SPEED), lift: true }));
  const helpers = (def.helpers || []).map(h => ({
    from: h.at,
    to: [h.to, h.at[1]],
    width: 1,
    speed: h.speed || HELPER_SPEED,
    helper: true,
  }));
  return [...(def.islands || []), ...elevators, ...dumbwaiters, ...lifts, ...helpers];
}

/** The two ends of a floating island's path (top-left corners, in pixels). */
export function islandEnds(def) {
  return {
    from: { x: def.from[0] * TILE, y: def.from[1] * TILE },
    to: { x: def.to[0] * TILE, y: def.to[1] * TILE },
  };
}

/** Where the slime hangs when it's holding a kite at (x, y). */
export function kiteHang(kite) {
  return { x: kite.x, y: kite.y + KITE_STRING + KITE_HANG };
}

/** How hard (and which way) the wind pushes a kite right now, in pixels per second. */
export function kiteWind(wind, time) {
  const amount = windAmount(wind, time);
  return { vx: wind ? wind.dir * wind.strength * amount * KITE_WIND : 0, calm: amount < KITE_CALM };
}

/**
 * Move a kite (with the slime hanging under it) for `dt` seconds. The wind
 * pulls it sideways; with no wind it sinks. It stops at walls. If the slime
 * bumps into something sticky it sticks there: returns that spot, else null.
 */
export function stepKite(level, kite, dt, wind, time) {
  const { vx, calm } = kiteWind(wind, time);
  kite.vx = vx;
  const vy = calm ? KITE_SINK : 0;
  const steps = Math.max(1, Math.ceil((Math.hypot(vx, vy) * dt) / 4));
  for (let i = 0; i < steps; i++) {
    const s = kiteHang(kite);
    const dx = (vx * dt) / steps;
    if (dx) {
      const next = { x: s.x + dx, y: s.y };
      const kiteNext = { x: kite.x + dx, y: kite.y };
      if (circleHitsSolid(level, next, END_RADIUS) || circleHitsSolid(level, kiteNext, KITE_SIZE)) {
        // Blown into a wall: stick to it if it's sticky, otherwise just stop.
        if (isTouchingSticky(level, s, END_RADIUS, 4)) {
          return { x: s.x, y: s.y };
        }
      } else {
        kite.x += dx;
      }
    }
    const dy = (vy * dt) / steps;
    if (dy) {
      const h = kiteHang(kite);
      const top = platformLanding(level, h.x, h.y, h.y + dy, END_RADIUS);
      if (top !== null) {
        return { x: h.x, y: top };
      }
      if (circleHitsSolid(level, { x: h.x, y: h.y + dy }, END_RADIUS)) {
        if (isTouchingSticky(level, { x: h.x, y: h.y }, END_RADIUS, 4)) {
          return { x: h.x, y: h.y };
        }
      } else {
        kite.y += dy;
      }
    }
  }
  return null;
}

/**
 * Everywhere you could land from a kite (for the level checker): grab it at
 * a few different moments of the wind's gusts, let it carry you, and let go
 * every little while along the way.
 */
export function kiteLandings(level, home, wind) {
  const landings = [];
  const seen = new Set();
  const add = p => {
    const key = `${Math.round(p.x / 8)},${Math.round(p.y / 8)}`;
    if (!seen.has(key)) {
      seen.add(key);
      landings.push(p);
    }
  };
  const dt = 1 / 30;
  const phases = wind ? [0, 0.25, 0.5, 0.75].map(k => k * wind.every) : [0];
  const tried = new Set();
  for (const phase of phases) {
    const kite = { x: home.x, y: home.y, vx: 0 };
    let last = kiteHang(kite);
    for (let t = 0; t < 15; t += dt) {
      const stuck = stepKite(level, kite, dt, wind, phase + t);
      if (stuck) {
        add(stuck);
        break;
      }
      const h = kiteHang(kite);
      if (h.y > level.pixelHeight) {
        break;
      }
      if (dist(h, last) >= TILE / 2 || t === 0) {
        last = h;
        const key = `${Math.round(h.x / 12)},${Math.round(h.y / 12)}`;
        if (!tried.has(key)) {
          tried.add(key);
          const spot = simulateDrop(level, h);
          if (spot) {
            add(spot);
          }
        }
      }
    }
  }
  return landings;
}

/**
 * Like slime.checkSupport, but ends marked in `riding` count as held up (they
 * are riding on something that moves, whose tiles can lag a little behind it).
 */
export function checkSupportWith(level, slime, riding) {
  const lost = slime.ends.map(
    (e, i) => e.state === 'stuck' && !riding[i] && !isSupported(level, e, END_RADIUS, 6)
  );
  if (!lost[0] && !lost[1]) {
    return;
  }
  const held = slime.heldIndex;
  if (held >= 0 ? lost[1 - held] : lost[0] && lost[1]) {
    slime.knockLoose(0, 0);
    return;
  }
  slime.ends.forEach((e, i) => {
    if (lost[i]) {
      e.state = 'snapping';
      slime.lead = 1 - i;
    }
  });
}

export class SkyStuff {
  constructor(level) {
    this.level = level;
    // Clouds take turns from left to right, so they don't all zap at once.
    const order = level.stormClouds.slice().sort((a, b) => a.col - b.col || a.row - b.row);
    this.storms = level.stormClouds.map(c => ({
      ...c,
      offset: (order.indexOf(c) * LIGHTNING_STAGGER) % LIGHTNING_EVERY,
      state: 'calm',
      bottom: boltBottom(level, c),
    }));
    this.clouds = sleepingClouds(level).map(c => {
      const cols = c.tiles.map(t => t.col);
      const rows = c.tiles.map(t => t.row);
      return {
        ...c,
        left: Math.min(...cols) * TILE,
        right: (Math.max(...cols) + 1) * TILE,
        top: Math.min(...rows) * TILE,
        bottom: (Math.max(...rows) + 1) * TILE,
        state: 'asleep',
        dx: 0,
        dy: 0,
        vy: 0,
      };
    });
    this.fluffs = fluffyClouds(level);
    this.balloons = (level.def.balloons || []).map(b => {
      const path = balloonPath(b);
      return { path, x: path[0].x, y: path[0].y, leg: 1, state: 'ready' };
    });
    this.rainbows = (level.def.rainbows || []).map(r => ({
      arc: rainbowArc(r),
      pos: 0,
      x: 0,
      y: 0,
      cooldown: 0,
    }));
    this.islands = floatingPlatforms(level.def).map(def => this.buildIsland(def));
    this.islands.forEach(island => this.placeIsland(island));
    this.kites = level.kites.map(k => ({
      home: { x: k.x, y: k.y },
      x: k.x,
      y: k.y,
      vx: 0,
      state: 'ready',
    }));
    // What the slime is riding: { kind: 'balloon' | 'rainbow' | 'kite', index }.
    this.ride = null;
    // Other moving things that can hold up a stuck end, like the haunted
    // house's furniture: each is a function giving [end 0 held?, end 1 held?].
    this.holders = [];
    this.time = 0;
    this.events = [];
  }

  buildIsland(def) {
    const { from, to } = islandEnds(def);
    const width = def.width || 3;
    // Remember what's under the island's path so it comes back behind it.
    const under = new Map();
    const minCol = Math.min(def.from[0], def.to[0]);
    const maxCol = Math.max(def.from[0], def.to[0]) + width - 1;
    const minRow = Math.min(def.from[1], def.to[1]);
    const maxRow = Math.max(def.from[1], def.to[1]);
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        under.set(`${col},${row}`, tileAt(this.level, col, row));
      }
    }
    return {
      from,
      to,
      width,
      x: from.x,
      y: from.y,
      dir: 1,
      pause: ISLAND_PAUSE,
      speed: def.speed || ISLAND_SPEED,
      elevator: !!def.elevator, // drawn as a space elevator, not an island
      dumbwaiter: !!def.dumbwaiter, // drawn as a dumbwaiter (see hauntedView.js)
      lift: !!def.lift, // drawn as a factory lift (see robotsView.js)
      helper: !!def.helper, // drawn as a robot helper (see robotsView.js)
      under,
      cells: [],
    };
  }

  /** Is the slime free to grab onto something (not riding, falling or carried)? */
  free(slime) {
    return this.ride === null && !slime.isFalling && !slime.frozen;
  }

  /**
   * Advance everything. `blobs` are the slime shot blobs (they wake sleeping
   * clouds) and `time` is the level time (for the wind and the lightning).
   * Returns 'lightning' if the slime got zapped, otherwise null.
   */
  update(dt, slime, blobs = [], time = this.time + dt) {
    this.time = time;
    // Something else let go of the slime (like splitting in two): the ride is over.
    if (this.ride && !slime.frozen) {
      this.endRide();
    }
    this.updateIslands(dt, slime);
    this.updateFluffs(dt, slime);
    this.updateClouds(dt, blobs);
    this.updateBalloons(dt, slime);
    this.updateRainbows(dt, slime);
    this.updateKites(dt, slime, time);
    return this.updateLightning(slime, time);
  }

  endRide() {
    const ride = this.ride;
    this.ride = null;
    if (!ride) {
      return;
    }
    if (ride.kind === 'balloon') {
      this.balloons[ride.index].state = 'return';
    } else if (ride.kind === 'kite') {
      this.kites[ride.index].state = 'return';
    } else {
      this.rainbows[ride.index].cooldown = 1;
    }
  }

  // -------------------------------------------------------------- lightning

  updateLightning(slime, time) {
    let hurt = null;
    const pts = slime.bodyPoints(8);
    for (const c of this.storms) {
      const state = lightningState(c, time);
      if (state !== c.state) {
        c.state = state;
        if (state === 'warn') {
          this.events.push({ type: 'rumble', x: c.x, y: c.y });
        } else if (state === 'zap') {
          // The bolt goes down until it hits something (islands move, so look again).
          c.bottom = boltBottom(this.level, c);
          this.events.push({ type: 'zap', x: c.x, y: c.y });
        }
      }
      if (state === 'zap') {
        const top = (c.row + 1) * TILE;
        const zapped = pts.some(
          p =>
            Math.abs(p.x - c.x) < BOLT_WIDTH + END_RADIUS * 0.6 &&
            p.y > top - 4 &&
            p.y < c.bottom + END_RADIUS
        );
        if (zapped) {
          hurt = 'lightning';
        }
      }
    }
    return hurt;
  }

  // --------------------------------------------------------- sleeping clouds

  updateClouds(dt, blobs) {
    for (const cloud of this.clouds) {
      if (cloud.state === 'asleep') {
        const i = blobs.findIndex(
          b =>
            b.state !== 'inMachine' &&
            cloud.tiles.some(t => circleTouchesTile(b, BLOB_RADIUS + 4, t.col, t.row))
        );
        if (i >= 0) {
          this.wakeCloud(cloud);
          // The blob of slime comes right back to you.
          blobs.splice(i, 1);
          this.events.push({ type: 'blobBack' });
        }
      } else if (cloud.state === 'flying') {
        cloud.vy += CLOUD_FLY_LIFT * dt;
        cloud.dy -= cloud.vy * dt;
        cloud.dx += Math.sin(cloud.dy * 0.02) * 30 * dt;
        if (cloud.bottom + cloud.dy < -2 * TILE) {
          cloud.state = 'gone';
        }
      }
    }
  }

  /** Yawn! The cloud wakes up and floats away, out of your way. */
  wakeCloud(cloud) {
    cloud.state = 'flying';
    cloud.vy = CLOUD_FLY_SPEED;
    for (const t of cloud.tiles) {
      this.level.tiles[t.row][t.col] = TileKind.EMPTY;
    }
    this.events.push({
      type: 'wake',
      x: (cloud.left + cloud.right) / 2,
      y: (cloud.top + cloud.bottom) / 2,
    });
  }

  // ----------------------------------------------------------- fluffy clouds

  updateFluffs(dt, slime) {
    const tiles = this.level.tiles;
    for (const cloud of this.fluffs) {
      const top = cloud.row * TILE;
      if (cloud.state === 'firm') {
        const on =
          slime.isFalling || slime.frozen
            ? []
            : slime.ends.filter(
                e =>
                  e.state === 'stuck' &&
                  e.y + END_RADIUS > top - 8 &&
                  e.y + END_RADIUS < top + FLUFF_SINK + 4 &&
                  e.x > cloud.from * TILE - 4 &&
                  e.x < (cloud.to + 1) * TILE + 4
              );
        if (on.length && cloud.sat === 0) {
          this.events.push({ type: 'fluff', x: on[0].x, y: top });
        }
        cloud.sat = on.length ? cloud.sat + dt : 0;
        // You slowly sink into the fluff...
        const sink = Math.min(1, cloud.sat / FLUFF_TIME) * FLUFF_SINK;
        for (const e of on) {
          e.y = top - END_RADIUS - 1 + sink;
        }
        if (cloud.sat >= FLUFF_TIME) {
          // ...and then right through it!
          cloud.state = 'soft';
          cloud.timer = FLUFF_SOFT;
          for (let col = cloud.from; col <= cloud.to; col++) {
            tiles[cloud.row][col] = TileKind.EMPTY;
          }
          this.checkSupport(slime);
          this.events.push({ type: 'fluffSoft', x: on[0] ? on[0].x : 0, y: top });
        }
      } else {
        cloud.timer -= dt;
        const blocked = slime.bodyPoints(8).some(p => {
          for (let col = cloud.from; col <= cloud.to; col++) {
            if (circleTouchesTile(p, END_RADIUS, col, cloud.row)) {
              return true;
            }
          }
          return false;
        });
        if (cloud.timer <= 0 && !blocked) {
          cloud.state = 'firm';
          cloud.sat = 0;
          for (let col = cloud.from; col <= cloud.to; col++) {
            tiles[cloud.row][col] = TileKind.FLUFFY;
          }
        }
      }
    }
  }

  /** How far the slime has sunk into a fluffy cloud, from 0 to 1. */
  fluffSink(cloud) {
    return cloud.state === 'firm' ? Math.min(1, cloud.sat / FLUFF_TIME) : 1;
  }

  /**
   * Like slime.checkSupport, but ends riding on top of a floating island
   * (or held by one of the `holders`) count as held up (while it moves, its
   * tiles can lag a little behind it).
   */
  checkSupport(slime) {
    if (slime.isFalling || slime.frozen) {
      return;
    }
    const riding = this.ridersOf(slime);
    for (const holder of this.holders) {
      holder(slime).forEach((held, i) => {
        riding[i] = riding[i] || held;
      });
    }
    checkSupportWith(this.level, slime, riding);
  }

  // ----------------------------------------------------------- hot air balloons

  updateBalloons(dt, slime) {
    this.balloons.forEach((b, i) => {
      if (b.state === 'ready') {
        if (this.free(slime) && slime.ends.some(e => dist(e, b) < BALLOON_GRAB)) {
          b.state = 'riding';
          b.leg = 1;
          this.ride = { kind: 'balloon', index: i };
          slime.holdAt(b.x, b.y - BASKET_SIT);
          this.events.push({ type: 'balloonGrab', x: b.x, y: b.y });
        }
      } else if (b.state === 'riding') {
        let step = BALLOON_SPEED * dt;
        while (step > 0 && b.leg < b.path.length) {
          const target = b.path[b.leg];
          const d = dist(b, target);
          if (d <= step) {
            b.x = target.x;
            b.y = target.y;
            b.leg++;
            step -= d;
          } else {
            b.x += ((target.x - b.x) / d) * step;
            b.y += ((target.y - b.y) / d) * step;
            step = 0;
          }
        }
        slime.holdAt(b.x, b.y - BASKET_SIT);
        if (b.leg >= b.path.length) {
          // Here's your stop! Out you hop.
          slime.knockLoose(0, 0);
          this.ride = null;
          b.state = 'return';
          b.leg = b.path.length - 2;
          this.events.push({ type: 'balloonDrop', x: b.x, y: b.y });
        }
      } else {
        // Float back to the start, empty, for next time.
        let step = BALLOON_RETURN_SPEED * dt;
        while (step > 0 && b.state === 'return') {
          const target = b.path[Math.max(0, b.leg)];
          const d = dist(b, target);
          if (d <= step) {
            b.x = target.x;
            b.y = target.y;
            step -= d;
            b.leg--;
            if (b.leg < 0) {
              b.state = 'ready';
              b.leg = 1;
            }
          } else {
            b.x += ((target.x - b.x) / d) * step;
            b.y += ((target.y - b.y) / d) * step;
            step = 0;
          }
        }
      }
    });
  }

  // ---------------------------------------------------------- rainbow slides

  updateRainbows(dt, slime) {
    this.rainbows.forEach((r, i) => {
      r.cooldown = Math.max(0, r.cooldown - dt);
      const start = r.arc[0];
      if (this.ride && this.ride.kind === 'rainbow' && this.ride.index === i) {
        r.pos += RAINBOW_SPEED * dt;
        const p = this.alongArc(r);
        slime.holdAt(p.x, p.y - RAINBOW_RIDE);
        if (p.end) {
          // Wheee... and off the end of the rainbow.
          slime.knockLoose(0, 0);
          this.ride = null;
          r.cooldown = 1;
          this.events.push({ type: 'rainbowDrop', x: p.x, y: p.y });
        }
      } else if (
        r.cooldown <= 0 &&
        this.free(slime) &&
        slime.ends.some(e => dist(e, start) < RAINBOW_GRAB)
      ) {
        this.ride = { kind: 'rainbow', index: i };
        r.pos = 0;
        slime.holdAt(start.x, start.y - RAINBOW_RIDE);
        this.events.push({ type: 'rainbowGrab', x: start.x, y: start.y });
      }
    });
  }

  /** The point `r.pos` pixels along a rainbow (with `end` set once it's past the end). */
  alongArc(r) {
    let left = r.pos;
    for (let k = 1; k < r.arc.length; k++) {
      const a = r.arc[k - 1];
      const b = r.arc[k];
      const d = dist(a, b);
      if (left <= d) {
        const t = d ? left / d : 0;
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, end: false };
      }
      left -= d;
    }
    const last = r.arc[r.arc.length - 1];
    return { x: last.x, y: last.y, end: true };
  }

  // -------------------------------------------------------- floating islands

  updateIslands(dt, slime) {
    for (const island of this.islands) {
      const before = { x: island.x, y: island.y };
      if (island.pause > 0) {
        island.pause -= dt;
      } else {
        const target = island.dir > 0 ? island.to : island.from;
        const d = dist(island, target);
        const step = island.speed * dt;
        if (d <= step) {
          island.x = target.x;
          island.y = target.y;
          island.dir = -island.dir;
          island.pause = ISLAND_PAUSE;
        } else {
          island.x += ((target.x - island.x) / d) * step;
          island.y += ((target.y - island.y) / d) * step;
        }
      }
      const dx = island.x - before.x;
      const dy = island.y - before.y;
      const active = !slime.isFalling && !slime.frozen;
      const riding = active ? this.ridersOf(slime, island, before) : [false, false];
      const moved = this.placeIsland(island);
      if ((dx || dy) && active) {
        this.carryRiders(island, riding, dx, dy, slime);
      }
      if (moved && active) {
        this.bumpOff(slime, riding);
        this.checkSupport(slime);
      }
    }
  }

  /**
   * Which ends are stuck on top of `island` (or any island), given where its
   * top-left corner was (`at`).
   */
  ridersOf(slime, only = null, at = null) {
    return slime.ends.map(e =>
      (only ? [only] : this.islands).some(island => {
        const x = at ? at.x : island.x;
        const y = at ? at.y : island.y;
        // Its tiles can be a little below where it's drawn while it floats up and down.
        const tileTop = Math.max(y, ...island.cells.map(c => c.row * TILE));
        return (
          e.state === 'stuck' &&
          e.x > x - 6 &&
          e.x < x + island.width * TILE + 6 &&
          e.y + END_RADIUS > y - 8 &&
          e.y + END_RADIUS < Math.min(tileTop, y + TILE) + 8
        );
      })
    );
  }

  /** Ends stuck on top of an island float along with it. */
  carryRiders(island, riding, dx, dy, slime) {
    slime.ends.forEach((e, i) => {
      if (!riding[i]) {
        return;
      }
      const next = { x: e.x + dx, y: island.y - END_RADIUS - 1 };
      if (!circleHitsSolid(this.level, next, END_RADIUS)) {
        e.x = next.x;
        e.y = next.y;
      }
    });
    // Stretched too far? The island pulls your other end off.
    const [a, b] = slime.ends;
    if (dist(a, b) > slime.reach) {
      slime.ends.forEach((e, i) => {
        if (!riding[i] && e.state === 'stuck') {
          e.state = 'snapping';
          slime.lead = 1 - i;
        }
      });
    }
  }

  /** An island floating into a stuck end knocks it off. */
  bumpOff(slime, riding) {
    const inside = slime.ends.map(
      (e, i) => e.state === 'stuck' && !riding[i] && circleHitsSolid(this.level, e, END_RADIUS - 3)
    );
    if (inside[0] && inside[1]) {
      slime.knockLoose(0, 0);
    } else {
      slime.ends.forEach((e, i) => {
        if (inside[i] && slime.ends[1 - i].state === 'stuck') {
          e.state = 'snapping';
          slime.lead = 1 - i;
        }
      });
    }
  }

  /**
   * Make the sky tiles under an island solid (and the ones it left behind
   * empty again). Floating sideways it takes the columns it mostly covers;
   * floating up and down it takes the row just under its top, so a slime
   * riding on top is never inside it. Returns true if anything changed.
   */
  placeIsland(island) {
    const col0 = Math.round(island.x / TILE);
    const row = Math.ceil(island.y / TILE - 0.001);
    const cells = [];
    for (let i = 0; i < island.width; i++) {
      cells.push({ col: col0 + i, row });
    }
    const key = list => list.map(c => `${c.col},${c.row}`).join(';');
    if (key(cells) === key(island.cells)) {
      return false;
    }
    const tiles = this.level.tiles;
    for (const c of island.cells) {
      tiles[c.row][c.col] = island.under.get(`${c.col},${c.row}`) ?? TileKind.EMPTY;
    }
    for (const c of cells) {
      if (c.row >= 0 && c.row < this.level.height && c.col >= 0 && c.col < this.level.width) {
        tiles[c.row][c.col] = TileKind.SKY_ISLAND;
      }
    }
    island.cells = cells;
    return true;
  }

  // ------------------------------------------------------------------ kites

  updateKites(dt, slime, time) {
    const wind = this.level.def.wind;
    this.kites.forEach((kite, i) => {
      if (kite.state === 'ready') {
        const string = { x: kite.x, y: kite.y + KITE_STRING };
        if (this.free(slime) && slime.ends.some(e => dist(e, string) < KITE_GRAB)) {
          kite.state = 'flying';
          this.ride = { kind: 'kite', index: i };
          const h = kiteHang(kite);
          slime.holdAt(h.x, h.y);
          this.events.push({ type: 'kiteGrab', x: string.x, y: string.y });
        }
      } else if (kite.state === 'flying') {
        const stuck = stepKite(this.level, kite, dt, wind, time);
        if (stuck) {
          // Bumped into something sticky: the slime sticks there and lets go.
          slime.holdAt(stuck.x, stuck.y);
          slime.frozen = false;
          this.ride = null;
          kite.state = 'return';
          this.events.push({ type: 'kiteStick', x: stuck.x, y: stuck.y });
        } else {
          const h = kiteHang(kite);
          slime.holdAt(h.x, h.y);
        }
      } else {
        // An empty kite floats back home.
        const d = dist(kite, kite.home);
        const step = KITE_RETURN_SPEED * dt;
        if (d <= step) {
          kite.x = kite.home.x;
          kite.y = kite.home.y;
          kite.state = 'ready';
        } else {
          kite.x += ((kite.home.x - kite.x) / d) * step;
          kite.y += ((kite.home.y - kite.y) / d) * step;
        }
      }
    });
  }

  /** Is the slime holding a kite? */
  get onKite() {
    return this.ride !== null && this.ride.kind === 'kite';
  }

  /** Let go of the kite and drop. */
  letGoKite(slime) {
    if (!this.onKite) {
      return false;
    }
    const kite = this.kites[this.ride.index];
    kite.state = 'return';
    this.ride = null;
    slime.knockLoose(0, 0);
    this.events.push({ type: 'kiteLetGo', x: kite.x, y: kite.y });
    return true;
  }

  resetAfterDeath() {
    this.endRide();
    for (const c of this.storms) {
      c.state = 'calm';
    }
  }

  takeEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }
}
