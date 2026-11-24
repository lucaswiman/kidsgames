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

    this.add.text(GAME_WIDTH / 2, 48, 'Pick a Level', textStyle(52, '#7dff7a')).setOrigin(0.5);

    // Fit all the worlds on one screen: in two columns once there are lots.
    // (Up to 12 worlds fit, in 6 rows, with buttons still big enough to tap.)
    const columns = WORLDS.length > 6 ? 2 : 1;
    const rows = Math.ceil(WORLDS.length / columns);
    const firstTop = 96;
    const rowHeight = (GAME_HEIGHT - firstTop - 6) / rows;
    const bandHeight = rowHeight - 8;
    const gap = 16;
    const bandWidth = (GAME_WIDTH - 80 - (columns - 1) * gap) / columns;
    const perWorld = WORLDS.map(w => LEVELS.filter(l => l.world === w.id).length);
    const slot = (bandWidth - 48) / Math.max(...perWorld);
    const buttonWidth = Math.min(140, slot - (columns > 1 ? 10 : 50));
    const titleSize = rowHeight < 120 ? 22 : 26;
    const buttonHeight = Math.min(60, rowHeight - 66);
    WORLDS.forEach((world, w) => {
      const left = 40 + Math.floor(w / rows) * (bandWidth + gap);
      const top = firstTop + (w % rows) * rowHeight;
      const y = top + titleSize + 14 + buttonHeight / 2; // middle of the level buttons
      const theme = THEMES[world.theme];
      const band = this.add.graphics();
      band.fillStyle(theme.skyBottom, 0.9);
      band.fillRoundedRect(left, top, bandWidth, bandHeight, 20);
      band.fillStyle(theme.wall, 1);
      band.fillRoundedRect(left, top + bandHeight - 6, bandWidth, 6, {
        tl: 0,
        tr: 0,
        bl: 6,
        br: 6,
      });
      this.add
        .text(left + 24, top + 4, `World ${w + 1}: ${world.name}`, textStyle(titleSize, '#ffffff'))
        .setOrigin(0, 0);

      const levels = LEVELS.map((l, i) => ({ ...l, index: i })).filter(l => l.world === world.id);
      levels.forEach((level, k) => {
        const x = left + 24 + slot * (k + 0.5);
        const unlocked = UNLOCK_ALL || level.index < progress.unlocked;
        const best = progress.best[level.id];
        const bossIcon = { crystal: '💎', machine: '🏭' }[level.boss] || '🤖';
        const label = unlocked ? (level.type === 'boss' ? bossIcon : level.id) : '🔒';
        makeButton(
          this,
          x,
          y,
          label,
          () => {
            if (unlocked) {
              this.scene.start('Game', { levelIndex: level.index });
            }
          },
          {
            width: buttonWidth,
            height: buttonHeight,
            fontSize: 26,
            color: unlocked ? 0x2fae4a : 0x555a66,
          }
        );
        if (best && columns > 1) {
          // No room beside the button, so the best score goes under it.
          this.add
            .text(x, y + buttonHeight / 2 + 8, `★ ${best.score}`, textStyle(14, '#ffe066'))
            .setOrigin(0.5);
        } else if (best) {
          this.add.text(x + 96, y, `★\n${best.score}`, textStyle(16, '#ffe066')).setOrigin(0.5);
        }
      });
    });

    makeIconButton(this, 50, 50, '⬅', () => this.scene.start('Title'));
    makeMuteButton(this, GAME_WIDTH - 50, 50);
  }
}
