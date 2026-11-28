import { END_RADIUS, TILE } from './constants.js';
import { dist } from './collision.js';
import { isPlatformKind, isSolidKind, TileKind, tileAt } from './level.js';
import { padCenter } from './space.js';
import { BLOB_RADIUS } from './slimeShot.js';

// Things inside the computer: computer viruses that crawl around and chase
// you (a slime shot deletes one for good), glitchy blocks that blink on and
// off, electric circuits that light up and then zap, pop-up windows you can
// stand on while they're open, cables that zoom you from one end to the
// other, a giant mouse cursor that grabs you and drags you somewhere useful,
// and copy-paste pads that leave a copy of you behind (eat it to grow double
// size: see sizes.js). Data streams carry you along like conveyor belts (see
// warehouse.js), and the firewall is a chaser that sweeps across the level
// (see chaserPosition in hazards.js).

export const VIRUS_RADIUS = 13;
export const VIRUS_SPEED = 30; // a virus crawls back and forth this fast...
export const VIRUS_CHASE = 55; // ...and chases you this fast when you're near
export const VIRUS_SEE = 4 * TILE; // how close you have to be for a virus to chase you
const VIRUS_POOF = 0.5; // how long a deleted virus takes to disappear
const CHASE_SOUND_EVERY = 4; // a virus that starts chasing beeps, but not too often

export const GLITCH_ON = 3; // a glitchy block is there this long (flickering at the end)...
export const GLITCH_FLICKER = 0.8; // ...flickers this long as a warning...
export const GLITCH_OFF = 2; // ...then vanishes this long
export const GLITCH_STAGGER = 0.6; // each column of glitchy blocks blinks this much later

export const CIRCUIT_QUIET = 3; // a circuit is quiet this long...
export const CIRCUIT_WARN = 1; // ...lights up this long as a pulse of power runs along it...
export const CIRCUIT_ZAP = 1; // ...then zaps anything touching it this long
export const CIRCUIT_STAGGER = 1.7; // circuits take turns, this far apart
export const CIRCUIT_THICK = 10; // how far the wire sticks out from its floor or wall
const CIRCUIT_TOUCH = END_RADIUS * 0.7; // how close a bit of slime has to be to get zapped

export const POPUP_OPEN = 4; // a pop-up window stays open this long (shaking at the end)...
export const POPUP_WARN = 1; // ...shakes this long before it closes...
export const POPUP_CLOSED = 3; // ...then stays closed this long
export const POPUP_WIDTH = 3;

export const CABLE_GRAB = 20; // touch this close to the middle of a cable's plug
export const CABLE_SPEED = 520; // zooming through a cable
const CABLE_REST = 1; // a cable rests this long after you use it

export const CURSOR_GRAB = 26; // how close to the tip of the mouse cursor it grabs you
export const CURSOR_SPEED = 80; // it swoops back and forth this fast...
export const CURSOR_DRAG = 220; // ...and drags you this fast
export const CURSOR_HANG = 12; // you hang this far under its tip
const CURSOR_REST = 2; // after dropping you it waits this long before grabbing again

export const COPY_RADIUS = 22; // touch this close to the middle of a copy pad's cell

/** Is point `p` within `r` of a rectangle? */
function nearRect(p, rect, r) {
  const dx = Math.max(rect.left - p.x, 0, p.x - rect.right);
  const dy = Math.max(rect.top - p.y, 0, p.y - rect.bottom);
  return dx * dx + dy * dy < r * r;
}

/** Is a circle at `p` touching tile (col, row)? */
function touchesTile(p, r, col, row) {
  const rect = {
    left: col * TILE,
    top: row * TILE,
    right: (col + 1) * TILE,
    bottom: (row + 1) * TILE,
  };
  return nearRect(p, rect, r);
}

/** Where (from 0 to `period`) a repeating timer is at `time`. */
function cycle(time, period) {
  return ((time % period) + period) % period;
}

/** 'on', 'flicker' (about to vanish) or 'off' for a glitchy block at `time`. */
export function glitchState(block, time) {
  const period = GLITCH_ON + GLITCH_OFF;
  // Each column waits a little longer before it first blinks off, like a wave.
  const wait = (block.col * GLITCH_STAGGER) % period;
  if (time < wait) {
    return 'on';
  }
  const t = cycle(time - wait, period);
  if (t < GLITCH_ON - GLITCH_FLICKER) {
    return 'on';
  }
  return t < GLITCH_ON ? 'flicker' : 'off';
}

