import { TILE } from './constants.js';

// Map legend. Levels are written as arrays of strings using these characters.
//   #  wall (sticky)          I  ice wall (solid, NOT sticky)
//   L  lava (deadly)          W  water (deadly)
//   ^  spikes (just for looks, totally harmless)
//   S  start                  E  exit door
//   C  checkpoint             T  token (bonus points)
//   P  power core             R  robot boss start
//   r l u d  laser emitter firing right / left / up / down
//   X  crumbling rock (sticky, falls apart 3 seconds after you stick to it)
//   M  metal box (sticky; eat it with the tongue; def.boxItems says what's inside)
//   O  crack in the ceiling that drops boulders
//   1 2 3    red / blue / yellow key
//   a b c    red / blue / yellow laser gate (turns off for good with its key)
//   > <  conveyor belt moving right / left (sticky; carries whatever is stuck to it)
//   -  one-way platform (stretch up through it from below, stick to its top)
//   U  slime cannon
//   V  stalactite (hangs from the ceiling, falls when you go under it)
//   B  bat (just flies around, harmless)
//   K  mining machine (swings a pickaxe that hurts, and smashes metal boxes)
//   =  mine cart track          H  mine cart (on its track)
//   G  glowing crystal (lights up dark levels)
//   z  sand (sticky, but waves wash over it)
//   Y  palm tree trunk (sticky)  F  palm fronds (a one-way platform)
//   Q  coconut (hangs under palm fronds, falls when you go under it)
//   ~  rope bridge (a one-way platform that sags)
//   J  hammock (bounces you up high)
//   Z  crab (walks back and forth and pinches)
//   $  treasure chest (worth 10 tokens)
//   q  quicksand (sticky, but you can't stretch far and you sink if you stay)
//   m  monkey (sits in a tree and throws bananas)
//   s  snake (hangs from the branch above and snaps down at you)
//   %  leafy trap (looks like ground, but breaks as soon as you touch it)
//   x  snake pit (deadly)
//   *  bouncy flower (bounces you up high, like a hammock)
//   _  tipping leaf (a one-way platform that tips over if you sit on it too long)
//   .  empty

export const TileKind = {
  EMPTY: 0,
  WALL: 1,
  ICE: 2,
  LAVA: 3,
  WATER: 4,
  SPIKES: 5,
  EMITTER: 6,
  CRUMBLE: 7,
  BOX: 8,
  PLATFORM: 9,
  BELT_RIGHT: 10,
  BELT_LEFT: 11,
  MACHINE: 12,
  CART: 13,
  RAIL: 14,
  SAND: 15,
  PALM: 16,
  FROND: 17,
  BRIDGE: 18,
  HAMMOCK: 19,
  QUICKSAND: 20,
  LEAFY: 21,
  SNAKE_PIT: 22,
  FLOWER: 23,
  LEAF: 24,
  LOG: 25, // a floating log's spot on the river (never in a map)
};

// Tiles that work like one-way platforms: stretch up through them from
// below, stick to their tops.
const PLATFORMS = new Set([
  TileKind.PLATFORM,
  TileKind.FROND,
  TileKind.BRIDGE,
  TileKind.HAMMOCK,
  TileKind.FLOWER,
  TileKind.LEAF,
]);

export function isPlatformKind(kind) {
  return PLATFORMS.has(kind);
}

/** Hammocks and bouncy flowers bounce you up high when you land on them. */
export function isBouncyKind(kind) {
  return kind === TileKind.HAMMOCK || kind === TileKind.FLOWER;
}

export const KEY_COLORS = ['red', 'blue', 'yellow'];
const KEY_CHARS = { 1: 'red', 2: 'blue', 3: 'yellow' };
const GATE_CHARS = { a: 'red', b: 'blue', c: 'yellow' };

const LASER_DIRS = {
  r: { dx: 1, dy: 0 },
  l: { dx: -1, dy: 0 },
  u: { dx: 0, dy: -1 },
  d: { dx: 0, dy: 1 },
};

