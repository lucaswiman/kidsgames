import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../logic/constants.js';
import { playMusic, unlockAudio } from '../audio/sound.js';
import { Slime } from '../logic/slime.js';
import { SlimeView } from '../render/slimeView.js';
import { makeButton, makeMuteButton, textStyle } from '../render/ui.js';

export default class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x141a33, 0x141a33, 0x2a6a3a, 0x2a6a3a, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const title = this.add
      .text(GAME_WIDTH / 2, 170, 'Slimy Stretch', textStyle(96, '#7dff7a', { strokeThickness: 14 }))
      .setOrigin(0.5);
    this.tweens.add({
      targets: title,
      scaleX: 1.06,
      scaleY: 0.95,
      yoyo: true,
      repeat: -1,
      duration: 700,
      ease: 'Sine.easeInOut',
    });

    // A demo slime stretching back and forth under the title.
    this.slime = new Slime({ x: GAME_WIDTH / 2 - 80, y: 380 });
    this.slime.falling = null;
    this.view = new SlimeView(this);
    this.demoTime = 0;

    makeButton(
      this,
      GAME_WIDTH / 2,
      540,
      'Play!',
      () => {
        unlockAudio();
        playMusic('menu');
        this.scene.start('Levels');
      },
      { width: 280, height: 90, fontSize: 48 }
    );

    this.add.text(GAME_WIDTH / 2, 700, 'A game by Berty', textStyle(28, '#ffffff')).setOrigin(0.5);
    makeMuteButton(this, GAME_WIDTH - 50, 50);
  }

  update(_time, delta) {
    const dt = delta / 1000;
    this.demoTime += dt;
    const s = (Math.sin(this.demoTime * 1.6) + 1) / 2;
    const [a, b] = this.slime.ends;
    a.x = GAME_WIDTH / 2 - 120;
    a.y = 380;
    b.x = a.x + 30 + s * 200;
    b.y = 380 - Math.sin(s * Math.PI) * 50;
    this.slime.lead = 1;
    this.view.draw(this.slime, dt, { x: b.x + 50, y: b.y });
  }
}
