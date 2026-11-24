import { TILE } from '../logic/constants.js';
import { KITE_STRING } from '../logic/sky.js';

// Drawing for Sky City: clouds of every kind, floating islands, rainbows,
// hot air balloons, kites and lightning.

const RAINBOW_COLORS = [0xff4a4a, 0xff9a2a, 0xffe03a, 0x4fd25a, 0x3a9bff, 0x9a5aff];

// A tiny repeatable random number so puffs don't jump around between frames.
function hash(a, b) {
  const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/** A soft puffy blob of cloud filling the tile at (x, y). */
function puff(g, x, y, col, row, color, alpha, squash = 0) {
  g.fillStyle(color, alpha);
  g.fillCircle(x + 14, y + 26 + squash, 16);
  g.fillCircle(x + 34, y + 26 + squash, 16);
  g.fillCircle(x + 24, y + 16 + squash + hash(col, row) * 4, 18);
}

/** Clouds and islands, drawn behind the slime (they replace normal tiles). */
export function drawSkyTiles(g, sky, clock) {
  // Fluffy clouds: soft white puffs. They squish while you sit on them, and
  // go see-through when you've sunk right through.
  for (const cloud of sky.fluffs) {
    const sink = sky.fluffSink(cloud);
    const soft = cloud.state === 'soft';
    const alpha = soft ? 0.25 + (cloud.timer < 0.6 ? 0.5 * (1 - cloud.timer / 0.6) : 0) : 0.95;
    const wobble = !soft && sink > 0.5 ? Math.sin(clock * 20) * sink * 1.5 : 0;
    const y = cloud.row * TILE - 10;
    for (let col = cloud.from; col <= cloud.to; col++) {
      const x = col * TILE;
      g.fillStyle(0xa8c4e8, alpha);
      g.fillEllipse(x + TILE / 2, y + 26 + sink * 4, TILE + 10, 20);
      g.fillStyle(0xdce8f8, alpha);
      g.fillEllipse(x + TILE / 2, y + 22 + sink * 4, TILE + 8, 18);
      g.fillStyle(0xffffff, alpha);
      g.fillCircle(x + 12, y + 12 + sink * 5 + wobble, 13);
      g.fillCircle(x + 30, y + 9 + sink * 5 - wobble, 15);
      g.fillCircle(x + 44, y + 13 + sink * 5 + wobble, 11);
    }
  }
  // Lightning clouds: dark and grumpy. They flicker and shake before a zap.
  for (const c of sky.storms) {
    const x = c.col * TILE;
    const y = c.row * TILE;
    const warn = c.state === 'warn';
    const zap = c.state === 'zap';
    const flicker = warn && Math.floor(clock * 14) % 2 === 0;
    const shake = warn ? Math.sin(clock * 60) * 2 : 0;
    const color = zap ? 0xb8b8d8 : flicker ? 0x8a8aa8 : 0x5a5f78;
    g.fillStyle(0x3e4258, 1);
    g.fillEllipse(x + TILE / 2 + shake, y + TILE - 8, TILE + 24, 22);
    g.fillStyle(color, 1);
    g.fillCircle(x + 6 + shake, y + 26, 16);
    g.fillCircle(x + 24 + shake, y + 16, 20);
    g.fillCircle(x + 44 + shake, y + 24, 17);
    // Grumpy eyebrows.
    g.lineStyle(3, 0x22253a, 1);
    g.lineBetween(x + 14 + shake, y + 22, x + 22 + shake, y + 26);
    g.lineBetween(x + 34 + shake, y + 22, x + 26 + shake, y + 26);
    g.fillStyle(0x22253a, 1);
    g.fillCircle(x + 19 + shake, y + 30, 2.5);
    g.fillCircle(x + 29 + shake, y + 30, 2.5);
    if (warn) {
      // Little sparks crackling underneath.
      g.lineStyle(2, 0xfff06a, 0.9);
      const sx = x + 10 + hash(Math.floor(clock * 10), c.col) * 28;
      g.lineBetween(sx, y + TILE - 2, sx + 5, y + TILE + 6);
      g.lineBetween(sx + 5, y + TILE + 6, sx, y + TILE + 12);
    }
  }
  // Sleeping clouds (the ones still asleep: woken ones are drawn flying away).
  for (const cloud of sky.clouds) {
    if (cloud.state === 'asleep') {
      drawSleepingCloud(g, cloud, clock, 0, 0, false);
    }
  }
  // Floating islands: grass on top, rock and roots dangling underneath.
  for (const island of sky.islands) {
    drawIsland(g, island.x, island.y, island.width * TILE, island.width);
  }
}

function drawSleepingCloud(g, cloud, clock, dx, dy, awake) {
  const breathe = awake ? 0 : Math.sin(clock * 1.5) * 1.5;
  for (const t of cloud.tiles) {
    const x = t.col * TILE + dx;
    const y = t.row * TILE + dy;
    g.fillStyle(0xd6dcf2, 1);
    g.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
    puff(g, x - 4, y - 4 - breathe, t.col, t.row, 0xeef1ff, 1);
    puff(g, x + 4, y + 6 + breathe, t.row, t.col, 0xf6f8ff, 1);
  }
  // A big sleepy face in the middle.
  const cx = (cloud.left + cloud.right) / 2 + dx;
  const cy = (cloud.top + cloud.bottom) / 2 + dy;
  g.fillStyle(0xffb8c8, 0.7);
  g.fillCircle(cx - 22, cy + 8, 6);
  g.fillCircle(cx + 22, cy + 8, 6);
  if (awake) {
    g.fillStyle(0x30344a, 1);
    g.fillCircle(cx - 12, cy - 2, 4);
    g.fillCircle(cx + 12, cy - 2, 4);
    // A big yawn.
    g.fillEllipse(cx, cy + 14, 10, 12);
  } else {
    g.lineStyle(3, 0x30344a, 1);
    for (const side of [-1, 1]) {
      g.beginPath();
      g.arc(cx + side * 12, cy - 4, 6, 0.2, Math.PI - 0.2);
      g.strokePath();
    }
    g.beginPath();
    g.arc(cx, cy + 10, 5, 0.3, Math.PI - 0.3);
    g.strokePath();
    // z z z, floating up from the top corner.
    for (let i = 0; i < 3; i++) {
      const k = (clock * 0.5 + i / 3) % 1;
      const s = 5 + k * 6;
      const zx = cloud.right + dx - 10 + k * 22;
      const zy = cloud.top + dy + 6 - k * 50;
      g.lineStyle(2.5, 0x5a6aa8, 1 - k);
      g.lineBetween(zx - s, zy - s, zx + s, zy - s);
      g.lineBetween(zx + s, zy - s, zx - s, zy + s);
      g.lineBetween(zx - s, zy + s, zx + s, zy + s);
    }
  }
}

function drawIsland(g, x, y, w, n) {
  // The rocky bottom, coming to a point.
  g.fillStyle(0x8a6a4a, 1);
  g.fillTriangle(x + 4, y + 20, x + w - 4, y + 20, x + w / 2, y + TILE * 1.3);
  g.fillStyle(0x6a4e34, 1);
  g.fillTriangle(x + w / 2, y + 20, x + w - 4, y + 20, x + w / 2, y + TILE * 1.3);
  g.fillStyle(0x9a7a56, 1);
  g.fillRoundedRect(x, y + 6, w, 26, 8);
  // Roots dangling down.
  g.lineStyle(2, 0x5a3e24, 1);
  for (let i = 0; i < n; i++) {
    const rx = x + 16 + i * (w / n);
    g.lineBetween(rx, y + 30, rx + 4, y + 44);
  }
  // Grass on top, with a couple of flowers.
  g.fillStyle(0x45b84e, 1);
  g.fillRoundedRect(x - 2, y, w + 4, 12, 6);
  g.fillStyle(0x6fdc6a, 1);
  for (let i = 4; i < w; i += 10) {
    g.fillTriangle(x + i - 3, y + 2, x + i + 3, y + 2, x + i, y - 5);
  }
  for (let i = 0; i < n; i++) {
    g.fillStyle(i % 2 ? 0xffe03a : 0xff7ab0, 1);
    g.fillCircle(x + 10 + i * (w / n) + (i % 2) * 12, y + 2, 3);
  }
}

/** Rainbows, balloons and kites: things the slime goes in front of. */
export function drawSkyBehind(g, sky, clock) {
  for (const r of sky.rainbows) {
    // Six colored bands side by side along the arc.
    RAINBOW_COLORS.forEach((color, i) => {
      g.lineStyle(5, color, 0.9);
      const off = (i - 2.5) * 5;
      for (let k = 0; k < r.arc.length - 1; k++) {
        const a = r.arc[k];
        const b = r.arc[k + 1];
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const nx = ((b.y - a.y) / len) * off;
        const ny = (-(b.x - a.x) / len) * off;
        g.lineBetween(a.x + nx, a.y + ny, b.x + nx, b.y + ny);
      }
    });
    // A little cloud at each end; the start one glows: touch it to slide!
    const start = r.arc[0];
    const end = r.arc[r.arc.length - 1];
    if (r.cooldown <= 0) {
      g.fillStyle(0xfff6a0, 0.35 + 0.2 * Math.sin(clock * 5));
      g.fillCircle(start.x, start.y, 26);
    }
    for (const p of [start, end]) {
      g.fillStyle(0xffffff, 1);
      g.fillCircle(p.x - 12, p.y + 8, 11);
      g.fillCircle(p.x + 2, p.y + 4, 14);
      g.fillCircle(p.x + 14, p.y + 9, 10);
    }
  }
  for (const b of sky.balloons) {
    if (b.state === 'ready') {
      // Dots show where the balloon goes.
      g.fillStyle(0xffffff, 0.5);
      for (let k = 1; k < b.path.length; k++) {
        const p = b.path[k - 1];
        const q = b.path[k];
        const n = Math.max(1, Math.floor(Math.hypot(q.x - p.x, q.y - p.y) / 24));
        for (let i = 0; i <= n; i++) {
          g.fillCircle(p.x + ((q.x - p.x) * i) / n, p.y + ((q.y - p.y) * i) / n, 3);
        }
      }
    }
    const sway = Math.sin(clock * 1.2 + b.path[0].x) * 2;
    const ex = b.x + sway;
    const ey = b.y - 78;
    // The envelope: stripes of red and yellow.
    g.fillStyle(0xff5a4a, 1);
    g.fillEllipse(ex, ey, 84, 96);
    g.fillStyle(0xffd23a, 1);
    g.fillEllipse(ex, ey, 52, 96);
    g.fillStyle(0xff5a4a, 1);
    g.fillEllipse(ex, ey, 20, 96);
    g.fillStyle(0xffffff, 0.35);
    g.fillEllipse(ex - 20, ey - 22, 14, 26);
    g.fillStyle(0xd84a3a, 1);
    g.fillTriangle(ex - 24, ey + 38, ex + 24, ey + 38, ex, ey + 50);
    // Ropes down to the basket.
    g.lineStyle(2, 0x6a4a2a, 1);
    g.lineBetween(ex - 22, ey + 40, b.x - 16, b.y - 8);
    g.lineBetween(ex + 22, ey + 40, b.x + 16, b.y - 8);
    // A little flame keeps it up.
    g.fillStyle(0xffa020, 0.9);
    g.fillEllipse(b.x, b.y - 22 - Math.sin(clock * 20) * 2, 8, 14);
  }
  for (const kite of sky.kites) {
    const tilt = Math.max(-0.5, Math.min(0.5, (kite.vx || 0) / 300));
    const bottom = { x: kite.x, y: kite.y + KITE_STRING };
    // The string, sagging a little.
    g.lineStyle(2, 0xf6f6f6, 0.9);
    let prev = { x: kite.x, y: kite.y + 22 };
    for (let k = 1; k <= 8; k++) {
      const t = k / 8;
      const p = {
        x: kite.x + Math.sin(t * Math.PI) * (6 - tilt * 20) + Math.sin(clock * 3 + t * 4) * 2,
        y: kite.y + 22 + (bottom.y - kite.y - 22) * t,
      };
      g.lineBetween(prev.x, prev.y, p.x, p.y);
      prev = p;
    }
    if (kite.state === 'ready') {
      g.lineStyle(3, 0xff7ab0, 0.8);
      g.strokeCircle(bottom.x, bottom.y, 7 + Math.sin(clock * 4) * 1.5);
    }
    drawKite(g, kite.x, kite.y, tilt, clock);
  }
}

function drawKite(g, x, y, tilt, clock) {
  const c = Math.cos(tilt);
  const s = Math.sin(tilt);
  const pt = (dx, dy) => ({ x: x + dx * c - dy * s, y: y + dx * s + dy * c });
  const top = pt(0, -24);
  const right = pt(17, -4);
  const bottom = pt(0, 22);
  const left = pt(-17, -4);
  g.fillStyle(0x3ab0ff, 1);
  g.fillTriangle(top.x, top.y, right.x, right.y, bottom.x, bottom.y);
  g.fillStyle(0xff5a8a, 1);
  g.fillTriangle(top.x, top.y, left.x, left.y, bottom.x, bottom.y);
  g.lineStyle(2, 0xffffff, 0.9);
  g.lineBetween(top.x, top.y, bottom.x, bottom.y);
  g.lineBetween(left.x, left.y, right.x, right.y);
  // A wiggly tail with bows.
  let prev = bottom;
  for (let k = 1; k <= 4; k++) {
    const p = { x: bottom.x + Math.sin(clock * 5 + k) * 6 - tilt * 14 * k, y: bottom.y + k * 10 };
    g.lineStyle(2, 0xffe03a, 1);
    g.lineBetween(prev.x, prev.y, p.x, p.y);
    g.fillStyle(k % 2 ? 0xffe03a : 0x6fdc6a, 1);
    g.fillTriangle(p.x - 6, p.y - 3, p.x - 6, p.y + 3, p.x, p.y);
    g.fillTriangle(p.x + 6, p.y - 3, p.x + 6, p.y + 3, p.x, p.y);
    prev = p;
  }
}

/** Lightning bolts, baskets and clouds flying away: drawn over the slime. */
export function drawSky(g, sky, clock) {
  for (const c of sky.storms) {
    if (c.state !== 'zap') {
      continue;
    }
    // A jaggedy bolt that flickers from frame to frame.
    const top = (c.row + 1) * TILE - 6;
    const pts = [{ x: c.x, y: top }];
    const seed = Math.floor(clock * 30);
    for (let y = top + 24; y < c.bottom; y += 24) {
      pts.push({ x: c.x + (hash(seed, y) - 0.5) * 18, y });
    }
    pts.push({ x: c.x, y: c.bottom });
    for (const [width, color, alpha] of [
      [14, 0xfff6a0, 0.35],
      [6, 0xffe94a, 1],
      [2, 0xffffff, 1],
    ]) {
      g.lineStyle(width, color, alpha);
      for (let k = 0; k < pts.length - 1; k++) {
        g.lineBetween(pts[k].x, pts[k].y, pts[k + 1].x, pts[k + 1].y);
      }
    }
    g.fillStyle(0xfff6a0, 0.6);
    g.fillEllipse(c.x, c.bottom, 40, 12);
  }
  // Baskets go in front of the slime riding in them.
  for (const b of sky.balloons) {
    g.fillStyle(0x9a6a3a, 1);
    g.fillRoundedRect(b.x - 18, b.y - 8, 36, 24, 5);
    g.lineStyle(2, 0x6a4422, 1);
    g.lineBetween(b.x - 18, b.y, b.x + 18, b.y);
    g.lineBetween(b.x - 18, b.y + 8, b.x + 18, b.y + 8);
    for (let i = -10; i <= 10; i += 10) {
      g.lineBetween(b.x + i, b.y - 8, b.x + i, b.y + 16);
    }
  }
  for (const cloud of sky.clouds) {
    if (cloud.state === 'flying') {
      drawSleepingCloud(g, cloud, clock, cloud.dx, cloud.dy, true);
    }
  }
}
