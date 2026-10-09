import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './logic/constants.js';
import BootScene from './scenes/BootScene.js';
import TitleScene from './scenes/TitleScene.js';
import LevelSelectScene from './scenes/LevelSelectScene.js';
import GameScene from './scenes/GameScene.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#141a33',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  input: {
    activePointers: 2,
  },
  scene: [BootScene, TitleScene, LevelSelectScene, GameScene],
});

// Handy for automated tests and poking around in the browser console.
window.slimyStretch = game;

// Save the game on the device so it works offline from the iPad Home Screen.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Still playable online without it.
    });
  });
}
