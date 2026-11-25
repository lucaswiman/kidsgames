import { END_RADIUS, GRAVITY, MAX_FALL_SPEED, TILE } from './constants.js';
import { circleHitsDeadly, circleHitsSolid, dist } from './collision.js';
import {
  gravityDir,
  isBouncyKind,
  isPlatformKind,
  isSolidKind,
  outOfWorld,
  TileKind,
  tileAt,
} from './level.js';
import { Slime } from './slime.js';

// Things on the Island: waves that wash over the sand, falling coconuts,
// crabs, hammocks that bounce you up high, seagulls and treasure chests.

export const COCONUT_SHAKE = 0.5;
export const COCONUT_REGROW = 7;
const COCONUT_RADIUS = 13;
const COCONUT_SIGHT = 8 * TILE;

export const CRAB_RADIUS = 16;
const CRAB_SPEED = 55;
export const CRAB_FLIP_TIME = 4; // on its back after a slime shot
export const CRAB_KO_TIME = 8; // knocked out by a coconut

export const WAVE_DEPTH = 40; // how high the water gets above the sand
// A wave's life, in seconds from the start of its cycle.
const WAVE_WARN = 1.5; // foam builds up out at sea
const WAVE_IN = 1; // washing up the beach
const WAVE_HOLD = 1;
const WAVE_OUT = 1;

export const HAMMOCK_SPEED = 1000;
export const MOON_ROCK_SPEED = 1150; // moon rocks are extra bouncy
const HAMMOCK_GRIP = 3; // how close you have to be to stick after a bounce, like a cannon
export const FLOWER_GRIP = 5; // bouncy flowers make sure you stick to what you hit
const HAMMOCK_MIN_SPEED = 380;
const HAMMOCK_DAMPING = 0.6; // each quick bounce in a row is lower

export const GULL_WARN = 2; // seconds the landing shadow shows before it swoops
export const GULL_GRAB_RADIUS = 44;
const GULL_SWOOP_SPEED = 650;
const GULL_CARRY_SPEED = 280;
const GULL_EAT_TIME = 1.2;
const GULL_COOLDOWN = 5;
export const GULL_SKY = 1.5 * TILE; // how far below the top of the level gulls fly
export const LOST_BLOBS = 2; // a seagull barfs you up this many blobs smaller

export const CHEST_TOKENS = 10;

/**
 * How far the waves have washed up the sand at `time`: 0 (none) to 1 (all of
 * it), plus 'warn' while the next one is building up.
 */
export function waveState(waves, time) {
  if (!waves) {
    return { cover: 0, warn: false };
  }
  const t = (((time + (waves.offset || 0)) % waves.every) + waves.every) % waves.every;
  if (t < WAVE_WARN) {
    return { cover: 0, warn: true };
  }
  let k = t - WAVE_WARN;
  if (k < WAVE_IN) {
    return { cover: k / WAVE_IN, warn: false };
  }
  k -= WAVE_IN;
  if (k < WAVE_HOLD) {
    return { cover: 1, warn: false };
  }
  k -= WAVE_HOLD;
  if (k < WAVE_OUT) {
    return { cover: 1 - k / WAVE_OUT, warn: false };
  }
  return { cover: 0, warn: false };
}

/** Left and right edges of all the sand, in pixels. */
export function sandSpan(level) {
  let min = Infinity;
  let max = -Infinity;
  level.tiles.forEach(row =>
    row.forEach((kind, col) => {
      if (kind === TileKind.SAND) {
        min = Math.min(min, col * TILE);
        max = Math.max(max, (col + 1) * TILE);
      }
    })
  );
  return min < max ? { min, max } : null;
}

/** The stretch of sand a wave covers when it has washed `cover` of the way up. */
export function waveCover(waves, span, cover) {
  if (!span || cover <= 0) {
    return null;
  }
  const width = (span.max - span.min) * cover;
  return waves.from === 'right'
    ? { left: span.max - width, right: span.max }
    : { left: span.min, right: span.min + width };
}

