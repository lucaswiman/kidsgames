import { describe, expect, it } from 'vitest';
import { parseLevel, TileKind } from './level.js';
import { Slime } from './slime.js';
import { END_RADIUS, TILE } from './constants.js';
import { CanyonStuff } from './canyon.js';
import { findHazard } from './hazards.js';
import { LEVELS } from '../levels/levels.js';
import {
  BOX_RESPAWN,
  BOXER_HEIGHT,
  BoxerBoss,
  FIST_CYCLE,
  PUNCH_WINDUP,
  SQUEEZE_HOLD,
  SQUEEZE_RANGE,
  SQUEEZE_WARN,
  STUN_TIME,
} from './boxerBoss.js';

const ARENA = {
  id: 't',
  type: 'boss',
  boss: 'boxer',
  arena: { from: [1, 2], to: [16, 7] },
  map: [
    '##################',
    '#LLLLLLLLLLLLLLLL#',
    '#................#',
    '#................#',
    '#................#',
    '#................#',
    '#..M.....R....M..#',
    '#S.M..........M..#',
    '##################',
  ],
};

function setup(def = ARENA) {
  const level = parseLevel(def);
  const canyon = new CanyonStuff(level);
  const boss = new BoxerBoss(level, canyon);
  return { level, canyon, boss };
}

/** A slime resting on the arena floor in column `col`. */
function slimeOnFloor(col, x = (col + 0.5) * TILE) {
  const slime = new Slime({ x, y: 8 * TILE - END_RADIUS - 1 });
  slime.falling = null;
  return slime;
}

/** Run the slime and the boss together; returns the hurts. */
function run(boss, slime, level, seconds) {
  const hurts = [];
  for (let k = 0; k < Math.round(seconds * 60); k++) {
    slime.update(1 / 60, level);
    const h = boss.update(1 / 60, slime);
    if (h) {
      hurts.push(h);
    }
  }
  return hurts;
}

/** A slime he can't see (it's been carried off somewhere). */
function hiddenSlime() {
  const slime = slimeOnFloor(1);
  slime.frozen = true;
  return slime;
}

/** A tongue tip touching the side of his body. */
const tipOn = boss => ({ x: boss.body.left - 4, y: boss.y });

/** Wake him up with the tongue and let his legs and arms pop out. */
function wake(boss, level) {
  boss.lick(tipOn(boss));
  run(boss, hiddenSlime(), level, 2.5);
  boss.takeEvents();
}

