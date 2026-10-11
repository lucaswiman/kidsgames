import { END_RADIUS, GRAVITY, MAX_FALL_SPEED, MAX_STRETCH } from './constants.js';
import { circleHitsDeadly, circleHitsSolid, dist, isTouchingSticky } from './collision.js';

// Slime shot: a reward for beating the crystal robot. The slime fires a blob
// of itself. Each blob out in the world makes the slime smaller and cuts its
// reach by 25%. Blobs stick to the first sticky thing they hit (or fall until
// they do). A blob that lands in water or lava, or falls out of the level,
// comes right back. Touch a blob to soak it back up.

export const MAX_BLOBS = 3;
export const BLOB_RADIUS = 8;
export const BLOB_SPEED = 800;
const REACH_PER_BLOB = 0.25;
const ABSORB_DELAY = 0.4; // seconds before a new blob can be soaked back up

export class SlimeShots {
  constructor() {
    this.blobs = [];
    this.events = [];
  }

  get count() {
    return this.blobs.length;
  }

  /** How far the slime can stretch with this many blobs out. */
  reach() {
    return MAX_STRETCH * (1 - REACH_PER_BLOB * this.blobs.length);
  }

  /** How big the slime looks (1 = full size). */
  size() {
    return 1 - 0.18 * this.blobs.length;
  }

  /** Fire a blob from `from` toward `toward`. Returns false if 3 are already out. */
  fire(from, toward) {
    if (this.blobs.length >= MAX_BLOBS) {
      return false;
    }
    const d = dist(from, toward) || 1;
    this.blobs.push({
      x: from.x,
      y: from.y,
      vx: ((toward.x - from.x) / d) * BLOB_SPEED,
      vy: ((toward.y - from.y) / d) * BLOB_SPEED,
      state: 'flying',
      age: 0,
    });
    this.events.push('shoot');
    return true;
  }

  /**
   * Move the blobs. `onHit(blob)` is called while a blob is flying, so the
   * game can let it knock down stalactites.
   */
  update(dt, level, slime, onHit = () => {}) {
    for (const b of this.blobs) {
      b.age += dt;
      if (b.state === 'flying' || b.state === 'falling') {
        this.moveBlob(b, dt, level);
        if (b.state === 'flying') {
          onHit(b);
        }
      }
      if (circleHitsDeadly(level, b, BLOB_RADIUS) || b.y > level.pixelHeight) {
        // Lost in water, lava or off the screen: it comes right back.
        b.gone = true;
        this.events.push('return');
        continue;
      }
      const touching = slime.ends.some(e => dist(e, b) < END_RADIUS + BLOB_RADIUS + 4);
      if (b.state === 'stuck' && b.age > ABSORB_DELAY && touching && !slime.frozen) {
        b.gone = true;
        this.events.push('absorb');
      }
    }
    this.blobs = this.blobs.filter(b => !b.gone);
  }

  moveBlob(b, dt, level) {
    b.vy = Math.min(MAX_FALL_SPEED, b.vy + GRAVITY * dt);
    const steps = Math.max(1, Math.ceil((Math.hypot(b.vx, b.vy) * dt) / 3));
    for (let i = 0; i < steps; i++) {
      const nx = b.x + (b.vx * dt) / steps;
      const ny = b.y + (b.vy * dt) / steps;
      if (circleHitsSolid(level, { x: nx, y: ny }, BLOB_RADIUS)) {
        if (isTouchingSticky(level, { x: nx, y: ny }, BLOB_RADIUS, 2)) {
          b.state = 'stuck';
          this.events.push('splat');
          return;
        }
        // Not sticky (ice): stop sideways and slide down until something sticky.
        b.vx = 0;
        b.state = 'falling';
        if (circleHitsSolid(level, { x: b.x, y: ny }, BLOB_RADIUS)) {
          // Resting on top of something slippery: just sit there.
          b.vy = 0;
          b.state = 'stuck';
          return;
        }
        b.y = ny;
      } else {
        b.x = nx;
        b.y = ny;
      }
    }
  }

  /** Everything comes back (for example when the level restarts). */
  reset() {
    this.blobs = [];
  }

  takeEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }
}
