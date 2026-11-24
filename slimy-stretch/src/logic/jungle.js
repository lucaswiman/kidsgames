import { END_RADIUS, GRAVITY, MAX_FALL_SPEED, TILE } from './constants.js';
import {
  circleHitsDeadly,
  circleHitsSolid,
  circleTouches,
  dist,
  pointSegmentDist,
} from './collision.js';
import { isSolidKind, TileKind, tileAt } from './level.js';
import { Slime } from './slime.js';

// Things in the Jungle: quicksand, monkeys that throw bananas, snakes that
// snap down from branches, leafy traps over snake pits, swinging vines,
// floating logs, ziplines and big leaves that tip over. (Bouncy flowers work
// just like the island's hammocks, see island.js.)

export const QUICKSAND_REACH = 0.45; // stuck in quicksand, you can only stretch this much
export const QUICKSAND_SINK_TIME = 3; // seconds in quicksand before it swallows you

export const MONKEY_EVERY = 4.5; // seconds between bananas
export const MONKEY_WINDUP = 1; // the monkey holds up its banana first, as a warning
export const MONKEY_RANGE = 6 * TILE; // how close you have to be before it throws
export const MONKEY_SCARED_TIME = 6; // hides this long after a slime shot
export const MONKEY_RADIUS = 18;
export const BANANA_RADIUS = 10;
const BANANA_GRAVITY = 900; // bananas float a bit, so you can see them coming

export const SNAKE_REACH = 2.5 * TILE; // how far below its branch a snake can bite
export const SNAKE_WARN = 0.7; // hissing and wiggling before it snaps down
const SNAKE_COIL = 22; // how far it hangs down when it's resting
const SNAKE_STRIKE = 0.15;
const SNAKE_HOLD = 0.5;
const SNAKE_RETRACT = 0.5;
export const SNAKE_REST = 2.5; // after a bite it rests up in the tree: sneak past now!
export const SNAKE_RADIUS = 10;

export const LEAFY_REGROW = 6; // seconds before a broken leafy trap grows back

export const VINE_GRAB = 30; // how close to the bottom of a vine you have to touch it
export const VINE_MAX_ANGLE = (70 * Math.PI) / 180;
const VINE_PUMP = 4; // how hard dragging pumps the swing
const VINE_DAMPING = 0.08;
const VINE_REST_DAMPING = 1.5; // an empty vine soon stops swinging
export const VINE_FLING = 1.3; // letting go throws you a bit harder than the vine moves
export const VINE_HANG = 10; // the slime hangs just under the end of the vine
const VINE_GRIP = 5; // flying off a vine, you always stick to what you hit
const VINE_REGRAB = 1;

export const LOG_WIDTH = 2 * TILE;
const LOG_SPEED = 60;
const LOG_PAUSE = 1; // a log waits this long at each end of the river

export const ZIP_SPEED = 350;
const ZIP_RETURN_SPEED = 220;
export const ZIP_GRAB = 32;
export const ZIP_HANG = 26; // the slime hangs this far under the cable
export const ZIP_GRIP = 14; // the handle's grip is this far under the cable

export const LEAF_TIP_TIME = 1.5; // sit on a big leaf this long and it tips over
const LEAF_TILT = 0.4;
export const LEAF_BACK = 3; // seconds before it tips back up

const isQuicksand = k => k === TileKind.QUICKSAND;

/** Is a circle at `p` touching tile (col,row)? */
function circleTouchesTile(p, r, col, row) {
  const cx = Math.max(col * TILE, Math.min(p.x, (col + 1) * TILE));
  const cy = Math.max(row * TILE, Math.min(p.y, (row + 1) * TILE));
  return (p.x - cx) ** 2 + (p.y - cy) ** 2 < r * r;
}

/** True if an end stuck at `e` is sinking into quicksand. */
export function touchingQuicksand(level, e) {
  return circleTouches(level, e, END_RADIUS + 4, isQuicksand);
}

/** Where the bottom of a vine is when it's swung out to `angle` (0 = straight down). */
export function vineTip(vine, angle = vine.angle) {
  return {
    x: vine.x + Math.sin(angle) * vine.length,
    y: vine.y + Math.cos(angle) * vine.length,
  };
}

/**
 * How much swing a vine has (its energy): the same as how high it would get
 * if it swung out to `angle` and stopped.
 */
