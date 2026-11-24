import { describe, expect, it } from 'vitest';
import { parseLevel, TileKind } from './level.js';
import { Slime } from './slime.js';
import { BigMachine } from './bigMachine.js';
import { TILE } from './constants.js';

const def = {
  id: 'bm',
  type: 'boss',
  boss: 'machine',
  button: [17, 2],
  crushers: [8, 5],
  map: [
    '####################',
    '#..................#',
    '#..................#',
    '#...............####',
    '#...............####',
    '#...............####',
    '#S.............R####',
    '#.<<<<<<<<<<<<<<####',
    '####################',
  ],
};

function slimeAt(x, y) {
  const slime = new Slime({ x, y });
  slime.falling = null;
  return slime;
}

function run(boss, slime, seconds) {
  let hurt = false;
  for (let t = 0; t < seconds; t += 1 / 60) {
    hurt = boss.update(1 / 60, slime) || hurt;
  }
  return hurt;
}

// Somewhere safe, up out of the way of everything.
const safe = () => slimeAt(1.5 * TILE, 1.5 * TILE);

describe('the big machine', () => {
  it('feeds bomb boxes out onto its belt, which blow up off the end', () => {
    const level = parseLevel(def);
    const boss = new BigMachine(level);
    run(boss, safe(), 2);
    expect(boss.crates.length).toBeGreaterThan(0);
    expect(boss.crates[0].kind).toBe('bomb');
    const events = [];
    for (let t = 0; t < 14; t += 1 / 60) {
      boss.update(1 / 60, safe());
      events.push(...boss.takeEvents());
    }
    expect(events).toContain('explode');
  });

  it('a crusher stamping down on the slime hurts', () => {
    const level = parseLevel(def);
    const boss = new BigMachine(level);
    const under = slimeAt(8.5 * TILE, 7 * TILE - 15);
    expect(run(boss, under, 3)).toBe(true);
  });

  it('a slime shot in its mouth runs the belt backwards, and a bomb box going in shuts its mouth', () => {
    const level = parseLevel(def);
    const boss = new BigMachine(level);
    run(boss, safe(), 1.6); // the first box comes out
    const blob = { x: boss.mouth.x, y: boss.mouth.y, state: 'flying' };
    expect(boss.catchBlobs([blob])).toBe(true);
    expect(blob.gone).toBe(true);
    expect(boss.beltDir).toBe(1);
    expect(level.tiles[7][5]).toBe(TileKind.BELT_RIGHT);
    run(boss, safe(), 3);
    expect(boss.mouthOpen).toBe(false);
    expect(boss.beltDir).toBe(-1);
  });

  it('pressing the button while its mouth is shut hurts it and sends you back', () => {
    const level = parseLevel(def);
    const boss = new BigMachine(level);
    boss.mouthOpen = false;
    boss.buttonTimer = 5;
    boss.update(1 / 60, slimeAt(boss.button.x, boss.button.y));
    expect(boss.hp).toBe(2);
    expect(boss.phase).toBe(2);
    expect(boss.sendBack).toBe(true);
    expect(boss.mouthOpen).toBe(true);
  });

  it('the button does nothing while its mouth is open', () => {
    const level = parseLevel(def);
    const boss = new BigMachine(level);
    boss.update(1 / 60, slimeAt(boss.button.x, boss.button.y));
    expect(boss.hp).toBe(3);
  });

  it('shoots fireballs in phase 2 that hurt, and set off bomb boxes', () => {
    const level = parseLevel(def);
    const boss = new BigMachine(level);
    boss.hp = 2;
    const target = slimeAt(10.5 * TILE, 4.5 * TILE);
    expect(run(boss, target, 5)).toBe(true);
    // A fireball flying into a bomb box blows it up.
    boss.crates = [{ x: 12 * TILE, y: 6 * TILE, vy: 0, kind: 'bomb', state: 'belt' }];
    boss.fireballs = [{ x: 12 * TILE + 20, y: 6 * TILE, vx: -300, vy: 0, age: 0 }];
    boss.update(1 / 60, safe());
    expect(boss.crates).toHaveLength(0);
    expect(boss.explosions.length).toBeGreaterThan(0);
  });

  it('adds another crusher and feeds out ice in phase 3', () => {
    const level = parseLevel(def);
    const boss = new BigMachine(level);
    boss.hp = 1;
    const kinds = new Set();
    const states = new Set();
    for (let t = 0; t < 10; t += 1 / 60) {
      boss.update(1 / 60, safe());
      boss.crates.forEach(c => kinds.add(c.kind));
      states.add(boss.crushers[1].state);
    }
    expect(kinds.has('ice')).toBe(true);
    expect(states.has('slam')).toBe(true);
  });

  it('keeps its damage when the slime dies, and is beaten after 3 presses', () => {
    const level = parseLevel(def);
    const boss = new BigMachine(level);
    for (let i = 0; i < 3; i++) {
      boss.mouthOpen = false;
      boss.buttonTimer = 5;
      boss.update(1 / 60, slimeAt(boss.button.x, boss.button.y));
      if (i === 0) {
        boss.resetAfterSlimeDeath();
        expect(boss.hp).toBe(2);
      }
    }
    expect(boss.defeated).toBe(true);
  });
});
