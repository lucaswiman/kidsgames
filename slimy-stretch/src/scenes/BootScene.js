import Phaser from 'phaser';

/**
 * Draws the small pictures (tokens, power cores, bombs, ...) once and saves
 * them as textures, so the game needs no image files.
 */
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    const make = (key, w, h, draw) => {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      draw(g);
      g.generateTexture(key, w, h);
      g.destroy();
    };

    make('token', 32, 32, g => {
      g.fillStyle(0xb8860b, 1);
      g.fillCircle(16, 16, 15);
      g.fillStyle(0xffd700, 1);
      g.fillCircle(16, 16, 12);
      g.fillStyle(0xfff1a0, 1);
      // A little star in the middle.
      const star = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 8 : 3.5;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        star.push({ x: 16 + Math.cos(a) * r, y: 16 + Math.sin(a) * r });
      }
      g.fillPoints(star, true);
    });

    make('core', 40, 40, g => {
      g.fillStyle(0x7b2cff, 0.35);
      g.fillCircle(20, 20, 19);
      g.fillStyle(0x444466, 1);
      g.fillRect(8, 4, 24, 5);
      g.fillRect(8, 31, 24, 5);
      g.fillStyle(0x00f0ff, 1);
      g.fillCircle(20, 20, 11);
      g.fillStyle(0xe0ffff, 1);
      g.fillCircle(17, 17, 4);
    });

    make('bomb', 36, 40, g => {
      g.fillStyle(0x222222, 1);
      g.fillCircle(18, 24, 14);
      g.fillStyle(0x555555, 1);
      g.fillRect(14, 6, 8, 6);
      g.fillStyle(0xffffff, 0.5);
      g.fillCircle(13, 19, 4);
      g.lineStyle(3, 0xc8a060, 1);
      g.lineBetween(18, 6, 24, 1);
    });

    for (const [key, color] of [
      ['flag-off', 0xbb3333],
      ['flag-on', 0x33dd55],
    ]) {
      make(key, 48, 48, g => {
        g.fillStyle(0xdddddd, 1);
        g.fillRect(10, 4, 4, 44);
        g.fillStyle(color, 1);
        g.fillTriangle(14, 6, 42, 15, 14, 24);
      });
    }

    for (const [key, light] of [
      ['door-open', 0x33ff66],
      ['door-locked', 0xff3333],
    ]) {
      make(key, 48, 72, g => {
        g.fillStyle(0x333a48, 1);
        g.fillRoundedRect(2, 2, 44, 70, 8);
        g.fillStyle(0x1a1f2a, 1);
        g.fillRoundedRect(8, 14, 32, 58, 6);
        g.fillStyle(light, 1);
        g.fillCircle(24, 8, 4);
        g.lineStyle(3, light, 0.9);
        g.strokeRoundedRect(8, 14, 32, 58, 6);
      });
    }

    make('drop', 12, 12, g => {
      g.fillStyle(0x55e05a, 1);
      g.fillCircle(6, 6, 6);
    });

    make('spark', 8, 8, g => {
      g.fillStyle(0xffffff, 1);
      g.fillCircle(4, 4, 4);
    });

    this.scene.start('Title');
  }
}
