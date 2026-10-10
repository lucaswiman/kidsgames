import Phaser from 'phaser';
import {
  END_RADIUS,
  FLICK_SPEED,
  GAME_HEIGHT,
  GAME_WIDTH,
  ITEM_RADIUS,
  MAX_STRETCH,
  TILE,
} from '../logic/constants.js';
import { LEVELS, WORLDS } from '../levels/levels.js';
import { parseLevel } from '../logic/level.js';
import { Slime } from '../logic/slime.js';
import {
  buildLasers,
  chaserPosition,
  findHazard,
  laserState,
  touchedItems,
  touchingExit,
} from '../logic/hazards.js';
import { BOMB_FUSE, Boss, EXPLOSION_RADIUS, ROBOT_HEIGHT, ROBOT_WIDTH } from '../logic/boss.js';
import { BOULDER_RADIUS, CanyonStuff, windAmount } from '../logic/canyon.js';
import { Tongue, TONGUE_RADIUS } from '../logic/tongue.js';
import {
  hasTongue,
  loadProgress,
  recordFinish,
  saveProgress,
  scoreLevel,
} from '../logic/progress.js';
import { playMusic, sfx, unlockAudio } from '../audio/sound.js';
import {
  drawBackdrop,
  drawBackground,
  drawBox,
  drawCrumble,
  drawFluids,
  drawTiles,
  THEMES,
} from '../render/theme.js';
import { SlimeView } from '../render/slimeView.js';
import { makeButton, makeIconButton, makeMuteButton, textStyle } from '../render/ui.js';

// Add ?all to the address to unlock every level (and the tongue) for testing.
const UNLOCK_ALL = typeof location !== 'undefined' && /[?&]all\b/.test(location.search);

