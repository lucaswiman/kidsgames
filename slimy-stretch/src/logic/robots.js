import { END_RADIUS, TILE } from './constants.js';
import { castCircle, dist } from './collision.js';
import { BOOSTER_DIRS, isPlatformKind, isSolidKind, TileKind, tileAt } from './level.js';
import { cablePath, pointAlong } from './computer.js';
import { simulateShot } from './warehouse.js';

// Things in the Robot Factory: robot arms that grab you and toss you away,
// welding torches that shower sparks down every few seconds, patrol robots
// whose searchlights set off an alarm (the alarm doors slam shut for a
// while), and sniper robots that put a red dot on you and then fire a laser
// bolt where you were. But also spring pads that launch you like a catapult,
// and pneumatic tubes that suck you in at one end and shoot you out of the
// other. Robot helpers you can ride and lifts that go up and down are
// floating platforms (see floatingPlatforms in sky.js), and conveyor belts
// and lasers come back from earlier worlds.

export const ARM_REACH = 2.6 * TILE; // how far a robot arm can reach from its base
export const ARM_WINDUP = 0.8; // it pulls back and its light blinks this long, as a warning...
export const ARM_LUNGE = 0.22; // ...then its claw shoots out this fast (seconds)...
export const ARM_HOLD = 0.45; // ...and if it got you, it swings you around this long...
export const ARM_TOSS_SPEED = 750; // ...and tosses you away this hard
export const ARM_GRAB = 26; // how close to the claw you get grabbed
export const ARM_REST = 3; // after a toss it rests this long (time to sneak past!)
export const ARM_MISS_REST = 1.6; // after grabbing at nothing it rests this long
export const ARM_GRIP = 5; // a tossed slime sticks to what it hits, like a booster blast

export const SPARK_QUIET = 2; // a welding torch is quiet this long...
export const SPARK_WARN = 1; // ...glows this long as a warning...
export const SPARK_SHOWER = 1.5; // ...then showers sparks straight down this long
export const SPARK_STAGGER = 1.5; // torches take turns, this far apart
export const SPARK_HALF = 16; // half the width of a shower of sparks

export const PATROL_SPEED = 45;
export const PATROL_SEE = 4.5 * TILE; // how far a patrol robot's searchlight shines
export const PATROL_CONE = 0.38; // half the width of the searchlight, in radians
const PATROL_SWEEP = 0.35; // the searchlight sweeps up and down this far...
const PATROL_SWEEP_SPEED = 1.6; // ...this fast
export const ALARM_TIME = 8; // the alarm doors stay shut this long
const ALARM_REST = 1.5; // after the alarm stops, it can't go off again for this long

export const SNIPER_RANGE = 8 * TILE; // a sniper robot can see this far
export const SNIPER_AIM = 1.2; // its red dot follows you this long...
export const SNIPER_LOCK = 0.3; // ...then stops where you were this long...
export const BOLT_SPEED = 650; // ...then it fires a laser bolt there, this fast
export const BOLT_RADIUS = 7;
export const SNIPER_REST = 2.5; // it rests this long between shots
const SNIPER_LOSE = 0.3; // lose sight of you for this long and it stops aiming

export const SPRING_SPEED = 1000;
export const SPRING_ENTER = END_RADIUS + 18; // how close to a spring pad you have to touch it
export const SPRING_GRIP = 5;
const SPRING_REST = 0.8;

export const TUBE_GRAB = 20; // touch this close to the middle of a tube's end
export const TUBE_SPEED = 600; // whooshing through a tube
const TUBE_REST = 1; // a tube rests this long after you use it

export const ROBOT_RADIUS = 16; // patrol and sniper robots, for Mega Slime smashing them

/** Where (from 0 to `period`) a repeating timer is at `time`. */
function cycle(time, period) {
  return ((time % period) + period) % period;
}

