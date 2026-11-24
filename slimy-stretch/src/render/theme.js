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
  island: {
    skyTop: 0x2f9be8,
    skyBottom: 0xc4ecff,
    grid: null,
    wall: 0x6b5a4e,
    wallDark: 0x463a32,
    wallLight: 0x8f7d6e,
    fluid: 0x2f8fff,
    fluidTop: 0x9fd2ff,
    text: '#ffffff',
  },
  jungle: {
    skyTop: 0x4f9e5c,
    skyBottom: 0xcdeaa8,
    grid: null,
    wall: 0x6b6446,
    wallDark: 0x433e2a,
    wallLight: 0x8f8760,
    fluid: 0x2f8fff,
    fluidTop: 0x9fd2ff,
    text: '#ffffff',
  },
  factory: {
    skyTop: 0x1b1a20,
    skyBottom: 0x4a2e1e,
    grid: null,
    wall: 0x5d6470,
    wallDark: 0x363b44,
    wallLight: 0x8a93a1,
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
  } else if (themeName === 'island') {
    // A big sun, and little islands far out on the ocean.
    g.fillStyle(0xfff3a0, 0.9);
    g.fillCircle(level.pixelWidth * 0.75, 110, 60);
    g.fillStyle(0xffffff, 0.25);
    g.fillCircle(level.pixelWidth * 0.75, 110, 80);
    const sea = level.pixelHeight - 3 * TILE;
    g.fillStyle(0x2a7fc8, 0.45);
    g.fillRect(0, sea, level.pixelWidth, level.pixelHeight - sea);
    for (let x = 80; x < level.pixelWidth; x += 520) {
      const w = 140 + hash(x, 4) * 120;
      g.fillStyle(0x3d7a4a, 0.5);
      g.fillEllipse(x + w / 2, sea, w, 50);
      g.fillStyle(0x6a4a30, 0.5);
      g.fillRect(x + w / 2 - 3, sea - 70, 6, 50);
      g.fillStyle(0x3d7a4a, 0.5);
      g.fillEllipse(x + w / 2 - 18, sea - 72, 40, 12);
      g.fillEllipse(x + w / 2 + 18, sea - 72, 40, 12);
    }
    // Fluffy clouds.
    g.fillStyle(0xffffff, 0.7);
    for (let x = 120; x < level.pixelWidth; x += 430) {
      const y = 70 + hash(x, 7) * 120;
      g.fillCircle(x, y, 24);
      g.fillCircle(x + 26, y - 10, 30);
      g.fillCircle(x + 56, y, 22);
    }
  } else if (themeName === 'jungle') {
    drawJungleBackdrop(g, level);
  } else if (themeName === 'factory') {
    // Big pipes and turning gears on the far wall, lit by orange furnace glow.
    for (let y = 120; y < level.pixelHeight; y += 260) {
      g.fillStyle(0x2c2a30, 0.9);
      g.fillRect(0, y, level.pixelWidth, 22);
      g.fillStyle(0x45424c, 0.9);
      g.fillRect(0, y + 3, level.pixelWidth, 5);
    }
    for (let x = 90; x < level.pixelWidth; x += 380) {
      const y = 80 + hash(x, 2) * (level.pixelHeight - 160);
      const r = 40 + hash(x, 3) * 40;
      g.fillStyle(0x2c2a30, 0.8);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.fillCircle(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.25);
      }
      g.fillCircle(x, y, r);
      g.fillStyle(0x4a2e1e, 0.9);
      g.fillCircle(x, y, r * 0.35);
      g.fillStyle(0x2c2a30, 0.8);
      g.fillRect(x + 160, 0, 26, level.pixelHeight);
    }
    g.fillStyle(0xff7a20, 0.12);
    g.fillRect(0, level.pixelHeight - 160, level.pixelWidth, 160);
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

