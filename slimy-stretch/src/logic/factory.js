import { END_RADIUS, TILE } from './constants.js';
import { circleHitsDeadly, dist } from './collision.js';
import { isSolidKind, outOfWorld, TileKind, tileAt } from './level.js';
import { Slime } from './slime.js';

// Things in the Factory: stamping presses, saw blades that roll along floors
// and walls, steam vents that blast you into the air, and slime machines (shoot
// a blob of slime into one to make a platform move).

const PRESS_UP = 2;
const PRESS_WARN = 0.6;
const PRESS_HOLD = 0.5;
const PRESS_SLAM_SPEED = 1000;
const PRESS_RISE_SPEED = 240;
export const PRESS_HEAD = 26; // how tall the stamping head is

export const SAW_RADIUS = 20;
const SAW_SPEED = 90;

export const VENT_SPEED = 950;
const VENT_REACH = 3 * TILE; // how far above a vent the steam reaches
const VENT_ON = 1.2;
const VENT_WARN = 0.6;
const VENT_EVERY = 3.6;

const PLATFORM_SPEED = 120;

/** Is the steam vent blasting at `time`? 'on', 'warn' or 'off'. */
export function ventState(vent, time) {
  const t = (((time + (vent.offset || 0)) % VENT_EVERY) + VENT_EVERY) % VENT_EVERY;
  if (t < VENT_ON) {
    return 'on';
  }
  return t > VENT_EVERY - VENT_WARN ? 'warn' : 'off';
}

/**
 * Blast up from a steam vent at `from` and see where the slime sticks, using
 * the real game physics (the level checker uses this).
 */
export function simulateVent(level, from) {
  const slime = new Slime(from);
  slime.launch(from.x, from.y - 2, 0, -VENT_SPEED);
  const dt = 1 / 60;
  for (let t = 0; t < 4; t += dt) {
    slime.update(dt, level);
    const p = slime.ends[0];
    if (circleHitsDeadly(level, p, END_RADIUS * 0.6) || outOfWorld(level, p)) {
      return null;
    }
    if (!slime.isFalling) {
      return { x: p.x, y: p.y };
    }
  }
  return null;
}

/** Where a press's head can slam down to: the top of the first solid tile below. */
function pressFloor(level, col, row) {
  for (let r = row + 1; r < level.height; r++) {
    if (isSolidKind(tileAt(level, col, r))) {
      return r * TILE;
    }
  }
  return level.pixelHeight;
}

export class FactoryStuff {
  constructor(level) {
    this.level = level;
    this.presses = level.presses.map((p, i) => ({
      ...p,
      top: (p.row + 1) * TILE,
      floor: pressFloor(level, p.col, p.row),
      y: (p.row + 1) * TILE, // bottom of the head
      state: 'up',
      timer: PRESS_UP * 0.5 + i * 0.7,
    }));
    this.saws = level.saws.map(s => this.startSaw(s));
    this.vents = level.vents.map((v, i) => ({ ...v, offset: i * 1.1 }));
    this.slimeMachines = (level.def.slimeMachines || []).map(m => this.buildMachine(m));
    this.time = 0;
    this.events = [];
  }

  /** A saw rolls along the floor under it, or up and down the wall next to it. */
  startSaw(s) {
    const solid = (dc, dr) => isSolidKind(tileAt(this.level, s.col + dc, s.row + dr));
    let axis = 'x';
    if (!solid(0, 1) && !solid(0, -1) && (solid(-1, 0) || solid(1, 0))) {
      axis = 'y';
    }
    return { ...s, axis, dir: 1, spin: 0 };
  }

