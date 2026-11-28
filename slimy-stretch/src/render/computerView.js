import { GAME_HEIGHT, GAME_WIDTH, TILE } from '../logic/constants.js';
import { TileKind } from '../logic/level.js';
import { STREAM_SPEED } from '../logic/warehouse.js';
import {
  circuitPulse,
  circuitState,
  CURSOR_GRAB,
  popupAge,
  VIRUS_RADIUS,
} from '../logic/computer.js';

// Drawing for Inside the Computer: data streams of flowing 1s and 0s,
// glitchy blocks, pop-up windows, electric circuits, cables with plugs,
// copy-paste pads, computer viruses, the giant mouse cursor and the firewall.

const GLOW = 0x5affb0;
const BLUE = 0x3ab0ff;

// A tiny repeatable random number so things don't jump around between frames.
function hash(a, b) {
  const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/** Computer tiles that change, flow or light up (they're redrawn every frame). */
export function drawComputerTiles(g, computer, clock) {
  const level = computer.level;
  level.tiles.forEach((row, r) =>
    row.forEach((kind, c) => {
      if (kind === TileKind.STREAM_RIGHT || kind === TileKind.STREAM_LEFT) {
        drawStream(g, c * TILE, r * TILE, kind === TileKind.STREAM_RIGHT ? 1 : -1, clock, c, r);
      }
    })
  );
  for (const b of computer.glitches) {
    drawGlitch(g, b, clock);
  }
  for (const p of computer.popups) {
    drawPopup(g, p, popupAge(p, computer.time), clock);
  }
  for (const c of computer.circuits) {
    drawCircuit(g, c, computer.time, clock);
  }
}

/** A tiny pixel-style 1 or 0, `s` pixels per dot. */
function drawDigit(g, x, y, one, s) {
  if (one) {
    g.fillRect(x + s, y, s, s * 5);
    g.fillRect(x, y + s, s, s);
    g.fillRect(x, y + s * 4, s * 3, s);
  } else {
    g.fillRect(x, y + s, s, s * 3);
    g.fillRect(x + s * 2, y + s, s, s * 3);
    g.fillRect(x + s, y, s, s);
    g.fillRect(x + s, y + s * 4, s, s);
  }
}

/** A data stream: a glowing river of 1s and 0s flowing along (it carries you). */
function drawStream(g, x, y, dir, clock, col, row) {
  g.fillStyle(0x062a3a, 1);
  g.fillRect(x, y, TILE, TILE);
  g.fillStyle(0x0c4a5a, 1);
  g.fillRect(x, y, TILE, 6);
  g.fillStyle(BLUE, 0.9);
  g.fillRect(x, y, TILE, 2);
  // Three lanes of digits, each flowing a little faster than the last.
  const step = 12;
  for (let lane = 0; lane < 3; lane++) {
    const speed = STREAM_SPEED * (0.8 + lane * 0.2);
    const shift = (((clock * speed * dir) % step) + step) % step;
    for (let i = -1; i < TILE / step; i++) {
      const dx = i * step + shift;
      if (dx < 0 || dx > TILE - 6) {
        continue;
      }
      // Which digit this is stays the same as it flows along.
      const n = Math.round((x + dx - clock * speed * dir) / step);
      const one = hash(n, lane + row * 3) > 0.5;
      g.fillStyle(lane === 1 ? GLOW : BLUE, 0.55 + 0.35 * hash(n, col));
      drawDigit(g, x + dx, y + 10 + lane * 12, one, 1.6);
    }
  }
}

/**
 * A glitchy block: a chip of broken pixels. It flickers and jumps around
 * just before it vanishes, and leaves a dotted outline while it's gone.
 */
function drawGlitch(g, b, clock) {
  const x = b.col * TILE;
  const y = b.row * TILE;
  if (!b.solid) {
    g.lineStyle(2, 0xff5aff, 0.25 + 0.15 * Math.sin(clock * 6));
    for (let i = 0; i < TILE; i += 8) {
      g.lineBetween(x + i, y + 1, x + i + 4, y + 1);
      g.lineBetween(x + i, y + TILE - 1, x + i + 4, y + TILE - 1);
      g.lineBetween(x + 1, y + i, x + 1, y + i + 4);
      g.lineBetween(x + TILE - 1, y + i, x + TILE - 1, y + i + 4);
    }
    return;
  }
  const flicker = b.state === 'flicker';
  if (flicker && Math.floor(clock * 14) % 3 === 0) {
    // Blink!
    g.fillStyle(0xff5aff, 0.25);
    g.fillRect(x, y, TILE, TILE);
    return;
  }
  // Sliced into strips that slide sideways when it glitches.
  for (let s = 0; s < 4; s++) {
    const jump = flicker ? (hash(Math.floor(clock * 20), s + b.col) - 0.5) * 10 : 0;
    const sy = y + s * 12;
    g.fillStyle(s % 2 ? 0x6a2a9a : 0x8a3abf, 1);
    g.fillRect(x + jump, sy, TILE, 12);
    for (let p = 0; p < 6; p++) {
      if (hash(s * 7 + p, b.col + b.row * 5 + Math.floor(clock * (flicker ? 12 : 2))) > 0.6) {
        g.fillStyle(p % 2 ? 0xff5aff : 0x5affff, 0.9);
        g.fillRect(x + jump + p * 8, sy + 3, 6, 6);
      }
    }
  }
  g.lineStyle(2, 0xff9aff, 0.8);
  g.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
}

/**
 * A pop-up window: a little window with a blue title bar and a red X. It
 * pops open, shakes just before it closes, and while it's closed there's a
 * faint outline where it will pop up next.
 */
function drawPopup(g, p, age, clock) {
  const x = p.col * TILE;
  const y = p.row * TILE;
  const w = p.width * TILE;
  if (p.state === 'closed') {
    g.lineStyle(2, 0xbfe6ff, 0.18);
    g.strokeRect(x + 2, y + 2, w - 4, TILE - 4);
    return;
  }
  // Pop! It grows from the middle as it opens.
  const grow = Math.min(1, 0.4 + age * 3);
  const shake = p.state === 'closing' ? Math.sin(clock * 40) * 2 : 0;
  const cx = x + w / 2 + shake;
  const cy = y + TILE / 2;
  const ww = w * grow;
  const hh = TILE * grow;
  const left = cx - ww / 2;
  const top = cy - hh / 2;
  g.fillStyle(0x000000, 0.25);
  g.fillRect(left + 4, top + 4, ww, hh);
  g.fillStyle(0xe8eef6, 1);
  g.fillRect(left, top, ww, hh);
  g.fillStyle(0x2a6aff, 1);
  g.fillRect(left, top, ww, 13 * grow);
  g.fillStyle(0xbfe0ff, 1);
  g.fillRect(left + 5, top + 4 * grow, ww * 0.35, 4 * grow);
  // The X button (it blinks when the window is about to close).
  const blink = p.state === 'closing' && Math.floor(clock * 8) % 2 === 0;
  g.fillStyle(blink ? 0xffe066 : 0xe8423a, 1);
  g.fillRect(left + ww - 15 * grow, top + 1, 13 * grow, 11 * grow);
  g.lineStyle(2, 0xffffff, 1);
  const bx = left + ww - 8.5 * grow;
  const by = top + 6.5 * grow;
  g.lineBetween(bx - 3, by - 3, bx + 3, by + 3);
  g.lineBetween(bx + 3, by - 3, bx - 3, by + 3);
  // Some pretend text and an OK button.
  g.fillStyle(0x8a96a8, 1);
  g.fillRect(left + 8, top + 20 * grow, ww * 0.5, 3 * grow);
  g.fillRect(left + 8, top + 28 * grow, ww * 0.35, 3 * grow);
  g.fillStyle(0x5a9aff, 1);
  g.fillRect(left + ww - 34 * grow, top + 24 * grow, 26 * grow, 14 * grow);
  g.lineStyle(2, 0x2a3a5a, 1);
  g.strokeRect(left, top, ww, hh);
}

/**
 * An electric circuit: a copper wire against its floor or wall. When power
 * is coming, a bright pulse runs along it; then it crackles with electricity.
 */
function drawCircuit(g, circuit, time, clock) {
  const state = circuitState(circuit, time);
  const pulse = circuitPulse(circuit, time);
  const n = circuit.cells.length;
  circuit.strips.forEach((s, i) => {
    const horizontal = s.right - s.left > s.bottom - s.top;
    const mx = (s.left + s.right) / 2;
    const my = (s.top + s.bottom) / 2;
    const [x1, y1, x2, y2] = horizontal ? [s.left, my, s.right, my] : [mx, s.top, mx, s.bottom];
    const lit = state === 'zap' || (state === 'warn' && i / n <= pulse);
    g.lineStyle(6, 0x1a3a2a, 1);
    g.lineBetween(x1, y1, x2, y2);
    g.lineStyle(3, lit ? 0xffe066 : 0xc8823a, 1);
    g.lineBetween(x1, y1, x2, y2);
    // Little solder dots along the wire.
    g.fillStyle(lit ? 0xfff6b0 : 0xd8a060, 1);
    g.fillCircle(x1 + (x2 - x1) * 0.25, y1 + (y2 - y1) * 0.25, 3);
    g.fillCircle(x1 + (x2 - x1) * 0.75, y1 + (y2 - y1) * 0.75, 3);
    if (state === 'warn' && Math.abs(i / n - pulse) < 1 / n) {
      // The pulse of power, running along the wire.
      g.fillStyle(0xffffff, 1);
      g.fillCircle(mx, my, 5);
      g.fillStyle(0xffe066, 0.4);
      g.fillCircle(mx, my, 11);
    }
    if (state === 'zap') {
      // Crackling electricity!
      g.fillStyle(0x7affff, 0.18);
      g.fillRect(s.left - 4, s.top - 4, s.right - s.left + 8, s.bottom - s.top + 8);
      g.lineStyle(2, 0xe0ffff, 0.95);
      const k = Math.floor(clock * 30) + i * 7;
      let px = x1;
      let py = y1;
      for (let j = 1; j <= 4; j++) {
        const t = j / 4;
        const jitter = (hash(k, j) - 0.5) * 16;
        const nx = x1 + (x2 - x1) * t + (horizontal ? 0 : jitter);
        const ny = y1 + (y2 - y1) * t + (horizontal ? jitter : 0);
        g.lineBetween(px, py, nx, ny);
        px = nx;
        py = ny;
      }
    }
  });
}

/** Computer things the slime goes in front of: cables, copy-paste pads and blinking LEDs. */
export function drawComputerBehind(g, computer, clock) {
  drawLeds(g, computer, clock);
  for (const cable of computer.cables) {
    drawCable(g, cable, clock);
  }
  for (const pad of computer.copyPads) {
    drawCopyPad(g, pad, clock);
  }
}

// Where each level's blinking LEDs go, worked out once.
const LED_SPOTS = new WeakMap();

/** Little LEDs on the circuit-board walls, blinking away. */
function drawLeds(g, computer, clock) {
  const level = computer.level;
  if (!LED_SPOTS.has(level)) {
    const spots = [];
    level.tiles.forEach((row, r) =>
      row.forEach((kind, c) => {
        const open = level.tiles[r - 1] && level.tiles[r - 1][c] === TileKind.EMPTY;
        if (kind === TileKind.WALL && open && hash(c, r) > 0.8) {
          spots.push({ x: c * TILE + 8 + hash(r, c) * 32, y: r * TILE + 18, k: hash(c + 9, r) });
        }
      })
    );
    LED_SPOTS.set(level, spots);
  }
  for (const led of LED_SPOTS.get(level)) {
    const on = Math.sin(clock * (2 + led.k * 4) + led.k * 20) > 0.2;
    const color = led.k > 0.5 ? 0x5aff7a : led.k > 0.25 ? 0xffb030 : 0xff4a4a;
    g.fillStyle(color, on ? 0.35 : 0.08);
    g.fillCircle(led.x, led.y, 6);
    g.fillStyle(color, on ? 1 : 0.3);
    g.fillCircle(led.x, led.y, 2.5);
  }
}

/** A cable with a plug at each end. Data zips along it, and it glows after a ride. */
function drawCable(g, cable, clock) {
  const pts = cable.path;
  g.lineStyle(12, 0x10202c, 1);
  for (let i = 0; i < pts.length - 1; i++) {
    g.lineBetween(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
  }
  for (const p of pts) {
    g.fillStyle(0x10202c, 1);
    g.fillCircle(p.x, p.y, 6);
  }
  const glow = cable.glow > 0 ? 1 : 0.7;
  g.lineStyle(6, cable.glow > 0 ? 0x9affd0 : 0x2a6aaa, glow);
  for (let i = 0; i < pts.length - 1; i++) {
    g.lineBetween(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
  }
  // Little bits of data zipping along inside.
  let total = 0;
  const lengths = [];
  for (let i = 0; i < pts.length - 1; i++) {
    lengths.push(Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y));
    total += lengths[lengths.length - 1];
  }
  g.fillStyle(0xe0fff0, 0.9);
  for (let d = (clock * 140) % 40; d < total; d += 40) {
    let left = d;
    for (let i = 0; i < lengths.length; i++) {
      if (left <= lengths[i]) {
        const t = left / lengths[i];
        g.fillRect(
          pts[i].x + (pts[i + 1].x - pts[i].x) * t - 2,
          pts[i].y + (pts[i + 1].y - pts[i].y) * t - 2,
          4,
          4
        );
        break;
      }
      left -= lengths[i];
    }
  }
  drawPlug(g, pts[0], pts[1], cable.used);
  drawPlug(g, pts[pts.length - 1], pts[pts.length - 2], cable.used);
}

/** A chunky plug at `p`, with its cable coming in from `from`. */
function drawPlug(g, p, from, used) {
  const angle = Math.atan2(p.y - from.y, p.x - from.x);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const box = (along, across, w, h, color) => {
    const cx = p.x + cos * along - sin * across;
    const cy = p.y + sin * along + cos * across;
    const hw = w / 2;
    const hh = h / 2;
    const corner = (a, b) => ({ x: cx + cos * a - sin * b, y: cy + sin * a + cos * b });
    g.fillStyle(color, 1);
    g.fillPoints([corner(-hw, -hh), corner(hw, -hh), corner(hw, hh), corner(-hw, hh)], true);
  };
  box(-6, 0, 22, 26, 0x2a3440);
  box(-6, 0, 16, 20, used ? 0x4a5a6a : 0x5a7a9a);
  box(8, -6, 10, 4, 0xd8c060);
  box(8, 6, 10, 4, 0xd8c060);
  g.fillStyle(used ? 0x445566 : GLOW, used ? 0.6 : 0.7 + 0.3 * Math.sin(p.x));
  g.fillCircle(p.x - cos * 6, p.y - sin * 6, 3);
}

/** A copy pad (two pages) and its paste pad (a clipboard), on the floor. */
function drawCopyPad(g, pad, clock) {
  for (const [spot, paste] of [
    [pad.copy, false],
    [pad.paste, true],
  ]) {
    const x = spot.x;
    const y = spot.y + TILE / 2 - 6;
    const color = paste ? 0x3ad07a : 0x3a9aff;
    const alpha = pad.used ? 0.35 : 1;
    if (!pad.used) {
      g.fillStyle(color, 0.18 + 0.08 * Math.sin(clock * 4));
      g.fillEllipse(x, y, 52, 16);
    }
    g.fillStyle(0x1a2a3a, alpha);
    g.fillRoundedRect(x - 22, y - 4, 44, 10, 4);
    g.fillStyle(color, alpha);
    g.fillRoundedRect(x - 20, y - 6, 40, 8, 4);
    // Its picture, floating just above it.
    const iy = y - 26 + Math.sin(clock * 3 + x) * 2;
    if (paste) {
      g.fillStyle(0x8a5a2a, alpha);
      g.fillRect(x - 8, iy - 9, 16, 20);
      g.fillStyle(0xffffff, alpha);
      g.fillRect(x - 6, iy - 5, 12, 14);
      g.fillStyle(0xb0b0b0, alpha);
      g.fillRect(x - 4, iy - 11, 8, 4);
    } else {
      g.fillStyle(0xffffff, alpha * 0.7);
      g.fillRect(x - 9, iy - 9, 12, 15);
      g.fillStyle(0xffffff, alpha);
      g.fillRect(x - 4, iy - 5, 12, 15);
    }
    g.lineStyle(1.5, 0x3a4a5a, alpha);
    g.lineBetween(x - 2, iy + 1, x + 6, iy + 1);
    g.lineBetween(x - 2, iy + 5, x + 6, iy + 5);
  }
}

/** Computer things drawn over the slime: viruses, and the mouse cursors. */
export function drawComputerOver(g, computer, clock) {
  for (const v of computer.viruses) {
    drawVirus(g, computer, v, clock);
  }
  for (const cur of computer.cursors) {
    drawCursor(g, cur, clock);
  }
}

/**
 * A computer virus: a spiky little bug with angry eyes and wiggly legs. It
 * glows red and shows a "!" while it's chasing you, and bursts into pixels
 * when a slime shot deletes it.
 */
function drawVirus(g, computer, v, clock) {
  if (v.state === 'deleted') {
    const k = computer.poof(v);
    if (k >= 1) {
      return;
    }
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      g.fillStyle(i % 2 ? 0x5affb0 : 0xff4a8a, 1 - k);
      g.fillRect(v.x + Math.cos(a) * 30 * k - 3, v.y + Math.sin(a) * 30 * k - 3, 6, 6);
    }
    return;
  }
  // Which way is "up" for this virus (away from its floor or wall).
  const up = { floor: [0, -1], ceiling: [0, 1], left: [1, 0], right: [-1, 0] }[v.side];
  const across = [-up[1], up[0]];
  const chasing = v.state === 'chase';
  const at = (a, b) => ({ x: v.x + across[0] * a + up[0] * b, y: v.y + across[1] * a + up[1] * b });
  // Legs (wiggling as it crawls).
  g.lineStyle(3, 0x3a0a2a, 1);
  for (let i = 0; i < 3; i++) {
    for (const side of [-1, 1]) {
      const wiggle = Math.sin(clock * (chasing ? 24 : 14) + i * 2 + side) * 3;
      const from = at(side * (4 + i * 3), -2);
      const to = at(side * (10 + i * 4) + wiggle, -VIRUS_RADIUS + 1);
      g.lineBetween(from.x, from.y, to.x, to.y);
    }
  }
  if (chasing) {
    g.fillStyle(0xff3a3a, 0.25 + 0.1 * Math.sin(clock * 12));
    g.fillCircle(v.x, v.y, VIRUS_RADIUS + 9);
  }
  // Spikes all around, then the round body.
  g.fillStyle(chasing ? 0xd8205a : 0xa8209a, 1);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + clock * 0.8;
    const tip = {
      x: v.x + Math.cos(a) * (VIRUS_RADIUS + 5),
      y: v.y + Math.sin(a) * (VIRUS_RADIUS + 5),
    };
    g.fillCircle(tip.x, tip.y, 3);
  }
  g.fillCircle(v.x, v.y, VIRUS_RADIUS);
  g.fillStyle(0xff7ad0, 1);
  g.fillCircle(v.x - 4, v.y - 5, 4);
  // Angry eyes, looking the way it's going.
  const look = v.axis === 'x' ? { x: v.dir * 2, y: 0 } : { x: 0, y: v.dir * 2 };
  for (const side of [-1, 1]) {
    const e = at(side * 5, 2);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(e.x, e.y, 4);
    g.fillStyle(chasing ? 0xff0000 : 0x000000, 1);
    g.fillCircle(e.x + look.x, e.y + look.y, 2);
  }
  g.lineStyle(2, 0x2a0a1a, 1);
  const b1 = at(-8, 7);
  const b2 = at(-2, 5);
  const b3 = at(2, 5);
  const b4 = at(8, 7);
  g.lineBetween(b1.x, b1.y, b2.x, b2.y);
  g.lineBetween(b3.x, b3.y, b4.x, b4.y);
  if (chasing) {
    const top = at(0, VIRUS_RADIUS + 16);
    g.fillStyle(0xffe066, 1);
    g.fillRect(top.x - 2, top.y - 8, 4, 10);
    g.fillRect(top.x - 2, top.y + 4, 4, 4);
  }
}

