import Phaser from 'phaser';
import {
  END_RADIUS,
  FLICK_SPEED,
  GAME_HEIGHT,
  GAME_WIDTH,
  ITEM_RADIUS,
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
import { CLAW_RADIUS, simulateShot, TONGUE_SORE_TIME, WarehouseStuff } from '../logic/warehouse.js';
import { TileKind } from '../logic/level.js';
import { batPosition, CaveStuff, PICK_RADIUS, pickaxe } from '../logic/cave.js';
import { BLOB_RADIUS, SlimeShots } from '../logic/slimeShot.js';
import { CRYSTAL_WIDTH, CrystalBoss, SHARD_RADIUS } from '../logic/crystalBoss.js';
import {
  CHEST_TOKENS,
  CRAB_RADIUS,
  GULL_GRAB_RADIUS,
  IslandStuff,
  WAVE_DEPTH,
  waveState,
} from '../logic/island.js';
import {
  JungleStuff,
  LOG_WIDTH,
  MONKEY_RADIUS,
  SNAKE_RADIUS,
  vineTip,
  ZIP_GRIP,
} from '../logic/jungle.js';
import { FactoryStuff } from '../logic/factory.js';
import { SkyStuff } from '../logic/sky.js';
import { BigMachine } from '../logic/bigMachine.js';
import { SAFE_TIME, SafeTrail, SPLIT_REACH, touching } from '../logic/split.js';
import {
  hasCaveRewards,
  hasSplit,
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
  drawBelt,
  drawBox,
  drawBridge,
  drawCrumble,
  drawFlower,
  drawHammock,
  drawFluids,
  drawLeafyTrap,
  drawTippingLeaf,
  drawTiles,
  THEMES,
} from '../render/theme.js';
import { SlimeView } from '../render/slimeView.js';
import { drawBigMachine, drawFactory } from '../render/factoryView.js';
import { drawSky, drawSkyBehind, drawSkyTiles } from '../render/skyView.js';
import { makeButton, makeIconButton, makeMuteButton, textStyle } from '../render/ui.js';

// Add ?all to the address to unlock every level (and the tongue) for testing.
const UNLOCK_ALL = typeof location !== 'undefined' && /[?&]all\b/.test(location.search);

export const KEY_TINTS = { red: 0xff3b3b, blue: 0x3a8bff, yellow: 0xffd020 };

// What collect levels have you collect in each world.
const PRIZES = {
  lab: { texture: 'core', name: 'power core', label: 'Cores' },
  island: { texture: 'pearl', name: 'pearl', label: 'Pearls' },
  jungle: { texture: 'idol', name: 'golden idol', label: 'Idols' },
  sky: { texture: 'star', name: 'star', label: 'Stars' },
};

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
    this.factory = new FactoryStuff(this.level);
    this.sky = new SkyStuff(this.level);
    this.isBoss = this.def.type === 'boss';

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
    this.warehouse = new WarehouseStuff(this.level);
    this.aiming = false;
    this.aimPath = null;
    this.bombBlasts = [];
    this.belts = [];
    this.swingTiles = []; // rope bridges, hammocks and flowers, which sag under the slime
    this.level.tiles.forEach((row, r) =>
      row.forEach((kind, c) => {
        if (kind === TileKind.BELT_RIGHT || kind === TileKind.BELT_LEFT) {
          this.belts.push({ col: c, row: r, dir: kind === TileKind.BELT_RIGHT ? 1 : -1 });
        }
        if (kind === TileKind.BRIDGE || kind === TileKind.HAMMOCK || kind === TileKind.FLOWER) {
          this.swingTiles.push({ col: c, row: r, kind });
        }
      })
    );
    this.tongue = new Tongue();
    this.tongueArmed = false;
    this.hasTongue = UNLOCK_ALL || hasTongue(loadProgress());
    // Rewards for beating the crystal robot.
    this.hasCaveRewards = UNLOCK_ALL || hasCaveRewards(loadProgress());
    this.shots = new SlimeShots();
    this.shotArmed = false;
    this.windWasBlowing = false;
    this.windStreaks = [];
    this.windGfx = this.add.graphics().setScrollFactor(0).setDepth(150);
    this.island = new IslandStuff(this.level);
    this.waveWasWarning = false;
    this.jungle = new JungleStuff(this.level);
    this.pumping = false; // dragging to pump a vine
    this.tongueBanana = false; // a banana on the end of the tongue
    this.hintsShown = new Set();
    this.createItems();

    this.slime = new Slime(this.level.start);
    this.slimeView = new SlimeView(this);
    this.cave = new CaveStuff(this.level, this.canyon);
    this.crystal = this.isBoss && this.def.boss === 'crystal' ? new CrystalBoss(this.level) : null;
    this.bigMachine =
      this.isBoss && this.def.boss === 'machine' ? new BigMachine(this.level) : null;
    this.boss = this.isBoss && !this.crystal && !this.bigMachine ? new Boss(this.level) : null;
    // Split (the reward for beating the big machine): getting hurt splits the
    // slime in two instead of killing it.
    this.hasSplit = UNLOCK_ALL || hasSplit(loadProgress());
    this.splitState = 'whole'; // 'whole', 'split' (two halves) or 'half' (one half left)
    this.otherSlime = null;
    this.otherView = new SlimeView(this);
    this.safeTime = 0;
    this.safeTrail = new SafeTrail();
    this.blasts = [];
    this.createDarkness();
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
    // On the island you collect pearls instead of power cores, in the jungle
    // golden idols, and in the sky stars.
    const prize = PRIZES[this.themeName] || PRIZES.lab;
    this.coreName = prize.name;
    this.coreLabel = prize.label;
    this.cores = level.cores.map(c => {
      const sprite = this.add.image(c.x, c.y, prize.texture).setDepth(6).setVisible(!hidden(c));
      this.tweens.add({ targets: sprite, y: c.y - 6, yoyo: true, repeat: -1, duration: 800 });
      return { ...c, sprite, taken: false };
    });
    this.chestSprites = this.island.chests.map(c => {
      const sprite = this.add.image(c.x, c.y + 6, 'chest').setDepth(6);
      this.tweens.add({ targets: sprite, angle: 4, yoyo: true, repeat: -1, duration: 900 });
      return sprite;
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
    if (this.hasCaveRewards) {
      this.shotButton = makeIconButton(this, GAME_WIDTH - 140, GAME_HEIGHT - 60, '💧', () =>
        this.armShot(!this.shotArmed)
      );
    }

    if (this.isBoss) {
      this.bossBar = this.add.graphics().setScrollFactor(0).setDepth(200);
      this.add
        .text(
          GAME_WIDTH / 2,
          100,
          this.crystal ? 'CRYSTAL ROBOT' : this.bigMachine ? 'BIG MACHINE' : 'ROBOT',
          textStyle(22, '#ff8080')
        )
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(200);
    }
    this.updateHud();
  }

  armShot(armed) {
    if (armed && !this.shots.canFire(this.island.lost)) {
      sfx.locked();
      this.showBanner(
        this.island.lost
          ? "You're too small to shoot! Find your missing slime blobs."
          : 'All 3 slime blobs are out. Touch one to get it back!',
        1800
      );
      return;
    }
    this.shotArmed = armed;
    if (armed) {
      this.armTongue(false);
    }
    this.shotButton.setScale(armed ? 1.25 : 1);
  }

  armTongue(armed) {
    if (armed && this.tongue.sore > 0) {
      sfx.locked();
      return;
    }
    this.tongueArmed = armed;
    if (this.tongueButton) {
      this.tongueButton.setScale(armed ? 1.25 : 1);
      this.tongueButton.setAlpha(armed ? 1 : 0.85);
    }
  }

  /** Tokens collected so far (a treasure chest counts as 10). */
  tokenCount() {
    const chests = this.island.chests.filter(c => c.taken).length;
    return this.tokens.filter(t => t.taken).length + chests * CHEST_TOKENS;
  }

  tokenTotal() {
    return this.tokens.length + this.island.chests.length * CHEST_TOKENS;
  }

  updateHud() {
    const parts = [];
    if (this.tokenTotal()) {
      parts.push(`Tokens ${this.tokenCount()}/${this.tokenTotal()}`);
    }
    if (this.cores.length) {
      const got = this.cores.filter(c => c.taken).length;
      parts.push(`${this.coreLabel} ${got}/${this.cores.length}`);
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
      if (this.warehouse.inCannon !== null) {
        // In a cannon: dragging aims it, letting go fires.
        this.aiming = true;
        this.warehouse.aim(this.worldPoint(pointer));
        return;
      }
      if (this.sky.onKite) {
        // Holding a kite: tap anywhere to let go.
        this.sky.letGoKite(this.slime);
        this.activePointer = null;
        return;
      }
      // On a vine you can still shoot and use your tongue.
      const onVine = this.jungle.onVine !== null;
      if (this.shotArmed && (!this.slime.frozen || onVine)) {
        // Fire a blob of slime toward where you tapped.
        this.shots.fire(
          this.slime.ends[this.slime.lead],
          this.worldPoint(pointer),
          this.island.lost
        );
        this.armShot(false);
        this.activePointer = null;
        return;
      }
      const free = !this.slime.isFalling && !this.slime.heldEnd && !this.slime.frozen;
      if (this.tongueArmed && (free || onVine)) {
        // Shoot the tongue out of the slime's head instead of stretching.
        this.tongue.start(this.slime.ends[this.slime.lead], this.worldPoint(pointer));
        this.armTongue(false);
        return;
      }
      if (onVine) {
        // Swinging on a vine: drag to pump the swing, let go to fly off.
        this.pumping = true;
        return;
      }
      this.pickHalf(this.worldPoint(pointer));
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
      if (this.aiming) {
        this.aiming = false;
        this.warehouse.aim(this.worldPoint(pointer));
        this.warehouse.fire(this.slime);
        this.aimPath = null;
        return;
      }
      if (this.pumping) {
        this.pumping = false;
        this.jungle.letGoVine(this.slime);
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

  /** When split, you move whichever half is nearer your finger. */
  pickHalf(point) {
    const other = this.otherSlime;
    // A half riding a balloon, rainbow or kite stays the one you're moving.
    if (!other || other.isFalling || this.slime.heldEnd || this.sky.ride) {
      return;
    }
    const near = slime =>
      Math.min(...slime.ends.map(e => Math.hypot(e.x - point.x, e.y - point.y)));
    if (near(other) < near(this.slime)) {
      [this.slime, this.otherSlime] = [other, this.slime];
      [this.slimeView, this.otherView] = [this.otherView, this.slimeView];
    }
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
      if (this.activePointer && this.aiming) {
        this.warehouse.aim(this.worldPoint(this.activePointer));
      }
      this.updateWind(dt);
      this.slime.update(dt, this.level);
      this.warehouse.update(dt, this.slime);
      this.updateTongue(dt);
      const canyonHit = this.canyon.update(dt, this.slime);
      const caveHit = this.cave.update(dt, this.slime);
      const islandHit = this.island.update(dt, this.slime, this.time_);
      const finger =
        this.pumping && this.activePointer ? this.worldPoint(this.activePointer) : null;
      const jungleHit = this.jungle.update(dt, this.slime, finger);
      if (this.bigMachine && this.bigMachine.catchBlobs(this.shots.blobs)) {
        sfx.power();
        this.showBanner('The belt is going backwards! Wait for a bomb box to go in...', 2200);
      }
      const factoryHit = this.factory.update(dt, this.slime, this.shots.blobs);
      const skyHit = this.sky.update(dt, this.slime, this.shots.blobs, this.time_);
      this.updateShots(dt);
      this.playFactorySounds();
      this.playSkySounds();
      this.updateBigMachine(dt);
      this.playIslandSounds();
      this.playJungleSounds();
      this.playSlimeSounds();
      this.playCanyonSounds();
      this.playWarehouseSounds();
      this.playCaveSounds();
      this.updateBoss(dt);
      this.updateCrystal(dt);
      this.checkPickups();
      this.checkExit(dt);
      const hazard = findHazard(this.level, this.slime, this.lasers, this.time_, this.chaser);
      const hurt =
        hazard ||
        canyonHit ||
        caveHit ||
        islandHit ||
        jungleHit ||
        factoryHit ||
        skyHit ||
        this.bossHurtSlime;
      this.updateSplit(dt, !hurt);
      if (canyonHit === 'boulder') {
        this.startCrush();
      } else if (hurt && this.status === 'playing') {
        this.hurtSlime();
        if (jungleHit === 'quicksand' && this.status === 'dying') {
          this.showBanner('Glug glug! The quicksand swallowed you.', 1800);
        }
      }
    } else if (this.status === 'crushed') {
      this.updateCrush(dt);
    } else if (this.boss) {
      // Keep explosions animating after the fight ends.
      this.boss.update(dt, this.slime);
    }
    this.blasts = this.blasts.filter(b => (b.age += dt) < 0.5);

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
    this.tongue.tick(dt);
    this.updateTongueButton();
    if (this.tongueBanana && !this.tongue.active) {
      this.tongueBanana = false;
      this.eatBanana();
    }
    if (!this.tongue.active) {
      return;
    }
    const head = this.slime.ends[this.slime.lead];
    const eaten = this.tongue.update(dt, this.level, head, this.canyon.boxes);
    if (this.tongue.state === 'out' && this.jungle.catchBanana(this.tongue.tip, TONGUE_RADIUS)) {
      // Caught a flying banana! Pull it in and eat it.
      this.tongueBanana = true;
      this.tongue.release();
      sfx.grab();
    }
    if (this.crystal && this.tongue.state === 'out' && this.crystal.inRect(this.tongue.tip, 6)) {
      // Licking the crystal robot: if its armor is cracked, gobble an orb!
      if (this.crystal.eatOrb()) {
        sfx.chomp();
      } else {
        sfx.clang();
      }
      this.tongue.release();
    }
    const grabbed = this.tongue.carrying;
    if (grabbed !== null && this.canyon.boxes[grabbed].item === 'bomb') {
      // Surprise! A bomb box blows up on the tongue. It doesn't hurt the
      // slime, but the tongue is too sore to use for a while.
      this.canyon.eatBox(grabbed, this.slime);
      this.bombBlasts.push({ x: this.tongue.tip.x, y: this.tongue.tip.y, age: 0 });
      this.tongue.blowUp(TONGUE_SORE_TIME);
      sfx.explode();
      sfx.sore();
      this.cameras.main.shake(200, 0.008);
      this.showBanner('BOOM! A bomb box! Your tongue is too sore for 10 seconds.', 2200);
      return;
    }
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

  /** Yum! A banana can give you back a missing piece of slime. */
  eatBanana() {
    sfx.yum();
    const got = this.jungle.eatBanana(this.island, this.shots);
    if (got === 'lost') {
      this.showBanner(
        this.island.lost ? 'Yum! You got some of your slime back!' : 'Yum! Back to full size!',
        1800
      );
    } else if (got === 'shot') {
      this.showBanner('Yum! A slime blob came back to you!', 1800);
    } else {
      this.showBanner('Yum! A tasty banana!', 1400);
    }
  }

  updateTongueButton() {
    if (!this.tongueButton) {
      return;
    }
    const label = this.tongue.sore > 0 ? `${Math.ceil(this.tongue.sore)}` : '👅';
    if (this.tongueButton.label.text !== label) {
      this.tongueButton.label.setText(label);
      this.tongueButton.setAlpha(this.tongue.sore > 0 ? 0.5 : 0.85);
    }
  }

  updateShots(dt) {
    this.shots.update(dt, this.level, this.slime, blob => {
      // A flying blob knocks down any stalactite it hits.
      for (const s of this.cave.stalactites) {
        if (s.state === 'hanging' && Math.hypot(blob.x - s.x, blob.y - s.y) < 22 + BLOB_RADIUS) {
          this.cave.knockDown(s);
        }
      }
      // ...and flips crabs onto their backs.
      for (const crab of this.island.crabs) {
        if (Math.hypot(blob.x - crab.x, blob.y - crab.y) < CRAB_RADIUS + BLOB_RADIUS + 4) {
          this.island.flipCrab(crab);
        }
      }
      // ...and scares monkeys.
      for (const m of this.jungle.monkeys) {
        if (Math.hypot(blob.x - m.x, blob.y - m.y) < MONKEY_RADIUS + BLOB_RADIUS + 4) {
          this.jungle.scareMonkey(m);
        }
      }
    });
    // Missing blobs, quicksand and being split all cut how far you can stretch.
    const half = this.splitState === 'whole' ? 1 : SPLIT_REACH;
    this.slime.reach = this.shots.reach(this.island.lost) * this.jungle.reachScale * half;
    for (const e of this.shots.takeEvents()) {
      if (e === 'shoot') {
        sfx.throwBomb();
      } else if (e === 'splat') {
        sfx.splorch();
      } else if (e === 'absorb' || e === 'return') {
        sfx.grab();
      }
    }
  }

  playIslandSounds() {
    const { warn } = waveState(this.island.waves, this.time_);
    if (warn && !this.waveWasWarning) {
      sfx.wave();
    }
    this.waveWasWarning = warn;
    for (const e of this.island.takeEvents()) {
      if (e.type === 'rustle') {
        sfx.rustle();
      } else if (e.type === 'crack') {
        sfx.coconut();
      } else if (e.type === 'bonk') {
        sfx.bonk();
        this.showBanner('BONK! The coconut knocked out the crab!', 1600);
      } else if (e.type === 'flip') {
        sfx.bonk();
      } else if (e.type === 'bounce') {
        sfx.bounce();
      } else if (e.type === 'squawk') {
        sfx.squawk();
      } else if (e.type === 'gullGrab') {
        sfx.clawGrab();
      } else if (e.type === 'gullDrop') {
        sfx.clawDrop();
      } else if (e.type === 'barf') {
        sfx.barf();
        this.showBanner('BLECH! The seagull barfed you up. Find your missing slime!', 2200);
      } else if (e.type === 'absorb') {
        sfx.grab();
        if (!this.island.lost) {
          this.showBanner('Back to full size!', 1400);
        }
      }
    }
  }

  /** Show a tip the first time something happens in a level. */
  hintOnce(key, message, duration = 2000) {
    if (!this.hintsShown.has(key)) {
      this.hintsShown.add(key);
      this.showBanner(message, duration);
    }
  }

  playJungleSounds() {
    for (const e of this.jungle.takeEvents()) {
      if (e.type === 'quicksand') {
        sfx.gloop();
        this.hintOnce('quicksand', "Quicksand! You can't stretch far. Get out before you sink!");
      } else if (e.type === 'chatter') {
        sfx.chatter();
      } else if (e.type === 'throw') {
        sfx.whoosh();
      } else if (e.type === 'splat') {
        sfx.squish();
      } else if (e.type === 'scared') {
        sfx.eek();
      } else if (e.type === 'hiss') {
        sfx.hiss();
      } else if (e.type === 'snap') {
        sfx.snakeSnap();
      } else if (e.type === 'trap') {
        sfx.leafBreak();
        this.cameras.main.shake(150, 0.006);
        this.hintOnce('trap', 'It was a trap! Those leaves were hiding a snake pit.');
      } else if (e.type === 'vineGrab' || e.type === 'zipGrab') {
        // The finger that touched it doesn't count as letting go.
        this.activePointer = null;
        this.pumping = false;
        if (e.type === 'vineGrab') {
          sfx.vine();
          this.hintOnce('vine', 'Drag sideways to swing higher. Let go to fly!', 2500);
        } else {
          sfx.zip();
        }
      } else if (e.type === 'vineLetGo') {
        sfx.wheee();
      } else if (e.type === 'zipDrop') {
        sfx.clawDrop();
      } else if (e.type === 'creak') {
        sfx.creak();
      } else if (e.type === 'tip') {
        sfx.whoosh();
      }
    }
  }

  playCaveSounds() {
    for (const e of this.cave.takeEvents()) {
      if (e.type === 'crack') {
        sfx.boulderCrack();
      } else if (e.type === 'shatter') {
        sfx.crumble();
      } else if (e.type === 'smash') {
        sfx.clang();
        this.revealBoxItems(e.box);
      } else if (e.type === 'ride' || e.type === 'push') {
        sfx.cannonIn();
      } else if (e.type === 'rideEnd') {
        sfx.land();
      }
    }
  }

  /** A pickaxe smashed a box: whatever was inside can now be picked up. */
  revealBoxItems(i) {
    for (const item of [...this.tokens, ...this.cores]) {
      if (item.inBox === i && !item.taken) {
        delete item.inBox;
        item.sprite.setVisible(true);
      }
    }
    this.canyon.keys.forEach((k, j) => {
      if (k.inBox === undefined && !k.taken && this.keySprites[j].active) {
        this.keySprites[j].setVisible(true);
      }
    });
    if (this.canyon.boxes[i].item === 'bomb') {
      this.blasts.push({ x: this.canyon.boxes[i].x, y: this.canyon.boxes[i].y, age: 0 });
      sfx.explode();
    }
  }

  updateCrystal(dt) {
    if (!this.crystal) {
      return;
    }
    if (this.crystal.update(dt, this.slime, this.cave.machines)) {
      this.bossHurtSlime = true;
    }
    for (const e of this.crystal.takeEvents()) {
      if (e === 'windup' || e === 'slamWindup') {
        sfx.jump();
      } else if (e === 'charge') {
        sfx.cannonFire();
      } else if (e === 'break') {
        sfx.crumble();
        sfx.clang();
        this.cameras.main.shake(300, 0.012);
        this.showBanner('CRACK! Quick, eat an orb with your tongue!', 1800);
      } else if (e === 'bonk') {
        sfx.thud();
      } else if (e === 'slam') {
        sfx.stomp();
        this.cameras.main.shake(250, 0.01);
      } else if (e === 'shoot') {
        sfx.robotThrow();
      } else if (e === 'regen') {
        sfx.shield();
        this.showBanner('Too slow! The armor grew back.', 1400);
      } else if (e === 'orb') {
        sfx.robotHurt();
        this.showBanner(
          this.crystal.phase === 2 ? 'Gulp! Now it can SLAM!' : 'Gulp! Now it shoots crystals!',
          1800
        );
      } else if (e === 'defeated') {
        sfx.robotHurt();
        this.status = 'won-wait';
        this.time.delayedCall(1200, () => this.win());
      }
    }
  }

  playWarehouseSounds() {
    for (const e of this.warehouse.takeEvents()) {
      if (e === 'enterCannon') {
        sfx.cannonIn();
        if (!this.cannonHintShown) {
          this.cannonHintShown = true;
          this.showBanner('Drag to aim, then let go to FIRE!', 2000);
        }
      } else if (e === 'fire') {
        sfx.cannonFire();
        this.cameras.main.shake(150, 0.006);
      } else if (e === 'clawGrab') {
        sfx.clawGrab();
      } else if (e === 'clawDrop') {
        sfx.clawDrop();
      }
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
    this.island.touchedChests(this.slime).forEach(chest => {
      const sprite = this.chestSprites[this.island.chests.indexOf(chest)];
      this.tweens.killTweensOf(sprite);
      this.tweens.add({
        targets: sprite,
        y: sprite.y - 50,
        alpha: 0,
        scale: 1.8,
        duration: 600,
        onComplete: () => sprite.destroy(),
      });
      sfx.chest();
      this.showBanner('Treasure! +10 tokens!', 1600);
      this.updateHud();
    });
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
    if (this.splitState === 'split') {
      if (this.lockedMessageTimer <= 0) {
        sfx.locked();
        this.showBanner('Bring your two halves together first!', 1800);
        this.lockedMessageTimer = 2.5;
      }
      return;
    }
    const missing = this.cores.filter(c => !c.taken).length;
    if (missing > 0) {
      if (this.lockedMessageTimer <= 0) {
        sfx.locked();
        const name = `${this.coreName}${missing > 1 ? 's' : ''}`;
        this.showBanner(`Locked! Find ${missing} more ${name}.`, 1800);
        this.lockedMessageTimer = 2.5;
      }
      return;
    }
    this.win();
  }

  // ------------------------------------------------------------ dying/winning

  /**
   * Something hurt the slime. Without Split that's the end of it. With Split,
   * a whole slime splits in two, a half that's hurt is gone, and only the last
   * half-size slime really dies.
   */
  hurtSlime() {
    if (!this.hasSplit || this.splitState === 'half') {
      this.die();
      return;
    }
    if (this.safeTime > 0) {
      return;
    }
    this.activePointer = null;
    this.pumping = false;
    this.cameras.main.shake(150, 0.008);
    if (this.splitState === 'whole') {
      const [a, b] = this.safeTrail.splitSpots(this.checkpoint || this.level.start);
      this.slime.spawn(a);
      this.otherSlime = new Slime(b);
      this.splitState = 'split';
      this.safeTime = SAFE_TIME;
      sfx.split();
      this.hintOnce('split', 'SPLIT! Bring your two halves back together.', 2200);
    } else {
      // This half is gone; carry on with the other one.
      [this.slime, this.slimeView, this.otherView] = [
        this.otherSlime,
        this.otherView,
        this.slimeView,
      ];
      this.otherSlime = null;
      this.splitState = 'half';
      this.safeTime = SAFE_TIME;
      sfx.death();
      this.showBanner('One half is gone! Be careful now.', 2000);
    }
  }

  /** Split bookkeeping every frame: the other half, merging and safe spots. */
  updateSplit(dt, safe) {
    this.safeTime = Math.max(0, this.safeTime - dt);
    if (this.splitState === 'whole' && this.hasSplit) {
      this.safeTrail.record(dt, this.slime, safe);
    }
    const other = this.otherSlime;
    if (!other) {
      return;
    }
    other.reach = this.slime.reach;
    other.update(dt, this.level);
    if (this.safeTime <= 0 && findHazard(this.level, other, this.lasers, this.time_, this.chaser)) {
      // The half you weren't moving got hurt, so it's gone.
      this.otherSlime = null;
      this.splitState = 'half';
      this.safeTime = SAFE_TIME;
      sfx.death();
      this.showBanner('One half is gone! Be careful now.', 2000);
      return;
    }
    const settled = s => !s.isFalling && !s.frozen;
    if (
      this.safeTime <= 0 &&
      settled(this.slime) &&
      settled(other) &&
      touching(this.slime, other)
    ) {
      this.otherSlime = null;
      this.splitState = 'whole';
      sfx.merge();
      this.showBanner('Back together!', 1400);
    }
  }

  endSplit() {
    this.otherSlime = null;
    this.otherView.clear();
    this.splitState = 'whole';
    this.safeTime = 0;
    this.safeTrail.clear();
  }

  updateBigMachine(dt) {
    const boss = this.bigMachine;
    if (!boss) {
      return;
    }
    if (boss.update(dt, this.slime)) {
      this.bossHurtSlime = true;
    }
    for (const e of boss.takeEvents()) {
      if (e === 'crate') {
        sfx.cannonIn();
      } else if (e === 'reverse' || e === 'forward') {
        sfx.clawDrop();
      } else if (e === 'gulp') {
        sfx.gulp();
        sfx.explode();
        this.cameras.main.shake(300, 0.01);
        this.showBanner('GULP! Its mouth is shut. Quick, press the big button on top!', 2400);
      } else if (e === 'reopen') {
        sfx.locked();
        this.showBanner('Too slow! Its mouth opened again.', 1600);
      } else if (e === 'stomp') {
        sfx.stomp();
        this.cameras.main.shake(120, 0.005);
      } else if (e === 'explode') {
        sfx.explode();
        this.cameras.main.shake(150, 0.006);
      } else if (e === 'fire') {
        sfx.fireball();
      } else if (e === 'slip') {
        sfx.boing();
      } else if (e === 'hit') {
        sfx.button();
        sfx.roar();
        this.cameras.main.shake(500, 0.015);
        this.showBanner(
          boss.phase === 2 ? 'ROAR! Now it shoots fireballs!' : 'ROAR! Another crusher, and ice!',
          2400
        );
      } else if (e === 'defeated') {
        sfx.button();
        sfx.robotHurt();
        this.status = 'won-wait';
        this.time.delayedCall(1400, () => this.win());
      }
    }
    if (boss.sendBack) {
      // It sends you right back to the beginning.
      boss.sendBack = false;
      this.endSplit();
      this.slime.spawn(this.level.start);
      this.cameras.main.centerOn(this.level.start.x, this.level.start.y);
    }
  }

  playFactorySounds() {
    for (const e of this.factory.takeEvents()) {
      if (e.type === 'stomp') {
        sfx.stomp();
        this.cameras.main.shake(100, 0.004);
      } else if (e.type === 'steam') {
        sfx.steam();
      } else if (e.type === 'power') {
        sfx.power();
        this.hintOnce('machine', 'The machine is running! Its platform is moving.', 2000);
      } else if (e.type === 'platform') {
        sfx.liftMove();
      } else if (e.type === 'unpower') {
        sfx.grab();
      }
    }
  }

  playSkySounds() {
    for (const e of this.sky.takeEvents()) {
      if (e.type === 'rumble') {
        sfx.rumble();
      } else if (e.type === 'zap') {
        sfx.zap();
        this.cameras.main.shake(120, 0.004);
      } else if (e.type === 'wake') {
        sfx.yawn();
        this.hintOnce('wake', 'You woke up the sleepy cloud! Off it floats.', 2000);
      } else if (e.type === 'blobBack') {
        sfx.grab();
      } else if (e.type === 'fluff') {
        sfx.fluff();
        this.hintOnce('fluff', "Fluffy clouds are soft. Don't sit on one too long!", 2200);
      } else if (e.type === 'fluffSoft') {
        sfx.whoosh();
      } else if (e.type === 'balloonGrab' || e.type === 'rainbowGrab' || e.type === 'kiteGrab') {
        // The finger that touched it doesn't count as letting go.
        this.activePointer = null;
        if (e.type === 'balloonGrab') {
          sfx.balloon();
        } else if (e.type === 'rainbowGrab') {
          sfx.rainbow();
        } else {
          sfx.vine();
          this.hintOnce('kite', 'The wind carries the kite. Tap to let go!', 2500);
        }
      } else if (e.type === 'balloonDrop' || e.type === 'rainbowDrop') {
        sfx.clawDrop();
      } else if (e.type === 'kiteLetGo') {
        sfx.whoosh();
      } else if (e.type === 'kiteStick') {
        sfx.splorch();
      }
    }
  }

  die() {
    this.endSplit();
    this.status = 'dying';
    this.deaths += 1;
    this.heldBomb = null;
    this.activePointer = null;
    this.pumping = false;
    this.tongueBanana = false;
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
      const boss = this.boss || this.crystal || this.bigMachine;
      if (boss) {
        // Each hit on a boss is a checkpoint: it keeps its damage.
        boss.resetAfterSlimeDeath();
        if (boss.hp < 3) {
          const hp = boss.hp;
          this.showBanner(`The robot still has ${hp} hit${hp > 1 ? 's' : ''} left!`, 2000);
        }
      }
      this.respawn();
    });
  }

  respawn() {
    this.canyon.resetAfterDeath();
    this.island.resetAfterDeath();
    this.jungle.resetAfterDeath();
    this.factory.resetAfterDeath();
    this.sky.resetAfterDeath();
    // Blobs stuck in slime machines come back to you.
    this.shots.blobs = this.shots.blobs.filter(b => b.state !== 'inMachine');
    this.endSplit();
    this.shotArmed = false;
    this.warehouse.resetAfterDeath();
    this.aiming = false;
    this.aimPath = null;
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
    const tokens = this.tokenCount();
    const score = scoreLevel({ tokens, seconds: this.clock, deaths: this.deaths });
    const progress = loadProgress();
    const isBest = recordFinish(progress, this.levelIndex, this.def.id, { score, tokens });
    if (this.boss) {
      progress.tongue = true;
    }
    if (this.crystal) {
      progress.caveRewards = true;
    }
    if (this.bigMachine) {
      progress.split = true;
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

    const title = this.crystal
      ? 'You beat the crystal robot!'
      : this.bigMachine
        ? 'You beat the big machine!'
        : this.boss
          ? 'You beat the robot!'
          : 'Level Complete!';
    const lines = [];
    if (this.tokenTotal()) {
      lines.push(`Tokens: ${tokens} / ${this.tokenTotal()}`);
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
    } else if (this.crystal) {
      fixed(
        this.add
          .text(cx, cy + 70, 'You got GLOW and SLIME SHOT! 💧', textStyle(30, '#9affc0'))
          .setOrigin(0.5)
      );
    } else if (this.bigMachine) {
      fixed(
        this.add
          .text(
            cx,
            cy + 70,
            'You got SPLIT! Getting hurt splits you in two.',
            textStyle(26, '#ffb070')
          )
          .setOrigin(0.5)
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
        this.isBoss ? 200 : 140,
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
    drawSkyTiles(this.dynGfx, this.sky, this.clock);
    this.drawWind();
    this.fluidGfx.clear();
    drawFluids(this.fluidGfx, this.level, this.clock);

    const fx = this.fxGfx;
    fx.clear();
    this.drawJungleBehind(fx);
    drawSkyBehind(fx, this.sky, this.clock);
    this.drawLasers(fx);
    this.drawGates(fx);
    this.drawTongue(fx);
    this.drawReach(fx);

    const over = this.overGfx;
    over.clear();
    this.drawChaser(over);
    this.drawCannons(over);
    this.drawClaws(over);
    this.drawBombBlasts(over, dt);
    this.drawBoulders(over);
    this.drawCave(over);
    this.drawIsland(over);
    this.drawJungle(over);
    drawFactory(over, this.factory, this.clock);
    drawSky(over, this.sky, this.clock);
    if (this.bigMachine) {
      drawBigMachine(over, this.bigMachine, this.clock, this.bossBar);
    }
    this.drawBlobs(over);
    if (this.crystal) {
      this.drawCrystal(over);
    }
    this.drawCarriedKeys(over);
    if (this.boss) {
      this.drawBoss(over);
      this.drawBombs();
    }

    const visible = ['playing', 'won', 'won-wait', 'crushed'];
    // Inside a cannon the slime is hidden (the cannon draws a peek of it).
    // Inside a seagull's tummy the slime is hidden too.
    const hidden = this.warehouse.inCannon !== null || this.island.eaten;
    if (visible.includes(this.status) && !hidden) {
      const look = this.slime.heldEnd ? this.slime.finger : this.slime.ends[1 - this.slime.lead];
      const half = this.splitState === 'whole' ? 1 : 0.72;
      const size = this.shots.size(this.island.lost) * half;
      // A fresh half blinks while nothing can hurt it.
      const blink = this.safeTime > 0 && Math.floor(this.clock * 12) % 2 === 0;
      if (blink) {
        this.slimeView.clear();
      } else {
        this.slimeView.draw(this.slime, dt, look, size, this.hasCaveRewards);
      }
      if (this.otherSlime) {
        const o = this.otherSlime;
        this.otherView.draw(o, dt, o.ends[1 - o.lead], size, this.hasCaveRewards);
      } else {
        this.otherView.clear();
      }
    } else if (hidden) {
      this.slimeView.clear();
    }
    this.drawDarkness();
  }

  /** Dark levels: everything is black except near the slime and glowing crystals. */
  createDarkness() {
    // With Glow, the slime lights up the whole cave.
    if (!this.def.dark || this.hasCaveRewards) {
      this.darkness = null;
      return;
    }
    this.darkness = this.add
      .renderTexture(0, 0, GAME_WIDTH, GAME_HEIGHT)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(140);
    this.lightBrush = this.make.image({ key: 'light', add: false }).setOrigin(0.5);
  }

  drawDarkness() {
    if (!this.darkness) {
      return;
    }
    const cam = this.cameras.main;
    const rt = this.darkness;
    rt.clear();
    rt.fill(0x000000, 0.94);
    const light = (x, y, scale) => {
      this.lightBrush.setScale(scale);
      rt.erase(this.lightBrush, x - cam.scrollX, y - cam.scrollY);
    };
    const c = this.slime.center;
    light(c.x, c.y, 1.6 + 0.05 * Math.sin(this.clock * 3));
    for (const crystal of this.level.crystals) {
      light(crystal.x, crystal.y, 1.1);
    }
    if (this.level.exit) {
      light(this.level.exit.x, this.level.exit.y, 0.5);
    }
  }

  drawCave(g) {
    // Stalactites
    for (const s of this.cave.stalactites) {
      if (s.state === 'gone') {
        continue;
      }
      const dx = s.state === 'shaking' ? (Math.random() - 0.5) * 6 : 0;
      g.fillStyle(0x8a8fa6, 1);
      g.fillTriangle(s.x - 14 + dx, s.y - 16, s.x + 14 + dx, s.y - 16, s.x + dx, s.y + 20);
      g.fillStyle(0xc4c8da, 1);
      g.fillTriangle(s.x - 6 + dx, s.y - 16, s.x + 2 + dx, s.y - 16, s.x - 1 + dx, s.y + 8);
    }
    // Bats
    this.level.bats.forEach((bat, i) => {
      const p = batPosition(bat, i, this.clock);
      g.fillStyle(0x2a2233, 1);
      g.fillCircle(p.x, p.y, 7);
      const wing = p.flap ? -10 : 6;
      g.fillTriangle(p.x - 4, p.y, p.x - 22, p.y + wing, p.x - 10, p.y + 6);
      g.fillTriangle(p.x + 4, p.y, p.x + 22, p.y + wing, p.x + 10, p.y + 6);
      g.fillStyle(0xff4040, 1);
      g.fillCircle(p.x - 3, p.y - 2, 1.5);
      g.fillCircle(p.x + 3, p.y - 2, 1.5);
    });
    // Glowing crystals
    for (const c of this.level.crystals) {
      const pulse = 0.7 + 0.3 * Math.sin(this.clock * 2 + c.x);
      g.fillStyle(0x7ff0ff, 0.25 * pulse);
      g.fillCircle(c.x, c.y, 26);
      g.fillStyle(0x9ff6ff, 1);
      g.fillTriangle(c.x - 10, c.y + 18, c.x - 2, c.y - 16, c.x + 4, c.y + 18);
      g.fillStyle(0x5fd8f0, 1);
      g.fillTriangle(c.x + 2, c.y + 18, c.x + 10, c.y - 6, c.x + 14, c.y + 18);
    }
    // Mining machines and their pickaxes
    for (const m of this.cave.machines) {
      const x = m.col * TILE;
      const y = m.row * TILE;
      g.fillStyle(0xd9a21b, 1);
      g.fillRoundedRect(x + 2, y + 6, TILE - 4, TILE - 6, 6);
      g.fillStyle(0x3b3b3b, 1);
      g.fillCircle(x + 14, y + TILE - 6, 6);
      g.fillCircle(x + TILE - 14, y + TILE - 6, 6);
      g.fillStyle(0xff3030, 1);
      g.fillCircle(x + TILE / 2, y + 20, 4);
      const { pivot, head, angle } = pickaxe(m, this.cave.time);
      g.lineStyle(6, 0x7a4a24, 1);
      g.lineBetween(pivot.x, pivot.y, head.x, head.y);
      // The pick's head: a curved blade across the end of the handle.
      const nx = -Math.sin(angle);
      const ny = Math.cos(angle);
      g.lineStyle(7, 0x9aa3ad, 1);
      g.lineBetween(
        head.x - nx * PICK_RADIUS,
        head.y - ny * PICK_RADIUS,
        head.x + nx * PICK_RADIUS,
        head.y + ny * PICK_RADIUS
      );
      g.fillStyle(0xd8dee6, 1);
      g.fillCircle(head.x + nx * PICK_RADIUS, head.y + ny * PICK_RADIUS, 4);
      g.fillCircle(head.x - nx * PICK_RADIUS, head.y - ny * PICK_RADIUS, 4);
    }
    // Rails and mine carts
    for (const cart of this.cave.carts) {
      const railY = (cart.row + 1) * TILE - 6;
      g.lineStyle(4, 0x6a5a4a, 1);
      g.lineBetween(cart.minCol * TILE, railY, (cart.maxCol + 1) * TILE, railY);
      for (let col = cart.minCol; col <= cart.maxCol; col++) {
        g.fillStyle(0x4a3a2a, 1);
        g.fillRect(col * TILE + 6, railY - 2, 6, 6);
        g.fillRect(col * TILE + 30, railY - 2, 6, 6);
      }
      const top = cart.row * TILE + 6;
      g.fillStyle(0x6b4a2e, 1);
      g.fillRect(cart.x - 22, top, 44, TILE - 16);
      g.lineStyle(3, 0x3a2614, 1);
      g.strokeRect(cart.x - 22, top, 44, TILE - 16);
      g.fillStyle(0x222222, 1);
      g.fillCircle(cart.x - 12, railY - 4, 6);
      g.fillCircle(cart.x + 12, railY - 4, 6);
    }
    for (const b of this.blasts) {
      const k = b.age / 0.5;
      g.fillStyle(0xffd040, Math.max(0, 1 - k));
      g.fillCircle(b.x, b.y, 40 * (0.4 + k * 0.6));
    }
  }

  /** Rope bridges and hammocks dip down where the slime is standing on them. */
  drawSwingTiles(g) {
    const feet = this.slime.ends.filter(e => e.state === 'stuck' && !this.slime.isFalling);
    const dipAt = (x, top) => {
      let dip = 0;
      for (const e of feet) {
        if (Math.abs(e.y + END_RADIUS - top) < 8) {
          dip = Math.max(dip, 8 * Math.exp(-(((e.x - x) / 40) ** 2)));
        }
      }
      return dip;
    };
    const bounce = Math.max(0, 1 - (this.island.time - this.island.lastBounce) * 3);
    for (const t of this.swingTiles) {
      const x = t.col * TILE;
      const y = t.row * TILE;
      if (t.kind === TileKind.BRIDGE) {
        drawBridge(g, x, y, dipAt(x, y), dipAt(x + TILE, y));
      } else if (t.kind === TileKind.FLOWER) {
        drawFlower(g, x, y, dipAt(x + TILE / 2, y) + bounce * 10);
      } else {
        drawHammock(g, x, y, dipAt(x + TILE / 2, y) + bounce * 10);
      }
    }
  }

  drawIsland(g) {
    const island = this.island;
    // Waves washing over the sand.
    const cover = island.waveNow(this.time_);
    const { warn } = waveState(island.waves, this.time_);
    this.level.tiles.forEach((row, r) =>
      row.forEach((kind, c) => {
        if (kind !== TileKind.SAND || this.level.tiles[r - 1]?.[c] === TileKind.SAND) {
          return;
        }
        const x = c * TILE;
        const top = r * TILE;
        if (cover) {
          const left = Math.max(x, cover.left);
          const right = Math.min(x + TILE, cover.right);
          if (right > left) {
            const wobble = Math.sin(this.clock * 6 + c) * 3;
            g.fillStyle(0x2f8fff, 0.75);
            g.fillRect(left, top - WAVE_DEPTH + wobble, right - left, WAVE_DEPTH - wobble);
            g.fillStyle(0xe8f6ff, 0.95);
            g.fillRect(left, top - WAVE_DEPTH + wobble, right - left, 5);
          }
        } else if (warn) {
          // Foam building up at the water's edge: a wave is coming!
          g.fillStyle(0xffffff, 0.25 + 0.25 * Math.sin(this.clock * 10));
          g.fillRect(x, top - 6, TILE, 6);
        }
      })
    );
    // Coconuts
    for (const nut of island.coconuts) {
      if (nut.state === 'gone') {
        continue;
      }
      const dx = nut.state === 'shaking' ? (Math.random() - 0.5) * 5 : 0;
      g.fillStyle(0x5a3a1c, 1);
      g.fillCircle(nut.x + dx, nut.y, 13);
      g.fillStyle(0x3a2410, 1);
      g.fillCircle(nut.x - 4 + dx, nut.y - 3, 2);
      g.fillCircle(nut.x + 3 + dx, nut.y - 4, 2);
      g.fillCircle(nut.x + dx, nut.y + 2, 2);
    }
    // Crabs
    for (const crab of island.crabs) {
      this.drawCrab(g, crab);
    }
    // Treasure chests glint.
    island.chests.forEach(chest => {
      if (!chest.taken && Math.sin(this.clock * 3 + chest.x) > 0.9) {
        g.fillStyle(0xffffff, 0.9);
        g.fillCircle(chest.x + 14, chest.y - 6, 3);
      }
    });
    // Spare blobs of slime left behind by a seagull.
    for (const b of island.spares) {
      const bob = Math.sin(this.clock * 4 + b.x) * 3;
      g.fillStyle(0x55e05a, 0.3);
      g.fillCircle(b.x, b.y + bob, 18);
      g.fillStyle(0x55e05a, 0.8);
      g.fillCircle(b.x, b.y + bob, 11);
      g.fillStyle(0xffffff, 0.6);
      g.fillCircle(b.x - 3, b.y - 4 + bob, 3);
    }
    // Seagulls, and the shadow where one is about to land.
    for (const gull of island.gulls) {
      if (gull.state === 'aim' || gull.state === 'swoop') {
        const t = gull.target;
        const pulse = 0.5 + 0.5 * Math.sin(this.clock * 14);
        g.fillStyle(0x000000, 0.2);
        g.fillCircle(t.x, t.y, GULL_GRAB_RADIUS);
        g.lineStyle(3, 0xffffff, 0.4 + 0.5 * pulse);
        g.strokeCircle(t.x, t.y, GULL_GRAB_RADIUS);
      }
      this.drawGull(g, gull);
    }
  }

  /** Leafy traps and tipping leaves, which come and go. */
  drawJungleTiles(g) {
    for (const t of this.jungle.traps) {
      if (t.state === 'solid') {
        drawLeafyTrap(g, t.col * TILE, t.row * TILE);
      } else if (t.timer < 1) {
        // Growing back.
        drawLeafyTrap(g, t.col * TILE, t.row * TILE, 0.35 * (1 - t.timer));
      }
    }
    for (const leaf of this.jungle.leaves) {
      const width = (leaf.to - leaf.from + 1) * TILE;
      let tilt = this.jungle.leafTilt(leaf);
      if (leaf.state === 'down' && leaf.timer < 0.3) {
        tilt = leaf.timer / 0.3; // tipping back up
      }
      drawTippingLeaf(g, leaf.from * TILE, leaf.row * TILE, width, tilt);
    }
  }

  /** Jungle things the slime goes in front of: logs, vines, ziplines, piranhas. */
  drawJungleBehind(g) {
    const jungle = this.jungle;
    if (this.themeName === 'jungle') {
      this.drawPiranhas(g);
    }
    for (const log of jungle.logs) {
      const y = log.row * TILE - 4 + Math.sin(this.clock * 2 + log.x * 0.01) * 1.5;
      const left = log.x - LOG_WIDTH / 2;
      g.fillStyle(0x7a4e26, 1);
      g.fillRoundedRect(left, y, LOG_WIDTH, 22, 10);
      g.fillStyle(0x5a3618, 1);
      g.fillRect(left + 14, y + 7, 30, 3);
      g.fillRect(left + 52, y + 13, 24, 3);
      g.fillStyle(0xc89a62, 1);
      g.fillEllipse(left + LOG_WIDTH - 6, y + 11, 10, 20);
      g.lineStyle(2, 0x7a4e26, 1);
      g.strokeEllipse(left + LOG_WIDTH - 6, y + 11, 5, 10);
      g.fillStyle(0x5cb84e, 1);
      g.fillEllipse(left + 30, y + 1, 12, 6);
    }
    for (const zip of jungle.ziplines) {
      g.fillStyle(0x6a4a24, 1);
      g.fillCircle(zip.from.x, zip.from.y, 6);
      g.fillCircle(zip.to.x, zip.to.y, 6);
      g.lineStyle(3, 0x3a3a3a, 1);
      g.lineBetween(zip.from.x, zip.from.y, zip.to.x, zip.to.y);
      // The handle: a wheel on the cable with a bar to hold.
      g.lineStyle(4, 0x888888, 1);
      g.lineBetween(zip.x - 10, zip.y + ZIP_GRIP, zip.x, zip.y);
      g.lineBetween(zip.x + 10, zip.y + ZIP_GRIP, zip.x, zip.y);
      g.fillStyle(0xd0d0d0, 1);
      g.fillCircle(zip.x, zip.y, 8);
      g.fillStyle(0x666666, 1);
      g.fillCircle(zip.x, zip.y, 3);
      g.lineStyle(8, zip.state === 'ready' ? 0xff5a3a : 0x9a6a5a, 1);
      g.lineBetween(zip.x - 16, zip.y + ZIP_GRIP, zip.x + 16, zip.y + ZIP_GRIP);
    }
    jungle.vines.forEach((vine, i) => {
      // An empty vine sways a little in the breeze.
      const riding = jungle.onVine === i;
      const sway = riding ? 0 : Math.sin(this.clock * 1.3 + i) * 0.05;
      const tip = vineTip(vine, vine.angle + sway);
      const bend = riding ? -vine.omega * 6 : 0;
      const pts = [];
      for (let k = 0; k <= 10; k++) {
        const t = k / 10;
        const curve = Math.sin(t * Math.PI) * bend;
        pts.push({
          x: vine.x + (tip.x - vine.x) * t + curve * Math.cos(vine.angle),
          y: vine.y + (tip.y - vine.y) * t,
        });
      }
      g.lineStyle(5, 0x3d7a2a, 1);
      for (let k = 0; k < pts.length - 1; k++) {
        g.lineBetween(pts[k].x, pts[k].y, pts[k + 1].x, pts[k + 1].y);
      }
      g.fillStyle(0x5cb84e, 1);
      for (let k = 1; k < pts.length; k += 2) {
        g.fillEllipse(pts[k].x + (k % 4 === 1 ? 6 : -6), pts[k].y, 12, 6);
      }
      g.fillStyle(0x2f6a22, 1);
      g.fillCircle(tip.x, tip.y, 6);
    });
  }

  /** Little piranhas jumping out of the river now and then. */
  drawPiranhas(g) {
    this.level.tiles.forEach((row, r) =>
      row.forEach((kind, c) => {
        const surface = this.level.tiles[r - 1]?.[c];
        const water = k => k === TileKind.WATER || k === TileKind.LOG;
        if (kind !== TileKind.WATER || water(surface) || (c * 7 + r) % 3 !== 0) {
          return;
        }
        const t = (this.clock + c * 1.7) % 3.5;
        if (t > 0.9) {
          return;
        }
        const k = t / 0.9;
        const x = (c + 0.5) * TILE + (k - 0.5) * 36;
        const y = r * TILE + 8 - Math.sin(k * Math.PI) * 54;
        const dir = c % 2 ? 1 : -1;
        g.fillStyle(0x6a7a8a, 1);
        g.fillEllipse(x, y, 22, 14);
        g.fillStyle(0xe2462e, 1);
        g.fillEllipse(x, y + 3, 16, 7);
        g.fillStyle(0x6a7a8a, 1);
        g.fillTriangle(x - dir * 10, y, x - dir * 18, y - 7, x - dir * 18, y + 7);
        g.fillStyle(0xffffff, 1);
        g.fillTriangle(x + dir * 6, y + 2, x + dir * 9, y + 2, x + dir * 7, y + 6);
        g.fillStyle(0x000000, 1);
        g.fillCircle(x + dir * 5, y - 3, 1.8);
      })
    );
  }

  /** Jungle things drawn over the slime: monkeys, bananas, snakes, quicksand. */
  drawJungle(g) {
    const jungle = this.jungle;
    for (const m of jungle.monkeys) {
      this.drawMonkey(g, m);
    }
    for (const b of jungle.bananas) {
      this.drawBanana(g, b.x, b.y, b.age * 12);
    }
    if (this.tongueBanana && this.tongue.active) {
      this.drawBanana(g, this.tongue.tip.x, this.tongue.tip.y, 0);
    }
    for (const s of jungle.snakes) {
      this.drawSnake(g, s);
    }
    // Sinking into quicksand: sand creeps up over the slime, with bubbles.
    const sink = jungle.sink;
    if (sink > 0 && this.status === 'playing') {
      for (const e of this.slime.ends) {
        if (e.state !== 'stuck') {
          continue;
        }
        const h = 6 + sink * 26;
        const bottom = e.y + END_RADIUS + 4;
        g.fillStyle(0xc49a52, 1);
        g.fillEllipse(e.x, bottom - h / 2, 44, h);
        g.fillStyle(0xdcb46a, 1);
        g.fillEllipse(e.x, bottom - h + 2, 40, 6);
        for (let i = 0; i < 3; i++) {
          const k = (this.clock * 1.5 + i / 3) % 1;
          g.fillStyle(0xe8cc8a, 1 - k);
          g.fillCircle(e.x - 14 + i * 14, bottom - h - k * 16, 3 + k * 2);
        }
      }
      if (sink > 0.4) {
        const c = this.slime.center;
        const flash = Math.sin(this.clock * 16) > 0 ? 0xff3030 : 0xffffff;
        g.fillStyle(flash, 1);
        g.fillRoundedRect(c.x - 4, c.y - 62, 8, 22, 3);
        g.fillCircle(c.x, c.y - 32, 4);
      }
    }
  }

  drawBanana(g, x, y, spin) {
    g.lineStyle(7, 0xffd23a, 1);
    g.beginPath();
    g.arc(x, y, 9, spin, spin + 2.4);
    g.strokePath();
    g.fillStyle(0x6a4a24, 1);
    g.fillCircle(x + Math.cos(spin) * 9, y + Math.sin(spin) * 9, 2.5);
  }

  drawMonkey(g, m) {
    const x = m.x;
    const y = m.y + 6;
    if (m.state === 'hiding') {
      // Hiding in a leafy bush, just its eyes peeking out.
      g.fillStyle(0x3f8f3a, 1);
      g.fillCircle(x - 12, y + 4, 14);
      g.fillCircle(x + 12, y + 4, 14);
      g.fillCircle(x, y - 6, 16);
      if (Math.sin(this.clock * 2 + x) > -0.3) {
        g.fillStyle(0xffffff, 1);
        g.fillCircle(x - 5, y - 4, 3);
        g.fillCircle(x + 5, y - 4, 3);
        g.fillStyle(0x000000, 1);
        g.fillCircle(x - 5, y - 4, 1.5);
        g.fillCircle(x + 5, y - 4, 1.5);
      }
      return;
    }
    const brown = 0x7a4a24;
    const face = 0xe0b088;
    // Curly tail
    g.lineStyle(4, brown, 1);
    g.beginPath();
    g.arc(x + 16, y + 6, 9, -Math.PI / 2, Math.PI);
    g.strokePath();
    g.fillStyle(brown, 1);
    g.fillEllipse(x, y + 8, 26, 22);
    g.fillCircle(x, y - 10, 13);
    g.fillCircle(x - 13, y - 12, 6);
    g.fillCircle(x + 13, y - 12, 6);
    g.fillStyle(face, 1);
    g.fillCircle(x - 13, y - 12, 3);
    g.fillCircle(x + 13, y - 12, 3);
    g.fillEllipse(x, y - 7, 18, 14);
    g.fillEllipse(x, y + 10, 14, 12);
    g.fillStyle(0x000000, 1);
    g.fillCircle(x - 4, y - 11, 2);
    g.fillCircle(x + 4, y - 11, 2);
    g.lineStyle(2, 0x5a3418, 1);
    g.lineBetween(x - 4, y - 4, x + 4, y - 4);
    if (m.state === 'windup') {
      // Arm up, holding a banana: it's about to throw!
      g.lineStyle(5, brown, 1);
      g.lineBetween(x - 8, y, x - 16, y - 24);
      this.drawBanana(g, x - 18, y - 30, -1);
    }
  }

  drawSnake(g, s) {
    const head = this.jungle.snakeHead(s);
    const top = { x: s.x, y: s.top };
    const shake = s.state === 'warn' ? Math.sin(this.clock * 50) * 3 : 0;
    // A wiggly body hanging down from the branch.
    const len = head.y - top.y;
    const n = Math.max(3, Math.round(len / 8));
    let prev = top;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const p = {
        x:
          top.x + (head.x - top.x) * t + Math.sin(t * 9 + this.clock * 4) * 5 * (1 - t) + shake * t,
        y: top.y + len * t,
      };
      g.lineStyle(SNAKE_RADIUS * 1.4, 0x4f9a2a, 1);
      g.lineBetween(prev.x, prev.y, p.x, p.y);
      prev = p;
    }
    g.fillStyle(0x4f9a2a, 1);
    g.fillCircle(top.x, top.y + 4, SNAKE_RADIUS * 0.8);
    const hx = prev.x;
    const hy = head.y;
    if (s.state === 'warn' || s.state === 'strike') {
      // Flicking tongue.
      g.lineStyle(2, 0xff3040, 1);
      g.lineBetween(hx, hy + 8, hx, hy + 16 + Math.sin(this.clock * 40) * 3);
    }
    g.fillStyle(0x3f8a22, 1);
    g.fillEllipse(hx, hy + 2, 20, 16);
    g.fillStyle(0xffe066, 1);
    g.fillCircle(hx - 5, hy, 3.5);
    g.fillCircle(hx + 5, hy, 3.5);
    g.fillStyle(0x000000, 1);
    g.fillRect(hx - 5.5, hy - 2.5, 1.5, 5);
    g.fillRect(hx + 4.5, hy - 2.5, 1.5, 5);
    const biting = s.state === 'strike' || s.state === 'hold';
    if (biting) {
      g.fillStyle(0xffffff, 1);
      g.fillTriangle(hx - 5, hy + 7, hx - 2, hy + 7, hx - 3.5, hy + 13);
      g.fillTriangle(hx + 2, hy + 7, hx + 5, hy + 7, hx + 3.5, hy + 13);
    }
  }

  drawCrab(g, crab) {
    const flipped = crab.state !== 'walk';
    const x = crab.x;
    const y = crab.y + 2;
    const walk = flipped ? 0 : Math.sin(this.clock * 16 + x) * 3;
    g.fillStyle(0xe2462e, 1);
    // Legs (wiggling in the air when it's on its back).
    g.lineStyle(3, 0xb8301c, 1);
    const legY = flipped ? y - 8 : y + 8;
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const wiggle = flipped ? Math.sin(this.clock * 20 + i) * 4 : walk * (i % 2 ? 1 : -1);
        g.lineBetween(x + side * (6 + i * 4), y, x + side * (14 + i * 4), legY + wiggle);
      }
    }
    g.fillStyle(0xe2462e, 1);
    g.fillEllipse(x, y, 34, 22);
    if (flipped) {
      g.fillStyle(0xf28a6a, 1);
      g.fillEllipse(x, y + 2, 24, 12);
      if (crab.state === 'ko') {
        // Seeing stars.
        g.fillStyle(0xffe066, 1);
        for (let i = 0; i < 3; i++) {
          const a = this.clock * 4 + (i * Math.PI * 2) / 3;
          g.fillCircle(x + Math.cos(a) * 16, y - 18 + Math.sin(a) * 5, 3);
        }
      }
      return;
    }
    // Claws
    const snap = Math.sin(this.clock * 8 + x) > 0 ? 4 : 0;
    for (const side of [-1, 1]) {
      g.fillStyle(0xe2462e, 1);
      g.fillCircle(x + side * 20, y - 10, 7);
      g.fillStyle(0x7a1a0a, 1);
      g.fillTriangle(
        x + side * 20,
        y - 12,
        x + side * 28,
        y - 16 - snap,
        x + side * 28,
        y - 8 + snap
      );
    }
    // Eyes on stalks
    g.lineStyle(2, 0xb8301c, 1);
    g.lineBetween(x - 5, y - 8, x - 6, y - 16);
    g.lineBetween(x + 5, y - 8, x + 6, y - 16);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(x - 6, y - 17, 4);
    g.fillCircle(x + 6, y - 17, 4);
    g.fillStyle(0x000000, 1);
    g.fillCircle(x - 6 + crab.dir, y - 17, 2);
    g.fillCircle(x + 6 + crab.dir, y - 17, 2);
  }

  drawGull(g, gull) {
    // All seagulls look exactly the same: you can never tell which is which!
    const x = gull.x;
    const y = gull.y;
    const flap = Math.sin(this.clock * (gull.state === 'swoop' ? 4 : 12)) * 10;
    const full = gull.state === 'eat';
    g.fillStyle(0xf4f4f4, 1);
    g.fillEllipse(x, y, full ? 44 : 36, full ? 26 : 18);
    g.fillStyle(0xd8dde4, 1);
    g.fillTriangle(x - 6, y - 2, x - 34, y - 6 - flap, x - 10, y + 6);
    g.fillTriangle(x + 6, y - 2, x + 34, y - 6 - flap, x + 10, y + 6);
    g.fillStyle(0x888e96, 1);
    g.fillTriangle(x - 30, y - 6 - flap, x - 34, y - 6 - flap, x - 24, y - 2 - flap * 0.6);
    g.fillTriangle(x + 30, y - 6 - flap, x + 34, y - 6 - flap, x + 24, y - 2 - flap * 0.6);
    const hx = x + gull.dir * 16;
    g.fillStyle(0xf4f4f4, 1);
    g.fillCircle(hx, y - 6, 8);
    g.fillStyle(0xffb020, 1);
    g.fillTriangle(hx + gull.dir * 6, y - 8, hx + gull.dir * 18, y - 5, hx + gull.dir * 6, y - 3);
    g.fillStyle(0x000000, 1);
    g.fillCircle(hx + gull.dir * 3, y - 8, 1.8);
    if (gull.state === 'carry') {
      // Little feet holding on.
      g.lineStyle(2, 0xffb020, 1);
      g.lineBetween(x - 4, y + 8, x - 6, y + 16);
      g.lineBetween(x + 4, y + 8, x + 6, y + 16);
    }
  }

  drawBlobs(g) {
    for (const b of this.shots.blobs) {
      g.fillStyle(0x55e05a, 0.75);
      g.fillCircle(b.x, b.y, BLOB_RADIUS);
      g.lineStyle(2, 0x1f8f35, 0.9);
      g.strokeCircle(b.x, b.y, BLOB_RADIUS);
      g.fillStyle(0xffffff, 0.5);
      g.fillCircle(b.x - 2, b.y - 3, 2);
    }
  }

  drawCrystal(g) {
    const boss = this.crystal;
    const r = boss.rect;
    const cracked = boss.state === 'broken';
    const wobble = boss.state === 'windup' || boss.state === 'slamWindup';
    const dx = wobble ? (Math.random() - 0.5) * 4 : 0;
    if (!boss.defeated) {
      // Legs
      g.fillStyle(0x5a6a8a, 1);
      g.fillRect(r.left + 14 + dx, r.bottom - 30, 22, 30);
      g.fillRect(r.right - 36 + dx, r.bottom - 30, 22, 30);
      // Crystal body: a big faceted gem.
      const color = cracked ? 0x6a7aa0 : 0x8fe8ff;
      g.fillStyle(color, cracked ? 0.6 : 0.85);
      g.fillPoints(
        [
          { x: boss.x + dx, y: r.top },
          { x: r.right + dx, y: r.top + 40 },
          { x: r.right - 10 + dx, y: r.bottom - 30 },
          { x: r.left + 10 + dx, y: r.bottom - 30 },
          { x: r.left + dx, y: r.top + 40 },
        ],
        true
      );
      g.lineStyle(3, 0xffffff, 0.7);
      g.lineBetween(boss.x + dx, r.top, boss.x + dx, r.bottom - 30);
      g.lineBetween(r.left + dx, r.top + 40, r.right + dx, r.top + 40);
      if (cracked) {
        g.lineStyle(3, 0x1a1a2a, 1);
        g.lineBetween(boss.x - 30, r.top + 20, boss.x - 5, r.top + 60);
        g.lineBetween(boss.x - 5, r.top + 60, boss.x + 25, r.top + 45);
      }
      // Eyes
      g.fillStyle(0xff3080, 1);
      g.fillCircle(boss.x - 18 + boss.dir * 6, r.top + 34, 6);
      g.fillCircle(boss.x + 18 + boss.dir * 6, r.top + 34, 6);
      // The orbs still left, glowing brightly when you can eat one.
      const orb = boss.orbSpot;
      for (let i = 0; i < boss.hp; i++) {
        const ox = orb.x + (i - (boss.hp - 1) / 2) * 22;
        g.fillStyle(0xffe066, cracked ? 1 : 0.35);
        g.fillCircle(ox, orb.y, cracked ? 10 + Math.sin(this.clock * 12) * 2 : 7);
      }
    }
    if (boss.slamWave > 0) {
      const k = 1 - boss.slamWave / 0.4;
      const from = boss.x + (boss.dir * CRYSTAL_WIDTH) / 2;
      g.fillStyle(0xc0f0ff, 0.6 * (1 - k));
      g.fillRect(Math.min(from, from + boss.dir * 200 * k), boss.floorY - 30, 200 * k, 30);
    }
    for (const s of boss.shards) {
      g.fillStyle(0x9ff6ff, 1);
      g.fillCircle(s.x, s.y, SHARD_RADIUS);
      g.lineStyle(2, 0xffffff, 1);
      g.strokeCircle(s.x, s.y, SHARD_RADIUS);
    }
    const bar = this.bossBar;
    bar.clear();
    for (let i = 0; i < 3; i++) {
      bar.fillStyle(i < boss.hp ? 0x8fe8ff : 0x223344, 1);
      bar.fillRoundedRect(GAME_WIDTH / 2 - 105 + i * 72, 120, 66, 20, 6);
    }
  }

  drawCanyonTiles() {
    const g = this.dynGfx;
    g.clear();
    for (const b of this.belts) {
      const dir = this.level.tiles[b.row][b.col] === TileKind.BELT_RIGHT ? 1 : -1;
      drawBelt(g, b.col * TILE, b.row * TILE, dir, this.clock * 40);
    }
    this.drawSwingTiles(g);
    this.drawJungleTiles(g);
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

  drawCannons(g) {
    this.warehouse.cannons.forEach((c, i) => {
      const inside = this.warehouse.inCannon === i;
      // Dotted line showing where you'll fly.
      if (inside) {
        if (!this.aimPath || this.aimPath.angle !== c.angle) {
          const shot = simulateShot(this.level, c, c.angle, 1.6);
          this.aimPath = { angle: c.angle, path: shot ? shot.path : this.previewPath(c) };
        }
        g.fillStyle(0xffffff, 0.8);
        this.aimPath.path.forEach((p, k) => {
          if (k % 4 === 0) {
            g.fillCircle(p.x, p.y, 3.5);
          }
        });
      }
      const cos = Math.cos(c.angle);
      const sin = Math.sin(c.angle);
      // Barrel
      g.lineStyle(26, 0x30343a, 1);
      g.lineBetween(c.x, c.y, c.x + cos * 34, c.y + sin * 34);
      g.lineStyle(18, 0x5a616b, 1);
      g.lineBetween(c.x, c.y, c.x + cos * 32, c.y + sin * 32);
      if (inside) {
        g.fillStyle(0x55e05a, 0.9);
        g.fillCircle(c.x + cos * 30, c.y + sin * 30, 9);
      }
      // Base
      g.fillStyle(0x7a3b2a, 1);
      g.fillCircle(c.x, c.y + 6, 16);
      g.fillStyle(0x30343a, 1);
      g.fillCircle(c.x, c.y + 6, 7);
    });
  }

  /** Where a shot would go even if it doesn't land anywhere safe. */
  previewPath(c) {
    const path = [];
    let x = c.x;
    let y = c.y;
    const vx = Math.cos(c.angle) * 1050;
    let vy = Math.sin(c.angle) * 1050;
    for (let k = 0; k < 60; k++) {
      vy += 1500 / 60;
      x += vx / 60;
      y += vy / 60;
      path.push({ x, y });
    }
    return path;
  }

  drawClaws(g) {
    for (const claw of this.warehouse.claws) {
      const railY = (claw.row + 1) * TILE;
      // Track along the ceiling
      g.lineStyle(6, 0x3a3a40, 1);
      g.lineBetween(
        (claw.from + 0.5) * TILE - 20,
        railY + 3,
        (claw.to + 0.5) * TILE + 20,
        railY + 3
      );
      // The base: green for nice claws, red for mean ones. Look closely!
      g.fillStyle(claw.nice ? 0x33cc55 : 0xdd3333, 1);
      g.fillRoundedRect(claw.x - 12, railY, 24, 10, 3);
      g.lineStyle(3, 0x777777, 1);
      g.lineBetween(claw.x, railY + 10, claw.x, claw.y - 10);
      g.fillStyle(0x8c96a3, 1);
      g.fillRect(claw.x - 14, claw.y - 12, 28, 10);
      const open = claw.state === 'carry' ? 4 : 12;
      g.lineStyle(5, 0x8c96a3, 1);
      g.lineBetween(claw.x - 10, claw.y - 2, claw.x - 10 - open, claw.y + 14);
      g.lineBetween(claw.x - 10 - open, claw.y + 14, claw.x - 4, claw.y + CLAW_RADIUS - 2);
      g.lineBetween(claw.x + 10, claw.y - 2, claw.x + 10 + open, claw.y + 14);
      g.lineBetween(claw.x + 10 + open, claw.y + 14, claw.x + 4, claw.y + CLAW_RADIUS - 2);
    }
  }

  drawBombBlasts(g, dt) {
    for (const b of this.bombBlasts) {
      b.age += dt;
      const k = b.age / 0.5;
      g.fillStyle(0xffd040, Math.max(0, 1 - k));
      g.fillCircle(b.x, b.y, 50 * (0.4 + k * 0.6));
      g.fillStyle(0xff5000, Math.max(0, (1 - k) * 0.8));
      g.fillCircle(b.x, b.y, 50 * (0.2 + k * 0.5));
    }
    this.bombBlasts = this.bombBlasts.filter(b => b.age < 0.5);
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
      if (s.leaf && this.themeName === 'sky') {
        // Up in the sky the wind blows little wisps of cloud along.
        g.fillStyle(0xffffff, 0.6);
        g.fillEllipse(s.x, s.y, 22, 8);
      } else if (s.leaf) {
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
    g.strokeCircle(anchor.x, anchor.y, this.slime.reach + END_RADIUS);
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
