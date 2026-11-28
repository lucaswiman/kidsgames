import { END_RADIUS, TILE } from './constants.js';
import { circleTouches, dist } from './collision.js';
import { isCatchingKind, isSolidKind, TileKind, tileAt } from './level.js';
import { checkSupportWith } from './sky.js';
import { padCenter } from './space.js';

// Things in the Haunted House: creaky floorboards that vanish after you stick
// to them, haunted furniture that slides back and forth (it shoves you out of
// the way, but you can ride it), spider webs that hold you still for a
// moment, spooky paintings whose eyes follow you around (they never hurt!)
// and secret bookcases that spin you around into another room. None of it
// hurts. Chandeliers swing just like the jungle's vines (see swingingVines in
// jungle.js), dumbwaiters are floating islands that go up and down (see
// floatingPlatforms in sky.js) and bouncy beds bounce you like the island's
// hammocks (see island.js).

export const CREAK_TIME = 1.2; // stick to a floorboard and it creaks this long...
export const BOARD_GONE = 4; // ...then it's gone this long, and comes back

// How big each kind of furniture is, in tiles. Its `at` spot is its top-left tile.
export const FURNITURE_SIZES = {
  chair: { w: 1, h: 1 },
  table: { w: 2, h: 1 },
  wardrobe: { w: 1, h: 2 },
};
export const FURNITURE_SPEED = 80;
export const FURNITURE_PAUSE = 2; // it stops this long at each end of its path
export const SHOVE_SPEED = 380; // bumping into you, it shoves you this hard...
export const SHOVE_LIFT = 280; // ...and up a bit
const RIDE_MARGIN = 8; // an end this close to a piece of furniture is stuck to it
const HAUNT_RANGE = 8 * TILE; // furniture starting to move this close goes "oooo"...
const HAUNT_EVERY = 6; // ...but not more often than this

export const WEB_HOLD = 2.5; // stick to a spider web and you can't move for this long

export const BOOKCASE_RADIUS = 20; // touch this close to the middle of a bookcase's bottom tile
export const BOOKCASE_SPIN = 0.6; // how long a bookcase takes to spin around
const BOOKCASE_REST = 1; // a bookcase rests this long after you use it

export const EYE_LOOK = 3; // how far a painting's eyes move to follow you

/** Is a circle at `p` touching tile (col, row)? */
function touchesTile(p, r, col, row) {
  const cx = Math.max(col * TILE, Math.min(p.x, (col + 1) * TILE));
  const cy = Math.max(row * TILE, Math.min(p.y, (row + 1) * TILE));
  return (p.x - cx) ** 2 + (p.y - cy) ** 2 < r * r;
}

/** How far point `p` is from a rectangle (0 if it's inside). */
function rectDist(p, rect) {
  const dx = Math.max(rect.left - p.x, 0, p.x - rect.right);
  const dy = Math.max(rect.top - p.y, 0, p.y - rect.bottom);
  return Math.hypot(dx, dy);
}

/** True if a slime end at `e` is touching a spider web. */
export function touchingWeb(level, e) {
  return circleTouches(level, e, END_RADIUS + 4, isCatchingKind);
}

/** Which way a painting's eyes look (how far the pupils move) to follow `target`. */
export function paintingLook(painting, target) {
  const d = dist(painting, target);
  if (d < 1) {
    return { x: 0, y: 0 };
  }
  // Up close they look right at you; far away they just glance your way.
  const k = Math.min(1, d / (3 * TILE));
  return {
    x: ((target.x - painting.x) / d) * EYE_LOOK * k,
    y: ((target.y - painting.y) / d) * EYE_LOOK * k,
  };
}

/** The furniture in a level as floating platforms, for the level checker. */
export function furnitureRides(def) {
  return (def.furniture || []).map(d => ({
    from: d.at,
    to: d.to,
    width: furnitureSize(d).w,
  }));
}

/** How big (in tiles) a piece of furniture from def.furniture is. */
export function furnitureSize(d) {
  const size = FURNITURE_SIZES[d.kind];
  if (!size) {
    throw new Error(`unknown furniture '${d.kind}'`);
  }
  return size;
}

/** The tiles a piece of furniture covers while it rests at its `at` spot. */
export function furnitureCells(d) {
  const { w, h } = furnitureSize(d);
  const cells = [];
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      cells.push({ col: d.at[0] + i, row: d.at[1] + j });
    }
  }
  return cells;
}

