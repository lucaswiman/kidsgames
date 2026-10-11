import { END_RADIUS, MAX_STRETCH, TILE } from './constants.js';
import { circleHitsDeadly, circleHitsSolid, circleTouches, dist } from './collision.js';
import { TileKind } from './level.js';
import { Slime } from './slime.js';

// Things that first show up in the Warehouse: conveyor belts, slime cannons
// and crane claws. (Bomb boxes and one-way platforms live with the other
// box and tile code.)

export const BELT_SPEED = 80;
export const CANNON_SPEED = 1050;
export const CANNON_ENTER = END_RADIUS + 22; // how close an end has to get to climb in
export const CLAW_RADIUS = 24;
export const CLAW_DROP_SPEED = 220;
export const CLAW_HANG = 46; // how far below its track the claw hangs
export const TONGUE_SORE_TIME = 10; // seconds without a tongue after a bomb box

/**
 * Fly the slime out of a cannon at `angle` and see where it ends up, using the
 * real game physics. Returns { x, y, path } where it stuck, or null if it
 * would land in something deadly or fall out of the level.
 */
export function simulateShot(level, from, angle, maxTime = 4) {
  const slime = new Slime(from);
  slime.launch(
    from.x + Math.cos(angle) * 30,
    from.y + Math.sin(angle) * 30,
    Math.cos(angle) * CANNON_SPEED,
    Math.sin(angle) * CANNON_SPEED
  );
  const path = [];
  const dt = 1 / 60;
  for (let t = 0; t < maxTime; t += dt) {
    slime.update(dt, level);
    const p = slime.ends[0];
    path.push({ x: p.x, y: p.y });
    if (circleHitsDeadly(level, p, END_RADIUS * 0.6) || p.y > level.pixelHeight) {
      return null;
    }
    if (!slime.isFalling) {
      return { x: p.x, y: p.y, path };
    }
  }
  return null;
}

/** Where the slime ends up if it's dropped at `from` (for example, by a claw). */
export function simulateDrop(level, from, maxTime = 4) {
  const slime = new Slime(from);
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

/** Which way a belt touching this end is moving (1 right, -1 left, 0 no belt). */
function beltDirAt(level, end) {
  // Keep pushing until the end is all the way off the belt, so a belt can
  // carry you right off its edge.
  if (circleTouches(level, end, END_RADIUS + 8, k => k === TileKind.BELT_RIGHT)) {
    return 1;
  }
  if (circleTouches(level, end, END_RADIUS + 8, k => k === TileKind.BELT_LEFT)) {
    return -1;
  }
  return 0;
}

export class WarehouseStuff {
  constructor(level) {
    this.level = level;
    this.cannons = level.cannons.map(c => ({ ...c, angle: -Math.PI / 4, cooldown: 0 }));
    this.claws = (level.def.claws || []).map(c => ({
      ...c,
      x: (c.from + 0.5) * TILE,
      y: (c.row + 1) * TILE + CLAW_HANG,
      dir: 1,
      speed: c.speed || 90,
      state: 'patrol',
      cooldown: 0,
    }));
    this.inCannon = null; // index of the cannon the slime is sitting in
    this.inClaw = null; // index of the claw carrying the slime
    this.events = [];
  }

  update(dt, slime) {
    if (!slime.isFalling && !slime.frozen) {
      this.moveBelts(dt, slime);
    }
    this.updateCannons(dt, slime);
    this.updateClaws(dt, slime);
  }

  moveBelts(dt, slime) {
    const moves = slime.ends.map(end =>
      end.state === 'stuck' ? beltDirAt(this.level, end) * BELT_SPEED * dt : 0
    );
    if (!moves[0] && !moves[1]) {
      return;
    }
    const next = slime.ends.map((end, i) => ({ x: end.x + moves[i], y: end.y }));
    // Belts can't stretch you past your reach or push you into a wall.
    if (dist(next[0], next[1]) > MAX_STRETCH) {
      return;
    }
    slime.ends.forEach((end, i) => {
      if (moves[i] && !circleHitsSolid(this.level, next[i], END_RADIUS)) {
        end.x = next[i].x;
      }
    });
    // Carried off the end of a belt? Then let go.
    slime.checkSupport(this.level);
  }

  updateCannons(dt, slime) {
    for (const c of this.cannons) {
      c.cooldown = Math.max(0, c.cooldown - dt);
    }
    if (this.inCannon !== null || slime.frozen || slime.isFalling) {
      return;
    }
    const i = this.cannons.findIndex(
      c => c.cooldown <= 0 && slime.ends.some(e => dist(e, c) < CANNON_ENTER)
    );
    if (i >= 0) {
      const c = this.cannons[i];
      slime.holdAt(c.x, c.y);
      this.inCannon = i;
      this.events.push('enterCannon');
    }
  }

  /** Point the cannon the slime is in toward `p`. */
  aim(p) {
    const c = this.cannons[this.inCannon];
    if (c && dist(p, c) > 8) {
      c.angle = Math.atan2(p.y - c.y, p.x - c.x);
    }
  }

  fire(slime) {
    const c = this.cannons[this.inCannon];
    if (!c) {
      return;
    }
    const cos = Math.cos(c.angle);
    const sin = Math.sin(c.angle);
    slime.launch(c.x + cos * 30, c.y + sin * 30, cos * CANNON_SPEED, sin * CANNON_SPEED);
    c.cooldown = 0.6;
    this.inCannon = null;
    this.events.push('fire');
  }

  updateClaws(dt, slime) {
    this.claws.forEach((claw, i) => {
      claw.cooldown = Math.max(0, claw.cooldown - dt);
      if (claw.state === 'patrol') {
        const left = (claw.from + 0.5) * TILE;
        const right = (claw.to + 0.5) * TILE;
        claw.x += claw.dir * claw.speed * dt;
        if (claw.x >= right) {
          claw.x = right;
          claw.dir = -1;
        } else if (claw.x <= left) {
          claw.x = left;
          claw.dir = 1;
        }
        const free = this.inClaw === null && this.inCannon === null && !slime.frozen;
        const touching = slime
          .bodyPoints(10)
          .some(p => dist(p, claw) < CLAW_RADIUS + END_RADIUS * 0.6);
        if (free && claw.cooldown <= 0 && touching) {
          claw.state = 'carry';
          this.inClaw = i;
          slime.holdAt(claw.x, claw.y + 12);
          this.events.push('clawGrab');
        }
      } else if (claw.state === 'carry') {
        const target = (claw.drop + 0.5) * TILE;
        const dx = target - claw.x;
        claw.x += Math.sign(dx) * Math.min(Math.abs(dx), CLAW_DROP_SPEED * dt);
        slime.holdAt(claw.x, claw.y + 12);
        if (Math.abs(target - claw.x) < 1) {
          claw.state = 'patrol';
          claw.cooldown = 2;
          this.inClaw = null;
          slime.knockLoose(0, 0);
          this.events.push('clawDrop');
        }
      }
    });
  }

  resetAfterDeath() {
    this.inCannon = null;
    this.inClaw = null;
    for (const claw of this.claws) {
      claw.state = 'patrol';
      claw.cooldown = 1;
    }
  }

  takeEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }
}