describe('Boxer Bot', () => {
  it('starts as a giant metal box standing on the floor, and does nothing', () => {
    const { level, boss } = setup();
    expect(boss.state).toBe('box');
    expect(boss.awake).toBe(false);
    expect(boss.floorY).toBe(8 * TILE);
    expect(boss.body.bottom - boss.body.top).toBe(BOXER_HEIGHT);
    const slime = slimeOnFloor(6);
    expect(run(boss, slime, level, 3)).toEqual([]);
    expect(boss.state).toBe('box');
    expect(boss.hp).toBe(3);
  });

  it('wakes up when you try to eat him: legs and arms pop out and the fight starts', () => {
    const { level, boss } = setup();
    // A tongue that misses doesn't count.
    expect(boss.lick({ x: 40, y: 40 })).toBe(null);
    expect(boss.lick(tipOn(boss))).toBe('wake');
    expect(boss.takeEvents()).toContain('wake');
    expect(boss.state).toBe('wake');
    run(boss, hiddenSlime(), level, 1.5);
    expect(boss.state).toBe('walk');
    // Licking him now just goes clang.
    expect(boss.lick(tipOn(boss))).toBe('clang');
  });

  it('walks toward you, winds up, and punches where you were', () => {
    const { level, boss } = setup();
    wake(boss, level);
    const slime = slimeOnFloor(5);
    run(boss, slime, level, 1 / 60);
    expect(boss.facing).toBe(-1);
    expect(boss.state).toBe('windup');
    expect(boss.takeEvents()).toContain('windup');
    // The wind-up is a warning: no punch yet.
    expect(run(boss, slime, level, PUNCH_WINDUP - 0.05)).toEqual([]);
    expect(run(boss, slime, level, 0.5)).toContain('punch');
    expect(boss.takeEvents()).toEqual(expect.arrayContaining(['punch', 'whack']));
  });

  it('misses if you move away during the wind-up', () => {
    const { level, boss } = setup();
    wake(boss, level);
    const slime = slimeOnFloor(5);
    run(boss, slime, level, 1 / 60);
    expect(boss.state).toBe('windup');
    // Up onto the left wall, out of the way!
    const wall = { x: TILE + END_RADIUS + 1, y: 3.5 * TILE };
    for (const e of slime.ends) {
      Object.assign(e, wall);
    }
    expect(run(boss, slime, level, PUNCH_WINDUP + 0.5)).toEqual([]);
  });

  it('walks over to you when you are too far away to punch', () => {
    const { level, boss } = setup();
    wake(boss, level);
    const slime = slimeOnFloor(16);
    const x0 = boss.x;
    run(boss, slime, level, 1);
    expect(boss.x).toBeGreaterThan(x0 + 40);
    // He doesn't walk through metal boxes.
    const far = slimeOnFloor(16);
    run(boss, far, level, 10);
    expect(boss.body.right).toBeLessThanOrEqual(14 * TILE + 0.01);
  });

  it('punches a metal box if you hide behind one, which breaks it and stuns him', () => {
    const { level, canyon, boss } = setup();
    wake(boss, level);
    const slime = slimeOnFloor(2);
    run(boss, slime, level, 6);
    const events = boss.takeEvents();
    expect(events).toEqual(expect.arrayContaining(['windup', 'punch', 'boxBreak', 'stunned']));
    expect(boss.state).toBe('stunned');
    // The box in the way broke (it's gone from the level), and the slime is fine.
    expect(canyon.boxes[2].eaten).toBe(true);
    expect(level.tiles[7][3]).toBe(TileKind.EMPTY);
  });

  it('can be hit by licking him while he is stunned; then he recovers', () => {
    const { level, boss } = setup();
    wake(boss, level);
    run(boss, slimeOnFloor(2), level, 6);
    expect(boss.state).toBe('stunned');
    expect(boss.lick(tipOn(boss))).toBe('hit');
    expect(boss.hp).toBe(2);
    expect(boss.phase).toBe(2);
    expect(boss.takeEvents()).toContain('hit');
    // Too slow: the stun wears off.
    const { level: l2, boss: b2 } = setup();
    wake(b2, l2);
    run(b2, slimeOnFloor(2), l2, 6);
    expect(b2.state).toBe('stunned');
    run(b2, hiddenSlime(), l2, STUN_TIME + 0.1);
    expect(b2.state).toBe('walk');
    expect(b2.takeEvents()).toContain('recover');
    expect(b2.lick(tipOn(b2))).toBe('clang');
    expect(b2.hp).toBe(3);
  });

  it('brings broken and eaten arena boxes back after a while, but not on top of the slime', () => {
    const { level, canyon, boss } = setup();
    expect(boss.arenaBoxes).toHaveLength(4);
    canyon.smashBox(0);
    canyon.eatBox(2);
    run(boss, hiddenSlime(), level, BOX_RESPAWN - 0.5);
    expect(canyon.boxes[0].eaten).toBe(true);
    run(boss, hiddenSlime(), level, 1);
    expect(canyon.boxes[0].eaten).toBe(false);
    expect(canyon.boxes[2].eaten).toBe(false);
    expect(level.tiles[6][3]).toBe(TileKind.BOX);
    expect(boss.takeEvents()).toContain('boxBack');
    // A slime sitting where the box goes keeps it away.
    canyon.smashBox(2);
    const inTheWay = new Slime({ x: 3.5 * TILE, y: 7.5 * TILE });
    inTheWay.falling = null;
    inTheWay.frozen = true;
    run(boss, inTheWay, level, BOX_RESPAWN + 1);
    expect(canyon.boxes[2].eaten).toBe(true);
  });

  it("doesn't squeeze in his first phase", () => {
    const { level, boss } = setup();
    wake(boss, level);
    const slime = slimeOnFloor(0, boss.body.left - 20);
    run(boss, slime, level, 1 / 60);
    expect(boss.state).toBe('windup');
  });

  it('squeezes you if you get too close in phase 2, and you fly up into the lava', () => {
    const { level, boss } = setup();
    wake(boss, level);
    boss.hp = 2;
    const slime = slimeOnFloor(0, boss.body.left - 20);
    expect(boss.distToBody(slime.center)).toBeLessThan(SQUEEZE_RANGE);
    run(boss, slime, level, 1 / 60);
    expect(boss.state).toBe('squeezeWarn');
    expect(boss.takeEvents()).toContain('squeezeWarn');
    run(boss, slime, level, SQUEEZE_WARN);
    expect(boss.state).toBe('squeeze');
    expect(slime.frozen).toBe(true);
    run(boss, slime, level, SQUEEZE_HOLD);
    expect(boss.takeEvents()).toEqual(expect.arrayContaining(['squeeze', 'launch']));
    expect(slime.isFalling).toBe(true);
    expect(slime.falling.vy).toBeLessThan(-1000);
    // Up, up... into the lava ceiling.
    let hazard = null;
    for (let k = 0; k < 60 && !hazard; k++) {
      slime.update(1 / 60, level);
      hazard = findHazard(level, slime, [], 0, null);
    }
    expect(hazard).toBe('fluid');
  });

  it('lets you escape a squeeze by getting away during the warning', () => {
    const { level, boss } = setup();
    wake(boss, level);
    boss.hp = 2;
    const slime = slimeOnFloor(0, boss.body.left - 20);
    run(boss, slime, level, 1 / 60);
    expect(boss.state).toBe('squeezeWarn');
    const away = { x: TILE + END_RADIUS + 1, y: 3.5 * TILE };
    for (const e of slime.ends) {
      Object.assign(e, away);
    }
    run(boss, slime, level, SQUEEZE_WARN + 0.05);
    expect(boss.state).not.toBe('squeeze');
    expect(slime.frozen).toBe(false);
  });

  it('a squeeze that bumps into something sticky on the way up is survivable', () => {
    const def = {
      ...ARENA,
      map: ARENA.map.map((r, i) => (i === 2 ? '#......###.......#' : r)),
    };
    const { level, boss } = setup(def);
    wake(boss, level);
    boss.hp = 2;
    // Squeezed on his left: the rafter over there catches you.
    boss.x = 9.5 * TILE + 60;
    const slime = slimeOnFloor(0, boss.body.left - 20);
    run(boss, slime, level, 1 / 60 + SQUEEZE_WARN + SQUEEZE_HOLD + 0.02);
    let hazard = null;
    for (let k = 0; k < 90 && !hazard; k++) {
      slime.update(1 / 60, level);
      hazard = findHazard(level, slime, [], 0, null);
    }
    expect(hazard).toBe(null);
    expect(slime.isFalling).toBe(false);
    expect(slime.center.y).toBeLessThan(4 * TILE);
  });

  it('gets glowing, invincible fists for 20 seconds every 20 seconds in his last phase', () => {
    const { level, boss } = setup();
    wake(boss, level);
    boss.hp = 1;
    expect(boss.phase).toBe(3);
    run(boss, hiddenSlime(), level, FIST_CYCLE - 0.5);
    expect(boss.invincible).toBe(false);
    run(boss, hiddenSlime(), level, 1);
    expect(boss.invincible).toBe(true);
    expect(boss.takeEvents()).toContain('glowOn');
    run(boss, hiddenSlime(), level, FIST_CYCLE - 1);
    expect(boss.invincible).toBe(true);
    run(boss, hiddenSlime(), level, 1);
    expect(boss.invincible).toBe(false);
    expect(boss.takeEvents()).toContain('glowOff');
    // ...and on and off again.
    run(boss, hiddenSlime(), level, FIST_CYCLE);
    expect(boss.invincible).toBe(true);
  });

  it('breaks boxes with glowing fists, but is not stunned', () => {
    const { level, canyon, boss } = setup();
    wake(boss, level);
    boss.hp = 1;
    boss.fistTime = FIST_CYCLE + 0.5;
    run(boss, slimeOnFloor(2), level, 6);
    const events = boss.takeEvents();
    expect(events).toEqual(expect.arrayContaining(['boxBreak', 'noStun']));
    expect(events).not.toContain('stunned');
    expect(canyon.boxes[2].eaten).toBe(true);
    expect(boss.state).not.toBe('stunned');
    // Once the glow wears off, a box stuns him again.
    boss.fistTime = 0.5;
    run(boss, slimeOnFloor(2), level, 8);
    expect(boss.takeEvents()).toContain('stunned');
  });

  it('keeps his damage when the slime dies, goes home, and the boxes come back', () => {
    const { level, canyon, boss } = setup();
    wake(boss, level);
    run(boss, slimeOnFloor(2), level, 6);
    boss.lick(tipOn(boss));
    expect(boss.hp).toBe(2);
    run(boss, slimeOnFloor(16), level, 2);
    boss.resetAfterSlimeDeath();
    expect(boss.hp).toBe(2);
    expect(boss.x).toBe(boss.homeX);
    expect(boss.state).toBe('walk');
    expect(canyon.boxes.every(b => !b.eaten)).toBe(true);
    expect(level.tiles[6][3]).toBe(TileKind.BOX);
    // A sleeping box stays asleep.
    const fresh = setup();
    fresh.boss.resetAfterSlimeDeath();
    expect(fresh.boss.state).toBe('box');
  });

  it('is beaten after 3 hits (through all 3 phases) and leaves a crate to eat', () => {
    const { level, boss } = setup();
    wake(boss, level);
    for (let hit = 0; hit < 3; hit++) {
      // Trick him into punching a box (the boxes come back each time).
      boss.resetAfterSlimeDeath();
      boss.fistTime = 0;
      run(boss, slimeOnFloor(2), level, 5);
      expect(boss.state).toBe('stunned');
      expect(boss.lick(tipOn(boss))).toBe('hit');
    }
    expect(boss.defeated).toBe(true);
    expect(boss.state).toBe('defeated');
    expect(boss.takeEvents()).toContain('defeated');
    expect(boss.lick(tipOn(boss))).toBe(null);
    // He leaves a crate on the floor where he was. Eat it to get the last power core.
    const crate = boss.crate;
    expect(crate.y).toBe(boss.floorY - TILE / 2);
    expect(boss.eatCrate({ x: crate.x + 200, y: crate.y })).toBe(false);
    expect(boss.eatCrate({ x: crate.x + TILE / 2 + 4, y: crate.y })).toBe(true);
    expect(boss.takeEvents()).toContain('crate');
    expect(boss.eatCrate({ x: crate.x, y: crate.y })).toBe(false);
    // Nothing more happens.
    expect(run(boss, slimeOnFloor(8), level, 3)).toEqual([]);
  });
});