/**
 * The giant mouse cursor: a big white arrow whose tip is the spot that grabs.
 * While it drags you there's a dotted line to where it's taking you.
 */
function drawCursor(g, cur, clock) {
  const x = cur.x;
  const y = cur.y;
  if (cur.state === 'drag') {
    g.fillStyle(0xffffff, 0.6);
    const d = Math.hypot(cur.drop.x - x, cur.drop.y - y);
    for (let k = 12; k < d; k += 18) {
      g.fillRect(x + ((cur.drop.x - x) * k) / d - 2, y + ((cur.drop.y - y) * k) / d - 2, 4, 4);
    }
  } else {
    // A gentle glow where it grabs, so you can see it coming.
    g.fillStyle(0xffffff, 0.12 + 0.06 * Math.sin(clock * 5));
    g.fillCircle(x, y, CURSOR_GRAB);
  }
  // The drop spot: a little target.
  g.lineStyle(2, 0xffffff, 0.35);
  g.strokeCircle(cur.drop.x, cur.drop.y, 10);
  g.lineBetween(cur.drop.x - 15, cur.drop.y, cur.drop.x + 15, cur.drop.y);
  g.lineBetween(cur.drop.x, cur.drop.y - 15, cur.drop.x, cur.drop.y + 15);
  const s = 1.6;
  const arrow = [
    [0, 0],
    [0, 34],
    [8, 26],
    [14, 40],
    [21, 37],
    [15, 23],
    [26, 23],
  ].map(([ax, ay]) => ({ x: x + ax * s, y: y + ay * s }));
  g.fillStyle(0x000000, 0.25);
  g.fillPoints(
    arrow.map(p => ({ x: p.x + 5, y: p.y + 5 })),
    true
  );
  g.fillStyle(0xffffff, 1);
  g.fillPoints(arrow, true);
  g.lineStyle(3, 0x111111, 1);
  g.strokePoints(arrow, true);
  if (cur.state === 'drag') {
    // Click!
    g.fillStyle(0x3ab0ff, 0.8);
    g.fillCircle(x, y, 6);
  }
}