/** 'quiet', 'warn' (glowing) or 'shower' for a welding torch at `time`. */
export function sparkState(torch, time) {
  const t = cycle(time + torch.offset, torch.quiet + SPARK_WARN + SPARK_SHOWER);
  if (t < torch.quiet) {
    return 'quiet';
  }
  return t < torch.quiet + SPARK_WARN ? 'warn' : 'shower';
}

/** Where a welding torch's sparks stop falling: the top of the first solid tile below. */
export function sparkBottom(level, torch) {
  for (let row = torch.row + 1; row < level.height; row++) {
    if (isSolidKind(tileAt(level, torch.col, row))) {
      return row * TILE;
    }
  }
  return level.pixelHeight;
}

/**
 * The welding torches (") in a level, with their timings: each one waits
 * `quiet` seconds between showers (default SPARK_QUIET), and they take turns.
 * `def.sparkTimings[i]` can change the i-th torch's ({ quiet, offset }).
 */
export function weldingTorches(level) {
  const timings = level.def.sparkTimings || [];
  return level.torches.map((t, i) => ({
    ...t,
    quiet: SPARK_QUIET,
    offset: (i * SPARK_STAGGER) % (SPARK_QUIET + SPARK_WARN + SPARK_SHOWER),
    ...timings[i],
  }));
}

/** Which way a robot arm (`def.arms[i]`) tosses you: a direction from BOOSTER_DIRS. */
export function armToss(level, i) {
  const toss = (level.def.arms || [])[i] || {};
  const dir = toss.toss || 'up';
  return { dir, speed: toss.speed || ARM_TOSS_SPEED, ...BOOSTER_DIRS[dir] };
}

/**
 * Where a slime tossed by a robot arm from `from` ends up (or null if it
 * would land somewhere deadly). The level tests use this to check that a
 * toss is only ever a setback.
 */
export function simulateToss(level, from, toss) {
  return simulateShot(
    level,
    from,
    Math.atan2(toss.y, toss.x),
    4,
    toss.speed || ARM_TOSS_SPEED,
    ARM_GRIP
  );
}

/** Where a robot arm swings a slime it grabbed before tossing it (toward its toss side). */
export function armSwingSpot(level, arm, toss) {
  const swing = { x: arm.x + toss.x * ARM_REACH * 0.5, y: arm.y + toss.y * ARM_REACH * 0.5 };
  return castCircle(level, arm, swing, END_RADIUS, 4);
}

/** Blast off from a spring pad and see where the slime sticks (or null). */
export function simulateSpring(level, spring) {
  return simulateShot(level, spring, spring.angle, 4, SPRING_SPEED, SPRING_GRIP);
}

/** Is the straight line from `a` to `b` clear of anything solid? */
export function clearLine(level, a, b) {
  const d = dist(a, b);
  const steps = Math.max(1, Math.ceil(d / 8));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const col = Math.floor((a.x + (b.x - a.x) * t) / TILE);
    const row = Math.floor((a.y + (b.y - a.y) * t) / TILE);
    if (isSolidKind(tileAt(level, col, row))) {
      return false;
    }
  }
  return true;
}

/** Which way is "out" for something sitting in cell (col, row): away from its floor, wall or ceiling. */
function mountNormal(level, col, row) {
  const solid = (dc, dr) => isSolidKind(tileAt(level, col + dc, row + dr));
  if (solid(0, 1) || isPlatformKind(tileAt(level, col, row + 1))) {
    return { x: 0, y: -1 };
  }
  if (solid(0, -1)) {
    return { x: 0, y: 1 };
  }
  if (solid(-1, 0)) {
    return { x: 1, y: 0 };
  }
  return solid(1, 0) ? { x: -1, y: 0 } : { x: 0, y: -1 };
}

/** The angle of a patrol robot's searchlight right now (it sweeps up and down). */
export function searchlightAngle(robot, time) {
  // Pointing the way it walks, tipped down a little, sweeping up and down.
  const base = robot.dir > 0 ? 0.18 : Math.PI - 0.18;
  return base + Math.sin(time * PATROL_SWEEP_SPEED + robot.col) * PATROL_SWEEP * robot.dir;
}

