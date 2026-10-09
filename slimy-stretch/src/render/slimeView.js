import { END_RADIUS, MAX_STRETCH } from '../logic/constants.js';

const BODY = 0x55e05a;
const OUTLINE = 0x1f8f35;
const SHINE = 0xffffff;

/**
 * Draws the see-through green slime with cute eyes. The body is fat at the
 * two ends and gets thinner in the middle the more it stretches.
 */
export class SlimeView {
  constructor(scene) {
    this.g = scene.add.graphics().setDepth(10);
    this.blinkTimer = 2 + Math.random() * 2;
    this.blinking = 0;
    this.wobble = 0;
  }

  draw(slime, dt, lookAt) {
    const g = this.g;
    g.clear();
    this.wobble += dt;
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinking = 0.12;
      this.blinkTimer = 2 + Math.random() * 3;
    }
    this.blinking = Math.max(0, this.blinking - dt);

    const [a, b] = slime.ends;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const t = Math.min(1, len / MAX_STRETCH);
    const endR = END_RADIUS + 5 - t * 2;

    const outline = this.bodyOutline(a, b, len, endR, t);
    g.fillStyle(BODY, 0.62);
    g.lineStyle(3, OUTLINE, 0.9);
    g.fillPoints(outline, true);
    g.strokePoints(outline, true);

    // Little bubbles floating inside the goo.
    g.fillStyle(SHINE, 0.25);
    for (let i = 0; i < 3; i++) {
      const s = (i + 1) / 4;
      const bx = a.x + (b.x - a.x) * s + Math.sin(this.wobble * 2 + i * 2) * 4;
      const by = a.y + (b.y - a.y) * s + Math.cos(this.wobble * 1.7 + i) * 4;
      g.fillCircle(bx, by, 2 + i);
    }

    // Shine on each end.
    for (const e of [a, b]) {
      g.fillStyle(SHINE, 0.45);
      g.fillEllipse(e.x - endR * 0.35, e.y - endR * 0.45, endR * 0.6, endR * 0.35);
    }

    this.drawEyes(slime.ends[slime.lead], lookAt);
  }

  /** A smooth outline around both ends and the stretchy neck between them. */
  bodyOutline(a, b, len, endR, t) {
    const pts = [];
    if (len < 2) {
      // Resting blob: a little wider than tall, and it jiggles.
      const sq = 1 + Math.sin(this.wobble * 4) * 0.04;
      for (let i = 0; i < 24; i++) {
        const ang = (i / 24) * Math.PI * 2;
        pts.push({
          x: a.x + Math.cos(ang) * (endR + 5) * sq,
          y: a.y + (Math.sin(ang) * (endR + 1)) / sq,
        });
      }
      return pts;
    }
    const ux = (b.x - a.x) / len;
    const uy = (b.y - a.y) / len;
    const nx = -uy;
    const ny = ux;
    const neck = Math.max(4, endR * (1 - t * 0.7));
    const steps = 14;
    const left = [];
    const right = [];
    for (let i = 0; i <= steps; i++) {
      const s = i / steps;
      // Fat near the ends, thin in the middle.
      const bulge = Math.abs(2 * s - 1) ** 3;
      const w = neck + (endR - neck) * bulge;
      const px = a.x + (b.x - a.x) * s;
      const py = a.y + (b.y - a.y) * s;
      left.push({ x: px + nx * w, y: py + ny * w });
      right.push({ x: px - nx * w, y: py - ny * w });
    }
    // Cap around end b, back along the other side, then cap around end a.
    pts.push(...left);
    for (let i = 1; i < 12; i++) {
      const ang = Math.atan2(ny, nx) - (i / 12) * Math.PI;
      pts.push({ x: b.x + Math.cos(ang) * endR, y: b.y + Math.sin(ang) * endR });
    }
    pts.push(...right.reverse());
    for (let i = 1; i < 12; i++) {
      const ang = Math.atan2(-ny, -nx) - (i / 12) * Math.PI;
      pts.push({ x: a.x + Math.cos(ang) * endR, y: a.y + Math.sin(ang) * endR });
    }
    return pts;
  }

  drawEyes(end, lookAt) {
    const g = this.g;
    let lx = lookAt ? lookAt.x - end.x : 0;
    let ly = lookAt ? lookAt.y - end.y : 1;
    const ll = Math.hypot(lx, ly) || 1;
    lx /= ll;
    ly /= ll;
    for (const side of [-1, 1]) {
      const ex = end.x + side * 7;
      const ey = end.y - 4;
      if (this.blinking > 0) {
        g.lineStyle(2, 0x103818, 1);
        g.lineBetween(ex - 4, ey, ex + 4, ey);
        continue;
      }
      g.fillStyle(0xffffff, 1);
      g.fillEllipse(ex, ey, 11, 13);
      g.fillStyle(0x102010, 1);
      g.fillCircle(ex + lx * 2.2, ey + ly * 2.5, 3.2);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(ex + lx * 2.2 - 1, ey + ly * 2.5 - 1.2, 1.1);
    }
  }

  clear() {
    this.g.clear();
  }
}