/** 'quiet', 'warn' (lit up, about to zap) or 'zap' for a circuit at `time`. */
export function circuitState(circuit, time) {
  const t = cycle(time + circuit.offset, circuit.quiet + CIRCUIT_WARN + CIRCUIT_ZAP);
  if (t < circuit.quiet) {
    return 'quiet';
  }
  return t < circuit.quiet + CIRCUIT_WARN ? 'warn' : 'zap';
}

/** How far a lit-up circuit's pulse of power has run along it, from 0 to 1. */
export function circuitPulse(circuit, time) {
  const t = cycle(time + circuit.offset, circuit.quiet + CIRCUIT_WARN + CIRCUIT_ZAP);
  return Math.max(0, Math.min(1, (t - circuit.quiet) / CIRCUIT_WARN));
}

/** 'open', 'closing' (shaking, about to close) or 'closed' for a pop-up window at `time`. */
export function popupState(popup, time) {
  const t = cycle(time + popup.offset, popup.open + popup.closed);
  if (t < popup.open - POPUP_WARN) {
    return 'open';
  }
  return t < popup.open ? 'closing' : 'closed';
}

/** How long a pop-up window has been open at `time` (for its pop-open animation). */
export function popupAge(popup, time) {
  return cycle(time + popup.offset, popup.open + popup.closed);
}

/** The pop-up windows in a level definition, with their timings filled in. */
export function popupWindows(def) {
  return (def.popups || []).map(p => ({
    col: p.at[0],
    row: p.at[1],
    width: p.width || POPUP_WIDTH,
    open: p.open || POPUP_OPEN,
    closed: p.closed || POPUP_CLOSED,
    offset: p.offset || 0,
  }));
}

/** The tiles a pop-up window covers while it's open. */
export function popupCells(popup) {
  const cells = [];
  for (let i = 0; i < popup.width; i++) {
    cells.push({ col: popup.col + i, row: popup.row });
  }
  return cells;
}

/** A cable's path in pixels: from its `a` plug, through its bends, to its `b` plug. */
export function cablePath(cable) {
  return [cable.a, ...(cable.path || []), cable.b].map(padCenter);
}

/** A mouse cursor's patrol, in pixels: { from, to } where its tip swoops between. */
export function cursorPatrol(cursor) {
  return { from: padCenter(cursor.from), to: padCenter(cursor.to) };
}

/**
 * Which way a virus or wire lies against its surface: on the floor below it
 * (or a platform), the ceiling above, or a wall beside it.
 */
function surfaceOf(level, col, row, upright = false) {
  const solid = (dc, dr) => isSolidKind(tileAt(level, col + dc, row + dr));
  // Something running up and down (like a wire up a wall) looks for a wall first.
  if (upright && (solid(-1, 0) || solid(1, 0))) {
    return solid(-1, 0) ? 'left' : 'right';
  }
  if (solid(0, 1) || isPlatformKind(tileAt(level, col, row + 1))) {
    return 'floor';
  }
  if (solid(0, -1)) {
    return 'ceiling';
  }
  if (solid(-1, 0)) {
    return 'left';
  }
  return solid(1, 0) ? 'right' : 'floor';
}

/**
 * Group the circuit cells (;) into circuits: each run of cells side by side
 * is one wire. The cells are in order along the wire, so a pulse of power can
 * run from one end to the other. `def.circuitTimings[i]` can set how long
 * the i-th circuit (in reading order) stays quiet ({ quiet, offset }).
 */
export function buildCircuits(level) {
  const timings = level.def.circuitTimings || [];
  const key = c => `${c.col},${c.row}`;
  const cells = new Map(level.circuitCells.map(c => [key(c), c]));
  const used = new Set();
  const circuits = [];
  for (const start of level.circuitCells) {
    if (used.has(key(start))) {
      continue;
    }
    // Find the whole wire, then walk it from one end.
    const wire = [];
    const stack = [start];
    used.add(key(start));
    while (stack.length) {
      const c = stack.pop();
      wire.push(c);
      for (const [dc, dr] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const next = cells.get(`${c.col + dc},${c.row + dr}`);
        if (next && !used.has(key(next))) {
          used.add(key(next));
          stack.push(next);
        }
      }
    }
    const i = circuits.length;
    const upright = wire.length > 1 && wire.every(c => c.col === wire[0].col);
    circuits.push({
      cells: orderWire(wire).map(c => ({ ...c, side: surfaceOf(level, c.col, c.row, upright) })),
      quiet: CIRCUIT_QUIET,
      offset: (i * CIRCUIT_STAGGER) % (CIRCUIT_QUIET + CIRCUIT_WARN + CIRCUIT_ZAP),
      ...timings[i],
    });
  }
  for (const circuit of circuits) {
    circuit.strips = circuit.cells.map(wireStrip);
  }
  return circuits;
}

