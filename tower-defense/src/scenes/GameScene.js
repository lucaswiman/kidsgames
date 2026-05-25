import Phaser from 'phaser';
import Tower from '../entities/Tower.js';
import Enemy from '../entities/Enemy.js';
import { saveHighScore, loadHighScore } from '../utils/storage.js';
import { enemiesForWave, SPAWN_INTERVAL_MS } from '../logic/waveLogic.js';

// Waypoints enemies walk through (pixel coords)
const PATH_POINTS = [
  { x: 0, y: 300 },
  { x: 200, y: 300 },
  { x: 200, y: 100 },
  { x: 600, y: 100 },
  { x: 600, y: 500 },
  { x: 800, y: 500 },
];

const GRID_SIZE = 40;
const STARTING_GOLD = 150;
const TOWER_COST = 50;

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    this.gold = STARTING_GOLD;
    this.lives = 20;
    this.wave = 0;
    this.score = 0;
    this.towers = [];
    this.enemies = [];
    this.placingTower = false;

    this._buildPath();
    this._buildGrid();
    this._buildUI();
    this._bindInput();

    this.time.addEvent({
      delay: 3000,
      callback: this._startWave,
      callbackScope: this,
      loop: true,
    });
  }

  update(time, delta) {
    let uiDirty = false;
    const alive = [];
    for (const enemy of this.enemies) {
      enemy.update(delta);
      if (enemy.reachedEnd()) {
        this.lives -= 1;
        uiDirty = true;
        enemy.destroy();
        if (this.lives <= 0) {
          this._gameOver();
          return;
        }
      } else if (!enemy.isDead()) {
        alive.push(enemy);
      } else {
        this.gold += enemy.reward;
        this.score += enemy.reward;
        uiDirty = true;
        enemy.destroy();
      }
    }
    this.enemies = alive;
    if (uiDirty) this._updateUI();

    for (const tower of this.towers) {
      tower.update(this.enemies);
    }
  }

  _buildPath() {
    const graphics = this.add.graphics();
    graphics.lineStyle(GRID_SIZE, 0x8b7355, 1);
    graphics.beginPath();
    graphics.moveTo(PATH_POINTS[0].x, PATH_POINTS[0].y);
    this.path = new Phaser.Curves.Path(PATH_POINTS[0].x, PATH_POINTS[0].y);
    for (let i = 1; i < PATH_POINTS.length; i++) {
      graphics.lineTo(PATH_POINTS[i].x, PATH_POINTS[i].y);
      this.path.lineTo(PATH_POINTS[i].x, PATH_POINTS[i].y);
    }
    graphics.strokePath();
  }

  _buildGrid() {
    this.occupiedCells = new Set();
    for (let i = 0; i < PATH_POINTS.length - 1; i++) {
      const a = PATH_POINTS[i];
      const b = PATH_POINTS[i + 1];
      const c1 = Math.floor(a.x / GRID_SIZE);
      const r1 = Math.floor(a.y / GRID_SIZE);
      const c2 = Math.floor(b.x / GRID_SIZE);
      const r2 = Math.floor(b.y / GRID_SIZE);
      for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
        for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
          this.occupiedCells.add(`${c},${r}`);
        }
      }
    }

    this.preview = this.add.rectangle(0, 0, GRID_SIZE - 4, GRID_SIZE - 4, 0x00ff00, 0.4);
    this.preview.setVisible(false);
  }

  _buildUI() {
    this.uiText = this.add
      .text(10, 10, '', { fontSize: '16px', color: '#ffffff', backgroundColor: '#00000080' })
      .setPadding(6);

    const btnStyle = { fontSize: '14px', color: '#000000', backgroundColor: '#ffd700' };

    this.buyBtn = this.add
      .text(660, 10, '  Buy Tower ($50)  ', btnStyle)
      .setPadding(6)
      .setInteractive({ useHandCursor: true });

    this.buyBtn.on('pointerdown', () => {
      this.placingTower = !this.placingTower;
      this.preview.setVisible(this.placingTower);
      this.buyBtn.setStyle({
        ...btnStyle,
        backgroundColor: this.placingTower ? '#ff9900' : '#ffd700',
      });
    });

    this._updateUI();
  }

  _updateUI() {
    this.uiText.setText(
      `Gold: ${this.gold}  |  Lives: ${this.lives}  |  Wave: ${this.wave}  |  Score: ${this.score}`
    );
  }

  _bindInput() {
    this.input.on('pointermove', ptr => {
      if (!this.placingTower) return;
      const col = Math.floor(ptr.x / GRID_SIZE);
      const row = Math.floor(ptr.y / GRID_SIZE);
      const cx = col * GRID_SIZE + GRID_SIZE / 2;
      const cy = row * GRID_SIZE + GRID_SIZE / 2;
      this.preview.setPosition(cx, cy);
      const ok = !this.occupiedCells.has(`${col},${row}`);
      this.preview.setFillStyle(ok ? 0x00ff00 : 0xff0000, 0.4);
    });

    this.input.on('pointerdown', ptr => {
      if (!this.placingTower) return;
      if (ptr.y < 40) return; // UI row
      const col = Math.floor(ptr.x / GRID_SIZE);
      const row = Math.floor(ptr.y / GRID_SIZE);
      const key = `${col},${row}`;
      if (this.occupiedCells.has(key)) return;
      if (this.gold < TOWER_COST) return;

      const cx = col * GRID_SIZE + GRID_SIZE / 2;
      const cy = row * GRID_SIZE + GRID_SIZE / 2;
      const tower = new Tower(this, cx, cy);
      this.towers.push(tower);
      this.occupiedCells.add(key);
      this.gold -= TOWER_COST;
      this._updateUI();
    });
  }

  _startWave() {
    this.wave += 1;
    this._updateUI();
    const count = enemiesForWave(this.wave);
    for (let i = 0; i < count; i++) {
      this.time.delayedCall(i * SPAWN_INTERVAL_MS, () => {
        if (!this.scene.isActive('GameScene')) return;
        this.enemies.push(new Enemy(this, this.path, this.wave));
      });
    }
  }

  _gameOver() {
    saveHighScore(this.wave);
    this.scene.pause();
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, 400, 220, 0x000000, 0.85).setDepth(10);
    this.add
      .text(width / 2, height / 2 - 60, 'Game Over', {
        fontSize: '40px',
        color: '#ff4444',
      })
      .setOrigin(0.5)
      .setDepth(11);
    this.add
      .text(width / 2, height / 2, `You reached Wave ${this.wave}`, {
        fontSize: '22px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(11);

    const best = loadHighScore();
    this.add
      .text(width / 2, height / 2 + 40, `Best: Wave ${best}`, {
        fontSize: '18px',
        color: '#aaaaaa',
      })
      .setOrigin(0.5)
      .setDepth(11);

    this.add
      .text(width / 2, height / 2 + 80, 'Click to restart', {
        fontSize: '18px',
        color: '#ffd700',
      })
      .setOrigin(0.5)
      .setDepth(11)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('MainMenuScene'));
  }
}