function swingHeight(vine, angle = null) {
  const g = GRAVITY / vine.length;
  if (angle !== null) {
    return g * (1 - Math.cos(angle));
  }
  return vine.omega ** 2 / 2 + g * (1 - Math.cos(vine.angle));
}

/** Where the grip of a zipline's handle is when the handle is at `h`. */
export function zipGrip(h) {
  return { x: h.x, y: h.y + ZIP_GRIP };
}

/**
 * Fling the slime from `from` with velocity (vx, vy) and see where it sticks,
 * using the real game physics. Returns null if it lands somewhere deadly or
 * falls out of the level.
 */
export function simulateLaunch(level, from, vx, vy, maxTime = 4) {
  const slime = new Slime(from);
  slime.launch(from.x, from.y, vx, vy, VINE_GRIP);
  const dt = 1 / 60;
  for (let t = 0; t < maxTime; t += dt) {
    slime.update(dt, level);
    const p = slime.ends[0];
    if (circleHitsDeadly(level, p, END_RADIUS * 0.6) || p.y > level.pixelHeight) {
      return null;
    }
    if (!slime.isFalling) {
      return { x: p.x, y: p.y };
    }
  }
  return null;
}

/**
 * Everywhere you could land by letting go of a vine, swinging it as high as
 * you can (and a bit lower) and letting go at lots of points of the swing.
 */
export function vineLandings(level, vine) {
  const g = GRAVITY / vine.length;
  const landings = [];
  for (const amp of [0.35, 0.6, 0.9, VINE_MAX_ANGLE / (Math.PI / 2)]) {
    const top = amp * (Math.PI / 2);
    for (let k = -6; k <= 6; k++) {
      const angle = (top * k) / 6.5;
      const speed = Math.sqrt(Math.max(0, 2 * g * (Math.cos(angle) - Math.cos(top))));
      for (const omega of [speed, -speed]) {
        const tip = vineTip(vine, angle);
        const v = vine.length * omega * VINE_FLING;
        const spot = simulateLaunch(
          level,
          { x: tip.x, y: tip.y + VINE_HANG },
          v * Math.cos(angle),
          -v * Math.sin(angle)
        );
        if (spot) {
          landings.push(spot);
        }
      }
    }
  }
  return landings;
}

/** The ends of the river a log floats between, as x positions of its middle. */
export function logRange(log) {
  return {
    min: log.from * TILE + LOG_WIDTH / 2,
    max: (log.to + 1) * TILE - LOG_WIDTH / 2,
  };
}

/** Where a slime end sits when it's riding on top of a log on river row `row`. */
export function logRideY(row) {
  return row * TILE - END_RADIUS;
}

export class JungleStuff {
  constructor(level) {
    this.level = level;
    this.monkeys = level.monkeys.map((m, i) => ({
      ...m,
      state: 'sit',
      timer: 0,
      cooldown: 1.5 + i * 0.8,
    }));
    this.bananas = [];
    this.snakes = level.snakes.map(s => {
      // A snake can only reach down until it hits the ground.
      const top = s.row * TILE;
      let reach = SNAKE_REACH;
      for (let y = top + SNAKE_COIL; y < top + SNAKE_REACH; y += 4) {
        if (isSolidKind(tileAt(level, s.col, Math.floor(y / TILE)))) {
          reach = y - top - 6;
          break;
        }
      }
      return { ...s, top, reach, len: SNAKE_COIL, state: 'up', timer: 0 };
    });
    this.traps = level.leafyTraps.map(t => ({ ...t, state: 'solid', timer: 0 }));
    this.leaves = findLeaves(level);
    this.vines = (level.def.vines || []).map(v => ({
      x: (v.at[0] + 0.5) * TILE,
      y: v.at[1] * TILE,
      length: v.length * TILE,
      angle: 0,
      omega: 0,
      cooldown: 0,
    }));
    this.ziplines = (level.def.ziplines || []).map(z => {
      const from = { x: (z.from[0] + 0.5) * TILE, y: (z.from[1] + 0.5) * TILE };
      const to = { x: (z.to[0] + 0.5) * TILE, y: (z.to[1] + 0.5) * TILE };
      return { from, to, x: from.x, y: from.y, state: 'ready' };
    });
    this.logs = (level.def.logs || []).map(l => {
      const range = logRange(l);
      // Remember what's under the log's path so the river comes back behind it.
      const under = [];
      for (let col = l.from; col <= l.to; col++) {
        under[col] = tileAt(level, col, l.row);
      }
      const log = { ...l, ...range, x: range.min, dir: 1, pause: 0, speed: l.speed || LOG_SPEED };
      log.under = under;
      log.cols = [];
      return log;
    });
    this.logs.forEach(log => this.placeLog(log));
    this.onVine = null; // index of the vine the slime is swinging on
    this.onZip = null; // index of the zipline the slime is zooming down
    this.sinkTimer = 0;
    this.reachScale = 1;
    this.time = 0;
    this.events = [];
  }