/** True if point `p` is down on the sand, where a wave would get it. */
export function onSand(level, p) {
  const col = Math.floor(p.x / TILE);
  const fromRow = Math.floor(p.y / TILE);
  const toRow = Math.floor((p.y + WAVE_DEPTH + END_RADIUS) / TILE);
  for (let row = fromRow; row <= toRow; row++) {
    if (tileAt(level, col, row) === TileKind.SAND) {
      return row * TILE - p.y <= WAVE_DEPTH + END_RADIUS * 0.5;
    }
    if (isSolidKind(tileAt(level, col, row))) {
      return false;
    }
  }
  return false;
}

/**
 * The bouncy tile (hammock, flower or moon rock) a slime end at `p` is
 * sitting on, or null. Upside down (gravity flipped) only moon rocks bounce
 * you, off their bottoms: hammocks and flowers are one-way platforms you
 * can only sit on from above.
 */
export function bouncyUnder(level, p) {
  const col = Math.floor(p.x / TILE);
  if (gravityDir(level) < 0) {
    const row = Math.floor((p.y - END_RADIUS - 6) / TILE);
    const kind = tileAt(level, col, row);
    return kind === TileKind.MOON_ROCK && p.y > (row + 1) * TILE ? kind : null;
  }
  const row = Math.floor((p.y + END_RADIUS + 6) / TILE);
  const kind = tileAt(level, col, row);
  return isBouncyKind(kind) && p.y < row * TILE ? kind : null;
}

/** The end (if any) that is stuck on top of a hammock, a bouncy flower or a moon rock. */
function endOnHammock(level, slime) {
  return slime.ends.find(e => e.state === 'stuck' && bouncyUnder(level, e) !== null);
}

/**
 * How well the slime sticks after bouncing off whatever is under `p`
 * (bouncy flowers and moon rocks make sure you stick to what you hit).
 */
function bounceGrip(level, p) {
  return bouncyUnder(level, p) === TileKind.HAMMOCK ? HAMMOCK_GRIP : FLOWER_GRIP;
}

/** How fast whatever is under `p` bounces you. */
export function bounceSpeed(level, p) {
  return bouncyUnder(level, p) === TileKind.MOON_ROCK ? MOON_ROCK_SPEED : HAMMOCK_SPEED;
}

/**
 * Bounce up (away from whichever way is down) from a hammock, bouncy flower
 * or moon rock at `from` and see where the slime sticks, using the real game
 * physics. Returns null if it lands somewhere deadly, falls out of the level
 * or just comes back down onto something bouncy.
 */
export function simulateBounce(level, from, speed = bounceSpeed(level, from)) {
  const down = gravityDir(level);
  const slime = new Slime(from);
  slime.launch(from.x, from.y - 2 * down, 0, -speed * down, bounceGrip(level, from));
  const dt = 1 / 60;
  for (let t = 0; t < 4; t += dt) {
    slime.update(dt, level);
    const p = slime.ends[0];
    if (circleHitsDeadly(level, p, END_RADIUS * 0.6) || outOfWorld(level, p)) {
      return null;
    }
    if (!slime.isFalling) {
      return endOnHammock(level, slime) ? null : { x: p.x, y: p.y };
    }
  }
  return null;
}

export class IslandStuff {
  constructor(level) {
    this.level = level;
    this.waves = level.def.waves || null;
    this.span = sandSpan(level);
    this.coconuts = level.coconuts.map(c => ({
      ...c,
      homeY: c.row * TILE + 14,
      y: c.row * TILE + 14,
      vy: 0,
      state: 'hanging',
      timer: 0,
    }));
    this.crabs = level.crabs.map((c, i) => ({
      ...c,
      homeX: c.x,
      y: (c.row + 1) * TILE - CRAB_RADIUS,
      dir: i % 2 ? -1 : 1,
      state: 'walk',
      timer: 0,
    }));
    this.gulls = (level.def.gulls || []).map(g => ({
      ...g,
      x: (g.from + 0.5) * TILE,
      y: GULL_SKY,
      dir: 1,
      state: 'fly',
      timer: 0,
      cooldown: 2,
      target: null,
    }));
    this.blobSpots = (level.def.blobSpots || []).map(([col, row]) => ({
      x: (col + 0.5) * TILE,
      y: (row + 0.5) * TILE,
    }));
    this.chests = level.chests.map(c => ({ ...c, taken: false }));
    this.hammockArmed = true;
    this.lastBounce = -Infinity;
    this.lastBounceSpeed = HAMMOCK_SPEED;
    this.lost = 0; // blobs of slime lost to a seagull's tummy
    this.spares = []; // ...which turn up somewhere else in the level
    this.eaten = false; // inside a seagull right now
    this.time = 0;
    this.events = [];
  }