/** Where a patrol robot's searchlight shines from. */
export function searchlightEye(robot) {
  return { x: robot.x + robot.dir * 10, y: robot.y - 12 };
}

/** Is point `p` lit up by a patrol robot's searchlight right now? */
export function inSearchlight(level, robot, time, p) {
  const eye = searchlightEye(robot);
  const d = dist(eye, p);
  if (d > PATROL_SEE || d < 1) {
    return false;
  }
  const angle = Math.atan2(p.y - eye.y, p.x - eye.x);
  let diff = Math.abs(angle - searchlightAngle(robot, time)) % (Math.PI * 2);
  if (diff > Math.PI) {
    diff = Math.PI * 2 - diff;
  }
  return diff < PATROL_CONE && clearLine(level, eye, p);
}

export class RobotsStuff {
  /**
   * `sky` is the level's SkyStuff, which moves the robot helpers and lifts
   * (they're floating platforms), and checks what's still holding the slime
   * up when an alarm door opens.
   */
  constructor(level, sky = null) {
    this.level = level;
    this.sky = sky;
    this.arms = level.robotArms.map((a, i) => {
      const normal = mountNormal(level, a.col, a.row);
      const rest = { x: a.x + normal.x * 22, y: a.y + normal.y * 22 };
      return {
        ...a,
        normal,
        rest,
        claw: { ...rest },
        toss: armToss(level, i),
        state: 'idle',
        timer: 0,
        aim: null,
        broken: false,
      };
    });
    this.inArm = null; // index of the arm holding the slime
    this.torches = weldingTorches(level).map(t => ({
      ...t,
      state: 'quiet',
      bottom: sparkBottom(level, t),
    }));
    this.patrols = level.patrols.map(p => ({ ...p, home: p.x, dir: 1, broken: false }));
    this.alarm = 0; // seconds left on the alarm
    this.alarmRest = 0;
    this.doors = level.alarmDoors.map(d => ({ ...d, shut: false }));
    this.snipers = level.snipers.map(s => ({
      ...s,
      state: 'idle',
      timer: 0,
      lost: 0,
      dot: null,
      broken: false,
    }));
    this.bolts = [];
    this.springs = level.springs.map(s => ({ ...s, cooldown: 0, flash: 0 }));
    this.tubes = (level.def.tubes || []).map(t => ({
      path: cablePath(t),
      used: false,
      rest: 0,
      glow: 0, // just for looks: the tube glows for a moment after you whoosh through
    }));
    // While whooshing through a tube: { tube, points, along }.
    this.riding = null;
    this.time = 0;
    this.events = [];
  }

  /** Robot helpers, for drawing (SkyStuff moves them). */
  get helpers() {
    return this.sky ? this.sky.islands.filter(i => i.helper) : [];
  }

  /** Lifts, for drawing (SkyStuff moves them). */
  get lifts() {
    return this.sky ? this.sky.islands.filter(i => i.lift) : [];
  }

  /** Is the slime settled somewhere, free to touch things (not falling or carried)? */
  free(slime) {
    return !slime.isFalling && !slime.frozen;
  }

  /**
   * Advance everything. `time` is the level time (the welding torches run on
   * it). Returns 'sparks' or 'sniper' if the slime got hurt, otherwise null.
   */
  update(dt, slime, time = this.time + dt) {
    this.time = time;
    // Something else let go of the slime (like splitting in two): the arm lets go.
    if (this.inArm !== null && !slime.frozen) {
      this.arms[this.inArm].state = 'rest';
      this.arms[this.inArm].timer = ARM_REST;
      this.inArm = null;
    }
    const pts = slime.frozen ? [] : slime.bodyPoints(8);
    this.updateArms(dt, slime, pts);
    this.updatePatrols(dt, slime, pts);
    this.updateAlarm(dt, slime);
    this.updateSprings(dt, slime);
    this.updateTubes(dt, slime);
    const sparks = this.updateTorches(pts);
    const sniper = this.updateSnipers(dt, slime, pts);
    return sparks || sniper;
  }