/** Put a wire's cells in order, starting from an end. */
function orderWire(wire) {
  const near = (a, b) => Math.abs(a.col - b.col) + Math.abs(a.row - b.row) === 1;
  const neighbors = c => wire.filter(o => near(c, o)).length;
  const first = wire.find(c => neighbors(c) <= 1) || wire[0];
  const order = [first];
  const left = new Set(wire.filter(c => c !== first));
  while (left.size) {
    const last = order[order.length - 1];
    const next = [...left].find(c => near(c, last)) || [...left][0];
    order.push(next);
    left.delete(next);
  }
  return order;
}

/** The thin strip of a cell that a wire covers, against its floor, ceiling or wall. */
function wireStrip(c) {
  const left = c.col * TILE;
  const top = c.row * TILE;
  const right = left + TILE;
  const bottom = top + TILE;
  if (c.side === 'ceiling') {
    return { left, top, right, bottom: top + CIRCUIT_THICK };
  }
  if (c.side === 'left') {
    return { left, top, right: left + CIRCUIT_THICK, bottom };
  }
  if (c.side === 'right') {
    return { left: right - CIRCUIT_THICK, top, right, bottom };
  }
  return { left, top: bottom - CIRCUIT_THICK, right, bottom };
}

export class ComputerStuff {
  /**
   * `sky` is the level's SkyStuff: when a glitchy block or pop-up window
   * disappears, it checks what's still holding the slime up.
   */
  constructor(level, sky = null) {
    this.level = level;
    this.sky = sky;
    this.viruses = level.viruses.map(v => this.buildVirus(v));
    this.glitches = level.glitches.map(g => ({ ...g, state: 'on', solid: true }));
    this.circuits = buildCircuits(level);
    this.popups = popupWindows(level.def).map(p => ({
      ...p,
      cells: popupCells(p),
      state: 'open',
      solid: true,
    }));
    this.popups.forEach(p => this.setTiles(p.cells, TileKind.POPUP));
    this.cables = (level.def.cables || []).map(c => ({
      path: cablePath(c),
      used: false,
      rest: 0,
      glow: 0, // just for looks: the cable glows for a moment after you zoom through
    }));
    // While zooming through a cable: { cable, points, along }.
    this.riding = null;
    this.cursors = (level.def.cursors || []).map(c => {
      const { from, to } = cursorPatrol(c);
      return {
        from,
        to,
        drop: padCenter(c.drop),
        x: from.x,
        y: from.y,
        dir: 1,
        speed: c.speed || CURSOR_SPEED,
        state: 'patrol',
        cooldown: 0,
      };
    });
    this.inCursor = null; // index of the cursor dragging the slime
    this.copyPads = (level.def.copyPads || []).map(p => ({
      copy: padCenter(p.copy),
      paste: padCenter(p.paste),
      used: false,
    }));
    this.lastChaseSound = -Infinity;
    this.time = 0;
    this.events = [];
  }

  /** A virus crawls along the floor under it, or up and down the wall beside it. */
  buildVirus(v) {
    const side = surfaceOf(this.level, v.col, v.row);
    const axis = side === 'left' || side === 'right' ? 'y' : 'x';
    return { ...v, home: { x: v.x, y: v.y }, axis, side, dir: 1, state: 'crawl', timer: 0 };
  }

  /** Is the slime settled somewhere, free to touch things (not falling or carried)? */
  free(slime) {
    return !slime.isFalling && !slime.frozen;
  }

  /**
   * Advance everything. `time` is the level time (glitchy blocks, circuits
   * and pop-up windows all run on it). Returns 'virus' or 'circuit' if the
   * slime got hurt, otherwise null.
   */
  update(dt, slime, time = this.time + dt) {
    this.time = time;
    this.updateGlitches(slime);
    this.updatePopups(slime);
    this.updateCables(dt, slime);
    this.updateCursors(dt, slime);
    this.updateCopyPads(slime);
    const virus = this.updateViruses(dt, slime);
    const circuit = this.updateCircuits(slime);
    return virus || circuit;
  }

