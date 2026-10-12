import { END_RADIUS, GRAVITY, MAX_FALL_SPEED, TILE } from './constants.js';
import { circleHitsDeadly, circleHitsSolid, dist, pointSegmentDist } from './collision.js';
import { TileKind } from './level.js';

// Things that first show up in the Cave: falling stalactites, bats, mining
// machines (with a pickaxe that hurts and smashes metal boxes) and mine carts.

export const STALACTITE_SHAKE = 0.5; // seconds of wobbling before it drops
export const STALACTITE_REGROW = 6;
const STALACTITE_RADIUS = 12;
const STALACTITE_SIGHT = 9 * TILE; // how far below it notices the slime

export const PICK_LENGTH = 80; // from the machine's top to the pickaxe head
export const PICK_RADIUS = 18;
const PICK_PERIOD = 2.4; // seconds for one swing there and back
const PICK_SWING = 1.25; // radians either side of straight up

export const CART_RIDE_SPEED = 260;
const CART_PUSH_SPEED = 200;

/** Where a machine's pickaxe is at `time`. */
export function pickaxe(machine, time) {
  const pivot = { x: machine.x, y: machine.row * TILE + 8 };
  const angle =
    -Math.PI / 2 + Math.sin((time * 2 * Math.PI) / PICK_PERIOD + (machine.phase || 0)) * PICK_SWING;
  return {
    pivot,
    angle,
    head: {
      x: pivot.x + Math.cos(angle) * PICK_LENGTH,
      y: pivot.y + Math.sin(angle) * PICK_LENGTH,
    },
  };
}

/** Where a bat is at `time` (they just flutter around their roost). */
export function batPosition(bat, i, time) {
  return {
    x: bat.x + Math.sin(time * 0.9 + i * 1.7) * 70,
    y: bat.y + Math.sin(time * 2.3 + i) * 22,
    flap: Math.sin(time * 18 + i) > 0,
  };
}

export class CaveStuff {
  constructor(level, canyon) {
    this.level = level;
    this.canyon = canyon; // for smashing metal boxes
    this.stalactites = level.stalactites.map(s => ({
      ...s,
      homeY: s.row * TILE + 16,
      y: s.row * TILE + 16,
      vy: 0,
      state: 'hanging',
      timer: 0,
    }));
    this.machines = level.machines.map((m, i) => ({ ...m, phase: i * 1.3 }));
    this.carts = level.carts.map(c => ({
      ...c,
      x: (c.col + 0.5) * TILE,
      state: 'idle',
      armed: true,
      dir: 1,
      target: c.col,
    }));
    this.time = 0;
    this.events = [];
  }

  /**
   * Advance everything. Returns 'stalactite' or 'pickaxe' if the slime got
   * hurt, otherwise null.
   */
  update(dt, slime) {
    this.time += dt;
    const hurt = this.updateStalactites(dt, slime) || this.updateMachines(slime);
    this.updateCarts(dt, slime);
    return hurt;
  }

  updateStalactites(dt, slime) {
    const pts = slime.bodyPoints(10);
    let hurt = null;
    for (const s of this.stalactites) {
      if (s.state === 'hanging') {
        const below = pts.some(
          p => Math.abs(p.x - s.x) < 34 && p.y > s.y && p.y - s.y < STALACTITE_SIGHT
        );
        if (below && !slime.isFalling) {
          this.knockDown(s);
        }
      } else if (s.state === 'shaking') {
        s.timer -= dt;
        if (s.timer <= 0) {
          s.state = 'falling';
          s.vy = 0;
        }
      } else if (s.state === 'falling') {
        s.vy = Math.min(MAX_FALL_SPEED, s.vy + GRAVITY * dt);
        const steps = Math.max(1, Math.ceil((s.vy * dt) / 4));
        for (let i = 0; i < steps && s.state === 'falling'; i++) {
          s.y += (s.vy * dt) / steps;
          const p = { x: s.x, y: s.y };
          if (pts.some(q => dist(q, p) < STALACTITE_RADIUS + END_RADIUS * 0.6)) {
            hurt = 'stalactite';
          }
          if (
            circleHitsSolid(this.level, p, STALACTITE_RADIUS) ||
            circleHitsDeadly(this.level, p, STALACTITE_RADIUS) ||
            s.y > this.level.pixelHeight
          ) {
            s.state = 'gone';
            s.timer = STALACTITE_REGROW;
            this.events.push({ type: 'shatter', x: s.x, y: s.y });
          }
        }
      } else if (s.state === 'gone') {
        s.timer -= dt;
        if (s.timer <= 0) {
          s.state = 'hanging';
          s.y = s.homeY;
        }
      }
    }
    return hurt;
  }

