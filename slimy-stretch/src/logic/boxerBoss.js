import { END_RADIUS, TILE } from './constants.js';
import { dist } from './collision.js';
import { isSolidKind, TileKind, tileAt } from './level.js';
import { TONGUE_RADIUS } from './tongue.js';

// The Robot Factory boss: Boxer Bot. When you get to his arena he just looks
// like a giant metal box. Try to eat him with your tongue and his legs and
// arms pop out, and the fight starts!
//
// He walks around the arena and punches at you: he winds up (watch out!)
// and then punches at where you were. A punch hurts. But if his punch hits
// one of the metal boxes in the arena instead, the box breaks and he's
// stunned for a few seconds: quick, lick him with your tongue! That's one
// hit. Broken (or eaten) boxes come back after a while, so there's always
// something to trick him with. Hit him 3 times to win.
//
// After the first hit he also squeezes you if you get too close: he grabs
// you and squeezes so hard you go flying up toward the lava ceiling. You
// only survive that if you bump into something sticky on the way up, so
// keep your distance! After the second hit, every 20 seconds his fists
// glow for 20 seconds: glowing fists still break boxes, but he isn't
// stunned when they do.
//
// When he's beaten he leaves a metal crate behind. Eat it to get the last
// power core, and then the exit door opens.
//
// def.arena: { from: [col, row], to: [col, row] } is the rectangle he walks
// around in; its metal boxes (the ones with nothing inside) come back after
// they're broken or eaten.

export const BOXER_WIDTH = 2 * TILE;
export const BOXER_HEIGHT = 2 * TILE;
export const BOXER_SPEED = 70;
export const PUNCH_RANGE = 4 * TILE; // he starts a punch when you're this close to his shoulder
export const PUNCH_WINDUP = 0.7; // he pulls his fist back this long first, as a warning
export const PUNCH_SPEED = 900;
export const PUNCH_REACH = 4.5 * TILE; // how far his fist flies from his shoulder
export const FIST_RADIUS = 18;
const RETRACT_SPEED = 600;
export const PUNCH_REST = 1.2; // he rests this long between punches
export const STUN_TIME = 4; // punching a box makes him dizzy this long
export const BOX_RESPAWN = 6; // a broken or eaten arena box comes back after this long
export const SQUEEZE_RANGE = 1.5 * TILE; // get this close to him and he wants to squeeze you
export const SQUEEZE_WARN = 0.6; // he spreads his arms wide this long first, as a warning
export const SQUEEZE_HOLD = 0.6; // squeeeeeze...
export const SQUEEZE_SPEED = 1300; // ...and up you fly this fast...
export const SQUEEZE_SIDE = 220; // ...drifting a little away from him
const SQUEEZE_REST = 3;
export const FIST_CYCLE = 20; // in his last phase, his fists glow for 20 s every 20 s
const WAKE_TIME = 1.2; // legs and arms popping out
const HURT_TIME = 0.9; // after a hit he flashes and staggers back this long
const RESPAWN_GRACE = 2; // after you lose a life he waits this long before attacking