/** Where a piece of furniture is drawn when its top-left corner is at `at`. */
export function furnitureRect(f, at = f) {
  return { left: at.x, top: at.y, right: at.x + f.w * TILE, bottom: at.y + f.h * TILE };
}

export class HauntedStuff {
  /**
   * `sky` is the level's SkyStuff, which moves the dumbwaiters: ends riding
   * on furniture count as held up when it checks what's holding the slime.
   */
  constructor(level, sky = null) {
    this.level = level;
    this.sky = sky;
    this.boards = level.floorboards.map(b => ({ ...b, state: 'solid', timer: 0 }));
    this.webs = level.webs;
    this.paintings = level.paintings;
    this.furniture = (level.def.furniture || []).map(d => this.buildFurniture(d));
    this.furniture.forEach(f => this.placeFurniture(f));
    this.bookcases = (level.def.bookcases || []).map(b => ({
      a: padCenter(b.a),
      b: padCenter(b.b),
      used: false,
      rest: 0,
      spinA: 0, // how far each bookcase is through a spin, from 0 to 1 (just for looks)
      spinB: 0,
    }));
    // While a bookcase spins you around: { pair, to, timer }.
    this.spinning = null;
    this.web = 0; // seconds left being held by a spider web
    this.webbedSlime = null; // the slime (or half) the web is holding
    this.wasLoose = [false, false]; // for webs: was each end loose last frame?
    this.wasUnstuck = [false, false]; // for furniture: was each end not stuck last frame?
    this.lookAt = level.start; // where the paintings are looking
    this.lastHaunt = -Infinity;
    this.time = 0;
    this.events = [];
    if (sky) {
      sky.holders.push(slime => this.furnitureRiders(slime));
    }
  }

  buildFurniture(d) {
    const { w, h } = furnitureSize(d);
    const from = { x: d.at[0] * TILE, y: d.at[1] * TILE };
    const to = { x: d.to[0] * TILE, y: d.to[1] * TILE };
    // Remember what's under the furniture's path so it comes back behind it.
    const under = new Map();
    const [c0, c1] = [d.at[0], d.to[0]].sort((a, b) => a - b);
    const [r0, r1] = [d.at[1], d.to[1]].sort((a, b) => a - b);
    for (let row = r0; row < r1 + h; row++) {
      for (let col = c0; col < c1 + w; col++) {
        under.set(`${col},${row}`, tileAt(this.level, col, row));
      }
    }
    const pauseTime = d.pause ?? FURNITURE_PAUSE;
    return {
      kind: d.kind,
      w,
      h,
      from,
      to,
      x: from.x,
      y: from.y,
      dir: 1,
      speed: d.speed || FURNITURE_SPEED,
      pauseTime,
      pause: pauseTime, // it waits a moment before it starts moving
      moving: false,
      under,
      cells: [],
      riders: [false, false], // which ends of the slime are stuck to it
      wobble: 0, // just for looks: it rattles a bit while it moves
    };
  }

  /** Is the slime settled somewhere, free to touch things (not falling or carried)? */
  free(slime) {
    return !slime.isFalling && !slime.frozen;
  }

  /** Advance everything. Nothing in the haunted house hurts, so this always returns null. */
  update(dt, slime) {
    this.time += dt;
    this.lookAt = slime.center;
    this.updateFurniture(dt, slime);
    this.updateBoards(dt, slime);
    this.updateWebs(dt, slime);
    this.updateBookcases(dt, slime);
    return null;
  }

  /**
   * Something the slime was stuck to just disappeared: let go of anything
   * left holding onto nothing (ends riding on furniture or dumbwaiters
   * count as held up).
   */
  checkSupport(slime) {
    if (this.sky) {
      this.sky.checkSupport(slime);
    } else if (this.free(slime)) {
      checkSupportWith(this.level, slime, this.furnitureRiders(slime));
    }
  }

  // ------------------------------------------------------------ floorboards