describe('Boxing Match (15-4)', () => {
  const def = LEVELS.find(l => l.id === '15-4');

  it('has a section of power cores before the arena, and an exit door', () => {
    const level = parseLevel(def);
    expect(level.cores.length).toBeGreaterThan(0);
    expect(level.exit).toBeTruthy();
    // The cores are all outside the arena: the last one comes from the boss.
    const boss = new BoxerBoss(level, new CanyonStuff(level));
    expect(level.cores.every(c => !boss.inArena(c))).toBe(true);
    expect(boss.inArena(level.robot)).toBe(true);
  });

  it('has metal boxes in the arena to trick him with, that come back', () => {
    const level = parseLevel(def);
    const canyon = new CanyonStuff(level);
    const boss = new BoxerBoss(level, canyon);
    expect(boss.arenaBoxes.length).toBeGreaterThanOrEqual(2);
    expect(boss.arenaBoxes).toHaveLength(level.boxes.length);
  });

  it('lets a slime hiding behind a box trick him into punching it', () => {
    const level = parseLevel(def);
    const canyon = new CanyonStuff(level);
    const boss = new BoxerBoss(level, canyon);
    boss.lick(tipOn(boss));
    const box = level.boxes[0];
    const slime = new Slime({ x: box.x - TILE, y: boss.floorY - END_RADIUS - 1 });
    slime.falling = null;
    run(boss, hiddenSlime(), level, 2.5);
    boss.takeEvents();
    const hurts = run(boss, slime, level, 8);
    expect(hurts).toEqual([]);
    expect(boss.takeEvents()).toEqual(expect.arrayContaining(['boxBreak', 'stunned']));
  });
});
