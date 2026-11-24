import { END_RADIUS, MAX_FALL_SPEED, TILE } from './constants.js';
import { circleHitsDeadly, circleHitsSolid, dist } from './collision.js';
import { gravityDir, inZeroG, isSolidKind, outOfWorld, TileKind, tileAt } from './level.js';
import { Slime } from './slime.js';
import { touchesBox } from './tongue.js';
import { simulateShot } from './warehouse.js';

// Things in Outer Space: asteroids that whizz along their lanes, black holes
// that pull you in, UFOs whose tractor beams carry you off, alien plants that
// chomp, gravity switches that turn down into up, teleporters, rocket
// boosters and moon rocks (bouncy, and you can carry one with your tongue and
// throw it). Zero gravity zones are part of the slime's own physics (see
// Slime.updateFalling and Slime.release), and space elevators are floating
// islands that go up and down (see floatingPlatforms in sky.js).

export const ASTEROID_RADIUS = 20;
export const ASTEROID_WARN = 1; // the edge blinks this long before an asteroid comes
const ASTEROID_EVERY = 5;
const ASTEROID_SPEED = 260;

export const BLACK_HOLE_RANGE = 5 * TILE; // how far away a black hole starts pulling
export const BLACK_HOLE_CORE = 22; // touching this close to the middle hurts
const BLACK_HOLE_TUG = 90; // the end you're dragging gets pulled at most this far
const BLACK_HOLE_PULL = 1400; // how hard it pulls a falling or floating slime

export const UFO_EVERY = 5; // seconds of flying around between beams
export const UFO_WARN = 1; // the beam flickers this long before it turns on
export const UFO_BEAM = 1.5; // and stays on this long
export const BEAM_HALF = 26; // half the width of the tractor beam
export const UFO_HANG = 34; // a slime in the beam hangs this far under the UFO
const UFO_SPEED = 80;
const UFO_LIFT_SPEED = 220;
const UFO_CARRY_SPEED = 200;

export const PLANT_SENSE = 1.5 * TILE; // get this close and a plant wants to chomp
export const PLANT_OPEN = 0.5; // it opens wide this long first, as a warning
export const PLANT_CHOMP = 0.35; // then chomps for this long
export const PLANT_REST = 1.5; // then rests before it can chomp again
export const PLANT_BITE = 18; // how big its mouth is when it chomps
const PLANT_LUNGE = 6; // the mouth pokes out this far from its middle
const PLANT_HIT = 22; // a thrown rock this close to a plant withers it

export const SWITCH_RADIUS = 16;

export const PAD_RADIUS = 20; // touch this close to a teleporter pad's middle
const TELEPORT_REST = 1; // a teleporter rests this long after you use it

export const BOOSTER_SPEED = 1100;
export const BOOSTER_ENTER = END_RADIUS + 20; // how close you have to touch it
const BOOSTER_REST = 0.8;
const BOOSTER_GRIP = 5; // like bouncy flowers, a fast blast always sticks to what it hits

export const ROCK_RADIUS = 13;
export const ROCK_GRAVITY = 900; // thrown rocks fall gently, so they're easy to aim
const ROCK_THROW_SPEED = 700; // you throw hard, so the arc stays low (it fits in a tunnel)
export const CARRY_REACH = 0.5; // carrying a moon rock cuts your reach in half
export const ROCK_THROW_RANGE = 6 * TILE; // how far the level checker thinks you can throw

/** How far into its warn-and-fly cycle an asteroid lane is at `time`. */
export function asteroidPhase(lane, time) {
  const every = lane.every || ASTEROID_EVERY;
  return (((time + (lane.offset || 0)) % every) + every) % every;
}

/** Is the edge of an asteroid lane blinking (an asteroid is about to come)? */
export function asteroidWarning(lane, time) {
  return asteroidPhase(lane, time) < ASTEROID_WARN;
}

/** Where an asteroid on a lane comes in: just past the level's left or right edge. */
export function asteroidStart(level, lane) {
  return {
    x: lane.dir < 0 ? level.pixelWidth + ASTEROID_RADIUS : -ASTEROID_RADIUS,
    y: (lane.row + 0.5) * TILE,
  };
}

