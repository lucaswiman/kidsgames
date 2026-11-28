import { describe, expect, it } from 'vitest';
import { Slime } from './slime.js';
import { SPLIT_REACH } from './split.js';
import { TILE } from './constants.js';
import {
  DOUBLE,
  doorOpens,
  drawScale,
  HALF,
  mergedSize,
  reachScale,
  REGULAR,
  SlimePieces,
  splitSizes,
  stillSlime,
} from './sizes.js';

function slimeAt(x, y) {
  const slime = new Slime({ x, y });
  slime.falling = null;
  return slime;
}

/** Pieces whose (only) slime has been sitting safely along a row of spots. */
function piecesWithTrail() {
  const pieces = new SlimePieces(slimeAt(TILE, TILE * 3));
  for (let i = 0; i < 8; i++) {
    const s = pieces.active.slime;
    s.ends.forEach(e => {
      e.x = TILE * (1 + i);
    });
    pieces.record(0.5, () => true);
  }
  return pieces;
}

const settled = p => !p.slime.isFalling && !p.slime.frozen;

describe('size rules', () => {
  it('reach scales with size, and halves reach as far as Split always did', () => {
    expect(reachScale(DOUBLE)).toBe(2);
    expect(reachScale(REGULAR)).toBe(1);
    expect(reachScale(HALF)).toBe(SPLIT_REACH);
  });

  it('draws double slimes bigger and halves smaller', () => {
    expect(drawScale(DOUBLE)).toBeGreaterThan(1);
    expect(drawScale(REGULAR)).toBe(1);
    expect(drawScale(HALF)).toBeLessThan(1);
  });

  it('a hurt piece splits into two pieces of half its size; a hurt half is just gone', () => {
    expect(splitSizes(DOUBLE)).toEqual([REGULAR, REGULAR]);
    expect(splitSizes(REGULAR)).toEqual([HALF, HALF]);
    expect(splitSizes(HALF)).toEqual([]);
  });

  it('merging adds up sizes, but never past double', () => {
    expect(mergedSize(HALF, HALF)).toBe(REGULAR);
    expect(mergedSize(REGULAR, HALF)).toBe(1.5);
    expect(mergedSize(REGULAR, REGULAR)).toBe(DOUBLE);
    expect(mergedSize(DOUBLE, REGULAR)).toBe(DOUBLE);
    expect(mergedSize(DOUBLE, DOUBLE)).toBe(DOUBLE);
  });

  it('the door opens for one piece of any size, or pieces all regular size or bigger', () => {
    expect(doorOpens([HALF])).toBe(true);
    expect(doorOpens([DOUBLE])).toBe(true);
    expect(doorOpens([REGULAR, REGULAR])).toBe(true);
    expect(doorOpens([DOUBLE, REGULAR, REGULAR])).toBe(true);
    expect(doorOpens([HALF, HALF])).toBe(false);
    expect(doorOpens([REGULAR, HALF])).toBe(false);
    expect(doorOpens([REGULAR, HALF, HALF])).toBe(false);
  });
});

