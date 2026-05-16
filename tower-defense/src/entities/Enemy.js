import Phaser from 'phaser';

const BASE_HP = 60;
const BASE_SPEED = 80; // pixels per second
const BASE_REWARD = 10;

export default class Enemy {
  constructor(scene, path, wave) {
    this.scene = scene;
    this._dead = false;
    this._ended = false;

    const hpScale = 1 + (wave - 1) * 0.3;
    this.hp = Math.round(BASE_HP * hpScale);
    this.maxHp = this.hp;
    this.reward = BASE_REWARD + wave * 2;

    // Follow path using Phaser's PathFollower
    this.follower = scene.add.follower(path, 0, 300, undefined);
    this.body = scene.add.circle(0, 0, 14, 0xff4444);
    this.hpBar = scene.add.rectangle(0, -20, 28, 5, 0x00ff00);
    this.hpBg = scene.add.rectangle(0, -20, 28, 5, 0x880000);
    this.hpBg.setDepth(4);
    this.hpBar.setDepth(5);
    this.body.setDepth(5);

    const speed = BASE_SPEED + wave * 5;
    const duration = (path.getLength() / speed) * 1000;
    this.follower.startFollow({
      duration,
      onComplete: () => {
        this._ended = true;
      },
    });
  }

  get x() {
    return this.follower.x;
  }

  get y() {
    return this.follower.y;
  }

  update() {
    if (this._dead || this._ended) return;
    const { x, y } = this.follower;
    this.body.setPosition(x, y);
    this.hpBg.setPosition(x, y - 20);
    this.hpBar.setPosition(x - (1 - this.hp / this.maxHp) * 14, y - 20);
    this.hpBar.setSize((this.hp / this.maxHp) * 28, 5);
  }

  takeDamage(amount) {
    this.hp -= amount;
    if (this.hp <= 0) this._dead = true;
  }

  isDead() {
    return this._dead;
  }

  reachedEnd() {
    return this._ended;
  }

  destroy() {
    this.follower.stopFollow();
    this.follower.destroy();
    this.body.destroy();
    this.hpBar.destroy();
    this.hpBg.destroy();
  }
}
