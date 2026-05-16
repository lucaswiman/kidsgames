import Phaser from 'phaser';

const BASE_HP = 60;
const BASE_SPEED = 80; // pixels per second
const BASE_REWARD = 10;

export default class Enemy {
  constructor(scene, path, wave) {
    this.scene = scene;
    this.path = path;
    this._dead = false;

    const hpScale = 1 + (wave - 1) * 0.3;
    this.hp = Math.round(BASE_HP * hpScale);
    this.maxHp = this.hp;
    this.reward = BASE_REWARD + wave * 2;

    this._speed = BASE_SPEED + wave * 5;
    this._pathLength = path.getLength();
    this._t = 0; // 0..1 progress along path

    const startPt = path.getPoint(0);
    this.x = startPt.x;
    this.y = startPt.y;

    this.body = scene.add.circle(this.x, this.y, 14, 0xff4444).setDepth(5);
    this.hpBg = scene.add.rectangle(this.x, this.y - 20, 28, 5, 0x880000).setDepth(4);
    this.hpBar = scene.add.rectangle(this.x, this.y - 20, 28, 5, 0x00ff00).setDepth(5);
  }

  update(delta) {
    if (this._dead || this._t >= 1) return;

    this._t += (this._speed * delta) / (this._pathLength * 1000);
    if (this._t > 1) this._t = 1;

    const pt = this.path.getPoint(this._t);
    this.x = pt.x;
    this.y = pt.y;

    this.body.setPosition(this.x, this.y);
    this.hpBg.setPosition(this.x, this.y - 20);

    const ratio = this.hp / this.maxHp;
    this.hpBar.setSize(ratio * 28, 5);
    this.hpBar.setPosition(this.x - (1 - ratio) * 14, this.y - 20);
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
