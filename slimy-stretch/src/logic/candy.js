import { END_RADIUS, TILE } from './constants.js';
import { circleHitsSolid, circleTouches, dist, pointSegmentDist } from './collision.js';
import { isSolidKind, TileKind, tileAt } from './level.js';
import { TONGUE_RADIUS } from './tongue.js';

// Things in Candyland: chocolate rivers (deadly, like lava), sticky caramel
// that holds you still for a moment, gumball machines that shoot gumballs,
// swinging candy canes, sour candy clouds that rain sour drops, marshmallows
// that squish down and spring you up, licorice ropes you slide down,
// lollipops that make you stretch farther, and ice cream scoops that melt.
// (Bouncy gumdrops work just like the island's hammocks, see island.js.)

export const CARAMEL_HOLD = 2.5; // stick to caramel and you can't move for this long

export const MARSH_SQUISH_TIME = 1.5; // sit on a marshmallow this long and it springs you up
export const MARSH_SINK = 10; // how far a marshmallow squishes down (just for looks)
export const MARSH_BOUNCE = 600; // a gentle bounce, much smaller than a hammock's
const MARSH_GRIP = 5; // like bouncy flowers, you always stick to what you bump into
const MARSH_SPRING_BACK = 3; // how fast it puffs back up after you get off

export const ROPE_GRAB = 24; // how close to a licorice rope you have to touch it
export const ROPE_SPEED = 250; // how fast you slide down
const ROPE_TOP_GAP = 16; // you hold on at least this far below the top of the rope

export const LOLLIPOP_RADIUS = 18;
export const LOLLIPOP_BOOST = 1.5; // licking a lollipop makes your stretch this much longer...
export const LOLLIPOP_TIME = 6; // ...for this many seconds
export const LOLLIPOP_REGROW = 10; // and a new lollipop turns up after this long

export const MELT_TIME = 3.5; // sit on an ice cream scoop this long and it melts
export const REFREEZE_TIME = 4; // seconds before a melted scoop freezes back
export const MELT_SINK = 8; // how far the slime sinks into the melting ice cream

export const GUMBALL_EVERY = 4; // seconds between gumballs from each machine
export const GUMBALL_WARN = 1; // the machine shakes and rattles this long first
export const GUMBALL_RANGE = 7 * TILE; // how close you have to be before it shoots
export const GUMBALL_SPEED = 300;
export const GUMBALL_RADIUS = 10;
export const GUMBALL_BOUNCES = 2; // a gumball bounces off walls this many times, then pops
const GUMBALL_SPOUT = 36; // gumballs come out this far from the middle of the machine
const GUMBALL_LIFE = 6;

export const CANE_LENGTH = 2 * TILE; // from the pivot to the bottom of the hook
export const CANE_PERIOD = 3; // seconds for one swing there and back
export const CANE_SWING = 1.1; // radians either side of straight down
export const CANE_THICK = 7;

export const SOUR_EVERY = 8; // seconds between showers from each sour cloud
export const SOUR_WARN = 1; // the cloud turns dark and rumbles this long first
export const SOUR_RAIN = 2.5; // then it rains this long
export const SOUR_STAGGER = 2; // clouds take turns, this far apart

const isCaramel = k => k === TileKind.CARAMEL;

/** True if a slime end at `e` is touching sticky caramel. */
export function touchingCaramel(level, e) {
  return circleTouches(level, e, END_RADIUS + 4, isCaramel);
}

/** Where a slime sliding down a licorice rope gets let go: at the very bottom. */
export function ropeDrop(rope) {
  return { x: rope.x, y: rope.bottom - END_RADIUS - 2 };
}

/** Is a slime end at `p` touching a licorice rope? */
export function touchingRope(rope, p) {
  return pointSegmentDist(p, { x: rope.x, y: rope.top }, { x: rope.x, y: rope.bottom }) < ROPE_GRAB;
}

/** Where a candy cane is at `time`: its pivot, the bottom of its hook and its angle. */
export function caneShape(cane, time) {
  const pivot = { x: cane.x, y: cane.row * TILE + 2 };
  const angle = Math.sin((time * 2 * Math.PI) / CANE_PERIOD + (cane.phase || 0)) * CANE_SWING;
  return {
    pivot,
    angle,
    tip: {
      x: pivot.x + Math.sin(angle) * CANE_LENGTH,
      y: pivot.y + Math.cos(angle) * CANE_LENGTH,
    },
  };
}