  /** Is the slime somewhere monkeys and snakes can get it? (Not inside a cannon or a gull.) */
  canHurt(slime) {
    return !slime.frozen || this.onVine !== null || this.onZip !== null;
  }

  /**
   * Advance everything. `finger` is where the player's finger is while it's
   * held down (for pumping a vine), or null. Returns 'quicksand', 'banana' or
   * 'snake' if the slime got hurt, otherwise null.
   */
  update(dt, slime, finger = null) {
    this.time += dt;
    this.updateVines(dt, slime, finger);
    this.updateZiplines(dt, slime);
    this.updateLogs(dt, slime);
    this.updateTraps(dt, slime);
    this.updateLeaves(dt, slime);
    const sunk = this.updateQuicksand(dt, slime);
    const banana = this.updateMonkeys(dt, slime);
    const snake = this.updateSnakes(dt, slime);
    return sunk || banana || snake;
  }

  updateQuicksand(dt, slime) {
    const sinking =
      !slime.frozen &&
      !slime.isFalling &&
      slime.ends.some(e => e.state === 'stuck' && touchingQuicksand(this.level, e));
    if (!sinking) {
      this.sinkTimer = 0;
      this.reachScale = 1;
      return null;
    }
    if (this.sinkTimer === 0) {
      this.events.push({ type: 'quicksand' });
    }
    this.sinkTimer += dt;
    this.reachScale = QUICKSAND_REACH;
    return this.sinkTimer > QUICKSAND_SINK_TIME ? 'quicksand' : null;
  }

  /** How far the slime has sunk into quicksand, from 0 to 1. */
  get sink() {
    return Math.min(1, this.sinkTimer / QUICKSAND_SINK_TIME);
  }

  // ---------------------------------------------------------------- monkeys

  updateMonkeys(dt, slime) {
    const c = slime.center;
    const target = this.canHurt(slime);
    for (const m of this.monkeys) {
      m.cooldown = Math.max(0, m.cooldown - dt);
      if (m.state === 'sit') {
        if (m.cooldown <= 0 && target && dist(c, m) < MONKEY_RANGE) {
          m.state = 'windup';
          m.timer = MONKEY_WINDUP;
          // It aims where you are now, so moving while it winds up dodges the banana.
          m.aim = { x: c.x, y: c.y };
          this.events.push({ type: 'chatter', x: m.x, y: m.y });
        }
      } else if (m.state === 'windup') {
        m.timer -= dt;
        if (m.timer <= 0) {
          m.state = 'sit';
          m.cooldown = MONKEY_EVERY;
          this.throwBanana(m, m.aim);
        }
      } else if (m.state === 'hiding') {
        m.timer -= dt;
        if (m.timer <= 0) {
          m.state = 'sit';
          m.cooldown = 1;
        }
      }
    }
    return this.updateBananas(dt, slime);
  }

  /** Throw a banana in an arc that lands at `target`. */
  throwBanana(m, target) {
    const from = { x: m.x, y: m.y - 8 };
    const time = Math.max(0.5, Math.min(1.3, dist(from, target) / 420));
    this.bananas.push({
      x: from.x,
      y: from.y,
      vx: (target.x - from.x) / time,
      vy: (target.y - from.y) / time - 0.5 * BANANA_GRAVITY * time,
      age: 0,
    });
    this.events.push({ type: 'throw', x: m.x, y: m.y });
  }

