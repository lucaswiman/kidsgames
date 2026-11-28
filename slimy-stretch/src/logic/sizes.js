import { dist } from './collision.js';
import { Slime } from './slime.js';
import { SafeTrail, SPLIT_REACH, touching } from './split.js';

// The size system: Split (the big machine's reward) all grown up. Every piece
// of slime has a size: 2 (double size), 1 (regular) or 0.5 (half size).
//
// - A piece reaches as far as its size says: double size stretches twice as
//   far, a half only half as far. It's drawn bigger or smaller to match.
// - Getting hurt splits a piece into two pieces of half its size: a double
//   slime becomes two regular slimes, and a regular slime two halves. A half
//   that gets hurt is gone, and if it was your last piece you really die
//   (and start again from the checkpoint as one regular slime).
// - You move whichever piece is nearest your finger. Pieces that touch merge
//   back together, adding up their sizes (but never bigger than double).
// - The exit door opens when you're all in one piece (any size), or when
//   every piece is at least regular size. Two halves can't go through it.
// - In the computer world, copy-paste pads leave a still copy of you behind.
//   Eat the copy with your tongue and its size adds to yours, so a regular
//   slime becomes double size (until it gets hurt).
//
// Players without Split don't use any of this: getting hurt just kills them.

export const DOUBLE = 2;
export const REGULAR = 1;
export const HALF = 0.5;
export const MAX_SIZE = DOUBLE;
export const MIN_SIZE = HALF;

// How big each size is drawn (1 = normal). Halves look this big ever since Split.
const DRAW_HALF = 0.72;
const DRAW_DOUBLE = 1.5;

/** How much farther (or less far) a piece of this size can stretch. */
export function reachScale(size) {
  return size <= HALF ? SPLIT_REACH : size;
}

/** How big a piece of this size is drawn. */
export function drawScale(size) {
  if (size >= DOUBLE) {
    return DRAW_DOUBLE;
  }
  return size >= REGULAR ? 1 : DRAW_HALF;
}

/** The sizes a hurt piece splits into (none: a half that's hurt is just gone). */
export function splitSizes(size) {
  return size > MIN_SIZE ? [size / 2, size / 2] : [];
}

/** Two pieces merging (or eating a copy of yourself) add up, up to double size. */
export function mergedSize(a, b) {
  return Math.min(MAX_SIZE, a + b);
}

/** Does the exit door open for pieces of these sizes? */
export function doorOpens(sizes) {
  return sizes.length <= 1 || sizes.every(s => s >= REGULAR);
}

/** A still copy of a slime whose ends are at `ends` (it never moves). */
export function stillSlime(ends) {
  const slime = new Slime(ends[0]);
  slime.falling = null;
  slime.frozen = true;
  ends.forEach((e, i) => {
    slime.ends[i].x = e.x;
    slime.ends[i].y = e.y;
  });
  return slime;
}

/**
 * All the pieces of slime you have right now. Each piece is
 * { slime, size, trail }: its Slime, its size, and a SafeTrail of spots it
 * was recently sitting safely (where new pieces appear when it splits). One
 * piece is `active`: the one you're moving. The game's other systems only
 * ever see the active piece's slime; the others just sit there.
 */
export class SlimePieces {
  constructor(slime) {
    this.reset(slime);
  }

  /** Back to one regular-size slime (at the start, and after really dying). */
  reset(slime) {
    this.list = [{ slime, size: REGULAR, trail: new SafeTrail() }];
    this.active = this.list[0];
    // Still copies of you left behind by copy-paste pads: { slime, size }.
    this.copies = [];
  }

  get count() {
    return this.list.length;
  }

  /** The pieces you're not moving right now. */
  get others() {
    return this.list.filter(p => p !== this.active);
  }

  get sizes() {
    return this.list.map(p => p.size);
  }

  /** Is the exit door willing to open? */
  get doorOpen() {
    return doorOpens(this.sizes);
  }

  /** Is the only thing left one half-size slime (so getting hurt again really kills you)? */
  get lastHalf() {
    return this.list.length === 1 && this.active.size <= MIN_SIZE;
  }