/** 'calm', 'warn' (dark and rumbling) or 'rain' for a sour candy cloud. */
export function sourState(cloud, time) {
  const offset = cloud.offset || 0;
  // Clouds take turns: each one waits a little longer before its first shower.
  if (time < offset) {
    return 'calm';
  }
  const t = (time - offset) % SOUR_EVERY;
  if (t >= SOUR_EVERY - SOUR_RAIN) {
    return 'rain';
  }
  return t >= SOUR_EVERY - SOUR_RAIN - SOUR_WARN ? 'warn' : 'calm';
}

/** Where the rain under column `col` of a cloud stops: the top of the first solid tile. */
export function rainBottom(level, row, col) {
  for (let r = row + 1; r < level.height; r++) {
    if (isSolidKind(tileAt(level, col, r))) {
      return r * TILE;
    }
  }
  return level.pixelHeight;
}

/** Each run of tiles of `kind` side by side in a row is one thing (a cloud, a scoop...). */
function runsOf(level, kind) {
  const runs = [];
  level.tiles.forEach((row, r) => {
    let from = null;
    row.forEach((k, c) => {
      if (k === kind && from === null) {
        from = c;
      }
      if (from !== null && (k !== kind || c === row.length - 1)) {
        const to = k === kind ? c : c - 1;
        runs.push({ row: r, from, to });
        from = null;
      }
    });
  });
  return runs;
}

/** The stuck ends sitting on top of a run of tiles (`sink` = how far they may have sunk in). */
function endsOnTop(slime, run, sink = 0) {
  if (slime.isFalling || slime.frozen) {
    return [];
  }
  const top = run.row * TILE;
  return slime.ends.filter(
    e =>
      e.state === 'stuck' &&
      e.y + END_RADIUS > top - 8 &&
      e.y + END_RADIUS < top + sink + 4 &&
      e.x > run.from * TILE - 4 &&
      e.x < (run.to + 1) * TILE + 4
  );
}

export class CandyStuff {
  constructor(level) {
    this.level = level;
    this.marshmallows = runsOf(level, TileKind.MARSHMALLOW).map(m => ({ ...m, sat: 0, pop: 0 }));
    this.scoops = runsOf(level, TileKind.ICE_CREAM).map(s => ({
      ...s,
      state: 'frozen',
      sat: 0,
      timer: 0,
    }));
    this.ropes = level.ropes.map(r => ({ ...r, armed: true }));
    this.lollipops = level.lollipops.map(l => ({ ...l, state: 'ready', timer: 0 }));
    this.machines = level.gumballMachines.map((m, i) => ({
      ...m,
      state: 'wait',
      timer: 0,
      cooldown: 1.5 + i * 0.9,
      aim: null,
    }));
    this.gumballs = [];
    this.canes = level.candyCanes.map((c, i) => ({ ...c, phase: i * 1.3 }));
    // Clouds take turns from left to right, so they don't all rain at once.
    this.clouds = runsOf(level, TileKind.SOUR_CLOUD)
      .sort((a, b) => a.from - b.from || a.row - b.row)
      .map((c, i) => ({
        ...c,
        x: ((c.from + c.to + 1) / 2) * TILE,
        y: (c.row + 0.5) * TILE,
        offset: (i * SOUR_STAGGER) % SOUR_EVERY,
        state: 'calm',
        bottoms: [],
      }));
    for (const c of this.clouds) {
      this.findRainBottoms(c);
    }
    this.caramel = 0; // seconds left being held by caramel
    this.gluedSlime = null; // the slime (or half) the caramel is holding
    this.wasLoose = [false, false];
    this.onRope = null; // { index, y } while sliding down a licorice rope
    this.boost = 0; // seconds left of a lollipop's longer stretch
    this.time = 0;
    this.events = [];
  }

  /** A lollipop makes you stretch farther for a while. */
  get reachScale() {
    return this.boost > 0 ? LOLLIPOP_BOOST : 1;
  }

  /** Can things hurt the slime? (Not while something is carrying it, except a rope.) */
  canHurt(slime) {
    return !slime.frozen || this.onRope !== null;
  }

