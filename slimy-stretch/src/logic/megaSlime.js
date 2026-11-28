import { GRAVITY, MAX_FALL_SPEED, TILE } from './constants.js';
import { isPlatformKind, isSolidKind, TileKind, tileAt } from './level.js';
import { REGROW_TIME } from './canyon.js';
import { BOARD_GONE } from './haunted.js';
import { DOUBLE } from './sizes.js';

// Mega Slime: the reward for beating Boxer Bot. Tap 💪 and the slime turns
// into a giant slime person for 12 seconds. Then it needs 60 seconds to rest.
//
// - While you're Mega you don't stretch: you walk left and right with the
//   big ◀ ▶ buttons and jump with the ⬆ button, like in a normal platformer.
//   The jump is super high: about 16 tiles, enough to jump right out of a
//   flooding lab in one go!
// - Nothing can hurt you, not even lava: you can walk and swim right through
//   it. But any other liquid (water, chocolate...) still gets you, and so
//   does falling out of the world.
// - Walking or jumping into breakable blocks smashes them: metal boxes (what
//   was inside drops out), crumbling rocks, creaky floorboards, leafy traps
//   and sleeping clouds. Solid walls and ice never break, so you can't break
//   out of a level. (Standing on a breakable block doesn't break it.)
// - Bumping into an enemy smashes it for good: crabs, monkeys, computer
//   viruses, alien plants, robot arms, patrol robots and sniper robots.
//   Bosses are much too tough for that.
// - When it wears off, you shrink back down to a slime... but a double size
//   one (see sizes.js), until you get hurt.
//
// Mega Slime is never needed to finish a level (the level checker doesn't use it).

export const MEGA_TIME = 12;
export const MEGA_COOLDOWN = 60;
export const MEGA_WIDTH = 44; // the giant's body, for bumping into things...
export const MEGA_HEIGHT = 84; // ...(it's drawn a little bigger)
export const MEGA_WALK = 300; // walking speed, in pixels per second
export const MEGA_JUMP_TILES = 16;
// Jumping straight up this fast goes MEGA_JUMP_TILES high before gravity stops you.
export const MEGA_JUMP = Math.sqrt(2 * GRAVITY * MEGA_JUMP_TILES * TILE);
export const LAVA_GRAVITY = 0.35; // in lava you sink slowly, like swimming...
export const LAVA_SINK = 160; // ...never faster than this

// The blocks Mega Slime smashes by walking or jumping into them.
export const MEGA_BREAKS = new Set([
  TileKind.BOX,
  TileKind.CRUMBLE,
  TileKind.FLOORBOARD,
  TileKind.LEAFY,
  TileKind.SLEEPY,
]);

export function isSmashable(kind) {
  return MEGA_BREAKS.has(kind);
}

/** Is a rectangle overlapping any tile of a kind that `test` says yes to? */
function rectTouches(level, rect, test) {
  const c0 = Math.floor(rect.left / TILE);
  const c1 = Math.floor((rect.right - 0.001) / TILE);
  const r0 = Math.floor(rect.top / TILE);
  const r1 = Math.floor((rect.bottom - 0.001) / TILE);
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      if (test(tileAt(level, col, row))) {
        return true;
      }
    }
  }
  return false;
}

/** The solid tiles a rectangle overlaps: [{ col, row, kind }]. */
function solidCells(level, rect) {
  const cells = [];
  const c0 = Math.floor(rect.left / TILE);
  const c1 = Math.floor((rect.right - 0.001) / TILE);
  const r0 = Math.floor(rect.top / TILE);
  const r1 = Math.floor((rect.bottom - 0.001) / TILE);
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      const kind = tileAt(level, col, row);
      if (isSolidKind(kind)) {
        cells.push({ col, row, kind });
      }
    }
  }
  return cells;
}

/** Is point `p` within `r` of rectangle `rect`? */
export function nearRect(p, rect, r) {
  const dx = Math.max(rect.left - p.x, 0, p.x - rect.right);
  const dy = Math.max(rect.top - p.y, 0, p.y - rect.bottom);
  return dx * dx + dy * dy < r * r;
}

export class MegaSlime {
  constructor() {
    this.state = 'ready'; // 'ready' (or resting, see cooldown) or 'mega'
    this.cooldown = 0;
    this.timeLeft = 0;
    // Where the giant's feet are (the middle of the bottom of its body).
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.facing = 1;
    this.walkTime = 0; // just for looks: how long it's been walking (swings the legs)
    this.input = { left: false, right: false };
    this.events = [];
  }

  get active() {
    return this.state === 'mega';
  }

  get ready() {
    return !this.active && this.cooldown <= 0;
  }

  /** The giant's body, as a rectangle. */
  get rect() {
    return this.rectAt(this.x, this.y);
  }

  rectAt(x, y) {
    return { left: x - MEGA_WIDTH / 2, right: x + MEGA_WIDTH / 2, top: y - MEGA_HEIGHT, bottom: y };
  }

  get center() {
    return { x: this.x, y: this.y - MEGA_HEIGHT / 2 };
  }