  updateBananas(dt, slime) {
    let hurt = null;
    const pts = slime.bodyPoints(10);
    const target = this.canHurt(slime);
    for (const b of this.bananas) {
      b.age += dt;
      b.vy = Math.min(MAX_FALL_SPEED, b.vy + BANANA_GRAVITY * dt);
      const steps = Math.max(1, Math.ceil((Math.hypot(b.vx, b.vy) * dt) / 4));
      for (let i = 0; i < steps && !b.gone; i++) {
        b.x += (b.vx * dt) / steps;
        b.y += (b.vy * dt) / steps;
        if (target && pts.some(p => dist(p, b) < BANANA_RADIUS + END_RADIUS * 0.6)) {
          hurt = 'banana';
          b.gone = true;
        } else if (circleHitsSolid(this.level, b, BANANA_RADIUS * 0.6)) {
          b.gone = true;
          this.events.push({ type: 'splat', x: b.x, y: b.y });
        }
      }
      if (b.y > this.level.pixelHeight || b.age > 5) {
        b.gone = true;
      }
    }
    this.bananas = this.bananas.filter(b => !b.gone);
    return hurt;
  }

  /** A slime shot scares a monkey: it hides in the leaves for a while. */
  scareMonkey(m) {
    if (m.state !== 'hiding') {
      m.state = 'hiding';
      m.timer = MONKEY_SCARED_TIME;
      this.events.push({ type: 'scared', x: m.x, y: m.y });
    }
  }

  /** The tongue at `tip` catches a flying banana. Returns true if it got one. */
  catchBanana(tip, radius) {
    const b = this.bananas.find(b => dist(b, tip) < radius + BANANA_RADIUS + 4);
    if (!b) {
      return false;
    }
    this.bananas = this.bananas.filter(other => other !== b);
    return true;
  }

  /**
   * Yum! Eating a banana gives back a missing piece of slime: first one a
   * seagull took (that blob of you out in the level disappears), otherwise a
   * slime shot blob comes home. Returns 'lost', 'shot' or 'snack' (nothing
   * was missing, it was just tasty).
   */
  eatBanana(island, shots) {
    if (island && island.lost > 0) {
      island.lost--;
      island.spares.pop();
      return 'lost';
    }
    if (shots && shots.blobs.length > 0) {
      shots.blobs.shift();
      return 'shot';
    }
    return 'snack';
  }

  // ----------------------------------------------------------------- snakes

  /** The snake's head right now. */
  snakeHead(s) {
    const sway = s.state === 'up' ? Math.sin(this.time * 2 + s.x) * 4 : 0;
    return { x: s.x + sway, y: s.top + s.len };
  }

  updateSnakes(dt, slime) {
    let hurt = null;
    const pts = slime.bodyPoints(8);
    const target = this.canHurt(slime);
    for (const s of this.snakes) {
      if (s.state === 'up') {
        s.len = SNAKE_COIL;
        const near = pts.some(
          p => Math.abs(p.x - s.x) < TILE * 0.9 && p.y > s.top && p.y < s.top + s.reach + 30
        );
        if (near && target) {
          s.state = 'warn';
          s.timer = SNAKE_WARN;
          this.events.push({ type: 'hiss', x: s.x, y: s.y });
        }
      } else if (s.state === 'warn') {
        s.timer -= dt;
        if (s.timer <= 0) {
          s.state = 'strike';
          s.timer = SNAKE_STRIKE;
          this.events.push({ type: 'snap', x: s.x, y: s.y });
        }
      } else if (s.state === 'strike') {
        s.timer -= dt;
        s.len = SNAKE_COIL + (s.reach - SNAKE_COIL) * Math.min(1, 1 - s.timer / SNAKE_STRIKE);
        if (s.timer <= 0) {
          s.state = 'hold';
          s.timer = SNAKE_HOLD;
        }
      } else if (s.state === 'hold') {
        s.timer -= dt;
        if (s.timer <= 0) {
          s.state = 'retract';
          s.timer = SNAKE_RETRACT;
        }
      } else if (s.state === 'retract') {
        s.timer -= dt;
        s.len = SNAKE_COIL + (s.reach - SNAKE_COIL) * Math.max(0, s.timer / SNAKE_RETRACT);
        if (s.timer <= 0) {
          s.state = 'rest';
          s.timer = SNAKE_REST;
        }
      } else if (s.state === 'rest') {
        s.len = SNAKE_COIL;
        s.timer -= dt;
        if (s.timer <= 0) {
          s.state = 'up';
        }
      }
      const biting = s.state === 'strike' || s.state === 'hold' || s.state === 'retract';
      if (biting && target) {
        const top = { x: s.x, y: s.top };
        const head = this.snakeHead(s);
        if (pts.some(p => pointSegmentDist(p, top, head) < SNAKE_RADIUS + END_RADIUS * 0.5)) {
          hurt = 'snake';
        }
      }
    }
    return hurt;
  }

