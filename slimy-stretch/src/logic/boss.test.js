import { describe, expect, it } from 'vitest';
import { parseLevel } from './level.js';
import { Boss, EXPLOSION_RADIUS } from './boss.js';
import { Slime } from './slime.js';
import { LEVELS } from '../levels/levels.js';

const level = parseLevel(LEVELS.find(l => l.type === 'boss'));

function setup() {
  const slime = new Slime(level.start);
  for (let i = 0; i < 200 && slime.isFalling; i++) {
    slime.update(1 / 60, level);
  }
  return { slime, boss: new Boss(level) };
}

function throwAtRobot(boss) {
  const bomb = { x: boss.x - 200, y: boss.y - 80, vx: 0, vy: 0, fuse: 3, state: 'held' };
  boss.bombs.push(bomb);
  boss.releaseBomb(bomb, { x: 1200, y: -100 }, true);
  return bomb;
}

function run(boss, slime, seconds) {
  let hurt = false;
  for (let t = 0; t < seconds; t += 1 / 60) {
    hurt = boss.update(1 / 60, slime) || hurt;
  }
  return hurt;
}

describe('Boss', () => {
  it('throws bombs at the slime', () => {
    const { slime, boss } = setup();
    run(boss, slime, 2.5);
    expect(boss.bombs.length).toBeGreaterThan(0);
    expect(boss.takeEvents()).toContain('throw');
  });

  it('a bomb exploding next to the slime hurts it', () => {
    const { slime, boss } = setup();
    boss.throwTimer = 99;
    const c = slime.center;
    boss.bombs.push({
      x: c.x + EXPLOSION_RADIUS / 2,
      y: c.y,
      vx: 0,
      vy: 0,
      fuse: 0.05,
      state: 'resting',
    });
    expect(run(boss, slime, 0.2)).toBe(true);
  });

  it('the slime can grab a bomb and flick it back to hit the robot', () => {
    const { slime, boss } = setup();
    boss.throwTimer = 99;
    boss.bombs.push({ x: 300, y: 300, vx: 0, vy: 0, fuse: 3, state: 'resting' });
    const grabbed = boss.grabBomb({ x: 305, y: 300 });
    expect(grabbed.state).toBe('held');
    throwAtRobot(boss);
    run(boss, slime, 1);
    expect(boss.hp).toBe(2);
    expect(boss.phase).toBe(2);
  });

  it('does not stomp in phase 1', () => {
    const { slime, boss } = setup();
    boss.throwTimer = 99;
    run(boss, slime, 12);
    expect(boss.takeEvents()).not.toContain('jump');
  });

  it('starts stomping in phase 2', () => {
    const { slime, boss } = setup();
    boss.hp = 2;
    boss.throwTimer = 99;
    run(boss, slime, 6);
    expect(boss.takeEvents()).toContain('jump');
  });

  it('a stomp landing on the slime hurts it', () => {
    const { slime, boss } = setup();
    boss.hp = 2;
    boss.throwTimer = 99;
    boss.stompTimer = 0;
    expect(run(boss, slime, 4)).toBe(true);
  });

  it('the shield in phase 3 blocks bombs', () => {
    const { slime, boss } = setup();
    boss.hp = 1;
    boss.throwTimer = 99;
    boss.stompTimer = 99;
    boss.shieldOn = true;
    boss.shieldTimer = 5;
    throwAtRobot(boss);
    run(boss, slime, 1);
    expect(boss.hp).toBe(1);
    expect(boss.takeEvents()).toContain('blocked');
  });

  it('keeps its damage when the slime dies (each hit is a checkpoint)', () => {
    const { slime, boss } = setup();
    boss.hp = 2;
    boss.state = 'stompDown';
    boss.shieldOn = true;
    boss.bombs.push({ x: 300, y: 300, vx: 0, vy: 0, fuse: 3, state: 'resting' });
    boss.resetAfterSlimeDeath();
    expect(boss.hp).toBe(2);
    expect(boss.phase).toBe(2);
    expect(boss.state).toBe('idle');
    expect(boss.y).toBe(boss.homeY);
    expect(boss.bombs).toEqual([]);
    expect(boss.shieldOn).toBe(false);
  });

  it('is defeated after 3 hits', () => {
    const { slime, boss } = setup();
    for (let i = 0; i < 3; i++) {
      boss.throwTimer = 99;
      boss.stompTimer = 99;
      boss.shieldOn = false;
      boss.shieldTimer = 99;
      boss.state = 'idle';
      boss.y = boss.homeY;
      throwAtRobot(boss);
      run(boss, slime, 1);
    }
    expect(boss.defeated).toBe(true);
  });
});
