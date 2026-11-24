import { END_RADIUS, GRAVITY, MAX_FALL_SPEED, TILE } from './constants.js';
import { circleHitsSolid, dist } from './collision.js';
import { TileKind } from './level.js';
import { BELT_SPEED } from './warehouse.js';

// The factory boss: a giant machine that never moves. A conveyor belt comes
// out of its mouth and it keeps feeding bomb boxes onto it, while crushers
// stamp down over the belt.
//
// To hurt it: shoot a blob of slime into its mouth. That runs the belt
// backwards, so the next bomb box rides right back into its mouth. Gulp! The
// mouth slams shut and you have a few seconds to climb up and press the big
// button on top. Press it 3 times to win.
//
// After the first press it roars, sends you back to the start and shoots
// fireballs (they blow up bomb boxes, and hurt). After the second press it
// adds another crusher and feeds out blocks of ice too.

export const CRATE_SIZE = 36;
export const FIREBALL_RADIUS = 12;
export const EXPLOSION_RADIUS = 64;
export const CRUSHER_WIDTH = TILE * 1.6;
export const CRUSHER_HEIGHT = 40;
export const BUTTON_RADIUS = 26;

const CRATE_EVERY = [0, 3, 2.6, 2.2]; // seconds between boxes, by phase
const REVERSE_TIME = 8; // how long a slime shot keeps the belt running backwards
const BUTTON_TIME = 7; // how long the mouth stays shut so you can press the button
const FIREBALL_EVERY = 2.6;
const FIREBALL_SPEED = 330;
const CRUSHER_UP = 1.6;
const CRUSHER_WARN = 0.7;
const CRUSHER_HOLD = 0.4;
const CRUSHER_SLAM_SPEED = 900;
const CRUSHER_RISE_SPEED = 220;
const CRUSHER_RISE = 3 * TILE; // how high a crusher waits above the belt

export class BigMachine {
  constructor(level) {
    this.level = level;
    const def = level.def;
    // R marks the mouth, right where the belt goes into the machine.
    this.mouth = { x: level.robot.x, y: level.robot.y };
    this.mouthCol = Math.floor(this.mouth.x / TILE);
    this.beltRow = Math.floor(this.mouth.y / TILE) + 1;
    this.beltTop = this.beltRow * TILE;
    let from = this.mouthCol;
    const isBelt = col => {
      const k = level.tiles[this.beltRow][col];
      return k === TileKind.BELT_LEFT || k === TileKind.BELT_RIGHT;
    };
    while (from > 0 && isBelt(from - 1)) {
      from--;
    }
    this.beltFrom = from;
    this.beltTo = this.mouthCol;
    const [bcol, brow] = def.button;
    this.button = { x: (bcol + 0.5) * TILE, y: (brow + 0.5) * TILE + 12 };
    this.crushers = (def.crushers || []).map((col, i) => ({
      x: (col + 0.5) * TILE,
      y: this.beltTop - CRUSHER_RISE,
      state: 'up',
      timer: CRUSHER_UP + i * 0.8,
      // The second crusher only joins in for the last part of the fight.
      fromPhase: i === 0 ? 1 : 3,
    }));
    this.hp = 3;
    this.events = [];
    this.reset();
  }

  get phase() {
    return Math.min(3, 4 - this.hp);
  }

  get defeated() {
    return this.hp <= 0;
  }

  /** Belt direction: -1 carries things away from the machine, 1 back into it. */
  get beltDir() {
    return this.reverseTimer > 0 ? 1 : -1;
  }

  reset() {
    this.mouthOpen = true;
    this.reverseTimer = 0;
    this.buttonTimer = 0;
    this.crateTimer = 1.5;
    this.fireTimer = FIREBALL_EVERY;
    this.spawned = 0;
    this.crates = [];
    this.fireballs = [];
    this.explosions = [];
    this.sendBack = false;
    this.setBelt(-1);
    for (const c of this.crushers) {
      c.state = 'up';
      c.y = this.beltTop - CRUSHER_RISE;
      c.timer = CRUSHER_UP;
    }
  }

  /** Point the belt tiles the right way, so they carry the slime too. */
  setBelt(dir) {
    const kind = dir > 0 ? TileKind.BELT_RIGHT : TileKind.BELT_LEFT;
    for (let col = this.beltFrom; col <= this.beltTo; col++) {
      if (this.level.tiles[this.beltRow][col] !== kind) {
        this.level.tiles[this.beltRow][col] = kind;
      }
    }
  }

