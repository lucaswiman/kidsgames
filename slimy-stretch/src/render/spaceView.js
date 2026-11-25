import { TILE } from '../logic/constants.js';
import { BOOSTER_DIRS, gravityDir, TileKind } from '../logic/level.js';
import {
  ASTEROID_RADIUS,
  asteroidStop,
  asteroidWarning,
  BEAM_HALF,
  BLACK_HOLE_RANGE,
  ROCK_RADIUS,
} from '../logic/space.js';

// Drawing for Outer Space: zero gravity zones, teleporters, gravity switches,
// rocket boosters, space elevators, moon rocks, black holes, alien plants,
// UFOs and asteroids.

// Each pair of teleporter pads has its own color, so you can tell which go together.
const PAD_COLORS = [0x4ff0ff, 0xff6ad5, 0xffd84a, 0x8aff6a];

// A tiny repeatable random number so stars don't jump around between frames.
function hash(a, b) {
  const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/** Zero gravity zones: a faint blue starry glow with a dashed border. Drawn once. */
export function drawZeroGZones(g, level) {
  level.zeroG.forEach((z, i) => {
    const w = z.right - z.left;
    const h = z.bottom - z.top;
    g.fillStyle(0x4f8cff, 0.12);
    g.fillRect(z.left, z.top, w, h);
    for (let k = 0; k < (w * h) / 1800; k++) {
      g.fillStyle(0xcfe2ff, 0.5);
      g.fillCircle(z.left + hash(k, i + 1) * w, z.top + hash(i + 1, k) * h, 1.5);
    }
    // A dashed border all the way round.
    g.lineStyle(3, 0x8ab8ff, 0.7);
    const dash = (x1, y1, x2, y2) => {
      const len = Math.hypot(x2 - x1, y2 - y1);
      for (let d = 0; d < len; d += 20) {
        const a = d / len;
        const b = Math.min(1, (d + 11) / len);
        g.lineBetween(
          x1 + (x2 - x1) * a,
          y1 + (y2 - y1) * a,
          x1 + (x2 - x1) * b,
          y1 + (y2 - y1) * b
        );
      }
    };
    dash(z.left, z.top, z.right, z.top);
    dash(z.right, z.top, z.right, z.bottom);
    dash(z.right, z.bottom, z.left, z.bottom);
    dash(z.left, z.bottom, z.left, z.top);
  });
}

/** Moon rocks sitting where they belong, and the space elevators (they act like tiles). */
export function drawSpaceTiles(g, space, clock) {
  for (const rock of space.rocks) {
    const { col, row } = rock.home;
    if (space.level.tiles[row][col] === TileKind.MOON_ROCK) {
      drawMoonRock(g, (col + 0.5) * TILE, (row + 0.5) * TILE, 22);
    }
  }
  for (const lift of space.elevators) {
    const w = lift.width * TILE;
    // The rails it runs along.
    const top = Math.min(lift.from.y, lift.to.y);
    const bottom = Math.max(lift.from.y, lift.to.y) + TILE;
    g.lineStyle(4, 0x56607a, 0.8);
    g.lineBetween(lift.x + 6, top, lift.x + 6, bottom);
    g.lineBetween(lift.x + w - 6, top, lift.x + w - 6, bottom);
    // The platform: a metal deck with a row of blinking blue lights.
    g.fillStyle(0x9aa6ba, 1);
    g.fillRoundedRect(lift.x, lift.y, w, TILE, 6);
    g.fillStyle(0x5a6680, 1);
    g.fillRect(lift.x + 4, lift.y + TILE - 12, w - 8, 8);
    g.fillStyle(0xe6ebf4, 1);
    g.fillRect(lift.x, lift.y, w, 5);
    for (let i = 0; i < lift.width * 3; i++) {
      const on = Math.floor(clock * 4 + i) % 3 === 0;
      g.fillStyle(on ? 0x8ae8ff : 0x2f6a8a, 1);
      g.fillCircle(lift.x + 8 + i * (TILE / 3), lift.y + 14, 3);
    }
  }
}

/** A grey, cratered moon rock. */
function drawMoonRock(g, x, y, r) {
  g.fillStyle(0x8a8f9e, 1);
  g.fillCircle(x, y, r);
  g.fillStyle(0xb4b9c6, 1);
  g.fillCircle(x - r * 0.25, y - r * 0.3, r * 0.65);
  g.fillStyle(0x6c7180, 1);
  g.fillCircle(x + r * 0.35, y + r * 0.2, r * 0.22);
  g.fillCircle(x - r * 0.35, y + r * 0.35, r * 0.15);
  g.fillCircle(x - r * 0.1, y - r * 0.45, r * 0.12);
}

/** Things the slime goes in front of: pads, switches, boosters and black holes. */
export function drawSpaceBehind(g, space, clock) {
  // Black holes: a swirling ring around a dark middle, and a faint edge
  // showing how far they pull.
  for (const hole of space.holes) {
    g.lineStyle(2, 0x9a6aff, 0.12);
    g.strokeCircle(hole.x, hole.y, BLACK_HOLE_RANGE);
    for (let i = 0; i < 3; i++) {
      const k = (clock * 0.6 + i / 3) % 1;
      g.lineStyle(2, 0xb48aff, 0.25 * (1 - k));
      g.strokeCircle(hole.x, hole.y, 30 + (1 - k) * 70);
    }
    g.fillStyle(0xff8a3a, 0.35);
    g.fillCircle(hole.x, hole.y, 30);
    for (let i = 0; i < 6; i++) {
      const a = clock * 3 + (i * Math.PI) / 3;
      g.fillStyle(i % 2 ? 0xffc06a : 0xb46aff, 0.9);
      g.fillCircle(hole.x + Math.cos(a) * 24, hole.y + Math.sin(a) * 10, 4);
    }
    g.fillStyle(0x000000, 1);
    g.fillCircle(hole.x, hole.y, 19);
  }
  // Teleporter pads: a glowing ring with sparkles spinning round. Resting
  // pads are dim.
  space.pads.forEach((pair, i) => {
    const color = PAD_COLORS[i % PAD_COLORS.length];
    for (const pad of [pair.a, pair.b]) {
      const alpha = pair.used ? 0.35 : 1;
      g.fillStyle(color, 0.2 * alpha);
      g.fillCircle(pad.x, pad.y, 22);
      g.lineStyle(4, color, alpha);
      g.strokeCircle(pad.x, pad.y, 18);
      for (let k = 0; k < 4; k++) {
        const a = clock * 4 + (k * Math.PI) / 2;
        g.fillStyle(0xffffff, 0.8 * alpha);
        g.fillCircle(pad.x + Math.cos(a) * 12, pad.y + Math.sin(a) * 12, 2.5);
      }
    }
  });
  // Gravity switches: a button with an arrow showing which way is down.
  const down = gravityDir(space.level);
  for (const s of space.switches) {
    g.fillStyle(0x3a4256, 1);
    g.fillRoundedRect(s.x - 18, s.y - 18, 36, 36, 8);
    g.fillStyle(down > 0 ? 0x4fe07a : 0xff7a4f, 1);
    g.fillCircle(s.x, s.y, 13);
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(s.x - 7, s.y - 2 * down, s.x + 7, s.y - 2 * down, s.x, s.y + 8 * down);
    const tail = s.y - 9 * down;
    g.fillRect(s.x - 2, Math.min(tail, s.y - 2 * down), 4, 7);
  }
  // Rocket boosters: a little rocket pointing the way it blasts you.
  for (const b of space.boosters) {
    const d = BOOSTER_DIRS[b.dir];
    const nx = -d.y;
    const ny = d.x;
    const back = { x: b.x - d.x * 16, y: b.y - d.y * 16 };
    const tip = { x: b.x + d.x * 18, y: b.y + d.y * 18 };
    // A flame out the back while it blasts, and a flicker while it's ready.
    const flame = b.flash > 0 ? 24 : 6 + Math.sin(clock * 20) * 3;
    g.fillStyle(0xffb030, 0.9);
    g.fillTriangle(
      back.x + nx * 8,
      back.y + ny * 8,
      back.x - nx * 8,
      back.y - ny * 8,
      back.x - d.x * flame,
      back.y - d.y * flame
    );
    g.fillStyle(0xd8dde8, 1);
    g.fillTriangle(
      back.x + nx * 10,
      back.y + ny * 10,
      back.x - nx * 10,
      back.y - ny * 10,
      tip.x,
      tip.y
    );
    g.fillStyle(b.cooldown > 0 ? 0x803030 : 0xff4a4a, 1);
    g.fillCircle(b.x, b.y, 5);
  }
}

/** Things drawn over the slime: plants, UFOs and their beams, asteroids, thrown rocks. */
export function drawSpace(g, space, clock) {
  const level = space.level;
  for (const plant of space.plants) {
    drawPlant(g, plant, space.plantMouth(plant), clock);
  }
  for (const ufo of space.ufos) {
    drawUfo(g, ufo, clock);
  }
  // Asteroids, and a blinking warning along a lane before one comes.
  for (const lane of space.lanes) {
    const y = (lane.row + 0.5) * TILE;
    if (asteroidWarning(lane, space.time)) {
      const blink = Math.floor(clock * 8) % 2 === 0;
      const edge = lane.dir > 0 ? 6 : level.pixelWidth - 6;
      const stop = asteroidStop(level, lane);
      g.lineStyle(2, 0xff4a4a, blink ? 0.6 : 0.2);
      const from = Math.min(edge, stop);
      const to = Math.max(edge, stop);
      for (let x = from; x < to; x += 28) {
        g.lineBetween(x, y, Math.min(to, x + 14), y);
      }
      // A big red ! at the edge it's coming from.
      g.fillStyle(0xff3030, blink ? 1 : 0.35);
      g.fillCircle(edge + lane.dir * 16, y, 16);
      g.fillStyle(0xffffff, blink ? 1 : 0.5);
      g.fillRect(edge + lane.dir * 16 - 2.5, y - 10, 5, 12);
      g.fillCircle(edge + lane.dir * 16, y + 7, 2.5);
    }
    for (const rock of lane.rocks) {
      // A dusty trail behind it.
      for (let i = 1; i <= 4; i++) {
        g.fillStyle(0xffb070, 0.25 - i * 0.05);
        g.fillCircle(rock.x - lane.dir * i * 14, rock.y, ASTEROID_RADIUS - i * 3);
      }
      g.fillStyle(0x7a6a5e, 1);
      g.fillCircle(rock.x, rock.y, ASTEROID_RADIUS);
      for (let i = 0; i < 3; i++) {
        const a = rock.spin + (i * Math.PI * 2) / 3;
        g.fillStyle(0x54483f, 1);
        g.fillCircle(rock.x + Math.cos(a) * 9, rock.y + Math.sin(a) * 9, 4 + i);
      }
    }
  }
  // Moon rocks you're carrying or have thrown.
  for (const rock of space.rocks) {
    if (rock.state === 'carried') {
      g.fillStyle(0xffffff, 0.25);
      g.fillCircle(rock.x, rock.y, ROCK_RADIUS + 5);
      drawMoonRock(g, rock.x, rock.y, ROCK_RADIUS);
    } else if (rock.state === 'flying') {
      drawMoonRock(g, rock.x, rock.y, ROCK_RADIUS);
    }
  }
}

function drawPlant(g, plant, mouth, clock) {
  const { face } = plant;
  // The stem grows out of the floor, wall or ceiling behind it.
  const base = { x: plant.x - face.x * TILE * 0.5, y: plant.y - face.y * TILE * 0.5 };
  const nx = -face.y;
  const ny = face.x;
  if (plant.state === 'withered') {
    // Brown and droopy: it won't bother anyone again.
    g.lineStyle(5, 0x7a5a32, 1);
    g.lineBetween(base.x, base.y, base.x + face.x * 14 + nx * 8, base.y + face.y * 14 + ny * 8);
    g.fillStyle(0x6a4a2a, 1);
    g.fillCircle(base.x + face.x * 16 + nx * 10, base.y + face.y * 16 + ny * 10, 7);
    return;
  }
  const sway = Math.sin(clock * 2 + plant.x) * 3;
  const head = { x: mouth.x + nx * sway, y: mouth.y + ny * sway };
  g.lineStyle(6, 0x3aa84a, 1);
  g.lineBetween(base.x, base.y, head.x, head.y);
  g.fillStyle(0x4fd25a, 1);
  g.fillEllipse(base.x + face.x * 8 + nx * 9, base.y + face.y * 8 + ny * 9, 14, 8);
  g.fillEllipse(base.x + face.x * 8 - nx * 9, base.y + face.y * 8 - ny * 9, 14, 8);
  // The head: two purple jaws, open wide as a warning, snapped shut to chomp.
  let open = 0.25;
  if (plant.state === 'open') {
    open = 0.9 + Math.sin(clock * 30) * 0.1;
  } else if (plant.state === 'chomp') {
    open = 0;
  }
  const r = plant.state === 'chomp' ? 17 : 14;
  const angle = Math.atan2(face.y, face.x);
  for (const side of [-1, 1]) {
    const a = angle + side * (0.25 + open * 0.9);
    const jaw = { x: head.x + Math.cos(a) * 6, y: head.y + Math.sin(a) * 6 };
    g.fillStyle(0xa04ad8, 1);
    g.fillCircle(jaw.x, jaw.y, r * 0.8);
    // Little white teeth along the edge.
    g.fillStyle(0xffffff, 1);
    const ta = a - side * 0.6;
    g.fillTriangle(
      jaw.x + Math.cos(ta) * r * 0.7,
      jaw.y + Math.sin(ta) * r * 0.7,
      jaw.x + Math.cos(ta - side * 0.4) * r * 0.9,
      jaw.y + Math.sin(ta - side * 0.4) * r * 0.9,
      jaw.x + Math.cos(ta + side * 0.5) * r * 0.4,
      jaw.y + Math.sin(ta + side * 0.5) * r * 0.4
    );
  }
  if (open > 0.5) {
    g.fillStyle(0xff3050, 1);
    g.fillCircle(head.x + face.x * 4, head.y + face.y * 4, 6);
  }
  // Spots on top.
  g.fillStyle(0xe8b0ff, 1);
  g.fillCircle(head.x - face.x * 4 + nx * 4, head.y - face.y * 4 + ny * 4, 2.5);
}

function drawUfo(g, ufo, clock) {
  const beaming = ufo.state === 'beam' || ufo.state === 'lift' || ufo.state === 'carry';
  if (ufo.state === 'warn') {
    // The beam flickers on and off: get out from under it!
    if (Math.floor(clock * 12) % 2 === 0) {
      g.lineStyle(2, 0x9aff9a, 0.6);
      g.lineBetween(ufo.x - BEAM_HALF, ufo.y + 12, ufo.x - BEAM_HALF, ufo.bottom);
      g.lineBetween(ufo.x + BEAM_HALF, ufo.y + 12, ufo.x + BEAM_HALF, ufo.bottom);
    }
  } else if (ufo.state === 'beam') {
    drawBeam(g, ufo, ufo.bottom, clock);
  } else if (ufo.state === 'lift' || ufo.state === 'carry') {
    drawBeam(g, ufo, ufo.carryY + 30, clock);
  }
  // The saucer, with a glass dome and a little green alien inside.
  g.fillStyle(0xbfe8ff, 0.6);
  g.fillEllipse(ufo.x, ufo.y - 10, 34, 30);
  g.fillStyle(0x5adf5a, 1);
  g.fillCircle(ufo.x, ufo.y - 12, 7);
  g.fillStyle(0x000000, 1);
  g.fillCircle(ufo.x - 3, ufo.y - 13, 1.8);
  g.fillCircle(ufo.x + 3, ufo.y - 13, 1.8);
  g.fillStyle(0x8a94a8, 1);
  g.fillEllipse(ufo.x, ufo.y, 72, 20);
  g.fillStyle(0xc4ccdc, 1);
  g.fillEllipse(ufo.x, ufo.y - 3, 64, 10);
  for (let i = 0; i < 5; i++) {
    const on = beaming || Math.floor(clock * 6 + i) % 2 === 0;
    g.fillStyle(on ? 0xffe066 : 0x8a7a30, 1);
    g.fillCircle(ufo.x - 24 + i * 12, ufo.y + 4, 3);
  }
}

function drawBeam(g, ufo, bottom, clock) {
  const top = ufo.y + 8;
  const shimmer = 0.25 + Math.sin(clock * 10) * 0.05;
  g.fillStyle(0x9aff9a, shimmer);
  g.fillTriangle(ufo.x - 14, top, ufo.x + 14, top, ufo.x - BEAM_HALF, bottom);
  g.fillTriangle(ufo.x + 14, top, ufo.x + BEAM_HALF, bottom, ufo.x - BEAM_HALF, bottom);
  // Rings of light rising up the beam.
  for (let i = 0; i < 4; i++) {
    const k = (clock * 1.5 + i / 4) % 1;
    const y = bottom - (bottom - top) * k;
    const half = 14 + (BEAM_HALF - 14) * ((y - top) / Math.max(1, bottom - top));
    g.lineStyle(2, 0xd8ffd8, 0.5 * (1 - k));
    g.strokeEllipse(ufo.x, y, half * 2, 8);
  }
}