  /**
   * Advance everything. Returns 'coconut', 'crab' or 'wave' if the slime got
   * hurt, otherwise null.
   */
  update(dt, slime, waveTime) {
    this.time += dt;
    const hurt =
      this.updateCoconuts(dt, slime) ||
      this.updateCrabs(dt, slime) ||
      this.checkWave(slime, waveTime);
    this.updateHammocks(slime);
    this.updateGulls(dt, slime);
    this.updateSpares(slime);
    return hurt;
  }

  updateCoconuts(dt, slime) {
    const pts = slime.bodyPoints(10);
    let hurt = null;
    for (const c of this.coconuts) {
      if (c.state === 'hanging') {
        const below = pts.some(
          p => Math.abs(p.x - c.x) < 34 && p.y > c.y && p.y - c.y < COCONUT_SIGHT
        );
        if (below && !slime.isFalling && !slime.frozen) {
          c.state = 'shaking';
          c.timer = COCONUT_SHAKE;
          this.events.push({ type: 'rustle', x: c.x, y: c.y });
        }
      } else if (c.state === 'shaking') {
        c.timer -= dt;
        if (c.timer <= 0) {
          c.state = 'falling';
          c.vy = 0;
        }
      } else if (c.state === 'falling') {
        c.vy = Math.min(MAX_FALL_SPEED, c.vy + GRAVITY * dt);
        const steps = Math.max(1, Math.ceil((c.vy * dt) / 4));
        for (let i = 0; i < steps && c.state === 'falling'; i++) {
          c.y += (c.vy * dt) / steps;
          const p = { x: c.x, y: c.y };
          if (!slime.frozen && pts.some(q => dist(q, p) < COCONUT_RADIUS + END_RADIUS * 0.6)) {
            hurt = 'coconut';
          }
          // Bonk! A coconut knocks out any crab it lands on.
          for (const crab of this.crabs) {
            if (crab.state !== 'ko' && dist(crab, p) < COCONUT_RADIUS + CRAB_RADIUS) {
              crab.state = 'ko';
              crab.timer = CRAB_KO_TIME;
              this.breakCoconut(c, 'bonk');
            }
          }
          if (
            c.state === 'falling' &&
            (circleHitsSolid(this.level, p, COCONUT_RADIUS) ||
              circleHitsDeadly(this.level, p, COCONUT_RADIUS) ||
              landsOnPlatform(this.level, p) ||
              c.y > this.level.pixelHeight)
          ) {
            this.breakCoconut(c, 'crack');
          }
        }
      } else if (c.state === 'gone') {
        c.timer -= dt;
        if (c.timer <= 0) {
          c.state = 'hanging';
          c.y = c.homeY;
        }
      }
    }
    return hurt;
  }

  breakCoconut(c, type) {
    c.state = 'gone';
    c.timer = COCONUT_REGROW;
    this.events.push({ type, x: c.x, y: c.y });
  }

  updateCrabs(dt, slime) {
    let hurt = null;
    const pts = slime.bodyPoints(8);
    for (const crab of this.crabs) {
      if (crab.state !== 'walk') {
        crab.timer -= dt;
        if (crab.timer <= 0) {
          crab.state = 'walk';
          this.events.push({ type: 'crabUp', x: crab.x, y: crab.y });
        }
        continue;
      }
      const ahead = crab.x + crab.dir * (CRAB_RADIUS + 4);
      const col = Math.floor(ahead / TILE);
      const blocked = isSolidKind(tileAt(this.level, col, crab.row));
      const below = tileAt(this.level, col, crab.row + 1);
      const floor = isSolidKind(below) || isPlatformKind(below);
      if (blocked || !floor) {
        crab.dir = -crab.dir;
      } else {
        crab.x += crab.dir * CRAB_SPEED * dt;
      }
      if (!slime.frozen && pts.some(p => dist(p, crab) < CRAB_RADIUS + END_RADIUS * 0.6)) {
        hurt = 'crab';
      }
    }
    return hurt;
  }

