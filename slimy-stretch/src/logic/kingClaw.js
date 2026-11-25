import { END_RADIUS, GRAVITY, MAX_FALL_SPEED, TILE } from './constants.js';
import { circleHitsSolid, dist, isTouchingSticky } from './collision.js';
import { isSolidKind, TileKind, tileAt } from './level.js';
import { TONGUE_RADIUS } from './tongue.js';

// The Candyland boss: King Claw, a grumpy giant claw machine. His head hangs
// from the top of the arena on a wire, and his hands are giant claws.
//
// Each hand takes a turn: it chases the slime along the top, stops and
// wiggles (watch out!), then drops down to grab. If it grabs you it carries
// you up to his mouth and he eats you (ouch!). If it misses, it's stuck on
// the ground for a moment, dizzy: lick it with your tongue to eat it!
//
// Once all of his hands are eaten his head falls down to the floor with his
// mouth wide open. Shoot a blob of slime into his mouth to hurt him, and he
// goes back up with one more hand than before. Too slow, and he goes back up
// with all his hands back. Hit him 3 times to win.
//
// After the first hit he also drops bombs. After the second hit the walls
// turn to ice (def.iceWalls says which), so you can't stick to them.

export const HAND_RADIUS = 30;
export const HAND_SPEED = 170; // how fast a hand chases you along the top
const HAND_HOME_SPEED = 240;
export const CHASE_TIME = 1.8;
export const HAND_WARN = 0.7; // it stops and wiggles this long before it drops
export const HAND_DROP_SPEED = 650;
export const HAND_STUCK = 2.5; // a hand that missed is stuck (and dizzy) this long
const HAND_RISE_SPEED = 220;
const CARRY_SPEED = 320;
const ATTACK_GAP = 1.2; // seconds between one hand's drop and the next hand's turn
const FIRST_ATTACK = 2.5;

export const HEAD_WIDTH = 124;
export const HEAD_HEIGHT = 100;
export const MOUTH_RADIUS = 36;
export const HEAD_WOBBLE = 1.2; // the head shakes this long before it falls (get out from under!)
const HEAD_FALL_SPEED = 600;
export const HEAD_DOWN = 5; // it stays down this long, mouth open
const HEAD_RISE_SPEED = 260;

export const BOMB_EVERY = 3;
export const BOMB_FUSE = 2.2;
export const BOMB_RADIUS = 13;
export const BLAST_RADIUS = 64;

/** How many hands King Claw has in each phase: 2, then 3, then 4. */
export function handsFor(phase) {
  return phase + 1;
}