  // ------------------------------------------------------------- leafy traps

  updateTraps(dt, slime) {
    const tiles = this.level.tiles;
    for (const t of this.traps) {
      if (t.state === 'solid') {
        const onIt =
          !slime.isFalling &&
          !slime.frozen &&
          slime.ends.some(
            e => e.state === 'stuck' && circleTouchesTile(e, END_RADIUS + 6, t.col, t.row)
          );
        if (onIt) {
          this.breakTrap(t);
          // It was only leaves! Down you go.
          slime.knockLoose(0, 0);
        }
      } else {
        t.timer -= dt;
        const blocked = slime
          .bodyPoints(8)
          .some(p => circleTouchesTile(p, END_RADIUS, t.col, t.row));
        if (t.timer <= 0 && !blocked) {
          t.state = 'solid';
          tiles[t.row][t.col] = TileKind.LEAFY;
        }
      }
    }
  }

  /** Break a leafy trap, and the rest of the leaves joined to it. */
  breakTrap(trap) {
    const joined = [trap];
    for (let i = 0; i < joined.length; i++) {
      const t = joined[i];
      for (const other of this.traps) {
        const next = other.row === t.row && Math.abs(other.col - t.col) === 1;
        if (next && other.state === 'solid' && !joined.includes(other)) {
          joined.push(other);
        }
      }
    }
    for (const t of joined) {
      t.state = 'gone';
      t.timer = LEAFY_REGROW;
      this.level.tiles[t.row][t.col] = TileKind.EMPTY;
    }
    this.events.push({ type: 'trap', x: (trap.col + 0.5) * TILE, y: (trap.row + 0.5) * TILE });
  }

  // ------------------------------------------------------------ tipping leaves

  updateLeaves(dt, slime) {
    const tiles = this.level.tiles;
    for (const leaf of this.leaves) {
      const top = leaf.row * TILE;
      if (leaf.state === 'up') {
        const sitting =
          !slime.isFalling &&
          !slime.frozen &&
          slime.ends.some(
            e =>
              e.state === 'stuck' &&
              Math.abs(e.y + END_RADIUS - top) < 8 &&
              e.x > leaf.from * TILE - 4 &&
              e.x < (leaf.to + 1) * TILE + 4
          );
        leaf.sat = sitting ? leaf.sat + dt : 0;
        if (leaf.sat >= LEAF_TIP_TIME) {
          leaf.state = 'tilting';
          leaf.timer = LEAF_TILT;
          this.events.push({ type: 'creak', x: leaf.from * TILE, y: top });
        }
      } else if (leaf.state === 'tilting') {
        leaf.timer -= dt;
        if (leaf.timer <= 0) {
          leaf.state = 'down';
          leaf.timer = LEAF_BACK;
          for (let col = leaf.from; col <= leaf.to; col++) {
            tiles[leaf.row][col] = TileKind.EMPTY;
          }
          // Whatever was sitting on the leaf slides off.
          slime.checkSupport(this.level);
          this.events.push({ type: 'tip', x: leaf.from * TILE, y: top });
        }
      } else {
        leaf.timer -= dt;
        const blocked = slime.bodyPoints(8).some(p => {
          for (let col = leaf.from; col <= leaf.to; col++) {
            if (circleTouchesTile(p, END_RADIUS, col, leaf.row)) {
              return true;
            }
          }
          return false;
        });
        if (leaf.timer <= 0 && !blocked) {
          leaf.state = 'up';
          leaf.sat = 0;
          for (let col = leaf.from; col <= leaf.to; col++) {
            tiles[leaf.row][col] = TileKind.LEAF;
          }
        }
      }
    }
  }

