import { GAME_HEIGHT, GAME_WIDTH, TILE } from '../logic/constants.js';
import { TileKind, tileAt } from '../logic/level.js';

export const THEMES = {
  lab: {
    skyTop: 0x141a33,
    skyBottom: 0x26305a,
    grid: 0x34406e,
    wall: 0x8796b0,
    wallDark: 0x56637d,
    wallLight: 0xc3cfe3,
    fluid: 0x2f8fff,
    fluidTop: 0x9fd2ff,
    text: '#ffffff',
  },
  tundra: {
    skyTop: 0x9fd4f2,
    skyBottom: 0xe6f6ff,
    grid: null,
    wall: 0x7d8da3,
    wallDark: 0x5b6a80,
    wallLight: 0xffffff,
    fluid: 0x2a8fd0,
    fluidTop: 0xc8f0ff,
    text: '#16324f',
  },
  volcano: {
    skyTop: 0x1a0505,
    skyBottom: 0x5a1608,
    grid: null,
    wall: 0x3d2b2b,
    wallDark: 0x231616,
    wallLight: 0x6b4a40,
    fluid: 0xff5a00,
    fluidTop: 0xffd040,
    text: '#ffe6cc',
  },
};

// A tiny repeatable random number so wall cracks don't flicker between draws.
function hash(col, row) {
  const n = Math.sin(col * 127.1 + row * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/** Fixed background that fills the screen behind the level. */
export function drawBackground(scene, theme) {
  const g = scene.add.graphics().setScrollFactor(0).setDepth(-10);
  g.fillGradientStyle(theme.skyTop, theme.skyTop, theme.skyBottom, theme.skyBottom, 1);
  g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  return g;
}

/** Background details that scroll with the level (lab grid, distant shapes). */
export function drawBackdrop(scene, level, theme, themeName) {
  const g = scene.add.graphics().setDepth(-5);
  if (themeName === 'lab') {
    g.lineStyle(1, theme.grid, 0.6);
    for (let x = 0; x <= level.pixelWidth; x += TILE) {
      g.lineBetween(x, 0, x, level.pixelHeight);
    }
    for (let y = 0; y <= level.pixelHeight; y += TILE) {
      g.lineBetween(0, y, level.pixelWidth, y);
    }
  } else if (themeName === 'tundra') {
    // Far-away snowy mountains.
    g.fillStyle(0xffffff, 0.5);
    for (let x = -100; x < level.pixelWidth + 200; x += 260) {
      const h = 120 + hash(x, 3) * 140;
      g.fillTriangle(
        x,
        level.pixelHeight,
        x + 160,
        level.pixelHeight - h,
        x + 320,
        level.pixelHeight
      );
    }
  } else {
    // Glowing cracks in the volcano's far wall.
    g.lineStyle(3, 0xff4400, 0.18);
    for (let i = 0; i < level.width * level.height * 0.05; i++) {
      const x = hash(i, 1) * level.pixelWidth;
      const y = hash(i, 2) * level.pixelHeight;
      g.lineBetween(x, y, x + 30 - hash(i, 3) * 60, y + 40);
    }
  }
  return g;
}

function isOpen(level, col, row) {
  const k = tileAt(level, col, row);
  return k !== TileKind.WALL && k !== TileKind.ICE && k !== TileKind.EMITTER;
}

/** Walls, ice, spikes and laser emitters. Drawn once. */
export function drawTiles(scene, level, theme, themeName) {
  const g = scene.add.graphics().setDepth(0);
  for (let row = 0; row < level.height; row++) {
    for (let col = 0; col < level.width; col++) {
      const kind = level.tiles[row][col];
      const x = col * TILE;
      const y = row * TILE;
      if (kind === TileKind.WALL) {
        drawWall(g, level, theme, themeName, col, row, x, y);
      } else if (kind === TileKind.ICE) {
        drawIce(g, x, y);
      } else if (kind === TileKind.SPIKES) {
        drawSpikes(g, level, col, row, x, y);
      } else if (kind === TileKind.EMITTER) {
        g.fillStyle(0x333344, 1);
        g.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
        g.lineStyle(3, 0x777799, 1);
        g.strokeRect(x + 4, y + 4, TILE - 8, TILE - 8);
      }
    }
  }
  return g;
}

function drawWall(g, level, theme, themeName, col, row, x, y) {
  g.fillStyle(theme.wall, 1);
  g.fillRect(x, y, TILE, TILE);
  const openUp = isOpen(level, col, row - 1);
  const openDown = isOpen(level, col, row + 1);
  const openLeft = isOpen(level, col - 1, row);
  const openRight = isOpen(level, col + 1, row);
  // Light edge on top/left, dark edge on bottom/right, for a chunky 3D look.
  if (openDown) {
    g.fillStyle(theme.wallDark, 1);
    g.fillRect(x, y + TILE - 6, TILE, 6);
  }
  if (openRight) {
    g.fillStyle(theme.wallDark, 1);
    g.fillRect(x + TILE - 5, y, 5, TILE);
  }
  if (openLeft) {
    g.fillStyle(theme.wallLight, 0.6);
    g.fillRect(x, y, 4, TILE);
  }
  if (themeName === 'lab') {
    if (openUp) {
      g.fillStyle(theme.wallLight, 1);
      g.fillRect(x, y, TILE, 5);
    }
    g.fillStyle(theme.wallDark, 1);
    g.fillCircle(x + 9, y + 11, 2.5);
    g.fillCircle(x + TILE - 9, y + 11, 2.5);
    g.fillCircle(x + 9, y + TILE - 11, 2.5);
    g.fillCircle(x + TILE - 9, y + TILE - 11, 2.5);
  } else if (themeName === 'tundra') {
    if (openUp) {
      // Snow on top.
      g.fillStyle(0xffffff, 1);
      g.fillRect(x, y, TILE, 10);
      g.fillCircle(x + 12, y + 10, 6);
      g.fillCircle(x + 34, y + 9, 5);
    }
    g.fillStyle(theme.wallDark, 0.5);
    g.fillCircle(x + 14 + hash(col, row) * 20, y + 26 + hash(row, col) * 12, 5);
  } else {
    if (openUp) {
      g.fillStyle(theme.wallLight, 1);
      g.fillRect(x, y, TILE, 5);
    }
    // Glowing cracks.
    g.lineStyle(2, 0xff6a1a, 0.8);
    const cx = x + 10 + hash(col, row) * 28;
    const cy = y + 10 + hash(row, col) * 28;
    g.lineBetween(cx, cy, cx + 8, cy + 6);
    g.lineBetween(cx + 8, cy + 6, cx + 4, cy + 14);
  }
}

function drawIce(g, x, y) {
  g.fillStyle(0x9feaff, 1);
  g.fillRect(x, y, TILE, TILE);
  g.fillStyle(0xd8f8ff, 1);
  g.fillTriangle(x + 6, y + 6, x + 22, y + 6, x + 6, y + 22);
  g.lineStyle(3, 0xffffff, 0.8);
  g.lineBetween(x + 30, y + 10, x + 14, y + 38);
  g.lineBetween(x + 38, y + 18, x + 26, y + 38);
  g.lineStyle(2, 0x4fc3e8, 1);
  g.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
}

function drawSpikes(g, level, col, row, x, y) {
  // Point away from whatever they're attached to.
  const onCeiling = !isOpen(level, col, row - 1) && isOpen(level, col, row + 1);
  g.fillStyle(0xb0b8c8, 1);
  g.lineStyle(2, 0x606878, 1);
  for (let i = 0; i < 3; i++) {
    const sx = x + i * 16;
    const pts = onCeiling
      ? [sx, y, sx + 16, y, sx + 8, y + 26]
      : [sx, y + TILE, sx + 16, y + TILE, sx + 8, y + TILE - 26];
    g.fillTriangle(...pts);
    g.strokeTriangle(...pts);
  }
}

/** Lava and water. Redrawn every frame so the surface wobbles. */
export function drawFluids(g, level, time) {
  for (let row = 0; row < level.height; row++) {
    for (let col = 0; col < level.width; col++) {
      const kind = level.tiles[row][col];
      if (kind !== TileKind.LAVA && kind !== TileKind.WATER) {
        continue;
      }
      const x = col * TILE;
      const y = row * TILE;
      const color = kind === TileKind.LAVA ? 0xff5a00 : 0x2f8fff;
      const top = kind === TileKind.LAVA ? 0xffd040 : 0x9fd2ff;
      const surface = tileAt(level, col, row - 1) !== kind;
      const wave = surface ? 8 + Math.sin(time * 3 + col) * 3 : 0;
      g.fillStyle(color, kind === TileKind.LAVA ? 1 : 0.85);
      g.fillRect(x, y + wave, TILE, TILE - wave);
      if (surface) {
        g.fillStyle(top, 1);
        g.fillRect(x, y + wave, TILE, 4);
      }
    }
  }
}
