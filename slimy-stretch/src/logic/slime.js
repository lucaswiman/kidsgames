import {
  CORNER_WRAP,
  END_RADIUS,
  FOLLOW_RATE,
  GRAVITY,
  MAX_FALL_SPEED,
  MAX_STRETCH,
  SNAP_SPEED,
  STICK_SEARCH,
  ZERO_G_DRIFT,
  ZERO_G_FLING,
  ZERO_G_MIN_STRETCH,
} from './constants.js';
import { gravityDir, inZeroG } from './level.js';
import {
  circleCaught,
  circleHitsSolid,
  clampToRange,
  dist,
  findStickSpot,
  isSupported,
  isTouchingSticky,
  platformLanding,
  solidLengthBetween,
} from './collision.js';

// How close to something solid a stuck end has to be to stay stuck.
const SUPPORT_MARGIN = 6;

// A spider web catches you once this much of an end's radius is in it.
const WEB_CATCH = 0.6;

/**
 * Can one end be at `p` while the other end is at `anchor`? It has to be
 * within reach, not inside a wall, and the body can only bend a little
 * around corners (it can't reach through a whole wall).
 */
export function canReach(level, anchor, p, reach = MAX_STRETCH) {
  return (
    dist(anchor, p) <= reach + 0.5 &&
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
    // How far one end can stretch from the other. Slime shots make it shorter.
    this.reach = MAX_STRETCH;
    // Wind pushes the end you're dragging this far sideways (set each frame).
    this.wind = { x: 0, y: 0 };
    this.fingerSamples = [];
    this.events = [];
    // Held still by sticky caramel: neither end can be grabbed (see candy.js).
    this.glued = false;
    this.spawn(spawnPoint);
  }

  /** Drop the slime in at a point. It falls until it lands on something. */
  spawn(point) {
    this.frozen = false;
    this.glued = false;
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
    if (this.isFalling || this.frozen || this.glued || this.heldIndex >= 0) {
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
   * otherwise boing it back. In a zero gravity zone there's nothing to boing
   * back against, so instead the whole slime floats off the way you were
   * stretching. Returns the finger velocity (for throwing).
   */
  release(level) {
    const end = this.heldEnd;
    if (!end) {
      return { x: 0, y: 0 };
    }
    const velocity = this.fingerVelocity();
    const anchor = this.anchor;
    const spot = findStickSpot(level, end, END_RADIUS, STICK_SEARCH, p =>
      canReach(level, anchor, p, this.reach)
    );
    if (spot) {
      end.x = spot.x;
      end.y = spot.y;
      end.state = 'stuck';
      this.events.push('stick');
    } else if (inZeroG(level, end) && dist(end, anchor) >= ZERO_G_MIN_STRETCH) {
      const d = dist(end, anchor);
      const vx = ((end.x - anchor.x) / d) * ZERO_G_FLING;
      const vy = ((end.y - anchor.y) / d) * ZERO_G_FLING;
      this.lead = this.heldIndex;
      this.launch(end.x, end.y, vx, vy);
      this.events.push('fling');
    } else {
      end.state = 'snapping';
      this.lead = 1 - this.heldIndex;
      this.events.push('snap');
    }
    this.heldIndex = -1;
    return velocity;
  }

  /**
   * Something the slime was stuck to just disappeared (crumbling rock, an
   * eaten box). Any stuck end left touching nothing solid lets go: it boings
   * back to the other end, or if both ends lost their grip the slime falls.
   */
  checkSupport(level) {
    if (this.isFalling) {
      return;
    }
    const supported = end =>
      end.state !== 'stuck' || isSupported(level, end, END_RADIUS, SUPPORT_MARGIN);
    const lost = this.ends.map(end => !supported(end));
    if (!lost[0] && !lost[1]) {
      return;
    }
    const held = this.heldIndex;
    if (held >= 0 ? lost[1 - held] : lost[0] && lost[1]) {
      // Nothing left holding on: fall.
      this.knockLoose(0, 0);
      return;
    }
    this.ends.forEach((end, i) => {
      if (lost[i]) {
        end.state = 'snapping';
        this.lead = 1 - i;
        this.events.push('snap');
      }
    });
  }

  /** Throw the whole slime loose (for example, the boss stomping nearby). */
  knockLoose(vx, vy) {
    const c = this.center;
    this.frozen = false;
    this.heldIndex = -1;
    this.falling = { x: c.x, y: c.y, vx, vy };
    for (const end of this.ends) {
      end.x = c.x;
      end.y = c.y;
      end.state = 'stuck';
    }
  }

  /**
   * Shoot the slime out of a cannon. While flying it sticks to the first
   * sticky thing it hits. `grip` is how close (in pixels) it has to be to a
   * sticky thing when it bumps into it; the jungle's flowers and vines use a
   * bit more so a fast flight always sticks.
   */
  launch(x, y, vx, vy, grip = 3) {
    this.frozen = false;
    this.heldIndex = -1;
    this.falling = { x, y, vx, vy, sticky: true, grip };
    for (const end of this.ends) {
      end.x = x;
      end.y = y;
      end.state = 'stuck';
    }
  }

  /** Hold the whole slime at one spot (inside a cannon, or in a claw). */
  holdAt(x, y) {
    this.frozen = true;
    this.falling = null;
    this.heldIndex = -1;
    for (const end of this.ends) {
      end.x = x;
      end.y = y;
      end.state = 'stuck';
    }
  }

  update(dt, level) {
    if (this.frozen) {
      return;
    }
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
        const pushed = {
          x: this.smoothFinger.x + this.wind.x,
          y: this.smoothFinger.y + this.wind.y,
        };
        const desired = clampToRange(other, pushed, this.reach);
        slideToward(level, end, other, desired, this.reach);
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
    // Which way is down (a gravity switch can flip it).
    const down = gravityDir(level);
    const floating = inZeroG(level, f);
    if (floating) {
      // No gravity: keep floating the same way. Floating very slowly, you
      // drift gently down so you can't get stuck in mid-air.
      if (Math.hypot(f.vx, f.vy) < ZERO_G_DRIFT) {
        f.vy = ZERO_G_DRIFT * down;
      }
    } else if (down > 0) {
      f.vy = Math.min(MAX_FALL_SPEED, f.vy + GRAVITY * dt);
    } else {
      f.vy = Math.max(-MAX_FALL_SPEED, f.vy - GRAVITY * dt);
    }
    // Move in small steps so fast falls can't tunnel through floors.
    const steps = Math.max(1, Math.ceil((Math.hypot(f.vx, f.vy) * dt) / 4));
    let landed = false;
    // Shot from a cannon (or floating in zero gravity): stick to the first
    // sticky thing we bump into.
    const stickHere = () =>
      (f.sticky || floating) && isTouchingSticky(level, f, END_RADIUS, f.grip);
    for (let i = 0; i < steps && !landed; i++) {
      const nx = f.x + (f.vx * dt) / steps;
      if (circleHitsSolid(level, { x: nx, y: f.y }, END_RADIUS)) {
        f.vx = 0;
        landed = stickHere();
      } else {
        f.x = nx;
      }
      if (landed) {
        break;
      }
      const ny = f.y + (f.vy * dt) / steps;
      // One-way platforms only catch you from above, even upside down.
      const platformY = f.vy > 0 ? platformLanding(level, f.x, f.y, ny, END_RADIUS) : null;
      if (platformY !== null) {
        f.y = platformY;
        landed = true;
      } else if (circleHitsSolid(level, { x: f.x, y: ny }, END_RADIUS)) {
        // Falling the way gravity pulls, you land on anything.
        if (f.vy * down > 0 || stickHere()) {
          landed = true;
        }
        f.vy = 0;
      } else {
        f.y = ny;
      }
      // Falling or flying into a spider web, you get caught in it.
      if (!landed && circleCaught(level, f, END_RADIUS * WEB_CATCH)) {
        landed = true;
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
function slideToward(level, end, anchor, target, reach, stepSize = 3) {
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
    const next = options.find(p => canReach(level, anchor, p, reach));
    if (!next) {
      return;
    }
    end.x = next.x;
    end.y = next.y;
  }
}