// One-way platforms are not in either list: they are handled specially, since
// they're only "there" from above (see platformTopBelow in collision.js).
const SOLID = new Set([
  TileKind.WALL,
  TileKind.ICE,
  TileKind.EMITTER,
  TileKind.CRUMBLE,
  TileKind.BOX,
  TileKind.BELT_RIGHT,
  TileKind.BELT_LEFT,
  TileKind.MACHINE,
  TileKind.CART,
  TileKind.SAND,
  TileKind.PALM,
  TileKind.QUICKSAND,
  TileKind.LEAFY,
  TileKind.LOG,
]);
const STICKY = new Set([
  TileKind.WALL,
  TileKind.EMITTER,
  TileKind.CRUMBLE,
  TileKind.BOX,
  TileKind.BELT_RIGHT,
  TileKind.BELT_LEFT,
  TileKind.MACHINE,
  TileKind.CART,
  TileKind.SAND,
  TileKind.PALM,
  TileKind.QUICKSAND,
  TileKind.LEAFY,
  TileKind.LOG,
]);

export function isSolidKind(kind) {
  return SOLID.has(kind);
}

export function isStickyKind(kind) {
  return STICKY.has(kind);
}

export function isDeadlyKind(kind) {
  return kind === TileKind.LAVA || kind === TileKind.WATER || kind === TileKind.SNAKE_PIT;
}

function tileCenter(col, row) {
  return { x: (col + 0.5) * TILE, y: (row + 0.5) * TILE };
}

/**
 * Turn a level definition (with an ASCII `map`) into a grid plus lists of
 * objects. Throws if the map is malformed so mistakes show up in tests.
 */
export function parseLevel(def) {
  const rows = def.map;
  const height = rows.length;
  const width = rows[0].length;
  const tiles = [];
  const level = {
    def,
    width,
    height,
    pixelWidth: width * TILE,
    pixelHeight: height * TILE,
    tiles,
    start: null,
    exit: null,
    checkpoints: [],
    tokens: [],
    cores: [],
    lasers: [],
    robot: null,
    crumbles: [],
    boxes: [],
    keys: [],
    gates: [],
    boulderSpawners: [],
    cannons: [],
    stalactites: [],
    bats: [],
    machines: [],
    carts: [],
    crystals: [],
    coconuts: [],
    crabs: [],
    chests: [],
    monkeys: [],
    snakes: [],
    leafyTraps: [],
  };

  rows.forEach((line, row) => {
    if (line.length !== width) {
      throw new Error(`${def.id}: row ${row} has length ${line.length}, expected ${width}`);
    }
    const tileRow = [];
    for (let col = 0; col < width; col++) {
      const ch = line[col];
      let kind = TileKind.EMPTY;
      const center = tileCenter(col, row);
      switch (ch) {
        case '#':
          kind = TileKind.WALL;
          break;
        case 'I':
          kind = TileKind.ICE;
          break;
        case 'L':
          kind = TileKind.LAVA;
          break;
        case 'W':
          kind = TileKind.WATER;
          break;
        case '^':
          kind = TileKind.SPIKES;
          break;
        case 'S':
          level.start = center;
          break;
        case 'E':
          level.exit = { ...center, col, row };
          break;
        case 'C':
          level.checkpoints.push({ ...center, col, row });
          break;
        case 'T':
          level.tokens.push(center);
          break;
        case 'P':
          level.cores.push(center);
          break;
        case 'R':
          level.robot = center;
          break;
        case 'r':
        case 'l':
        case 'u':
        case 'd':
          kind = TileKind.EMITTER;
          level.lasers.push({ col, row, ...LASER_DIRS[ch] });
          break;
        case 'X':
          kind = TileKind.CRUMBLE;
          level.crumbles.push({ col, row });
          break;
        case 'M':
          kind = TileKind.BOX;
          level.boxes.push({ ...center, col, row });
          break;
        case 'O':
          kind = TileKind.WALL;
          level.boulderSpawners.push({ col, row });
          break;
        case '1':
        case '2':
        case '3':
          level.keys.push({ ...center, color: KEY_CHARS[ch] });
          break;
        case 'a':
        case 'b':
        case 'c':
          level.gates.push({ col, row, color: GATE_CHARS[ch] });
          break;
        case '>':
          kind = TileKind.BELT_RIGHT;
          break;
        case '<':
          kind = TileKind.BELT_LEFT;
          break;
        case '-':
          kind = TileKind.PLATFORM;
          break;
        case 'U':
          level.cannons.push({ ...center, col, row });
          break;
        case 'V':
          level.stalactites.push({ ...center, col, row });
          break;
        case 'B':
          level.bats.push(center);
          break;
        case 'K':
          kind = TileKind.MACHINE;
          level.machines.push({ ...center, col, row });
          break;
        case '=':
          kind = TileKind.RAIL;
          break;
        case 'H':
          kind = TileKind.CART;
          level.carts.push({ col, row });
          break;
        case 'G':
          level.crystals.push(center);
          break;
        case 'z':
          kind = TileKind.SAND;
          break;
        case 'Y':
          kind = TileKind.PALM;
          break;
        case 'F':
          kind = TileKind.FROND;
          break;
        case '~':
          kind = TileKind.BRIDGE;
          break;
        case 'J':
          kind = TileKind.HAMMOCK;
          break;
        case 'Q':
          level.coconuts.push({ ...center, col, row });
          break;
        case 'Z':
          level.crabs.push({ ...center, col, row });
          break;
        case '$':
          level.chests.push(center);
          break;
        case 'q':
          kind = TileKind.QUICKSAND;
          break;
        case 'm':
          level.monkeys.push({ ...center, col, row });
          break;
        case 's':
          level.snakes.push({ ...center, col, row });
          break;
        case '%':
          kind = TileKind.LEAFY;
          level.leafyTraps.push({ col, row });
          break;
        case 'x':
          kind = TileKind.SNAKE_PIT;
          break;
        case '*':
          kind = TileKind.FLOWER;
          break;
        case '_':
          kind = TileKind.LEAF;
          break;
        case '.':
          break;
        default:
          throw new Error(`${def.id}: unknown map character '${ch}' at ${col},${row}`);
      }
      tileRow.push(kind);
    }
    tiles.push(tileRow);
  });

  if (!level.start) {
    throw new Error(`${def.id}: map has no start (S)`);
  }
  placeBoxItems(level);
  findCartTracks(level);
  if (!level.exit && def.type !== 'boss') {
    throw new Error(`${def.id}: map has no exit (E)`);
  }
  return level;
}