/** Far-away jungle: misty rows of giant trees, with vines hanging down. */
function drawJungleBackdrop(g, level) {
  const w = level.pixelWidth;
  const h = level.pixelHeight;
  // Two layers of tree crowns: pale ones far away, darker ones closer.
  const layers = [
    { color: 0x8cc48a, alpha: 0.55, top: 0.25, step: 150, size: 90 },
    { color: 0x4f9a55, alpha: 0.5, top: 0.45, step: 190, size: 110 },
  ];
  for (const layer of layers) {
    const y0 = h * layer.top;
    for (let x = -60; x < w + 200; x += layer.step) {
      const r = layer.size * (0.7 + hash(x, layer.step) * 0.5);
      const y = y0 + hash(x, 3) * 60;
      g.fillStyle(layer.color, layer.alpha * 0.8);
      g.fillRect(x - 8, y, 16, h - y);
      g.fillStyle(layer.color, layer.alpha);
      g.fillCircle(x, y, r);
      g.fillCircle(x - r * 0.7, y + r * 0.3, r * 0.7);
      g.fillCircle(x + r * 0.7, y + r * 0.25, r * 0.75);
    }
    g.fillStyle(layer.color, layer.alpha);
    g.fillRect(0, y0 + 60, w, h - y0 - 60);
  }
  // Vines hanging from the treetops above.
  for (let x = 30; x < w; x += 110) {
    const len = 80 + hash(x, 11) * 200;
    g.lineStyle(3, 0x3d7a3a, 0.45);
    g.lineBetween(x, 0, x + 6, len);
    g.fillStyle(0x3d7a3a, 0.45);
    for (let y = 30; y < len; y += 40) {
      g.fillEllipse(x + 3 + (y / len) * 6 + 7, y, 12, 6);
    }
  }
  // Sunbeams through the leaves.
  g.fillStyle(0xfffbd0, 0.12);
  for (let x = 200; x < w; x += 640) {
    g.fillTriangle(x, 0, x + 70, 0, x + 260, h);
  }
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
      } else if (kind === TileKind.SAND) {
        drawSand(g, level, col, row, x, y);
      } else if (kind === TileKind.PALM) {
        drawTrunk(g, x, y, col);
      } else if (kind === TileKind.FROND) {
        drawFronds(g, level, col, row, x, y);
      } else if (kind === TileKind.QUICKSAND) {
        drawQuicksand(g, level, col, row, x, y);
      } else if (kind === TileKind.SNAKE_PIT) {
        drawSnakePit(g, level, col, row, x, y);
      } else if (kind === TileKind.VENT) {
        drawVent(g, x, y);
      } else if (kind === TileKind.SLIME_MACHINE) {
        drawSlimeMachine(g, level, col, row, x, y);
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
  } else if (themeName === 'island') {
    // Dark volcanic rock with grass on top.
    g.fillStyle(theme.wallDark, 0.5);
    g.fillCircle(x + 12 + hash(col, row) * 24, y + 18 + hash(row, col) * 18, 4);
    if (openUp) {
      g.fillStyle(0x3fae4a, 1);
      g.fillRect(x, y, TILE, 8);
      g.fillStyle(0x63d36a, 1);
      for (let i = 4; i < TILE; i += 10) {
        g.fillTriangle(x + i - 3, y + 2, x + i + 3, y + 2, x + i, y - 5);
      }
    }
  } else if (themeName === 'factory') {
    // Riveted steel plates with orange-and-black stripes on top.
    g.fillStyle(theme.wallDark, 1);
    g.fillCircle(x + 7, y + 7, 2.5);
    g.fillCircle(x + TILE - 7, y + 7, 2.5);
    g.fillCircle(x + 7, y + TILE - 7, 2.5);
    g.fillCircle(x + TILE - 7, y + TILE - 7, 2.5);
    if (openUp) {
      for (let i = 0; i < 4; i++) {
        g.fillStyle(i % 2 ? 0x1e1e22 : 0xff8a1a, 1);
        g.fillTriangle(x + i * 12, y + 7, x + i * 12 + 7, y, x + i * 12 + 12, y + 7);
      }
      g.fillStyle(0xff8a1a, 1);
      g.fillRect(x, y + 6, TILE, 2);
    }
  } else if (themeName === 'jungle') {
    // Old mossy stone, with moss dripping over the top.
    g.fillStyle(theme.wallDark, 0.45);
    g.fillRoundedRect(x + 4 + hash(col, row) * 18, y + 14 + hash(row, col) * 16, 18, 10, 4);
    if (hash(col + 7, row) > 0.75) {
      g.fillStyle(0x4f8a3a, 0.7);
      g.fillCircle(x + 12 + hash(row, col + 2) * 24, y + 10 + hash(col, row + 2) * 28, 4);
    }
    if (openUp) {
      g.fillStyle(0x3f8f3a, 1);
      g.fillRect(x, y, TILE, 9);
      g.fillStyle(0x5cb84e, 1);
      g.fillRect(x, y, TILE, 4);
      g.fillStyle(0x3f8f3a, 1);
      for (let i = 0; i < 3; i++) {
        const dx = x + 6 + i * 16 + hash(col + i, row) * 6;
        g.fillRoundedRect(dx, y + 6, 6, 6 + hash(row + i, col) * 10, 3);
      }
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

function drawSand(g, level, col, row, x, y) {
  g.fillStyle(0xf0cf86, 1);
  g.fillRect(x, y, TILE, TILE);
  if (tileAt(level, col, row - 1) !== TileKind.SAND) {
    g.fillStyle(0xfbe6b0, 1);
    g.fillRect(x, y, TILE, 6);
  }
  g.fillStyle(0xc9a35e, 0.8);
  for (let i = 0; i < 4; i++) {
    g.fillCircle(x + 6 + hash(col + i, row) * 36, y + 10 + hash(row + i, col) * 32, 1.5);
  }
  // A little shell now and then.
  if (hash(col, row + 3) > 0.85) {
    g.fillStyle(0xffb0c8, 1);
    g.fillCircle(x + 24, y + 26, 4);
  }
}

/** A palm tree's trunk (sticky, like a wall). */
function drawTrunk(g, x, y, col) {
  const bend = (hash(col, 0) - 0.5) * 6;
  g.fillStyle(0x8a5a2e, 1);
  g.fillRect(x + 6 + bend, y, TILE - 12, TILE);
  g.fillStyle(0x6b4220, 1);
  for (let i = 0; i < TILE; i += 12) {
    g.fillTriangle(x + 6 + bend, y + i, x + TILE - 6 + bend, y + i, x + TILE / 2 + bend, y + i + 8);
  }
  g.fillStyle(0xb07a44, 0.6);
  g.fillRect(x + 10 + bend, y, 5, TILE);
}

/** Palm fronds: big leaves you can stand on (a one-way platform). */
function drawFronds(g, level, col, row, x, y) {
  if (tileAt(level, col, row + 1) === TileKind.PALM) {
    // The top of the trunk, up under the leaves.
    drawTrunk(g, x, y, col);
  }
  g.fillStyle(0x2f9a3a, 1);
  g.fillRect(x, y, TILE, 10);
  g.fillStyle(0x45c24f, 1);
  g.fillRect(x, y, TILE, 4);
  // Leafy tips hanging down.
  g.fillStyle(0x2f9a3a, 1);
  for (let i = 0; i < 3; i++) {
    const lx = x + 4 + i * 16;
    g.fillTriangle(lx, y + 8, lx + 14, y + 8, lx + 4 + hash(col + i, row) * 6, y + 22);
  }
  if (!isPlatformLike(level, col - 1, row)) {
    g.fillTriangle(x, y, x, y + 10, x - 16, y + 18);
  }
  if (!isPlatformLike(level, col + 1, row)) {
    g.fillTriangle(x + TILE, y, x + TILE, y + 10, x + TILE + 16, y + 18);
  }
}

/** Quicksand: soft sand with swirls in it (bubbles are drawn as you sink). */
function drawQuicksand(g, level, col, row, x, y) {
  g.fillStyle(0xc49a52, 1);
  g.fillRect(x, y, TILE, TILE);
  if (tileAt(level, col, row - 1) !== TileKind.QUICKSAND) {
    g.fillStyle(0xdcb46a, 1);
    g.fillRect(x, y, TILE, 5);
  }
  g.lineStyle(2, 0x9a7638, 0.8);
  const cx = x + 14 + hash(col, row) * 20;
  const cy = y + 16 + hash(row, col) * 16;
  g.strokeEllipse(cx, cy, 18, 8);
  g.strokeEllipse(cx, cy, 8, 4);
}

/** The bottom of a snake pit: dark, with snakes curled up all over it. */
function drawSnakePit(g, level, col, row, x, y) {
  g.fillStyle(0x2a2418, 1);
  g.fillRect(x, y, TILE, TILE);
  for (let i = 0; i < 2; i++) {
    const sx = x + 10 + i * 24 + hash(col + i, row) * 6;
    const sy = y + 14 + hash(row, col + i) * 20;
    g.fillStyle(i ? 0x7ab83a : 0xc8a020, 1);
    g.fillEllipse(sx, sy, 22, 9);
    g.fillEllipse(sx + 6, sy + 7, 18, 8);
    g.fillStyle(0x1a1a10, 1);
    g.fillCircle(sx - 7, sy - 1, 1.5);
  }
}

/** A bunch of green leaves on the ground. It looks like solid ground... */
export function drawLeafyTrap(g, x, y, alpha = 1) {
  g.fillStyle(0x2f6f2a, alpha);
  g.fillRect(x, y + 6, TILE, TILE - 6);
  // Lots of overlapping leaves, lighter on top.
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 4; i++) {
      const light = row === 0 ? 0x5cb84e : row === 1 ? 0x4aa043 : 0x3a8a36;
      g.fillStyle(i % 2 ? light : 0x46a040, alpha);
      g.fillEllipse(x + 6 + i * 12 + (row % 2) * 6, y + 6 + row * 15 + (i % 2) * 3, 20, 13);
    }
  }
  g.lineStyle(1.5, 0x2a6a26, alpha);
  g.lineBetween(x + 8, y + 6, x + 18, y + 8);
  g.lineBetween(x + 30, y + 21, x + 40, y + 23);
}

