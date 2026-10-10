import { MAX_STRETCH, TILE } from './constants.js';
import { castCircle, clampToRange, dist } from './collision.js';

export const TONGUE_RADIUS = 8;
const TONGUE_FOLLOW = 28;
const RETRACT_SPEED = 1800;

/**
 * The slime's tongue (unlocked by beating the robot). It shoots out of the
 * slime's head toward your finger, with the same reach as a stretch. Touch a
 * metal box with it and it snaps back and the slime eats the box.
 *
 * States: 'idle' (hidden), 'out' (following your finger), 'back' (snapping
 * back to the head, maybe carrying a box).
 */
export class Tongue {
  constructor() {
    this.state = 'idle';
    this.tip = { x: 0, y: 0 };
    this.finger = { x: 0, y: 0 };
    this.carrying = null; // index of the box being eaten
    this.events = [];
  }

  get active() {
    return this.state !== 'idle';
  }

  start(head, finger) {
    this.state = 'out';
    this.tip = { x: head.x, y: head.y };
    this.finger = { x: finger.x, y: finger.y };
    this.carrying = null;
    this.events.push('tongue');
  }

  moveFinger(finger) {
    this.finger = { x: finger.x, y: finger.y };
  }

  release() {
    if (this.state === 'out') {
      this.state = 'back';
    }
  }

  /**
   * Move the tongue. `boxes` is the list of boxes (with col, row, eaten).
   * Returns the index of a box once it has been pulled into the mouth.
   */
  update(dt, level, head, boxes) {
    if (this.state === 'out') {
      const k = 1 - Math.exp(-TONGUE_FOLLOW * dt);
      const want = clampToRange(head, this.finger, MAX_STRETCH);
      const aim = {
        x: this.tip.x + (want.x - this.tip.x) * k,
        y: this.tip.y + (want.y - this.tip.y) * k,
      };
      // The tongue can't go through walls: it stops where it hits one.
      this.tip = castCircle(level, head, clampToRange(head, aim, MAX_STRETCH), TONGUE_RADIUS);
      const box = boxes.findIndex(b => !b.eaten && touchesBox(this.tip, b));
      if (box >= 0) {
        this.carrying = box;
        this.state = 'back';
        this.events.push('grabBox');
      }
    } else if (this.state === 'back') {
      const d = dist(this.tip, head);
      const move = RETRACT_SPEED * dt;
      if (d <= move) {
        this.state = 'idle';
        const eaten = this.carrying;
        this.carrying = null;
        return eaten;
      }
      this.tip.x += ((head.x - this.tip.x) / d) * move;
      this.tip.y += ((head.y - this.tip.y) / d) * move;
    }
    return null;
  }

  takeEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }
}

/** Is the tongue tip touching (or within a hair of) a box's tile? */
export function touchesBox(tip, box, margin = 6) {
  const cx = Math.max(box.col * TILE, Math.min(tip.x, (box.col + 1) * TILE));
  const cy = Math.max(box.row * TILE, Math.min(tip.y, (box.row + 1) * TILE));
  return Math.hypot(tip.x - cx, tip.y - cy) < TONGUE_RADIUS + margin;
}
