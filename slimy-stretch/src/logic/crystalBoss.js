import { END_RADIUS, TILE } from './constants.js';
import { circleHitsSolid, dist } from './collision.js';

export const CRYSTAL_WIDTH = 110;
export const CRYSTAL_HEIGHT = 120;
export const SHARD_RADIUS = 9;
const SHARD_SPEED = 420;
const SLAM_RANGE = 200;

// Indexed by phase (1, 2, 3): it gets faster and gives you less time.
const CHARGE_SPEED = [0, 360, 470, 580];
const BROKEN_FOR = [0, 5, 4, 3.5];
const WINDUP = [0, 0.8, 0.65, 0.5];

/**
 * The cave boss: a robot made of crystal. Nothing hurts its armor, but if
 * you trick it into charging into a mining machine the armor cracks open and
 * you have a few seconds to eat one of its glowing orbs with your tongue.
 * Eat 3 orbs to win. Phase 2 adds a ground slam, phase 3 shoots shards.
 */
export class CrystalBoss {
  constructor(level) {
    this.level = level;
    this.homeX = level.robot.x;
    this.floorY = (Math.floor(level.robot.y / TILE) + 1) * TILE;
    this.x = this.homeX;
    this.hp = 3;
    this.dir = -1;
    this.state = 'idle';
    this.timer = 1.5;
    this.shootTimer = 3;
    this.shards = [];
    this.slamWave = 0;
    this.events = [];
  }

  get phase() {
    return Math.min(3, 4 - this.hp);
  }

  get defeated() {
    return this.hp <= 0;
  }

  get rect() {
    return {
      left: this.x - CRYSTAL_WIDTH / 2,
      right: this.x + CRYSTAL_WIDTH / 2,
      top: this.floorY - CRYSTAL_HEIGHT,
      bottom: this.floorY,
    };
  }

  /** Spot of the glowing orbs (the tongue has to touch here). */
  get orbSpot() {
    return { x: this.x, y: this.floorY - CRYSTAL_HEIGHT * 0.55 };
  }

  inRect(p, pad = 0) {
    const r = this.rect;
    return p.x > r.left - pad && p.x < r.right + pad && p.y > r.top - pad && p.y < r.bottom + pad;
  }

  /** Does the robot's body (plus `pad` pixels) overlap tile (col,row)? */
  overlapsTile(col, row, x = this.x, pad = 0) {
    const left = x - CRYSTAL_WIDTH / 2 - pad;
    const right = x + CRYSTAL_WIDTH / 2 + pad;
    return (
      right > col * TILE &&
      left < (col + 1) * TILE &&
      this.floorY > row * TILE &&
      this.rect.top < (row + 1) * TILE
    );
  }

  /**
   * Advance the fight. `machines` are the mining machines in the arena.
   * Returns true if the slime got hurt.
   */
  update(dt, slime, machines) {
    let hurt = false;
    this.slamWave = Math.max(0, this.slamWave - dt);
    hurt = this.updateShards(dt, slime) || hurt;
    if (this.defeated) {
      return hurt;
    }
    const target = slime.center;
    const pts = slime.bodyPoints(10);
    this.timer -= dt;

    if (this.state === 'idle') {
      this.dir = target.x < this.x ? -1 : 1;
      if (this.phase >= 3) {
        this.shootTimer -= dt;
        if (this.shootTimer <= 0) {
          this.shootTimer = 2.6;
          this.shoot(target);
        }
      }
      if (this.timer <= 0) {
        const close =
          Math.abs(target.x - this.x) < CRYSTAL_WIDTH / 2 + SLAM_RANGE &&
          target.y > this.floorY - 90;
        this.state = this.phase >= 2 && close ? 'slamWindup' : 'windup';
        this.timer = this.state === 'windup' ? WINDUP[this.phase] : 0.5;
        this.events.push(this.state === 'windup' ? 'windup' : 'slamWindup');
      }
    } else if (this.state === 'windup' && this.timer <= 0) {
      this.state = 'charge';
      this.events.push('charge');
    } else if (this.state === 'charge') {
      const nx = this.x + this.dir * CHARGE_SPEED[this.phase] * dt;
      // Checked a little ahead of the wall test, so a machine always counts as a crash.
      const machine = machines.find(m => this.overlapsTile(m.col, m.row, nx, 14));
      if (machine) {
        // Crash! The crystal armor cracks open.
        this.state = 'broken';
        this.timer = BROKEN_FOR[this.phase];
        this.events.push('break');
      } else if (this.hitsWall(nx)) {
        this.state = 'idle';
        this.timer = 1;
        this.events.push('bonk');
      } else {
        this.x = nx;
      }
      if (pts.some(p => this.inRect(p, END_RADIUS * 0.5))) {
        hurt = true;
      }
    } else if (this.state === 'slamWindup' && this.timer <= 0) {
      this.state = 'idle';
      this.timer = 1.2;
      this.slamWave = 0.4;
      this.events.push('slam');
      const from = this.x + (this.dir * CRYSTAL_WIDTH) / 2;
      const to = from + this.dir * SLAM_RANGE;
      const [lo, hi] = from < to ? [from, to] : [to, from];
      if (pts.some(p => p.x > lo && p.x < hi && p.y > this.floorY - 60)) {
        hurt = true;
      }
    } else if (this.state === 'broken' && this.timer <= 0) {
      // Too slow: the armor grows back.
      this.state = 'idle';
      this.timer = 1;
      this.events.push('regen');
    }
    return hurt;
  }

  hitsWall(x) {
    const probe = { x: x + (this.dir * CRYSTAL_WIDTH) / 2, y: this.floorY - 30 };
    return circleHitsSolid(this.level, probe, 10);
  }

  /** The tongue touched the robot. Eats an orb if the armor is cracked. */
  eatOrb() {
    if (this.state !== 'broken') {
      return false;
    }
    this.hp -= 1;
    this.events.push(this.defeated ? 'defeated' : 'orb');
    this.state = 'idle';
    this.timer = 1.5;
    return true;
  }

  shoot(target) {
    const from = { x: this.x, y: this.floorY - CRYSTAL_HEIGHT + 20 };
    const d = dist(from, target) || 1;
    this.shards.push({
      x: from.x,
      y: from.y,
      vx: ((target.x - from.x) / d) * SHARD_SPEED,
      vy: ((target.y - from.y) / d) * SHARD_SPEED,
    });
    this.events.push('shoot');
  }

  updateShards(dt, slime) {
    let hurt = false;
    const pts = slime.bodyPoints(10);
    for (const s of this.shards) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (pts.some(p => dist(p, s) < SHARD_RADIUS + END_RADIUS * 0.6)) {
        hurt = true;
        s.gone = true;
      } else if (circleHitsSolid(this.level, s, SHARD_RADIUS)) {
        s.gone = true;
      }
    }
    this.shards = this.shards.filter(s => !s.gone);
    return hurt;
  }

  /** The slime died: each orb eaten counts as a checkpoint. */
  resetAfterSlimeDeath() {
    this.x = this.homeX;
    this.state = 'idle';
    this.timer = 1.5;
    this.shootTimer = 3;
    this.shards = [];
  }

  takeEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }
}
