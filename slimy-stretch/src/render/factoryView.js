import { GAME_WIDTH, TILE } from '../logic/constants.js';
import { PRESS_HEAD, SAW_RADIUS, ventState } from '../logic/factory.js';
import {
  BUTTON_RADIUS,
  CRATE_SIZE,
  CRUSHER_HEIGHT,
  CRUSHER_WIDTH,
  EXPLOSION_RADIUS,
  FIREBALL_RADIUS,
} from '../logic/bigMachine.js';
import { drawBox, drawLift } from './theme.js';

// Drawing for the Factory: presses, saws, steam, slime machines, and the big
// machine boss.

export function drawFactory(g, factory, clock) {
  // Steam vents puff (and fizz a little just before they do).
  for (const v of factory.vents) {
    const state = ventState(v, factory.time);
    const top = v.row * TILE;
    if (state === 'on') {
      for (let i = 0; i < 7; i++) {
        const k = (clock * 3 + i / 7) % 1;
        g.fillStyle(0xffffff, 0.55 * (1 - k));
        g.fillCircle(v.x + Math.sin(clock * 9 + i) * 10, top - k * 3 * TILE, 12 + k * 14);
      }
    } else if (state === 'warn') {
      g.fillStyle(0xffffff, 0.35);
      g.fillCircle(v.x + Math.sin(clock * 30) * 4, top - 8, 7);
    }
  }
  // Stamping presses: a piston down from the ceiling with a heavy head.
  for (const p of factory.presses) {
    const head = factory.pressHead(p);
    const shake = p.state === 'warn' ? (Math.random() - 0.5) * 4 : 0;
    g.fillStyle(0x9aa3ad, 1);
    g.fillRect(p.col * TILE + 18 + shake, p.top, 12, head.bottom - PRESS_HEAD - p.top);
    g.fillStyle(0x3a414d, 1);
    g.fillRect(head.left + shake, head.bottom - PRESS_HEAD, head.right - head.left, PRESS_HEAD);
    for (let i = 0; i < 4; i++) {
      g.fillStyle(i % 2 ? 0x1e1e22 : 0xff8a1a, 1);
      g.fillRect(head.left + shake + i * 11, head.bottom - 8, 11, 8);
    }
  }
  // Saw blades spin as they roll.
  for (const s of factory.saws) {
    g.fillStyle(0xc8ced6, 1);
    const pts = [];
    for (let i = 0; i < 16; i++) {
      const a = s.spin + (i * Math.PI) / 8;
      const r = i % 2 ? SAW_RADIUS - 6 : SAW_RADIUS;
      pts.push({ x: s.x + Math.cos(a) * r, y: s.y + Math.sin(a) * r });
    }
    g.fillPoints(pts, true);
    g.fillStyle(0x6e7580, 1);
    g.fillCircle(s.x, s.y, 6);
  }
  // Slime machines glow green while they have a blob in them, and their
  // platforms are drawn wherever they are.
  for (const m of factory.slimeMachines) {
    if (m.powered) {
      g.fillStyle(0x55e05a, 0.35 + 0.15 * Math.sin(clock * 6));
      g.fillCircle(m.x, m.y, 30);
      g.fillStyle(0x55e05a, 0.9);
      g.fillCircle(m.x, m.y, 8);
    }
    const p = m.platform;
    drawLift(g, p.x, p.y, p.width * TILE);
  }
}