export class BoxerBoss {
  /**
   * `canyon` is the level's CanyonStuff: the arena's metal boxes are its
   * boxes, so the tongue can eat them and his punches can break them.
   */
  constructor(level, canyon) {
    this.level = level;
    this.canyon = canyon;
    // R marks the middle of the giant box; he stands on the floor under it.
    this.homeX = level.robot.x;
    const col = Math.floor(level.robot.x / TILE);
    let row = Math.floor(level.robot.y / TILE) + 1;
    while (row < level.height && !isSolidKind(tileAt(level, col, row))) {
      row++;
    }
    this.floorY = row * TILE;
    const arena = level.def.arena || { from: [0, 0], to: [level.width - 1, level.height - 1] };
    const [c0, c1] = [arena.from[0], arena.to[0]].sort((a, b) => a - b);
    const [r0, r1] = [arena.from[1], arena.to[1]].sort((a, b) => a - b);
    this.arena = {
      left: c0 * TILE,
      right: (c1 + 1) * TILE,
      top: r0 * TILE,
      bottom: (r1 + 1) * TILE,
    };
    // The arena's boxes with nothing inside come back after they're broken.
    this.arenaBoxes = canyon.boxes
      .map((b, i) => i)
      .filter(i => {
        const b = canyon.boxes[i];
        return !b.item && this.inArena(b);
      });
    this.respawn = new Map(); // arena box index -> seconds until it comes back
    this.hp = 3;
    this.state = 'box'; // asleep, looking like a giant metal box
    this.x = this.homeX;
    this.facing = -1;
    this.timer = 0;
    this.punchRest = 0;
    this.squeezeRest = 0;
    this.fist = this.shoulder();
    this.aim = null;
    this.fistTime = 0; // seconds into his last phase (for the glowing fists)
    this.glowing = false;
    this.crate = null; // the crate he leaves behind: { x, y, eaten }
    this.events = [];
  }

  get phase() {
    return Math.min(3, 4 - this.hp);
  }

  get defeated() {
    return this.hp <= 0;
  }

  get awake() {
    return this.state !== 'box';
  }

  /** The middle of his body. */
  get y() {
    return this.floorY - BOXER_HEIGHT / 2;
  }

  /** His body, as a rectangle. */
  get body() {
    return {
      left: this.x - BOXER_WIDTH / 2,
      right: this.x + BOXER_WIDTH / 2,
      top: this.floorY - BOXER_HEIGHT,
      bottom: this.floorY,
    };
  }

  /** Are his fists glowing (invincible) right now? Only in his last phase. */
  get invincible() {
    return this.phase === 3 && this.fistTime % (FIST_CYCLE * 2) >= FIST_CYCLE;
  }

  inArena(p) {
    const a = this.arena;
    return p.x >= a.left && p.x < a.right && p.y >= a.top && p.y < a.bottom;
  }

  /** Where his punching arm comes out of: the side facing you. */
  shoulder() {
    return { x: this.x + (this.facing * BOXER_WIDTH) / 2, y: this.floorY - BOXER_HEIGHT * 0.6 };
  }

  /** How far point `p` is from his body (0 if it's inside). */
  distToBody(p) {
    const b = this.body;
    const dx = Math.max(b.left - p.x, 0, p.x - b.right);
    const dy = Math.max(b.top - p.y, 0, p.y - b.bottom);
    return Math.hypot(dx, dy);
  }

  /** Is point `p` touching his body (grown by `pad`)? */
  touches(p, pad = 0) {
    return this.distToBody(p) < pad;
  }

  /** Advance the fight. Returns 'punch' if the slime got hurt, otherwise null. */
  update(dt, slime) {
    this.updateBoxes(dt, slime);
    if (this.state === 'box' || this.defeated) {
      return null;
    }
    this.punchRest = Math.max(0, this.punchRest - dt);
    this.squeezeRest = Math.max(0, this.squeezeRest - dt);
    if (this.phase === 3) {
      this.fistTime += dt;
      if (this.invincible !== this.glowing) {
        this.glowing = this.invincible;
        this.events.push(this.glowing ? 'glowOn' : 'glowOff');
      }
    }
    const pts = slime.frozen ? [] : slime.bodyPoints(8);
    const target = pts.length ? slime.center : null;
    this.timer -= dt;
    switch (this.state) {
      case 'wake':
        if (this.timer <= 0) {
          this.state = 'walk';
          this.punchRest = 0.8;
        }
        return null;
      case 'walk':
        return this.updateWalk(dt, slime, pts, target);
      case 'windup':
        this.fist = this.pulledBack();
        if (this.timer <= 0) {
          this.state = 'punch';
          this.fist = this.shoulder();
          this.events.push('punch');
        }
        return null;
      case 'punch':
        return this.updatePunch(dt, slime, pts);
      case 'retract':
        return this.updateRetract(dt);
      case 'stunned':
        this.fist = this.shoulder();
        if (this.timer <= 0) {
          this.state = 'walk';
          this.punchRest = PUNCH_REST;
          this.events.push('recover');
        }
        return null;
      case 'hurt':
        if (this.timer <= 0) {
          this.state = 'walk';
          this.punchRest = PUNCH_REST;
        }
        return null;
      case 'squeezeWarn':
        return this.updateSqueezeWarn(slime, pts);
      case 'squeeze':
        return this.updateSqueeze(slime);
      default:
        return null;
    }
  }

