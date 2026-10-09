import { END_RADIUS, GRAVITY, MAX_THROW_SPEED, TILE } from './constants.js';
import { circleHitsSolid, dist } from './collision.js';

export const BOMB_RADIUS = 14;
export const BOMB_FUSE = 5.5;
export const EXPLOSION_RADIUS = 70;
export const ROBOT_WIDTH = 120;
export const ROBOT_HEIGHT = 170;
const MAX_BOMBS = 3;
const THROW_FLIGHT_TIME = 1.2;

// Seconds between things, indexed by phase (1, 2, 3).
const THROW_EVERY = [0, 3.2, 2.8, 2.4];
const STOMP_EVERY = [0, Infinity, 5.5, 4.5];
const SHIELD_EVERY = 4.5;
const SHIELD_FOR = 2.5;

/**
 * The volcano robot. It has 3 health and gets trickier each time it's hit:
 *   phase 1: throws bombs
 *   phase 2: also jumps up and tries to stomp on the slime
 *   phase 3: also puts up a shield sometimes (bombs bounce off)
 * The slime grabs the robot's bombs and flicks them back at it.
 */
export class Boss {
  constructor(level) {
    this.level = level;
    this.homeY = (Math.floor(level.robot.y / TILE) + 1) * TILE; // floor under the robot
    this.x = level.robot.x;
    this.y = this.homeY; // bottom of the robot
    this.hp = 3;
    this.state = 'idle';
    this.stateTime = 0;
    this.throwTimer = 2;
    this.stompTimer = STOMP_EVERY[2];
    this.shieldTimer = SHIELD_EVERY;
    this.shieldOn = false;
    this.hurtTime = 0;
    this.bombs = [];
    this.explosions = [];
    this.events = [];
    this.stompTargetX = this.x;
  }

  get phase() {
    return Math.min(3, 4 - this.hp);
  }

  get defeated() {
    return this.hp <= 0;
  }

  /** The robot's body as a rectangle. */
  get rect() {
    return {
      left: this.x - ROBOT_WIDTH / 2,
      right: this.x + ROBOT_WIDTH / 2,
      top: this.y - ROBOT_HEIGHT,
      bottom: this.y,
    };
  }

  pointInRobot(p, pad = 0) {
    const r = this.rect;
    return p.x > r.left - pad && p.x < r.right + pad && p.y > r.top - pad && p.y < r.bottom + pad;
  }

  /**
   * Advance the fight. Returns true if the slime got hurt this frame.
   */
  update(dt, slime) {
    let slimeHurt = false;
    this.stateTime += dt;
    this.hurtTime = Math.max(0, this.hurtTime - dt);
    this.explosions = this.explosions.filter(e => (e.age += dt) < 0.5);

    if (!this.defeated) {
      slimeHurt = this.updateRobot(dt, slime) || slimeHurt;
    }
    slimeHurt = this.updateBombs(dt, slime) || slimeHurt;
    return slimeHurt;
  }

  setState(state) {
    this.state = state;
    this.stateTime = 0;
  }

  updateRobot(dt, slime) {
    const phase = this.phase;
    let slimeHurt = false;

    if (phase === 3) {
      this.shieldTimer -= dt;
      if (this.shieldTimer <= 0) {
        this.shieldOn = !this.shieldOn;
        this.shieldTimer = this.shieldOn ? SHIELD_FOR : SHIELD_EVERY;
        this.events.push(this.shieldOn ? 'shieldUp' : 'shieldDown');
      }
    }

    const target = slime.center;
    switch (this.state) {
      case 'idle': {
        this.throwTimer -= dt;
        if (this.throwTimer <= 0) {
          this.throwTimer = THROW_EVERY[phase];
          this.throwBomb(target);
        }
        if (phase >= 2) {
          this.stompTimer -= dt;
        }
        if (this.stompTimer <= 0) {
          this.stompTimer = STOMP_EVERY[phase];
          this.setState('stompUp');
          this.events.push('jump');
        }
        break;
      }
      case 'stompUp': {
        const topY = 2 * TILE + ROBOT_HEIGHT;
        this.y = Math.max(topY, this.y - 900 * dt);
        if (this.y <= topY) {
          this.setState('stompAim');
        }
        break;
      }
      case 'stompAim': {
        // Slide over the slime, then drop. The shadow on the floor warns you.
        const minX = TILE + ROBOT_WIDTH / 2;
        const maxX = this.level.pixelWidth - TILE - ROBOT_WIDTH / 2;
        this.stompTargetX = Math.max(minX, Math.min(maxX, target.x));
        const dx = this.stompTargetX - this.x;
        this.x += Math.sign(dx) * Math.min(Math.abs(dx), 650 * dt);
        const overTarget = Math.abs(this.stompTargetX - this.x) < 4;
        if ((overTarget && this.stateTime > 0.9) || this.stateTime > 1.8) {
          this.setState('stompDown');
        }
        break;
      }
      case 'stompDown': {
        this.y = Math.min(this.homeY, this.y + 1500 * dt);
        if (slime.bodyPoints(10).some(p => this.pointInRobot(p, END_RADIUS * 0.5))) {
          slimeHurt = true;
        }
        if (this.y >= this.homeY) {
          this.events.push('stomp');
          this.setState('idle');
        }
        break;
      }
      default:
        break;
    }
    return slimeHurt;
  }

