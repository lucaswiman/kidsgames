import Phaser from 'phaser';
import { loadHighScore } from '../utils/storage.js';

export default class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenuScene');
  }

  create() {
    const { width, height } = this.scale;

    this.add
      .text(width / 2, height / 2 - 80, 'Tower Defense', {
        fontSize: '48px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    const highScore = loadHighScore();
    if (highScore > 0) {
      this.add
        .text(width / 2, height / 2 - 20, `Best: Wave ${highScore}`, {
          fontSize: '20px',
          color: '#aaaaaa',
        })
        .setOrigin(0.5);
    }

    const startBtn = this.add
      .text(width / 2, height / 2 + 60, '▶  Start Game', {
        fontSize: '28px',
        color: '#ffd700',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    startBtn.on('pointerover', () => startBtn.setColor('#ffffff'));
    startBtn.on('pointerout', () => startBtn.setColor('#ffd700'));
    startBtn.on('pointerdown', () => this.scene.start('GameScene'));
  }
}