/**
 * A big tipping leaf, `width` pixels wide. `tilt` goes from 0 (flat) to 1
 * (tipped over, hanging straight down from its stem on the left).
 */
export function drawTippingLeaf(g, x, y, width, tilt, alpha = 1) {
  const angle = tilt * (Math.PI / 2);
  const along = (d, up) => ({
    x: x + Math.cos(angle) * d - Math.sin(angle) * up,
    y: y + Math.sin(angle) * d + Math.cos(angle) * up,
  });
  // The leaf's outline: flat on top, rounded underneath, pointy at the tip.
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const d = (width * i) / 12;
    pts.push(along(d, -2 + Math.sin((Math.PI * i) / 12) * 2));
  }
  for (let i = 12; i >= 0; i--) {
    const d = (width * i) / 12;
    pts.push(along(d, 4 + Math.sin((Math.PI * i) / 12) * 16));
  }
  g.fillStyle(0x2f8a3a, alpha);
  g.fillPoints(pts, true);
  g.fillStyle(0x4fc25a, alpha);
  g.fillPoints(pts.slice(0, 13).concat(pts.slice(13).map(p => ({ x: p.x, y: p.y - 6 }))), true);
  // Veins
  g.lineStyle(2, 0x2a7a32, alpha);
  const a = along(0, 4);
  const b = along(width - 6, 4);
  g.lineBetween(a.x, a.y, b.x, b.y);
  for (let d = 14; d < width - 10; d += 18) {
    const p = along(d, 4);
    const q = along(d + 10, 12);
    g.lineBetween(p.x, p.y, q.x, q.y);
  }
  // The stem it pivots on.
  g.fillStyle(0x6a4a24, alpha);
  g.fillCircle(x, y + 4, 6);
}