/**
 * Where an asteroid on a lane will smash: the edge of the first solid tile
 * along its row (or the far side of the level). Used to draw the warning.
 */
export function asteroidStop(level, lane) {
  const dir = lane.dir < 0 ? -1 : 1;
  let col = dir > 0 ? 0 : level.width - 1;
  while (col >= 0 && col < level.width) {
    if (isSolidKind(level.tiles[lane.row][col])) {
      return dir > 0 ? col * TILE : (col + 1) * TILE;
    }
    col += dir;
  }
  return dir > 0 ? level.pixelWidth : 0;
}

/** Does a circle overlap a solid tile inside the map (not the edges of the world)? */
function hitsStation(level, p, r) {
  const minCol = Math.max(0, Math.floor((p.x - r) / TILE));
  const maxCol = Math.min(level.width - 1, Math.floor((p.x + r) / TILE));
  const minRow = Math.max(0, Math.floor((p.y - r) / TILE));
  const maxRow = Math.min(level.height - 1, Math.floor((p.y + r) / TILE));
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      if (!isSolidKind(level.tiles[row][col])) {
        continue;
      }
      const cx = Math.max(col * TILE, Math.min(p.x, (col + 1) * TILE));
      const cy = Math.max(row * TILE, Math.min(p.y, (row + 1) * TILE));
      if ((p.x - cx) ** 2 + (p.y - cy) ** 2 < r * r) {
        return true;
      }
    }
  }
  return false;
}

/**
 * How hard a black hole pulls something at `p`: a direction toward its
 * middle, times `k`, which grows from 0 at the edge of its range to 1 right
 * in the middle.
 */
export function holePull(hole, p) {
  const d = dist(hole, p);
  if (d >= BLACK_HOLE_RANGE || d < 1) {
    return { x: 0, y: 0, k: 0 };
  }
  const k = (1 - d / BLACK_HOLE_RANGE) ** 2;
  return { x: (hole.x - p.x) / d, y: (hole.y - p.y) / d, k };
}

/** Where a UFO's tractor beam stops: the top of the first solid tile under it. */
export function beamBottom(level, ufo) {
  const col = Math.floor(ufo.x / TILE);
  for (let row = Math.floor(ufo.y / TILE) + 1; row < level.height; row++) {
    if (isSolidKind(tileAt(level, col, row))) {
      return row * TILE;
    }
  }
  return level.pixelHeight;
}

/** Which way an alien plant faces: away from the floor, wall or ceiling it grows on. */
export function plantFacing(level, plant) {
  const solid = (dc, dr) => isSolidKind(tileAt(level, plant.col + dc, plant.row + dr));
  if (solid(0, 1)) {
    return { x: 0, y: -1 };
  }
  if (solid(0, -1)) {
    return { x: 0, y: 1 };
  }
  if (solid(-1, 0)) {
    return { x: 1, y: 0 };
  }
  if (solid(1, 0)) {
    return { x: -1, y: 0 };
  }
  return { x: 0, y: -1 };
}

/** The middle of a teleporter pad at [col, row], in pixels. */
export function padCenter([col, row]) {
  return { x: (col + 0.5) * TILE, y: (row + 0.5) * TILE };
}

/** Blast off from a rocket booster and see where the slime sticks (or null). */
export function simulateBooster(level, booster) {
  return simulateShot(level, booster, booster.angle, 4, BOOSTER_SPEED, BOOSTER_GRIP);
}

/**
 * Let go of a stretch at `tip` (with the other end stuck at `anchor`) and see
 * where the slime ends up, using the real game physics: in a zero gravity
 * zone it floats off until it bumps into something. Returns null if it gets
 * hurt, falls out of the level or is still floating after `maxTime`.
 */
export function simulateFling(level, anchor, tip, maxTime = 8) {
  const slime = new Slime(anchor);
  slime.falling = null;
  slime.ends[1].x = tip.x;
  slime.ends[1].y = tip.y;
  slime.ends[1].state = 'held';
  slime.heldIndex = 1;
  slime.release(level);
  if (!slime.isFalling) {
    return null;
  }
  const dt = 1 / 60;
  for (let t = 0; t < maxTime; t += dt) {
    slime.update(dt, level);
    const p = slime.ends[0];
    if (circleHitsDeadly(level, p, END_RADIUS * 0.6) || outOfWorld(level, p)) {
      return null;
    }
    if (!slime.isFalling) {
      return { x: p.x, y: p.y };
    }
  }
  return null;
}

