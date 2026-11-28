import { END_RADIUS, TILE } from '../logic/constants.js';
import { TileKind } from '../logic/level.js';
import { vineTip } from '../logic/jungle.js';
import { BOARD_GONE, paintingLook, touchingWeb } from '../logic/haunted.js';

// Drawing for the Haunted House: creaky floorboards, bouncy four-poster
// beds, spider webs, spooky paintings with eyes that follow you, haunted
// furniture, secret bookcases, dumbwaiters and chandeliers.

const BOOK_COLORS = [0x8a2a3a, 0x2a5a8a, 0x3a7a3a, 0x9a7a2a, 0x6a3a8a, 0x2a6a6a];

// A tiny repeatable random number so things don't jump around between frames.
function hash(a, b) {
  const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/** Haunted tiles that change or watch you (they're redrawn every frame). */
export function drawHauntedTiles(g, haunted, clock) {
  const level = haunted.level;
  for (const b of haunted.boards) {
    drawFloorboard(g, b, haunted.boardShake(b), clock);
  }
  // Each run of bed tiles side by side is one big bed.
  level.tiles.forEach((row, r) => {
    let from = null;
    row.forEach((kind, c) => {
      if (kind === TileKind.BED && from === null) {
        from = c;
      }
      if (from !== null && (kind !== TileKind.BED || c === row.length - 1)) {
        const to = kind === TileKind.BED ? c : c - 1;
        drawBed(g, from * TILE, r * TILE, (to - from + 1) * TILE);
        from = null;
      }
    });
  });
  for (const web of haunted.webs) {
    drawWeb(g, web, clock);
  }
  for (const p of haunted.paintings) {
    drawPainting(g, p, paintingLook(p, haunted.lookAt));
  }
}

/**
 * A creaky floorboard: wooden planks with nails. It rattles and drops dust
 * while it creaks, and once it's gone there's just a faint outline until it
 * comes back.
 */
function drawFloorboard(g, b, shake, clock) {
  const x = b.col * TILE;
  const y = b.row * TILE;
  if (b.state === 'gone') {
    // Fading back in, just before it returns.
    const back = Math.max(0, 1 - b.timer / 0.6);
    g.lineStyle(2, 0x8a5a34, 0.25 + back * 0.5);
    g.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
    if (b.timer < BOARD_GONE - 0.4) {
      return;
    }
    // Bits of wood falling away.
    const k = (BOARD_GONE - b.timer) / 0.4;
    g.fillStyle(0x8a5a34, 1 - k);
    for (let i = 0; i < 4; i++) {
      g.fillRect(x + 6 + i * 10, y + 8 + k * 40 + i * 5, 8, 5);
    }
    return;
  }
  const dx = shake > 0 ? Math.sin(clock * 50 + b.col) * 2.5 * (0.4 + shake) : 0;
  g.fillStyle(0x5a3a22, 1);
  g.fillRect(x + dx, y, TILE, TILE);
  for (let i = 0; i < 3; i++) {
    const py = y + i * 16;
    g.fillStyle(i === 0 ? 0xa06a3c : 0x8a5a34, 1);
    g.fillRect(x + dx + 1, py + 1, TILE - 2, 14);
    g.fillStyle(0x4a2e1a, 1);
    g.fillRect(x + dx + 6 + hash(b.col, i) * 30, py + 6, 10, 2);
    g.fillStyle(0xc8c0b0, 1);
    g.fillCircle(x + dx + 5, py + 8, 1.5);
    g.fillCircle(x + dx + TILE - 5, py + 8, 1.5);
  }
  if (shake > 0) {
    // Cracking...
    g.lineStyle(2, 0x2a1a10, 1);
    g.lineBetween(x + dx + 14, y + 2, x + dx + 22, y + 18 * shake + 6);
    g.lineBetween(x + dx + 34, y + 30, x + dx + 28, y + 30 + 16 * shake);
    // ...and dust falling out of the bottom.
    g.fillStyle(0xc8b8a0, 0.7);
    for (let i = 0; i < 3; i++) {
      const t = (clock * 2 + i / 3) % 1;
      g.fillCircle(x + 10 + i * 14, y + TILE + t * 30, 2);
    }
  }
}

/** A bouncy old four-poster bed, with a fluffy pillow and a purple blanket. */
function drawBed(g, x, y, width) {
  // The posts, with round knobs on top.
  g.fillStyle(0x4a2e1e, 1);
  g.fillRect(x + 2, y - 30, 7, TILE + 30);
  g.fillRect(x + width - 9, y - 30, 7, TILE + 30);
  g.fillStyle(0xc8a040, 1);
  g.fillCircle(x + 5.5, y - 32, 5);
  g.fillCircle(x + width - 5.5, y - 32, 5);
  // A thin canopy draped between the posts.
  g.lineStyle(3, 0x9a6ab8, 0.8);
  g.beginPath();
  g.moveTo(x + 5, y - 26);
  for (let i = 1; i <= 8; i++) {
    const t = i / 8;
    g.lineTo(x + 5 + (width - 10) * t, y - 26 + Math.sin(t * Math.PI) * 8);
  }
  g.strokePath();
  // Frame, mattress, blanket and pillow.
  g.fillStyle(0x6a4428, 1);
  g.fillRect(x + 2, y + 26, width - 4, 14);
  g.fillStyle(0xf0ecf4, 1);
  g.fillRoundedRect(x + 6, y + 8, width - 12, 20, 6);
  g.fillStyle(0x6a3a8a, 1);
  g.fillRoundedRect(x + width * 0.38, y + 10, width * 0.62 - 6, 18, 5);
  g.fillStyle(0x8a5aa8, 1);
  for (let px = x + width * 0.38 + 8; px < x + width - 12; px += 14) {
    g.fillCircle(px, y + 19, 3);
  }
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(x + 10, y + 6, Math.min(26, width * 0.3), 12, 6);
  g.fillStyle(0x4a2e1e, 1);
  g.fillRect(x + 6, y + 40, 6, 8);
  g.fillRect(x + width - 12, y + 40, 6, 8);
}

/** A big round spider web, with a little spider bobbing on its thread. */
function drawWeb(g, web, clock) {
  const cx = web.x;
  const cy = web.y;
  const spokes = 8;
  const r = TILE * 0.62;
  g.lineStyle(1.5, 0xf0eef8, 0.7);
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2 + 0.2;
    g.lineBetween(cx, cy, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  for (const k of [0.25, 0.5, 0.75, 1]) {
    g.beginPath();
    for (let i = 0; i <= spokes; i++) {
      const a = (i / spokes) * Math.PI * 2 + 0.2;
      // The rings sag a little between the spokes.
      const rr = r * k * (i % 2 ? 0.92 : 1);
      if (i === 0) {
        g.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      } else {
        g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
    }
    g.strokePath();
  }
  // A friendly little spider.
  const sy = cy - 6 + Math.sin(clock * 1.7 + web.col) * 8;
  g.lineStyle(1, 0xf0eef8, 0.7);
  g.lineBetween(cx + 10, cy - r, cx + 10, sy);
  g.lineStyle(1.5, 0x111111, 1);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      g.lineBetween(cx + 10, sy, cx + 10 + side * 7, sy - 3 + i * 3);
    }
  }
  g.fillStyle(0x111111, 1);
  g.fillCircle(cx + 10, sy, 4);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(cx + 8.5, sy - 1, 1.2);
  g.fillCircle(cx + 11.5, sy - 1, 1.2);
}

/**
 * A spooky (but friendly) portrait in a golden frame: a lady, a gentleman
 * in a top hat or a black cat. Its eyes follow you around.
 */
function drawPainting(g, p, look) {
  const x = p.col * TILE;
  const y = p.row * TILE;
  g.fillStyle(0x8a6a20, 1);
  g.fillRect(x + 3, y + 1, TILE - 6, TILE - 2);
  g.fillStyle(0xd8b048, 1);
  g.fillRect(x + 5, y + 3, TILE - 10, TILE - 6);
  g.fillStyle(0x2a2a3e, 1);
  g.fillRect(x + 9, y + 7, TILE - 18, TILE - 14);
  const cx = x + TILE / 2;
  const kind = (p.col * 7 + p.row * 3) % 3;
  let eyeY = y + 21;
  if (kind === 0) {
    // A lady with her hair up in a big purple bun.
    g.fillStyle(0x5a2a6a, 1);
    g.fillCircle(cx, y + 13, 8);
    g.fillEllipse(cx, y + 21, 22, 20);
    g.fillStyle(0xe8d0c8, 1);
    g.fillEllipse(cx, y + 24, 14, 17);
    g.fillStyle(0x6a3a8a, 1);
    g.fillRect(x + 12, y + 33, TILE - 24, 8);
    eyeY = y + 22;
  } else if (kind === 1) {
    // A gentleman in a tall black hat, with a curly mustache.
    g.fillStyle(0xd8d8c8, 1);
    g.fillEllipse(cx, y + 26, 15, 18);
    g.fillStyle(0x111118, 1);
    g.fillRect(cx - 7, y + 8, 14, 10);
    g.fillRect(cx - 10, y + 17, 20, 3);
    g.fillRect(x + 12, y + 35, TILE - 24, 6);
    g.fillStyle(0x3a2a1a, 1);
    g.fillEllipse(cx - 3, y + 30, 6, 2.5);
    g.fillEllipse(cx + 3, y + 30, 6, 2.5);
    eyeY = y + 24;
  } else {
    // A black cat with pointy ears.
    g.fillStyle(0x15151c, 1);
    g.fillTriangle(cx - 10, y + 16, cx - 4, y + 16, cx - 9, y + 8);
    g.fillTriangle(cx + 10, y + 16, cx + 4, y + 16, cx + 9, y + 8);
    g.fillEllipse(cx, y + 24, 22, 18);
    g.fillEllipse(cx, y + 38, 26, 10);
    eyeY = y + 23;
  }
  // The eyes, watching you.
  const eyeColor = kind === 2 ? 0xc8f04a : 0xffffff;
  for (const side of [-1, 1]) {
    const ex = cx + side * 4;
    g.fillStyle(eyeColor, 1);
    g.fillEllipse(ex, eyeY, 6, 5);
    g.fillStyle(0x111111, 1);
    g.fillCircle(ex + look.x * 0.6, eyeY + look.y * 0.5, 1.6);
  }
  if (kind !== 2) {
    g.lineStyle(1.5, 0x8a3a3a, 1);
    g.lineBetween(cx - 2, eyeY + 8, cx + 2, eyeY + 8);
  }
}

/**
 * Haunted things the slime goes in front of: dumbwaiters in their shafts,
 * furniture, secret bookcases and chandeliers.
 */
export function drawHauntedBehind(g, haunted, jungle, sky, clock) {
  for (const box of sky.islands) {
    if (box.dumbwaiter) {
      drawDumbwaiter(g, box);
    }
  }
  for (const f of haunted.furniture) {
    drawFurniture(g, f, clock);
  }
  for (const pair of haunted.bookcases) {
    drawBookcase(g, pair.a, pair.spinA);
    drawBookcase(g, pair.b, pair.spinB);
  }
  jungle.vines.forEach((vine, i) => {
    if (vine.chandelier) {
      drawChandelier(g, vine, jungle.onVine === i, i, clock);
    }
  });
}

/** A little wooden box on ropes, in a dark shaft inside the wall. */
function drawDumbwaiter(g, box) {
  const w = box.width * TILE;
  const top = Math.min(box.from.y, box.to.y);
  const bottom = Math.max(box.from.y, box.to.y) + TILE;
  g.fillStyle(0x140c1c, 0.85);
  g.fillRect(box.x + 2, top, w - 4, bottom - top);
  g.lineStyle(3, 0x4a3020, 1);
  g.lineBetween(box.x + 3, top, box.x + 3, bottom);
  g.lineBetween(box.x + w - 3, top, box.x + w - 3, bottom);
  // The pulley at the top, and the ropes down to the box.
  g.fillStyle(0x8a8a90, 1);
  g.fillCircle(box.x + w / 2, top + 6, 6);
  g.lineStyle(2, 0xc8b080, 1);
  g.lineBetween(box.x + w / 2 - 5, top + 6, box.x + 8, box.y);
  g.lineBetween(box.x + w / 2 + 5, top + 6, box.x + w - 8, box.y);
  // The box: wooden planks with an open front.
  g.fillStyle(0x7a5232, 1);
  g.fillRect(box.x + 4, box.y, w - 8, TILE);
  g.fillStyle(0xa87448, 1);
  g.fillRect(box.x + 4, box.y, w - 8, 5);
  g.fillStyle(0x2a1a14, 1);
  g.fillRect(box.x + 10, box.y + 12, w - 20, TILE - 20);
  g.lineStyle(2, 0x4a3020, 1);
  g.strokeRect(box.x + 4, box.y, w - 8, TILE);
}

/** A piece of haunted furniture. While it moves it rattles, and spooky eyes open on it. */
function drawFurniture(g, f, clock) {
  const shake = f.moving ? Math.sin(clock * 35) * 1.5 : 0;
  const x = f.x + shake;
  const y = f.y;
  const w = f.w * TILE;
  const h = f.h * TILE;
  if (f.moving) {
    // A ghostly green glow.
    g.fillStyle(0x7affb0, 0.12);
    g.fillRoundedRect(x - 5, y - 5, w + 10, h + 10, 10);
  }
  if (f.kind === 'chair') {
    // A big comfy armchair.
    g.fillStyle(0x3a2216, 1);
    g.fillRect(x + 6, y + 40, 5, 8);
    g.fillRect(x + w - 11, y + 40, 5, 8);
    g.fillStyle(0x7a1e3a, 1);
    g.fillRoundedRect(x + 6, y + 1, w - 12, 30, 8);
    g.fillStyle(0x9a2e4e, 1);
    g.fillRoundedRect(x + 2, y + 22, w - 4, 20, 6);
    g.fillRoundedRect(x, y + 14, 9, 26, 4);
    g.fillRoundedRect(x + w - 9, y + 14, 9, 26, 4);
    g.fillStyle(0xd8b048, 1);
    g.fillCircle(x + w / 2 - 8, y + 12, 2);
    g.fillCircle(x + w / 2 + 8, y + 12, 2);
  } else if (f.kind === 'table') {
    // A dining table with a lacy tablecloth.
    g.fillStyle(0x4a2e1e, 1);
    g.fillRect(x + 8, y + 12, 7, h - 12);
    g.fillRect(x + w - 15, y + 12, 7, h - 12);
    g.fillStyle(0x6a4428, 1);
    g.fillRect(x, y + 2, w, 12);
    g.fillStyle(0xe8e0f0, 0.9);
    g.fillRect(x + 4, y + 2, w - 8, 18);
    for (let sx = x + 10; sx < x + w - 6; sx += 12) {
      g.fillCircle(sx, y + 20, 5);
    }
    g.fillStyle(0x8a5a34, 1);
    g.fillRect(x, y, w, 4);
  } else {
    // A tall wardrobe with two doors.
    g.fillStyle(0x5a3a26, 1);
    g.fillRect(x + 2, y + 6, w - 4, h - 10);
    g.fillStyle(0x7a5232, 1);
    g.fillRect(x, y, w, 8);
    g.fillRect(x + 4, y + h - 6, 6, 6);
    g.fillRect(x + w - 10, y + h - 6, 6, 6);
    g.lineStyle(2, 0x3a2416, 1);
    g.strokeRect(x + 6, y + 12, w / 2 - 7, h - 24);
    g.strokeRect(x + w / 2 + 1, y + 12, w / 2 - 7, h - 24);
    g.fillStyle(0xd8b048, 1);
    g.fillCircle(x + w / 2 - 4, y + h / 2, 2.5);
    g.fillCircle(x + w / 2 + 4, y + h / 2, 2.5);
  }
  if (f.moving) {
    // Somebody's in there! (Just a friendly ghost, peeking out.)
    const ex = x + w / 2;
    const ey = f.kind === 'wardrobe' ? y + 30 : y + 10;
    const blink = Math.floor(clock * 3) % 5 === 0;
    g.fillStyle(0xb8ffd0, 1);
    for (const side of [-1, 1]) {
      if (blink) {
        g.fillRect(ex + side * 7 - 3, ey, 6, 1.5);
      } else {
        g.fillEllipse(ex + side * 7, ey, 6, 8);
      }
    }
  }
}

/**
 * A secret bookcase, standing on the floor at `p` (the middle of its bottom
 * tile). `spin` goes from 1 to 0 while it spins around.
 */
function drawBookcase(g, p, spin) {
  const sx = Math.cos(spin * Math.PI);
  const w = (TILE - 4) * Math.max(0.08, Math.abs(sx));
  const h = 2 * TILE - 4;
  const left = p.x - w / 2;
  const top = p.y + TILE / 2 - h;
  g.fillStyle(0x5a3622, 1);
  g.fillRect(left, top, w, h);
  if (sx < 0) {
    // The plain back of the bookcase, halfway through spinning.
    g.fillStyle(0x3a2416, 1);
    g.fillRect(left + 3, top + 3, w - 6, h - 6);
    return;
  }
  g.fillStyle(0x7a4e30, 1);
  g.fillRect(left, top, w, 6);
  for (let shelf = 0; shelf < 4; shelf++) {
    const sy = top + 8 + shelf * 21;
    g.fillStyle(0x2a1a12, 1);
    g.fillRect(left + 3, sy, w - 6, 18);
    // Books of all sizes and colors.
    let bx = left + 4;
    let k = 0;
    while (bx < left + w - 6) {
      const bw = (4 + hash(p.x + k, shelf) * 4) * Math.abs(sx);
      const bh = 12 + hash(k, p.y + shelf) * 6;
      g.fillStyle(BOOK_COLORS[Math.floor(hash(p.x + shelf, k) * BOOK_COLORS.length)], 1);
      g.fillRect(bx, sy + 18 - bh, Math.max(1, bw - 1), bh);
      bx += bw;
      k++;
    }
    g.fillStyle(0x7a4e30, 1);
    g.fillRect(left, sy + 18, w, 3);
  }
}

/** A chandelier with candles, hanging on a chain from the ceiling. */
function drawChandelier(g, vine, riding, i, clock) {
  // An empty chandelier sways a little, like it's haunted.
  const sway = riding ? 0 : Math.sin(clock * 1.1 + i) * 0.04;
  const angle = vine.angle + sway;
  const tip = vineTip(vine, angle);
  // The chain: little links all the way down.
  const links = Math.max(2, Math.round(vine.length / 9));
  g.lineStyle(2, 0xb8963a, 1);
  g.lineBetween(vine.x, vine.y, tip.x, tip.y - 6);
  g.fillStyle(0xd8b048, 1);
  for (let k = 0; k <= links; k++) {
    const t = k / links;
    g.fillCircle(vine.x + (tip.x - vine.x) * t, vine.y + (tip.y - 6 - vine.y) * t, 2);
  }
  g.fillStyle(0x8a6a20, 1);
  g.fillRect(vine.x - 8, vine.y, 16, 4);
  // The brass arms tilt with the swing; the candles stay upright.
  const across = { x: Math.cos(angle), y: -Math.sin(angle) };
  const up = { x: -Math.sin(angle), y: -Math.cos(angle) };
  const at = (lx, ly) => ({
    x: tip.x + across.x * lx + up.x * ly,
    y: tip.y + across.y * lx + up.y * ly,
  });
  g.lineStyle(4, 0xc8a040, 1);
  let prev = null;
  for (let k = -2; k <= 2; k++) {
    const p = at(k * 12, 4 + Math.abs(k) * 3);
    if (prev) {
      g.lineBetween(prev.x, prev.y, p.x, p.y);
    }
    prev = p;
  }
  const stemTop = at(0, 18);
  g.lineBetween(tip.x, tip.y, stemTop.x, stemTop.y);
  g.fillStyle(0xd8b048, 1);
  g.fillCircle(tip.x, tip.y, 5);
  for (let k = -2; k <= 2; k++) {
    const cup = at(k * 12, 4 + Math.abs(k) * 3);
    g.fillStyle(0xd8b048, 1);
    g.fillEllipse(cup.x, cup.y, 9, 4);
    g.fillStyle(0xf4ecd8, 1);
    g.fillRect(cup.x - 2, cup.y - 11, 4, 10);
    const flicker = Math.sin(clock * 12 + k * 1.7 + i) * 1.2;
    g.fillStyle(0xffa030, 0.9);
    g.fillEllipse(cup.x, cup.y - 15, 5, 8 + flicker);
    g.fillStyle(0xfff0a0, 1);
    g.fillEllipse(cup.x, cup.y - 14, 2.5, 4);
  }
  // A warm glow.
  g.fillStyle(0xffd080, 0.08);
  g.fillCircle(tip.x, tip.y - 8, 40);
}

/** Things drawn over the slime: the sticky strands of a web holding it. */
export function drawHauntedOver(g, haunted, slime) {
  if (haunted.web <= 0 || haunted.webbedSlime !== slime) {
    return;
  }
  const alpha = 0.35 + 0.55 * haunted.webHold;
  g.lineStyle(1.5, 0xffffff, alpha);
  for (const e of slime.ends) {
    if (!touchingWeb(haunted.level, e)) {
      continue;
    }
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + 0.3;
      const r = END_RADIUS + 10;
      g.lineBetween(
        e.x + Math.cos(a) * 4,
        e.y + Math.sin(a) * 4,
        e.x + Math.cos(a) * r,
        e.y + Math.sin(a) * r
      );
    }
  }
}