export class KingClaw {
  constructor(level) {
    this.level = level;
    // R marks where his head hangs.
    this.homeY = level.robot.y;
    this.x = level.robot.x;
    const col = Math.floor(this.x / TILE);
    let row = Math.floor(this.homeY / TILE) + 1;
    while (row < level.height && !isSolidKind(tileAt(level, col, row))) {
      row++;
    }
    this.floorY = row * TILE;
    this.downY = this.floorY - HEAD_HEIGHT / 2;
    this.trackY = TILE + HAND_RADIUS + 6; // the hands move along just under the top
    this.minX = TILE + HAND_RADIUS;
    this.maxX = level.pixelWidth - TILE - HAND_RADIUS;
    this.iceRects = level.def.iceWalls || [];
    this.iced = []; // wall tiles that have turned to ice
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

  /** The middle of his mouth (it's wide open while his head is down). */
  get mouth() {
    return { x: this.x, y: this.y + HEAD_HEIGHT * 0.1 };
  }

  reset() {
    this.y = this.homeY;
    this.state = 'up';
    this.timer = 0;
    this.attackTimer = FIRST_ATTACK;
    this.bombTimer = BOMB_EVERY;
    this.bombs = [];
    this.explosions = [];
    this.chomp = 0;
    this.sendBack = false;
    this.spawnHands(true);
  }

  /** A fresh set of hands for this phase, spread out along the top. */
  spawnHands(atHome = false) {
    const n = handsFor(this.phase);
    this.hands = [];
    for (let i = 0; i < n; i++) {
      const home = this.minX + ((i + 0.5) * (this.maxX - this.minX)) / n;
      this.hands.push({
        home,
        // New hands come out of his head and fly to their spots.
        x: atHome ? home : this.x,
        y: atHome ? this.trackY : this.homeY,
        state: atHome ? 'wait' : 'home',
        timer: 0,
        dropTo: 0,
      });
    }
    this.nextHand = 0;
  }

  /** Advance the fight. Returns 'kingclaw' or 'bomb' if the slime got hurt, otherwise null. */
  update(dt, slime) {
    this.chomp = Math.max(0, this.chomp - dt);
    this.updateExplosions(dt);
    if (this.defeated) {
      return null;
    }
    if (this.justIced) {
      this.justIced = false;
      this.slipOff(slime);
    }
    const free = !slime.frozen;
    const pts = free ? slime.bodyPoints(8) : [];
    let hurt = this.updateHead(dt, pts);
    if (this.state === 'up') {
      hurt = this.updateHands(dt, slime, pts) || hurt;
      this.updateBombTimer(dt);
    }
    hurt = this.updateBombs(dt, pts) || hurt;
    return hurt;
  }

  // ------------------------------------------------------------------- head

  updateHead(dt, pts) {
    if (this.state === 'wobble') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.state = 'fall';
      }
    } else if (this.state === 'fall') {
      this.y = Math.min(this.downY, this.y + HEAD_FALL_SPEED * dt);
      if (pts.some(p => this.inHead(p, END_RADIUS * 0.5))) {
        return 'kingclaw';
      }
      if (this.y >= this.downY) {
        this.state = 'down';
        this.timer = HEAD_DOWN;
        this.events.push('thud');
      }
    } else if (this.state === 'down') {
      this.timer -= dt;
      if (this.timer <= 0) {
        // Too slow! Back up he goes, with all his hands back.
        this.state = 'rise';
        this.events.push('tooSlow');
      }
    } else if (this.state === 'rise') {
      this.y = Math.max(this.homeY, this.y - HEAD_RISE_SPEED * dt);
      if (this.y <= this.homeY) {
        this.state = 'up';
        this.attackTimer = FIRST_ATTACK;
        this.bombTimer = BOMB_EVERY;
        this.spawnHands();
        this.events.push('hands');
      }
    }
    return null;
  }

  /** Is point `p` inside his head (grown by `pad`)? */
  inHead(p, pad = 0) {
    return (
      Math.abs(p.x - this.x) < HEAD_WIDTH / 2 + pad &&
      Math.abs(p.y - this.y) < HEAD_HEIGHT / 2 + pad
    );
  }

  /** The slime-shot blobs that fly into his open mouth (the game gives them back). */
  catchBlobs(blobs) {
    if (this.state !== 'down') {
      return false;
    }
    const b = blobs.find(
      b => (b.state === 'flying' || b.state === 'falling') && dist(b, this.mouth) < MOUTH_RADIUS
    );
    if (!b) {
      return false;
    }
    b.gone = true;
    this.hit();
    return true;
  }

  hit() {
    this.hp -= 1;
    this.chomp = 0.6;
    this.bombs = [];
    if (this.defeated) {
      this.hands = [];
      this.events.push('defeated');
      return;
    }
    this.events.push('hit');
    this.state = 'rise';
    if (this.phase === 3) {
      this.freezeWalls();
    }
  }

  /** Brrr! The walls in def.iceWalls turn to slippery ice. */
  freezeWalls() {
    const tiles = this.level.tiles;
    for (const rect of this.iceRects) {
      const [c0, c1] = [rect.from[0], rect.to[0]].sort((a, b) => a - b);
      const [r0, r1] = [rect.from[1], rect.to[1]].sort((a, b) => a - b);
      for (let row = r0; row <= r1; row++) {
        for (let col = c0; col <= c1; col++) {
          if (tiles[row][col] === TileKind.WALL) {
            tiles[row][col] = TileKind.ICE;
            this.iced.push({ col, row });
          }
        }
      }
    }
    this.justIced = true;
    this.events.push('ice');
  }

  /** Any end stuck on a wall that just turned to ice slips off. */
  slipOff(slime) {
    if (slime.isFalling || slime.frozen) {
      return;
    }
    const slipping = slime.ends.map(
      e => e.state === 'stuck' && !isTouchingSticky(this.level, e, END_RADIUS, 4)
    );
    if (slipping[0] && slipping[1]) {
      slime.knockLoose(0, 0);
    } else {
      slime.ends.forEach((e, i) => {
        if (slipping[i] && slime.ends[1 - i].state === 'stuck') {
          e.state = 'snapping';
          slime.lead = 1 - i;
        }
      });
    }
  }

  // ------------------------------------------------------------------ hands

  /** Is a hand busy attacking (so no other hand starts yet)? */
  attacking() {
    return this.hands.some(h => ['chase', 'warn', 'drop', 'carry'].includes(h.state));
  }

  updateHands(dt, slime, pts) {
    let hurt = null;
    if (!this.attacking()) {
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) {
        // The next hand that's ready takes its turn.
        for (let k = 0; k < this.hands.length; k++) {
          const i = (this.nextHand + k) % this.hands.length;
          if (this.hands[i].state === 'wait') {
            this.hands[i].state = 'chase';
            this.hands[i].timer = CHASE_TIME;
            this.nextHand = (i + 1) % this.hands.length;
            this.events.push('chase');
            break;
          }
        }
      }
    }
    const target = Math.max(this.minX, Math.min(this.maxX, slime.center.x));
    for (const h of this.hands) {
      if (h.state === 'home' || h.state === 'wait') {
        const want = { x: h.home, y: this.trackY };
        moveToward(h, want, HAND_HOME_SPEED * dt);
        if (h.state === 'home' && dist(h, want) < 1) {
          h.state = 'wait';
        }
      } else if (h.state === 'chase') {
        h.timer -= dt;
        moveToward(h, { x: target, y: this.trackY }, HAND_SPEED * dt);
        if (h.timer <= 0) {
          h.state = 'warn';
          h.timer = HAND_WARN;
          this.events.push('warn');
        }
      } else if (h.state === 'warn') {
        h.timer -= dt;
        if (h.timer <= 0) {
          h.state = 'drop';
          h.dropTo = this.dropLimit(h);
        }
      } else if (h.state === 'drop') {
        h.y = Math.min(h.dropTo, h.y + HAND_DROP_SPEED * dt);
        if (h.y >= h.dropTo) {
          // Missed! It's stuck on the ground for a moment.
          h.state = 'stuck';
          h.timer = HAND_STUCK;
          this.attackTimer = ATTACK_GAP;
          this.events.push('miss');
        }
      } else if (h.state === 'stuck') {
        h.timer -= dt;
        if (h.timer <= 0) {
          h.state = 'rise';
        }
      } else if (h.state === 'rise') {
        h.y = Math.max(this.trackY, h.y - HAND_RISE_SPEED * dt);
        if (h.y <= this.trackY) {
          h.state = 'home';
        }
      } else if (h.state === 'carry') {
        if (!slime.frozen) {
          // Something else let go of the slime (like splitting in two).
          h.state = 'home';
          continue;
        }
        const mouth = { x: this.x, y: this.homeY + HEAD_HEIGHT * 0.1 };
        const there = moveToward(
          h,
          { x: mouth.x, y: mouth.y - HAND_RADIUS * 0.4 },
          CARRY_SPEED * dt
        );
        slime.holdAt(h.x, h.y + HAND_RADIUS * 0.4);
        if (there) {
          // CHOMP! He eats you, then the hand goes back to its spot.
          h.state = 'home';
          this.chomp = 0.6;
          this.attackTimer = ATTACK_GAP;
          this.sendBack = true;
          this.events.push('chomp');
          hurt = 'kingclaw';
        }
      }
      // A hand that's out hunting grabs you if it touches you.
      const hunting = h.state === 'chase' || h.state === 'warn' || h.state === 'drop';
      if (hunting && pts.length && pts.some(p => dist(p, h) < HAND_RADIUS + END_RADIUS * 0.5)) {
        h.state = 'carry';
        slime.holdAt(h.x, h.y + HAND_RADIUS * 0.4);
        this.events.push('grab');
        pts = [];
      }
    }
    if (this.hands.length && this.hands.every(h => h.state === 'eaten')) {
      // No hands left! His head is going to fall.
      this.state = 'wobble';
      this.timer = HEAD_WOBBLE;
      this.events.push('wobble');
    }
    return hurt;
  }

  /** How far down a hand dropping from where it is now can go: onto the floor or a ledge. */
  dropLimit(h) {
    let top = this.level.pixelHeight;
    for (const dx of [-HAND_RADIUS * 0.6, 0, HAND_RADIUS * 0.6]) {
      const col = Math.floor((h.x + dx) / TILE);
      for (let row = Math.floor(h.y / TILE) + 1; row < this.level.height; row++) {
        if (isSolidKind(tileAt(this.level, col, row))) {
          top = Math.min(top, row * TILE);
          break;
        }
      }
    }
    return top - HAND_RADIUS;
  }

  /** The tongue at `tip` eats a stuck hand. Returns true if it got one. */
  eatHand(tip) {
    const h = this.hands.find(
      h => h.state === 'stuck' && dist(h, tip) < HAND_RADIUS + TONGUE_RADIUS
    );
    if (!h) {
      return false;
    }
    h.state = 'eaten';
    this.events.push('eatHand');
    return true;
  }

  // ------------------------------------------------------------------ bombs

  updateBombTimer(dt) {
    if (this.phase < 2) {
      return;
    }
    this.bombTimer -= dt;
    // Bombs drop from a hand that's chasing you.
    const h = this.hands.find(h => h.state === 'chase');
    if (this.bombTimer <= 0 && h) {
      this.bombTimer = BOMB_EVERY;
      this.bombs.push({ x: h.x, y: h.y + HAND_RADIUS, vy: 0, fuse: BOMB_FUSE });
      this.events.push('bomb');
    }
  }

  updateBombs(dt, pts) {
    let hurt = null;
    for (const b of this.bombs) {
      b.fuse -= dt;
      b.vy = Math.min(MAX_FALL_SPEED, b.vy + GRAVITY * dt);
      const ny = b.y + b.vy * dt;
      if (circleHitsSolid(this.level, { x: b.x, y: ny }, BOMB_RADIUS)) {
        b.vy = 0;
      } else {
        b.y = ny;
      }
      if (b.fuse <= 0 || b.y > this.level.pixelHeight) {
        b.gone = true;
        this.explosions.push({ x: b.x, y: b.y, age: 0 });
        this.events.push('explode');
        if (pts.some(p => dist(p, b) < BLAST_RADIUS)) {
          hurt = 'bomb';
        }
      }
    }
    this.bombs = this.bombs.filter(b => !b.gone);
    return hurt;
  }

  updateExplosions(dt) {
    for (const e of this.explosions) {
      e.age += dt;
    }
    this.explosions = this.explosions.filter(e => e.age < 0.5);
  }

  /**
   * Each hit is a checkpoint: King Claw keeps his damage (and the icy walls),
   * but his head goes back up and he gets this phase's hands back.
   */
  resetAfterSlimeDeath() {
    if (!this.defeated) {
      this.reset();
    }
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