export class SpaceStuff {
  /**
   * `sky` is the level's SkyStuff, which moves the space elevators (they're
   * floating islands), so they can be drawn here.
   */
  constructor(level, sky = null) {
    this.level = level;
    this.sky = sky;
    this.lanes = (level.def.asteroids || []).map(a => ({
      ...a,
      dir: a.dir < 0 ? -1 : 1,
      speed: a.speed || ASTEROID_SPEED,
      state: 'wait',
      rocks: [], // asteroids flying along this lane right now
    }));
    this.holes = level.blackHoles.map(h => ({ ...h }));
    this.ufos = (level.def.ufos || []).map((u, i) => {
      const y = (u.row + 0.5) * TILE;
      return {
        ...u,
        x: (u.from + 0.5) * TILE,
        y,
        homeY: y,
        dir: 1,
        speed: u.speed || UFO_SPEED,
        state: 'patrol',
        // UFOs take turns, so they don't all beam at once.
        timer: UFO_EVERY - UFO_WARN + i * 1.7,
        bottom: y,
        carryY: 0,
      };
    });
    this.plants = level.plants.map(p => ({
      ...p,
      face: plantFacing(level, p),
      state: 'rest',
      timer: 0,
    }));
    this.switches = level.switches;
    this.switchArmed = true;
    this.pads = (level.def.teleporters || []).map(t => ({
      a: padCenter(t.a),
      b: padCenter(t.b),
      used: false,
      rest: 0,
    }));
    this.boosters = level.boosters.map(b => ({ ...b, cooldown: 0, flash: 0 }));
    this.rocks = level.moonRocks.map(r => ({
      home: r,
      x: r.x,
      y: r.y,
      vx: 0,
      vy: 0,
      age: 0,
      state: 'home',
    }));
    this.carrying = null; // index of the moon rock the slime is carrying
    this.ufoRide = null; // index of the UFO carrying the slime
    this.time = 0;
    this.events = [];
  }

  /** Space elevators, for drawing (SkyStuff moves them). */
  get elevators() {
    return this.sky ? this.sky.islands.filter(i => i.elevator) : [];
  }

  /** Carrying a moon rock cuts how far you can stretch. */
  get reachScale() {
    return this.carrying !== null ? CARRY_REACH : 1;
  }

  /** Is the slime settled somewhere, free to touch things (not falling or carried)? */
  free(slime) {
    return !slime.isFalling && !slime.frozen;
  }

  /**
   * Black holes tug on the end you're dragging, so stretching away from one
   * is harder (but always possible). Call before the slime moves each frame,
   * after the wind has been set: it adds to `slime.wind`.
   */
  pullSlime(slime) {
    const end = slime.heldEnd;
    let x = 0;
    let y = 0;
    if (end) {
      for (const hole of this.holes) {
        const pull = holePull(hole, end);
        x += pull.x * pull.k * BLACK_HOLE_TUG;
        y += pull.y * pull.k * BLACK_HOLE_TUG;
      }
    }
    slime.wind.x += x;
    slime.wind.y = y;
  }

  /**
   * Advance everything. `time` is the level time (for the asteroids).
   * Returns 'asteroid', 'blackhole' or 'plant' if the slime got hurt,
   * otherwise null.
   */
  update(dt, slime, time = this.time + dt) {
    this.time = time;
    // Something else let go of the slime (like splitting in two): the UFO lets go.
    if (this.ufoRide !== null && !slime.frozen) {
      this.ufos[this.ufoRide].state = 'return';
      this.ufoRide = null;
    }
    const pts = slime.bodyPoints(8);
    const asteroid = this.updateAsteroids(dt, slime, pts, time);
    const hole = this.updateHoles(dt, slime, pts);
    const plant = this.updatePlants(dt, slime, pts);
    this.updateUfos(dt, slime, pts);
    this.updateSwitches(slime);
    this.updateTeleporters(dt, slime);
    this.updateBoosters(dt, slime);
    this.updateRocks(dt, slime);
    return asteroid || hole || plant;
  }