  updateBoards(dt, slime) {
    const tiles = this.level.tiles;
    let vanished = false;
    for (const b of this.boards) {
      if (b.state === 'solid') {
        const stuckHere =
          this.free(slime) &&
          slime.ends.some(e => e.state === 'stuck' && touchesTile(e, END_RADIUS + 6, b.col, b.row));
        if (stuckHere) {
          // Creeeak... get off quick!
          b.state = 'creak';
          b.timer = CREAK_TIME;
          this.events.push({ type: 'creak', x: (b.col + 0.5) * TILE, y: b.row * TILE });
        }
      } else if (b.state === 'creak') {
        b.timer -= dt;
        if (b.timer <= 0) {
          b.state = 'gone';
          b.timer = BOARD_GONE;
          tiles[b.row][b.col] = TileKind.EMPTY;
          vanished = true;
          this.events.push({ type: 'boardGone', x: (b.col + 0.5) * TILE, y: b.row * TILE });
        }
      } else {
        b.timer -= dt;
        // It only comes back if the slime isn't in the way.
        const blocked = slime.bodyPoints(8).some(p => touchesTile(p, END_RADIUS, b.col, b.row));
        if (b.timer <= 0 && !blocked) {
          b.state = 'solid';
          tiles[b.row][b.col] = TileKind.FLOORBOARD;
          this.events.push({ type: 'boardBack', x: (b.col + 0.5) * TILE, y: b.row * TILE });
        }
      }
    }
    if (vanished) {
      // Whatever was standing on it falls through.
      this.checkSupport(slime);
    }
  }

  /** How shaky a floorboard is, from 0 (solid) to 1 (about to vanish). */
  boardShake(b) {
    return b.state === 'creak' ? 1 - b.timer / CREAK_TIME : 0;
  }

  // -------------------------------------------------------------- furniture

  updateFurniture(dt, slime) {
    const active = this.free(slime);
    for (const f of this.furniture) {
      // An end is stuck to the furniture if it stuck to it while the
      // furniture was stopped, or landed on it, and hasn't let go since. (An
      // end it bumps into while it's moving gets shoved instead.)
      f.riders = slime.ends.map(
        (e, i) =>
          active &&
          e.state === 'stuck' &&
          this.touchingFurniture(e, f) &&
          (f.riders[i] || f.pause > 0 || this.wasUnstuck[i])
      );
      const before = { x: f.x, y: f.y };
      this.moveFurniture(f, dt, slime);
      const dx = f.x - before.x;
      const dy = f.y - before.y;
      const moved = this.placeFurniture(f);
      if (!dx && !dy) {
        continue;
      }
      f.wobble += dt;
      if (active && (f.riders[0] || f.riders[1])) {
        this.carryRiders(f, dx, dy, slime);
      }
      if (!slime.frozen && this.bumping(f, slime)) {
        this.shove(f, Math.sign(dx), Math.sign(dy), slime);
      }
      if (moved) {
        this.checkSupport(slime);
      }
    }
    this.wasUnstuck = slime.ends.map(e => !this.free(slime) || e.state !== 'stuck');
  }

  /** Slide back and forth along the path, stopping for a moment at each end. */
  moveFurniture(f, dt, slime) {
    if (f.pause > 0) {
      f.pause -= dt;
      f.moving = false;
      return;
    }
    if (!f.moving) {
      f.moving = true;
      // Oooooo... it's haunted!
      const near = dist(slime.center, { x: f.x, y: f.y }) < HAUNT_RANGE;
      if (near && this.time - this.lastHaunt > HAUNT_EVERY) {
        this.lastHaunt = this.time;
        this.events.push({ type: 'haunt', x: f.x + (f.w * TILE) / 2, y: f.y });
      }
    }
    const target = f.dir > 0 ? f.to : f.from;
    const d = dist(f, target);
    const step = f.speed * dt;
    if (d <= step) {
      f.x = target.x;
      f.y = target.y;
      f.dir = -f.dir;
      f.pause = f.pauseTime;
    } else {
      f.x += ((target.x - f.x) / d) * step;
      f.y += ((target.y - f.y) / d) * step;
    }
  }

  /** Is a slime end at `e` touching furniture `f` (where it's drawn, or its tiles)? */
  touchingFurniture(e, f) {
    return (
      rectDist(e, furnitureRect(f)) < END_RADIUS + RIDE_MARGIN ||
      f.cells.some(c => touchesTile(e, END_RADIUS + 6, c.col, c.row))
    );
  }

  /** Which ends are stuck to any piece of furniture (they ride along with it). */
  furnitureRiders(slime) {
    return slime.ends.map((_e, i) => this.furniture.some(f => f.riders[i]));
  }