/** A big bouncy jungle flower. `squash` pushes the petals down when you land. */
export function drawFlower(g, x, y, squash) {
  const cx = x + TILE / 2;
  const top = y + 6 + squash;
  g.fillStyle(0x3f8f3a, 1);
  g.fillRect(cx - 3, top, 6, TILE - 6 - squash);
  g.fillEllipse(cx - 12, y + TILE - 10, 20, 8);
  g.fillEllipse(cx + 12, y + TILE - 12, 20, 8);
  // Petals, flattening out when squashed.
  const spread = 26 + squash;
  g.fillStyle(0xff4f8a, 1);
  g.fillEllipse(cx - spread * 0.55, top, spread * 0.8, 16 - squash * 0.6);
  g.fillEllipse(cx + spread * 0.55, top, spread * 0.8, 16 - squash * 0.6);
  g.fillStyle(0xff7aa8, 1);
  g.fillEllipse(cx, top - 4 + squash * 0.3, 22, 14 - squash * 0.5);
  g.fillStyle(0xffd23a, 1);
  g.fillEllipse(cx, top + 1, 20, 8);
  g.fillStyle(0xffffff, 0.8);
  g.fillCircle(cx - 4, top - 1, 2);
}

function isPlatformLike(level, col, row) {
  const k = tileAt(level, col, row);
  return k === TileKind.FROND || k === TileKind.PALM;
}

/**
 * A rope bridge tile. `sag` is how far down the middle of this tile dips
 * (it dips where the slime is standing).
 */
export function drawBridge(g, x, y, sagLeft, sagRight) {
  g.lineStyle(3, 0xc8a46a, 1);
  g.lineBetween(x, y - 14 + sagLeft * 0.5, x + TILE, y - 14 + sagRight * 0.5);
  for (let i = 0; i < 3; i++) {
    const t = (i + 0.5) / 3;
    const sag = sagLeft + (sagRight - sagLeft) * t;
    const px = x + i * 16 + 1;
    g.fillStyle(0x9a6a3a, 1);
    g.fillRect(px, y + sag, 14, 7);
    g.fillStyle(0x6b4422, 1);
    g.fillRect(px, y + sag + 5, 14, 2);
    g.lineStyle(2, 0xc8a46a, 1);
    g.lineBetween(px + 7, y + sag, px + 7, y - 14 + sag * 0.5);
  }
}