export function drawBigMachine(g, boss, clock, bar) {
  const mouth = boss.mouth;
  const mx = mouth.x;
  const my = mouth.y;
  // A big angry face on the machine, around its mouth.
  const faceX = mx + TILE * 1.5;
  g.fillStyle(0x2a2d33, 1);
  g.fillRoundedRect(mx - TILE * 0.5, my - TILE * 2.6, TILE * 3.4, TILE * 3.1, 14);
  const angry = boss.phase > 1;
  for (const side of [-1, 1]) {
    const ex = faceX + side * 34;
    const ey = my - TILE * 1.7;
    g.fillStyle(0xffffff, 1);
    g.fillCircle(ex, ey, 14);
    g.fillStyle(angry ? 0xff3030 : 0xffa020, 1);
    g.fillCircle(ex - 4, ey + 2, 7);
    g.lineStyle(5, 0x111111, 1);
    g.lineBetween(
      ex - 16,
      ey - 18 + side * (angry ? 6 : 0),
      ex + 16,
      ey - 18 - side * (angry ? 6 : 0)
    );
  }
  // The mouth: open (with the belt going in), or slammed shut.
  if (boss.mouthOpen) {
    g.fillStyle(0x110808, 1);
    g.fillRect(mx - TILE * 0.5, my - TILE * 0.5, TILE, TILE);
    g.fillStyle(0xff6a1a, 0.4 + 0.2 * Math.sin(clock * 8));
    g.fillRect(mx - TILE * 0.3, my - TILE * 0.2, TILE * 0.6, TILE * 0.5);
    g.fillStyle(0xe0e4ea, 1);
    for (let i = 0; i < 4; i++) {
      g.fillTriangle(
        mx - 24 + i * 12,
        my - 24,
        mx - 12 + i * 12,
        my - 24,
        mx - 18 + i * 12,
        my - 12
      );
    }
  } else {
    g.fillStyle(0x6e7580, 1);
    g.fillRect(mx - TILE * 0.5, my - TILE * 0.5, TILE, TILE);
    g.lineStyle(4, 0x111111, 1);
    g.lineBetween(mx - TILE * 0.5, my, mx + TILE * 0.5, my);
    // Smoke puffing out after the bomb went off inside.
    g.fillStyle(0x777777, 0.5);
    g.fillCircle(mx - 10, my - 30 - ((clock * 40) % 30), 10);
  }
  // The big button on top: lit up (and pulsing) while you can press it.
  const b = boss.button;
  const ready = !boss.mouthOpen;
  g.fillStyle(0x3a414d, 1);
  g.fillRect(b.x - BUTTON_RADIUS - 4, b.y + 6, (BUTTON_RADIUS + 4) * 2, 12);
  g.fillStyle(ready ? 0xff2a2a : 0x7a2a2a, 1);
  const pulse = ready ? 2 + Math.sin(clock * 12) * 2 : 0;
  g.fillEllipse(b.x, b.y + 6, BUTTON_RADIUS * 2 + pulse, 20 + pulse);
  if (ready) {
    g.lineStyle(3, 0xffffff, 0.7);
    g.strokeEllipse(b.x, b.y + 6, BUTTON_RADIUS * 2 + 10 + pulse * 2, 30 + pulse * 2);
  }
  // Boxes on the belt.
  for (const c of boss.crates) {
    const x = c.x - CRATE_SIZE / 2;
    const y = c.y - CRATE_SIZE / 2;
    if (c.kind === 'ice') {
      g.fillStyle(0x9feaff, 1);
      g.fillRect(x, y, CRATE_SIZE, CRATE_SIZE);
      g.lineStyle(2, 0xffffff, 0.9);
      g.lineBetween(x + 8, y + 26, x + 22, y + 8);
    } else {
      drawBox(g, x, y, CRATE_SIZE);
      g.fillStyle(0xff3030, 1);
      g.fillCircle(c.x, c.y, 6 + (Math.sin(clock * 10) > 0 ? 1 : 0));
    }
  }
  // Crushers over the belt.
  for (const c of boss.crushers) {
    if (boss.phase < c.fromPhase) {
      continue;
    }
    const shake = c.state === 'warn' ? (Math.random() - 0.5) * 4 : 0;
    g.fillStyle(0x9aa3ad, 1);
    g.fillRect(c.x - 6 + shake, 0, 12, c.y);
    g.fillStyle(0x3a414d, 1);
    g.fillRect(c.x - CRUSHER_WIDTH / 2 + shake, c.y, CRUSHER_WIDTH, CRUSHER_HEIGHT);
    for (let i = 0; i < 6; i++) {
      g.fillStyle(i % 2 ? 0x1e1e22 : 0xff8a1a, 1);
      g.fillRect(
        c.x - CRUSHER_WIDTH / 2 + shake + (i * CRUSHER_WIDTH) / 6,
        c.y + CRUSHER_HEIGHT - 8,
        CRUSHER_WIDTH / 6,
        8
      );
    }
  }
  for (const f of boss.fireballs) {
    g.fillStyle(0xff5a00, 0.5);
    g.fillCircle(f.x - f.vx * 0.03, f.y - f.vy * 0.03, FIREBALL_RADIUS * 0.8);
    g.fillStyle(0xffb020, 1);
    g.fillCircle(f.x, f.y, FIREBALL_RADIUS);
    g.fillStyle(0xfff0a0, 1);
    g.fillCircle(f.x, f.y, FIREBALL_RADIUS * 0.45);
  }
  for (const e of boss.explosions) {
    const k = e.age / 0.5;
    g.fillStyle(0xffd040, 1 - k);
    g.fillCircle(e.x, e.y, EXPLOSION_RADIUS * (0.4 + k * 0.6));
    g.fillStyle(0xff5000, (1 - k) * 0.8);
    g.fillCircle(e.x, e.y, EXPLOSION_RADIUS * (0.2 + k * 0.5));
  }
  bar.clear();
  for (let i = 0; i < 3; i++) {
    bar.fillStyle(i < boss.hp ? 0xff8a1a : 0x442a1a, 1);
    bar.fillRoundedRect(GAME_WIDTH / 2 - 105 + i * 72, 120, 66, 20, 6);
  }
}