  /** Ends stuck to the furniture move along with it. */
  carryRiders(f, dx, dy, slime) {
    let blocked = false;
    slime.ends.forEach((e, i) => {
      if (!f.riders[i]) {
        return;
      }
      const next = { x: e.x + dx, y: e.y + dy };
      if (this.hitsSolidBesides(next, f)) {
        blocked = true;
      } else {
        e.x = next.x;
        e.y = next.y;
      }
    });
    if (blocked) {
      // Squashed against a wall: it pushes you right off.
      this.shove(f, Math.sign(dx), Math.sign(dy), slime);
      return;
    }
    // Stretched too far? The furniture pulls your other end off.
    const [a, b] = slime.ends;
    if (dist(a, b) > slime.reach) {
      slime.ends.forEach((e, i) => {
        if (!f.riders[i] && e.state === 'stuck') {
          e.state = 'snapping';
          slime.lead = 1 - i;
        }
      });
    }
  }

  /** Is the moving furniture bumping into a part of the slime that isn't stuck to it? */
  bumping(f, slime) {
    const rect = furnitureRect(f);
    if (slime.isFalling) {
      return rectDist(slime.falling, rect) < END_RADIUS;
    }
    const riding = f.riders[0] || f.riders[1];
    const endHit = slime.ends.some(
      (e, i) => e.state === 'stuck' && !f.riders[i] && rectDist(e, rect) < END_RADIUS - 1
    );
    // (A slime riding along can stretch and boing over it all it likes.)
    return endHit || (!riding && slime.bodyPoints(10).some(p => rectDist(p, rect) < 3));
  }

  /**
   * Bump! The furniture knocks the slime loose and shoves it along the way
   * it's moving. It doesn't hurt, it's just very rude.
   */
  shove(f, sx, sy, slime) {
    // Get the slime out from in front of the furniture (and its tiles) first.
    const rect = furnitureRect(f);
    for (const c of f.cells) {
      rect.left = Math.min(rect.left, c.col * TILE);
      rect.right = Math.max(rect.right, (c.col + 1) * TILE);
      rect.top = Math.min(rect.top, c.row * TILE);
      rect.bottom = Math.max(rect.bottom, (c.row + 1) * TILE);
    }
    const c = slime.isFalling ? slime.falling : slime.center;
    const r = END_RADIUS + 2;
    const clampX = x => Math.max(rect.left + r, Math.min(rect.right - r, x));
    const clampY = y => Math.max(rect.top + r, Math.min(rect.bottom - r, y));
    const spots = [];
    if (sx) {
      spots.push({ x: sx > 0 ? rect.right + r : rect.left - r, y: clampY(c.y) });
    }
    if (sy > 0) {
      spots.push({ x: clampX(c.x), y: rect.bottom + r });
    }
    spots.push({ x: clampX(c.x), y: rect.top - r });
    const spot = spots.find(p => !this.hitsSolid(p));
    slime.knockLoose(sx * SHOVE_SPEED, sy ? sy * SHOVE_SPEED : -SHOVE_LIFT);
    if (spot) {
      slime.falling.x = spot.x;
      slime.falling.y = spot.y;
      for (const e of slime.ends) {
        e.x = spot.x;
        e.y = spot.y;
      }
    }
    for (const other of this.furniture) {
      other.riders = [false, false];
    }
    this.events.push({ type: 'shove', x: c.x, y: c.y });
  }

  /** Does a slime end at `p` overlap anything solid? */
  hitsSolid(p) {
    return circleTouches(this.level, p, END_RADIUS, isSolidKind);
  }