  /** How far a leaf is tipped over, from 0 (flat) to 1 (hanging straight down). */
  leafTilt(leaf) {
    if (leaf.state === 'up') {
      // It starts to wobble when you've been sitting on it a while.
      const k = leaf.sat / LEAF_TIP_TIME;
      return k > 0.4 ? Math.sin(this.time * 30) * 0.03 * k : 0;
    }
    if (leaf.state === 'tilting') {
      return 1 - leaf.timer / LEAF_TILT;
    }
    return 1;
  }

  // ------------------------------------------------------------------ vines

  updateVines(dt, slime, finger) {
    this.vines.forEach((vine, i) => {
      vine.cooldown = Math.max(0, vine.cooldown - dt);
      const riding = this.onVine === i;
      if (riding && finger) {
        this.pumpVine(vine, finger, dt);
      }
      // A pendulum: gravity pulls the vine back toward straight down.
      const steps = 4;
      const h = dt / steps;
      const damping = riding ? VINE_DAMPING : VINE_REST_DAMPING;
      for (let k = 0; k < steps; k++) {
        vine.omega += (-(GRAVITY / vine.length) * Math.sin(vine.angle) - damping * vine.omega) * h;
        vine.angle += vine.omega * h;
      }
      if (Math.abs(vine.angle) > VINE_MAX_ANGLE) {
        vine.angle = Math.sign(vine.angle) * VINE_MAX_ANGLE;
        if (vine.omega * vine.angle > 0) {
          vine.omega = 0;
        }
      }
      const tip = vineTip(vine);
      if (riding) {
        slime.holdAt(tip.x, tip.y + VINE_HANG);
        return;
      }
      const free = this.onVine === null && this.onZip === null && !slime.isFalling && !slime.frozen;
      if (free && vine.cooldown <= 0 && slime.ends.some(e => dist(e, tip) < VINE_GRAB)) {
        this.onVine = i;
        slime.holdAt(tip.x, tip.y + VINE_HANG);
        this.events.push({ type: 'vineGrab', x: tip.x, y: tip.y });
      }
    });
  }

  /**
   * Like pumping a playground swing: holding your finger out to one side
   * pushes the vine that way every time it swings that way.
   */
  pumpVine(vine, finger, dt) {
    const tip = vineTip(vine);
    const dx = finger.x - tip.x;
    if (Math.abs(dx) < 16) {
      return;
    }
    const dir = Math.sign(dx);
    const strength = Math.min(1, Math.abs(dx) / 120);
    const swingingThatWay = vine.omega * dir >= 0 || Math.abs(vine.omega) < 0.3;
    if (swingingThatWay && swingHeight(vine) < swingHeight(vine, VINE_MAX_ANGLE)) {
      vine.omega += dir * VINE_PUMP * strength * dt;
    }
    // You can't pump it higher than the highest swing.
    const g = GRAVITY / vine.length;
    const most = 2 * (swingHeight(vine, VINE_MAX_ANGLE) - g * (1 - Math.cos(vine.angle)));
    if (vine.omega ** 2 > most) {
      vine.omega = Math.sign(vine.omega) * Math.sqrt(Math.max(0, most));
    }
  }

  /** Let go of the vine: the slime flies off the way the vine was swinging. */
  letGoVine(slime) {
    if (this.onVine === null) {
      return false;
    }
    const vine = this.vines[this.onVine];
    const tip = vineTip(vine);
    const v = vine.length * vine.omega * VINE_FLING;
    const vx = v * Math.cos(vine.angle);
    slime.launch(tip.x, tip.y + VINE_HANG, vx, -v * Math.sin(vine.angle), VINE_GRIP);
    vine.cooldown = VINE_REGRAB;
    this.onVine = null;
    this.events.push({ type: 'vineLetGo', x: tip.x, y: tip.y });
    return true;
  }

  // -------------------------------------------------------------- ziplines

  updateZiplines(dt, slime) {
    this.ziplines.forEach((zip, i) => {
      if (zip.state === 'ready') {
        const free =
          this.onVine === null && this.onZip === null && !slime.isFalling && !slime.frozen;
        const grip = zipGrip(zip);
        if (free && slime.ends.some(e => dist(e, grip) < ZIP_GRAB)) {
          zip.state = 'riding';
          this.onZip = i;
          slime.holdAt(zip.x, zip.y + ZIP_HANG);
          this.events.push({ type: 'zipGrab', x: zip.x, y: zip.y });
        }
      } else if (zip.state === 'riding') {
        const there = moveToward(zip, zip.to, ZIP_SPEED * dt);
        slime.holdAt(zip.x, zip.y + ZIP_HANG);
        if (there) {
          // Wheee... and drop off at the end of the cable.
          slime.knockLoose(0, 0);
          zip.state = 'return';
          this.onZip = null;
          this.events.push({ type: 'zipDrop', x: zip.x, y: zip.y });
        }
      } else if (moveToward(zip, zip.from, ZIP_RETURN_SPEED * dt)) {
        zip.state = 'ready';
      }
    });
  }

