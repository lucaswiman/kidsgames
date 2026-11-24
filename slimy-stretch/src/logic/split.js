import { END_RADIUS, TILE } from './constants.js';
import { dist } from './collision.js';

// Split: the reward for beating the factory boss. Getting hurt doesn't kill
// you right away. Instead the slime splits into two half-size slimes (each
// with half the reach) that you control one at a time. The exit door won't
// open while you're split: bring the two halves together to merge back into
// one. If a half gets hurt it's gone, and you carry on as one half-size slime.
// Get hurt as a half-size slime and you really die.

export const SPLIT_REACH = 0.5;
export const MERGE_DISTANCE = END_RADIUS * 2 + 8;
const RECORD_EVERY = 0.4; // seconds between remembered safe spots
const REMEMBER = 25; // how many safe spots to remember
export const SAFE_TIME = 1.5; // seconds a fresh half can't be hurt

/** Remembers spots the slime was recently sitting safely, to split into. */
export class SafeTrail {
  constructor() {
    this.spots = [];
    this.timer = 0;
  }

  /** Call every frame. `safe` says nothing is hurting the slime right now. */
  record(dt, slime, safe) {
    this.timer -= dt;
    const settled =
      !slime.isFalling &&
      !slime.frozen &&
      slime.heldIndex < 0 &&
      slime.ends.every(e => e.state === 'stuck');
    if (!safe || !settled || this.timer > 0) {
      return;
    }
    this.timer = RECORD_EVERY;
    const spot = { x: slime.ends[slime.lead].x, y: slime.ends[slime.lead].y };
    const last = this.spots[this.spots.length - 1];
    if (!last || dist(last, spot) > 4) {
      this.spots.push(spot);
      if (this.spots.length > REMEMBER) {
        this.spots.shift();
      }
    }
  }

  /**
   * Where the two halves appear: the newest safe spot, and an older one a
   * little way back along the trail (so you have to go and fetch it).
   */
  splitSpots(fallback) {
    const spots = this.spots.length ? this.spots : [fallback];
    const first = spots[spots.length - 1];
    let second = first;
    for (let i = spots.length - 2; i >= 0; i--) {
      second = spots[i];
      if (dist(second, first) > TILE * 2) {
        break;
      }
    }
    return [first, second];
  }

  clear() {
    this.spots = [];
    this.timer = 0;
  }
}

/** True when the two halves are touching, so they merge back into one slime. */
export function touching(a, b) {
  return a.ends.some(e => b.ends.some(f => dist(e, f) < MERGE_DISTANCE));
}