  // ---------------------------------------------------------------- walking

  updateWalk(dt, slime, pts, target) {
    this.fist = this.shoulder();
    if (!target || !this.inArena(target)) {
      return null;
    }
    this.facing = target.x < this.x ? -1 : 1;
    // Too close? In his second and third phase he squeezes you.
    const close = pts.some(p => this.distToBody(p) < SQUEEZE_RANGE);
    if (this.phase >= 2 && close && this.squeezeRest <= 0) {
      this.state = 'squeezeWarn';
      this.timer = SQUEEZE_WARN;
      this.events.push('squeezeWarn');
      return null;
    }
    const shoulder = this.shoulder();
    if (dist(shoulder, target) < PUNCH_RANGE) {
      if (this.punchRest <= 0) {
        // He pulls back to punch where you are right now: move and he misses!
        this.state = 'windup';
        this.timer = PUNCH_WINDUP;
        this.aim = { x: target.x, y: target.y };
        this.events.push('windup');
      }
      return null;
    }
    this.walkToward(target.x, dt);
    return null;
  }

  /** Walk toward `x`, staying in the arena and not walking through walls or boxes. */
  walkToward(x, dt) {
    const step = Math.sign(x - this.x) * Math.min(Math.abs(x - this.x), BOXER_SPEED * dt);
    const nx = Math.max(
      this.arena.left + BOXER_WIDTH / 2,
      Math.min(this.arena.right - BOXER_WIDTH / 2, this.x + step)
    );
    if (!this.bodyHitsSolid(nx)) {
      this.x = nx;
    }
  }

