import { describe, expect, it } from 'vitest';
import { parseLevel, TileKind } from './level.js';
import { Slime } from './slime.js';
import { END_RADIUS, TILE } from './constants.js';
import { LEVELS } from '../levels/levels.js';
import { SlimeShots } from './slimeShot.js';
import { solveLevel } from './solver.js';
import {
  BLAST_RADIUS,
  BOMB_FUSE,
  CHASE_TIME,
  HAND_RADIUS,
  HAND_STUCK,
  HAND_WARN,
  handsFor,
  HEAD_DOWN,
  HEAD_WOBBLE,
  KingClaw,
} from './kingClaw.js';

const def = LEVELS.find(l => l.id === '12-4');
const FLOOR = 15 * TILE - END_RADIUS - 1; // where a slime sits on the arena floor
const LEFT = 2.5 * TILE;
const RIGHT = 14.5 * TILE;

function slimeAt(x, y = FLOOR) {
  const slime = new Slime({ x, y });
  slime.falling = null;
  return slime;
}

/** Put the slime somewhere else, settled. */
function moveSlime(slime, x, y = FLOOR) {
  slime.holdAt(x, y);
  slime.frozen = false;
}

/** Run the boss; returns the hurts and events that happened. */
function run(boss, slime, seconds, extra = () => {}) {
  const hurts = [];
  const events = [];
  for (let t = 0; t < seconds; t += 1 / 60) {
    const h = boss.update(1 / 60, slime);
    events.push(...boss.takeEvents());
    extra();
    if (h) {
      hurts.push(h);
    }
  }
  return { hurts, events };
}

/** Run until `done()` is true (or `max` seconds pass). Returns the hurts and events. */
function runUntil(boss, slime, done, max = 20, extra = () => {}) {
  const hurts = [];
  const events = [];
  for (let t = 0; t < max && !done(); t += 1 / 60) {
    const r = run(boss, slime, 1 / 60, extra);
    hurts.push(...r.hurts);
    events.push(...r.events);
  }
  return { hurts, events };
}

/**
 * Dodge every hand (hop to the other side of the arena whenever one starts
 * wiggling) and eat each one with the tongue while it's stuck.
 */
function eatAllHands(boss, slime) {
  const dodge = () => {
    for (const h of boss.hands) {
      if (h.state === 'warn' && Math.abs(h.x - slime.center.x) < 3 * TILE) {
        moveSlime(slime, slime.center.x < boss.x ? RIGHT : LEFT);
      }
      if (h.state === 'stuck') {
        boss.eatHand({ x: h.x, y: h.y - HAND_RADIUS });
      }
    }
  };
  return runUntil(boss, slime, () => boss.state !== 'up', 60, dodge);
}

/** Get his head down, and shoot a blob of slime into his mouth. */
function hitHim(boss, slime) {
  eatAllHands(boss, slime);
  runUntil(boss, slime, () => boss.state === 'down', 10);
  expect(boss.catchBlobs([{ x: boss.mouth.x, y: boss.mouth.y, state: 'flying' }])).toBe(true);
}