  /**
   * Is a circuit zapping or a virus touching `slime` right now? (For the
   * pieces of slime you're not moving, which just sit there, and copies of
   * you left behind: `still` says it's one of those.)
   */
  hurts(slime, still = false) {
    // (Something carrying the slime keeps it safe, but a still copy of you is always "frozen".)
    if (slime.frozen && !still) {
      return null;
    }
    const pts = slime.bodyPoints(8);
    if (this.viruses.some(v => v.state !== 'deleted' && this.virusTouches(v, pts))) {
      return 'virus';
    }
    return this.circuits.some(c => this.zapping(c, pts)) ? 'circuit' : null;
  }

  /** Something the slime was stuck to just disappeared: let go of anything holding onto nothing. */
  checkSupport(slime) {
    if (this.sky) {
      this.sky.checkSupport(slime);
    } else if (this.free(slime)) {
      slime.checkSupport(this.level);
    }
  }

  setTiles(cells, kind) {
    for (const c of cells) {
      this.level.tiles[c.row][c.col] = kind;
    }
  }

  /** Is any part of the slime in the way of these cells (so they can't come back yet)? */
  blocking(slime, cells) {
    const pts = slime.bodyPoints(8);
    return cells.some(c => pts.some(p => touchesTile(p, END_RADIUS, c.col, c.row)));
  }

  // ---------------------------------------------------------- glitchy blocks

  updateGlitches(slime) {
    let vanished = false;
    for (const g of this.glitches) {
      g.state = glitchState(g, this.time);
      if (g.state === 'off' && g.solid) {
        g.solid = false;
        this.setTiles([g], TileKind.EMPTY);
        vanished = true;
        this.events.push({ type: 'glitchOff', x: (g.col + 0.5) * TILE, y: (g.row + 0.5) * TILE });
      } else if (g.state !== 'off' && !g.solid && !this.blocking(slime, [g])) {
        // It only comes back if the slime isn't in the way.
        g.solid = true;
        this.setTiles([g], TileKind.GLITCH);
      }
    }
    if (vanished) {
      // Whatever was stuck to it lets go.
      this.checkSupport(slime);
    }
  }

  // --------------------------------------------------------- pop-up windows

  updatePopups(slime) {
    let closed = false;
    for (const p of this.popups) {
      const state = popupState(p, this.time);
      if (state === 'closed' && p.solid) {
        p.solid = false;
        this.setTiles(p.cells, TileKind.EMPTY);
        closed = true;
        this.events.push({ type: 'popupClose', x: (p.col + p.width / 2) * TILE, y: p.row * TILE });
      } else if (state !== 'closed' && !p.solid && !this.blocking(slime, p.cells)) {
        // Pop! It only opens if the slime isn't in the way.
        p.solid = true;
        this.setTiles(p.cells, TileKind.POPUP);
        this.events.push({ type: 'popupOpen', x: (p.col + p.width / 2) * TILE, y: p.row * TILE });
      }
      p.state = p.solid ? state : 'closed';
    }
    if (closed) {
      this.checkSupport(slime);
    }
  }

  // ------------------------------------------------------------- circuits

  /** Is a circuit zapping any of these points of slime right now? */
  zapping(circuit, pts) {
    return (
      circuitState(circuit, this.time) === 'zap' &&
      circuit.strips.some(s => pts.some(p => nearRect(p, s, CIRCUIT_TOUCH)))
    );
  }

  updateCircuits(slime) {
    let hurt = null;
    const pts = slime.bodyPoints(8);
    for (const c of this.circuits) {
      const state = circuitState(c, this.time);
      if (state !== c.state) {
        const mid = c.cells[Math.floor(c.cells.length / 2)];
        const at = { x: (mid.col + 0.5) * TILE, y: (mid.row + 0.5) * TILE };
        if (state === 'warn') {
          this.events.push({ type: 'circuitWarn', ...at });
        } else if (state === 'zap') {
          this.events.push({ type: 'zap', ...at });
        }
        c.state = state;
      }
      if (!slime.frozen && this.zapping(c, pts)) {
        hurt = 'circuit';
      }
    }
    return hurt;
  }

  // -------------------------------------------------------------- viruses

  /** Is a virus touching any of these points of slime? */
  virusTouches(v, pts) {
    return pts.some(p => dist(p, v) < VIRUS_RADIUS + END_RADIUS * 0.6);
  }

