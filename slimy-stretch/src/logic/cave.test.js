import { describe, expect, it } from 'vitest';
import { parseLevel, TileKind } from './level.js';
import { Slime } from './slime.js';
import { CanyonStuff } from './canyon.js';
import { CaveStuff, pickaxe } from './cave.js';
import { SlimeShots, MAX_BLOBS } from './slimeShot.js';
import { CrystalBoss } from './crystalBoss.js';
import { MAX_STRETCH } from './constants.js';

function slimeAt(x, y) {
  const slime = new Slime({ x, y });
  slime.falling = null;
  return slime;
}

function run(cave, slime, level, seconds) {
  const hurts = [];
  for (let t = 0; t < seconds; t += 1 / 60) {
    slime.update(1 / 60, level);
    const h = cave.update(1 / 60, slime);
    if (h) {
      hurts.push(h);
    }
  }
  return hurts;
}

describe('stalactites', () => {
  const map = ['########', '#..V..E#', '#......#', '#......#', '#.S....#', '########'];

  it('fall on a slime that goes under them', () => {
    const level = parseLevel({ id: 'st', type: 'normal', map });
    const cave = new CaveStuff(level);
    const slime = slimeAt(3.5 * 48, 5 * 48 - 15);
    expect(run(cave, slime, level, 2)).toContain('stalactite');
  });

  it('leave a slime alone that stays out of the way, and grow back after falling', () => {
    const level = parseLevel({ id: 'st2', type: 'normal', map });
    const cave = new CaveStuff(level);
    const slime = slimeAt(6.5 * 48, 5 * 48 - 15);
    expect(run(cave, slime, level, 2)).toEqual([]);
    cave.knockDown(cave.stalactites[0]);
    run(cave, slime, level, 2);
    expect(cave.stalactites[0].state).toBe('gone');
    run(cave, slime, level, 7);
    expect(cave.stalactites[0].state).toBe('hanging');
  });
});

describe('mining machines', () => {
  it('swing a pickaxe that hurts', () => {
    const level = parseLevel({
      id: 'mm',
      type: 'normal',
      map: ['#########', '#......E#', '#.......#', '#.......#', '#S...K..#', '#########'],
    });
    const cave = new CaveStuff(level);
    const m = cave.machines[0];
    // Sit right where the pickaxe head passes, straight above the machine.
    const top = pickaxe(m, 0).pivot;
    const slime = slimeAt(top.x, top.y - 80);
    slime.ends.forEach(e => {
      e.state = 'stuck';
    });
    const hurts = [];
    for (let t = 0; t < 3; t += 1 / 60) {
      const h = cave.update(1 / 60, slime);
      if (h) {
        hurts.push(h);
      }
    }
    expect(hurts).toContain('pickaxe');
  });

  it('smash metal boxes, and what was inside drops out', () => {
    const level = parseLevel({
      id: 'mm2',
      type: 'normal',
      boxItems: ['key-red'],
      map: ['#########', '#......E#', '#.......#', '#...M...#', '#S...K..#', '#########'],
    });
    const canyon = new CanyonStuff(level);
    const cave = new CaveStuff(level, canyon);
    const slime = slimeAt(1.5 * 48, 5 * 48 - 15);
    run(cave, slime, level, 3);
    expect(canyon.boxes[0].eaten).toBe(true);
    expect(level.tiles[3][4]).toBe(TileKind.EMPTY);
    expect(canyon.keys[0].inBox).toBe(undefined);
    expect(cave.takeEvents().some(e => e.type === 'smash')).toBe(true);
  });
});

describe('mine carts', () => {
  const map = ['##########', '#S......E#', '#........#', '#.H=====.#', '##########'];

  it('give you a ride to the end of the track when you land on top', () => {
    const level = parseLevel({ id: 'cart', type: 'normal', map });
    const cave = new CaveStuff(level);
    expect(cave.carts[0].maxCol).toBe(7);
    const slime = new Slime({ x: 2.5 * 48, y: 1.5 * 48 });
    run(cave, slime, level, 0.5);
    expect(cave.carts[0].state).toBe('riding');
    run(cave, slime, level, 3);
    expect(cave.carts[0].col).toBe(7);
    expect(level.tiles[3][7]).toBe(TileKind.CART);
    expect(slime.ends[0].x).toBeCloseTo(7.5 * 48, 0);
  });

  it('get pushed when you press into their side', () => {
    const level = parseLevel({
      id: 'cart2',
      type: 'normal',
      map: ['##########', '#.......E#', '#........#', '#S.H====.#', '##########'],
    });
    const cave = new CaveStuff(level);
    const slime = slimeAt(1.5 * 48, 4 * 48 - 15);
    slime.grab(slime.ends[0], 0);
    for (let i = 0; i < 90; i++) {
      slime.moveFinger({ x: 6 * 48, y: 3.5 * 48 }, i / 60);
      slime.update(1 / 60, level);
      cave.update(1 / 60, slime);
    }
    expect(cave.carts[0].col).toBeGreaterThan(3);
  });
});