  /** A slime shot flips a crab onto its back for a few seconds. */
  flipCrab(crab) {
    if (crab.state === 'walk') {
      crab.state = 'flipped';
      crab.timer = CRAB_FLIP_TIME;
      this.events.push({ type: 'flip', x: crab.x, y: crab.y });
    }
  }

  /** The stretch of sand under water right now (or null). */
  waveNow(time) {
    return waveCover(this.waves, this.span, waveState(this.waves, time).cover);
  }

  checkWave(slime, time) {
    const cover = this.waveNow(time);
    if (!cover || slime.frozen) {
      return null;
    }
    const wet = slime
      .bodyPoints(12)
      .some(p => p.x > cover.left && p.x < cover.right && onSand(this.level, p));
    return wet ? 'wave' : null;
  }

  updateHammocks(slime) {
    const free = !slime.isFalling && !slime.frozen && slime.heldIndex < 0;
    const end = free ? endOnHammock(this.level, slime) : null;
    if (!end) {
      if (!slime.isFalling) {
        this.hammockArmed = !endOnHammock(this.level, slime);
      } else {
        this.hammockArmed = true;
      }
      return;
    }
    if (!this.hammockArmed) {
      return;
    }
    this.hammockArmed = false;
    // Bouncing again right after a bounce goes less high, until you stop.
    const quick = this.time - this.lastBounce < 2.5;
    const speed = quick ? this.lastBounceSpeed * HAMMOCK_DAMPING : bounceSpeed(this.level, end);
    if (speed < HAMMOCK_MIN_SPEED) {
      return;
    }
    this.lastBounce = this.time;
    this.lastBounceSpeed = speed;
    // Up and away from whichever way is down.
    const down = gravityDir(this.level);
    slime.launch(end.x, end.y - 2 * down, 0, -speed * down, bounceGrip(this.level, end));
    this.events.push({ type: 'bounce', x: end.x, y: end.y });
  }

  updateGulls(dt, slime) {
    const c = slime.center;
    for (const gull of this.gulls) {
      gull.cooldown = Math.max(0, gull.cooldown - dt);
      const left = (gull.from + 0.5) * TILE;
      const right = (gull.to + 0.5) * TILE;
      if (gull.state === 'fly') {
        gull.x += gull.dir * 110 * dt;
        if (gull.x > right) {
          gull.x = right;
          gull.dir = -1;
        } else if (gull.x < left) {
          gull.x = left;
          gull.dir = 1;
        }
        gull.y += (GULL_SKY - gull.y) * Math.min(1, dt * 3);
        const busy = this.gulls.some(g => g !== gull && g.state !== 'fly');
        const free = !slime.isFalling && !slime.frozen;
        if (!busy && free && gull.cooldown <= 0 && c.x > left - TILE && c.x < right + TILE) {
          gull.state = 'aim';
          gull.timer = GULL_WARN;
          gull.target = { x: c.x, y: c.y };
          this.events.push({ type: 'squawk' });
        }
      } else if (gull.state === 'aim') {
        // Circle above the landing spot so you can see where it's coming.
        gull.timer -= dt;
        gull.x += (gull.target.x - gull.x) * Math.min(1, dt * 4);
        gull.dir = Math.sign(gull.target.x - gull.x) || gull.dir;
        if (gull.timer <= 0) {
          gull.state = 'swoop';
        }
      } else if (gull.state === 'swoop') {
        if (this.moveGull(gull, gull.target, GULL_SWOOP_SPEED, dt)) {
          const caught =
            !slime.isFalling &&
            !slime.frozen &&
            slime.bodyPoints(10).some(p => dist(p, gull.target) < GULL_GRAB_RADIUS);
          if (caught) {
            this.events.push({ type: 'gullGrab' });
            gull.state = gull.nice ? 'carry' : 'eat';
            gull.timer = GULL_EAT_TIME;
            if (!gull.nice) {
              this.eaten = true;
            }
          } else {
            gull.state = 'leave';
            gull.cooldown = GULL_COOLDOWN;
          }
        }
      } else if (gull.state === 'carry') {
        const [col, row] = gull.drop;
        const drop = { x: (col + 0.5) * TILE, y: (row + 0.5) * TILE };
        const there = this.moveGull(gull, drop, GULL_CARRY_SPEED, dt);
        slime.holdAt(gull.x, gull.y + 20);
        if (there) {
          slime.knockLoose(0, 0);
          gull.state = 'leave';
          gull.cooldown = GULL_COOLDOWN;
          this.events.push({ type: 'gullDrop' });
        }
      } else if (gull.state === 'eat') {
        // Gulp! It flaps up a little with you in its tummy...
        gull.timer -= dt;
        gull.y -= 50 * dt;
        slime.holdAt(gull.x, gull.y + 20);
        if (gull.timer <= 0) {
          // ...then barfs you back up, smaller.
          this.eaten = false;
          slime.knockLoose(0, 0);
          this.barf();
          gull.state = 'leave';
          gull.cooldown = GULL_COOLDOWN + 2;
        }
      } else if (gull.state === 'leave') {
        if (this.moveGull(gull, { x: gull.x, y: GULL_SKY }, 260, dt)) {
          gull.state = 'fly';
        }
      }
    }
  }

