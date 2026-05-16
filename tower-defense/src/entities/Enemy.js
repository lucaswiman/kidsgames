import Phaser from 'phaser';
import { enemyStats, advancePath, hpRatio } from '../logic/enemyLogic.js';

const HP_BAR_WIDTH = 28;

export default class Enemy {
  constructor(scene, path, wave) {
    this.scene = scene;
    this.path = path;
    this._dead = false;

    const stats = enemyStats(wave);
    this.hp = stats.hp;
    this.maxHp = stats.maxHp;
    this._speed = stats.speed;
    this.reward = stats.reward;

    this._pathLength = path.getLength();
    this._t = 0; // 0..1 progress along path

    const startPt = path.getPoint(0);
    this.x = startPt.x;
    this.y = startPt.y;

    this.body = scene.add.circle(this.x, this.y, 14, 0xff4444).setDepth(5);
    this.hpBg = scene.add.rectangle(this.x, this.y - 20, HP_BAR_WIDTH, 5, 0x880000).setDepth(4);
    this.hpBar = scene.add.rectangle(this.x, this.y - 20, HP_BAR_WIDTH, 5, 0x00ff00).setDepth(5);
  }

  update(delta) {
    if (this._dead || this._t >= 1) return;

    this._t = advancePath(this._t, this._speed, this._pathLength, delta);

    const pt = this.path.getPoint(this._t);
    this.x = pt.x;
    this.y = pt.y;

    this.body.setPosition(this.x, this.y);
    this.hpBg.setPosition(this.x, this.y - 20);

    const ratio = hpRatio(this.hp, this.maxHp);
    this.hpBar.setSize(ratio * HP_BAR_WIDTH, 5);
    this.hpBar.setPosition(this.x - (1 - ratio) * (HP_BAR_WIDTH / 2), this.y - 20);
  }

  takeDamage(amount) {
    this.hp -= amount;
    if (this.hp <= 0) this._dead = true;
  }

  isDead() {
    return this._dead;
  }

  reachedEnd() {
    return this._t >= 1;
  }

  destroy() {
    this.body.destroy();
    this.hpBar.destroy();
    this.hpBg.destroy();
  }
}
