import { TILE } from './constants.js';

// Map legend. Levels are written as arrays of strings using these characters.
//   #  wall (sticky)          I  ice wall (solid, NOT sticky)
//   L  lava (deadly)          W  water (deadly)
//   ^  spikes (just for looks, totally harmless)
//   S  start                  E  exit door
//   C  checkpoint             T  token (bonus points)
//   P  power core             R  robot boss start
//   r l u d  laser emitter firing right / left / up / down
//   .  empty

export const TileKind = {
  EMPTY: 0,
  WALL: 1,
  ICE: 2,
  LAVA: 3,
  WATER: 4,
  SPIKES: 5,
  EMITTER: 6,
};

const LASER_DIRS = {
  r: { dx: 1, dy: 0 },
  l: { dx: -1, dy: 0 },
  u: { dx: 0, dy: -1 },
  d: { dx: 0, dy: 1 },
};

export function isSolidKind(kind) {
  return kind === TileKind.WALL || kind === TileKind.ICE || kind === TileKind.EMITTER;
}

export function isStickyKind(kind) {
  return kind === TileKind.WALL || kind === TileKind.EMITTER;
}

export function isDeadlyKind(kind) {
  return kind === TileKind.LAVA || kind === TileKind.WATER;
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
  if (!level.exit && def.type !== 'boss') {
    throw new Error(`${def.id}: map has no exit (E)`);
  }
  return level;
}

/** Tile kind at a tile coordinate. Outside the map counts as wall. */
export function tileAt(level, col, row) {
  if (row < 0 || col < 0 || row >= level.height || col >= level.width) {
    // Off the bottom is open so the slime can fall out of the world.
    return row >= level.height ? TileKind.EMPTY : TileKind.WALL;
  }
  return level.tiles[row][col];
}

/** Tile kind under a pixel position. */
export function tileAtPoint(level, x, y) {
  return tileAt(level, Math.floor(x / TILE), Math.floor(y / TILE));
}