/**
 * The firewall: a wall of bricks on fire, sweeping across the level. `pos.x`
 * is its front edge; `pos.dir` is which way it's going.
 */
export function drawFirewall(g, pos, level, cam, clock) {
  const top = Math.min(0, cam.scrollY) - TILE;
  const bottom = Math.max(level.pixelHeight, cam.scrollY + GAME_HEIGHT) + TILE;
  const far =
    pos.dir > 0
      ? Math.min(0, cam.scrollX) - TILE
      : Math.max(level.pixelWidth, cam.scrollX + GAME_WIDTH) + TILE;
  const front = pos.x;
  const left = Math.min(far, front);
  const right = Math.max(far, front);
  if (right <= left) {
    return;
  }
  g.fillStyle(0x8a1a0a, 0.92);
  g.fillRect(left, top, right - left, bottom - top);
  // Glowing bricks.
  const bw = 32;
  const bh = 16;
  for (let y = Math.floor(top / bh) * bh; y < bottom; y += bh) {
    const shift = (Math.floor(y / bh) % 2) * (bw / 2);
    for (let x = Math.floor((left - shift) / bw) * bw + shift; x < right; x += bw) {
      const x0 = Math.max(left, x + 2);
      const x1 = Math.min(right, x + bw - 2);
      if (x1 > x0) {
        g.fillStyle(0xc83a14, 0.9);
        g.fillRect(x0, y + 2, x1 - x0, bh - 4);
      }
    }
  }
  // Flames licking out of the front edge, flickering pixel-style.
  for (let y = Math.floor(top / 16) * 16; y < bottom; y += 16) {
    const flick = hash(Math.floor(clock * 12), y);
    const len = 18 + flick * 28;
    const tip = front + pos.dir * len;
    g.fillStyle(0xff7a1a, 0.95);
    g.fillTriangle(front, y - 4, front, y + 20, tip, y + 8);
    g.fillStyle(0xffd040, 0.95);
    g.fillTriangle(front, y + 2, front, y + 14, front + pos.dir * len * 0.55, y + 8);
  }
  g.fillStyle(0xffe066, 0.5);
  g.fillRect(pos.dir > 0 ? front - 6 : front, top, 6, bottom - top);
}