  updateViruses(dt, slime) {
    let hurt = null;
    const pts = slime.bodyPoints(8);
    for (const v of this.viruses) {
      if (v.state === 'deleted') {
        v.timer = Math.max(0, v.timer - dt);
        continue;
      }
      // Close enough to see you? Then it crawls after you (slowly!).
      const target = this.nearestEnd(slime, v);
      const sees = !slime.frozen && dist(target, v) < VIRUS_SEE;
      if (sees && v.state !== 'chase' && this.time - this.lastChaseSound > CHASE_SOUND_EVERY) {
        this.lastChaseSound = this.time;
        this.events.push({ type: 'virusChase', x: v.x, y: v.y });
      }
      v.state = sees ? 'chase' : 'crawl';
      if (sees) {
        const want = v.axis === 'x' ? target.x - v.x : target.y - v.y;
        if (Math.abs(want) > 2) {
          v.dir = Math.sign(want);
          this.crawl(v, VIRUS_CHASE * dt, false);
        }
      } else {
        this.crawl(v, VIRUS_SPEED * dt, true);
      }
      if (!slime.frozen && this.virusTouches(v, pts)) {
        hurt = 'virus';
      }
    }
    return hurt;
  }

  /** The end of the slime nearest to point `p`. */
  nearestEnd(slime, p) {
    const [a, b] = slime.ends;
    return dist(a, p) <= dist(b, p) ? a : b;
  }

  /**
   * Crawl `step` pixels along the virus's floor or wall. It can't crawl into
   * a wall or off the end of its surface: patrolling, it turns around there;
   * chasing, it just waits at the edge.
   */
  crawl(v, step, turn) {
    const move = v.dir * step;
    const nx = v.axis === 'x' ? v.x + move : v.x;
    const ny = v.axis === 'y' ? v.y + move : v.y;
    const lead =
      v.axis === 'x'
        ? { x: nx + v.dir * VIRUS_RADIUS, y: ny }
        : { x: nx, y: ny + v.dir * VIRUS_RADIUS };
    const col = Math.floor(lead.x / TILE);
    const row = Math.floor(lead.y / TILE);
    const level = this.level;
    const blocked = isSolidKind(tileAt(level, col, row));
    const under = {
      floor: () => tileAt(level, col, v.row + 1),
      ceiling: () => tileAt(level, col, v.row - 1),
      left: () => tileAt(level, v.col - 1, row),
      right: () => tileAt(level, v.col + 1, row),
    }[v.side]();
    const surface = isSolidKind(under) || (v.side === 'floor' && isPlatformKind(under));
    if (blocked || !surface) {
      if (turn) {
        v.dir = -v.dir;
      }
      return;
    }
    v.x = nx;
    v.y = ny;
  }

  /** A slime shot that hits a virus deletes it, for good. */
  shootAt(blob) {
    for (const v of this.viruses) {
      if (v.state !== 'deleted' && dist(blob, v) < VIRUS_RADIUS + BLOB_RADIUS + 4) {
        v.state = 'deleted';
        v.timer = VIRUS_POOF;
        this.events.push({ type: 'virusDelete', x: v.x, y: v.y });
      }
    }
  }

  /** How far through disappearing a deleted virus is, from 0 (just hit) to 1 (gone). */
  poof(v) {
    return v.state === 'deleted' ? 1 - v.timer / VIRUS_POOF : 0;
  }

  // ---------------------------------------------------------------- cables

  updateCables(dt, slime) {
    for (const c of this.cables) {
      c.rest = Math.max(0, c.rest - dt);
      c.glow = Math.max(0, c.glow - dt);
    }
    if (this.riding) {
      const ride = this.riding;
      ride.along += CABLE_SPEED * dt;
      const p = pointAlong(ride.points, ride.along);
      if (p) {
        slime.holdAt(p.x, p.y);
        return;
      }
      // ...and out of the plug at the other end!
      const end = ride.points[ride.points.length - 1];
      slime.spawn(end);
      ride.cable.glow = 0.6;
      this.riding = null;
      this.events.push({ type: 'cableOut', x: end.x, y: end.y });
      return;
    }
    if (!this.free(slime)) {
      return;
    }
    const touching = p => slime.ends.some(e => dist(e, p) < CABLE_GRAB + END_RADIUS);
    for (const cable of this.cables) {
      const a = cable.path[0];
      const b = cable.path[cable.path.length - 1];
      const onA = touching(a);
      const onB = touching(b);
      if (cable.used) {
        // It works again once you've moved away from both plugs.
        if (!onA && !onB && cable.rest <= 0) {
          cable.used = false;
        }
        continue;
      }
      if (onA || onB) {
        // Zoom! In one plug and along the cable...
        const points = onA ? cable.path : cable.path.slice().reverse();
        cable.used = true;
        cable.rest = CABLE_REST;
        this.riding = { cable, points, along: 0 };
        slime.holdAt(points[0].x, points[0].y);
        this.events.push({ type: 'cableIn', x: points[0].x, y: points[0].y });
        return;
      }
    }
  }