  /** Would his body bump into anything solid if he stood at `x`? */
  bodyHitsSolid(x) {
    const c0 = Math.floor((x - BOXER_WIDTH / 2 + 1) / TILE);
    const c1 = Math.floor((x + BOXER_WIDTH / 2 - 1) / TILE);
    const r0 = Math.floor((this.floorY - BOXER_HEIGHT + 1) / TILE);
    const r1 = Math.floor((this.floorY - 1) / TILE);
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        if (isSolidKind(tileAt(this.level, col, row))) {
          return true;
        }
      }
    }
    return false;
  }

  // -------------------------------------------------------------- punching

  /** His fist pulled back behind his shoulder, winding up. */
  pulledBack() {
    const s = this.shoulder();
    const d = dist(s, this.aim) || 1;
    const k = 1 - Math.max(0, this.timer) / PUNCH_WINDUP;
    return {
      x: s.x - ((this.aim.x - s.x) / d) * 22 * k,
      y: s.y - ((this.aim.y - s.y) / d) * 22 * k,
    };
  }

  updatePunch(dt, slime, pts) {
    const s = this.shoulder();
    const d = dist(s, this.aim) || 1;
    const ux = (this.aim.x - s.x) / d;
    const uy = (this.aim.y - s.y) / d;
    const steps = Math.max(1, Math.ceil((PUNCH_SPEED * dt) / 6));
    for (let i = 0; i < steps; i++) {
      this.fist = {
        x: this.fist.x + (ux * PUNCH_SPEED * dt) / steps,
        y: this.fist.y + (uy * PUNCH_SPEED * dt) / steps,
      };
      const box = this.boxUnderFist();
      if (box >= 0) {
        // CRASH! He punched a metal box.
        this.canyon.smashBox(box, slime);
        this.respawn.set(box, BOX_RESPAWN);
        this.events.push('boxBreak');
        if (this.invincible) {
          // Glowing fists: it doesn't hurt him one bit.
          this.state = 'retract';
          this.events.push('noStun');
        } else {
          this.state = 'stunned';
          this.timer = STUN_TIME;
          this.events.push('stunned');
        }
        return null;
      }
      if (pts.some(p => dist(p, this.fist) < FIST_RADIUS + END_RADIUS * 0.6)) {
        this.state = 'retract';
        this.events.push('whack');
        return 'punch';
      }
      const hitWall = isSolidKind(
        tileAt(this.level, Math.floor(this.fist.x / TILE), Math.floor(this.fist.y / TILE))
      );
      if (hitWall || dist(this.fist, s) >= PUNCH_REACH) {
        this.state = 'retract';
        if (hitWall) {
          this.events.push('clang');
        }
        return null;
      }
    }
    return null;
  }

  /** The arena box (or any metal box) his fist is touching, or -1. */
  boxUnderFist() {
    const f = this.fist;
    return this.canyon.boxes.findIndex(b => {
      if (b.eaten) {
        return false;
      }
      const cx = Math.max(b.col * TILE, Math.min(f.x, (b.col + 1) * TILE));
      const cy = Math.max(b.row * TILE, Math.min(f.y, (b.row + 1) * TILE));
      return Math.hypot(f.x - cx, f.y - cy) < FIST_RADIUS;
    });
  }

  updateRetract(dt) {
    const s = this.shoulder();
    const d = dist(this.fist, s);
    const step = RETRACT_SPEED * dt;
    if (d <= step) {
      this.fist = s;
      this.state = 'walk';
      this.punchRest = PUNCH_REST;
    } else {
      this.fist = {
        x: this.fist.x + ((s.x - this.fist.x) / d) * step,
        y: this.fist.y + ((s.y - this.fist.y) / d) * step,
      };
    }
    return null;
  }

  // ------------------------------------------------------------- squeezing

  updateSqueezeWarn(slime, pts) {
    if (this.timer > 0) {
      return null;
    }
    if (pts.some(p => this.distToBody(p) < SQUEEZE_RANGE)) {
      // Got you! Squeeeeeze...
      this.state = 'squeeze';
      this.timer = SQUEEZE_HOLD;
      this.squeezeSide = slime.center.x < this.x ? -1 : 1;
      slime.holdAt(this.x + this.squeezeSide * (BOXER_WIDTH / 2 + 6), this.y - 10);
      this.events.push('squeeze');
    } else {
      // You got away in time.
      this.state = 'walk';
      this.squeezeRest = SQUEEZE_REST / 2;
    }
    return null;
  }

  updateSqueeze(slime) {
    const at = { x: this.x + this.squeezeSide * (BOXER_WIDTH / 2 + 6), y: this.y - 10 };
    slime.holdAt(at.x, at.y);
    if (this.timer > 0) {
      return null;
    }
    // POP! Up you go, toward the lava. You stick to the first sticky thing you bump into.
    this.state = 'walk';
    this.squeezeRest = SQUEEZE_REST;
    this.punchRest = PUNCH_REST;
    slime.launch(at.x, at.y, this.squeezeSide * SQUEEZE_SIDE, -SQUEEZE_SPEED);
    this.events.push('launch');
    return null;
  }

  // ------------------------------------------------------------ the tongue

  /**
   * The tongue tip at `tip` touched him. Returns what happened: 'wake' (he
   * was a sleeping box), 'hit' (he was stunned: one hit!), 'clang' (not
   * now!) or null if the tip isn't touching him.
   */
  lick(tip) {
    if (this.defeated || !this.touches(tip, TONGUE_RADIUS + 4)) {
      return null;
    }
    if (this.state === 'box') {
      // Legs and arms pop out of the box!
      this.state = 'wake';
      this.timer = WAKE_TIME;
      this.events.push('wake');
      return 'wake';
    }
    if (this.state === 'stunned') {
      this.hit();
      return 'hit';
    }
    return 'clang';
  }

  hit() {
    this.hp--;
    this.fist = this.shoulder();
    if (this.hp <= 0) {
      this.state = 'defeated';
      // He leaves a metal crate behind, with the last power core inside.
      this.crate = { x: this.x, y: this.floorY - TILE / 2, eaten: false };
      this.events.push('defeated');
      return;
    }
    this.state = 'hurt';
    this.timer = HURT_TIME;
    this.fistTime = 0;
    this.glowing = false;
    this.events.push('hit');
  }

  /** The tongue tip at `tip` touched the crate he left behind: eat it! Returns true if it did. */
  eatCrate(tip) {
    const c = this.crate;
    if (!c || c.eaten) {
      return false;
    }
    const dx = Math.max(Math.abs(tip.x - c.x) - TILE / 2, 0);
    const dy = Math.max(Math.abs(tip.y - c.y) - TILE / 2, 0);
    if (Math.hypot(dx, dy) >= TONGUE_RADIUS + 6) {
      return false;
    }
    c.eaten = true;
    this.events.push('crate');
    return true;
  }

  // ------------------------------------------------------------ arena boxes

  updateBoxes(dt, slime) {
    for (const i of this.arenaBoxes) {
      const box = this.canyon.boxes[i];
      if (!box.eaten) {
        this.respawn.delete(i);
        continue;
      }
      if (!this.respawn.has(i)) {
        // Eaten by the tongue: that one comes back too.
        this.respawn.set(i, BOX_RESPAWN);
      }
      const left = this.respawn.get(i) - dt;
      this.respawn.set(i, left);
      if (left <= 0 && this.canRespawn(box, slime)) {
        this.respawnBox(i);
      }
    }
  }

  /** A box can only come back if nothing's in the way (not the slime, and not him). */
  canRespawn(box, slime) {
    const rect = {
      left: box.col * TILE,
      right: (box.col + 1) * TILE,
      top: box.row * TILE,
      bottom: (box.row + 1) * TILE,
    };
    const near = (p, r) => {
      const dx = Math.max(rect.left - p.x, 0, p.x - rect.right);
      const dy = Math.max(rect.top - p.y, 0, p.y - rect.bottom);
      return dx * dx + dy * dy < r * r;
    };
    const b = this.body;
    const overlapsBoss =
      !this.defeated &&
      rect.left < b.right &&
      rect.right > b.left &&
      rect.top < b.bottom &&
      rect.bottom > b.top;
    return !overlapsBoss && !slime.bodyPoints(8).some(p => near(p, END_RADIUS));
  }

  respawnBox(i) {
    const box = this.canyon.boxes[i];
    box.eaten = false;
    box.smashed = false;
    this.level.tiles[box.row][box.col] = TileKind.BOX;
    this.respawn.delete(i);
    this.events.push('boxBack');
  }

  /**
   * After the slime really dies he keeps his damage (each hit is a
   * checkpoint), but goes back to where he started, waits a moment, and the
   * arena's boxes all come back. His glowing fists start over too.
   */
  resetAfterSlimeDeath() {
    for (const i of this.arenaBoxes) {
      if (this.canyon.boxes[i].eaten) {
        this.respawnBox(i);
      }
    }
    this.respawn.clear();
    if (this.state === 'box' || this.defeated) {
      return;
    }
    this.x = this.homeX;
    this.state = 'walk';
    this.punchRest = RESPAWN_GRACE;
    this.squeezeRest = RESPAWN_GRACE;
    this.fistTime = 0;
    this.glowing = false;
    this.fist = this.shoulder();
  }

  takeEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }
}
