import { GAME_HEIGHT, GAME_WIDTH, TILE } from '../logic/constants.js';
import { isSolidKind, TileKind, tileAt } from '../logic/level.js';

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
  sky: {
    skyTop: 0x3a8ff0,
    skyBottom: 0xd2ecff,
    grid: null,
    wall: 0xeef0f6,
    wallDark: 0xb8bed0,
    wallLight: 0xffffff,
    fluid: 0x2f8fff,
    fluidTop: 0x9fd2ff,
    text: '#ffffff',
  },
  space: {
    skyTop: 0x03041a,
    skyBottom: 0x1a1040,
    grid: null,
    wall: 0xd9dee8,
    wallDark: 0x8d97aa,
    wallLight: 0xffffff,
    fluid: 0x2f8fff,
    fluidTop: 0x9fd2ff,
    text: '#ffffff',
  },
  candy: {
    skyTop: 0xffbfe0,
    skyBottom: 0xc4ecff,
    grid: null,
    wall: 0xd99a64,
    wallDark: 0x9a5c34,
    wallLight: 0xf6c99a,
    fluid: 0x6b3a1e,
    fluidTop: 0xa0603a,
    text: '#ffffff',
  },
  haunted: {
    skyTop: 0x0d0a1c,
    skyBottom: 0x2a1840,
    grid: null,
    wall: 0x4a3e58,
    wallDark: 0x2c2436,
    wallLight: 0x6d5f80,
    fluid: 0x2f8fff,
    fluidTop: 0x9fd2ff,
    text: '#ffffff',
  },
  computer: {
    skyTop: 0x020a10,
    skyBottom: 0x06222a,
    grid: null,
    wall: 0x14503a,
    wallDark: 0x0a2e20,
    wallLight: 0x2a8a5a,
    fluid: 0x2f8fff,
    fluidTop: 0x9fd2ff,
    text: '#ffffff',
  },
  robots: {
    skyTop: 0x0e1622,
    skyBottom: 0x24384c,
    grid: null,
    wall: 0x9aa6b4,
    wallDark: 0x5a6674,
    wallLight: 0xdde6f0,
    fluid: 0xff5a00,
    fluidTop: 0xffd040,
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
  } else if (themeName === 'sky') {
    drawSkyBackdrop(g, level);
  } else if (themeName === 'space') {
    drawSpaceBackdrop(g, level);
  } else if (themeName === 'candy') {
    drawCandyBackdrop(g, level);
  } else if (themeName === 'haunted') {
    drawHauntedBackdrop(g, level);
  } else if (themeName === 'computer') {
    drawComputerBackdrop(g, level);
  } else if (themeName === 'robots') {
    drawRobotsBackdrop(g, level);
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

/** Way up high: a sun, layers of far-away clouds and a city of floating towers. */
function drawSkyBackdrop(g, level) {
  const w = level.pixelWidth;
  const h = level.pixelHeight;
  g.fillStyle(0xfff6c0, 0.9);
  g.fillCircle(w * 0.15, 120, 50);
  g.fillStyle(0xffffff, 0.25);
  g.fillCircle(w * 0.15, 120, 72);
  // Far-away cloud banks, paler the farther they are.
  const banks = [
    { y: 0.3, alpha: 0.25, step: 170, size: 46 },
    { y: 0.75, alpha: 0.35, step: 210, size: 60 },
  ];
  for (const bank of banks) {
    const y0 = h * bank.y;
    g.fillStyle(0xffffff, bank.alpha);
    for (let x = -80; x < w + 200; x += bank.step) {
      const r = bank.size * (0.7 + hash(x, bank.step) * 0.6);
      const y = y0 + hash(x, 5) * 50;
      g.fillCircle(x, y, r);
      g.fillCircle(x + r * 0.9, y + r * 0.2, r * 0.75);
      g.fillCircle(x - r * 0.8, y + r * 0.3, r * 0.6);
      g.fillRect(x - r * 1.2, y + r * 0.3, r * 2.8, r * 0.6);
    }
  }
  // Sky City: towers with golden domes, floating on little clouds of their own.
  for (let x = 120; x < w; x += 420) {
    const baseY = h * 0.45 + hash(x, 9) * h * 0.25;
    for (let i = 0; i < 3; i++) {
      const tw = 26 + hash(x + i, 2) * 18;
      const th = 90 + hash(x + i, 3) * 110;
      const tx = x + i * 46 - tw / 2;
      const ty = baseY - th;
      g.fillStyle(0xe6ebf6, 0.55);
      g.fillRect(tx, ty, tw, th);
      g.fillStyle(0xf2c84a, 0.6);
      g.fillCircle(tx + tw / 2, ty, tw / 2);
      g.fillTriangle(
        tx + tw / 2 - 3,
        ty - tw / 2,
        tx + tw / 2 + 3,
        ty - tw / 2,
        tx + tw / 2,
        ty - tw
      );
      g.fillStyle(0x9ab8e0, 0.5);
      for (let wy = ty + 14; wy < baseY - 10; wy += 22) {
        g.fillRect(tx + tw / 2 - 4, wy, 8, 10);
      }
    }
    g.fillStyle(0xffffff, 0.6);
    g.fillEllipse(x + 46, baseY + 6, 190, 40);
    g.fillCircle(x - 20, baseY, 22);
    g.fillCircle(x + 112, baseY, 24);
  }
}

/**
 * Outer space, seen through the space station's big windows: stars, glowing
 * nebulas and planets, with the window frames in front.
 */
function drawSpaceBackdrop(g, level) {
  const w = level.pixelWidth;
  const h = level.pixelHeight;
  // Soft nebula glows.
  const nebulas = [0x7a3cff, 0xff4fb0, 0x2fb8ff];
  for (let i = 0; i < Math.ceil(w / 500) + 1; i++) {
    const x = hash(i, 21) * w;
    const y = hash(i, 22) * h;
    const color = nebulas[i % nebulas.length];
    for (let k = 4; k > 0; k--) {
      g.fillStyle(color, 0.05);
      g.fillCircle(x, y, 60 * k + hash(i, 23) * 60);
    }
  }
  // Stars, some bigger and brighter than others.
  for (let i = 0; i < (w * h) / 2500; i++) {
    const x = hash(i, 31) * w;
    const y = hash(i, 32) * h;
    const big = hash(i, 33) > 0.9;
    g.fillStyle(hash(i, 34) > 0.8 ? 0xfff2c0 : 0xffffff, big ? 0.95 : 0.55);
    g.fillCircle(x, y, big ? 2.2 : 1.2);
  }
  // A big ringed planet and a little moon.
  const px = w * 0.7;
  const py = h * 0.3;
  g.fillStyle(0xe8a05a, 0.85);
  g.fillCircle(px, py, 70);
  g.fillStyle(0xc77a3a, 0.85);
  g.fillEllipse(px, py - 18, 136, 16);
  g.fillEllipse(px + 6, py + 22, 128, 12);
  g.lineStyle(6, 0xf6d9a8, 0.6);
  g.strokeEllipse(px, py, 220, 46);
  g.fillStyle(0xb8c4d8, 0.8);
  g.fillCircle(w * 0.22, h * 0.68, 26);
  g.fillStyle(0x8a96ac, 0.8);
  g.fillCircle(w * 0.22 - 8, h * 0.68 - 6, 6);
  g.fillCircle(w * 0.22 + 9, h * 0.68 + 8, 4);
  // The station's window frames: big struts and beams with little blue lights.
  for (let x = 0; x < w; x += 6 * TILE) {
    g.fillStyle(0x3a4256, 0.9);
    g.fillRect(x - 10, 0, 20, h);
    g.fillStyle(0x56607a, 0.9);
    g.fillRect(x - 10, 0, 5, h);
    for (let y = TILE; y < h; y += 3 * TILE) {
      g.fillStyle(0x5ad2ff, 0.9);
      g.fillCircle(x, y, 3);
    }
  }
  for (let y = 4 * TILE; y < h; y += 8 * TILE) {
    g.fillStyle(0x3a4256, 0.9);
    g.fillRect(0, y - 8, w, 16);
    g.fillStyle(0x56607a, 0.9);
    g.fillRect(0, y - 8, w, 4);
  }
}

/**
 * Candyland: rolling candy hills far away, with lollipop trees, gingerbread
 * houses and puffy cotton candy clouds.
 */
function drawCandyBackdrop(g, level) {
  const w = level.pixelWidth;
  const h = level.pixelHeight;
  // Cotton candy clouds.
  for (let x = 90; x < w; x += 380) {
    const y = 60 + hash(x, 41) * 140;
    g.fillStyle(hash(x, 42) > 0.5 ? 0xffd6ec : 0xd6f0ff, 0.8);
    g.fillCircle(x, y, 26);
    g.fillCircle(x + 30, y - 12, 32);
    g.fillCircle(x + 62, y, 24);
  }
  // Two rows of hills, the far ones paler.
  const rows = [
    { base: h - 3.5 * TILE, color: 0xf7b6d8, alpha: 0.55, step: 260, size: 150 },
    { base: h - 1.5 * TILE, color: 0xb6e6c8, alpha: 0.7, step: 320, size: 190 },
  ];
  rows.forEach((r, k) => {
    for (let x = -100; x < w + 200; x += r.step) {
      const size = r.size * (0.8 + hash(x, 43 + k) * 0.4);
      g.fillStyle(r.color, r.alpha);
      g.fillEllipse(x, r.base, size * 2, size * 1.4);
      // Stripes of icing over the top of each hill.
      g.fillStyle(0xffffff, r.alpha * 0.6);
      g.fillEllipse(x, r.base - size * 0.55, size * 0.9, size * 0.18);
    }
  });
  // Lollipop trees and gingerbread houses dotted along the hills.
  const ground = h - 2.2 * TILE;
  const swirl = [0xff5a8a, 0x5ac8ff, 0xffd84a, 0x8ae05a];
  for (let x = 140; x < w; x += 300) {
    if (hash(x, 44) > 0.45) {
      const top = ground - 90 - hash(x, 45) * 40;
      g.fillStyle(0xffffff, 0.75);
      g.fillRect(x - 3, top, 6, ground - top);
      g.fillStyle(swirl[Math.floor(hash(x, 46) * 4)], 0.75);
      g.fillCircle(x, top, 26);
      g.lineStyle(4, 0xffffff, 0.75);
      g.strokeCircle(x, top, 16);
      g.strokeCircle(x, top, 7);
    } else {
      // A little gingerbread house with icing on the roof.
      g.fillStyle(0xb8743e, 0.75);
      g.fillRect(x - 30, ground - 46, 60, 46);
      g.fillStyle(0x8f5630, 0.75);
      g.fillTriangle(x - 38, ground - 44, x + 38, ground - 44, x, ground - 84);
      g.fillStyle(0xffffff, 0.8);
      g.fillTriangle(x - 30, ground - 50, x + 30, ground - 50, x, ground - 80);
      g.fillStyle(0xff6aa0, 0.8);
      g.fillRect(x - 8, ground - 24, 16, 24);
      g.fillStyle(0x7ad0ff, 0.8);
      g.fillRect(x - 24, ground - 38, 10, 10);
      g.fillRect(x + 14, ground - 38, 10, 10);
    }
  }
}

/**
 * Inside the haunted house: striped purple wallpaper, wooden panels along the
 * bottom of each room, tall moonlit windows and dusty cobwebs in the corners.
 */
function drawHauntedBackdrop(g, level) {
  const w = level.pixelWidth;
  const h = level.pixelHeight;
  // (Furniture and dumbwaiters move around, so they don't count here.)
  const moving = kind => kind === TileKind.FURNITURE || kind === TileKind.SKY_ISLAND;
  const empty = (col, row) => {
    const kind = tileAt(level, col, row);
    return kind === TileKind.EMPTY || moving(kind);
  };
  const solid = (col, row) => {
    const kind = tileAt(level, col, row);
    return isSolidKind(kind) && !moving(kind);
  };
  g.fillStyle(0x2b1a3c, 1);
  g.fillRect(0, 0, w, h);
  // Wallpaper stripes, with a little diamond pattern.
  g.fillStyle(0x352148, 1);
  for (let x = 0; x < w; x += 32) {
    g.fillRect(x, 0, 14, h);
  }
  g.fillStyle(0x4a2e5e, 0.6);
  for (let x = 23; x < w; x += 32) {
    for (let y = 16 + ((x / 32) % 2) * 24; y < h; y += 48) {
      g.fillTriangle(x, y - 5, x + 4, y, x, y + 5);
      g.fillTriangle(x, y - 5, x - 4, y, x, y + 5);
    }
  }
  // Wooden panels along the bottom of the wall, just above each floor.
  for (let row = 0; row < level.height; row++) {
    for (let col = 0; col < level.width; col++) {
      if (empty(col, row) && solid(col, row + 1)) {
        const x = col * TILE;
        const y = row * TILE;
        g.fillStyle(0x3d2a22, 1);
        g.fillRect(x, y + 20, TILE, TILE - 20);
        g.fillStyle(0x553a2c, 1);
        g.fillRect(x, y + 18, TILE, 4);
        g.lineStyle(2, 0x2c1e18, 1);
        g.strokeRect(x + 6, y + 27, TILE - 12, TILE - 32);
      }
    }
  }
  // Tall arched windows with the full moon shining in, wherever there's room.
  const taken = new Set(level.paintings.map(p => `${p.col},${p.row}`));
  const fits = (col, row) => {
    for (let r = row; r < row + 3; r++) {
      for (let c = col; c < col + 2; c++) {
        if (!empty(c, r) || taken.has(`${c},${r}`)) {
          return false;
        }
      }
    }
    return true;
  };
  for (let col = 3; col < level.width - 3; col += 9) {
    for (let band = 1; band < level.height - 3; band += 9) {
      for (let row = band; row < band + 5; row++) {
        if (fits(col, row)) {
          drawMoonWindow(g, col * TILE + 8, row * TILE + 8, hash(col, row) > 0.5);
          break;
        }
      }
    }
  }
  // Dusty cobwebs in the top corners of the rooms.
  g.lineStyle(1.5, 0xc8c0d8, 0.35);
  for (let row = 0; row < level.height; row++) {
    for (let col = 0; col < level.width; col++) {
      if (!empty(col, row) || !solid(col, row - 1)) {
        continue;
      }
      for (const side of [-1, 1]) {
        if (solid(col + side, row)) {
          drawCornerWeb(g, side < 0 ? col * TILE : (col + 1) * TILE, row * TILE, -side);
        }
      }
    }
  }
}

/** A tall arched window with moonlight coming in (and sometimes the moon itself). */
function drawMoonWindow(g, x, y, moon) {
  const ww = 2 * TILE - 16;
  const wh = 3 * TILE - 16;
  // A soft beam of moonlight down the wall.
  g.fillStyle(0x9fe8c8, 0.05);
  g.fillTriangle(x, y + wh, x + ww, y + wh, x + ww + 40, y + wh + 90);
  g.fillTriangle(x, y + wh, x + ww + 40, y + wh + 90, x - 20, y + wh + 90);
  g.fillStyle(0x1a1028, 1);
  g.fillRect(x - 5, y + ww / 2 - 5, ww + 10, wh - ww / 2 + 10);
  g.fillCircle(x + ww / 2, y + ww / 2, ww / 2 + 5);
  // Night sky glass, glowing green and purple.
  g.fillGradientStyle(0x3a2a6a, 0x3a2a6a, 0x2a6a5a, 0x2a6a5a, 1);
  g.fillRect(x, y + ww / 2, ww, wh - ww / 2);
  g.fillStyle(0x3a2a6a, 1);
  g.fillCircle(x + ww / 2, y + ww / 2, ww / 2);
  if (moon) {
    g.fillStyle(0xf4f0c8, 0.95);
    g.fillCircle(x + ww * 0.62, y + ww * 0.55, 13);
    g.fillStyle(0xd8d4a8, 0.9);
    g.fillCircle(x + ww * 0.56, y + ww * 0.5, 3);
    g.fillCircle(x + ww * 0.68, y + ww * 0.64, 2);
  } else {
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(x + 14, y + 30, 1.5);
    g.fillCircle(x + 52, y + 50, 1.5);
    g.fillCircle(x + 30, y + 80, 1.2);
  }
  // Window frame bars.
  g.lineStyle(4, 0x1a1028, 1);
  g.lineBetween(x + ww / 2, y, x + ww / 2, y + wh);
  g.lineBetween(x, y + wh * 0.55, x + ww, y + wh * 0.55);
  g.fillStyle(0x553a2c, 1);
  g.fillRect(x - 8, y + wh, ww + 16, 7);
}

/** A dusty cobweb in the corner at (x, y), spreading out toward `dir` (1 = right). */
function drawCornerWeb(g, x, y, dir) {
  const size = 26;
  const spokes = [0, 0.35, 0.75, 1.15, 1.5707];
  for (const a of spokes) {
    g.lineBetween(x, y, x + Math.cos(a) * size * dir, y + Math.sin(a) * size);
  }
  for (const r of [9, 17, 25]) {
    const pts = spokes.map(a => ({ x: x + Math.cos(a) * r * dir, y: y + Math.sin(a) * r }));
    for (let i = 0; i < pts.length - 1; i++) {
      g.lineBetween(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
    }
  }
}

/**
 * Inside the computer: a dark circuit board with glowing traces running
 * every which way, chips with shiny legs, and a faint pixel grid.
 */
function drawComputerBackdrop(g, level) {
  const w = level.pixelWidth;
  const h = level.pixelHeight;
  g.fillStyle(0x041a1c, 1);
  g.fillRect(0, 0, w, h);
  // A faint pixel grid.
  g.lineStyle(1, 0x0a3a3a, 0.5);
  for (let x = 0; x <= w; x += TILE / 2) {
    g.lineBetween(x, 0, x, h);
  }
  for (let y = 0; y <= h; y += TILE / 2) {
    g.lineBetween(0, y, w, y);
  }
  // Glowing traces: each goes along, turns a corner, and ends in a little pad.
  for (let i = 0; i < (w * h) / 14000; i++) {
    let x = Math.floor(hash(i, 1) * (w / 12)) * 12;
    let y = Math.floor(hash(i, 2) * (h / 12)) * 12;
    const color = hash(i, 3) > 0.5 ? 0x1ab07a : 0x1a7ab0;
    g.lineStyle(2, color, 0.3);
    g.fillStyle(color, 0.45);
    g.fillCircle(x, y, 3);
    for (let leg = 0; leg < 3; leg++) {
      const len = (2 + Math.floor(hash(i, leg + 4) * 6)) * 12;
      const across = (leg + Math.floor(hash(i, 9) * 2)) % 2 === 0;
      const dir = hash(i, leg + 7) > 0.5 ? 1 : -1;
      const nx = across ? x + len * dir : x;
      const ny = across ? y : y + len * dir;
      g.lineBetween(x, y, nx, ny);
      x = nx;
      y = ny;
    }
    g.strokeCircle(x, y, 4);
  }
  // Big chips with metal legs.
  for (let x = 120; x < w - 80; x += 420) {
    for (let y = 100; y < h - 80; y += 360) {
      const cx = x + hash(x, y) * 120;
      const cy = y + hash(y, x) * 100;
      g.fillStyle(0x9aa4b0, 0.35);
      for (let k = 0; k < 6; k++) {
        g.fillRect(cx - 34 + k * 13, cy - 44, 5, 10);
        g.fillRect(cx - 34 + k * 13, cy + 34, 5, 10);
      }
      g.fillStyle(0x0a1014, 0.85);
      g.fillRoundedRect(cx - 42, cy - 34, 84, 68, 6);
      g.lineStyle(2, 0x2a3a40, 0.9);
      g.strokeRoundedRect(cx - 42, cy - 34, 84, 68, 6);
      g.fillStyle(0x1ab07a, 0.25);
      g.fillCircle(cx - 30, cy + 22, 4);
    }
  }
}

/**
 * The robot factory: a shiny assembly plant. Steel girders with criss-cross
 * bracing, big orange robot arms building things on a far-away assembly
 * line, and control panels on the walls (their lights blink, see robotsView.js).
 */
function drawRobotsBackdrop(g, level) {
  const w = level.pixelWidth;
  const h = level.pixelHeight;
  // Light from the big windows up top.
  g.fillStyle(0x5ad2ff, 0.06);
  g.fillRect(0, 0, w, h * 0.4);
  // Steel girders, with criss-cross bracing between them.
  for (let x = 120; x < w; x += 320) {
    g.fillStyle(0x34424f, 0.9);
    g.fillRect(x, 0, 18, h);
    g.fillStyle(0x4a5a6a, 0.9);
    g.fillRect(x + 3, 0, 4, h);
    g.lineStyle(4, 0x34424f, 0.7);
    for (let y = 0; y < h; y += 160) {
      g.lineBetween(x + 18, y, x + 160, y + 160);
      g.lineBetween(x + 160, y, x + 18, y + 160);
    }
  }
  for (let y = 140; y < h; y += 300) {
    g.fillStyle(0x34424f, 0.9);
    g.fillRect(0, y, w, 14);
    g.fillStyle(0x4a5a6a, 0.9);
    g.fillRect(0, y + 2, w, 3);
  }
  // Orange robot arms on a far-away assembly line, building robots.
  const lineY = h - 2.2 * TILE;
  g.fillStyle(0x1e2a36, 0.8);
  g.fillRect(0, lineY, w, 18);
  for (let x = 200; x < w; x += 420) {
    const lean = (hash(x, 1) - 0.5) * 1.2;
    const elbow = { x: x + 40 + lean * 40, y: lineY - 110 };
    const hand = { x: x + 90 + lean * 30, y: lineY - 50 };
    g.fillStyle(0x6a3a14, 0.55);
    g.fillRect(x - 20, lineY - 18, 40, 18);
    g.lineStyle(16, 0xc8661a, 0.4);
    g.lineBetween(x, lineY - 18, elbow.x, elbow.y);
    g.lineBetween(elbow.x, elbow.y, hand.x, hand.y);
    g.fillStyle(0x6a7480, 0.45);
    g.fillCircle(elbow.x, elbow.y, 10);
    g.fillCircle(hand.x, hand.y + 10, 8);
    // A half-built robot on the line.
    g.fillStyle(0x6a7480, 0.35);
    g.fillRoundedRect(hand.x - 18, lineY - 34, 36, 34, 6);
    g.fillCircle(hand.x, lineY - 42, 10);
  }
  // Control panels on the walls.
  for (let x = 60; x < w - 60; x += 260) {
    const y = 60 + hash(x, 5) * (h - 220);
    g.fillStyle(0x1a242e, 0.85);
    g.fillRoundedRect(x, y, 70, 50, 6);
    g.lineStyle(2, 0x5a6674, 0.8);
    g.strokeRoundedRect(x, y, 70, 50, 6);
    g.fillStyle(0x3affa0, 0.25);
    g.fillRect(x + 8, y + 8, 36, 16);
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
        if (themeName === 'haunted') {
          // Frosty ice, in the moonlight.
          g.fillStyle(0x2a1840, 0.35);
          g.fillRect(x, y, TILE, TILE);
        } else if (themeName === 'robots') {
          // Polished chrome, too shiny to stick to.
          g.fillStyle(0xc8d4e0, 0.55);
          g.fillRect(x, y, TILE, TILE);
          g.lineStyle(3, 0xffffff, 0.7);
          g.lineBetween(x + 6, y + TILE - 12, x + TILE - 12, y + 6);
        } else if (themeName === 'computer') {
          // Slippery glass, like a screen.
          g.fillStyle(0x0a2a4a, 0.45);
          g.fillRect(x, y, TILE, TILE);
          g.lineStyle(2, 0x9ad8ff, 0.5);
          g.lineBetween(x + 8, y + TILE - 10, x + TILE - 10, y + 8);
        }
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
  } else if (themeName === 'sky') {
    // White cloud-marble with golden trim on top.
    g.lineStyle(2, 0xc8d0e4, 0.7);
    const vx = x + 8 + hash(col, row) * 24;
    g.lineBetween(vx, y + 6, vx + 10, y + 20);
    g.lineBetween(vx + 10, y + 20, vx + 4, y + 36);
    if (openUp) {
      g.fillStyle(0xf2c84a, 1);
      g.fillRect(x, y, TILE, 7);
      g.fillStyle(0xfff0a8, 1);
      g.fillRect(x, y, TILE, 2);
      g.fillStyle(0xd8a830, 1);
      g.fillCircle(x + TILE / 2, y + 4, 2);
    }
  } else if (themeName === 'space') {
    // White station panels with seams, and a strip of blue lights on top.
    g.lineStyle(2, theme.wallDark, 0.5);
    g.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
    if (hash(col, row) > 0.6) {
      g.fillStyle(theme.wallDark, 0.35);
      g.fillRect(x + 10, y + 14 + hash(row, col) * 16, TILE - 20, 4);
    }
    if (openUp) {
      g.fillStyle(0x5a6680, 1);
      g.fillRect(x, y, TILE, 6);
      g.fillStyle(0x5ad2ff, 1);
      for (let i = 0; i < 3; i++) {
        g.fillRect(x + 6 + i * 15, y + 2, 7, 2);
      }
    }
  } else if (themeName === 'candy') {
    // Cake with a layer of cream through the middle, rainbow sprinkles, and
    // pink frosting dripping over the top.
    g.fillStyle(0xfff0e0, 0.8);
    g.fillRect(x, y + 22, TILE, 5);
    const sprinkles = [0xff4f8a, 0x4fc3ff, 0xffd23a, 0x7ae05a, 0xffffff];
    for (let i = 0; i < 3; i++) {
      const sx = x + 6 + hash(col + i, row) * 34;
      const sy = y + 8 + hash(row + i, col) * 32;
      g.lineStyle(3, sprinkles[Math.floor(hash(col, row + i) * 5)], 1);
      g.lineBetween(sx, sy, sx + 5, sy + (hash(i, col) > 0.5 ? 3 : -3));
    }
    if (openUp) {
      g.fillStyle(0xff9ac8, 1);
      g.fillRect(x, y, TILE, 9);
      for (let i = 0; i < 3; i++) {
        const dx = x + 5 + i * 15 + hash(col + i, row) * 5;
        g.fillRoundedRect(dx, y + 5, 8, 6 + hash(row + i, col) * 10, 4);
      }
      g.fillStyle(0xffd0e6, 1);
      g.fillRect(x, y, TILE, 3);
    }
  } else if (themeName === 'computer') {
    // Circuit-board panels: green board with copper traces, solder pads and
    // a bright edge where you can stick.
    g.lineStyle(2, 0xc8a24a, 0.55);
    const a = hash(col, row);
    if (a > 0.5) {
      g.lineBetween(x + 6, y + 14, x + 26, y + 14);
      g.lineBetween(x + 26, y + 14, x + 34, y + 24);
      g.lineBetween(x + 34, y + 24, x + TILE, y + 24);
    } else {
      g.lineBetween(x + 16, y + 6, x + 16, y + 30);
      g.lineBetween(x + 16, y + 30, x + 40, y + 30);
    }
    g.fillStyle(0xd8b85a, 0.8);
    g.fillCircle(x + (a > 0.5 ? 6 : 16), y + (a > 0.5 ? 14 : 6), 3);
    g.fillCircle(x + 36 + hash(row, col) * 6, y + 38, 2.5);
    if (hash(col + 5, row) > 0.8) {
      // A tiny chip on the board.
      g.fillStyle(0x0a1014, 1);
      g.fillRect(x + 22, y + 32, 14, 10);
    }
    if (openUp) {
      g.fillStyle(0x3affa0, 1);
      g.fillRect(x, y, TILE, 4);
      g.fillStyle(0x2a8a5a, 1);
      g.fillRect(x, y + 4, TILE, 3);
    }
    if (openDown) {
      g.fillStyle(0x062016, 1);
      g.fillRect(x, y + TILE - 6, TILE, 6);
    }
  } else if (themeName === 'robots') {
    // Shiny brushed-steel panels with bolts, a gleam across them, and a
    // glowing blue guide light along every floor.
    g.lineStyle(2, theme.wallDark, 0.6);
    g.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
    g.lineStyle(3, 0xffffff, 0.25);
    g.lineBetween(x + 8, y + TILE - 8, x + TILE - 8, y + 8);
    g.fillStyle(theme.wallDark, 1);
    g.fillCircle(x + 7, y + 7, 2);
    g.fillCircle(x + TILE - 7, y + TILE - 7, 2);
    if (hash(col, row) > 0.85) {
      g.fillStyle(0x34424f, 1);
      g.fillRect(x + 14, y + 18, 20, 4);
    }
    if (openUp) {
      g.fillStyle(0x4a5a6a, 1);
      g.fillRect(x, y, TILE, 6);
      g.fillStyle(0x5ad2ff, 1);
      g.fillRect(x + 4, y + 2, TILE - 8, 2);
    }
  } else if (themeName === 'haunted') {
    // Old stone blocks, polished wooden floors on top and dark trim along
    // the ceilings.
    g.lineStyle(2, theme.wallDark, 0.6);
    const offset = row % 2 ? TILE / 2 : 0;
    g.lineBetween(x, y + TILE / 2, x + TILE, y + TILE / 2);
    g.lineBetween(x + offset + 4, y, x + offset + 4, y + TILE / 2);
    g.lineBetween(
      x + ((offset + TILE / 2) % TILE) + 4,
      y + TILE / 2,
      x + ((offset + TILE / 2) % TILE) + 4,
      y + TILE
    );
    if (hash(col, row) > 0.75) {
      g.fillStyle(0x6a8a5a, 0.35);
      g.fillCircle(x + 10 + hash(row, col) * 28, y + 12 + hash(col + 3, row) * 24, 4);
    }
    if (openDown) {
      g.fillStyle(0x24182c, 1);
      g.fillRect(x, y + TILE - 8, TILE, 8);
      g.fillStyle(0x7a5a8a, 1);
      g.fillRect(x, y + TILE - 9, TILE, 2);
    }
    if (openUp) {
      g.fillStyle(0x7a5232, 1);
      g.fillRect(x, y, TILE, 10);
      g.fillStyle(0xa87448, 1);
      g.fillRect(x, y, TILE, 3);
      g.fillStyle(0x4a3020, 1);
      const seam = ((col * 19) % 3) * 12 + 10;
      g.fillRect(x + seam, y + 3, 2, 7);
      g.fillRect(x, y + 9, TILE, 2);
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

export function drawIce(g, x, y) {
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

// The color of each fluid, and of the bright top of its surface.
const FLUID_LOOK = {
  [TileKind.LAVA]: { color: 0xff5a00, top: 0xffd040, alpha: 1 },
  [TileKind.WATER]: { color: 0x2f8fff, top: 0x9fd2ff, alpha: 0.85 },
  [TileKind.CHOCOLATE]: { color: 0x6b3a1e, top: 0xa0603a, alpha: 1 },
};

/** Lava, water and chocolate. Redrawn every frame so the surface wobbles. */
export function drawFluids(g, level, time) {
  // A floating log's spot is still river underneath.
  const fluidAt = (c, r) => {
    const k = tileAt(level, c, r);
    return k === TileKind.LOG ? TileKind.WATER : k;
  };
  for (let row = 0; row < level.height; row++) {
    for (let col = 0; col < level.width; col++) {
      const kind = fluidAt(col, row);
      const look = FLUID_LOOK[kind];
      if (!look) {
        continue;
      }
      const x = col * TILE;
      const y = row * TILE;
      const surface = fluidAt(col, row - 1) !== kind;
      const wave = surface ? 8 + Math.sin(time * 3 + col) * 3 : 0;
      g.fillStyle(look.color, look.alpha);
      g.fillRect(x, y + wave, TILE, TILE - wave);
      if (surface) {
        g.fillStyle(look.top, 1);
        g.fillRect(x, y + wave, TILE, 4);
      }
      if (kind === TileKind.CHOCOLATE) {
        // Swirls flowing along the chocolate river.
        g.lineStyle(3, 0x8a4e2a, 0.8);
        const sx = x + ((time * 30 + hash(col, row) * TILE) % TILE);
        g.lineBetween(sx - 10, y + wave + 16, sx + 4, y + wave + 20);
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