  // ------------------------------------------------------------ robot arms

  updateArms(dt, slime, pts) {
    this.arms.forEach((arm, i) => {
      if (arm.broken) {
        return;
      }
      arm.timer -= dt;
      if (arm.state === 'idle') {
        const near = pts.find(p => dist(p, arm) < ARM_REACH && clearLine(this.level, arm, p));
        if (near && this.inArm === null) {
          // Whirr! It pulls back to grab where you are now.
          arm.state = 'windup';
          arm.timer = ARM_WINDUP;
          arm.aim = { x: near.x, y: near.y };
          this.events.push({ type: 'armWindup', x: arm.x, y: arm.y });
        }
        this.moveClaw(arm, arm.rest, dt * 6);
      } else if (arm.state === 'windup') {
        // Pulled back the other way, ready to lunge.
        const d = dist(arm, arm.aim) || 1;
        const back = {
          x: arm.x - ((arm.aim.x - arm.x) / d) * 14 + arm.normal.x * 10,
          y: arm.y - ((arm.aim.y - arm.y) / d) * 14 + arm.normal.y * 10,
        };
        this.moveClaw(arm, back, dt * 8);
        if (arm.timer <= 0) {
          arm.state = 'lunge';
          arm.timer = ARM_LUNGE;
          arm.from = { ...arm.claw };
        }
      } else if (arm.state === 'lunge') {
        const k = Math.min(1, 1 - arm.timer / ARM_LUNGE);
        const target = castCircle(this.level, arm, arm.aim, 8, 4);
        arm.claw = {
          x: arm.from.x + (target.x - arm.from.x) * k,
          y: arm.from.y + (target.y - arm.from.y) * k,
        };
        const got =
          this.inArm === null && pts.some(p => dist(p, arm.claw) < ARM_GRAB + END_RADIUS * 0.6);
        if (got) {
          // Got you! It swings you around...
          arm.state = 'hold';
          arm.timer = ARM_HOLD;
          this.inArm = i;
          slime.holdAt(arm.claw.x, arm.claw.y);
          this.events.push({ type: 'armGrab', x: arm.claw.x, y: arm.claw.y });
        } else if (arm.timer <= 0) {
          arm.state = 'rest';
          arm.timer = ARM_MISS_REST;
          this.events.push({ type: 'armMiss', x: arm.claw.x, y: arm.claw.y });
        }
      } else if (arm.state === 'hold') {
        // ...over to the side it tosses toward...
        const spot = armSwingSpot(this.level, arm, arm.toss);
        this.moveClaw(arm, spot, dt * 10);
        slime.holdAt(arm.claw.x, arm.claw.y);
        if (arm.timer <= 0) {
          // ...and WHEE, away you go! You stick to the first sticky thing you hit.
          this.inArm = null;
          arm.state = 'rest';
          arm.timer = ARM_REST;
          slime.launch(
            arm.claw.x,
            arm.claw.y,
            arm.toss.x * arm.toss.speed,
            arm.toss.y * arm.toss.speed,
            ARM_GRIP
          );
          this.events.push({ type: 'armToss', x: arm.claw.x, y: arm.claw.y });
        }
      } else if (arm.state === 'rest') {
        this.moveClaw(arm, arm.rest, dt * 4);
        if (arm.timer <= 0) {
          arm.state = 'idle';
        }
      }
    });
  }

  /** Move an arm's claw part of the way (`k`, 0 to 1) toward `target`. */
  moveClaw(arm, target, k) {
    const t = Math.min(1, k);
    arm.claw.x += (target.x - arm.claw.x) * t;
    arm.claw.y += (target.y - arm.claw.y) * t;
  }

  // -------------------------------------------------------- welding torches

  /** Is a shower of sparks from `torch` falling on point `p`? */
  inShower(torch, p) {
    return (
      Math.abs(p.x - torch.x) < SPARK_HALF + END_RADIUS * 0.5 &&
      p.y > (torch.row + 1) * TILE &&
      p.y < torch.bottom + END_RADIUS * 0.5
    );
  }