  throwBomb(target) {
    if (this.bombs.filter(b => b.state !== 'thrown').length >= MAX_BOMBS) {
      return;
    }
    const from = { x: this.x - ROBOT_WIDTH * 0.35, y: this.y - ROBOT_HEIGHT + 30 };
    // Pick a launch speed so the bomb lands near the slime after the flight time.
    const tx = target.x + (Math.random() - 0.5) * 60;
    const T = THROW_FLIGHT_TIME;
    this.bombs.push({
      x: from.x,
      y: from.y,
      vx: (tx - from.x) / T,
      vy: (target.y - from.y - 0.5 * GRAVITY * T * T) / T,
      fuse: BOMB_FUSE,
      state: 'flying',
    });
    this.events.push('throw');
  }

  /** Try to pick up a bomb with the slime end at `p`. Returns the bomb or null. */
  grabBomb(p) {
    const bomb = this.bombs.find(
      b => (b.state === 'flying' || b.state === 'resting') && dist(b, p) < BOMB_RADIUS + END_RADIUS
    );
    if (bomb) {
      bomb.state = 'held';
      bomb.vx = 0;
      bomb.vy = 0;
      this.events.push('grabBomb');
    }
    return bomb || null;
  }

  /** Let go of a held bomb. A fast flick throws it; otherwise it just drops. */
  releaseBomb(bomb, velocity, isFlick) {
    if (isFlick) {
      const speed = Math.hypot(velocity.x, velocity.y);
      const k = speed > MAX_THROW_SPEED ? MAX_THROW_SPEED / speed : 1;
      bomb.vx = velocity.x * k;
      bomb.vy = velocity.y * k;
      bomb.state = 'thrown';
      this.events.push('throwBomb');
    } else {
      bomb.vx = 0;
      bomb.vy = 0;
      bomb.state = 'flying';
    }
  }

  updateBombs(dt, slime) {
    let slimeHurt = false;
    for (const bomb of this.bombs) {
      bomb.fuse -= dt;
      if (bomb.state === 'held') {
        const end = slime.heldEnd;
        if (end) {
          bomb.x = end.x;
          bomb.y = end.y;
        }
      } else if (bomb.state !== 'resting') {
        this.moveBomb(bomb, dt);
      }
      if (bomb.state === 'thrown' && !this.defeated && this.pointInRobot(bomb, BOMB_RADIUS)) {
        this.explode(bomb);
        if (this.shieldOn) {
          this.events.push('blocked');
        } else {
          this.hp -= 1;
          this.hurtTime = 0.8;
          this.events.push(this.defeated ? 'defeated' : 'hit');
          if (this.state !== 'idle') {
            this.setState('stompDown');
          }
          // A short breather after each hit.
          this.throwTimer = 2;
          this.stompTimer = Math.max(this.stompTimer, 3);
        }
      } else if (bomb.fuse <= 0 && !bomb.exploded) {
        this.explode(bomb);
        // The slime's own thrown bombs don't hurt it.
        if (
          bomb.state !== 'thrown' &&
          slime.bodyPoints(10).some(p => dist(p, bomb) < EXPLOSION_RADIUS)
        ) {
          slimeHurt = true;
        }
      }
    }
    this.bombs = this.bombs.filter(b => !b.exploded);
    return slimeHurt;
  }

  moveBomb(bomb, dt) {
    bomb.vy += GRAVITY * dt;
    const steps = Math.max(1, Math.ceil((Math.hypot(bomb.vx, bomb.vy) * dt) / 4));
    for (let i = 0; i < steps; i++) {
      const nx = bomb.x + (bomb.vx * dt) / steps;
      if (circleHitsSolid(this.level, { x: nx, y: bomb.y }, BOMB_RADIUS)) {
        if (bomb.state === 'thrown') {
          bomb.fuse = Math.min(bomb.fuse, 0.15);
        }
        bomb.vx *= -0.3;
      } else {
        bomb.x = nx;
      }
      const ny = bomb.y + (bomb.vy * dt) / steps;
      if (circleHitsSolid(this.level, { x: bomb.x, y: ny }, BOMB_RADIUS)) {
        if (bomb.state === 'thrown') {
          bomb.fuse = Math.min(bomb.fuse, 0.15);
        }
        if (bomb.vy > 0 && Math.abs(bomb.vy) < 250) {
          bomb.state = bomb.state === 'thrown' ? 'thrown' : 'resting';
          bomb.vx = 0;
        }
        bomb.vy *= -0.3;
        bomb.vx *= 0.6;
      } else {
        bomb.y = ny;
      }
    }
  }

  explode(bomb) {
    bomb.exploded = true;
    this.explosions.push({ x: bomb.x, y: bomb.y, age: 0 });
    this.events.push('explode');
  }

  takeEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }
}
