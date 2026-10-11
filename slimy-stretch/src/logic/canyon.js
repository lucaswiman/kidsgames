import { END_RADIUS, GRAVITY, ITEM_RADIUS, MAX_FALL_SPEED, TILE } from './constants.js';
import { circleHitsSolid, dist } from './collision.js';
import { TileKind } from './level.js';

// Things that first show up in the Canyon (but can be used anywhere):
// crumbling rocks, metal boxes, keys and laser gates, falling boulders, wind.

export const CRUMBLE_TIME = 3; // seconds after you stick before the rock falls apart
export const REGROW_TIME = 5; // seconds before a crumbled rock comes back
export const BOULDER_RADIUS = 22;
export const BOULDER_WARNING = 1; // seconds of falling dust before a boulder drops
const DEFAULT_BOULDER_EVERY = 4.5;

/** How hard the wind is blowing right now, from 0 (calm) to 1 (strongest). */
export function windAmount(wind, time) {
  if (!wind) {
    return 0;
  }
  const t = (((time + (wind.offset || 0)) % wind.every) + wind.every) % wind.every;
  return t < wind.gust ? Math.sin((Math.PI * t) / wind.gust) : 0;
}

/** Is a circle at `p` touching tile (col,row)? */
function circleTouchesTile(p, r, col, row) {
  const cx = Math.max(col * TILE, Math.min(p.x, (col + 1) * TILE));
  const cy = Math.max(row * TILE, Math.min(p.y, (row + 1) * TILE));
  return (p.x - cx) ** 2 + (p.y - cy) ** 2 < r * r;
}

export class CanyonStuff {
  constructor(level) {
    this.level = level;
    this.crumbles = level.crumbles.map(c => ({ ...c, state: 'solid', timer: 0 }));
    this.boxes = level.boxes.map(b => ({ ...b, eaten: false }));
    this.keys = level.keys.map(k => ({ ...k, taken: false }));
    this.gates = level.gates.map(g => ({ ...g, open: false }));
    this.carried = []; // colors of keys the slime is carrying
    const every = level.def.boulderEvery || DEFAULT_BOULDER_EVERY;
    this.spawners = level.boulderSpawners.map((s, i) => ({
      ...s,
      every,
      // Spread the cracks out so they don't all drop at once.
      timer: every * 0.6 + i * 1.3,
    }));
    this.boulders = [];
    this.events = [];
  }

  /** A crack about to drop a boulder (for drawing the warning dust). */
  isWarning(spawner) {
    return spawner.timer <= BOULDER_WARNING;
  }

  /**
   * Advance everything. Returns 'gate' or 'boulder' if the slime got hurt,
   * otherwise null. A boulder hit also sets `this.crushedBy`.
   */
  update(dt, slime) {
    this.updateCrumbles(dt, slime);
    this.pickUpKeys(slime);
    const gateHit = this.checkGates(slime);
    const boulderHit = this.updateBoulders(dt, slime);
    return gateHit || boulderHit;
  }

  updateCrumbles(dt, slime) {
    const tiles = this.level.tiles;
    let crumbled = false;
    for (const c of this.crumbles) {
      if (c.state === 'solid') {
        const stuckHere = slime.ends.some(
          e =>
            e.state === 'stuck' &&
            !slime.isFalling &&
            circleTouchesTile(e, END_RADIUS + 6, c.col, c.row)
        );
        if (stuckHere) {
          c.state = 'shaking';
          c.timer = CRUMBLE_TIME;
          this.events.push('shake');
        }
      } else if (c.state === 'shaking') {
        c.timer -= dt;
        if (c.timer <= 0) {
          c.state = 'gone';
          c.timer = REGROW_TIME;
          tiles[c.row][c.col] = TileKind.EMPTY;
          crumbled = true;
          this.events.push('crumble');
        }
      } else if (c.state === 'gone') {
        c.timer -= dt;
        // Only grow back if the slime isn't in the way.
        const blocked = slime
          .bodyPoints(8)
          .some(p => circleTouchesTile(p, END_RADIUS, c.col, c.row));
        if (c.timer <= 0 && !blocked) {
          c.state = 'solid';
          tiles[c.row][c.col] = TileKind.CRUMBLE;
        }
      }
    }
    if (crumbled) {
      slime.checkSupport(this.level);
    }
  }

