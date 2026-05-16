import Phaser from 'phaser';
import { findTarget, canFire, nextCooldown } from '../logic/towerLogic.js';

const RANGE = 120;
const FIRE_RATE = 800; // ms between shots
const BULLET_SPEED = 300;
const DAMAGE = 20;

export default class Tower {
  constructor(scene, x, y) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.cooldown = 0;

    // Body
    this.base = scene.add.rectangle(x, y, 32, 32, 0x4444ff);
    this.barrel = scene.add.rectangle(x, y - 10, 8, 20, 0x2222aa);

    // Range ring (shown briefly on place)
    this.rangeCircle = scene.add.circle(x, y, RANGE, 0x4444ff, 0.1);
    scene.time.delayedCall(1500, () => this.rangeCircle.setVisible(false));
  }

  update(enemies) {
    const now = this.scene.time.now;
    if (!canFire(this.cooldown, now)) return;

    const target = findTarget(this.x, this.y, enemies, RANGE);
    if (!target) return;

    this.cooldown = nextCooldown(now, FIRE_RATE);
    this._aimAt(target);
    this._fireBullet(target);
  }

  _aimAt(enemy) {
    const angle = Phaser.Math.Angle.Between(this.x, this.y, enemy.x, enemy.y);
    this.barrel.setRotation(angle + Math.PI / 2);
  }

  _fireBullet(target) {
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    const bullet = this.scene.add.circle(this.x, this.y, 5, 0xffff00);
    this.scene.tweens.add({
      targets: bullet,
      x: target.x,
      y: target.y,
      duration: (d / BULLET_SPEED) * 1000,
      onComplete: () => {
        target.takeDamage(DAMAGE);
        bullet.destroy();
      },
    });
  }

  destroy() {
    this.base.destroy();
    this.barrel.destroy();
    this.rangeCircle.destroy();
  }
}