  /** The slime-shot blobs that fly into the open mouth (the game gives them back). */
  catchBlobs(blobs) {
    let caught = false;
    for (const b of blobs) {
      const inMouth =
        Math.abs(b.x - this.mouth.x) < TILE * 0.6 && Math.abs(b.y - this.mouth.y) < TILE * 0.6;
      if ((b.state === 'flying' || b.state === 'falling') && inMouth && this.mouthOpen) {
        b.gone = true;
        caught = true;
      }
    }
    if (caught) {
      this.reverseTimer = REVERSE_TIME;
      this.setBelt(1);
      this.events.push('reverse');
    }
    return caught;
  }

  /** Advance the fight. Returns true if the slime got hurt. */
  update(dt, slime) {
    if (this.defeated) {
      this.updateExplosions(dt);
      return false;
    }
    const pts = slime.bodyPoints(10);
    let hurt = false;

    if (this.reverseTimer > 0) {
      this.reverseTimer -= dt;
      if (this.reverseTimer <= 0) {
        this.setBelt(-1);
        this.events.push('forward');
      }
    }
    if (!this.mouthOpen) {
      this.buttonTimer -= dt;
      if (this.buttonTimer <= 0) {
        this.mouthOpen = true;
        this.events.push('reopen');
      }
    }

    // Feed out a new box now and then (only while the belt runs forward).
    this.crateTimer -= dt;
    if (this.crateTimer <= 0 && this.mouthOpen && this.beltDir < 0) {
      this.crateTimer = CRATE_EVERY[this.phase];
      this.spawned++;
      const ice = this.phase >= 3 && this.spawned % 2 === 0;
      this.crates.push({
        x: this.mouth.x - TILE * 0.5,
        y: this.beltTop - CRATE_SIZE / 2,
        vy: 0,
        kind: ice ? 'ice' : 'bomb',
        state: 'belt',
      });
      this.events.push('crate');
    }

    hurt = this.updateCrates(dt, slime) || hurt;
    hurt = this.updateCrushers(dt, pts) || hurt;
    hurt = this.updateFireballs(dt, slime, pts) || hurt;
    this.updateExplosions(dt);
    if (this.explosions.some(e => e.age < 0.15 && pts.some(p => dist(p, e) < EXPLOSION_RADIUS))) {
      hurt = true;
    }

    // Press the button while the mouth is shut.
    if (!this.mouthOpen && this.buttonTimer > 0 && !slime.frozen) {
      if (pts.some(p => dist(p, this.button) < BUTTON_RADIUS + END_RADIUS * 0.6)) {
        this.pressButton();
      }
    }
    return hurt;
  }

  updateCrates(dt, slime) {
    const left = this.beltFrom * TILE;
    for (const c of this.crates) {
      if (c.state === 'belt') {
        c.x += this.beltDir * BELT_SPEED * 1.4 * dt;
        if (c.x < left - CRATE_SIZE / 2) {
          // Off the end of the belt it falls...
          c.state = 'falling';
        } else if (this.beltDir > 0 && c.x > this.mouth.x - TILE * 0.3) {
          c.gone = true;
          if (c.kind === 'bomb' && this.mouthOpen) {
            // Gulp! A bomb box went back into its mouth.
            this.mouthOpen = false;
            this.buttonTimer = BUTTON_TIME;
            this.reverseTimer = 0;
            this.setBelt(-1);
            this.events.push('gulp');
          }
        }
      } else {
        c.vy = Math.min(MAX_FALL_SPEED, c.vy + GRAVITY * dt);
        c.y += c.vy * dt;
        // ...and a bomb box goes boom when it lands.
        if (circleHitsSolid(this.level, c, CRATE_SIZE / 2) || c.y > this.level.pixelHeight) {
          c.gone = true;
          if (c.kind === 'bomb') {
            this.explode(c);
          }
        }
      }
      // Ice is slippery: anything stuck where it slides past lets go.
      if (c.kind === 'ice' && !c.gone && !slime.isFalling && !slime.frozen) {
        const touching = slime.ends.some(
          e => e.state === 'stuck' && dist(e, c) < CRATE_SIZE / 2 + END_RADIUS
        );
        if (touching) {
          slime.knockLoose(0, 0);
          this.events.push('slip');
        }
      }
    }
    this.crates = this.crates.filter(c => !c.gone);
    return false;
  }