  pickUpKeys(slime) {
    const pts = slime.bodyPoints(10);
    for (const key of this.keys) {
      if (key.taken || key.inBox !== undefined) {
        continue;
      }
      const touching =
        slime.ends.some(e => dist(e, key) < ITEM_RADIUS + END_RADIUS) ||
        pts.some(p => dist(p, key) < ITEM_RADIUS + 4);
      if (touching) {
        this.takeKey(key);
      }
    }
  }

  takeKey(key) {
    key.taken = true;
    this.carried.push(key.color);
    this.events.push('key');
  }

  /** Touching a gate opens it if you carry its key; otherwise it zaps you. */
  checkGates(slime) {
    const pts = slime.bodyPoints(8);
    for (const gate of this.gates) {
      if (gate.open) {
        continue;
      }
      const touching =
        slime.ends.some(e => circleTouchesTile(e, END_RADIUS * 0.8, gate.col, gate.row)) ||
        pts.some(p => circleTouchesTile(p, 5, gate.col, gate.row));
      if (!touching) {
        continue;
      }
      const k = this.carried.indexOf(gate.color);
      if (k < 0) {
        return 'gate';
      }
      this.carried.splice(k, 1);
      for (const g of this.gates) {
        if (g.color === gate.color) {
          g.open = true;
        }
      }
      this.events.push('gateOpen');
    }
    return null;
  }

  /**
   * A mining machine's pickaxe smashed box `i`. The box is gone and whatever
   * was inside drops out where anyone can grab it. Returns the item.
   */
  smashBox(i, slime) {
    const box = this.boxes[i];
    if (box.eaten) {
      return null;
    }
    box.eaten = true;
    box.smashed = true;
    this.level.tiles[box.row][box.col] = TileKind.EMPTY;
    const key = this.keys.find(k => k.inBox === i);
    if (key) {
      delete key.inBox;
    }
    if (slime) {
      slime.checkSupport(this.level);
    }
    return box.item;
  }

  /**
   * The tongue ate box `i`: remove it and hand over what was inside.
   * Returns the item ('token', 'core', 'key-red', ...) or null.
   */
  eatBox(i, slime) {
    const box = this.boxes[i];
    if (box.eaten) {
      return null;
    }
    box.eaten = true;
    this.level.tiles[box.row][box.col] = TileKind.EMPTY;
    this.events.push('eat');
    const key = this.keys.find(k => k.inBox === i);
    if (key) {
      this.takeKey(key);
    }
    if (slime) {
      slime.checkSupport(this.level);
    }
    return box.item;
  }

  updateBoulders(dt, slime) {
    for (const s of this.spawners) {
      s.timer -= dt;
      if (s.timer <= 0) {
        s.timer = s.every;
        this.boulders.push({
          x: (s.col + 0.5) * TILE,
          y: (s.row + 1) * TILE + BOULDER_RADIUS + 1,
          vy: 0,
          state: 'falling',
          age: 0,
        });
        this.events.push('boulder');
      }
    }
    let hit = null;
    for (const b of this.boulders) {
      b.age += dt;
      if (b.state === 'falling') {
        b.vy = Math.min(MAX_FALL_SPEED, b.vy + GRAVITY * dt);
        const steps = Math.max(1, Math.ceil((b.vy * dt) / 4));
        for (let i = 0; i < steps; i++) {
          const ny = b.y + (b.vy * dt) / steps;
          if (circleHitsSolid(this.level, { x: b.x, y: ny }, BOULDER_RADIUS)) {
            b.state = 'landed';
            b.age = 0;
            this.events.push('thud');
            break;
          }
          b.y = ny;
        }
        if (b.y > this.level.pixelHeight + 200) {
          b.state = 'gone';
        }
        const touching =
          !slime.isFalling &&
          slime.bodyPoints(10).some(p => dist(p, b) < BOULDER_RADIUS + END_RADIUS * 0.6);
        if (touching && !this.crushedBy) {
          this.crushedBy = b;
          hit = 'boulder';
        }
      } else if (b.state === 'landed' && b.age > 1.2) {
        b.state = 'gone';
      }
    }
    this.boulders = this.boulders.filter(b => b.state !== 'gone');
    return hit;
  }

  /** Forget the slime-related state after it respawns. */
  resetAfterDeath() {
    this.crushedBy = null;
    this.boulders = [];
  }

  takeEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }
}