  /**
   * Advance everything. `time` is the level time (for the swinging canes and
   * the sour clouds). Returns 'gumball', 'candycane' or 'sour' if the slime
   * got hurt, otherwise null.
   */
  update(dt, slime, time = this.time + dt) {
    this.time = time;
    // Something else let go of the slime (like splitting in two): off the rope.
    if (this.onRope !== null && !slime.frozen) {
      this.onRope = null;
    }
    this.boost = Math.max(0, this.boost - dt);
    this.updateCaramel(dt, slime);
    this.updateRopes(dt, slime);
    this.updateMarshmallows(dt, slime);
    this.updateScoops(dt, slime);
    this.updateLollipops(dt);
    const pts = this.canHurt(slime) ? slime.bodyPoints(8) : [];
    const gumball = this.updateGumballs(dt, slime, pts);
    const cane = this.updateCanes(pts, time);
    const sour = this.updateClouds(pts, time);
    return gumball || cane || sour;
  }

  // ---------------------------------------------------------------- caramel

  updateCaramel(dt, slime) {
    const settled = !slime.isFalling && !slime.frozen;
    if (this.caramel > 0) {
      this.caramel -= dt;
      // Knocked loose (or carried off): the caramel lets go too.
      if (this.gluedSlime === slime && !settled) {
        this.caramel = 0;
      }
      if (this.caramel <= 0) {
        this.release();
      }
    } else if (settled) {
      // Only a fresh stick (letting go of a stretch, or landing) gets caught,
      // not an end boinging back to the other one after a missed stretch.
      const caught = slime.ends.some(
        (e, i) => this.wasLoose[i] && e.state === 'stuck' && touchingCaramel(this.level, e)
      );
      if (caught) {
        this.caramel = CARAMEL_HOLD;
        this.gluedSlime = slime;
        slime.glued = true;
        const e = slime.ends.find(end => touchingCaramel(this.level, end));
        this.events.push({ type: 'caramel', x: e.x, y: e.y });
      }
    }
    this.wasLoose = slime.ends.map(e => !settled || e.state === 'held');
  }

  /** The caramel lets go: you can stretch again. */
  release() {
    this.caramel = 0;
    if (this.gluedSlime) {
      this.gluedSlime.glued = false;
      this.events.push({ type: 'caramelFree' });
    }
    this.gluedSlime = null;
  }

  // ---------------------------------------------------------- licorice ropes

  updateRopes(dt, slime) {
    const free = !slime.isFalling && !slime.frozen;
    this.ropes.forEach((rope, i) => {
      if (this.onRope && this.onRope.index === i) {
        // Wheee, down the rope...
        this.onRope.y = Math.min(ropeDrop(rope).y, this.onRope.y + ROPE_SPEED * dt);
        slime.holdAt(rope.x, this.onRope.y);
        if (this.onRope.y >= ropeDrop(rope).y) {
          // ...and off the bottom.
          this.onRope = null;
          rope.armed = false;
          slime.knockLoose(0, 0);
          this.events.push({ type: 'ropeDrop', x: rope.x, y: rope.bottom });
        }
        return;
      }
      const touching = slime.ends.filter(e => touchingRope(rope, e));
      if (!touching.length) {
        // You have to get off a rope before it can catch you again.
        rope.armed = true;
      } else if (rope.armed && free && this.onRope === null) {
        const y = Math.max(rope.top + ROPE_TOP_GAP, Math.min(ropeDrop(rope).y, touching[0].y));
        this.onRope = { index: i, y };
        slime.holdAt(rope.x, y);
        this.events.push({ type: 'ropeGrab', x: rope.x, y });
      }
    });
  }

  // ------------------------------------------------------------ marshmallows

  updateMarshmallows(dt, slime) {
    for (const m of this.marshmallows) {
      m.pop = Math.max(0, m.pop - dt);
      const on = endsOnTop(slime, m);
      if (!on.length) {
        // Puff! It springs back up when you get off.
        m.sat = Math.max(0, m.sat - dt * MARSH_SPRING_BACK);
        continue;
      }
      if (m.sat === 0) {
        this.events.push({ type: 'squish', x: on[0].x, y: m.row * TILE });
      }
      m.sat = Math.min(MARSH_SQUISH_TIME, m.sat + dt);
      // All squished down: it springs back up and bounces you (but not while
      // you're in the middle of a stretch).
      if (m.sat >= MARSH_SQUISH_TIME && slime.heldIndex < 0) {
        const e = on[0];
        m.sat = 0;
        m.pop = 0.3;
        slime.launch(e.x, e.y - 2, 0, -MARSH_BOUNCE, MARSH_GRIP);
        this.events.push({ type: 'spring', x: e.x, y: e.y });
      }
    }
  }