  // -------------------------------------------------------------- asteroids

  updateAsteroids(dt, slime, pts, time) {
    let hurt = null;
    for (const lane of this.lanes) {
      const warn = asteroidWarning(lane, time);
      if (warn && lane.state !== 'warn') {
        lane.state = 'warn';
        this.events.push({ type: 'asteroidWarn', row: lane.row });
      } else if (!warn && lane.state === 'warn') {
        // Here it comes!
        lane.state = 'fly';
        lane.rocks.push({ ...asteroidStart(this.level, lane), spin: 0 });
        this.events.push({ type: 'asteroid', row: lane.row });
      }
      for (const rock of lane.rocks) {
        if (this.moveAsteroid(lane, rock, dt, slime, pts)) {
          hurt = 'asteroid';
        }
      }
      lane.rocks = lane.rocks.filter(r => !r.gone);
    }
    return hurt;
  }

  /** Move one asteroid along its lane. Returns true if it hit the slime. */
  moveAsteroid(lane, rock, dt, slime, pts) {
    rock.spin += dt * 3 * lane.dir;
    const move = lane.speed * dt;
    const steps = Math.max(1, Math.ceil(move / 4));
    for (let i = 0; i < steps; i++) {
      rock.x += (lane.dir * move) / steps;
      if (!slime.frozen && pts.some(p => dist(p, rock) < ASTEROID_RADIUS + END_RADIUS * 0.6)) {
        this.smash(rock);
        return true;
      }
      if (hitsStation(this.level, rock, ASTEROID_RADIUS * 0.8)) {
        // Crash! It smashes to bits on the station wall.
        this.smash(rock);
        return false;
      }
      if (rock.x < -3 * TILE || rock.x > this.level.pixelWidth + 3 * TILE) {
        rock.gone = true;
        return false;
      }
    }
    return false;
  }

  smash(rock) {
    this.events.push({ type: 'crash', x: rock.x, y: rock.y });
    rock.gone = true;
  }

  // ------------------------------------------------------------ black holes

  updateHoles(dt, slime, pts) {
    let hurt = null;
    for (const hole of this.holes) {
      if (slime.isFalling) {
        // Falling or floating near a black hole, you get pulled in.
        const f = slime.falling;
        const pull = holePull(hole, f);
        f.vx += pull.x * pull.k * BLACK_HOLE_PULL * dt;
        f.vy += pull.y * pull.k * BLACK_HOLE_PULL * dt;
        f.vy = Math.max(-MAX_FALL_SPEED, Math.min(MAX_FALL_SPEED, f.vy));
      }
      if (!slime.frozen && pts.some(p => dist(p, hole) < BLACK_HOLE_CORE + END_RADIUS * 0.6)) {
        hurt = 'blackhole';
      }
    }
    return hurt;
  }

  // ----------------------------------------------------------------- plants

  updatePlants(dt, slime, pts) {
    let hurt = null;
    for (const plant of this.plants) {
      if (plant.state === 'withered') {
        continue;
      }
      if (plant.state === 'rest') {
        plant.timer -= dt;
        const near = !slime.frozen && pts.some(p => dist(p, plant) < PLANT_SENSE);
        if (plant.timer <= 0 && near) {
          // It opens wide... get away!
          plant.state = 'open';
          plant.timer = PLANT_OPEN;
          this.events.push({ type: 'plantOpen', x: plant.x, y: plant.y });
        }
      } else if (plant.state === 'open') {
        plant.timer -= dt;
        if (plant.timer <= 0) {
          plant.state = 'chomp';
          plant.timer = PLANT_CHOMP;
          this.events.push({ type: 'chomp', x: plant.x, y: plant.y });
        }
      } else if (plant.state === 'chomp') {
        const mouth = this.plantMouth(plant);
        if (!slime.frozen && pts.some(p => dist(p, mouth) < PLANT_BITE + END_RADIUS * 0.6)) {
          hurt = 'plant';
        }
        plant.timer -= dt;
        if (plant.timer <= 0) {
          plant.state = 'rest';
          plant.timer = PLANT_REST;
        }
      }
    }
    return hurt;
  }