  /**
   * You move whichever piece is nearest your finger at `point` (a falling
   * piece can't be picked). Returns true if a different piece is active now.
   */
  pick(point) {
    const near = p => Math.min(...p.slime.ends.map(e => dist(e, point)));
    let best = this.active;
    for (const p of this.list) {
      if (p !== this.active && !p.slime.isFalling && near(p) < near(best)) {
        best = p;
      }
    }
    if (best === this.active) {
      return false;
    }
    this.active = best;
    return true;
  }

  /**
   * `piece` got hurt. Returns what happened to it:
   *   { outcome: 'split', twin } - it split into two pieces of half its size:
   *       it moved to the newest safe spot on its trail, and its `twin`
   *       appeared a little way back along the trail
   *   { outcome: 'lost' } - it was a half, so it's gone (if you were moving
   *       it, you're moving the nearest piece that's left now)
   *   { outcome: 'dead' } - it was your very last piece: you really die
   * `fallback` is where to split to if the piece has no safe spots yet.
   */
  hurt(piece, fallback) {
    const sizes = splitSizes(piece.size);
    if (sizes.length === 0) {
      if (this.list.length === 1) {
        return { outcome: 'dead' };
      }
      const from = piece.slime.center;
      this.list = this.list.filter(p => p !== piece);
      if (this.active === piece) {
        const d = p => dist(p.slime.center, from);
        this.active = this.list.reduce((a, b) => (d(b) < d(a) ? b : a));
      }
      return { outcome: 'lost' };
    }
    const [a, b] = piece.trail.splitSpots(fallback);
    piece.slime.spawn(a);
    piece.size = sizes[0];
    const twin = { slime: new Slime(b), size: sizes[1], trail: piece.trail.clone() };
    this.list.splice(this.list.indexOf(piece) + 1, 0, twin);
    return { outcome: 'split', twin };
  }

  /**
   * Two pieces that are touching merge into one, adding up their sizes.
   * Only pieces that `canMerge` (settled somewhere, not falling) count. The
   * piece you're moving stays the one you're moving. Returns the merged
   * piece, or null if nothing merged. (One merge at a time is plenty.)
   */
  mergeTouching(canMerge) {
    // Look at the piece you're moving first.
    const order = [this.active, ...this.others].filter(canMerge);
    for (let i = 0; i < order.length; i++) {
      for (let j = i + 1; j < order.length; j++) {
        const [keep, gone] = [order[i], order[j]];
        if (touching(keep.slime, gone.slime)) {
          keep.size = mergedSize(keep.size, gone.size);
          this.list = this.list.filter(p => p !== gone);
          return keep;
        }
      }
    }
    return null;
  }

  /** Remember safe spots for the pieces big enough to split (`safe(piece)` says it's safe). */
  record(dt, safe) {
    for (const piece of this.list) {
      if (piece.size >= REGULAR) {
        piece.trail.record(dt, piece.slime, safe(piece));
      }
    }
  }

  /** A copy-paste pad: leave a still copy of the active piece behind, with its ends at `ends`. */
  leaveCopy(ends) {
    const copy = { slime: stillSlime(ends), size: this.active.size };
    this.copies.push(copy);
    return copy;
  }

  /** Copies of you that `hurt(copy)` says got caught by something just go poof. Returns how many. */
  loseCopies(hurt) {
    const before = this.copies.length;
    this.copies = this.copies.filter(c => !hurt(c));
    return before - this.copies.length;
  }

  /**
   * If a tongue tip at `tip` (with radius `r`) is touching a copy of you,
   * gobble it up: its size adds to the piece you're moving. Returns the new
   * size, or 0 if there was no copy there.
   */
  eatCopyAt(tip, r) {
    const copy = this.copies.find(c => c.slime.bodyPoints(8).some(p => dist(p, tip) < r + 12));
    if (!copy) {
      return 0;
    }
    this.copies = this.copies.filter(c => c !== copy);
    this.active.size = mergedSize(this.active.size, copy.size);
    return this.active.size;
  }
}