  /** The top and bottom of the giant (the slime's two ends sit there while it's Mega). */
  get head() {
    return { x: this.x, y: this.y - MEGA_HEIGHT + 14 };
  }

  get feet() {
    return { x: this.x, y: this.y - 14 };
  }

  /** Is the giant (at least partly) in lava? */
  inLava(level) {
    const r = this.rect;
    return rectTouches(level, { ...r, top: r.top + MEGA_HEIGHT * 0.4 }, k => k === TileKind.LAVA);
  }

  /**
   * Turn into Mega Slime around point `p` (the middle of the slime). The
   * giant needs room to stand there: if nothing nearby fits, nothing happens.
   * Returns true if it worked.
   */
  start(level, p) {
    if (!this.ready) {
      return false;
    }
    const fits = (x, y) => !rectTouches(level, this.rectAt(x, y), isSolidKind);
    for (let up = 0; up <= MEGA_HEIGHT; up += 6) {
      for (const side of [0, -8, 8, -16, 16, -26, 26, -36, 36]) {
        const x = p.x + side;
        const y = p.y + 14 - up;
        if (fits(x, y)) {
          this.state = 'mega';
          this.timeLeft = MEGA_TIME;
          this.x = x;
          this.y = y;
          this.vx = 0;
          this.vy = 0;
          this.onGround = false;
          this.input = { left: false, right: false };
          this.events.push('start');
          return true;
        }
      }
    }
    return false;
  }

  /** Jump! (You can jump off the ground, or swim up out of lava.) */
  jump(level) {
    if (!this.active || !(this.onGround || this.inLava(level))) {
      return false;
    }
    this.vy = -MEGA_JUMP;
    this.onGround = false;
    this.events.push('jump');
    return true;
  }

  /** Count down the rest time. Call every frame, Mega or not. */
  tick(dt) {
    if (!this.active) {
      this.cooldown = Math.max(0, this.cooldown - dt);
    }
  }

  /**
   * Walk, fall and jump for a frame. `smash(col, row, kind)` is called for a
   * breakable block in the way; it should break it (make the tile empty)
   * and return true. Returns true on the frame Mega Slime wears off.
   */
  update(dt, level, smash = () => false) {
    if (!this.active) {
      return false;
    }
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.end();
      return true;
    }
    const dir = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
    this.vx = dir * MEGA_WALK;
    if (dir) {
      this.facing = dir;
      this.walkTime += dt;
    }
    if (this.inLava(level)) {
      this.vy = Math.min(LAVA_SINK, this.vy + GRAVITY * LAVA_GRAVITY * dt);
    } else {
      this.vy = Math.min(MAX_FALL_SPEED, this.vy + GRAVITY * dt);
    }
    const steps = Math.max(1, Math.ceil(((Math.abs(this.vx) + Math.abs(this.vy)) * dt) / 4));
    // Breakable blocks in the way get smashed; anything else stops you.
    const blocked = rect =>
      solidCells(level, rect).some(c => !(isSmashable(c.kind) && smash(c.col, c.row, c.kind)));
    this.onGround = false;
    for (let i = 0; i < steps; i++) {
      const nx = this.x + (this.vx * dt) / steps;
      if (this.vx && !blocked(this.rectAt(nx, this.y))) {
        this.x = nx;
      }
      const ny = this.y + (this.vy * dt) / steps;
      if (this.vy > 0) {
        // Falling: land on anything solid (without breaking it), or on a one-way platform.
        const solid = rectTouches(level, this.rectAt(this.x, ny), isSolidKind);
        const platform = this.platformUnder(level, this.y, ny);
        if (solid || platform !== null) {
          this.y = platform !== null ? platform : Math.floor(ny / TILE) * TILE;
          this.vy = 0;
          this.onGround = true;
        } else {
          this.y = ny;
        }
      } else if (this.vy < 0) {
        // Going up: smash through breakable blocks overhead, bonk on anything else.
        if (blocked(this.rectAt(this.x, ny))) {
          this.vy = 0;
        } else {
          this.y = ny;
        }
      }
    }
    return false;
  }

  /** The top of a one-way platform the feet cross going from y0 down to y1, or null. */
  platformUnder(level, y0, y1) {
    const row = Math.floor(y1 / TILE);
    const top = row * TILE;
    if (y0 > top || y1 < top) {
      return null;
    }
    const r = this.rect;
    for (let col = Math.floor(r.left / TILE); col <= Math.floor((r.right - 0.001) / TILE); col++) {
      if (isPlatformKind(tileAt(level, col, row))) {
        return top;
      }
    }
    return null;
  }

  /**
   * What hurts Mega Slime right now: only liquids that aren't lava
   * ('drown'), and falling out of the world ('fell'). `fluid` is a rising
   * flood, if the level has one: { y, lava } (its top, and whether it's lava).
   */
  hurt(level, fluid = null) {
    const r = this.rect;
    const body = { ...r, top: r.top + 10, bottom: r.bottom - 4 };
    const wet = k => k === TileKind.WATER || k === TileKind.CHOCOLATE;
    if (rectTouches(level, body, wet)) {
      return 'drown';
    }
    if (fluid && !fluid.lava && body.bottom > fluid.y) {
      return 'drown';
    }
    return r.top > level.pixelHeight ? 'fell' : null;
  }

  /** Mega Slime wears off (or you lost a life): back to normal, and rest for a minute. */
  end() {
    if (!this.active) {
      return;
    }
    this.state = 'ready';
    this.timeLeft = 0;
    this.cooldown = MEGA_COOLDOWN;
    this.input = { left: false, right: false };
    this.events.push('end');
  }

  takeEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }
}