  buildMachine(m) {
    const [col, row] = m.at;
    const shotDir = m.shot === 'left' ? -1 : 1;
    const [fc, fr] = m.platform.from;
    const [tc, tr] = m.platform.to;
    const width = m.platform.width || 2;
    return {
      col,
      row,
      x: (col + 0.5) * TILE,
      y: (row + 0.5) * TILE,
      // Shots go in on one side; the slime climbs in on the other.
      shotFace: { x: (col + 0.5 + shotDir * 0.5) * TILE, y: (row + 0.5) * TILE },
      openFace: { x: (col + 0.5 - shotDir * 0.5) * TILE, y: (row + 0.5) * TILE },
      powered: false,
      blob: null,
      platform: {
        width,
        from: { col: fc, row: fr },
        to: { col: tc, row: tr },
        x: fc * TILE,
        y: fr * TILE,
        at: 'from',
      },
    };
  }

  /**
   * Advance everything. Returns 'press' or 'saw' if the slime got hurt,
   * otherwise null.
   */
  update(dt, slime, blobs = []) {
    this.time += dt;
    const pts = slime.bodyPoints(8);
    const hurt = this.updatePresses(dt, pts, slime) || this.updateSaws(dt, pts, slime);
    this.updateVents(slime);
    this.updateMachines(dt, slime, blobs);
    return hurt;
  }

  updatePresses(dt, pts, slime) {
    let hurt = null;
    for (const p of this.presses) {
      if (p.state === 'up') {
        p.timer -= dt;
        if (p.timer <= 0) {
          p.state = 'warn';
          p.timer = PRESS_WARN;
        }
      } else if (p.state === 'warn') {
        p.timer -= dt;
        if (p.timer <= 0) {
          p.state = 'slam';
        }
      } else if (p.state === 'slam') {
        p.y = Math.min(p.floor, p.y + PRESS_SLAM_SPEED * dt);
        if (p.y >= p.floor) {
          p.state = 'hold';
          p.timer = PRESS_HOLD;
          this.events.push({ type: 'stomp', x: (p.col + 0.5) * TILE, y: p.floor });
        }
      } else if (p.state === 'hold') {
        p.timer -= dt;
        if (p.timer <= 0) {
          p.state = 'rise';
        }
      } else if (p.state === 'rise') {
        p.y = Math.max(p.top, p.y - PRESS_RISE_SPEED * dt);
        if (p.y <= p.top) {
          p.state = 'up';
          p.timer = PRESS_UP;
        }
      }
      if ((p.state === 'slam' || p.state === 'hold') && !slime.frozen) {
        const left = p.col * TILE;
        const squished = pts.some(
          q =>
            q.x > left - END_RADIUS * 0.4 &&
            q.x < left + TILE + END_RADIUS * 0.4 &&
            q.y > p.top - END_RADIUS &&
            q.y < p.y + END_RADIUS * 0.6
        );
        if (squished) {
          hurt = 'press';
        }
      }
    }
    return hurt;
  }

  /** The bottom of a press's stamping head right now (for drawing). */
  pressHead(p) {
    return { left: p.col * TILE + 2, right: (p.col + 1) * TILE - 2, bottom: p.y };
  }

  updateSaws(dt, pts, slime) {
    let hurt = null;
    for (const s of this.saws) {
      s.spin += dt * 12 * s.dir;
      const step = s.dir * SAW_SPEED * dt;
      const nx = s.axis === 'x' ? s.x + step : s.x;
      const ny = s.axis === 'y' ? s.y + step : s.y;
      const lead =
        s.axis === 'x'
          ? { x: nx + s.dir * SAW_RADIUS, y: ny }
          : { x: nx, y: ny + s.dir * SAW_RADIUS };
      const col = Math.floor(lead.x / TILE);
      const row = Math.floor(lead.y / TILE);
      const blocked = isSolidKind(tileAt(this.level, col, row));
      // It has to keep rolling on its floor or wall: turn around at the end.
      const surface =
        s.axis === 'x'
          ? isSolidKind(tileAt(this.level, col, s.row + 1)) ||
            isSolidKind(tileAt(this.level, col, s.row - 1))
          : isSolidKind(tileAt(this.level, s.col - 1, row)) ||
            isSolidKind(tileAt(this.level, s.col + 1, row));
      if (blocked || !surface) {
        s.dir = -s.dir;
      } else {
        s.x = nx;
        s.y = ny;
      }
      if (!slime.frozen && pts.some(p => dist(p, s) < SAW_RADIUS + END_RADIUS * 0.6)) {
        hurt = 'saw';
      }
    }
    return hurt;
  }

