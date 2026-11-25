import { GAME_WIDTH, TILE } from '../logic/constants.js';
import { TileKind } from '../logic/level.js';
import {
  CANE_THICK,
  CARAMEL_HOLD,
  caneShape,
  GUMBALL_RADIUS,
  LOLLIPOP_REGROW,
  LOLLIPOP_TIME,
  MARSH_SINK,
  touchingCaramel,
} from '../logic/candy.js';
import {
  BLAST_RADIUS,
  BOMB_FUSE,
  BOMB_RADIUS,
  HAND_RADIUS,
  HEAD_HEIGHT,
  HEAD_WIDTH,
} from '../logic/kingClaw.js';
import { drawIce } from './theme.js';

// Drawing for Candyland: caramel, gumdrops, marshmallows, ice cream scoops,
// gumball machines, sour candy clouds and their rain, licorice ropes,
// lollipops, swinging candy canes and gumballs. Plus King Claw.

const GUMBALL_COLORS = [0xff4a6a, 0x4ac8ff, 0xffd23a, 0x7ae05a];
const SCOOP_COLORS = [0xffb6d5, 0xb8f0d0, 0xfff1c8];

// A tiny repeatable random number so things don't jump around between frames.
function hash(a, b) {
  const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/** Candy tiles that move or change (they're redrawn every frame). */
export function drawCandyTiles(g, candy, clock) {
  const level = candy.level;
  level.tiles.forEach((row, r) =>
    row.forEach((kind, c) => {
      const x = c * TILE;
      const y = r * TILE;
      if (kind === TileKind.CARAMEL) {
        drawCaramel(g, level, c, r, x, y);
      } else if (kind === TileKind.GUMDROP) {
        drawGumdrop(g, x, y, c, clock);
      }
    })
  );
  for (const m of candy.marshmallows) {
    const sink = candy.squish(m) * MARSH_SINK - (m.pop > 0 ? m.pop * 12 : 0);
    for (let col = m.from; col <= m.to; col++) {
      drawMarshmallow(g, col * TILE, m.row * TILE, sink);
    }
  }
  for (const s of candy.scoops) {
    const melt = candy.melt(s);
    for (let col = s.from; col <= s.to; col++) {
      drawScoop(g, col * TILE, s.row * TILE, col, melt, s.state === 'melted', clock);
    }
  }
  for (const m of candy.machines) {
    drawGumballMachine(g, m, clock);
  }
  for (const c of candy.clouds) {
    for (let col = c.from; col <= c.to; col++) {
      drawSourCloud(g, col * TILE, c.row * TILE, col, c.state, clock);
    }
  }
}

/** Sticky golden caramel, glossy, with drips hanging off the bottom. */
function drawCaramel(g, level, col, row, x, y) {
  g.fillStyle(0xc8781e, 1);
  g.fillRect(x, y, TILE, TILE);
  g.fillStyle(0xe8a040, 1);
  g.fillRect(x, y + 4, TILE, 14);
  g.fillStyle(0xffd890, 0.7);
  g.fillEllipse(x + 14 + hash(col, row) * 20, y + 9, 16, 5);
  if (level.tiles[row + 1] && level.tiles[row + 1][col] === TileKind.EMPTY) {
    g.fillStyle(0xc8781e, 1);
    for (let i = 0; i < 2; i++) {
      const dx = x + 8 + i * 22 + hash(col + i, row) * 8;
      g.fillRoundedRect(dx, y + TILE - 4, 7, 8 + hash(row, col + i) * 8, 3);
    }
  }
}

/** A bouncy gumdrop with sugar sparkles. It jiggles a little. */
function drawGumdrop(g, x, y, col, clock) {
  const color = GUMBALL_COLORS[col % GUMBALL_COLORS.length];
  const wobble = Math.sin(clock * 4 + col) * 2;
  const cx = x + TILE / 2;
  g.fillStyle(color, 1);
  g.fillEllipse(cx, y + TILE - 14, TILE + wobble, 28);
  g.fillEllipse(cx, y + TILE / 2 - wobble / 2, TILE - 8 - wobble, TILE - 4 + wobble);
  g.fillStyle(0xffffff, 0.45);
  g.fillEllipse(cx - 9, y + 14, 10, 14);
  g.fillStyle(0xffffff, 0.8);
  for (let i = 0; i < 5; i++) {
    g.fillCircle(x + 8 + hash(col, i) * 32, y + 10 + hash(i, col) * 30, 1.5);
  }
}

/** A puffy marshmallow block. `sink` squashes its top down. */
function drawMarshmallow(g, x, y, sink) {
  const top = y + Math.max(-8, sink);
  g.fillStyle(0xf4eee8, 1);
  g.fillRoundedRect(x + 1, top, TILE - 2, y + TILE - top, 12);
  g.fillStyle(0xffffff, 1);
  g.fillEllipse(x + TILE / 2, top + 6, TILE - 8, 12);
  g.fillStyle(0xe2d6cc, 1);
  g.fillRect(x + 4, y + TILE - 8, TILE - 8, 4);
}

/**
 * A scoop of ice cream on a little wafer (a one-way platform). `melt` goes
 * from 0 (frozen) to 1; a melted scoop is just a faint puddle until it
 * freezes back.
 */
function drawScoop(g, x, y, col, melt, gone, clock) {
  const color = SCOOP_COLORS[col % SCOOP_COLORS.length];
  if (gone) {
    g.fillStyle(color, 0.3);
    g.fillEllipse(x + TILE / 2, y + 6, TILE - 4, 8);
    return;
  }
  const shrink = melt * 10;
  g.fillStyle(0xd8a050, 1);
  g.fillRect(x, y + 10, TILE, 6);
  g.lineStyle(1, 0xa87030, 1);
  for (let i = 4; i < TILE; i += 8) {
    g.lineBetween(x + i, y + 10, x + i, y + 16);
  }
  g.fillStyle(color, 1);
  g.fillEllipse(x + TILE / 2, y + 4 + shrink * 0.6, TILE + 2 - shrink, 28 - shrink * 1.4);
  g.fillStyle(0xffffff, 0.35);
  g.fillEllipse(x + TILE / 2, y - 4 + shrink, TILE * 0.6 - shrink, 8);
  // Melting drips get longer and longer.
  for (let i = 0; i < 3; i++) {
    const dx = x + 8 + i * 15;
    const len = 4 + melt * (10 + 8 * Math.sin(clock * 3 + i + col));
    g.fillRoundedRect(dx, y + 12, 6, len, 3);
  }
  g.fillStyle(0xffffff, 0.6);
  g.fillCircle(x + 16, y + 2 + shrink * 0.4, 3);
}

/** A gumball machine: a glass globe full of gumballs. It rattles before it shoots. */
function drawGumballMachine(g, m, clock) {
  const shake = m.state === 'warn' ? Math.sin(clock * 50) * 3 : 0;
  const x = m.col * TILE + shake;
  const y = m.row * TILE;
  g.fillStyle(0xd83040, 1);
  g.fillRoundedRect(x + 8, y + 28, TILE - 16, 20, 4);
  g.fillStyle(0x902030, 1);
  g.fillRect(x + 18, y + 34, 12, 8);
  g.fillStyle(0xdff6ff, 0.9);
  g.fillCircle(x + TILE / 2, y + 18, 17);
  for (let i = 0; i < 6; i++) {
    g.fillStyle(GUMBALL_COLORS[i % 4], 1);
    g.fillCircle(x + 14 + (i % 3) * 10, y + 14 + Math.floor(i / 3) * 9, 4.5);
  }
  g.fillStyle(0xffffff, 0.8);
  g.fillCircle(x + 17, y + 9, 3);
  g.fillStyle(0xd83040, 1);
  g.fillRect(x + TILE / 2 - 5, y, 10, 4);
  if (m.state === 'warn' && m.aim) {
    // It's about to shoot: a blinking line shows where.
    const d = Math.hypot(m.aim.x - m.x, m.aim.y - m.y) || 1;
    const blink = Math.floor(clock * 10) % 2 === 0;
    g.lineStyle(3, 0xff4a6a, blink ? 0.7 : 0.25);
    for (let k = 30; k < Math.min(d, 260); k += 22) {
      const a = k / d;
      const b = Math.min(1, (k + 10) / d);
      g.lineBetween(
        m.x + (m.aim.x - m.x) * a,
        m.y + (m.aim.y - m.y) * a,
        m.x + (m.aim.x - m.x) * b,
        m.y + (m.aim.y - m.y) * b
      );
    }
  }
}

/** A puffy yellow-green sour candy cloud. It goes dark before it rains. */
function drawSourCloud(g, x, y, col, state, clock) {
  const dark = state === 'warn' || state === 'rain';
  const flicker = state === 'warn' && Math.floor(clock * 10) % 2 === 0;
  const color = dark ? (flicker ? 0x9aa83a : 0x7a8a2a) : 0xd8f06a;
  const bob = Math.sin(clock * 2 + col) * 2;
  g.fillStyle(color, 1);
  g.fillCircle(x + 12, y + 28 + bob, 16);
  g.fillCircle(x + 26, y + 18 + bob, 20);
  g.fillCircle(x + 40, y + 28 + bob, 15);
  g.fillRect(x, y + 28 + bob, TILE, 14);
  g.fillStyle(dark ? 0x4a5a1a : 0x8aa030, 1);
  // A sour little face: squinty eyes and a puckered mouth.
  g.fillRect(x + 15, y + 22 + bob, 6, 2);
  g.fillRect(x + 28, y + 22 + bob, 6, 2);
  g.fillCircle(x + 24, y + 32 + bob, 3);
}

/** Things drawn over the slime: ropes, lollipops, canes, gumballs, rain and caramel strands. */
export function drawCandy(g, candy, clock, slime) {
  const time = candy.time;
  for (const rope of candy.ropes) {
    drawRope(g, rope);
  }
  for (const l of candy.lollipops) {
    drawLollipop(g, l, clock);
  }
  for (const cane of candy.canes) {
    drawCane(g, caneShape(cane, time));
  }
  for (const b of candy.gumballs) {
    g.fillStyle(GUMBALL_COLORS[b.color], 1);
    g.fillCircle(b.x, b.y, GUMBALL_RADIUS);
    g.fillStyle(0xffffff, 0.7);
    g.fillCircle(b.x - 3, b.y - 3, 3);
  }
  for (const c of candy.clouds) {
    if (c.state === 'rain') {
      drawRain(g, c, clock);
    }
  }
  if (candy.caramel > 0 && candy.gluedSlime) {
    drawCaramelStrands(g, candy, clock);
  }
  if (candy.boost > 0 && slime) {
    // A sparkly rainbow glow while the lollipop makes you stretch farther.
    const c = slime.center;
    const pulse = 0.25 + 0.1 * Math.sin(clock * 8);
    g.lineStyle(5, GUMBALL_COLORS[Math.floor(clock * 6) % 4], pulse + 0.3);
    g.strokeCircle(c.x, c.y, 34);
    // How much longer it lasts.
    g.lineStyle(4, 0xffffff, 0.9);
    g.beginPath();
    g.arc(c.x, c.y, 40, -Math.PI / 2, -Math.PI / 2 + (candy.boost / LOLLIPOP_TIME) * Math.PI * 2);
    g.strokePath();
  }
}

/** A twisty red licorice rope. */
function drawRope(g, rope) {
  g.fillStyle(0xc81830, 1);
  g.fillRect(rope.x - 6, rope.top, 12, rope.bottom - rope.top);
  g.lineStyle(3, 0x8a0a1a, 1);
  for (let y = rope.top + 4; y < rope.bottom - 4; y += 12) {
    g.lineBetween(rope.x - 6, y, rope.x + 6, y + 8);
  }
  g.fillStyle(0xff6a7a, 0.6);
  g.fillRect(rope.x - 4, rope.top, 2, rope.bottom - rope.top);
  g.fillStyle(0x8a0a1a, 1);
  g.fillCircle(rope.x, rope.bottom, 7);
}

/** A swirly lollipop. Once licked it slowly grows back. */
function drawLollipop(g, l, clock) {
  let scale = 1;
  let alpha = 1;
  if (l.state === 'gone') {
    scale = Math.max(0, 1 - l.timer / LOLLIPOP_REGROW);
    alpha = 0.35;
  }
  const x = l.x;
  const y = l.y - 4 + Math.sin(clock * 2 + l.col) * 2;
  g.fillStyle(0xffffff, alpha);
  g.fillRect(x - 2, y, 4, 20);
  if (scale <= 0) {
    return;
  }
  const r = 15 * scale;
  g.fillStyle(0xff5a9a, alpha);
  g.fillCircle(x, y, r);
  g.lineStyle(3 * scale, 0xffffff, alpha);
  g.strokeCircle(x, y, r * 0.65);
  g.strokeCircle(x, y, r * 0.3);
  g.fillStyle(0xffffff, 0.6 * alpha);
  g.fillCircle(x - r * 0.4, y - r * 0.4, 3 * scale);
}

/** A red-and-white striped candy cane hanging from its pivot, with a hook at the bottom. */
function drawCane(g, { pivot, tip, angle }) {
  g.fillStyle(0x8a5a3a, 1);
  g.fillCircle(pivot.x, pivot.y, 6);
  const steps = 8;
  for (let i = 0; i < steps; i++) {
    const a = i / steps;
    const b = (i + 1) / steps;
    g.lineStyle(CANE_THICK * 2, i % 2 ? 0xffffff : 0xe8203a, 1);
    g.lineBetween(
      pivot.x + (tip.x - pivot.x) * a,
      pivot.y + (tip.y - pivot.y) * a,
      pivot.x + (tip.x - pivot.x) * b,
      pivot.y + (tip.y - pivot.y) * b
    );
  }
  // The hook curls up at the bottom.
  const side = { x: Math.cos(angle), y: -Math.sin(angle) };
  const hookMid = { x: tip.x + side.x * 12, y: tip.y + side.y * 12 };
  g.lineStyle(CANE_THICK * 2, 0xe8203a, 1);
  g.beginPath();
  g.arc(
    hookMid.x,
    hookMid.y,
    12,
    Math.atan2(-side.y, -side.x),
    Math.atan2(-side.y, -side.x) + Math.PI,
    true
  );
  g.strokePath();
}

/** Sour drops falling from a cloud down to wherever they land. */
function drawRain(g, cloud, clock) {
  const top = (cloud.row + 1) * TILE;
  for (let col = cloud.from; col <= cloud.to; col++) {
    const bottom = cloud.bottoms[col - cloud.from];
    const h = bottom - top;
    g.fillStyle(0xe0ff40, 0.15);
    g.fillRect(col * TILE + 4, top, TILE - 8, h);
    for (let i = 0; i < 6; i++) {
      const x = col * TILE + 6 + hash(col, i) * (TILE - 12);
      const y = top + ((clock * 420 + hash(i, col) * h) % Math.max(1, h));
      g.fillStyle(i % 2 ? 0xc8f040 : 0xffe040, 1);
      g.fillCircle(x, y, 4);
      g.fillTriangle(x - 4, y, x + 4, y, x, y - 9);
    }
  }
}

/** Gooey caramel strands holding the slime's ends, and a ring showing how long it lasts. */
function drawCaramelStrands(g, candy, clock) {
  const slime = candy.gluedSlime;
  for (const e of slime.ends) {
    if (!touchingCaramel(candy.level, e)) {
      continue;
    }
    for (let i = -1; i <= 1; i++) {
      const sway = Math.sin(clock * 6 + i) * 3;
      g.lineStyle(3, 0xd8902e, 0.9);
      g.lineBetween(e.x + i * 8, e.y, e.x + i * 10 + sway, e.y + 18);
      g.lineBetween(e.x + i * 6, e.y - 6, e.x + i * 12 - sway, e.y - 18);
    }
  }
  const c = slime.center;
  const left = candy.caramel / CARAMEL_HOLD;
  g.lineStyle(5, 0xffb040, 0.9);
  g.beginPath();
  g.arc(c.x, c.y - 30, 12, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2);
  g.strokePath();
  g.fillStyle(0xc8781e, 0.9);
  g.fillCircle(c.x, c.y - 30, 6);
}

// ------------------------------------------------------------------ King Claw

/** Wall tiles that turned to ice in King Claw's last phase. */
export function drawIcedWalls(g, boss) {
  for (const t of boss.iced) {
    drawIce(g, t.col * TILE, t.row * TILE);
  }
}

/** King Claw: his head on its wire, his giant claw hands, his bombs, and the boss bar. */
export function drawKingClaw(g, boss, clock, bar) {
  // The track his hands run along.
  g.lineStyle(8, 0x6a3a7a, 1);
  g.lineBetween(boss.minX - 20, TILE + 4, boss.maxX + 20, TILE + 4);
  // A warning shadow where his head is about to fall.
  if (boss.state === 'wobble' || boss.state === 'fall') {
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(boss.x, boss.floorY - 6, HEAD_WIDTH * 1.2, 22);
    g.lineStyle(3, 0xff3030, 0.4 + 0.4 * Math.sin(clock * 20));
    g.strokeEllipse(boss.x, boss.floorY - 6, HEAD_WIDTH * 1.2, 22);
  }
  drawHead(g, boss, clock);
  for (const h of boss.hands) {
    drawHand(g, boss, h, clock);
  }
  for (const b of boss.bombs) {
    const blink = Math.sin(clock * (4 + (1 - b.fuse / BOMB_FUSE) * 16)) > 0.3;
    g.fillStyle(blink ? 0xff5050 : 0x222222, 1);
    g.fillCircle(b.x, b.y, BOMB_RADIUS);
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(b.x - 4, b.y - 4, 3);
    g.lineStyle(3, 0xc8a060, 1);
    g.lineBetween(b.x, b.y - BOMB_RADIUS, b.x + 5, b.y - BOMB_RADIUS - 7);
    g.fillStyle(0xffd040, 1);
    g.fillCircle(b.x + 5, b.y - BOMB_RADIUS - 8, 2 + Math.random() * 2);
  }
  for (const e of boss.explosions) {
    const k = e.age / 0.5;
    g.fillStyle(0xffd040, 1 - k);
    g.fillCircle(e.x, e.y, BLAST_RADIUS * (0.4 + k * 0.6));
    g.fillStyle(0xff5000, (1 - k) * 0.8);
    g.fillCircle(e.x, e.y, BLAST_RADIUS * (0.2 + k * 0.5));
  }
  bar.clear();
  for (let i = 0; i < 3; i++) {
    bar.fillStyle(i < boss.hp ? 0xff5aa8 : 0x4a2238, 1);
    bar.fillRoundedRect(GAME_WIDTH / 2 - 105 + i * 72, 120, 66, 20, 6);
  }
}

/** A big grumpy claw-machine head with a crown, hanging on a wire. */
function drawHead(g, boss, clock) {
  const shake = boss.state === 'wobble' ? Math.sin(clock * 40) * 5 : 0;
  const x = boss.x + shake;
  const y = boss.y;
  const top = y - HEAD_HEIGHT / 2;
  const left = x - HEAD_WIDTH / 2;
  g.lineStyle(4, 0x555a66, 1);
  g.lineBetween(boss.x, 0, x, top);
  // The crown.
  g.fillStyle(0xffd23a, 1);
  g.fillRect(x - 34, top - 14, 68, 16);
  for (let i = 0; i < 4; i++) {
    g.fillTriangle(x - 34 + i * 20, top - 12, x - 22 + i * 20, top - 12, x - 28 + i * 20, top - 24);
  }
  g.fillStyle(0xff3a7a, 1);
  g.fillCircle(x, top - 8, 4);
  // The head: a purple machine box with a glass front.
  g.fillStyle(0x7a3a9a, 1);
  g.fillRoundedRect(left, top, HEAD_WIDTH, HEAD_HEIGHT, 18);
  g.fillStyle(0x9a5aba, 1);
  g.fillRoundedRect(left + 6, top + 6, HEAD_WIDTH - 12, 18, 8);
  // Grumpy eyes (crosses when he's beaten, swirly when he's dizzy on the floor).
  const down = boss.state === 'down' || boss.defeated;
  for (const side of [-1, 1]) {
    const ex = x + side * 28;
    const ey = top + 38;
    g.fillStyle(0xffffff, 1);
    g.fillCircle(ex, ey, 13);
    if (boss.defeated) {
      g.lineStyle(4, 0x222222, 1);
      g.lineBetween(ex - 7, ey - 7, ex + 7, ey + 7);
      g.lineBetween(ex - 7, ey + 7, ex + 7, ey - 7);
    } else if (down) {
      g.lineStyle(3, 0x222222, 1);
      g.strokeCircle(ex, ey, 7);
      g.strokeCircle(ex, ey, 3);
    } else {
      g.fillStyle(0x222222, 1);
      g.fillCircle(ex, ey + 4, 6);
      // Angry eyebrows.
      g.lineStyle(5, 0x2a1030, 1);
      g.lineBetween(ex - 14, ey - 16 - side * 4, ex + 14, ey - 16 + side * 4);
    }
  }
  // The mouth: wide open while he's down (shoot in here!), chomping, or a grumpy frown.
  const mouth = boss.mouth;
  const open = down && !boss.defeated ? 1 : boss.chomp > 0 ? Math.abs(Math.sin(clock * 20)) : 0;
  const mw = 64;
  const mh = 8 + open * 30;
  const my = mouth.y;
  g.fillStyle(0x2a0a1a, 1);
  g.fillRoundedRect(x - mw / 2, my - mh / 2 + 6, mw, mh, Math.min(10, mh / 2));
  if (open > 0.2) {
    g.fillStyle(0xff6a8a, 1);
    g.fillEllipse(x, my + mh / 2, mw * 0.6, mh * 0.35);
    g.fillStyle(0xffffff, 1);
    for (let i = 0; i < 4; i++) {
      const tx = x - mw / 2 + 8 + i * 16;
      g.fillTriangle(tx - 5, my - mh / 2 + 6, tx + 5, my - mh / 2 + 6, tx, my - mh / 2 + 14);
    }
    if (down && !boss.defeated) {
      // A pulsing ring shows where to aim.
      g.lineStyle(3, 0x7dff7a, 0.5 + 0.4 * Math.sin(clock * 10));
      g.strokeCircle(mouth.x, mouth.y, 30);
    }
  }
}

/** One of King Claw's hands: a giant version of a mean crane claw (red base). */
function drawHand(g, boss, h, clock) {
  if (h.state === 'eaten') {
    return;
  }
  const shake = h.state === 'warn' ? Math.sin(clock * 45) * 4 : 0;
  const x = h.x + shake;
  const y = h.y;
  const railY = TILE + 4;
  g.fillStyle(0xdd3333, 1);
  g.fillRoundedRect(h.x - 22, railY - 8, 44, 18, 4);
  g.lineStyle(4, 0x777777, 1);
  g.lineBetween(h.x, railY + 10, x, y - HAND_RADIUS * 0.6);
  g.fillStyle(0x8c96a3, 1);
  g.fillRoundedRect(x - 26, y - HAND_RADIUS * 0.7, 52, 18, 5);
  g.fillStyle(0xdd3333, 1);
  g.fillCircle(x, y - HAND_RADIUS * 0.7 + 9, 5);
  // The prongs: wide open while hunting, shut tight while carrying you.
  const open = h.state === 'carry' ? 6 : h.state === 'stuck' ? 14 : 22;
  g.lineStyle(9, 0x8c96a3, 1);
  for (const side of [-1, 1]) {
    const sx = x + side * 18;
    const mx = x + side * (18 + open);
    g.lineBetween(sx, y - HAND_RADIUS * 0.2, mx, y + HAND_RADIUS * 0.4);
    g.lineBetween(mx, y + HAND_RADIUS * 0.4, x + side * 6, y + HAND_RADIUS);
  }
  if (h.state === 'stuck') {
    // Dizzy stars spinning round: lick it now!
    for (let i = 0; i < 3; i++) {
      const a = clock * 5 + (i * Math.PI * 2) / 3;
      const sx = x + Math.cos(a) * 26;
      const sy = y - HAND_RADIUS - 6 + Math.sin(a) * 8;
      g.fillStyle(0xffe040, 1);
      g.fillTriangle(sx - 5, sy + 3, sx + 5, sy + 3, sx, sy - 6);
      g.fillTriangle(sx - 5, sy - 2, sx + 5, sy - 2, sx, sy + 7);
    }
  }
}