/**
 * Put things inside metal boxes. `def.boxItems[i]` is what's in the i-th box
 * (in reading order): 'token', 'core', 'key-red', 'key-blue', 'key-yellow',
 * 'bomb' (blows up on your tongue) or null. Items in boxes join the normal lists with `inBox` set, so totals count
 * them, but they can only be collected by eating the box.
 */
function placeBoxItems(level) {
  const items = level.def.boxItems || [];
  if (items.length > level.boxes.length) {
    throw new Error(`${level.def.id}: boxItems lists more items than there are boxes`);
  }
  items.forEach((item, i) => {
    const box = level.boxes[i];
    box.item = item || null;
    if (!item || item === 'bomb') {
      return;
    }
    const spot = { x: box.x, y: box.y, inBox: i };
    if (item === 'token') {
      level.tokens.push(spot);
    } else if (item === 'core') {
      level.cores.push(spot);
    } else if (item.startsWith('key-') && KEY_COLORS.includes(item.slice(4))) {
      level.keys.push({ ...spot, color: item.slice(4) });
    } else {
      throw new Error(`${level.def.id}: unknown box item '${item}'`);
    }
  });
}

/** Each mine cart can roll along the run of track (=) it sits on. */
function findCartTracks(level) {
  const onTrack = (col, row) => {
    const ch = level.def.map[row][col];
    return ch === '=' || ch === 'H';
  };
  for (const cart of level.carts) {
    let min = cart.col;
    let max = cart.col;
    while (min > 0 && onTrack(min - 1, cart.row)) {
      min--;
    }
    while (max < level.width - 1 && onTrack(max + 1, cart.row)) {
      max++;
    }
    cart.minCol = min;
    cart.maxCol = max;
  }
}

/**
 * Tile kind at a tile coordinate. The sides and top of the map are a
 * slippery wall you can't stick to (outdoor levels have open sky).
 */
export function tileAt(level, col, row) {
  if (row < 0 || col < 0 || row >= level.height || col >= level.width) {
    // Off the bottom is open so the slime can fall out of the world.
    return row >= level.height ? TileKind.EMPTY : TileKind.ICE;
  }
  return level.tiles[row][col];
}

/** Tile kind under a pixel position. */
export function tileAtPoint(level, x, y) {
  return tileAt(level, Math.floor(x / TILE), Math.floor(y / TILE));
}