  /** Where a plant's mouth is: a little out from its middle, the way it faces. */
  plantMouth(plant) {
    return { x: plant.x + plant.face.x * PLANT_LUNGE, y: plant.y + plant.face.y * PLANT_LUNGE };
  }

  /** A thrown moon rock hit the plant: it withers away for good. */
  wither(plant) {
    plant.state = 'withered';
    this.events.push({ type: 'wither', x: plant.x, y: plant.y });
  }

  // ------------------------------------------------------------------- UFOs

  updateUfos(dt, slime, pts) {
    this.ufos.forEach((ufo, i) => {
      if (ufo.state === 'patrol') {
        const left = (ufo.from + 0.5) * TILE;
        const right = (ufo.to + 0.5) * TILE;
        ufo.x += ufo.dir * ufo.speed * dt;
        if (ufo.x >= right) {
          ufo.x = right;
          ufo.dir = -1;
        } else if (ufo.x <= left) {
          ufo.x = left;
          ufo.dir = 1;
        }
        ufo.timer -= dt;
        if (ufo.timer <= 0) {
          // It stops and its beam flickers: get out from under it!
          ufo.state = 'warn';
          ufo.timer = UFO_WARN;
          ufo.bottom = beamBottom(this.level, ufo);
          this.events.push({ type: 'ufoWarn', x: ufo.x, y: ufo.y });
        }
      } else if (ufo.state === 'warn') {
        ufo.timer -= dt;
        ufo.bottom = beamBottom(this.level, ufo);
        if (ufo.timer <= 0) {
          ufo.state = 'beam';
          ufo.timer = UFO_BEAM;
          this.events.push({ type: 'beam', x: ufo.x, y: ufo.y });
        }
      } else if (ufo.state === 'beam') {
        ufo.timer -= dt;
        ufo.bottom = beamBottom(this.level, ufo);
        const caught =
          this.ufoRide === null &&
          !slime.frozen &&
          pts.some(
            p =>
              Math.abs(p.x - ufo.x) < BEAM_HALF + END_RADIUS * 0.5 &&
              p.y > ufo.y &&
              p.y < ufo.bottom + END_RADIUS * 0.5
          );
        if (caught) {
          ufo.state = 'lift';
          ufo.carryY = slime.center.y;
          this.ufoRide = i;
          slime.holdAt(ufo.x, ufo.carryY);
          this.events.push({ type: 'ufoGrab', x: ufo.x, y: ufo.carryY });
        } else if (ufo.timer <= 0) {
          ufo.state = 'patrol';
          ufo.timer = UFO_EVERY;
        }
      } else if (ufo.state === 'lift') {
        // Up you go, into the beam...
        ufo.carryY = Math.max(ufo.y + UFO_HANG, ufo.carryY - UFO_LIFT_SPEED * dt);
        slime.holdAt(ufo.x, ufo.carryY);
        if (ufo.carryY <= ufo.y + UFO_HANG) {
          ufo.state = 'carry';
        }
      } else if (ufo.state === 'carry') {
        // ...and away to its drop spot, which is never where you wanted to go.
        const [col, row] = ufo.drop;
        const target = { x: (col + 0.5) * TILE, y: (row + 0.5) * TILE - UFO_HANG };
        const there = moveToward(ufo, target, UFO_CARRY_SPEED * dt);
        slime.holdAt(ufo.x, ufo.y + UFO_HANG);
        if (there) {
          this.ufoRide = null;
          slime.knockLoose(0, 0);
          ufo.state = 'return';
          this.events.push({ type: 'ufoDrop', x: ufo.x, y: ufo.y + UFO_HANG });
        }
      } else if (ufo.state === 'return') {
        const left = (ufo.from + 0.5) * TILE;
        const right = (ufo.to + 0.5) * TILE;
        const home = { x: Math.max(left, Math.min(right, ufo.x)), y: ufo.homeY };
        if (moveToward(ufo, home, ufo.speed * 2 * dt)) {
          ufo.state = 'patrol';
          ufo.timer = UFO_EVERY;
        }
      }
    });
  }