  updateTorches(pts) {
    let hurt = null;
    for (const torch of this.torches) {
      const state = sparkState(torch, this.time);
      if (state !== torch.state) {
        torch.state = state;
        if (state === 'warn') {
          this.events.push({ type: 'sparkWarn', x: torch.x, y: torch.y });
        } else if (state === 'shower') {
          // The sparks fall until they hit something (helpers and lifts move, so look again).
          torch.bottom = sparkBottom(this.level, torch);
          this.events.push({ type: 'sparks', x: torch.x, y: torch.y });
        }
      }
      if (state === 'shower' && pts.some(p => this.inShower(torch, p))) {
        hurt = 'sparks';
      }
    }
    return hurt;
  }

  // ---------------------------------------------------- patrol robots and alarms

  updatePatrols(dt, slime, pts) {
    for (const robot of this.patrols) {
      if (robot.broken) {
        continue;
      }
      // Walk back and forth along the floor, turning around at walls and edges.
      const ahead = robot.x + robot.dir * (ROBOT_RADIUS + 4);
      const col = Math.floor(ahead / TILE);
      // (They won't walk through an alarm door, even when it's open.)
      const door = this.doors.some(d => d.col === col && d.row === robot.row);
      const blocked = door || isSolidKind(tileAt(this.level, col, robot.row));
      const below = tileAt(this.level, col, robot.row + 1);
      if (blocked || !(isSolidKind(below) || isPlatformKind(below))) {
        robot.dir = -robot.dir;
      } else {
        robot.x += robot.dir * PATROL_SPEED * dt;
      }
      // Spotted! The searchlight never hurts, but it sets off the alarm.
      const seen = pts.some(p => inSearchlight(this.level, robot, this.time, p));
      if (seen && this.alarm <= 0 && this.alarmRest <= 0) {
        this.soundAlarm(robot, slime);
      }
    }
  }

  /** WEE-OO WEE-OO! The alarm doors slam shut for a while. */
  soundAlarm(robot, slime) {
    this.alarm = ALARM_TIME;
    this.events.push({ type: 'alarm', x: robot.x, y: robot.y });
    this.shutDoors(slime);
  }

  /** Slam shut every alarm door the slime isn't in the way of. */
  shutDoors(slime) {
    const pts = slime.bodyPoints(8);
    let slammed = false;
    for (const door of this.doors) {
      const inWay = pts.some(p => touchesTile(p, END_RADIUS, door.col, door.row));
      if (!door.shut && !inWay) {
        door.shut = true;
        this.level.tiles[door.row][door.col] = TileKind.ALARM_DOOR;
        slammed = true;
      }
    }
    if (slammed) {
      this.events.push({ type: 'doorSlam' });
    }
  }

  updateAlarm(dt, slime) {
    this.alarmRest = Math.max(0, this.alarmRest - dt);
    if (this.alarm <= 0) {
      return;
    }
    this.alarm -= dt;
    if (this.alarm > 0) {
      // A door the slime was in the way of slams as soon as it's clear.
      if (this.doors.some(d => !d.shut)) {
        this.shutDoors(slime);
      }
      return;
    }
    this.alarm = 0;
    this.alarmRest = ALARM_REST;
    this.openDoors(slime);
    this.events.push({ type: 'alarmOff' });
  }

  /** The alarm stopped: the doors slide open again. */
  openDoors(slime) {
    for (const door of this.doors) {
      if (door.shut) {
        door.shut = false;
        this.level.tiles[door.row][door.col] = TileKind.EMPTY;
      }
    }
    // Anything leaning on a door lets go.
    if (this.sky) {
      this.sky.checkSupport(slime);
    } else if (this.free(slime)) {
      slime.checkSupport(this.level);
    }
  }

  // --------------------------------------------------------- sniper robots