  /** How squished a marshmallow is, from 0 to 1. */
  squish(m) {
    return Math.min(1, m.sat / MARSH_SQUISH_TIME);
  }

  // ---------------------------------------------------------- ice cream scoops

  updateScoops(dt, slime) {
    const tiles = this.level.tiles;
    for (const s of this.scoops) {
      if (s.state === 'frozen') {
        const on = endsOnTop(slime, s, MELT_SINK);
        if (on.length && s.sat === 0) {
          this.events.push({ type: 'drip', x: on[0].x, y: s.row * TILE });
        }
        s.sat = on.length ? s.sat + dt : 0;
        // You slowly sink into the melting ice cream...
        const sink = Math.min(1, s.sat / MELT_TIME) * MELT_SINK;
        for (const e of on) {
          e.y = s.row * TILE - END_RADIUS - 1 + sink;
        }
        if (s.sat >= MELT_TIME) {
          // ...and then it melts away and you fall through!
          s.state = 'melted';
          s.timer = REFREEZE_TIME;
          for (let col = s.from; col <= s.to; col++) {
            tiles[s.row][col] = TileKind.EMPTY;
          }
          slime.checkSupport(this.level);
          this.events.push({ type: 'melt', x: on[0].x, y: s.row * TILE });
        }
      } else {
        s.timer -= dt;
        // It can't freeze back while the slime is in the way.
        const blocked = slime.bodyPoints(8).some(p => {
          const cy = Math.max(s.row * TILE, Math.min(p.y, (s.row + 1) * TILE));
          const cx = Math.max(s.from * TILE, Math.min(p.x, (s.to + 1) * TILE));
          return (p.x - cx) ** 2 + (p.y - cy) ** 2 < END_RADIUS * END_RADIUS;
        });
        if (s.timer <= 0 && !blocked) {
          s.state = 'frozen';
          s.sat = 0;
          for (let col = s.from; col <= s.to; col++) {
            tiles[s.row][col] = TileKind.ICE_CREAM;
          }
        }
      }
    }
  }

  /** How melted a scoop is, from 0 (just frozen) to 1 (melted away). */
  melt(s) {
    return s.state === 'frozen' ? Math.min(1, s.sat / MELT_TIME) : 1;
  }

  // -------------------------------------------------------------- lollipops

  updateLollipops(dt) {
    for (const l of this.lollipops) {
      if (l.state === 'gone') {
        l.timer -= dt;
        if (l.timer <= 0) {
          l.state = 'ready';
          this.events.push({ type: 'lollipopBack', x: l.x, y: l.y });
        }
      }
    }
  }

  /** The tongue tip at `tip` licks a lollipop: you stretch farther for a while. */
  lick(tip) {
    const l = this.lollipops.find(
      l => l.state === 'ready' && dist(l, tip) < LOLLIPOP_RADIUS + TONGUE_RADIUS
    );
    if (!l) {
      return false;
    }
    l.state = 'gone';
    l.timer = LOLLIPOP_REGROW;
    this.boost = LOLLIPOP_TIME;
    this.events.push({ type: 'lick', x: l.x, y: l.y });
    return true;
  }

  // -------------------------------------------------------- gumball machines

  updateGumballs(dt, slime, pts) {
    const c = slime.center;
    const target = this.canHurt(slime);
    for (const m of this.machines) {
      m.cooldown = Math.max(0, m.cooldown - dt);
      if (m.state === 'wait') {
        if (m.cooldown <= 0 && target && dist(c, m) < GUMBALL_RANGE) {
          m.state = 'warn';
          m.timer = GUMBALL_WARN;
          // It aims where you are now, so moving while it rattles dodges the gumball.
          m.aim = { x: c.x, y: c.y };
          this.events.push({ type: 'rattle', x: m.x, y: m.y });
        }
      } else {
        m.timer -= dt;
        if (m.timer <= 0) {
          m.state = 'wait';
          m.cooldown = GUMBALL_EVERY;
          this.shoot(m, m.aim);
        }
      }
    }
    let hurt = null;
    for (const b of this.gumballs) {
      b.age += dt;
      const steps = Math.max(1, Math.ceil((GUMBALL_SPEED * dt) / 4));
      for (let i = 0; i < steps && !b.gone; i++) {
        this.moveGumball(b, dt / steps);
        if (pts.some(p => dist(p, b) < GUMBALL_RADIUS + END_RADIUS * 0.6)) {
          hurt = 'gumball';
          b.gone = true;
          this.events.push({ type: 'pop', x: b.x, y: b.y });
        }
      }
      if (!b.gone && (b.age > GUMBALL_LIFE || b.y > this.level.pixelHeight)) {
        b.gone = true;
      }
    }
    this.gumballs = this.gumballs.filter(b => !b.gone);
    return hurt;
  }