  updateVents(slime) {
    if (slime.isFalling || slime.frozen) {
      return;
    }
    for (const v of this.vents) {
      if (ventState(v, this.time) !== 'on') {
        continue;
      }
      const top = v.row * TILE;
      const end = slime.ends.find(
        e =>
          Math.abs(e.x - v.x) < TILE / 2 + END_RADIUS * 0.5 && e.y < top && e.y > top - VENT_REACH
      );
      if (end) {
        // WHOOSH! Up you go, sticking to the first sticky thing you hit.
        slime.launch(v.x, Math.min(end.y, top - END_RADIUS - 2), 0, -VENT_SPEED);
        this.events.push({ type: 'steam', x: v.x, y: top });
        return;
      }
    }
  }

  updateMachines(dt, slime, blobs) {
    for (const m of this.slimeMachines) {
      if (!m.powered) {
        // A blob of slime that flies (or slides) into the shot side powers it up.
        const blob = blobs.find(
          b => (b.state === 'flying' || b.state === 'falling') && dist(b, m.shotFace) < TILE * 0.6
        );
        if (blob) {
          blob.inMachine = true;
          blob.state = 'inMachine';
          blob.x = m.x;
          blob.y = m.y;
          m.powered = true;
          m.blob = blob;
          this.events.push({ type: 'power', x: m.x, y: m.y });
        }
      } else if (m.blob && !slime.frozen) {
        // Climb in the open side to get your blob back.
        if (slime.ends.some(e => dist(e, m.openFace) < END_RADIUS + 12)) {
          m.blob.gone = true;
          m.blob = null;
          m.powered = false;
          this.events.push({ type: 'unpower', x: m.x, y: m.y });
        }
      }
      this.movePlatform(dt, m, slime);
    }
  }

  /** A powered machine slides its platform over to its other spot (and it stays there). */
  movePlatform(dt, m, slime) {
    const p = m.platform;
    if (!m.powered || p.at === 'to') {
      return;
    }
    if (p.at === 'from') {
      this.setPlatformTiles(p, p.from, TileKind.EMPTY);
      p.at = 'moving';
      this.events.push({ type: 'platform' });
    }
    const tx = p.to.col * TILE;
    const ty = p.to.row * TILE;
    const d = Math.hypot(tx - p.x, ty - p.y);
    const step = PLATFORM_SPEED * dt;
    const before = { x: p.x, y: p.y };
    if (d <= step) {
      p.x = tx;
      p.y = ty;
      p.at = 'to';
      this.setPlatformTiles(p, p.to, TileKind.LIFT);
    } else {
      p.x += ((tx - p.x) / d) * step;
      p.y += ((ty - p.y) / d) * step;
    }
    // Anything stuck on top of the platform rides along.
    for (const e of slime.ends) {
      const onTop =
        e.state === 'stuck' &&
        e.x > before.x - 4 &&
        e.x < before.x + p.width * TILE + 4 &&
        Math.abs(e.y + END_RADIUS - before.y) < 8;
      if (onTop) {
        e.x += p.x - before.x;
        e.y += p.y - before.y;
      }
    }
  }

  setPlatformTiles(p, at, kind) {
    for (let i = 0; i < p.width; i++) {
      this.level.tiles[at.row][at.col + i] = kind;
    }
  }

  resetAfterDeath() {
    // Your blobs come back when you respawn, so the machines switch off. A
    // platform that already moved stays where it is.
    for (const m of this.slimeMachines) {
      m.blob = null;
      m.powered = false;
    }
  }

  takeEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }
}