  updateSnipers(dt, slime, pts) {
    let hurt = null;
    const target = pts.length ? slime.center : null;
    for (const s of this.snipers) {
      if (s.broken) {
        continue;
      }
      s.timer -= dt;
      const sees =
        target !== null && dist(s, target) < SNIPER_RANGE && clearLine(this.level, s, target);
      if (s.state === 'idle') {
        if (sees && s.timer <= 0) {
          // A red dot appears on you...
          s.state = 'aim';
          s.timer = SNIPER_AIM;
          s.lost = 0;
          s.dot = { ...target };
          this.events.push({ type: 'sniperAim', x: s.x, y: s.y });
        }
      } else if (s.state === 'aim') {
        // ...and follows you around, so keep moving!
        s.lost = sees ? 0 : s.lost + dt;
        if (sees) {
          s.dot = { ...target };
        }
        if (s.lost > SNIPER_LOSE) {
          s.state = 'idle';
          s.timer = 0.5;
          s.dot = null;
        } else if (s.timer <= 0) {
          // It stops where you were...
          s.state = 'lock';
          s.timer = SNIPER_LOCK;
          this.events.push({ type: 'sniperLock', x: s.x, y: s.y });
        }
      } else if (s.state === 'lock') {
        if (s.timer <= 0) {
          // ...ZAP! A laser bolt flies at that spot.
          this.fire(s, s.dot);
          s.state = 'idle';
          s.timer = SNIPER_REST;
          s.dot = null;
        }
      }
    }
    for (const b of this.bolts) {
      const steps = Math.max(1, Math.ceil((BOLT_SPEED * dt) / 6));
      for (let i = 0; i < steps && !b.gone; i++) {
        b.x += (b.vx * dt) / steps;
        b.y += (b.vy * dt) / steps;
        if (pts.some(p => dist(p, b) < BOLT_RADIUS + END_RADIUS * 0.6)) {
          hurt = 'sniper';
          b.gone = true;
        } else if (
          isSolidKind(tileAt(this.level, Math.floor(b.x / TILE), Math.floor(b.y / TILE)))
        ) {
          b.gone = true;
          this.events.push({ type: 'boltHit', x: b.x, y: b.y });
        }
      }
      if (b.x < -TILE || b.x > this.level.pixelWidth + TILE || b.y < -TILE) {
        b.gone = true;
      }
      if (b.y > this.level.pixelHeight + TILE) {
        b.gone = true;
      }
    }
    this.bolts = this.bolts.filter(b => !b.gone);
    return hurt;
  }

  /** Fire a laser bolt from sniper `s` straight at `target` (it keeps going past it). */
  fire(s, target) {
    const d = dist(s, target) || 1;
    const dx = (target.x - s.x) / d;
    const dy = (target.y - s.y) / d;
    this.bolts.push({
      x: s.x + dx * 18,
      y: s.y + dy * 18,
      vx: dx * BOLT_SPEED,
      vy: dy * BOLT_SPEED,
    });
    this.events.push({ type: 'sniperFire', x: s.x, y: s.y });
  }

  // ------------------------------------------------------------- spring pads

  updateSprings(dt, slime) {
    for (const s of this.springs) {
      s.cooldown = Math.max(0, s.cooldown - dt);
      s.flash = Math.max(0, s.flash - dt);
    }
    if (!this.free(slime)) {
      return;
    }
    const s = this.springs.find(
      s => s.cooldown <= 0 && slime.ends.some(e => dist(e, s) < SPRING_ENTER)
    );
    if (s) {
      // BOING! Off you go, sticking to the first sticky thing you hit.
      const cos = Math.cos(s.angle);
      const sin = Math.sin(s.angle);
      slime.launch(
        s.x + cos * 30,
        s.y + sin * 30,
        cos * SPRING_SPEED,
        sin * SPRING_SPEED,
        SPRING_GRIP
      );
      s.cooldown = SPRING_REST;
      s.flash = 0.5;
      this.events.push({ type: 'boing', x: s.x, y: s.y });
    }
  }

