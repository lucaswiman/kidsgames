import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // Load assets here (spritesheets, audio, tilemaps)
  }

  create() {
    this.scene.start('MainMenuScene');
  }
}
