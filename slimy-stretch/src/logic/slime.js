import {
  CORNER_WRAP,
  END_RADIUS,
  FOLLOW_RATE,
  GRAVITY,
  MAX_FALL_SPEED,
  MAX_STRETCH,
  SNAP_SPEED,
  STICK_SEARCH,
} from './constants.js';
import {
  circleHitsSolid,
  clampToRange,
  dist,
  findStickSpot,
  solidLengthBetween,
} from './collision.js';

/**
 * Can one end be at `p` while the other end is at `anchor`? It has to be
 * within reach, not inside a wall, and the body can only bend a little
 * around corners (it can't reach through a whole wall).
 */
export function canReach(level, anchor, p) {
  return (
    dist(anchor, p) <= MAX_STRETCH + 0.5 &&
    !circleHitsSolid(level, p, END_RADIUS) &&
    solidLengthBetween(level, anchor, p) <= CORNER_WRAP
  );
}

/**
 * The slime is two gooey ends joined by a stretchy body. It can't jump.
 * Instead you grab one end and drag it; it stretches toward your finger (up
 * to MAX_STRETCH from the other end). Let go next to a sticky wall and it
 * sticks there; let go in the air or on ice and it boings back.
 *
 * Each end is in one of these states:
 *   'stuck'    - attached to something, not moving
 *   'held'     - following the player's finger
 *   'snapping' - boinging back to the other end after a missed grab
 *
 * When the whole slime is knocked loose it is 'falling' until it lands.
 */
export class Slime {
  constructor(spawnPoint) {
    this.ends = [
      { x: 0, y: 0, state: 'stuck' },
      { x: 0, y: 0, state: 'stuck' },
    ];
    this.heldIndex = -1;
    // Which end the eyes are on: the one you're dragging, or the last one moved.
    this.lead = 0;
    this.finger = { x: 0, y: 0 };
    this.smoothFinger = { x: 0, y: 0 };
    this.fingerSamples = [];
    this.events = [];
    this.spawn(spawnPoint);
  }

  /** Drop the slime in at a point. It falls until it lands on something. */
  spawn(point) {
    this.falling = { x: point.x, y: point.y, vx: 0, vy: 0 };
    this.heldIndex = -1;
    for (const end of this.ends) {
      end.x = point.x;
      end.y = point.y;
      end.state = 'stuck';
    }
  }

  get isFalling() {
    return this.falling !== null;
  }

  get center() {
    return {
      x: (this.ends[0].x + this.ends[1].x) / 2,
      y: (this.ends[0].y + this.ends[1].y) / 2,
    };
  }

  get stretch() {
    return dist(this.ends[0], this.ends[1]);
  }

  get heldEnd() {
    return this.heldIndex >= 0 ? this.ends[this.heldIndex] : null;
  }

  /** The end that stays put while the other one is being dragged. */
  get anchor() {
    return this.heldIndex >= 0 ? this.ends[1 - this.heldIndex] : null;
  }

  /** Finger went down. Grab whichever end is closest to it. */
  grab(point, time = 0) {
    if (this.isFalling || this.heldIndex >= 0) {
      return false;
    }
    // Grabbing again while a missed stretch is still boinging back finishes the boing.
    this.ends.forEach((end, i) => {
      if (end.state === 'snapping') {
        end.x = this.ends[1 - i].x;
        end.y = this.ends[1 - i].y;
        end.state = 'stuck';
      }
    });
    const choices = [0, 1].filter(i => this.ends[i].state === 'stuck');
    if (choices.length === 0) {
      return false;
    }
    choices.sort((a, b) => dist(this.ends[a], point) - dist(this.ends[b], point));
    const index = choices[0];
    // The other end must be stuck for us to stretch away from it.
    if (this.ends[1 - index].state !== 'stuck') {
      return false;
    }
    this.heldIndex = index;
    this.lead = index;
    this.ends[index].state = 'held';
    this.finger = { x: point.x, y: point.y };
    this.smoothFinger = { x: this.ends[index].x, y: this.ends[index].y };
    this.fingerSamples = [{ t: time, x: point.x, y: point.y }];
    this.events.push('grab');
    return true;
  }

  moveFinger(point, time = 0) {
    this.finger = { x: point.x, y: point.y };
    this.fingerSamples.push({ t: time, x: point.x, y: point.y });
    // Only remember the last fraction of a second, for flick detection.
    while (this.fingerSamples.length > 2 && time - this.fingerSamples[0].t > 0.12) {
      this.fingerSamples.shift();
    }
  }