  updateCrushers(dt, pts) {
    let hurt = false;
    const restY = this.beltTop - CRUSHER_RISE;
    const downY = this.beltTop - CRUSHER_HEIGHT;
    for (const c of this.crushers) {
      if (this.phase < c.fromPhase) {
        continue;
      }
      if (c.state === 'up') {
        c.timer -= dt;
        if (c.timer <= 0) {
          c.state = 'warn';
          c.timer = CRUSHER_WARN;
        }
      } else if (c.state === 'warn') {
        c.timer -= dt;
        if (c.timer <= 0) {
          c.state = 'slam';
        }
      } else if (c.state === 'slam') {
        c.y = Math.min(downY, c.y + CRUSHER_SLAM_SPEED * dt);
        if (c.y >= downY) {
          c.state = 'hold';
          c.timer = CRUSHER_HOLD;
          this.events.push('stomp');
          // Squash! Any bomb box under it blows up.
          for (const crate of this.crates) {
            if (Math.abs(crate.x - c.x) < CRUSHER_WIDTH / 2 && crate.state === 'belt') {
              crate.gone = true;
              if (crate.kind === 'bomb') {
                this.explode(crate);
              }
            }
          }
        }
      } else if (c.state === 'hold') {
        c.timer -= dt;
        if (c.timer <= 0) {
          c.state = 'rise';
        }
      } else if (c.state === 'rise') {
        c.y = Math.max(restY, c.y - CRUSHER_RISE_SPEED * dt);
        if (c.y <= restY) {
          c.state = 'up';
          c.timer = CRUSHER_UP;
        }
      }
      if (c.state === 'slam' || c.state === 'hold') {
        const under = pts.some(
          p =>
            Math.abs(p.x - c.x) < CRUSHER_WIDTH / 2 + END_RADIUS * 0.5 &&
            p.y > c.y - END_RADIUS &&
            p.y < c.y + CRUSHER_HEIGHT + END_RADIUS
        );
        hurt = hurt || under;
      }
    }
    return hurt;
  }

  updateFireballs(dt, slime, pts) {
    let hurt = false;
    if (this.phase >= 2 && !slime.frozen) {
      this.fireTimer -= dt;
      if (this.fireTimer <= 0) {
        this.fireTimer = FIREBALL_EVERY;
        const from = { x: this.mouth.x - TILE * 0.3, y: this.mouth.y - 8 };
        const target = slime.center;
        const d = dist(from, target) || 1;
        this.fireballs.push({
          x: from.x,
          y: from.y,
          vx: ((target.x - from.x) / d) * FIREBALL_SPEED,
          vy: ((target.y - from.y) / d) * FIREBALL_SPEED,
          age: 0,
        });
        this.events.push('fire');
      }
    }
    for (const f of this.fireballs) {
      f.age += dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (pts.some(p => dist(p, f) < FIREBALL_RADIUS + END_RADIUS * 0.6)) {
        hurt = true;
        f.gone = true;
      }
      // A fireball sets off any bomb box it hits.
      for (const crate of this.crates) {
        if (
          !crate.gone &&
          crate.kind === 'bomb' &&
          dist(crate, f) < CRATE_SIZE / 2 + FIREBALL_RADIUS
        ) {
          crate.gone = true;
          f.gone = true;
          this.explode(crate);
        }
      }
      const away = f.age > 1.5 || dist(f, this.mouth) > TILE * 2;
      if ((away && circleHitsSolid(this.level, f, FIREBALL_RADIUS)) || f.age > 6) {
        f.gone = true;
      }
    }
    this.fireballs = this.fireballs.filter(f => !f.gone);
    this.crates = this.crates.filter(c => !c.gone);
    return hurt;
  }

  explode(p) {
    this.explosions.push({ x: p.x, y: p.y, age: 0 });
    this.events.push('explode');
  }

  updateExplosions(dt) {
    for (const e of this.explosions) {
      e.age += dt;
    }
    this.explosions = this.explosions.filter(e => e.age < 0.5);
  }

  pressButton() {
    this.hp -= 1;
    if (this.defeated) {
      this.crates = [];
      this.fireballs = [];
      this.events.push('defeated');
      return;
    }
    // It roars and sends you right back to the beginning.
    this.events.push('hit');
    const hp = this.hp;
    this.reset();
    this.hp = hp;
    this.sendBack = true;
  }

  /** Each button press is a checkpoint: the machine keeps its damage. */
  resetAfterSlimeDeath() {
    const hp = this.hp;
    this.reset();
    this.hp = hp;
  }

  takeEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }
}