  // -------------------------------------------------------- pneumatic tubes

  updateTubes(dt, slime) {
    for (const t of this.tubes) {
      t.rest = Math.max(0, t.rest - dt);
      t.glow = Math.max(0, t.glow - dt);
    }
    if (this.riding) {
      const ride = this.riding;
      ride.along += TUBE_SPEED * dt;
      const p = pointAlong(ride.points, ride.along);
      if (p) {
        slime.holdAt(p.x, p.y);
        return;
      }
      // ...and FOOMP, out of the other end!
      const end = ride.points[ride.points.length - 1];
      slime.spawn(end);
      ride.tube.glow = 0.6;
      this.riding = null;
      this.events.push({ type: 'tubeOut', x: end.x, y: end.y });
      return;
    }
    if (!this.free(slime)) {
      return;
    }
    const touching = p => slime.ends.some(e => dist(e, p) < TUBE_GRAB + END_RADIUS);
    for (const tube of this.tubes) {
      const a = tube.path[0];
      const b = tube.path[tube.path.length - 1];
      const onA = touching(a);
      const onB = touching(b);
      if (tube.used) {
        // It works again once you've moved away from both ends.
        if (!onA && !onB && tube.rest <= 0) {
          tube.used = false;
        }
        continue;
      }
      if (onA || onB) {
        // Whoosh! Sucked into one end and along the tube...
        const points = onA ? tube.path : tube.path.slice().reverse();
        tube.used = true;
        tube.rest = TUBE_REST;
        this.riding = { tube, points, along: 0 };
        slime.holdAt(points[0].x, points[0].y);
        this.events.push({ type: 'tubeIn', x: points[0].x, y: points[0].y });
        return;
      }
    }
  }

  // ---------------------------------------------------------------- general

  /**
   * Mega Slime stomping around: smash every robot arm, patrol robot and
   * sniper robot touching the rectangle `rect`. They're gone for good.
   * Returns how many it smashed.
   */
  smashRobots(rect) {
    let smashed = 0;
    const near = (p, r) => nearRect(p, rect, r);
    for (const list of [this.arms, this.patrols, this.snipers]) {
      for (const robot of list) {
        if (!robot.broken && near(robot, ROBOT_RADIUS)) {
          robot.broken = true;
          smashed++;
          this.events.push({ type: 'smashed', x: robot.x, y: robot.y });
          if (list === this.arms && this.inArm === this.arms.indexOf(robot)) {
            this.inArm = null;
          }
        }
      }
    }
    return smashed;
  }

  /**
   * After really dying: arms and snipers start over, the alarm stops (the
   * doors open), and you let go of any tube. Smashed robots stay smashed.
   */
  resetAfterDeath() {
    this.inArm = null;
    for (const arm of this.arms) {
      arm.state = 'rest';
      arm.timer = 1;
    }
    for (const s of this.snipers) {
      s.state = 'idle';
      s.timer = 1;
      s.dot = null;
    }
    this.bolts = [];
    this.riding = null;
    for (const t of this.tubes) {
      t.used = false;
    }
    for (const robot of this.patrols) {
      robot.x = robot.home;
    }
    this.alarm = 0;
    this.alarmRest = 0;
    for (const door of this.doors) {
      if (door.shut) {
        door.shut = false;
        this.level.tiles[door.row][door.col] = TileKind.EMPTY;
      }
    }
  }

  takeEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }
}

/** Is point `p` within `r` of a rectangle { left, top, right, bottom }? */
function nearRect(p, rect, r) {
  const dx = Math.max(rect.left - p.x, 0, p.x - rect.right);
  const dy = Math.max(rect.top - p.y, 0, p.y - rect.bottom);
  return dx * dx + dy * dy < r * r;
}

/** Is a circle at `p` touching tile (col, row)? */
function touchesTile(p, r, col, row) {
  return nearRect(
    p,
    { left: col * TILE, top: row * TILE, right: (col + 1) * TILE, bottom: (row + 1) * TILE },
    r
  );
}