  // ---------------------------------------------------------- mouse cursors

  updateCursors(dt, slime) {
    this.cursors.forEach((cur, i) => {
      cur.cooldown = Math.max(0, cur.cooldown - dt);
      if (cur.state === 'patrol') {
        const target = cur.dir > 0 ? cur.to : cur.from;
        const d = dist(cur, target);
        const step = cur.speed * dt;
        if (d <= step) {
          cur.x = target.x;
          cur.y = target.y;
          cur.dir = -cur.dir;
        } else {
          cur.x += ((target.x - cur.x) / d) * step;
          cur.y += ((target.y - cur.y) / d) * step;
        }
        const free = this.inCursor === null && !slime.frozen;
        const near = slime.bodyPoints(10).some(p => dist(p, cur) < CURSOR_GRAB + END_RADIUS * 0.6);
        if (free && cur.cooldown <= 0 && near) {
          // Click! It grabs you...
          cur.state = 'drag';
          this.inCursor = i;
          slime.holdAt(cur.x, cur.y + CURSOR_HANG);
          this.events.push({ type: 'cursorGrab', x: cur.x, y: cur.y });
        }
      } else if (cur.state === 'drag') {
        // ...and drags you over to its drop spot.
        const d = dist(cur, cur.drop);
        const step = CURSOR_DRAG * dt;
        if (d <= step) {
          cur.x = cur.drop.x;
          cur.y = cur.drop.y;
        } else {
          cur.x += ((cur.drop.x - cur.x) / d) * step;
          cur.y += ((cur.drop.y - cur.y) / d) * step;
        }
        slime.holdAt(cur.x, cur.y + CURSOR_HANG);
        if (d <= step) {
          cur.state = 'patrol';
          cur.cooldown = CURSOR_REST;
          this.inCursor = null;
          slime.knockLoose(0, 0);
          this.events.push({ type: 'cursorDrop', x: cur.x, y: cur.y });
        }
      }
    });
  }

  // ------------------------------------------------------- copy-paste pads

  /**
   * Touch a copy pad and a copy of you pops out of its paste pad: that's
   * the one you move now, and the old you stays behind where you were. The
   * event's `ends` say where the old you is (the game leaves a still copy
   * there, see SlimePieces.leaveCopy). Each pair of pads only works once.
   */
  updateCopyPads(slime) {
    if (!this.free(slime)) {
      return;
    }
    for (const pad of this.copyPads) {
      if (pad.used || !slime.ends.some(e => dist(e, pad.copy) < COPY_RADIUS + END_RADIUS)) {
        continue;
      }
      pad.used = true;
      const ends = slime.ends.map(e => ({ x: e.x, y: e.y }));
      slime.spawn(pad.paste);
      this.events.push({ type: 'copy', ends, from: pad.copy, to: pad.paste });
      return;
    }
  }

  // ---------------------------------------------------------------- general

  /**
   * After really dying: you let go of cables and cursors, copy pads work
   * again, and viruses crawl back home (deleted ones stay deleted).
   */
  resetAfterDeath() {
    this.riding = null;
    this.inCursor = null;
    for (const cur of this.cursors) {
      cur.state = 'patrol';
      cur.cooldown = 1;
    }
    for (const c of this.cables) {
      c.used = false;
    }
    for (const pad of this.copyPads) {
      pad.used = false;
    }
    for (const v of this.viruses) {
      if (v.state !== 'deleted') {
        v.x = v.home.x;
        v.y = v.home.y;
        v.state = 'crawl';
      }
    }
  }

  takeEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }
}

/** The point `along` pixels down a path of points, or null past its end. */
export function pointAlong(points, along) {
  let left = along;
  for (let i = 0; i < points.length - 1; i++) {
    const d = dist(points[i], points[i + 1]);
    if (left <= d) {
      const t = d === 0 ? 1 : left / d;
      return {
        x: points[i].x + (points[i + 1].x - points[i].x) * t,
        y: points[i].y + (points[i + 1].y - points[i].y) * t,
      };
    }
    left -= d;
  }
  return null;
}
