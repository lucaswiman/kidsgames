import { describe, expect, it } from 'vitest';
import { parseLevel as parseMap, TileKind } from './level.js';
import { Slime } from './slime.js';
import { GRAVITY, TILE } from './constants.js';
import { CanyonStuff } from './canyon.js';
import { HauntedStuff } from './haunted.js';
import { JungleStuff } from './jungle.js';
import { SkyStuff } from './sky.js';
import { IslandStuff } from './island.js';
import { ComputerStuff } from './computer.js';
import { SpaceStuff } from './space.js';
import { RobotsStuff } from './robots.js';
import { DOUBLE, REGULAR, SlimePieces } from './sizes.js';
import {
  isSmashable,
  LAVA_SINK,
  MEGA_COOLDOWN,
  MEGA_HEIGHT,
  MEGA_JUMP,
  MEGA_JUMP_TILES,
  MEGA_TIME,
  MEGA_WALK,
  MegaSlime,
  parkSlime,
  shrinkBack,
  smashBlock,
  smashEnemies,
} from './megaSlime.js';

/** Little test maps don't all need an exit door. */
function parseLevel(def) {
  return parseMap(def.map.some(r => r.includes('E')) ? def : { ...def, type: 'boss' });
}

/** A room `w` wide and `h` tall (inside), with a floor. Extra rows go on top of the floor. */
function room(w, h, floorRows = []) {
  const map = ['#'.repeat(w + 2)];
  for (let r = 0; r < h; r++) {
    map.push('#' + (floorRows[r - (h - floorRows.length)] || '.'.repeat(w)) + '#');
  }
  map.push('#'.repeat(w + 2));
  map[map.length - 2] = map[map.length - 2].replace(/^#./, '#S');
  return parseLevel({ id: 't', map });
}

/** Turn into Mega Slime standing on the floor of `level` in column `col`, and land. */
function megaAt(level, col) {
  const mega = new MegaSlime();
  const floor = level.height - 1;
  expect(mega.start(level, { x: (col + 0.5) * TILE, y: floor * TILE - 15 })).toBe(true);
  run(mega, level, 0.3);
  expect(mega.onGround).toBe(true);
  return mega;
}

function run(mega, level, seconds, smash) {
  let ended = false;
  for (let k = 0; k < Math.round(seconds * 60); k++) {
    ended = mega.update(1 / 60, level, smash) || ended;
  }
  return ended;
}

/** Smashing that just empties the tile (for levels without the real stuff). */
const smashAll = level => (col, row) => {
  level.tiles[row][col] = TileKind.EMPTY;
  return true;
};

describe('Mega Slime', () => {
  it('lasts 12 seconds, then needs 60 seconds to rest', () => {
    const level = room(10, 4);
    const mega = megaAt(level, 3);
    expect(mega.active).toBe(true);
    expect(mega.ready).toBe(false);
    expect(mega.takeEvents()).toContain('start');
    expect(run(mega, level, MEGA_TIME - 0.5)).toBe(false);
    expect(mega.active).toBe(true);
    expect(run(mega, level, 0.4)).toBe(true);
    expect(mega.active).toBe(false);
    expect(mega.takeEvents()).toContain('end');
    expect(mega.cooldown).toBe(MEGA_COOLDOWN);
    // No going Mega again until it has rested.
    expect(mega.start(level, { x: 150, y: 150 })).toBe(false);
    mega.tick(MEGA_COOLDOWN - 1);
    expect(mega.ready).toBe(false);
    mega.tick(1);
    expect(mega.ready).toBe(true);
    expect(mega.start(level, { x: 150, y: 180 })).toBe(true);
  });

  it('needs room to stand, but finds some nearby if it can', () => {
    const tight = parseLevel({ id: 't', map: ['#####', '#S..#', '#####'] });
    expect(new MegaSlime().start(tight, { x: 72, y: 81 })).toBe(false);
    const level = room(10, 4);
    const mega = new MegaSlime();
    // Right next to a wall, it scoots over a little to fit.
    expect(mega.start(level, { x: TILE + 15, y: 5 * TILE - 15 })).toBe(true);
    expect(mega.rect.left).toBeGreaterThanOrEqual(TILE);
  });

  it('walks left and right at a brisk pace, but not through walls or ice', () => {
    const level = room(14, 4);
    const mega = megaAt(level, 3);
    const x0 = mega.x;
    mega.input.right = true;
    run(mega, level, 1);
    expect(mega.x - x0).toBeCloseTo(MEGA_WALK, -1);
    expect(mega.facing).toBe(1);
    run(mega, level, 5);
    expect(mega.rect.right).toBeLessThanOrEqual(15 * TILE + 0.01);
    mega.input = { left: true, right: false };
    run(mega, level, 1);
    expect(mega.facing).toBe(-1);
    expect(mega.x).toBeLessThan(15 * TILE - MEGA_WALK + 40);
    const icy = room(8, 4, ['....I...', '....I...']);
    const m2 = megaAt(icy, 2);
    m2.input.right = true;
    run(m2, icy, 2, smashAll(icy));
    expect(m2.rect.right).toBeLessThanOrEqual(5 * TILE + 0.01);
    expect(icy.tiles[4][5]).toBe(TileKind.ICE);
  });

  it('jumps absurdly high: about 16 tiles, enough to clear a whole flood level', () => {
    expect(MEGA_JUMP).toBeCloseTo(Math.sqrt(2 * GRAVITY * MEGA_JUMP_TILES * TILE));
    const level = room(6, 22);
    const mega = megaAt(level, 3);
    const floorY = mega.y;
    // Only from the ground: no jumping again in mid-air.
    expect(mega.jump(level)).toBe(true);
    expect(mega.jump(level)).toBe(false);
    let top = floorY;
    for (let k = 0; k < 180; k++) {
      mega.update(1 / 60, level);
      top = Math.min(top, mega.y);
    }
    const tiles = (floorY - top) / TILE;
    expect(tiles).toBeGreaterThan(MEGA_JUMP_TILES - 0.5);
    expect(tiles).toBeLessThan(MEGA_JUMP_TILES + 0.5);
    // ...and lands back on the floor.
    run(mega, level, 2);
    expect(mega.onGround).toBe(true);
    expect(mega.y).toBe(floorY);
  });

  it('bonks its head on ceilings, and lands on one-way platforms', () => {
    const level = room(6, 8, ['------', '......', '......', '......']);
    const mega = megaAt(level, 3);
    mega.jump(level);
    run(mega, level, 3);
    // Up through the platform, and down onto it.
    expect(mega.onGround).toBe(true);
    expect(mega.y).toBe(5 * TILE);
    const low = room(6, 4);
    const m2 = megaAt(low, 3);
    m2.jump(low);
    run(m2, low, 0.3);
    expect(m2.rect.top).toBeGreaterThanOrEqual(TILE);
  });

  it('smashes breakable blocks it walks or jumps into, but not ones it stands on', () => {
    const level = room(10, 4, ['....M.....', '....M.....']);
    const mega = megaAt(level, 1);
    mega.input.right = true;
    run(mega, level, 1, smashAll(level));
    expect(level.tiles[3][5]).toBe(TileKind.EMPTY);
    expect(level.tiles[4][5]).toBe(TileKind.EMPTY);
    expect(mega.x).toBeGreaterThan(6 * TILE);
    // Jumping up into a box smashes it.
    const up = parseLevel({
      id: 't',
      map: ['######', '#....#', '#..M.#', '#....#', '#....#', '#S...#', '######'],
    });
    const m2 = megaAt(up, 3);
    m2.jump(up);
    run(m2, up, 0.2, smashAll(up));
    expect(up.tiles[2][3]).toBe(TileKind.EMPTY);
    // Standing on boxes is fine: they hold you up.
    const floor = parseLevel({
      id: 't',
      map: ['#####', '#...#', '#...#', '#...#', '#S..#', '#MMM#', '#####'],
    });
    const m3 = new MegaSlime();
    m3.start(floor, { x: 2.5 * TILE, y: 5 * TILE - 15 });
    run(m3, floor, 1, smashAll(floor));
    expect(m3.onGround).toBe(true);
    expect(floor.tiles[5][2]).toBe(TileKind.BOX);
  });

  it('only breaks the breakable kinds of blocks', () => {
    for (const kind of ['BOX', 'CRUMBLE', 'FLOORBOARD', 'LEAFY', 'SLEEPY']) {
      expect(isSmashable(TileKind[kind])).toBe(true);
    }
    for (const kind of ['WALL', 'ICE', 'BELT_RIGHT', 'SKY_ISLAND', 'ALARM_DOOR', 'MACHINE']) {
      expect(isSmashable(TileKind[kind])).toBe(false);
    }
    const level = room(8, 4, ['....#...', '....#...']);
    const mega = megaAt(level, 1);
    mega.input.right = true;
    let asked = 0;
    run(mega, level, 2, () => {
      asked++;
      return true;
    });
    expect(asked).toBe(0);
    expect(level.tiles[4][5]).toBe(TileKind.WALL);
  });

  it('walks and swims through lava without getting hurt, and can jump back out', () => {
    const level = parseLevel({
      id: 't',
      map: [
        '##############',
        ...Array(12).fill('#............#'),
        '#............#',
        '#............#',
        '#............#',
        '#............#',
        '#S...........#',
        '###LLLLLL#####',
        '###LLLLLL#####',
        '###LLLLLL#####',
        '##############',
      ],
    });
    const mega = new MegaSlime();
    mega.start(level, { x: 1.5 * TILE, y: 18 * TILE - 15 });
    run(mega, level, 0.3);
    mega.input.right = true;
    run(mega, level, 0.4);
    mega.input.right = false;
    // Sinking slowly into the lava...
    run(mega, level, 0.5);
    expect(mega.inLava(level)).toBe(true);
    expect(mega.vy).toBeLessThanOrEqual(LAVA_SINK);
    expect(mega.hurt(level)).toBe(null);
    run(mega, level, 2);
    expect(mega.hurt(level)).toBe(null);
    // ...and a mighty jump out.
    expect(mega.jump(level)).toBe(true);
    mega.input.right = true;
    run(mega, level, 2);
    expect(mega.inLava(level)).toBe(false);
    expect(mega.hurt(level)).toBe(null);
  });

  it("still drowns in any liquid that isn't lava, and can fall out of the world", () => {
    for (const fluid of ['W', 'h']) {
      const level = parseLevel({
        id: 't',
        map: [
          '#########',
          '#.......#',
          '#.......#',
          '#S......#',
          `###${fluid}${fluid}####`,
          '#########',
        ],
      });
      const mega = new MegaSlime();
      mega.start(level, { x: 1.5 * TILE, y: 4 * TILE - 15 });
      run(mega, level, 0.3);
      expect(mega.hurt(level)).toBe(null);
      mega.input.right = true;
      let hurt = null;
      for (let k = 0; k < 120 && !hurt; k++) {
        mega.update(1 / 60, level);
        hurt = mega.hurt(level);
      }
      expect(hurt).toBe('drown');
    }
    // A rising flood: water gets you, lava doesn't.
    const level = room(6, 6);
    const mega = megaAt(level, 3);
    expect(mega.hurt(level, { y: mega.y - 40, lava: true })).toBe(null);
    expect(mega.hurt(level, { y: mega.y - 40, lava: false })).toBe('drown');
    expect(mega.hurt(level, { y: mega.y + 40, lava: false })).toBe(null);
    const pit = parseLevel({ id: 't', map: ['#####', '#S..#', '#....', '##.##'] });
    const m2 = new MegaSlime();
    m2.start(pit, { x: 2.5 * TILE, y: 2 * TILE + 30 });
    run(m2, pit, 2);
    expect(m2.hurt(pit)).toBe('fell');
  });

  it('carries the slime around inside it, and shrinks back into a double size slime', () => {
    const level = room(10, 4);
    const mega = megaAt(level, 4);
    const slime = new Slime(level.start);
    const pieces = new SlimePieces(slime);
    parkSlime(mega, slime);
    expect(slime.frozen).toBe(true);
    expect(slime.ends[0].y).toBeCloseTo(mega.feet.y);
    expect(slime.ends[1].y).toBeCloseTo(mega.head.y);
    expect(slime.ends[0].y - slime.ends[1].y).toBeGreaterThan(MEGA_HEIGHT / 2);
    expect(pieces.active.size).toBe(REGULAR);
    run(mega, level, MEGA_TIME);
    const back = shrinkBack(mega, pieces);
    expect(back).toBe(slime);
    expect(slime.frozen).toBe(false);
    expect(slime.isFalling).toBe(true);
    expect(pieces.count).toBe(1);
    expect(pieces.active.size).toBe(DOUBLE);
    // ...until it gets hurt: then it splits into two regular slimes.
    const { outcome } = pieces.hurt(pieces.active, level.start);
    expect(outcome).toBe('split');
    expect(pieces.sizes).toEqual([REGULAR, REGULAR]);
  });
});

describe('Mega Slime smashing things', () => {
  it('breaks metal boxes (dropping what was inside), rocks, floorboards, leaves and clouds', () => {
    const level = parseLevel({
      id: 't',
      boxItems: ['token'],
      map: ['########', '#MX/%@.#', '#S.....#', '########'],
    });
    const stuff = {
      canyon: new CanyonStuff(level),
      haunted: new HauntedStuff(level),
      jungle: new JungleStuff(level),
      sky: new SkyStuff(level),
    };
    expect(smashBlock(level, 1, 1, stuff)).toEqual({ kind: 'box', index: 0 });
    expect(stuff.canyon.boxes[0].eaten).toBe(true);
    expect(smashBlock(level, 2, 1, stuff)).toEqual({ kind: 'crumble' });
    expect(stuff.canyon.crumbles[0].state).toBe('gone');
    expect(smashBlock(level, 3, 1, stuff)).toEqual({ kind: 'floorboard' });
    expect(stuff.haunted.boards[0].state).toBe('gone');
    expect(smashBlock(level, 4, 1, stuff)).toEqual({ kind: 'leafy' });
    expect(smashBlock(level, 5, 1, stuff)).toEqual({ kind: 'cloud' });
    expect(stuff.sky.clouds[0].state).toBe('flying');
    for (let col = 1; col <= 5; col++) {
      expect(level.tiles[1][col]).toBe(TileKind.EMPTY);
    }
    // Walls don't break.
    expect(smashBlock(level, 0, 1, stuff)).toBe(null);
    expect(level.tiles[1][0]).toBe(TileKind.WALL);
  });

  it('smashes enemies it touches for good: crabs, monkeys, viruses, plants and robots', () => {
    const level = parseLevel({
      id: 't',
      map: ['############', '#..........#', '#S.Zme.p(56#', '############'],
    });
    const stuff = {
      island: new IslandStuff(level),
      jungle: new JungleStuff(level),
      computer: new ComputerStuff(level),
      space: new SpaceStuff(level),
      robots: new RobotsStuff(level),
    };
    const everything = { left: 2 * TILE, right: 11 * TILE, top: 0, bottom: 3 * TILE };
    const hits = smashEnemies(everything, stuff);
    expect(hits).toHaveLength(7);
    expect(stuff.island.crabs[0].state).toBe('smashed');
    expect(stuff.jungle.monkeys[0].state).toBe('hiding');
    expect(stuff.computer.viruses[0].state).toBe('deleted');
    expect(stuff.space.plants[0].state).toBe('withered');
    expect(stuff.robots.arms[0].broken).toBe(true);
    expect(stuff.robots.patrols[0].broken).toBe(true);
    expect(stuff.robots.snipers[0].broken).toBe(true);
    // They stay smashed: the crab never gets up and the monkey never comes back out.
    const slime = new Slime({ x: 60, y: 60 });
    stuff.island.update(100, slime, 0);
    stuff.jungle.update(100, slime, null);
    expect(stuff.island.crabs[0].state).toBe('smashed');
    expect(stuff.jungle.monkeys[0].state).toBe('hiding');
    // Smashing again does nothing more.
    expect(smashEnemies(everything, stuff)).toEqual([]);
    // Things it isn't touching are left alone.
    const far = parseLevel({ id: 't', map: ['##########', '#S......Z#', '##########'] });
    const island = new IslandStuff(far);
    expect(smashEnemies({ left: 48, right: 100, top: 0, bottom: 96 }, { island })).toEqual([]);
  });
});
