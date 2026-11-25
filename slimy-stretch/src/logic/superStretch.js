import { END_RADIUS, TILE } from './constants.js';
import { castCircle, dist, isTouchingSticky, segmentTouchesDeadly } from './collision.js';

// Super Stretch: the reward for beating King Claw. Tap the 🎯 button, then
// tap a wall or ceiling the slime can see in a straight line (nothing solid
// in the way). The slime's head stretches super far to it, sticks there, and
// then its tail snaps over too. Then it needs 20 seconds to rest.

export const SUPER_RANGE = 14 * TILE; // how far a super stretch can go
export const SUPER_COOLDOWN = 20;
export const SUPER_SPEED = 2400; // how fast the stretch zooms out (and the tail snaps over)
const TAP_SLOP = TILE * 0.75; // the tap can be this far off the spot the stretch reaches

/**
 * Where a super stretch from `from` toward the tapped point `tap` would
 * stick, or null if it can't: too far, something solid in the way, the wall
 * there isn't sticky, or the stretch would go through something deadly.
 */
export function superStretchTarget(level, from, tap) {
  const d = dist(from, tap);
  if (d < END_RADIUS || d > SUPER_RANGE + TAP_SLOP) {
    return null;
  }
  // Aim a little past the tap, so tapping right on a wall reaches its face.
  const reach = Math.min(SUPER_RANGE, d + END_RADIUS + 4);
  const aim = {
    x: from.x + ((tap.x - from.x) / d) * reach,
    y: from.y + ((tap.y - from.y) / d) * reach,
  };
  const tip = castCircle(level, from, aim, END_RADIUS, 3);
  // Stopped short of where you tapped: something is in the way.
  if (dist(tip, tap) > TAP_SLOP + END_RADIUS || dist(tip, from) < END_RADIUS) {
    return null;
  }
  if (!isTouchingSticky(level, tip, END_RADIUS, 4)) {
    return null;
  }
  if (segmentTouchesDeadly(level, from, tip, END_RADIUS * 0.6, 8)) {
    return null;
  }
  return { x: tip.x, y: tip.y };
}

export class SuperStretch {
  constructor() {
    this.state = 'idle'; // 'idle', 'out' (head zooming over) or 'pull' (tail snapping over)
    this.cooldown = 0;
    this.target = null;
    this.events = [];
  }

  get active() {
    return this.state !== 'idle';
  }

  get ready() {
    return this.cooldown <= 0 && this.state === 'idle';
  }

  /**
   * Try a super stretch toward the tapped point `tap`. Returns true if it
   * started; false (and no cooldown) if that's not a spot it can reach.
   */
  start(level, slime, tap) {
    if (!this.ready || slime.isFalling || slime.frozen || slime.glued || slime.heldEnd) {
      return false;
    }
    const head = slime.ends[slime.lead];
    const spot = superStretchTarget(level, head, tap);
    if (!spot) {
      return false;
    }
    this.target = spot;
    this.state = 'out';
    // The slime is carried along by the stretch (nothing else can move it).
    slime.frozen = true;
    this.events.push('stretch');
    return true;
  }

  /** Animate the stretch. The head zooms out, then the tail snaps over to it. */
  update(dt, level, slime) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.state === 'idle') {
      return;
    }
    if (!slime.frozen) {
      // Something else moved the slime (like getting hurt): the stretch is off.
      this.cancel();
      return;
    }
    const step = SUPER_SPEED * dt;
    const moving = this.state === 'out' ? slime.ends[slime.lead] : slime.ends[1 - slime.lead];
    if (moveToward(moving, this.target, step)) {
      if (this.state === 'out') {
        this.state = 'pull';
        this.events.push('stick');
      } else {
        // Both ends are stuck there now.
        for (const end of slime.ends) {
          end.state = 'stuck';
        }
        slime.frozen = false;
        this.state = 'idle';
        this.cooldown = SUPER_COOLDOWN;
        this.events.push('done');
      }
    }
  }

  /** Stop a stretch partway (the cooldown doesn't start). */
  cancel() {
    this.state = 'idle';
    this.target = null;
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