/** A hammock between two little posts. `dip` makes it stretch when you land. */
export function drawHammock(g, x, y, dip) {
  g.fillStyle(0x7a4a24, 1);
  g.fillRect(x - 2, y - 18, 6, TILE + 18);
  g.fillRect(x + TILE - 4, y - 18, 6, TILE + 18);
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    pts.push({ x: x + 2 + t * (TILE - 4), y: y - 12 + Math.sin(t * Math.PI) * (10 + dip) });
  }
  g.lineStyle(6, 0xe8574a, 1);
  for (let i = 0; i < pts.length - 1; i++) {
    g.lineBetween(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
  }
  g.lineStyle(2, 0xffe08a, 1);
  for (let i = 0; i < pts.length - 1; i++) {
    g.lineBetween(pts[i].x, pts[i].y + 2, pts[i + 1].x, pts[i + 1].y + 2);
  }
}

/** A steam vent: a grate in the floor (sticky, like a wall). */
function drawVent(g, x, y) {
  g.fillStyle(0x4a4f58, 1);
  g.fillRect(x, y, TILE, TILE);
  g.fillStyle(0x2a2d33, 1);
  g.fillRect(x + 4, y, TILE - 8, 14);
  g.fillStyle(0x8a93a1, 1);
  for (let i = 8; i < TILE - 6; i += 8) {
    g.fillRect(x + i, y + 2, 3, 10);
  }
  g.lineStyle(2, 0xd0d6de, 0.6);
  g.strokeRect(x + 4, y, TILE - 8, 14);
}

/**
 * A slime machine. It's slippery (you can't stick to it). The side with the
 * funnel takes slime shots; the open hatch on the other side lets you climb in.
 */
function drawSlimeMachine(g, level, col, row, x, y) {
  const shot = (level.def.slimeMachines || []).find(m => m.at[0] === col && m.at[1] === row);
  const dir = shot && shot.shot === 'left' ? -1 : 1;
  g.fillStyle(0xbfd4e6, 1);
  g.fillRoundedRect(x + 2, y + 2, TILE - 4, TILE - 4, 8);
  g.lineStyle(3, 0x6e8aa3, 1);
  g.strokeRoundedRect(x + 2, y + 2, TILE - 4, TILE - 4, 8);
  // Shine shows it's slippery.
  g.fillStyle(0xffffff, 0.7);
  g.fillRect(x + 10, y + 8, 4, 18);
  // Funnel for slime shots.
  const fx = dir > 0 ? x + TILE - 4 : x + 4;
  g.fillStyle(0x55e05a, 1);
  g.fillTriangle(fx, y + 12, fx, y + TILE - 12, fx - dir * 14, y + TILE / 2);
  // Open hatch to climb in.
  const hx = dir > 0 ? x + 4 : x + TILE - 14;
  g.fillStyle(0x1e2430, 1);
  g.fillRect(hx, y + 14, 10, TILE - 28);
}

/** A slime machine's platform block (drawn where it is right now). */
export function drawLift(g, x, y, width) {
  g.fillStyle(0x7a8696, 1);
  g.fillRect(x, y, width, TILE);
  g.lineStyle(3, 0x55e05a, 1);
  g.strokeRect(x + 2, y + 2, width - 4, TILE - 4);
  g.fillStyle(0x3a414d, 1);
  for (let i = 10; i < width; i += 20) {
    g.fillCircle(x + i, y + TILE / 2, 3);
  }
}

/** Lava and water. Redrawn every frame so the surface wobbles. */
export function drawFluids(g, level, time) {
  // A floating log's spot is still river underneath.
  const fluidAt = (c, r) => {
    const k = tileAt(level, c, r);
    return k === TileKind.LOG ? TileKind.WATER : k;
  };
  for (let row = 0; row < level.height; row++) {
    for (let col = 0; col < level.width; col++) {
      const kind = fluidAt(col, row);
      if (kind !== TileKind.LAVA && kind !== TileKind.WATER) {
        continue;
      }
      const x = col * TILE;
      const y = row * TILE;
      const color = kind === TileKind.LAVA ? 0xff5a00 : 0x2f8fff;
      const top = kind === TileKind.LAVA ? 0xffd040 : 0x9fd2ff;
      const surface = fluidAt(col, row - 1) !== kind;
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