  /** Make a hanging stalactite wobble and fall (also used by slime shots). */
  knockDown(s) {
    if (s.state === 'hanging') {
      s.state = 'shaking';
      s.timer = STALACTITE_SHAKE;
      this.events.push({ type: 'crack', x: s.x, y: s.y });
    }
  }

  updateMachines(slime) {
    let hurt = null;
    const pts = slime.bodyPoints(8);
    for (const m of this.machines) {
      const { pivot, head } = pickaxe(m, this.time);
      const hit =
        pts.some(p => dist(p, head) < PICK_RADIUS + END_RADIUS * 0.6) ||
        pts.some(p => pointSegmentDist(p, pivot, head) < 5 + END_RADIUS * 0.4);
      if (hit && !slime.isFalling) {
        hurt = 'pickaxe';
      }
      // Smash any metal box the pickaxe head bumps into.
      if (this.canyon) {
        this.canyon.boxes.forEach((box, i) => {
          if (!box.eaten && circleTouchesTile(head, PICK_RADIUS, box.col, box.row)) {
            this.canyon.smashBox(i, slime);
            this.events.push({ type: 'smash', box: i, x: box.x, y: box.y });
          }
        });
      }
    }
    return hurt;
  }

  updateCarts(dt, slime) {
    const tiles = this.level.tiles;
    for (const cart of this.carts) {
      const top = cart.row * TILE;
      if (cart.state === 'idle') {
        const nearTop = slime.ends.some(
          e => Math.abs(e.x - cart.x) < TILE / 2 + 4 && e.y < top && e.y > top - END_RADIUS - 10
        );
        // Ride once something lands on top; re-arm after you've left the cart.
        if (!nearTop) {
          cart.armed = true;
        }
        const onTop = slime.ends.some(
          e =>
            e.state === 'stuck' &&
            Math.abs(e.x - cart.x) < TILE / 2 + 4 &&
            e.y < top &&
            e.y > top - END_RADIUS - 10
        );
        if (cart.armed && onTop && !slime.isFalling && !slime.frozen && slime.heldIndex < 0) {
          const right = cart.maxCol - cart.col;
          const left = cart.col - cart.minCol;
          if (right > 0 || left > 0) {
            cart.dir = right >= left ? 1 : -1;
            cart.target = cart.dir > 0 ? cart.maxCol : cart.minCol;
            cart.state = 'riding';
            cart.armed = false;
            tiles[cart.row][cart.col] = TileKind.RAIL;
            slime.holdAt(cart.x, top - END_RADIUS);
            this.events.push({ type: 'ride' });
          }
          continue;
        }
        // Push it by pressing the end you're dragging into its side.
        const held = slime.heldEnd;
        if (held && held.y > top - 4 && held.y < top + TILE + 4) {
          const side = held.x < cart.x ? -1 : 1;
          const touching = Math.abs(held.x - cart.x) < TILE / 2 + END_RADIUS + 4;
          const pushingIn = side < 0 ? slime.finger.x > held.x + 10 : slime.finger.x < held.x - 10;
          const next = cart.col - side;
          if (touching && pushingIn && next >= cart.minCol && next <= cart.maxCol) {
            cart.state = 'pushed';
            cart.dir = -side;
            cart.target = next;
            tiles[cart.row][cart.col] = TileKind.RAIL;
            this.events.push({ type: 'push' });
          }
        }
      } else {
        const speed = cart.state === 'riding' ? CART_RIDE_SPEED : CART_PUSH_SPEED;
        const targetX = (cart.target + 0.5) * TILE;
        const step = Math.min(Math.abs(targetX - cart.x), speed * dt);
        const before = cart.x;
        cart.x += cart.dir * step;
        if (cart.state === 'riding') {
          slime.holdAt(cart.x, top - END_RADIUS);
        } else {
          // Anything stuck to the cart's side comes along.
          for (const e of slime.ends) {
            if (
              e.state === 'stuck' &&
              e.y > top - 4 &&
              Math.abs(e.x - before) < TILE / 2 + END_RADIUS + 6
            ) {
              e.x += cart.x - before;
            }
          }
        }
        if (Math.abs(targetX - cart.x) < 0.5) {
          cart.x = targetX;
          cart.col = cart.target;
          tiles[cart.row][cart.col] = TileKind.CART;
          if (cart.state === 'riding') {
            // Hop out on top of the cart at the end of the track.
            slime.knockLoose(0, 0);
            this.events.push({ type: 'rideEnd' });
          }
          cart.state = 'idle';
        }
      }
    }
  }

  takeEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }
}

function circleTouchesTile(p, r, col, row) {
  const cx = Math.max(col * TILE, Math.min(p.x, (col + 1) * TILE));
  const cy = Math.max(row * TILE, Math.min(p.y, (row + 1) * TILE));
  return (p.x - cx) ** 2 + (p.y - cy) ** 2 < r * r;
}