describe('slime shots', () => {
  const level = parseLevel({
    id: 'shot',
    type: 'normal',
    map: ['##########', '#.......E#', '#........#', '#.S......#', '###WW#####', '##########'],
  });

  it('cost 25% of reach each, up to 3', () => {
    const shots = new SlimeShots();
    for (let i = 0; i < MAX_BLOBS; i++) {
      expect(shots.fire({ x: 100, y: 100 }, { x: 200, y: 100 })).toBe(true);
    }
    expect(shots.fire({ x: 100, y: 100 }, { x: 200, y: 100 })).toBe(false);
    expect(shots.reach()).toBeCloseTo(MAX_STRETCH * 0.25, 5);
  });

  it('stick to walls, and get soaked back up by touching them', () => {
    const shots = new SlimeShots();
    const slime = slimeAt(2.5 * 48, 4 * 48 - 15);
    shots.fire(slime.ends[0], { x: 9 * 48, y: 1 * 48 });
    for (let i = 0; i < 60; i++) {
      shots.update(1 / 60, level, slime);
    }
    expect(shots.blobs[0].state).toBe('stuck');
    const blob = shots.blobs[0];
    slime.ends.forEach(e => {
      e.x = blob.x;
      e.y = blob.y;
    });
    shots.update(1 / 60, level, slime);
    expect(shots.count).toBe(0);
  });

  it('come back if they land in water', () => {
    const shots = new SlimeShots();
    const slime = slimeAt(1.5 * 48, 1.5 * 48);
    shots.fire({ x: 3.5 * 48, y: 3 * 48 }, { x: 3.5 * 48, y: 6 * 48 });
    for (let i = 0; i < 60; i++) {
      shots.update(1 / 60, level, slime);
    }
    expect(shots.count).toBe(0);
    expect(shots.takeEvents()).toContain('return');
  });
});

describe('crystal robot', () => {
  const map = [
    '###############',
    '#.............#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#K..S.....R..K#',
    '###############',
  ];

  function setup() {
    const level = parseLevel({ id: 'crys', type: 'boss', map });
    const slime = slimeAt(4.5 * 48, 6 * 48 - 15);
    const boss = new CrystalBoss(level);
    return { level, slime, boss, machines: level.machines };
  }

  it('charges at the slime and hurts it', () => {
    const { slime, boss, machines } = setup();
    let hurt = false;
    for (let t = 0; t < 4 && !hurt; t += 1 / 60) {
      hurt = boss.update(1 / 60, slime, machines);
    }
    expect(hurt).toBe(true);
  });

  it('cracks open when it charges into a mining machine, then you can eat an orb', () => {
    const { slime, boss, machines } = setup();
    // The slime hides up high, so the charge goes all the way to the machine.
    slime.ends.forEach(e => {
      e.x = 1.5 * 48;
      e.y = 1.5 * 48;
    });
    for (let t = 0; t < 5 && boss.state !== 'broken'; t += 1 / 60) {
      boss.update(1 / 60, slime, machines);
    }
    expect(boss.state).toBe('broken');
    expect(boss.eatOrb()).toBe(true);
    expect(boss.hp).toBe(2);
    expect(boss.eatOrb()).toBe(false);
  });

  it('grows its armor back if you are too slow', () => {
    const { slime, boss, machines } = setup();
    boss.state = 'broken';
    boss.timer = 0.1;
    boss.update(0.2, slime, machines);
    expect(boss.state).toBe('idle');
    expect(boss.hp).toBe(3);
  });

  it('slams in phase 2 and shoots in phase 3', () => {
    const { slime, boss, machines } = setup();
    boss.hp = 2;
    slime.ends.forEach(e => {
      e.x = boss.x - 100;
    });
    for (let t = 0; t < 3; t += 1 / 60) {
      boss.update(1 / 60, slime, machines);
    }
    expect(boss.takeEvents()).toContain('slam');
    boss.hp = 1;
    boss.state = 'idle';
    boss.timer = 99;
    for (let t = 0; t < 4; t += 1 / 60) {
      boss.update(1 / 60, slime, machines);
    }
    expect(boss.takeEvents()).toContain('shoot');
  });
});