  // ------------------------------------------------------------------- logs

  updateLogs(dt, slime) {
    for (const log of this.logs) {
      const before = log.x;
      if (log.pause > 0) {
        log.pause -= dt;
      } else {
        log.x += log.dir * log.speed * dt;
        if (log.x >= log.max || log.x <= log.min) {
          log.x = Math.max(log.min, Math.min(log.max, log.x));
          log.dir = -log.dir;
          log.pause = LOG_PAUSE;
        }
      }
      const dx = log.x - before;
      if (dx && !slime.isFalling && !slime.frozen) {
        this.carryRiders(log, before, dx, slime);
      }
      if (this.placeLog(log) && !slime.isFalling && !slime.frozen) {
        slime.checkSupport(this.level);
      }
    }
  }

  /** Ends stuck on top of a log float along with it. */
  carryRiders(log, before, dx, slime) {
    const rideY = logRideY(log.row);
    const riding = slime.ends.map(
      e =>
        e.state === 'stuck' &&
        Math.abs(e.y - rideY) < 6 &&
        Math.abs(e.x - before) < LOG_WIDTH / 2 + 6
    );
    slime.ends.forEach((e, i) => {
      const next = { x: e.x + dx, y: e.y };
      if (riding[i] && !circleHitsSolid(this.level, next, END_RADIUS)) {
        e.x = next.x;
      }
    });
    // Stretched too far? The log pulls your other end off the bank.
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

  /**
   * Make the river tiles under a log solid (and the ones it left behind
   * water again). Returns true if anything changed.
   */
  placeLog(log) {
    const left = log.x - LOG_WIDTH / 2;
    const right = log.x + LOG_WIDTH / 2;
    const cols = [];
    for (let col = log.from; col <= log.to; col++) {
      const overlap = Math.min(right, (col + 1) * TILE) - Math.max(left, col * TILE);
      if (overlap >= TILE / 2) {
        cols.push(col);
      }
    }
    if (cols.join() === log.cols.join()) {
      return false;
    }
    const tiles = this.level.tiles;
    for (const col of log.cols) {
      tiles[log.row][col] = log.under[col];
    }
    for (const col of cols) {
      tiles[log.row][col] = TileKind.LOG;
    }
    log.cols = cols;
    return true;
  }

  resetAfterDeath() {
    this.onVine = null;
    this.onZip = null;
    this.sinkTimer = 0;
    this.reachScale = 1;
    this.bananas = [];
    for (const m of this.monkeys) {
      if (m.state !== 'hiding') {
        m.state = 'sit';
      }
      m.cooldown = 2;
    }
    for (const s of this.snakes) {
      s.state = 'up';
      s.len = SNAKE_COIL;
    }
    for (const zip of this.ziplines) {
      if (zip.state === 'riding') {
        zip.state = 'return';
      }
    }
  }

  takeEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }
}

/** Move `p` toward `target`. Returns true once it's there. */
function moveToward(p, target, step) {
  const d = dist(p, target);
  if (d <= step) {
    p.x = target.x;
    p.y = target.y;
    return true;
  }
  p.x += ((target.x - p.x) / d) * step;
  p.y += ((target.y - p.y) / d) * step;
  return false;
}

/** Each run of big leaves (_) side by side is one leaf that tips over together. */
function findLeaves(level) {
  const leaves = [];
  level.tiles.forEach((row, r) => {
    let from = null;
    row.forEach((kind, c) => {
      if (kind === TileKind.LEAF && from === null) {
        from = c;
      }
      if (from !== null && (kind !== TileKind.LEAF || c === row.length - 1)) {
        const to = kind === TileKind.LEAF ? c : c - 1;
        leaves.push({ row: r, from, to, state: 'up', timer: 0, sat: 0 });
        from = null;
      }
    });
  });
  return leaves;
}
