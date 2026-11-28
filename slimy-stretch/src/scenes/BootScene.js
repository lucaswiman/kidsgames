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

    // Pearls are what you collect on the island.
    make('pearl', 40, 40, g => {
      g.fillStyle(0xffd6f0, 0.35);
      g.fillCircle(20, 20, 19);
      g.fillStyle(0xe8e4f0, 1);
      g.fillCircle(20, 20, 12);
      g.fillStyle(0xfff6ff, 1);
      g.fillCircle(17, 16, 5);
      g.fillStyle(0xc9b8d8, 1);
      g.fillCircle(24, 25, 3);
    });

    // Golden idols are what you collect in the jungle.
    make('idol', 40, 44, g => {
      g.fillStyle(0xffe066, 0.3);
      g.fillCircle(20, 22, 20);
      g.fillStyle(0xb8860b, 1);
      g.fillRect(9, 36, 22, 6);
      g.fillStyle(0xe8b820, 1);
      g.fillRoundedRect(12, 18, 16, 19, 4);
      g.fillCircle(20, 13, 9);
      g.fillStyle(0xfff1a0, 1);
      g.fillCircle(17, 10, 3);
      g.fillStyle(0x7a5208, 1);
      g.fillRect(15, 12, 3, 3);
      g.fillRect(22, 12, 3, 3);
      g.fillRect(17, 17, 6, 2);
      g.fillRect(13, 24, 14, 2);
    });

    // Stars are what you collect up in the sky.
    make('star', 44, 44, g => {
      g.fillStyle(0xfff6a0, 0.35);
      g.fillCircle(22, 22, 21);
      const star = r => {
        const pts = [];
        for (let i = 0; i < 10; i++) {
          const k = i % 2 === 0 ? r : r * 0.45;
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          pts.push({ x: 22 + Math.cos(a) * k, y: 23 + Math.sin(a) * k });
        }
        return pts;
      };
      g.fillStyle(0xe8a810, 1);
      g.fillPoints(star(19), true);
      g.fillStyle(0xffd83a, 1);
      g.fillPoints(star(15), true);
      g.fillStyle(0xfff6c0, 1);
      g.fillCircle(18, 18, 3);
      // A happy little face.
      g.fillStyle(0x7a5208, 1);
      g.fillCircle(18, 23, 1.8);
      g.fillCircle(26, 23, 1.8);
      g.fillRect(19, 27, 6, 2);
    });

    // Glowing space crystals are what you collect in Outer Space.
    make('spacecrystal', 44, 48, g => {
      g.fillStyle(0xb48aff, 0.3);
      g.fillCircle(22, 24, 21);
      g.fillStyle(0x7a4ad8, 1);
      g.fillPoints(
        [
          { x: 22, y: 4 },
          { x: 34, y: 18 },
          { x: 28, y: 44 },
          { x: 16, y: 44 },
          { x: 10, y: 18 },
        ],
        true
      );
      g.fillStyle(0xc9a8ff, 1);
      g.fillPoints(
        [
          { x: 22, y: 4 },
          { x: 26, y: 18 },
          { x: 22, y: 44 },
          { x: 16, y: 44 },
          { x: 10, y: 18 },
        ],
        true
      );
      g.fillStyle(0xffffff, 0.9);
      g.fillTriangle(15, 18, 20, 9, 20, 22);
    });

    // Wrapped candies are what you collect in Candyland.
    make('candy', 52, 36, g => {
      g.fillStyle(0xffd6ec, 0.35);
      g.fillCircle(26, 18, 18);
      // The twisted wrapper ends.
      g.fillStyle(0xff6aa0, 1);
      g.fillTriangle(16, 18, 2, 6, 2, 30);
      g.fillTriangle(36, 18, 50, 6, 50, 30);
      g.fillStyle(0xffb0d0, 1);
      g.fillTriangle(16, 18, 6, 12, 6, 24);
      g.fillTriangle(36, 18, 46, 12, 46, 24);
      // The candy in the middle, with stripes.
      g.fillStyle(0xff3a7a, 1);
      g.fillCircle(26, 18, 12);
      g.lineStyle(4, 0xffffff, 1);
      g.lineBetween(19, 10, 23, 27);
      g.lineBetween(27, 7, 31, 28);
      g.fillStyle(0xffffff, 0.8);
      g.fillCircle(22, 13, 3);
    });

    // Glowing pumpkins are what you collect in the haunted house.
    make('pumpkin', 48, 48, g => {
      g.fillStyle(0xffb030, 0.3);
      g.fillCircle(24, 26, 22);
      // The stem and a curly leaf.
      g.fillStyle(0x4a7a2a, 1);
      g.fillRect(22, 4, 5, 9);
      g.fillStyle(0x6aaa3a, 1);
      g.fillEllipse(32, 9, 12, 6);
      // A round, ridged pumpkin.
      g.fillStyle(0xd8601a, 1);
      g.fillEllipse(15, 28, 18, 28);
      g.fillEllipse(33, 28, 18, 28);
      g.fillStyle(0xf07a22, 1);
      g.fillEllipse(24, 28, 22, 30);
      // A friendly glowing face.
      g.fillStyle(0xfff07a, 1);
      g.fillTriangle(14, 25, 20, 25, 17, 19);
      g.fillTriangle(28, 25, 34, 25, 31, 19);
      g.fillTriangle(13, 31, 35, 31, 24, 40);
      g.fillStyle(0xf07a22, 1);
      g.fillRect(19, 30, 4, 4);
      g.fillRect(26, 30, 4, 4);
    });

    make('chest', 44, 36, g => {
      g.fillStyle(0x6b3e1c, 1);
      g.fillRoundedRect(2, 4, 40, 30, 6);
      g.fillStyle(0x8f5a2c, 1);
      g.fillRect(4, 16, 36, 16);
      g.fillStyle(0xe0b030, 1);
      g.fillRect(2, 14, 40, 4);
      g.fillRect(19, 10, 6, 12);
      g.fillStyle(0x3a2410, 1);
      g.fillRect(21, 16, 2, 4);
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

    // White so it can be tinted red, blue or yellow.
    make('key', 40, 24, g => {
      g.fillStyle(0xffffff, 1);
      g.fillCircle(10, 12, 9);
      g.fillRect(16, 9, 22, 6);
      g.fillRect(28, 15, 4, 7);
      g.fillRect(34, 15, 4, 5);
      g.fillStyle(0x000000, 0.35);
      g.fillCircle(10, 12, 4);
    });

    // A soft round light, used to cut holes in the darkness of dark levels.
    make('light', 256, 256, g => {
      for (let r = 128; r > 0; r -= 4) {
        g.fillStyle(0xffffff, 0.05);
        g.fillCircle(128, 128, r);
      }
    });

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