  /** Shoot a gumball from machine `m` straight at `target`. */
  shoot(m, target) {
    const d = dist(m, target) || 1;
    const dx = (target.x - m.x) / d;
    const dy = (target.y - m.y) / d;
    this.gumballs.push({
      x: m.x + dx * GUMBALL_SPOUT,
      y: m.y + dy * GUMBALL_SPOUT,
      vx: dx * GUMBALL_SPEED,
      vy: dy * GUMBALL_SPEED,
      bounces: 0,
      age: 0,
      color: this.gumballs.length % 4,
    });
    this.events.push({ type: 'shoot', x: m.x, y: m.y });
  }

  /** Move a gumball a little way, bouncing it off walls (it pops after a couple of bounces). */
  moveGumball(b, dt) {
    const nx = b.x + b.vx * dt;
    let bounced = false;
    if (circleHitsSolid(this.level, { x: nx, y: b.y }, GUMBALL_RADIUS)) {
      b.vx = -b.vx;
      bounced = true;
    } else {
      b.x = nx;
    }
    const ny = b.y + b.vy * dt;
    if (circleHitsSolid(this.level, { x: b.x, y: ny }, GUMBALL_RADIUS)) {
      b.vy = -b.vy;
      bounced = true;
    } else {
      b.y = ny;
    }
    if (bounced) {
      b.bounces++;
      if (b.bounces > GUMBALL_BOUNCES) {
        b.gone = true;
        this.events.push({ type: 'pop', x: b.x, y: b.y });
      } else {
        this.events.push({ type: 'bounce', x: b.x, y: b.y });
      }
    }
  }

  // ------------------------------------------------------------ candy canes

  updateCanes(pts, time) {
    for (const cane of this.canes) {
      const { pivot, tip } = caneShape(cane, time);
      if (pts.some(p => pointSegmentDist(p, pivot, tip) < CANE_THICK + END_RADIUS * 0.6)) {
        return 'candycane';
      }
    }
    return null;
  }

  // ------------------------------------------------------------- sour clouds

  findRainBottoms(cloud) {
    cloud.bottoms = [];
    for (let col = cloud.from; col <= cloud.to; col++) {
      cloud.bottoms.push(rainBottom(this.level, cloud.row, col));
    }
  }

  updateClouds(pts, time) {
    let hurt = null;
    for (const c of this.clouds) {
      const state = sourState(c, time);
      if (state !== c.state) {
        c.state = state;
        if (state === 'warn') {
          this.events.push({ type: 'rumble', x: c.x, y: c.y });
        } else if (state === 'rain') {
          // The rain falls until it hits something (melted ice cream doesn't count).
          this.findRainBottoms(c);
          this.events.push({ type: 'rain', x: c.x, y: c.y });
        }
      }
      if (state === 'rain' && pts.some(p => this.inRain(c, p))) {
        hurt = 'sour';
      }
    }
    return hurt;
  }

  /** Is point `p` out in the rain under a raining cloud? */
  inRain(cloud, p) {
    const pad = END_RADIUS * 0.6;
    const col = Math.floor(p.x / TILE);
    const left = cloud.from * TILE + 4 - pad;
    const right = (cloud.to + 1) * TILE - 4 + pad;
    if (p.x < left || p.x > right) {
      return false;
    }
    const k = Math.max(0, Math.min(cloud.to, col) - cloud.from);
    const top = (cloud.row + 1) * TILE - 4;
    return p.y > top && p.y < cloud.bottoms[k] + pad;
  }

  resetAfterDeath() {
    this.release();
    this.onRope = null;
    this.boost = 0;
    this.gumballs = [];
    this.wasLoose = [false, false];
    for (const m of this.machines) {
      m.state = 'wait';
      m.cooldown = 2;
    }
    for (const c of this.clouds) {
      c.state = 'calm';
    }
    for (const rope of this.ropes) {
      rope.armed = true;
    }
  }

  takeEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }
}
