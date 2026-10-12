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
  warehouse: {
    skyTop: 0x1f1c1a,
    skyBottom: 0x3e362e,
    grid: null,
    wall: 0x8a857c,
    wallDark: 0x58534b,
    wallLight: 0xb9b3a6,
    fluid: 0x2f8fff,
    fluidTop: 0x9fd2ff,
    text: '#ffffff',
  },
  cave: {
    skyTop: 0x0c0a14,
    skyBottom: 0x221a2e,
    grid: null,
    wall: 0x4a3d52,
    wallDark: 0x2c2333,
    wallLight: 0x6f5f7a,
    fluid: 0x2f8fff,
    fluidTop: 0x9fd2ff,
    text: '#ffffff',
  },
  canyon: {
    skyTop: 0x5fa8e0,
    skyBottom: 0xf6c98a,
    grid: null,
    wall: 0xc8643a,
    wallDark: 0x8a3f22,
    wallLight: 0xeaa070,
    fluid: 0x2f8fff,
    fluidTop: 0x9fd2ff,
    text: '#ffffff',
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
  } else if (themeName === 'warehouse') {
    // Tall shelves full of boxes in the background.
    for (let x = 60; x < level.pixelWidth; x += 360) {
      g.fillStyle(0x2c2622, 0.9);
      g.fillRect(x, 0, 12, level.pixelHeight);
      g.fillRect(x + 200, 0, 12, level.pixelHeight);
      for (let y = 140; y < level.pixelHeight; y += 150) {
        g.fillStyle(0x2c2622, 0.9);
        g.fillRect(x, y, 212, 10);
        g.fillStyle(0x6b5a44, 0.45);
        for (let b = 0; b < 4; b++) {
          const h = 40 + hash(x + b, y) * 50;
          g.fillRect(x + 18 + b * 46, y - h, 38, h);
        }
      }
    }
  } else if (themeName === 'cave') {
    // Far-away stalactites and stalagmites.
    g.fillStyle(0x3a2e44, 0.5);
    for (let x = 20; x < level.pixelWidth; x += 90) {
      const h = 40 + hash(x, 8) * 90;
      g.fillTriangle(x, 0, x + 30, 0, x + 15, h);
      const h2 = 30 + hash(x, 9) * 70;
      g.fillTriangle(
        x + 40,
        level.pixelHeight,
        x + 70,
        level.pixelHeight,
        x + 55,
        level.pixelHeight - h2
      );
    }
  } else if (themeName === 'canyon') {
    // Far-away flat-topped mesas.
    g.fillStyle(0xb85a36, 0.35);
    for (let x = -80; x < level.pixelWidth + 200; x += 300) {
      const h = 140 + hash(x, 5) * 160;
      const w = 160 + hash(x, 6) * 120;
      g.fillRect(x + 30, level.pixelHeight - h, w, h);
      g.fillTriangle(
        x,
        level.pixelHeight,
        x + 30,
        level.pixelHeight - h,
        x + 30,
        level.pixelHeight
      );
      g.fillTriangle(
        x + 30 + w,
        level.pixelHeight,
        x + 30 + w,
        level.pixelHeight - h,
        x + 60 + w,
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
      } else if (kind === TileKind.PLATFORM) {
        drawPlatform(g, x, y);
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
  } else if (themeName === 'warehouse') {
    // Concrete with yellow-and-black safety stripes on top.
    if (openUp) {
      for (let i = 0; i < 4; i++) {
        g.fillStyle(i % 2 ? 0x222222 : 0xf2c230, 1);
        g.fillRect(x + i * 12, y, 12, 7);
      }
    }
    g.fillStyle(theme.wallDark, 0.4);
    g.fillRect(x + 6 + hash(col, row) * 24, y + 20 + hash(row, col) * 16, 8, 3);
  } else if (themeName === 'cave') {
    if (openUp) {
      g.fillStyle(theme.wallLight, 1);
      g.fillRect(x, y, TILE, 5);
    }
    // Little sparkly crystal bits in the rock.
    if (hash(col, row) > 0.7) {
      g.fillStyle(0x7ff0ff, 0.8);
      g.fillCircle(x + 10 + hash(row, col) * 28, y + 12 + hash(col + 1, row) * 24, 2.5);
    }
  } else if (themeName === 'canyon') {
    if (openUp) {
      g.fillStyle(theme.wallLight, 1);
      g.fillRect(x, y, TILE, 6);
    }
    // Stripes of rock layers.
    g.fillStyle(theme.wallDark, 0.35);
    g.fillRect(x, y + 16, TILE, 4);
    g.fillStyle(0xf0b080, 0.35);
    g.fillRect(x, y + 32, TILE, 5);
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

/** A crumbling rock. `shake` jiggles it while it's about to fall apart. */
export function drawCrumble(g, x, y, shake = 0, alpha = 1) {
  const dx = shake ? (Math.random() - 0.5) * shake : 0;
  const dy = shake ? (Math.random() - 0.5) * shake : 0;
  g.fillStyle(0xd98a52, alpha);
  g.fillRect(x + dx, y + dy, TILE, TILE);
  g.fillStyle(0x9a5530, alpha);
  g.fillRect(x + dx, y + dy + TILE - 6, TILE, 6);
  // Cracks show it's not safe.
  g.lineStyle(3, 0x5a2a12, alpha);
  g.lineBetween(x + dx + 8, y + dy + 6, x + dx + 20, y + dy + 22);
  g.lineBetween(x + dx + 20, y + dy + 22, x + dx + 14, y + dy + 40);
  g.lineBetween(x + dx + 20, y + dy + 22, x + dx + 38, y + dy + 30);
}

/** A metal box (eat it with the tongue). */
export function drawBox(g, x, y, size = TILE) {
  const s = size / TILE;
  g.fillStyle(0x8c96a3, 1);
  g.fillRect(x, y, size, size);
  g.lineStyle(4 * s, 0x58616d, 1);
  g.strokeRect(x + 2 * s, y + 2 * s, size - 4 * s, size - 4 * s);
  g.lineBetween(x + 4 * s, y + 4 * s, x + size - 4 * s, y + size - 4 * s);
  g.lineBetween(x + size - 4 * s, y + 4 * s, x + 4 * s, y + size - 4 * s);
  g.fillStyle(0xd8dee6, 1);
  for (const [px, py] of [
    [7, 7],
    [41, 7],
    [7, 41],
    [41, 41],
  ]) {
    g.fillCircle(x + px * s, y + py * s, 2.5 * s);
  }
}

/** A one-way platform: a thin grate you can stretch up through. */
function drawPlatform(g, x, y) {
  g.fillStyle(0x6d747c, 1);
  g.fillRect(x, y, TILE, 9);
  g.fillStyle(0x9aa3ad, 1);
  g.fillRect(x, y, TILE, 3);
  g.fillStyle(0x3d4248, 1);
  for (let i = 6; i < TILE; i += 12) {
    g.fillRect(x + i, y + 4, 6, 3);
  }
  // Little arrows show you can come up through it.
  g.fillStyle(0xffffff, 0.35);
  g.fillTriangle(x + 24, y + 14, x + 18, y + 22, x + 30, y + 22);
}

/** A conveyor belt. `offset` scrolls the stripes to show which way it moves. */
export function drawBelt(g, x, y, dir, offset) {
  g.fillStyle(0x2e2e33, 1);
  g.fillRect(x, y, TILE, TILE);
  g.fillStyle(0x4a4a52, 1);
  g.fillRect(x, y + 4, TILE, TILE - 8);
  g.lineStyle(4, 0xf2c230, 1);
  const shift = (((offset * dir) % 16) + 16) % 16;
  for (let i = -16; i < TILE + 16; i += 16) {
    const cx = x + i + shift;
    if (cx < x + 4 || cx > x + TILE - 4) {
      continue;
    }
    g.lineBetween(cx - dir * 5, y + 14, cx + dir * 3, y + 24);
    g.lineBetween(cx + dir * 3, y + 24, cx - dir * 5, y + 34);
  }
  g.fillStyle(0x1b1b1f, 1);
  g.fillCircle(x + 6, y + TILE / 2, 4);
  g.fillCircle(x + TILE - 6, y + TILE / 2, 4);
}