describe('King Claw', () => {
  it('starts with 2 hands spread along the top', () => {
    const level = parseLevel(def);
    const boss = new KingClaw(level);
    expect(boss.hp).toBe(3);
    expect(boss.phase).toBe(1);
    expect(boss.hands).toHaveLength(2);
    expect(boss.hands.every(h => h.state === 'wait' && h.y === boss.trackY)).toBe(true);
    expect([1, 2, 3].map(handsFor)).toEqual([2, 3, 4]);
  });

  it('sends a hand to chase the slime along the top, then it stops and wiggles', () => {
    const level = parseLevel(def);
    const boss = new KingClaw(level);
    const slime = slimeAt(LEFT);
    const { events } = runUntil(boss, slime, () => boss.hands.some(h => h.state === 'chase'));
    expect(events).toContain('chase');
    const hand = boss.hands.find(h => h.state === 'chase');
    run(boss, slime, CHASE_TIME - 0.1);
    // It's caught up with the slime, still up at the top.
    expect(Math.abs(hand.x - LEFT)).toBeLessThan(4);
    expect(hand.y).toBe(boss.trackY);
    // Only one hand hunts at a time.
    expect(boss.hands.filter(h => h.state === 'chase')).toHaveLength(1);
    const r = run(boss, slime, 0.2);
    expect(r.events).toContain('warn');
    expect(hand.state).toBe('warn');
    // It holds still (just wiggling) while it warns you.
    const x = hand.x;
    moveSlime(slime, RIGHT);
    run(boss, slime, HAND_WARN - 0.3);
    expect(hand.x).toBe(x);
    expect(hand.y).toBe(boss.trackY);
  });

  it('grabs a slime that stays put, carries it up to his mouth, and eats it', () => {
    const level = parseLevel(def);
    const boss = new KingClaw(level);
    const slime = slimeAt(LEFT);
    const { events } = runUntil(boss, slime, () => slime.frozen);
    expect(events).toContain('grab');
    const hand = boss.hands.find(h => h.state === 'carry');
    expect(hand).toBeTruthy();
    // Up it goes to his mouth...
    const r = runUntil(boss, slime, () => hand.state !== 'carry', 6);
    expect(slime.center.y).toBeLessThan(boss.homeY + HAND_RADIUS * 2);
    expect(Math.abs(slime.center.x - boss.x)).toBeLessThan(2);
    // ...CHOMP! That hurts, and he sends the slime back to the start.
    expect(r.events).toContain('chomp');
    expect(r.hurts).toContain('kingclaw');
    expect(boss.sendBack).toBe(true);
    expect(hand.state).toBe('home');
  });

  it('gets stuck on the ground after a miss, and a tongue can eat the stuck hand', () => {
    const level = parseLevel(def);
    const boss = new KingClaw(level);
    const slime = slimeAt(LEFT);
    runUntil(boss, slime, () => boss.hands.some(h => h.state === 'warn'));
    const hand = boss.hands.find(h => h.state === 'warn');
    moveSlime(slime, RIGHT);
    const { events, hurts } = runUntil(boss, slime, () => hand.state === 'stuck', 3);
    expect(events).toContain('miss');
    expect(hurts).toEqual([]);
    expect(hand.y + HAND_RADIUS).toBe(15 * TILE);
    // The tongue has to actually touch it.
    expect(boss.eatHand({ x: hand.x + 80, y: hand.y })).toBe(false);
    run(boss, slime, HAND_STUCK - 0.3);
    expect(boss.eatHand({ x: hand.x + 30, y: hand.y })).toBe(true);
    expect(hand.state).toBe('eaten');
    expect(boss.hands.filter(h => h.state !== 'eaten')).toHaveLength(1);
  });

  it('pulls a stuck hand back up if you are too slow to eat it', () => {
    const level = parseLevel(def);
    const boss = new KingClaw(level);
    const slime = slimeAt(LEFT);
    runUntil(boss, slime, () => boss.hands.some(h => h.state === 'warn'));
    const hand = boss.hands.find(h => h.state === 'warn');
    moveSlime(slime, RIGHT);
    runUntil(boss, slime, () => hand.state === 'stuck', 3);
    run(boss, slime, HAND_STUCK + 0.1);
    expect(hand.state).toBe('rise');
    expect(boss.eatHand({ x: hand.x, y: hand.y })).toBe(false);
    runUntil(boss, slime, () => hand.state === 'wait', 6);
    expect(hand.y).toBe(boss.trackY);
  });

  it('drops his head once all his hands are eaten; a slime shot in the mouth hurts him', () => {
    const level = parseLevel(def);
    const boss = new KingClaw(level);
    const slime = slimeAt(LEFT);
    const r = eatAllHands(boss, slime);
    expect(r.events).toContain('wobble');
    expect(boss.state).toBe('wobble');
    // A blob doesn't count until he's down with his mouth open.
    expect(boss.catchBlobs([{ x: boss.mouth.x, y: boss.mouth.y, state: 'flying' }])).toBe(false);
    run(boss, slime, HEAD_WOBBLE + 0.1);
    expect(boss.state).toBe('fall');
    const down = runUntil(boss, slime, () => boss.state === 'down', 3);
    expect(down.events).toContain('thud');
    expect(boss.y + 50).toBe(15 * TILE);
    // A blob that misses his mouth does nothing.
    const miss = { x: boss.mouth.x + 90, y: boss.mouth.y, state: 'flying' };
    expect(boss.catchBlobs([miss])).toBe(false);
    const blob = { x: boss.mouth.x + 10, y: boss.mouth.y - 5, state: 'flying' };
    expect(boss.catchBlobs([miss, blob])).toBe(true);
    expect(blob.gone).toBe(true);
    expect(boss.hp).toBe(2);
    expect(boss.takeEvents()).toContain('hit');
    // Back up he goes, and now he has 3 hands.
    expect(boss.state).toBe('rise');
    const up = runUntil(boss, slime, () => boss.state === 'up', 5);
    expect(up.events).toContain('hands');
    expect(boss.phase).toBe(2);
    expect(boss.hands).toHaveLength(3);
  });

  it('can be hit by a real slime shot from the arena floor', () => {
    const level = parseLevel(def);
    const boss = new KingClaw(level);
    const slime = slimeAt(LEFT);
    eatAllHands(boss, slime);
    runUntil(boss, slime, () => boss.state === 'down', 10);
    // Stand a few tiles away on the floor and shoot at his mouth.
    const shots = new SlimeShots();
    const from = { x: boss.x - 3 * TILE, y: FLOOR };
    moveSlime(slime, from.x);
    shots.fire(from, boss.mouth);
    let hit = false;
    for (let t = 0; t < 1 && !hit; t += 1 / 60) {
      shots.update(1 / 60, level, slime);
      hit = boss.catchBlobs(shots.blobs);
    }
    expect(hit).toBe(true);
  });

  it("squashes a slime that doesn't get out from under his falling head", () => {
    const level = parseLevel(def);
    const boss = new KingClaw(level);
    const slime = slimeAt(LEFT);
    eatAllHands(boss, slime);
    moveSlime(slime, boss.x);
    const { hurts } = runUntil(boss, slime, () => boss.state === 'down', 4);
    expect(hurts).toContain('kingclaw');
  });

  it('goes back up with all his hands back if you are too slow', () => {
    const level = parseLevel(def);
    const boss = new KingClaw(level);
    const slime = slimeAt(LEFT);
    eatAllHands(boss, slime);
    runUntil(boss, slime, () => boss.state === 'down', 10);
    const { events } = run(boss, slime, HEAD_DOWN + 0.1);
    expect(events).toContain('tooSlow');
    runUntil(boss, slime, () => boss.state === 'up', 5);
    expect(boss.hp).toBe(3);
    expect(boss.hands).toHaveLength(2);
    expect(boss.hands.every(h => h.state !== 'eaten')).toBe(true);
  });

  it('drops bombs from a chasing hand after the first hit', () => {
    const level = parseLevel(def);
    const boss = new KingClaw(level);
    const slime = slimeAt(LEFT);
    // No bombs in the first phase.
    eatAllHands(boss, slime);
    expect(boss.bombs).toHaveLength(0);
    hitHim(boss, slime);
    runUntil(boss, slime, () => boss.state === 'up', 5);
    const { events } = runUntil(boss, slime, () => boss.bombs.length > 0, 10);
    expect(events).toContain('bomb');
    const bomb = boss.bombs[0];
    const hand = boss.hands.find(h => h.state === 'chase');
    expect(Math.abs(bomb.x - hand.x)).toBeLessThan(1);
    // It falls, then blows up after its fuse, hurting a slime close by.
    moveSlime(slime, bomb.x + BLAST_RADIUS / 2);
    const boom = runUntil(boss, slime, () => !boss.bombs.includes(bomb), BOMB_FUSE + 0.2);
    expect(boom.events).toContain('explode');
    expect(boom.hurts).toContain('bomb');
  });

  it('turns the walls to ice for the last phase, and a slime on them slips off', () => {
    const level = parseLevel(def);
    const boss = new KingClaw(level);
    const slime = slimeAt(LEFT);
    hitHim(boss, slime);
    expect(level.tiles[5][0]).toBe(TileKind.WALL);
    runUntil(boss, slime, () => boss.state === 'up', 5);
    // Hang on the left wall, then hit him again.
    hitHim(boss, slime);
    moveSlime(slime, TILE + END_RADIUS + 1, 5 * TILE);
    expect(boss.takeEvents()).toContain('ice');
    expect(boss.phase).toBe(3);
    expect(level.tiles[5][0]).toBe(TileKind.ICE);
    expect(level.tiles[5][21]).toBe(TileKind.ICE);
    // The floor and ledges are still sticky.
    expect(level.tiles[15][5]).toBe(TileKind.WALL);
    expect(level.tiles[8][5]).toBe(TileKind.WALL);
    run(boss, slime, 1 / 60);
    expect(slime.isFalling).toBe(true);
    runUntil(boss, slime, () => boss.state === 'up', 5);
    expect(boss.hands).toHaveLength(4);
  });

  it('keeps his damage (and icy walls) when the slime dies', () => {
    const level = parseLevel(def);
    const boss = new KingClaw(level);
    const slime = slimeAt(LEFT);
    hitHim(boss, slime);
    runUntil(boss, slime, () => boss.state === 'up', 5);
    hitHim(boss, slime);
    // Halfway through eating his hands, the slime dies.
    runUntil(boss, slime, () => boss.state === 'up', 5);
    runUntil(boss, slime, () => boss.hands.some(h => h.state === 'warn'));
    boss.resetAfterSlimeDeath();
    expect(boss.hp).toBe(1);
    expect(boss.state).toBe('up');
    expect(boss.y).toBe(boss.homeY);
    expect(boss.hands).toHaveLength(4);
    expect(boss.hands.every(h => h.state === 'wait')).toBe(true);
    expect(boss.bombs).toHaveLength(0);
    expect(level.tiles[5][0]).toBe(TileKind.ICE);
  });

  it('is beaten after 3 hits', () => {
    const level = parseLevel(def);
    const boss = new KingClaw(level);
    const slime = slimeAt(LEFT);
    for (let i = 0; i < 2; i++) {
      hitHim(boss, slime);
      runUntil(boss, slime, () => boss.state === 'up', 5);
    }
    hitHim(boss, slime);
    expect(boss.defeated).toBe(true);
    expect(boss.takeEvents()).toContain('defeated');
    expect(boss.hands).toHaveLength(0);
    const { hurts } = run(boss, slime, 5);
    expect(hurts).toEqual([]);
  });

  it('gives you time to get out of the way of a dropping hand', () => {
    const level = parseLevel(def);
    const boss = new KingClaw(level);
    const slime = slimeAt(LEFT);
    runUntil(boss, slime, () => boss.hands.some(h => h.state === 'warn'));
    const hand = boss.hands.find(h => h.state === 'warn');
    let t = 0;
    runUntil(
      boss,
      slime,
      () => hand.y > FLOOR - HAND_RADIUS - END_RADIUS,
      3,
      () => {
        t += 1 / 60;
      }
    );
    // At least a second from the wiggle to it reaching the slime: plenty of
    // time for a quick stretch out of the way.
    expect(t).toBeGreaterThan(1);
  });

  it('has an arena with places to stand even once the walls are ice', () => {
    const level = parseLevel(def);
    const boss = new KingClaw(level);
    boss.freezeWalls();
    const result = solveLevel(level);
    const onLedge = result.reached.filter(p => p.y < 8 * TILE && p.x > 3 * TILE);
    const onFloor = result.reached.filter(p => Math.abs(p.y - FLOOR) < 2);
    // The gumdrops bounce you up onto the ledges.
    expect(onLedge.length).toBeGreaterThan(0);
    expect(onFloor.length).toBeGreaterThan(10);
  });
});