  // ------------------------------------------------------- gravity switches

  updateSwitches(slime) {
    if (!this.switches.length || !this.free(slime)) {
      return;
    }
    const touching = this.switches.some(s =>
      slime.ends.some(e => dist(e, s) < SWITCH_RADIUS + END_RADIUS)
    );
    if (!touching) {
      // Moved off the switch: it works again next time you touch one.
      this.switchArmed = true;
      return;
    }
    if (this.switchArmed) {
      // Whoa! Down is up now. You let go and fall the new way.
      this.switchArmed = false;
      this.level.gravity = -gravityDir(this.level);
      slime.knockLoose(0, 0);
      this.events.push({ type: 'flip', gravity: this.level.gravity });
    }
  }

  // ------------------------------------------------------------ teleporters

  updateTeleporters(dt, slime) {
    const touching = pad => slime.ends.some(e => dist(e, pad) < PAD_RADIUS + END_RADIUS);
    for (const pair of this.pads) {
      pair.rest = Math.max(0, pair.rest - dt);
      if (!this.free(slime)) {
        continue;
      }
      const onA = touching(pair.a);
      const onB = touching(pair.b);
      if (pair.used) {
        // It works again once you've stepped off both pads.
        if (!onA && !onB && pair.rest <= 0) {
          pair.used = false;
        }
        continue;
      }
      if (onA || onB) {
        const from = onA ? pair.a : pair.b;
        const to = onA ? pair.b : pair.a;
        // Zap! The whole slime pops out of the other pad.
        slime.spawn(to);
        pair.used = true;
        pair.rest = TELEPORT_REST;
        this.events.push({ type: 'teleport', from, to });
        return;
      }
    }
  }

  // --------------------------------------------------------- rocket boosters

  updateBoosters(dt, slime) {
    for (const b of this.boosters) {
      b.cooldown = Math.max(0, b.cooldown - dt);
      b.flash = Math.max(0, b.flash - dt);
    }
    if (!this.free(slime)) {
      return;
    }
    const b = this.boosters.find(
      b => b.cooldown <= 0 && slime.ends.some(e => dist(e, b) < BOOSTER_ENTER)
    );
    if (b) {
      // WHOOOSH! Off you go, sticking to the first sticky thing you hit.
      const cos = Math.cos(b.angle);
      const sin = Math.sin(b.angle);
      slime.launch(
        b.x + cos * 30,
        b.y + sin * 30,
        cos * BOOSTER_SPEED,
        sin * BOOSTER_SPEED,
        BOOSTER_GRIP
      );
      b.cooldown = BOOSTER_REST;
      b.flash = 0.5;
      this.events.push({ type: 'blast', x: b.x, y: b.y });
    }
  }

  // ------------------------------------------------------------- moon rocks

  /**
   * The tongue tip at `tip` touched a moon rock: pick it up and carry it.
   * Returns true if it got one.
   */
  grabRock(tip) {
    if (this.carrying !== null) {
      return false;
    }
    const i = this.rocks.findIndex(r => r.state === 'home' && touchesBox(tip, r.home));
    if (i < 0) {
      return false;
    }
    const rock = this.rocks[i];
    this.level.tiles[rock.home.row][rock.home.col] = TileKind.EMPTY;
    rock.state = 'carried';
    this.carrying = i;
    this.events.push({ type: 'rockGrab', x: rock.home.x, y: rock.home.y });
    return true;
  }

  /** Throw the moon rock you're carrying from `from` in an arc that comes down at `target`. */
  throwRock(from, target) {
    if (this.carrying === null) {
      return false;
    }
    const rock = this.rocks[this.carrying];
    this.carrying = null;
    const time = Math.max(0.25, Math.min(1, dist(from, target) / ROCK_THROW_SPEED));
    // In zero gravity it flies straight; otherwise it arcs (upside down too).
    const g = inZeroG(this.level, from) ? 0 : ROCK_GRAVITY * gravityDir(this.level);
    rock.state = 'flying';
    rock.x = from.x;
    rock.y = from.y;
    rock.vx = (target.x - from.x) / time;
    rock.vy = (target.y - from.y) / time - 0.5 * g * time;
    rock.age = 0;
    this.events.push({ type: 'rockThrow', x: from.x, y: from.y });
    return true;
  }

