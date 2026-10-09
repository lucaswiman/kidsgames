import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../logic/constants.js';
import { LEVELS, WORLDS } from '../levels/levels.js';
import { loadProgress } from '../logic/progress.js';
import { playMusic } from '../audio/sound.js';
import { THEMES } from '../render/theme.js';
import { makeButton, makeIconButton, makeMuteButton, textStyle } from '../render/ui.js';

// Add ?all to the address to unlock every level (handy for testing).
const UNLOCK_ALL = typeof location !== 'undefined' && /[?&]all\b/.test(location.search);

export default class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super('Levels');
  }

  create() {
    playMusic('menu');
    const progress = loadProgress();
    const g = this.add.graphics();
    g.fillGradientStyle(0x141a33, 0x141a33, 0x1f4a2c, 0x1f4a2c, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.add.text(GAME_WIDTH / 2, 60, 'Pick a Level', textStyle(56, '#7dff7a')).setOrigin(0.5);

    WORLDS.forEach((world, w) => {
      const y = 190 + w * 190;
      const theme = THEMES[world.theme];
      const band = this.add.graphics();
      band.fillStyle(theme.skyBottom, 0.9);
      band.fillRoundedRect(40, y - 70, GAME_WIDTH - 80, 160, 24);
      band.fillStyle(theme.wall, 1);
      band.fillRoundedRect(40, y + 60, GAME_WIDTH - 80, 30, { tl: 0, tr: 0, bl: 24, br: 24 });
      this.add
        .text(70, y - 55, `World ${w + 1}: ${world.name}`, textStyle(32, '#ffffff'))
        .setOrigin(0, 0);

      const levels = LEVELS.map((l, i) => ({ ...l, index: i })).filter(l => l.world === world.id);
      levels.forEach((level, k) => {
        const x = 150 + k * 190;
        const unlocked = UNLOCK_ALL || level.index < progress.unlocked;
        const best = progress.best[level.id];
        const label = unlocked ? (level.type === 'boss' ? '🤖' : level.id) : '🔒';
        makeButton(
          this,
          x,
          y + 20,
          label,
          () => {
            if (unlocked) {
              this.scene.start('Game', { levelIndex: level.index });
            }
          },
          { width: 150, height: 74, fontSize: 32, color: unlocked ? 0x2fae4a : 0x555a66 }
        );
        if (best) {
          this.add.text(x, y + 70, `★ ${best.score}`, textStyle(20, '#ffe066')).setOrigin(0.5);
        }
      });
    });

    makeIconButton(this, 50, 50, '⬅', () => this.scene.start('Title'));
    makeMuteButton(this, GAME_WIDTH - 50, 50);
  }
}