  /** Move a gull toward `p`. Returns true once it's there. */
  moveGull(gull, p, speed, dt) {
    const d = dist(gull, p);
    if (d <= speed * dt) {
      gull.x = p.x;
      gull.y = p.y;
      return true;
    }
    gull.dir = Math.sign(p.x - gull.x) || gull.dir;
    gull.x += ((p.x - gull.x) / d) * speed * dt;
    gull.y += ((p.y - gull.y) / d) * speed * dt;
    return false;
  }

  /** You lose some slime, which turns up as blobs somewhere else in the level. */
  barf() {
    const fresh = Math.min(LOST_BLOBS, Math.max(0, this.blobSpots.length - this.spares.length));
    const free = this.blobSpots.filter(s => !this.spares.some(b => b.x === s.x && b.y === s.y));
    for (let i = 0; i < fresh; i++) {
      const k = Math.floor(Math.random() * free.length);
      this.spares.push({ ...free.splice(k, 1)[0] });
    }
    this.lost += fresh;
    this.events.push({ type: 'barf' });
  }

  updateSpares(slime) {
    if (slime.frozen) {
      return;
    }
    const before = this.spares.length;
    this.spares = this.spares.filter(b => !slime.ends.some(e => dist(e, b) < END_RADIUS + 18));
    const got = before - this.spares.length;
    if (got > 0) {
      this.lost = Math.max(0, this.lost - got);
      this.events.push({ type: 'absorb' });
    }
  }

  /** Treasure chests the slime just touched. */
  touchedChests(slime) {
    const pts = slime.bodyPoints(10);
    const found = [];
    for (const chest of this.chests) {
      if (!chest.taken && pts.some(p => dist(p, chest) < END_RADIUS + 20)) {
        chest.taken = true;
        found.push(chest);
      }
    }
    return found;
  }

  resetAfterDeath() {
    // Back to full size, and the gulls start over.
    this.lost = 0;
    this.spares = [];
    this.eaten = false;
    this.hammockArmed = true;
    for (const gull of this.gulls) {
      gull.state = 'leave';
      gull.cooldown = 3;
    }
  }

  takeEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }
}

function landsOnPlatform(level, p) {
  const row = Math.floor((p.y + COCONUT_RADIUS) / TILE);
  const top = row * TILE;
  return (
    isPlatformKind(tileAt(level, Math.floor(p.x / TILE), row)) && p.y + COCONUT_RADIUS - top < 12
  );
}