  updateRocks(dt, slime) {
    for (const rock of this.rocks) {
      if (rock.state === 'carried') {
        // It floats along next to you.
        const c = slime.center;
        rock.x = c.x + 26;
        rock.y = c.y - 30 + Math.sin(this.time * 4) * 3;
      } else if (rock.state === 'flying') {
        this.flyRock(rock, dt);
      } else if (rock.state === 'returning') {
        // It pops back where it came from, once the slime isn't in the way.
        const { col, row } = rock.home;
        const blocked = slime.ends.some(e => touchesTile(e, END_RADIUS, col, row));
        if (!blocked) {
          this.level.tiles[row][col] = TileKind.MOON_ROCK;
          rock.state = 'home';
          rock.x = rock.home.x;
          rock.y = rock.home.y;
          this.events.push({ type: 'rockHome', x: rock.x, y: rock.y });
        }
      }
    }
  }

  flyRock(rock, dt) {
    rock.age += dt;
    const g = inZeroG(this.level, rock) ? 0 : ROCK_GRAVITY * gravityDir(this.level);
    rock.vy = Math.max(-MAX_FALL_SPEED, Math.min(MAX_FALL_SPEED, rock.vy + g * dt));
    const steps = Math.max(1, Math.ceil((Math.hypot(rock.vx, rock.vy) * dt) / 4));
    for (let i = 0; i < steps; i++) {
      rock.x += (rock.vx * dt) / steps;
      rock.y += (rock.vy * dt) / steps;
      const plant = this.plants.find(p => p.state !== 'withered' && dist(p, rock) < PLANT_HIT);
      if (plant) {
        this.wither(plant);
        this.poof(rock);
        return;
      }
      // (It only crashes into walls it really hits, so it can skim along a tunnel.)
      if (
        circleHitsSolid(this.level, rock, ROCK_RADIUS * 0.6) ||
        outOfWorld(this.level, rock) ||
        rock.age > 4
      ) {
        this.poof(rock);
        return;
      }
    }
  }

  /** A thrown rock lands with a poof and goes back to where it was. */
  poof(rock) {
    this.events.push({ type: 'rockPoof', x: rock.x, y: rock.y });
    rock.state = 'returning';
  }

  resetAfterDeath() {
    // Down is down again, and everything you were carrying goes back.
    this.level.gravity = 1;
    this.switchArmed = false;
    this.ufoRide = null;
    for (const ufo of this.ufos) {
      if (ufo.state !== 'patrol') {
        ufo.state = 'return';
      }
    }
    if (this.carrying !== null) {
      this.rocks[this.carrying].state = 'returning';
      this.carrying = null;
    }
    for (const rock of this.rocks) {
      if (rock.state === 'flying') {
        rock.state = 'returning';
      }
    }
    for (const pair of this.pads) {
      pair.used = false;
    }
    for (const lane of this.lanes) {
      lane.rocks = [];
      lane.state = 'wait';
    }
    // Withered plants stay withered for good.
    for (const plant of this.plants) {
      if (plant.state !== 'withered') {
        plant.state = 'rest';
        plant.timer = 0;
      }
    }
  }

  takeEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }
}

/** Is a circle at `p` touching tile (col, row)? */
function touchesTile(p, r, col, row) {
  const cx = Math.max(col * TILE, Math.min(p.x, (col + 1) * TILE));
  const cy = Math.max(row * TILE, Math.min(p.y, (row + 1) * TILE));
  return (p.x - cx) ** 2 + (p.y - cy) ** 2 < r * r;
}

/** Move `obj` toward `p` by up to `step`. Returns true once it's there. */
function moveToward(obj, p, step) {
  const d = dist(obj, p);
  if (d <= step) {
    obj.x = p.x;
    obj.y = p.y;
    return true;
  }
  obj.x += ((p.x - obj.x) / d) * step;
  obj.y += ((p.y - obj.y) / d) * step;
  return false;
}