  /** How fast the finger was moving just now, in pixels per second. */
  fingerVelocity() {
    const s = this.fingerSamples;
    if (s.length < 2) {
      return { x: 0, y: 0 };
    }
    const first = s[0];
    const last = s[s.length - 1];
    const dt = last.t - first.t;
    if (dt <= 0) {
      return { x: 0, y: 0 };
    }
    return { x: (last.x - first.x) / dt, y: (last.y - first.y) / dt };
  }

  /**
   * Finger lifted. Stick the held end to a nearby wall if there is one,
   * otherwise boing it back. Returns the finger velocity (for throwing).
   */
  release(level) {
    const end = this.heldEnd;
    if (!end) {
      return { x: 0, y: 0 };
    }
    const velocity = this.fingerVelocity();
    const anchor = this.anchor;
    const spot = findStickSpot(level, end, END_RADIUS, STICK_SEARCH, p =>
      canReach(level, anchor, p)
    );
    if (spot) {
      end.x = spot.x;
      end.y = spot.y;
      end.state = 'stuck';
      this.events.push('stick');
    } else {
      end.state = 'snapping';
      this.lead = 1 - this.heldIndex;
      this.events.push('snap');
    }
    this.heldIndex = -1;
    return velocity;
  }

  /** Throw the whole slime loose (for example, the boss stomping nearby). */
  knockLoose(vx, vy) {
    const c = this.center;
    this.heldIndex = -1;
    this.falling = { x: c.x, y: c.y, vx, vy };
    for (const end of this.ends) {
      end.x = c.x;
      end.y = c.y;
      end.state = 'stuck';
    }
  }

  update(dt, level) {
    if (this.isFalling) {
      this.updateFalling(dt, level);
      return;
    }
    this.ends.forEach((end, i) => {
      const other = this.ends[1 - i];
      if (end.state === 'held') {
        // Smooth the finger so the stretch looks gooey, then slide the end
        // toward it, staying in reach and out of walls.
        const k = 1 - Math.exp(-FOLLOW_RATE * dt);
        this.smoothFinger.x += (this.finger.x - this.smoothFinger.x) * k;
        this.smoothFinger.y += (this.finger.y - this.smoothFinger.y) * k;
        const desired = clampToRange(other, this.smoothFinger, MAX_STRETCH);
        slideToward(level, end, other, desired);
      } else if (end.state === 'snapping') {
        const d = dist(end, other);
        const move = SNAP_SPEED * dt;
        if (d <= move) {
          end.x = other.x;
          end.y = other.y;
          end.state = 'stuck';
        } else {
          end.x += ((other.x - end.x) / d) * move;
          end.y += ((other.y - end.y) / d) * move;
        }
      }
    });
  }

  updateFalling(dt, level) {
    const f = this.falling;
    f.vy = Math.min(MAX_FALL_SPEED, f.vy + GRAVITY * dt);
    // Move in small steps so fast falls can't tunnel through floors.
    const steps = Math.max(1, Math.ceil((Math.hypot(f.vx, f.vy) * dt) / 4));
    let landed = false;
    for (let i = 0; i < steps && !landed; i++) {
      const nx = f.x + (f.vx * dt) / steps;
      if (circleHitsSolid(level, { x: nx, y: f.y }, END_RADIUS)) {
        f.vx = 0;
      } else {
        f.x = nx;
      }
      const ny = f.y + (f.vy * dt) / steps;
      if (circleHitsSolid(level, { x: f.x, y: ny }, END_RADIUS)) {
        if (f.vy > 0) {
          landed = true;
        }
        f.vy = 0;
      } else {
        f.y = ny;
      }
    }
    for (const end of this.ends) {
      end.x = f.x;
      end.y = f.y;
    }
    if (landed) {
      this.falling = null;
      this.events.push('land');
    }
  }

  /** Points along the slime, used for hazard and pickup checks. */
  bodyPoints(spacing = 10) {
    const [a, b] = this.ends;
    const n = Math.max(1, Math.ceil(dist(a, b) / spacing));
    const pts = [];
    for (let i = 0; i <= n; i++) {
      pts.push({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n });
    }
    return pts;
  }

  takeEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }
}

/**
 * Move `end` toward `target` in small steps. When a wall is in the way, slide
 * along it (try just the x part, then just the y part) instead of stopping.
 */
function slideToward(level, end, anchor, target, stepSize = 3) {
  const steps = Math.min(200, Math.ceil(dist(end, target) / stepSize));
  for (let i = 0; i < steps; i++) {
    const remaining = steps - i;
    const vx = (target.x - end.x) / remaining;
    const vy = (target.y - end.y) / remaining;
    const options = [
      { x: end.x + vx, y: end.y + vy },
      { x: end.x + vx, y: end.y },
      { x: end.x, y: end.y + vy },
    ];
    const next = options.find(p => canReach(level, anchor, p));
    if (!next) {
      return;
    }
    end.x = next.x;
    end.y = next.y;
  }
}