  /** Does a slime end at `p` overlap anything solid, other than furniture `f`'s own tiles? */
  hitsSolidBesides(p, f) {
    const own = new Set(f.cells.map(c => `${c.col},${c.row}`));
    const r = END_RADIUS;
    for (let row = Math.floor((p.y - r) / TILE); row <= Math.floor((p.y + r) / TILE); row++) {
      for (let col = Math.floor((p.x - r) / TILE); col <= Math.floor((p.x + r) / TILE); col++) {
        const solid = !own.has(`${col},${row}`) && isSolidKind(tileAt(this.level, col, row));
        if (solid && touchesTile(p, r, col, row)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Make the tiles under a piece of furniture solid (and the ones it left
   * behind go back to what they were). Sliding sideways it takes the columns
   * it mostly covers; going up and down it takes the rows just under its
   * top, so an end riding on top is never inside it. Returns true if
   * anything changed.
   */
  placeFurniture(f) {
    const col0 = Math.round(f.x / TILE);
    const row0 = Math.ceil(f.y / TILE - 0.001);
    const cells = [];
    for (let j = 0; j < f.h; j++) {
      for (let i = 0; i < f.w; i++) {
        cells.push({ col: col0 + i, row: row0 + j });
      }
    }
    const key = list => list.map(c => `${c.col},${c.row}`).join(';');
    if (key(cells) === key(f.cells)) {
      return false;
    }
    const tiles = this.level.tiles;
    for (const c of f.cells) {
      tiles[c.row][c.col] = f.under.get(`${c.col},${c.row}`) ?? TileKind.EMPTY;
    }
    for (const c of cells) {
      if (c.row >= 0 && c.row < this.level.height && c.col >= 0 && c.col < this.level.width) {
        tiles[c.row][c.col] = TileKind.FURNITURE;
      }
    }
    f.cells = cells;
    return true;
  }

  // ------------------------------------------------------------ spider webs

  updateWebs(dt, slime) {
    const settled = this.free(slime);
    if (this.web > 0) {
      this.web -= dt;
      // Knocked loose (or carried off): the web lets go too.
      if (this.webbedSlime === slime && !settled) {
        this.web = 0;
      }
      if (this.web <= 0) {
        this.releaseWeb();
      }
    } else if (settled) {
      // Only a fresh stick (letting go of a stretch, or getting caught while
      // falling) gets held, not an end boinging back to the other one.
      const caught = slime.ends.find(
        (e, i) => this.wasLoose[i] && e.state === 'stuck' && touchingWeb(this.level, e)
      );
      if (caught) {
        this.web = WEB_HOLD;
        this.webbedSlime = slime;
        slime.glued = true;
        this.events.push({ type: 'web', x: caught.x, y: caught.y });
      }
    }
    this.wasLoose = slime.ends.map(e => !settled || e.state === 'held');
  }

  /** The web lets go: you can stretch again (you're still stuck to it, though). */
  releaseWeb() {
    this.web = 0;
    if (this.webbedSlime) {
      this.webbedSlime.glued = false;
      this.events.push({ type: 'webFree' });
    }
    this.webbedSlime = null;
  }

  /** How much longer the web holds you, from 1 (just caught) to 0 (free). */
  get webHold() {
    return Math.max(0, this.web / WEB_HOLD);
  }

  // -------------------------------------------------------- secret bookcases

  updateBookcases(dt, slime) {
    for (const pair of this.bookcases) {
      pair.rest = Math.max(0, pair.rest - dt);
      pair.spinA = Math.max(0, pair.spinA - dt / BOOKCASE_SPIN);
      pair.spinB = Math.max(0, pair.spinB - dt / BOOKCASE_SPIN);
    }
    if (this.spinning) {
      const spin = this.spinning;
      spin.timer -= dt;
      if (spin.timer > 0) {
        slime.holdAt(spin.from.x, spin.from.y);
        return;
      }
      // ...and out of the other bookcase, in another room!
      slime.spawn(spin.to);
      if (spin.to === spin.pair.a) {
        spin.pair.spinA = 1;
      } else {
        spin.pair.spinB = 1;
      }
      this.spinning = null;
      this.events.push({ type: 'bookcaseOut', x: spin.to.x, y: spin.to.y });
      return;
    }
    if (!this.free(slime)) {
      return;
    }
    const touching = p => slime.ends.some(e => dist(e, p) < BOOKCASE_RADIUS + END_RADIUS);
    for (const pair of this.bookcases) {
      const onA = touching(pair.a);
      const onB = touching(pair.b);
      if (pair.used) {
        // It works again once you've moved away from both bookcases.
        if (!onA && !onB && pair.rest <= 0) {
          pair.used = false;
        }
        continue;
      }
      if (onA || onB) {
        // Click! The bookcase spins around with you on it...
        const from = onA ? pair.a : pair.b;
        const to = onA ? pair.b : pair.a;
        if (onA) {
          pair.spinA = 1;
        } else {
          pair.spinB = 1;
        }
        pair.used = true;
        pair.rest = BOOKCASE_REST;
        this.spinning = { pair, from, to, timer: BOOKCASE_SPIN };
        slime.holdAt(from.x, from.y);
        this.events.push({ type: 'bookcaseSpin', x: from.x, y: from.y });
        return;
      }
    }
  }

  // ---------------------------------------------------------------- general

  resetAfterDeath() {
    this.releaseWeb();
    this.spinning = null;
    this.wasLoose = [false, false];
    this.wasUnstuck = [false, false];
    for (const f of this.furniture) {
      f.riders = [false, false];
    }
    for (const pair of this.bookcases) {
      pair.used = false;
    }
  }

  takeEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }
}