export const KEY_TINTS = { red: 0xff3b3b, blue: 0x3a8bff, yellow: 0xffd020 };

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  init(data) {
    this.levelIndex = data.levelIndex ?? 0;
  }

  create() {
    this.def = LEVELS[this.levelIndex];
    this.level = parseLevel(this.def);
    this.themeName = WORLDS.find(w => w.id === this.def.world).theme;
    this.theme = THEMES[this.themeName];
    this.status = 'playing';
    this.time_ = 0; // seconds since the level (or last respawn) started, for lasers/chasers
    this.clock = 0; // total seconds spent on the level, for the score
    this.deaths = 0;
    this.checkpoint = null;
    this.heldBomb = null;
    this.lockedMessageTimer = 0;

    playMusic(this.def.type === 'boss' ? 'boss' : this.themeName);

    drawBackground(this, this.theme);
    drawBackdrop(this, this.level, this.theme, this.themeName);
    drawTiles(this, this.level, this.theme, this.themeName);
    this.dynGfx = this.add.graphics().setDepth(1); // crumbling rocks, metal boxes
    this.fluidGfx = this.add.graphics().setDepth(5);
    this.fxGfx = this.add.graphics().setDepth(8);
    this.overGfx = this.add.graphics().setDepth(12);

    this.lasers = buildLasers(this.level);
    this.chaser = this.def.chaser || null;
    this.canyon = new CanyonStuff(this.level);
    this.tongue = new Tongue();
    this.tongueArmed = false;
    this.hasTongue = UNLOCK_ALL || hasTongue(loadProgress());
    this.windWasBlowing = false;
    this.windStreaks = [];
    this.windGfx = this.add.graphics().setScrollFactor(0).setDepth(150);
    this.createItems();

    this.slime = new Slime(this.level.start);
    this.slimeView = new SlimeView(this);
    this.boss = this.def.type === 'boss' ? new Boss(this.level) : null;
    this.bombSprites = new Map();

    this.setupCamera();
    this.createHud();
    this.setupInput();

    if (this.def.hint) {
      this.showBanner(this.def.hint, 4500);
    }
  }

  // ------------------------------------------------------------------ setup

  createItems() {
    const level = this.level;
    // Things inside metal boxes stay hidden until the box is eaten.
    const hidden = item => item.inBox !== undefined;
    this.tokens = level.tokens.map(t => {
      const sprite = this.add.image(t.x, t.y, 'token').setDepth(6).setVisible(!hidden(t));
      this.tweens.add({ targets: sprite, scaleX: 0.2, yoyo: true, repeat: -1, duration: 600 });
      return { ...t, sprite, taken: false };
    });
    this.cores = level.cores.map(c => {
      const sprite = this.add.image(c.x, c.y, 'core').setDepth(6).setVisible(!hidden(c));
      this.tweens.add({ targets: sprite, y: c.y - 6, yoyo: true, repeat: -1, duration: 800 });
      return { ...c, sprite, taken: false };
    });
    this.keySprites = this.canyon.keys.map(k => {
      const sprite = this.add
        .image(k.x, k.y, 'key')
        .setDepth(6)
        .setTint(KEY_TINTS[k.color])
        .setVisible(!hidden(k));
      this.tweens.add({ targets: sprite, angle: 12, yoyo: true, repeat: -1, duration: 700 });
      return sprite;
    });
    this.checkpoints = level.checkpoints.map(c => {
      const sprite = this.add.image(c.x, c.y, 'flag-off').setDepth(4);
      return { ...c, sprite, active: false };
    });
    if (level.exit) {
      const locked = this.def.type === 'collect';
      this.door = this.add
        .image(level.exit.x, level.exit.y + TILE / 2, locked ? 'door-locked' : 'door-open')
        .setOrigin(0.5, 1)
        .setDepth(3);
    }
  }

  setupCamera() {
    const cam = this.cameras.main;
    const { pixelWidth: w, pixelHeight: h } = this.level;
    // Small levels sit in the middle of the screen.
    const bx = w < GAME_WIDTH ? -(GAME_WIDTH - w) / 2 : 0;
    const by = h < GAME_HEIGHT ? -(GAME_HEIGHT - h) / 2 : 0;
    cam.setBounds(bx, by, Math.max(w, GAME_WIDTH), Math.max(h, GAME_HEIGHT));
    this.camTarget = this.add.zone(this.level.start.x, this.level.start.y, 1, 1);
    cam.startFollow(this.camTarget, true, 0.12, 0.12);
    cam.centerOn(this.level.start.x, this.level.start.y);
  }

  createHud() {
    const world = WORLDS.findIndex(w => w.id === this.def.world) + 1;
    this.add
      .text(20, 16, `${this.def.id}  ${this.def.name}`, textStyle(26, '#ffffff'))
      .setScrollFactor(0)
      .setDepth(200);
    this.hudItems = this.add
      .text(20, 52, '', textStyle(24, '#ffe066'))
      .setScrollFactor(0)
      .setDepth(200);
    this.worldNumber = world;
    makeIconButton(this, GAME_WIDTH - 50, 50, '☰', () => this.scene.start('Levels'));
    makeIconButton(this, GAME_WIDTH - 125, 50, '↻', () => this.restartLevel());
    makeMuteButton(this, GAME_WIDTH - 200, 50);
    if (this.hasTongue) {
      this.tongueButton = makeIconButton(this, GAME_WIDTH - 60, GAME_HEIGHT - 60, '👅', () =>
        this.armTongue(!this.tongueArmed)
      );
    }

    if (this.def.type === 'boss') {
      this.bossBar = this.add.graphics().setScrollFactor(0).setDepth(200);
      this.add
        .text(GAME_WIDTH / 2, 100, 'ROBOT', textStyle(22, '#ff8080'))
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(200);
    }
    this.updateHud();
  }

  armTongue(armed) {
    this.tongueArmed = armed;
    if (this.tongueButton) {
      this.tongueButton.setScale(armed ? 1.25 : 1);
      this.tongueButton.setAlpha(armed ? 1 : 0.85);
    }
  }

  updateHud() {
    const parts = [];
    if (this.tokens.length) {
      parts.push(`Tokens ${this.tokens.filter(t => t.taken).length}/${this.tokens.length}`);
    }
    if (this.cores.length) {
      parts.push(`Cores ${this.cores.filter(c => c.taken).length}/${this.cores.length}`);
    }
    this.hudItems.setText(parts.join('    '));
  }

  setupInput() {
    this.input.on('pointerdown', (pointer, over) => {
      unlockAudio();
      if (this.status !== 'playing' || over.length > 0) {
        return;
      }
      this.activePointer = pointer;
      if (this.tongueArmed && !this.slime.isFalling && !this.slime.heldEnd) {
        // Shoot the tongue out of the slime's head instead of stretching.
        this.tongue.start(this.slime.ends[this.slime.lead], this.worldPoint(pointer));
        this.armTongue(false);
        return;
      }
      this.slime.grab(this.worldPoint(pointer), this.clock);
    });
    const release = pointer => {
      if (pointer !== this.activePointer) {
        return;
      }
      this.activePointer = null;
      if (this.status !== 'playing') {
        return;
      }
      if (this.tongue.active) {
        this.tongue.release();
        return;
      }
      this.slime.moveFinger(this.worldPoint(pointer), this.clock);
      const velocity = this.slime.release(this.level);
      if (this.heldBomb) {
        const speed = Math.hypot(velocity.x, velocity.y);
        this.boss.releaseBomb(this.heldBomb, velocity, speed > FLICK_SPEED);
        this.heldBomb = null;
      }
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
  }

  worldPoint(pointer) {
    return this.cameras.main.getWorldPoint(pointer.x, pointer.y);
  }

  // ------------------------------------------------------------------- loop

  update(_t, delta) {
    const dt = Math.min(delta / 1000, 1 / 30);
    if (this.status === 'playing') {
      this.time_ += dt;
      this.clock += dt;
      if (this.activePointer && this.slime.heldEnd) {
        this.slime.moveFinger(this.worldPoint(this.activePointer), this.clock);
      }
      if (this.activePointer && this.tongue.state === 'out') {
        this.tongue.moveFinger(this.worldPoint(this.activePointer));
      }
      this.updateWind(dt);
      this.slime.update(dt, this.level);
      this.updateTongue(dt);
      const canyonHit = this.canyon.update(dt, this.slime);
      this.playSlimeSounds();
      this.playCanyonSounds();
      this.updateBoss(dt);
      this.checkPickups();
      this.checkExit(dt);
      const hazard = findHazard(this.level, this.slime, this.lasers, this.time_, this.chaser);
      if (canyonHit === 'boulder') {
        this.startCrush();
      } else if (hazard || canyonHit || this.bossHurtSlime) {
        this.die();
      }
    } else if (this.status === 'crushed') {
      this.updateCrush(dt);
    } else if (this.boss) {
      // Keep explosions animating after the fight ends.
      this.boss.update(dt, this.slime);
    }

    this.camTarget.setPosition(this.slime.center.x, this.slime.center.y);
    this.render(dt);
  }

  updateWind(dt) {
    const wind = this.def.wind;
    const amount = windAmount(wind, this.time_);
    this.windAmount = amount;
    this.slime.wind.x = wind ? wind.dir * wind.strength * amount : 0;
    const blowing = amount > 0.05;
    if (blowing && !this.windWasBlowing) {
      sfx.wind();
    }
    this.windWasBlowing = blowing;
    // Dust and leaves flying across the screen.
    if (wind) {
      const spawn = amount * 60 * dt * 6;
      for (let i = 0; i < spawn; i++) {
        this.windStreaks.push({
          x: wind.dir > 0 ? -40 : GAME_WIDTH + 40,
          y: Math.random() * GAME_HEIGHT,
          leaf: Math.random() < 0.3,
        });
      }
      for (const s of this.windStreaks) {
        s.x += wind.dir * (500 + 900 * amount) * dt;
        s.y += Math.sin(s.x * 0.02) * 40 * dt;
      }
      this.windStreaks = this.windStreaks.filter(s => s.x > -60 && s.x < GAME_WIDTH + 60);
    }
  }

  updateTongue(dt) {
    if (!this.tongue.active) {
      return;
    }
    const head = this.slime.ends[this.slime.lead];
    const eaten = this.tongue.update(dt, this.level, head, this.canyon.boxes);
    for (const e of this.tongue.takeEvents()) {
      if (e === 'tongue') {
        sfx.tongue();
      }
    }
    if (eaten === null) {
      return;
    }
    const item = this.canyon.eatBox(eaten, this.slime);
    const inside = list => list.find(it => it.inBox === eaten && !it.taken);
    if (item === 'token') {
      this.collect(inside(this.tokens));
      sfx.token();
    } else if (item === 'core') {
      this.collect(inside(this.cores));
      sfx.core();
      this.checkAllCores();
    }
  }

  playCanyonSounds() {
    for (const e of this.canyon.takeEvents()) {
      if (e === 'shake') {
        sfx.rumble();
      } else if (e === 'crumble') {
        sfx.crumble();
        this.cameras.main.shake(120, 0.004);
      } else if (e === 'key') {
        sfx.key();
        const color = this.canyon.carried[this.canyon.carried.length - 1];
        this.showBanner(`You got the ${color} key!`, 1600);
      } else if (e === 'gateOpen') {
        sfx.gateOpen();
        this.showBanner('The laser gate turned off!', 1600);
      } else if (e === 'eat') {
        sfx.chomp();
      } else if (e === 'boulder') {
        sfx.boulderCrack();
      } else if (e === 'thud') {
        sfx.thud();
        this.cameras.main.shake(150, 0.005);
      }
    }
    this.canyon.keys.forEach((k, i) => {
      if (k.taken && this.keySprites[i].active) {
        this.keySprites[i].destroy();
      }
    });
  }

  /** A boulder landed on the slime: it gets pushed down, then squished. */
  startCrush() {
    this.status = 'crushed';
    this.crushTime = 0;
    this.activePointer = null;
    this.tongue.state = 'idle';
    this.crushLastY = this.canyon.crushedBy.y;
  }

  updateCrush(dt) {
    this.crushTime += dt;
    this.canyon.updateBoulders(dt, this.slime);
    const b = this.canyon.crushedBy;
    const dy = b.y - this.crushLastY;
    this.crushLastY = b.y;
    for (const end of this.slime.ends) {
      end.y += dy;
    }
    if (b.state !== 'falling' || this.crushTime > 1) {
      this.die();
    }
  }

  playSlimeSounds() {
    for (const e of this.slime.takeEvents()) {
      if (e === 'grab') {
        sfx.grab();
      } else if (e === 'stick') {
        sfx.splorch();
      } else if (e === 'snap') {
        sfx.boing();
      } else if (e === 'land') {
        sfx.land();
      }
    }
  }

  updateBoss(dt) {
    this.bossHurtSlime = false;
    if (!this.boss) {
      return;
    }
    const end = this.slime.heldEnd;
    if (end && !this.heldBomb) {
      this.heldBomb = this.boss.grabBomb(end);
    }
    if (this.heldBomb && this.heldBomb.exploded) {
      this.heldBomb = null;
    }
    this.bossHurtSlime = this.boss.update(dt, this.slime);
    // A bomb that blew up while you were holding it gets you too.
    for (const e of this.boss.takeEvents()) {
      const sound = {
        throw: sfx.robotThrow,
        explode: sfx.explode,
        hit: sfx.robotHurt,
        defeated: sfx.robotHurt,
        blocked: sfx.clang,
        stomp: sfx.stomp,
        jump: sfx.jump,
        shieldUp: sfx.shield,
        throwBomb: sfx.throwBomb,
        grabBomb: sfx.grab,
      }[e];
      if (sound) {
        sound();
      }
      if (e === 'explode') {
        this.cameras.main.shake(150, 0.006);
      } else if (e === 'stomp') {
        this.cameras.main.shake(300, 0.012);
      } else if (e === 'hit') {
        this.showBanner(
          this.boss.phase === 2 ? 'Ouch! Now it stomps!' : 'Watch out for the shield!',
          2000
        );
      } else if (e === 'blocked') {
        this.showBanner('Blocked by the shield!', 1200);
      } else if (e === 'defeated') {
        this.time.delayedCall(1200, () => this.win());
        this.status = 'won-wait';
      }
    }
  }

  checkPickups() {
    for (const i of touchedItems(this.slime, this.tokens, ITEM_RADIUS)) {
      this.collect(this.tokens[i]);
      sfx.token();
    }
    for (const i of touchedItems(this.slime, this.cores, ITEM_RADIUS)) {
      this.collect(this.cores[i]);
      sfx.core();
      this.checkAllCores();
    }
    for (const cp of this.checkpoints) {
      if (!cp.active && touchedItems(this.slime, [cp], TILE / 2).length) {
        for (const other of this.checkpoints) {
          other.active = false;
          other.sprite.setTexture('flag-off');
        }
        cp.active = true;
        cp.sprite.setTexture('flag-on');
        this.checkpoint = cp;
        sfx.checkpoint();
        this.showBanner('Checkpoint!', 1200);
      }
    }
  }

  checkAllCores() {
    if (this.cores.every(c => c.taken)) {
      this.door.setTexture('door-open');
      this.showBanner('The door is open!', 2000);
    }
  }

  collect(item) {
    item.taken = true;
    item.sprite.setVisible(true);
    this.tweens.killTweensOf(item.sprite);
    this.tweens.add({
      targets: item.sprite,
      y: item.sprite.y - 40,
      alpha: 0,
      scale: 1.6,
      duration: 350,
      onComplete: () => item.sprite.destroy(),
    });
    this.updateHud();
  }

  checkExit(dt) {
    this.lockedMessageTimer -= dt;
    if (!this.level.exit || !touchingExit(this.slime, this.level.exit)) {
      return;
    }
    const missing = this.cores.filter(c => !c.taken).length;
    if (missing > 0) {
      if (this.lockedMessageTimer <= 0) {
        sfx.locked();
        this.showBanner(`Locked! Find ${missing} more power core${missing > 1 ? 's' : ''}.`, 1800);
        this.lockedMessageTimer = 2.5;
      }
      return;
    }
    this.win();
  }

  // ------------------------------------------------------------ dying/winning

  die() {
    this.status = 'dying';
    this.deaths += 1;
    this.heldBomb = null;
    this.activePointer = null;
    sfx.death();
    this.cameras.main.shake(200, 0.01);
    const c = this.slime.center;
    const drops = this.add.particles(c.x, c.y, 'drop', {
      speed: { min: 150, max: 400 },
      angle: { min: 200, max: 340 },
      gravityY: 900,
      lifespan: 900,
      scale: { start: 1, end: 0.3 },
      alpha: { start: 0.9, end: 0 },
      emitting: false,
    });
    drops.setDepth(11);
    drops.explode(24);
    this.slimeView.clear();
    this.slime.ends.forEach(e => {
      e.x = -9999;
      e.y = -9999;
    });
    this.time.delayedCall(1100, () => {
      drops.destroy();
      if (this.boss) {
        // Each hit on the robot is a checkpoint: it keeps its damage.
        this.boss.resetAfterSlimeDeath();
        if (this.boss.hp < 3) {
          const hp = this.boss.hp;
          this.showBanner(`The robot still has ${hp} hit${hp > 1 ? 's' : ''} left!`, 2000);
        }
      }
      this.respawn();
    });
  }

  respawn() {
    this.canyon.resetAfterDeath();
    this.tongue.state = 'idle';
    const spot = this.checkpoint
      ? { x: this.checkpoint.x, y: this.checkpoint.y }
      : { x: this.level.start.x, y: this.level.start.y };
    this.slime.spawn(spot);
    this.slime.takeEvents();
    this.time_ = 0;
    this.status = 'playing';
    this.cameras.main.centerOn(spot.x, spot.y);
  }

  restartLevel() {
    this.scene.restart({ levelIndex: this.levelIndex });
  }

  win() {
    if (this.status === 'won') {
      return;
    }
    this.status = 'won';
    this.activePointer = null;
    sfx.win();
    const tokens = this.tokens.filter(t => t.taken).length;
    const score = scoreLevel({ tokens, seconds: this.clock, deaths: this.deaths });
    const progress = loadProgress();
    const isBest = recordFinish(progress, this.levelIndex, this.def.id, { score, tokens });
    if (this.boss) {
      progress.tongue = true;
    }
    saveProgress(progress);
    this.showWinPanel({ tokens, score, isBest, best: progress.best[this.def.id].score });
  }

  showWinPanel({ tokens, score, isBest, best }) {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const isLast = this.levelIndex === LEVELS.length - 1;
    const panel = this.add.graphics().setScrollFactor(0).setDepth(300);
    panel.fillStyle(0x000000, 0.55);
    panel.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    panel.fillStyle(0x1e2c4a, 1);
    panel.fillRoundedRect(cx - 300, cy - 230, 600, 460, 30);
    panel.lineStyle(6, 0x7dff7a, 1);
    panel.strokeRoundedRect(cx - 300, cy - 230, 600, 460, 30);

    const title = this.boss ? 'You beat the robot!' : 'Level Complete!';
    const lines = [];
    if (this.tokens.length) {
      lines.push(`Tokens: ${tokens} / ${this.tokens.length}`);
    }
    lines.push(`Score: ${score}`);
    lines.push(isBest ? 'New best score!' : `Best: ${best}`);
    const fixed = obj => obj.setScrollFactor(0).setDepth(301);
    fixed(this.add.text(cx, cy - 170, title, textStyle(52, '#7dff7a')).setOrigin(0.5));
    fixed(
      this.add
        .text(cx, cy - 40, lines.join('\n'), textStyle(34, '#ffffff', { align: 'center' }))
        .setOrigin(0.5)
    );
    if (this.boss) {
      fixed(
        this.add.text(cx, cy + 70, 'You got a TONGUE! 👅', textStyle(32, '#ff9ad5')).setOrigin(0.5)
      );
    } else if (isLast) {
      fixed(
        this.add
          .text(cx, cy + 70, 'You finished Slimy Stretch!', textStyle(30, '#ffe066'))
          .setOrigin(0.5)
      );
    }

    const opts = { fixed: true, depth: 302, width: 170, height: 70, fontSize: 28 };
    makeButton(this, cx - 190, cy + 160, 'Levels', () => this.scene.start('Levels'), {
      ...opts,
      color: 0x3a5a9a,
    });
    makeButton(this, cx, cy + 160, 'Again', () => this.restartLevel(), {
      ...opts,
      color: 0x3a5a9a,
    });
    if (!isLast) {
      makeButton(
        this,
        cx + 190,
        cy + 160,
        'Next ➜',
        () => this.scene.start('Game', { levelIndex: this.levelIndex + 1 }),
        opts
      );
    }
  }

  showBanner(message, duration) {
    if (this.banner) {
      this.banner.destroy();
    }
    const text = this.add
      .text(
        GAME_WIDTH / 2,
        this.boss ? 200 : 140,
        message,
        textStyle(32, '#ffffff', {
          backgroundColor: '#00000088',
          padding: { x: 18, y: 10 },
          align: 'center',
          wordWrap: { width: GAME_WIDTH - 120 },
        })
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(250);
    this.banner = text;
    this.tweens.add({
      targets: text,
      alpha: 0,
      delay: duration,
      duration: 400,
      onComplete: () => text.destroy(),
    });
  }

  // ------------------------------------------------------------------ drawing

  render(dt) {
    this.drawCanyonTiles();
    this.drawWind();
    this.fluidGfx.clear();
    drawFluids(this.fluidGfx, this.level, this.clock);

    const fx = this.fxGfx;
    fx.clear();
    this.drawLasers(fx);
    this.drawGates(fx);
    this.drawTongue(fx);
    this.drawReach(fx);

    const over = this.overGfx;
    over.clear();
    this.drawChaser(over);
    this.drawBoulders(over);
    this.drawCarriedKeys(over);
    if (this.boss) {
      this.drawBoss(over);
      this.drawBombs();
    }

    const visible = ['playing', 'won', 'won-wait', 'crushed'];
    if (visible.includes(this.status)) {
      const look = this.slime.heldEnd ? this.slime.finger : this.slime.ends[1 - this.slime.lead];
      this.slimeView.draw(this.slime, dt, look);
    }
  }

  drawCanyonTiles() {
    const g = this.dynGfx;
    g.clear();
    for (const c of this.canyon.crumbles) {
      const x = c.col * TILE;
      const y = c.row * TILE;
      if (c.state === 'solid') {
        drawCrumble(g, x, y);
      } else if (c.state === 'shaking') {
        drawCrumble(g, x, y, 2 + (3 - c.timer) * 2);
      } else if (c.timer < 1) {
        // Fading back in just before it grows back.
        drawCrumble(g, x, y, 0, 0.35 * (1 - c.timer));
      }
    }
    this.canyon.boxes.forEach((b, i) => {
      if (b.eaten) {
        return;
      }
      if (this.tongue.carrying === i) {
        drawBox(g, this.tongue.tip.x - 15, this.tongue.tip.y - 15, 30);
      } else {
        drawBox(g, b.col * TILE, b.row * TILE);
      }
    });
    // Cracks in the ceiling that drop boulders, with dust falling as a warning.
    for (const s of this.canyon.spawners) {
      const x = s.col * TILE;
      const y = s.row * TILE;
      g.lineStyle(4, 0x3a1a0a, 1);
      g.lineBetween(x + 12, y + TILE, x + 22, y + TILE - 16);
      g.lineBetween(x + 22, y + TILE - 16, x + 30, y + TILE - 4);
      g.lineBetween(x + 30, y + TILE - 4, x + 38, y + TILE - 14);
      if (this.canyon.isWarning(s)) {
        g.fillStyle(0xd9b08c, 0.9);
        for (let i = 0; i < 6; i++) {
          const fall = ((this.clock * 120 + i * 37) % 90) + 4;
          g.fillCircle(x + 10 + ((i * 13) % 30), y + TILE + fall, 2.5);
        }
      }
    }
  }

  drawGates(g) {
    const level = this.level;
    const blocks = (col, row) => {
      const kind = level.tiles[row] && level.tiles[row][col];
      return kind !== undefined && kind !== 0;
    };
    const isGate = (col, row) =>
      this.canyon.gates.some(o => o.col === col && o.row === row && !o.open);
    for (const gate of this.canyon.gates) {
      if (gate.open) {
        continue;
      }
      const cx = (gate.col + 0.5) * TILE;
      const cy = (gate.row + 0.5) * TILE;
      // Gates run up-and-down unless they're part of a sideways line.
      const vertical =
        isGate(gate.col, gate.row - 1) ||
        isGate(gate.col, gate.row + 1) ||
        blocks(gate.col, gate.row - 1) ||
        blocks(gate.col, gate.row + 1);
      const half = TILE / 2;
      const [x1, y1, x2, y2] = vertical
        ? [cx, cy - half, cx, cy + half]
        : [cx - half, cy, cx + half, cy];
      const color = KEY_TINTS[gate.color];
      const flicker = 0.75 + Math.random() * 0.25;
      g.lineStyle(18, color, 0.25 * flicker);
      g.lineBetween(x1, y1, x2, y2);
      g.lineStyle(7, color, flicker);
      g.lineBetween(x1, y1, x2, y2);
      g.lineStyle(2, 0xffffff, 0.9);
      g.lineBetween(x1, y1, x2, y2);
    }
  }

  drawTongue(g) {
    if (!this.tongue.active) {
      return;
    }
    const head = this.slime.ends[this.slime.lead];
    const tip = this.tongue.tip;
    g.lineStyle(10, 0xd94a7a, 1);
    g.lineBetween(head.x, head.y + 4, tip.x, tip.y);
    g.lineStyle(5, 0xff8ab5, 1);
    g.lineBetween(head.x, head.y + 4, tip.x, tip.y);
    g.fillStyle(0xff8ab5, 1);
    g.fillCircle(tip.x, tip.y, TONGUE_RADIUS);
  }

  drawBoulders(g) {
    for (const b of this.canyon.boulders) {
      const fade = b.state === 'landed' ? Math.max(0, 1 - b.age / 1.2) : 1;
      g.fillStyle(0x7a5236, fade);
      g.fillCircle(b.x, b.y, BOULDER_RADIUS);
      g.fillStyle(0x5a3a24, fade);
      g.fillCircle(b.x + 7, b.y + 6, 6);
      g.fillCircle(b.x - 8, b.y - 2, 4);
      g.fillStyle(0xb08060, fade);
      g.fillCircle(b.x - 7, b.y - 9, 5);
    }
  }

  drawCarriedKeys(g) {
    const carried = this.canyon.carried;
    if (!carried.length || !['playing', 'won', 'won-wait'].includes(this.status)) {
      return;
    }
    const c = this.slime.center;
    carried.forEach((color, i) => {
      const x = c.x - (carried.length - 1) * 12 + i * 24;
      const y = c.y - 34 + Math.sin(this.clock * 4 + i) * 3;
      g.fillStyle(KEY_TINTS[color], 1);
      g.fillCircle(x - 5, y, 6);
      g.fillRect(x, y - 2, 12, 4);
      g.fillRect(x + 8, y + 2, 3, 4);
    });
  }

  drawWind() {
    const g = this.windGfx;
    g.clear();
    if (!this.def.wind) {
      return;
    }
    for (const s of this.windStreaks) {
      if (s.leaf) {
        g.fillStyle(0x8a9a3a, 0.9);
        g.fillEllipse(s.x, s.y, 10, 5);
      } else {
        g.lineStyle(2, 0xfff3dd, 0.5);
        g.lineBetween(s.x, s.y, s.x - this.def.wind.dir * 40, s.y);
      }
    }
  }

  drawLasers(g) {
    for (const laser of this.lasers) {
      const state = laserState(laser, this.time_);
      const { from, to } = laser;
      // Red lens on the emitter.
      g.fillStyle(state === 'off' ? 0x661111 : 0xff2222, 1);
      g.fillCircle(from.x - laser.dx * 8, from.y - laser.dy * 8, 7);
      if (state === 'on') {
        const flicker = 0.8 + Math.random() * 0.2;
        g.lineStyle(16, 0xff0000, 0.25 * flicker);
        g.lineBetween(from.x, from.y, to.x, to.y);
        g.lineStyle(6, 0xff3030, flicker);
        g.lineBetween(from.x, from.y, to.x, to.y);
        g.lineStyle(2, 0xffffff, 0.9);
        g.lineBetween(from.x, from.y, to.x, to.y);
      } else if (state === 'warn') {
        g.lineStyle(2, 0xff5050, Math.random() < 0.5 ? 0.5 : 0.15);
        g.lineBetween(from.x, from.y, to.x, to.y);
      }
    }
  }

  /** While dragging, show how far the slime can reach. */
  drawReach(g) {
    const anchor = this.slime.anchor;
    if (!anchor || this.status !== 'playing') {
      return;
    }
    g.lineStyle(3, 0xffffff, 0.25);
    g.strokeCircle(anchor.x, anchor.y, MAX_STRETCH + END_RADIUS);
  }

  drawChaser(g) {
    if (!this.chaser) {
      return;
    }
    const pos = chaserPosition(this.chaser, this.level, this.time_);
    const cam = this.cameras.main;
    if (this.chaser.kind === 'rise') {
      const lava = this.chaser.fluid === 'lava';
      const bottom = Math.max(this.level.pixelHeight, cam.scrollY + GAME_HEIGHT) + TILE;
      const left = Math.min(0, cam.scrollX);
      const right = Math.max(this.level.pixelWidth, cam.scrollX + GAME_WIDTH);
      g.fillStyle(lava ? 0xff5a00 : 0x2f8fff, lava ? 0.95 : 0.75);
      g.fillRect(left, pos.y, right - left, bottom - pos.y);
      g.fillStyle(lava ? 0xffd040 : 0xbfe6ff, 1);
      for (let x = left; x < right; x += 24) {
        const wave = Math.sin(this.clock * 4 + x * 0.05) * 4;
        g.fillRect(x, pos.y + wave - 3, 24, 6);
      }
    } else {
      // A big rolling snowball.
      const angle = (pos.x / pos.radius) % (Math.PI * 2);
      g.fillStyle(0xf4fbff, 1);
      g.fillCircle(pos.x, pos.y, pos.radius);
      g.lineStyle(6, 0xbcd8ea, 1);
      g.strokeCircle(pos.x, pos.y, pos.radius);
      g.fillStyle(0xcfe4f2, 1);
      for (let i = 0; i < 4; i++) {
        const a = angle + (i * Math.PI) / 2;
        g.fillCircle(
          pos.x + Math.cos(a) * pos.radius * 0.55,
          pos.y + Math.sin(a) * pos.radius * 0.55,
          pos.radius * 0.15
        );
      }
    }
  }

  drawBoss(g) {
    const boss = this.boss;
    const r = boss.rect;
    // Warning shadow where the stomp will land.
    if (boss.state === 'stompAim' || boss.state === 'stompDown') {
      g.fillStyle(0x000000, 0.35);
      g.fillEllipse(boss.stompTargetX, boss.homeY - 6, ROBOT_WIDTH * 1.2, 22);
      g.lineStyle(3, 0xff3030, 0.4 + 0.4 * Math.sin(this.clock * 20));
      g.strokeEllipse(boss.stompTargetX, boss.homeY - 6, ROBOT_WIDTH * 1.2, 22);
    }
    if (boss.defeated) {
      // Broken robot pieces.
      g.fillStyle(0x555b66, 1);
      g.fillRect(r.left, r.bottom - 40, ROBOT_WIDTH, 40);
      g.fillStyle(0x333333, 1);
      g.fillCircle(r.left + 30, r.bottom - 50, 18);
      g.fillCircle(r.right - 20, r.bottom - 45, 12);
    } else {
      const flash = boss.hurtTime > 0 && Math.floor(this.clock * 20) % 2 === 0;
      const body = flash ? 0xffffff : 0x8a93a6;
      const dark = flash ? 0xffffff : 0x4d5566;
      // Legs
      g.fillStyle(dark, 1);
      g.fillRect(r.left + 15, r.bottom - 45, 28, 45);
      g.fillRect(r.right - 43, r.bottom - 45, 28, 45);
      // Body
      g.fillStyle(body, 1);
      g.fillRoundedRect(r.left, r.top + 50, ROBOT_WIDTH, ROBOT_HEIGHT - 95, 12);
      // Arms
      g.fillStyle(dark, 1);
      g.fillRect(r.left - 18, r.top + 60, 18, 60);
      g.fillRect(r.right, r.top + 60, 18, 60);
      // Head with a big angry red eye
      g.fillStyle(body, 1);
      g.fillRoundedRect(r.left + 20, r.top, ROBOT_WIDTH - 40, 52, 10);
      g.fillStyle(0x220000, 1);
      g.fillRect(r.left + 30, r.top + 16, ROBOT_WIDTH - 60, 18);
      g.fillStyle(0xff2020, 1);
      const eyeX = Phaser.Math.Clamp(this.slime.center.x, r.left + 40, r.right - 40);
      g.fillCircle(eyeX, r.top + 25, 8);
      // Antenna
      g.lineStyle(4, dark, 1);
      g.lineBetween(boss.x, r.top, boss.x, r.top - 20);
      g.fillStyle(0xff4040, 1);
      g.fillCircle(boss.x, r.top - 22, 6);
      // Lava-orange chest light shows its phase.
      g.fillStyle([0, 0x40ff60, 0xffc030, 0xff3030][boss.phase], 1);
      g.fillCircle(boss.x, r.top + 95, 12);
      if (boss.shieldOn) {
        g.fillStyle(0x40c0ff, 0.25);
        g.fillCircle(boss.x, r.top + ROBOT_HEIGHT / 2, ROBOT_HEIGHT * 0.7);
        g.lineStyle(5, 0x80e0ff, 0.9);
        g.strokeCircle(boss.x, r.top + ROBOT_HEIGHT / 2, ROBOT_HEIGHT * 0.7);
      }
    }

    // Explosions
    for (const e of boss.explosions) {
      const k = e.age / 0.5;
      g.fillStyle(0xffd040, 1 - k);
      g.fillCircle(e.x, e.y, EXPLOSION_RADIUS * (0.4 + k * 0.6));
      g.fillStyle(0xff5000, (1 - k) * 0.8);
      g.fillCircle(e.x, e.y, EXPLOSION_RADIUS * (0.2 + k * 0.5));
    }

    // Health bar
    const bar = this.bossBar;
    bar.clear();
    for (let i = 0; i < 3; i++) {
      bar.fillStyle(i < boss.hp ? 0xff4040 : 0x442222, 1);
      bar.fillRoundedRect(GAME_WIDTH / 2 - 105 + i * 72, 120, 66, 20, 6);
    }
  }

  drawBombs() {
    const live = new Set();
    for (const bomb of this.boss.bombs) {
      live.add(bomb);
      let sprite = this.bombSprites.get(bomb);
      if (!sprite) {
        sprite = this.add.image(bomb.x, bomb.y, 'bomb').setDepth(9);
        this.bombSprites.set(bomb, sprite);
      }
      sprite.setPosition(bomb.x, bomb.y - 4);
      // Blink red faster as the fuse runs out.
      const rate = 4 + (1 - bomb.fuse / BOMB_FUSE) * 16;
      sprite.setTint(Math.sin(this.clock * rate) > 0.3 ? 0xff6060 : 0xffffff);
    }
    for (const [bomb, sprite] of this.bombSprites) {
      if (!live.has(bomb)) {
        sprite.destroy();
        this.bombSprites.delete(bomb);
      }
    }
  }
}