describe('SlimePieces', () => {
  it('starts as one regular slime', () => {
    const slime = slimeAt(100, 100);
    const pieces = new SlimePieces(slime);
    expect(pieces.count).toBe(1);
    expect(pieces.active.slime).toBe(slime);
    expect(pieces.active.size).toBe(REGULAR);
    expect(pieces.doorOpen).toBe(true);
    expect(pieces.lastHalf).toBe(false);
  });

  it('getting hurt splits a regular slime into two halves along its safe trail', () => {
    const pieces = piecesWithTrail();
    const slime = pieces.active.slime;
    const { outcome, twin } = pieces.hurt(pieces.active, { x: 0, y: 0 });
    expect(outcome).toBe('split');
    expect(pieces.sizes).toEqual([HALF, HALF]);
    // You keep moving the same slime, at the newest safe spot...
    expect(pieces.active.slime).toBe(slime);
    expect(slime.falling.x).toBe(TILE * 8);
    // ...and the other half is a little way back along the trail.
    expect(TILE * 8 - twin.slime.falling.x).toBeGreaterThan(TILE * 2);
    expect(pieces.doorOpen).toBe(false);
  });

  it('with no safe spots yet, both halves appear at the fallback spot', () => {
    const pieces = new SlimePieces(slimeAt(100, 100));
    const { twin } = pieces.hurt(pieces.active, { x: 5, y: 6 });
    expect(pieces.active.slime.falling).toMatchObject({ x: 5, y: 6 });
    expect(twin.slime.falling).toMatchObject({ x: 5, y: 6 });
  });

  it('a hurt half is gone, and you carry on with the nearest piece', () => {
    const pieces = piecesWithTrail();
    const { twin } = pieces.hurt(pieces.active, { x: 0, y: 0 });
    expect(pieces.hurt(pieces.active, { x: 0, y: 0 })).toEqual({ outcome: 'lost' });
    expect(pieces.count).toBe(1);
    expect(pieces.active).toBe(twin);
    expect(pieces.lastHalf).toBe(true);
    // One piece of any size can go through the door.
    expect(pieces.doorOpen).toBe(true);
  });

  it('getting hurt as your last half really kills you', () => {
    const pieces = piecesWithTrail();
    pieces.hurt(pieces.active, { x: 0, y: 0 });
    pieces.hurt(pieces.active, { x: 0, y: 0 });
    expect(pieces.hurt(pieces.active, { x: 0, y: 0 })).toEqual({ outcome: 'dead' });
    expect(pieces.count).toBe(1);
  });

  it('a double slime splits into two regular slimes, and those into four halves', () => {
    const pieces = piecesWithTrail();
    pieces.active.size = DOUBLE;
    const { twin } = pieces.hurt(pieces.active, { x: 0, y: 0 });
    expect(pieces.sizes).toEqual([REGULAR, REGULAR]);
    // Two regular slimes can beat the level.
    expect(pieces.doorOpen).toBe(true);
    // The new piece remembers the same safe spots, so it can split too.
    expect(twin.trail.spots.length).toBe(pieces.active.trail.spots.length);
    expect(twin.trail.spots).not.toBe(pieces.active.trail.spots);
    pieces.hurt(pieces.active, { x: 0, y: 0 });
    expect(pieces.sizes).toEqual([HALF, HALF, REGULAR]);
    expect(pieces.doorOpen).toBe(false);
    pieces.hurt(twin, { x: 0, y: 0 });
    expect(pieces.sizes).toEqual([HALF, HALF, HALF, HALF]);
  });

  it('only pieces big enough to split remember safe spots', () => {
    const pieces = piecesWithTrail();
    pieces.hurt(pieces.active, { x: 0, y: 0 });
    const before = pieces.active.trail.spots.length;
    pieces.active.slime.falling = null;
    pieces.active.slime.ends.forEach(e => {
      e.x = TILE * 20;
    });
    pieces.record(0.5, () => true);
    expect(pieces.active.trail.spots.length).toBe(before);
  });

  it('you move whichever piece is nearest your finger, but not a falling one', () => {
    const pieces = new SlimePieces(slimeAt(100, 100));
    pieces.active.size = DOUBLE;
    const { twin } = pieces.hurt(pieces.active, { x: 100, y: 100 });
    const first = pieces.active;
    first.slime.falling = null;
    twin.slime.falling = null;
    twin.slime.ends.forEach(e => {
      e.x = 400;
    });
    expect(pieces.pick({ x: 120, y: 100 })).toBe(false);
    expect(pieces.pick({ x: 390, y: 100 })).toBe(true);
    expect(pieces.active).toBe(twin);
    // A falling piece can't be picked.
    first.slime.falling = { x: 100, y: 100, vx: 0, vy: 0 };
    expect(pieces.pick({ x: 100, y: 100 })).toBe(false);
    expect(pieces.active).toBe(twin);
  });

  it('picks from any number of pieces', () => {
    const pieces = new SlimePieces(slimeAt(100, 100));
    pieces.active.size = DOUBLE;
    pieces.hurt(pieces.active, { x: 100, y: 100 });
    pieces.hurt(pieces.list[1], { x: 100, y: 100 });
    expect(pieces.count).toBe(3);
    pieces.list.forEach((p, i) => {
      p.slime.falling = null;
      p.slime.ends.forEach(e => {
        e.x = 100 + i * 200;
      });
    });
    pieces.pick({ x: 500, y: 100 });
    expect(pieces.active).toBe(pieces.list[2]);
    pieces.pick({ x: 290, y: 100 });
    expect(pieces.active).toBe(pieces.list[1]);
  });

  it('touching pieces merge, adding up their sizes (up to double)', () => {
    const pieces = new SlimePieces(slimeAt(100, 100));
    pieces.hurt(pieces.active, { x: 100, y: 100 });
    pieces.list.forEach(p => {
      p.slime.falling = null;
    });
    const active = pieces.active;
    expect(pieces.mergeTouching(settled)).toBe(active);
    expect(pieces.count).toBe(1);
    expect(pieces.active.size).toBe(REGULAR);
    // Two regular slimes merge into a double one; a double and a regular stay double.
    pieces.active.size = DOUBLE;
    pieces.hurt(pieces.active, { x: 100, y: 100 });
    pieces.list.forEach(p => {
      p.slime.falling = null;
    });
    pieces.mergeTouching(settled);
    expect(pieces.sizes).toEqual([DOUBLE]);
  });

  it("pieces that are far apart, or still falling, don't merge", () => {
    const pieces = new SlimePieces(slimeAt(100, 100));
    pieces.hurt(pieces.active, { x: 100, y: 100 });
    // Both still falling from the split.
    expect(pieces.mergeTouching(settled)).toBe(null);
    pieces.list.forEach(p => {
      p.slime.falling = null;
    });
    pieces.list[1].slime.ends.forEach(e => {
      e.x = 400;
    });
    expect(pieces.mergeTouching(settled)).toBe(null);
    expect(pieces.count).toBe(2);
  });

  it('a merge keeps the piece you were moving', () => {
    const pieces = new SlimePieces(slimeAt(100, 100));
    const { twin } = pieces.hurt(pieces.active, { x: 100, y: 100 });
    pieces.list.forEach(p => {
      p.slime.falling = null;
    });
    pieces.active = twin;
    expect(pieces.mergeTouching(settled)).toBe(twin);
    expect(pieces.active).toBe(twin);
  });

  it('eating the copy of you a copy-paste pad left behind doubles your size', () => {
    const pieces = new SlimePieces(slimeAt(100, 100));
    const copy = pieces.leaveCopy([
      { x: 300, y: 100 },
      { x: 340, y: 100 },
    ]);
    expect(copy.size).toBe(REGULAR);
    expect(copy.slime.frozen).toBe(true);
    expect(copy.slime.ends[1]).toMatchObject({ x: 340, y: 100 });
    // The copy doesn't count as one of your pieces.
    expect(pieces.count).toBe(1);
    expect(pieces.eatCopyAt({ x: 200, y: 100 }, 8)).toBe(0);
    expect(pieces.eatCopyAt({ x: 325, y: 110 }, 8)).toBe(DOUBLE);
    expect(pieces.active.size).toBe(DOUBLE);
    expect(pieces.copies).toHaveLength(0);
  });

  it('copies of you that get caught by something go poof', () => {
    const pieces = new SlimePieces(slimeAt(100, 100));
    pieces.leaveCopy([
      { x: 300, y: 100 },
      { x: 300, y: 100 },
    ]);
    pieces.leaveCopy([
      { x: 600, y: 100 },
      { x: 600, y: 100 },
    ]);
    expect(pieces.loseCopies(c => c.slime.ends[0].x < 400)).toBe(1);
    expect(pieces.copies.map(c => c.slime.ends[0].x)).toEqual([600]);
  });

  it('double size lasts until you get hurt', () => {
    const pieces = piecesWithTrail();
    pieces.leaveCopy(pieces.active.slime.ends);
    pieces.eatCopyAt(pieces.active.slime.ends[0], 8);
    expect(pieces.sizes).toEqual([DOUBLE]);
    pieces.record(10, () => true);
    expect(pieces.sizes).toEqual([DOUBLE]);
    pieces.hurt(pieces.active, { x: 0, y: 0 });
    expect(pieces.sizes).toEqual([REGULAR, REGULAR]);
  });

  it('a half eating a copy of itself is regular size again', () => {
    const pieces = piecesWithTrail();
    pieces.hurt(pieces.active, { x: 0, y: 0 });
    pieces.hurt(pieces.others[0], { x: 0, y: 0 });
    expect(pieces.lastHalf).toBe(true);
    pieces.leaveCopy(pieces.active.slime.ends);
    expect(pieces.copies[0].size).toBe(HALF);
    pieces.eatCopyAt(pieces.active.slime.ends[0], 8);
    expect(pieces.sizes).toEqual([REGULAR]);
  });

  it('really dying resets you to one regular slime with no copies', () => {
    const pieces = piecesWithTrail();
    pieces.active.size = DOUBLE;
    pieces.hurt(pieces.active, { x: 0, y: 0 });
    pieces.leaveCopy(pieces.active.slime.ends);
    const slime = pieces.active.slime;
    pieces.reset(slime);
    expect(pieces.sizes).toEqual([REGULAR]);
    expect(pieces.active.slime).toBe(slime);
    expect(pieces.copies).toHaveLength(0);
    expect(pieces.active.trail.spots).toHaveLength(0);
  });

  it('a still slime copies the ends it was given and never moves', () => {
    const s = stillSlime([
      { x: 10, y: 20 },
      { x: 30, y: 40 },
    ]);
    s.update(1, { tiles: [] });
    expect(s.ends.map(e => [e.x, e.y])).toEqual([
      [10, 20],
      [30, 40],
    ]);
  });
});
