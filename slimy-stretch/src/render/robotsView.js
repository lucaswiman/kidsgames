import { GAME_WIDTH, TILE } from '../logic/constants.js';
import { TileKind } from '../logic/level.js';
import { drawBox } from './theme.js';
import {
  ARM_REACH,
  BOLT_RADIUS,
  PATROL_CONE,
  PATROL_SEE,
  searchlightAngle,
  searchlightEye,
  SPARK_HALF,
} from '../logic/robots.js';
import { BOXER_HEIGHT, BOXER_WIDTH, FIST_RADIUS } from '../logic/boxerBoss.js';
import { MEGA_HEIGHT, MEGA_WIDTH } from '../logic/megaSlime.js';

// Drawing for the Robot Factory: robot arms, welding torches and their
// sparks, patrol robots and their searchlights, alarm doors, sniper robots,
// spring pads, pneumatic tubes, lifts and robot helpers, Boxer Bot, and the
// giant Mega Slime.

const ORANGE = 0xff8a1a;
const DARK = 0x2a323c;
const RED = 0xff3030;

// A tiny repeatable random number so things don't jump around between frames.
function hash(a, b) {
  const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/** Robot factory tiles that change: alarm doors slamming shut and sliding open. */
export function drawRobotsTiles(g, robots, clock) {
  const flash = robots.alarm > 0 && Math.floor(clock * 4) % 2 === 0;
  for (const d of robots.doors) {
    const x = d.col * TILE;
    const y = d.row * TILE;
    // The door frame is always there.
    g.fillStyle(DARK, 1);
    g.fillRect(x, y, 6, TILE);
    g.fillRect(x + TILE - 6, y, 6, TILE);
    if (!d.shut) {
      g.fillStyle(0xffd23a, 0.5);
      g.fillRect(x + 6, y, TILE - 12, 3);
      continue;
    }
    // Slammed shut: a heavy steel shutter with warning stripes.
    g.fillStyle(0x6a7480, 1);
    g.fillRect(x + 6, y, TILE - 12, TILE);
    for (let i = 0; i < 4; i++) {
      g.fillStyle(i % 2 ? 0x1e1e22 : 0xffd23a, 1);
      g.fillRect(x + 6, y + i * 12 + 4, TILE - 12, 5);
    }
    g.fillStyle(flash ? RED : 0x7a1a1a, 1);
    g.fillCircle(x + TILE / 2, y + TILE / 2, 5);
  }
}

/** Robot factory things the slime goes in front of. */
export function drawRobotsBehind(g, robots, clock) {
  drawPanelLights(g, robots, clock);
  for (const tube of robots.tubes) {
    drawTube(g, tube, clock);
  }
  for (const lift of robots.lifts) {
    drawLift(g, lift);
  }
  for (const s of robots.springs) {
    drawSpring(g, s);
  }
  for (const t of robots.torches) {
    drawTorch(g, t, clock);
  }
  for (const p of robots.patrols) {
    if (!p.broken) {
      drawSearchlight(g, robots, p);
    }
  }
}

/** Little lights blinking on the control panels in the background. */
function drawPanelLights(g, robots, clock) {
  const level = robots.level;
  const colors = [0x3affa0, 0xffd23a, 0xff5a3a, 0x5ad2ff];
  for (let row = 1; row < level.height - 1; row += 3) {
    for (let col = 1; col < level.width - 1; col += 4) {
      if (level.tiles[row][col] !== TileKind.EMPTY || hash(col, row) < 0.6) {
        continue;
      }
      const x = (col + 0.5) * TILE;
      const y = (row + 0.5) * TILE;
      for (let i = 0; i < 3; i++) {
        const on = Math.sin(clock * (1.5 + hash(col + i, row) * 3) + i * 2) > 0.2;
        g.fillStyle(colors[(col + row + i) % 4], on ? 0.75 : 0.15);
        g.fillCircle(x - 10 + i * 10, y, 3);
      }
    }
  }
}

/** A pneumatic tube: a glass pipe along its path, with a funnel at each end. */
function drawTube(g, tube, clock) {
  const pts = tube.path;
  const glow = tube.glow > 0 ? tube.glow / 0.6 : 0;
  for (const [width, color, alpha] of [
    [26, 0x3a4a58, 0.9],
    [18, 0x9ad8ff, 0.35 + glow * 0.4],
    [4, 0xffffff, 0.35],
  ]) {
    g.lineStyle(width, color, alpha);
    for (let k = 0; k < pts.length - 1; k++) {
      g.lineBetween(pts[k].x, pts[k].y, pts[k + 1].x, pts[k + 1].y);
    }
    for (const p of pts) {
      g.fillStyle(color, alpha);
      g.fillCircle(p.x, p.y, width / 2);
    }
  }
  // Puffs of air whooshing along inside.
  let total = 0;
  for (let k = 0; k < pts.length - 1; k++) {
    total += Math.hypot(pts[k + 1].x - pts[k].x, pts[k + 1].y - pts[k].y);
  }
  g.fillStyle(0xffffff, 0.5);
  for (let i = 0; i < Math.floor(total / 60); i++) {
    const p = pointOnPath(pts, (clock * 140 + i * 60) % total);
    if (p) {
      g.fillCircle(p.x, p.y, 3);
    }
  }
  // A metal funnel at each end; it glows when the tube is ready.
  for (const p of [pts[0], pts[pts.length - 1]]) {
    g.fillStyle(0x5a6674, 1);
    g.fillCircle(p.x, p.y, 20);
    g.fillStyle(0x1a2028, 1);
    g.fillCircle(p.x, p.y, 13);
    g.lineStyle(3, tube.used ? 0x666666 : 0x5ad2ff, 0.6 + 0.3 * Math.sin(clock * 5));
    g.strokeCircle(p.x, p.y, 17);
  }
}

/** The point `along` pixels down a path of points. */
function pointOnPath(points, along) {
  let left = along;
  for (let i = 0; i < points.length - 1; i++) {
    const d = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
    if (left <= d) {
      const t = d === 0 ? 0 : left / d;
      return {
        x: points[i].x + (points[i + 1].x - points[i].x) * t,
        y: points[i].y + (points[i + 1].y - points[i].y) * t,
      };
    }
    left -= d;
  }
  return null;
}

/** A factory lift: a striped platform hanging on cables from the top of its shaft. */
function drawLift(g, lift) {
  const w = lift.width * TILE;
  const top = Math.min(lift.from.y, lift.to.y) - TILE;
  g.lineStyle(3, 0x2a2a2a, 1);
  g.lineBetween(lift.x + 8, top, lift.x + 8, lift.y);
  g.lineBetween(lift.x + w - 8, top, lift.x + w - 8, lift.y);
  g.fillStyle(0x5a6674, 1);
  g.fillRect(lift.x, lift.y, w, 16);
  for (let i = 0; i < w / 12; i++) {
    g.fillStyle(i % 2 ? 0x1e1e22 : 0xffd23a, 1);
    g.fillRect(lift.x + i * 12, lift.y, 12, 6);
  }
  g.fillStyle(0x3a4250, 1);
  g.fillRect(lift.x + 4, lift.y + 16, w - 8, 8);
}

/** A spring pad: a plate on a big coil, pointing the way it launches you. */
function drawSpring(g, s) {
  const ux = Math.cos(s.angle);
  const uy = Math.sin(s.angle);
  const nx = -uy;
  const ny = ux;
  // The base sits on whatever is behind it.
  const base = { x: s.x - ux * 18, y: s.y - uy * 18 };
  const stretch = s.flash > 0 ? 34 : 18;
  const top = { x: base.x + ux * stretch, y: base.y + uy * stretch };
  g.fillStyle(DARK, 1);
  g.fillCircle(base.x, base.y, 10);
  g.lineStyle(4, 0xd0d6de, 1);
  const turns = 5;
  let prev = base;
  for (let i = 1; i <= turns * 2; i++) {
    const t = i / (turns * 2);
    const side = i % 2 ? 12 : -12;
    const p = {
      x: base.x + (top.x - base.x) * t + nx * side,
      y: base.y + (top.y - base.y) * t + ny * side,
    };
    g.lineBetween(prev.x, prev.y, p.x, p.y);
    prev = p;
  }
  g.lineStyle(8, ORANGE, 1);
  g.lineBetween(top.x - nx * 18, top.y - ny * 18, top.x + nx * 18, top.y + ny * 18);
  // An arrow shows which way it goes.
  g.fillStyle(0xffffff, s.cooldown > 0 ? 0.25 : 0.7);
  const tip = { x: top.x + ux * 16, y: top.y + uy * 16 };
  g.fillTriangle(
    tip.x,
    tip.y,
    top.x + ux * 6 + nx * 7,
    top.y + uy * 6 + ny * 7,
    top.x + ux * 6 - nx * 7,
    top.y + uy * 6 - ny * 7
  );
}

/** A welding torch under the ceiling; it glows before it showers sparks. */
function drawTorch(g, t, clock) {
  const x = t.x;
  const y = (t.row + 1) * TILE;
  g.fillStyle(0x4a5260, 1);
  g.fillRect(x - 10, y - 4, 20, 10);
  g.fillStyle(0x7a8494, 1);
  g.fillTriangle(x - 8, y + 6, x + 8, y + 6, x, y + 18);
  if (t.state === 'warn') {
    const pulse = 0.5 + 0.5 * Math.sin(clock * 30);
    g.fillStyle(0xffa020, 0.4 + 0.4 * pulse);
    g.fillCircle(x, y + 18, 9 + pulse * 4);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(x, y + 18, 3);
  } else if (t.state === 'shower') {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(x, y + 18, 5);
  }
}

/** A patrol robot's searchlight: a cone of light (red while the alarm is going). */
function drawSearchlight(g, robots, p) {
  const eye = searchlightEye(p);
  const angle = searchlightAngle(p, robots.time);
  const color = robots.alarm > 0 ? RED : 0xfff6a0;
  const steps = 8;
  const pts = [eye];
  for (let i = 0; i <= steps; i++) {
    const a = angle - PATROL_CONE + (2 * PATROL_CONE * i) / steps;
    // The light stops at the first wall.
    let len = PATROL_SEE;
    for (let d = 12; d < PATROL_SEE; d += 12) {
      const col = Math.floor((eye.x + Math.cos(a) * d) / TILE);
      const row = Math.floor((eye.y + Math.sin(a) * d) / TILE);
      const kind = robots.level.tiles[row] && robots.level.tiles[row][col];
      if (kind === undefined || (kind !== TileKind.EMPTY && kind !== TileKind.LAVA)) {
        len = d;
        break;
      }
    }
    pts.push({ x: eye.x + Math.cos(a) * len, y: eye.y + Math.sin(a) * len });
  }
  g.fillStyle(color, 0.22);
  g.fillPoints(pts, true);
}

/** Robot factory things drawn over the slime. */
export function drawRobotsOver(g, robots, clock) {
  for (const h of robots.helpers) {
    drawHelper(g, h, clock);
  }
  robots.arms.forEach((arm, i) => drawArm(g, arm, robots.inArm === i, clock));
  for (const t of robots.torches) {
    if (t.state === 'shower') {
      drawSparks(g, t, clock);
    }
  }
  for (const p of robots.patrols) {
    drawPatrol(g, robots, p, clock);
  }
  for (const s of robots.snipers) {
    drawSniper(g, s, clock);
  }
  for (const b of robots.bolts) {
    const len = Math.hypot(b.vx, b.vy) || 1;
    const tx = b.x - (b.vx / len) * 22;
    const ty = b.y - (b.vy / len) * 22;
    g.lineStyle(BOLT_RADIUS * 2, RED, 0.5);
    g.lineBetween(tx, ty, b.x, b.y);
    g.lineStyle(4, 0xffd0d0, 1);
    g.lineBetween(tx, ty, b.x, b.y);
  }
}

/** A friendly robot helper: a smiley screen face on two little legs. */
function drawHelper(g, h, clock) {
  const x = h.x + TILE / 2;
  const y = h.y;
  const moving = h.pause <= 0;
  const step = moving ? Math.sin(clock * 12) * 4 : 0;
  // Legs
  g.lineStyle(5, 0x5a6674, 1);
  g.lineBetween(x - 9, y + 30, x - 9 + step, y + TILE - 2);
  g.lineBetween(x + 9, y + 30, x + 9 - step, y + TILE - 2);
  // The top is flat, for riding on.
  g.fillStyle(0xe8eef4, 1);
  g.fillRoundedRect(x - 22, y, 44, 32, 8);
  g.fillStyle(0x3ab0a0, 1);
  g.fillRect(x - 22, y, 44, 6);
  g.fillStyle(0x10303a, 1);
  g.fillRoundedRect(x - 15, y + 9, 30, 17, 4);
  g.fillStyle(0x5affd0, 1);
  const look = h.dir > 0 ? 2 : -2;
  g.fillCircle(x - 6 + look, y + 15, 2.5);
  g.fillCircle(x + 6 + look, y + 15, 2.5);
  g.lineStyle(2, 0x5affd0, 1);
  g.beginPath();
  g.arc(x + look, y + 18, 5, 0.3, Math.PI - 0.3);
  g.strokePath();
}

/** A robot arm: an orange arm on a base, with a claw that grabs. */
function drawArm(g, arm, holding, clock) {
  const n = arm.normal;
  const base = { x: arm.x - n.x * 16, y: arm.y - n.y * 16 };
  g.fillStyle(DARK, 1);
  g.fillRoundedRect(base.x - 16, base.y - 16, 32, 32, 6);
  // A warning light blinks while it winds up.
  const warn = arm.state === 'windup' && Math.floor(clock * 10) % 2 === 0;
  g.fillStyle(arm.broken ? 0x333333 : warn ? RED : 0x7a3a1a, 1);
  g.fillCircle(base.x, base.y, 5);
  if (arm.broken) {
    // Smashed: a bent, grey heap.
    g.lineStyle(10, 0x6a6a6a, 1);
    g.lineBetween(arm.x, arm.y, arm.x + 18, arm.y + 10);
    return;
  }
  const c = arm.claw;
  const dx = c.x - arm.x;
  const dy = c.y - arm.y;
  const d = Math.hypot(dx, dy) || 1;
  // The elbow bends out to the side, more when the arm is folded up.
  const bend = Math.max(0, (ARM_REACH - d) * 0.35);
  const elbow = { x: arm.x + dx / 2 - (dy / d) * bend, y: arm.y + dy / 2 + (dx / d) * bend };
  g.lineStyle(12, ORANGE, 1);
  g.lineBetween(arm.x, arm.y, elbow.x, elbow.y);
  g.lineBetween(elbow.x, elbow.y, c.x, c.y);
  g.fillStyle(0x5a6674, 1);
  g.fillCircle(arm.x, arm.y, 9);
  g.fillCircle(elbow.x, elbow.y, 7);
  // The claw: two pincers, open until it's holding something.
  const open = holding ? 0.25 : arm.state === 'lunge' ? 0.9 : 0.6;
  const ang = Math.atan2(dy, dx);
  g.lineStyle(6, 0x4a5260, 1);
  for (const side of [-1, 1]) {
    const a = ang + side * open;
    const mid = { x: c.x + Math.cos(a) * 12, y: c.y + Math.sin(a) * 12 };
    const tip = { x: mid.x + Math.cos(ang) * 10, y: mid.y + Math.sin(ang) * 10 };
    g.lineBetween(c.x, c.y, mid.x, mid.y);
    g.lineBetween(mid.x, mid.y, tip.x, tip.y);
  }
  g.fillStyle(0x7a8494, 1);
  g.fillCircle(c.x, c.y, 6);
}

/** A shower of welding sparks falling straight down. */
function drawSparks(g, t, clock) {
  const top = (t.row + 1) * TILE + 18;
  const height = Math.max(1, t.bottom - top);
  g.fillStyle(0xffa020, 0.15);
  g.fillRect(t.x - SPARK_HALF, top, SPARK_HALF * 2, height);
  for (let i = 0; i < 26; i++) {
    const fall = (clock * (420 + hash(i, t.col) * 260) + hash(t.col, i) * height) % height;
    const sx = t.x + (hash(i, t.row) - 0.5) * SPARK_HALF * 2 * Math.min(1, fall / 60);
    g.fillStyle(i % 3 ? 0xffe066 : 0xffffff, 1);
    g.fillCircle(sx, top + fall, i % 4 ? 2 : 3);
  }
  // Splashing where they land.
  g.fillStyle(0xffd040, 0.8);
  for (let i = 0; i < 5; i++) {
    const a = Math.PI + hash(i, Math.floor(clock * 20)) * Math.PI;
    g.fillCircle(t.x + Math.cos(a) * 14, t.bottom + Math.sin(a) * 8, 2);
  }
}

/** A patrol robot: a round security robot on wheels with a lamp for a head. */
function drawPatrol(g, robots, p, clock) {
  const x = p.x;
  const y = p.y;
  if (p.broken) {
    g.fillStyle(0x5a5a5a, 1);
    g.fillEllipse(x, y + 16, 40, 14);
    g.fillStyle(0x3a3a3a, 1);
    g.fillCircle(x + 8, y + 10, 6);
    return;
  }
  g.fillStyle(0x2a2a2a, 1);
  g.fillCircle(x - 10, y + 19, 5);
  g.fillCircle(x + 10, y + 19, 5);
  g.fillStyle(0x3a5a8a, 1);
  g.fillRoundedRect(x - 16, y - 6, 32, 24, 8);
  g.fillStyle(0xe8eef4, 1);
  g.fillRect(x - 16, y + 4, 32, 4);
  // The lamp head, and a red beacon that spins during an alarm.
  g.fillStyle(0x5a6674, 1);
  g.fillCircle(x, y - 10, 10);
  const eye = searchlightEye(p);
  g.fillStyle(robots.alarm > 0 ? RED : 0xfff6a0, 1);
  g.fillCircle(eye.x, eye.y, 5);
  if (robots.alarm > 0) {
    const on = Math.floor(clock * 6) % 2 === 0;
    g.fillStyle(on ? RED : 0x7a1a1a, 1);
    g.fillRect(x - 4, y - 24, 8, 6);
  }
}

/** A sniper robot: a turret with a long barrel, its red dot, and its aiming laser. */
function drawSniper(g, s, clock) {
  if (s.broken) {
    g.fillStyle(0x5a5a5a, 1);
    g.fillCircle(s.x, s.y + 8, 12);
    return;
  }
  const target = s.dot || { x: s.x + Math.cos(clock) * 40, y: s.y + 20 };
  const ang = Math.atan2(target.y - s.y, target.x - s.x);
  if (s.dot) {
    // A thin red aiming laser...
    g.lineStyle(1.5, RED, s.state === 'lock' ? 0.8 : 0.35);
    g.lineBetween(s.x, s.y, s.dot.x, s.dot.y);
    // ...and the red dot, blinking fast once it's locked on.
    const blink = s.state === 'lock' ? Math.floor(clock * 20) % 2 === 0 : true;
    if (blink) {
      g.fillStyle(RED, 0.35);
      g.fillCircle(s.dot.x, s.dot.y, 10);
      g.fillStyle(RED, 1);
      g.fillCircle(s.dot.x, s.dot.y, 4);
    }
  }
  g.lineStyle(7, 0x3a3a44, 1);
  g.lineBetween(s.x, s.y, s.x + Math.cos(ang) * 26, s.y + Math.sin(ang) * 26);
  g.fillStyle(0x5a5a66, 1);
  g.fillCircle(s.x, s.y, 14);
  g.fillStyle(DARK, 1);
  g.fillRect(s.x - 16, s.y + 10, 32, 10);
  g.fillStyle(s.state === 'idle' ? 0x7a1a1a : RED, 1);
  g.fillCircle(s.x + Math.cos(ang) * 6, s.y + Math.sin(ang) * 6, 4);
}

// ------------------------------------------------------------------- Boxer Bot

/** Boxer Bot (or the crate he left behind), and the boss bar. */
export function drawBoxer(g, boss, clock, bar) {
  if (boss.crate && !boss.crate.eaten) {
    const c = boss.crate;
    drawBox(g, c.x - TILE / 2, c.y - TILE / 2);
    g.fillStyle(0x00f0ff, 0.5 + 0.3 * Math.sin(clock * 5));
    g.fillCircle(c.x, c.y, 8);
  }
  if (!boss.defeated) {
    if (boss.state === 'box') {
      drawSleepingBox(g, boss, clock);
    } else {
      drawBoxerBody(g, boss, clock);
    }
  }
  bar.clear();
  for (let i = 0; i < 3; i++) {
    bar.fillStyle(i < boss.hp ? ORANGE : 0x4a2a14, 1);
    bar.fillRoundedRect(GAME_WIDTH / 2 - 105 + i * 72, 120, 66, 20, 6);
  }
}

/** Asleep, he's just a giant metal box (with a little "zzz"). */
function drawSleepingBox(g, boss, clock) {
  const b = boss.body;
  drawBox(g, b.left, b.top, BOXER_WIDTH);
  const z = (clock * 0.8) % 1;
  g.lineStyle(3, 0xffffff, 0.6 * (1 - z));
  const zx = b.right - 6 + z * 14;
  const zy = b.top - 6 - z * 26;
  g.lineBetween(zx, zy, zx + 8, zy);
  g.lineBetween(zx + 8, zy, zx, zy + 8);
  g.lineBetween(zx, zy + 8, zx + 8, zy + 8);
}

/** Awake: the box grows legs, arms with boxing gloves, and an angry face. */
function drawBoxerBody(g, boss, clock) {
  const b = boss.body;
  const legH = 24;
  const size = BOXER_HEIGHT - legH; // the box itself, on top of its legs
  const bodyBottom = b.bottom - legH;
  const walk = boss.state === 'walk' ? Math.sin(clock * 10) * 5 : 0;
  const shake = boss.state === 'squeeze' ? Math.sin(clock * 50) * 3 : 0;
  // Legs and big feet.
  g.lineStyle(10, 0x4a5260, 1);
  g.lineBetween(boss.x - 22, bodyBottom, boss.x - 22 + walk, b.bottom - 6);
  g.lineBetween(boss.x + 22, bodyBottom, boss.x + 22 - walk, b.bottom - 6);
  g.fillStyle(DARK, 1);
  g.fillRoundedRect(boss.x - 36 + walk, b.bottom - 10, 26, 10, 4);
  g.fillRoundedRect(boss.x + 10 - walk, b.bottom - 10, 26, 10, 4);
  // The box body.
  const top = b.top + shake;
  const left = boss.x - size / 2 + shake;
  drawBox(g, left, top, size);
  if (boss.state === 'hurt' && Math.floor(clock * 16) % 2 === 0) {
    g.fillStyle(0xffffff, 0.7);
    g.fillRect(left, top, size, size);
  }
  // The face: angry eyes (dizzy spirals while stunned) and a grill mouth.
  const fx = boss.x + boss.facing * 6 + shake;
  const fy = top + 24;
  g.fillStyle(DARK, 1);
  g.fillRoundedRect(fx - 26, fy - 13, 52, 44, 8);
  if (boss.state === 'stunned') {
    g.lineStyle(3, 0xffe066, 1);
    for (const side of [-1, 1]) {
      g.beginPath();
      g.arc(fx + side * 13, fy, 7, clock * 8, clock * 8 + Math.PI * 1.5);
      g.strokePath();
    }
  } else {
    g.fillStyle(boss.state === 'windup' || boss.state === 'squeezeWarn' ? RED : 0xffa020, 1);
    for (const side of [-1, 1]) {
      g.fillTriangle(fx + side * 4, fy - 6, fx + side * 20, fy - 2, fx + side * 18, fy + 6);
    }
  }
  g.fillStyle(0x7a8494, 1);
  for (let i = 0; i < 5; i++) {
    g.fillRect(fx - 19 + i * 8, fy + 16, 5, 10);
  }
  // Stars spinning over his head while he's dizzy.
  if (boss.state === 'stunned') {
    for (let i = 0; i < 4; i++) {
      const a = clock * 4 + (i * Math.PI) / 2;
      g.fillStyle(0xffe066, 1);
      g.fillCircle(boss.x + Math.cos(a) * 34, top - 14 + Math.sin(a) * 8, 5);
    }
  }
  drawBoxerArms(g, boss, clock, top, size);
}

/** His arms and boxing gloves (glowing when they're invincible). */
function drawBoxerArms(g, boss, clock, top, size) {
  const glowing = boss.invincible;
  const glove = glowing ? 0xfff0a0 : 0xe02a2a;
  const shoulderY = boss.floorY - BOXER_HEIGHT * 0.6;
  const spread = boss.state === 'squeezeWarn';
  const hug = boss.state === 'squeeze';
  for (const side of [-1, 1]) {
    const sx = boss.x + (side * size) / 2;
    const punching = side === boss.facing && ['windup', 'punch', 'retract'].includes(boss.state);
    let hand;
    if (punching) {
      hand = boss.fist;
    } else if (spread) {
      // Arms open wide: he's about to squeeze!
      const wave = Math.sin(clock * 20) * 4;
      hand = { x: sx + side * 46, y: top - 6 + wave };
    } else if (hug) {
      hand = {
        x: boss.x + boss.squeezeSide * (BOXER_WIDTH / 2 + 10),
        y: shoulderY - 14 + side * 10,
      };
    } else {
      // Guard up, like a boxer.
      const bob = Math.sin(clock * 6 + side) * 3;
      hand = { x: sx + side * 14, y: shoulderY - 16 + bob };
    }
    g.lineStyle(9, 0x5a6674, 1);
    g.lineBetween(sx, shoulderY, hand.x, hand.y);
    if (glowing) {
      g.fillStyle(0xfff0a0, 0.35 + 0.2 * Math.sin(clock * 12));
      g.fillCircle(hand.x, hand.y, FIST_RADIUS + 9);
    }
    g.fillStyle(glove, 1);
    g.fillCircle(hand.x, hand.y, FIST_RADIUS);
    g.fillStyle(0xffffff, 0.45);
    g.fillCircle(hand.x - 5, hand.y - 6, 5);
  }
}

// ------------------------------------------------------------------ Mega Slime

/** The giant Mega Slime: a big green slime person with the slime's cute eyes. */
export function drawMegaSlime(g, mega, clock) {
  g.clear();
  if (!mega.active) {
    return;
  }
  // It blinks in its last 3 seconds, so you know it's wearing off.
  if (mega.timeLeft < 3 && Math.floor(clock * 8) % 2 === 0) {
    g.setAlpha(0.5);
  } else {
    g.setAlpha(1);
  }
  const x = mega.x;
  const feet = mega.y;
  const s = 1.2; // drawn a little bigger than it bumps into things
  const h = MEGA_HEIGHT * s;
  const w = MEGA_WIDTH * s;
  const walking = mega.vx !== 0 && mega.onGround;
  const swing = walking ? Math.sin(mega.walkTime * 12) : 0;
  const body = 0x55e05a;
  const outline = 0x1f8f35;
  // A soft glow: nothing can hurt it.
  g.fillStyle(0xb0ffb0, 0.15 + 0.06 * Math.sin(clock * 6));
  g.fillEllipse(x, feet - h / 2, w * 2.2, h * 1.25);
  const hipY = feet - h * 0.36;
  const shoulderY = feet - h * 0.72;
  // Legs
  g.lineStyle(16, outline, 0.9);
  for (const side of [-1, 1]) {
    g.lineBetween(x + side * 9, hipY, x + side * 9 + swing * side * 10, feet - 6);
  }
  g.lineStyle(12, body, 1);
  for (const side of [-1, 1]) {
    g.lineBetween(x + side * 9, hipY, x + side * 9 + swing * side * 10, feet - 6);
  }
  // The gooey body.
  g.fillStyle(body, 0.8);
  g.lineStyle(3, outline, 0.9);
  g.fillEllipse(x, feet - h * 0.55, w, h * 0.5);
  g.strokeEllipse(x, feet - h * 0.55, w, h * 0.5);
  // Arms, swinging as it walks (or raised up, jumping).
  const up = !mega.onGround;
  for (const side of [-1, 1]) {
    const hand = up
      ? { x: x + side * (w * 0.75), y: shoulderY - 26 }
      : { x: x + side * (w * 0.62), y: shoulderY + 30 - swing * side * 10 };
    g.lineStyle(13, outline, 0.9);
    g.lineBetween(x + side * w * 0.38, shoulderY, hand.x, hand.y);
    g.lineStyle(9, body, 1);
    g.lineBetween(x + side * w * 0.38, shoulderY, hand.x, hand.y);
    g.fillStyle(body, 1);
    g.fillCircle(hand.x, hand.y, 8);
  }
  // A big round head with the slime's eyes, looking the way it's going.
  const headY = feet - h * 0.86;
  g.fillStyle(body, 0.85);
  g.lineStyle(3, outline, 0.9);
  g.fillCircle(x, headY, w * 0.42);
  g.strokeCircle(x, headY, w * 0.42);
  g.fillStyle(0xffffff, 0.45);
  g.fillEllipse(x - 8, headY - 12, 14, 8);
  const look = mega.facing * 3;
  for (const side of [-1, 1]) {
    const ex = x + side * 9 + look;
    const ey = headY - 2;
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(ex, ey, 13, 16);
    g.fillStyle(0x102010, 1);
    g.fillCircle(ex + look * 0.8, ey + 1, 4);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(ex + look * 0.8 - 1.2, ey - 0.5, 1.4);
  }
  // A big happy grin.
  g.lineStyle(3, 0x103818, 1);
  g.beginPath();
  g.arc(x + look, headY + 7, 8, 0.2, Math.PI - 0.2);
  g.strokePath();
}