/**
 * While you're Mega, the slime itself rides along inside the giant: its two
 * ends sit at the giant's head and feet (held still, so nothing else moves
 * it), which is how it still picks things up and goes through the door.
 */
export function parkSlime(mega, slime) {
  slime.holdAt(mega.feet.x, mega.feet.y);
  slime.ends[1].x = mega.head.x;
  slime.ends[1].y = mega.head.y;
}

/**
 * Mega Slime wore off: you drop out of the giant as one double size slime
 * (`pieces` is your SlimePieces). Returns the slime.
 */
export function shrinkBack(mega, pieces) {
  const slime = pieces.active.slime;
  slime.spawn(mega.center);
  pieces.reset(slime);
  pieces.active.size = DOUBLE;
  return slime;
}

/**
 * Mega Slime walked or jumped into the breakable block at (col, row): break
 * it, using the thing it belongs to (`stuff`: the level's CanyonStuff,
 * HauntedStuff, JungleStuff and SkyStuff). Returns what it broke
 * ({ kind: 'box', index } for a metal box, so the game can drop out what was
 * inside), or null if it couldn't.
 */
export function smashBlock(level, col, row, { canyon, haunted, jungle, sky }) {
  const kind = tileAt(level, col, row);
  const at = t => t.col === col && t.row === row;
  if (kind === TileKind.BOX && canyon) {
    const index = canyon.boxes.findIndex(b => at(b) && !b.eaten);
    if (index >= 0) {
      canyon.smashBox(index);
      return { kind: 'box', index };
    }
  } else if (kind === TileKind.CRUMBLE && canyon) {
    const rock = canyon.crumbles.find(at);
    if (rock) {
      // It grows back later, like any crumbled rock.
      rock.state = 'gone';
      rock.timer = REGROW_TIME;
      level.tiles[row][col] = TileKind.EMPTY;
      return { kind: 'crumble' };
    }
  } else if (kind === TileKind.FLOORBOARD && haunted) {
    const board = haunted.boards.find(at);
    if (board) {
      board.state = 'gone';
      board.timer = BOARD_GONE;
      level.tiles[row][col] = TileKind.EMPTY;
      return { kind: 'floorboard' };
    }
  } else if (kind === TileKind.LEAFY && jungle) {
    const trap = jungle.traps.find(at);
    if (trap) {
      jungle.breakTrap(trap);
      return { kind: 'leafy' };
    }
  } else if (kind === TileKind.SLEEPY && sky) {
    const cloud = sky.clouds.find(c => c.state === 'asleep' && c.tiles.some(at));
    if (cloud) {
      sky.wakeCloud(cloud);
      return { kind: 'cloud' };
    }
  }
  return null;
}

/**
 * Smash every enemy Mega Slime is touching (its body is `rect`), using the
 * things they belong to (`stuff`). Bosses aren't in the list: they're much
 * too tough. Returns the spots where something got smashed.
 */
export function smashEnemies(rect, { island, jungle, computer, space, robots }) {
  const hits = [];
  const touching = (p, r) => nearRect(p, rect, r);
  for (const crab of island ? island.crabs : []) {
    if (crab.state !== 'smashed' && touching(crab, 18)) {
      // Squashed flat! It never gets up again.
      crab.state = 'smashed';
      crab.timer = Infinity;
      hits.push({ x: crab.x, y: crab.y });
    }
  }
  for (const m of jungle ? jungle.monkeys : []) {
    if (!(m.state === 'hiding' && m.timer === Infinity) && touching(m, 22)) {
      // So scared it hides in the leaves for good.
      m.state = 'hiding';
      m.timer = Infinity;
      hits.push({ x: m.x, y: m.y });
    }
  }
  for (const v of computer ? computer.viruses : []) {
    if (v.state !== 'deleted' && touching(v, 14)) {
      computer.shootAt({ x: v.x, y: v.y });
      hits.push({ x: v.x, y: v.y });
    }
  }
  for (const plant of space ? space.plants : []) {
    if (plant.state !== 'withered' && touching(plant, 20)) {
      space.wither(plant);
      hits.push({ x: plant.x, y: plant.y });
    }
  }
  if (robots) {
    const before = [...robots.arms, ...robots.patrols, ...robots.snipers].filter(r => !r.broken);
    robots.smashRobots(rect);
    for (const r of before) {
      if (r.broken) {
        hits.push({ x: r.x, y: r.y });
      }
    }
  }
  return hits;
}
