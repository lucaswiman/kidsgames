import { describe, expect, it } from 'vitest';
import { LEVELS, WORLDS } from './levels.js';
import { parseLevel, TileKind, tileAt } from '../logic/level.js';
import { swingingVines, ZIP_HANG } from '../logic/jungle.js';
import { furnitureSize } from '../logic/haunted.js';
import { cablePath, CURSOR_HANG, popupCells, popupWindows } from '../logic/computer.js';
import { canGetBackFrom, solveLevel } from '../logic/solver.js';
import { END_RADIUS, ITEM_RADIUS, TILE } from '../logic/constants.js';
import { chaserPosition } from '../logic/hazards.js';
import { simulateDrop } from '../logic/warehouse.js';
import { ASTEROID_WARN, padCenter, simulateBooster } from '../logic/space.js';
import { CANE_LENGTH, CANE_THICK, caneShape, rainBottom, ropeDrop } from '../logic/candy.js';
import { isSolidKind } from '../logic/level.js';
import {
  balloonPath,
  BASKET_SIT,
  KITE_STRING,
  RAINBOW_RIDE,
  rainbowArc,
  sleepingClouds,
} from '../logic/sky.js';

// A kid needs about this many seconds per drag when racing a chaser.
const SECONDS_PER_DRAG = 2.2;

describe('levels', () => {
  it('every world has 3 to 5 levels', () => {
    for (const world of WORLDS) {
      const count = LEVELS.filter(l => l.world === world.id).length;
      expect(count).toBeGreaterThanOrEqual(3);
      expect(count).toBeLessThanOrEqual(5);
    }
  });

  it('level ids are unique', () => {
    expect(new Set(LEVELS.map(l => l.id)).size).toBe(LEVELS.length);
  });

  it('bosses are only in worlds that are multiples of 3, at the end of the world', () => {
    WORLDS.forEach((world, w) => {
      const levels = LEVELS.filter(l => l.world === world.id);
      const bosses = levels.filter(l => l.type === 'boss');
      if ((w + 1) % 3 === 0) {
        expect(bosses.length).toBe(1);
        expect(levels[levels.length - 1].type).toBe('boss');
        expect(parseLevel(bosses[0]).robot).toBeTruthy();
      } else {
        expect(bosses.length).toBe(0);
      }
    });
  });

  for (const def of LEVELS) {
    describe(`${def.id} ${def.name}`, () => {
      const level = parseLevel(def);

      it('has what its type needs', () => {
        if (def.type === 'collect') {
          expect(level.cores.length).toBeGreaterThan(0);
        } else {
          expect(level.cores.length).toBe(0);
        }
        if (def.type === 'escape') {
          expect(def.chaser).toBeTruthy();
        }
      });

      it('has its vines, ziplines and logs in sensible places', () => {
        for (const vine of swingingVines(def)) {
          // A vine hangs from a branch (or a wall), and a chandelier from the ceiling.
          const [col, row] = vine.at;
          expect(tileAt(level, col, row - 1)).not.toBe(TileKind.EMPTY);
          expect(tileAt(level, col, row)).toBe(TileKind.EMPTY);
        }
        for (const zip of def.ziplines || []) {
          // A zipline drops you somewhere safe.
          const [col, row] = zip.to;
          const end = { x: (col + 0.5) * 48, y: (row + 0.5) * 48 + ZIP_HANG };
          expect(simulateDrop(level, end)).toBeTruthy();
        }
        for (const log of def.logs || []) {
          // Logs float on the river.
          for (let col = log.from; col <= log.to; col++) {
            expect(tileAt(level, col, log.row)).toBe(TileKind.WATER);
          }
        }
      });

      it('has its sky rides going somewhere safe', () => {
        for (const balloon of def.balloons || []) {
          // A balloon drops you off somewhere safe.
          const path = balloonPath(balloon);
          const end = path[path.length - 1];
          expect(simulateDrop(level, { x: end.x, y: end.y - BASKET_SIT })).toBeTruthy();
        }
        for (const rainbow of def.rainbows || []) {
          // So does the end of a rainbow.
          const arc = rainbowArc(rainbow);
          const end = arc[arc.length - 1];
          expect(simulateDrop(level, { x: end.x, y: end.y - RAINBOW_RIDE })).toBeTruthy();
        }
        for (const island of def.islands || []) {
          // A floating island's path is open sky.
          const width = island.width || 3;
          const [c0, c1] = [island.from[0], island.to[0]].sort((a, b) => a - b);
          const [r0, r1] = [island.from[1], island.to[1]].sort((a, b) => a - b);
          for (let row = r0; row <= r1; row++) {
            for (let col = c0; col < c1 + width; col++) {
              expect(tileAt(level, col, row)).toBe(TileKind.EMPTY);
            }
          }
        }
        for (const kite of level.kites) {
          // A kite needs wind, and the end of its string hangs in open sky.
          expect(def.wind).toBeTruthy();
          const string = { x: kite.x, y: kite.y + KITE_STRING };
          expect(tileAt(level, Math.floor(string.x / 48), Math.floor(string.y / 48))).toBe(
            TileKind.EMPTY
          );
        }
      });

      it('has its space things in sensible places', () => {
        // Something that drops you lands safely, the normal way up (or upside
        // down, in a level with gravity switches).
        const gravities = level.switches.length ? [1, -1] : [1];
        const landsSafely = (from, simulate = simulateDrop) =>
          gravities.some(gravity => simulate({ ...level, gravity }, from));
        for (const t of def.teleporters || []) {
          // Each teleporter pad drops you somewhere safe by the other one.
          expect(landsSafely(padCenter(t.a))).toBe(true);
          expect(landsSafely(padCenter(t.b))).toBe(true);
          expect(tileAt(level, ...t.a)).toBe(TileKind.EMPTY);
          expect(tileAt(level, ...t.b)).toBe(TileKind.EMPTY);
        }
        // Each rocket booster blasts you somewhere you stick, safely.
        expect((def.boosters || []).length).toBe(level.boosters.length);
        for (const b of level.boosters) {
          expect(landsSafely(b, simulateBooster)).toBe(true);
        }
        for (const ufo of def.ufos || []) {
          // A UFO's drop spot is a setback, never a fall to your doom.
          const [col, row] = ufo.drop;
          expect(simulateDrop(level, { x: (col + 0.5) * 48, y: (row + 0.5) * 48 })).toBeTruthy();
          for (let c = ufo.from; c <= ufo.to; c++) {
            expect(tileAt(level, c, ufo.row)).toBe(TileKind.EMPTY);
          }
        }
        for (const lane of def.asteroids || []) {
          // Asteroids come in from an open edge of the level, with time to warn you first.
          const edge = lane.dir < 0 ? level.width - 1 : 0;
          expect(tileAt(level, edge, lane.row)).toBe(TileKind.EMPTY);
          expect(lane.every || 5).toBeGreaterThan(ASTEROID_WARN + 2);
        }
        for (const lift of def.elevators || []) {
          // A space elevator's shaft is open.
          const [r0, r1] = [lift.from, lift.to].sort((a, b) => a - b);
          for (let row = r0; row <= r1; row++) {
            for (let col = lift.col; col < lift.col + (lift.width || 2); col++) {
              expect(tileAt(level, col, row)).toBe(TileKind.EMPTY);
            }
          }
        }
        for (const zone of level.zeroG) {
          expect(zone.right).toBeLessThanOrEqual(level.pixelWidth);
          expect(zone.bottom).toBeLessThanOrEqual(level.pixelHeight);
        }
      });

      it('has its candy things in sensible places', () => {
        for (const rope of level.ropes) {
          // A licorice rope hangs from something and drops you off somewhere safe.
          expect(isSolidKind(tileAt(level, rope.col, rope.top / 48 - 1))).toBe(true);
          expect(simulateDrop(level, ropeDrop(rope))).toBeTruthy();
        }
        for (const cane of level.candyCanes) {
          // A candy cane hangs from the ceiling.
          expect(isSolidKind(tileAt(level, cane.col, cane.row - 1))).toBe(true);
        }
        for (const rect of def.iceWalls || []) {
          // King Claw's icy walls are walls in the map.
          for (let row = rect.from[1]; row <= rect.to[1]; row++) {
            for (let col = rect.from[0]; col <= rect.to[0]; col++) {
              expect(tileAt(level, col, row)).toBe(TileKind.WALL);
            }
          }
        }
      });

      it('has its haunted things in sensible places', () => {
        for (const f of def.furniture || []) {
          // Haunted furniture slides through open space, and nothing to collect is in its way.
          const { w, h } = furnitureSize(f);
          const [c0, c1] = [f.at[0], f.to[0]].sort((a, b) => a - b);
          const [r0, r1] = [f.at[1], f.to[1]].sort((a, b) => a - b);
          for (let row = r0; row < r1 + h; row++) {
            for (let col = c0; col < c1 + w; col++) {
              expect(tileAt(level, col, row)).toBe(TileKind.EMPTY);
              const inside = p => Math.floor(p.x / TILE) === col && Math.floor(p.y / TILE) === row;
              expect([...level.tokens, ...level.cores].some(inside)).toBe(false);
            }
          }
        }
        for (const lift of def.dumbwaiters || []) {
          // A dumbwaiter's shaft is open.
          const [r0, r1] = [lift.from, lift.to].sort((a, b) => a - b);
          for (let row = r0; row <= r1; row++) {
            for (let col = lift.col; col < lift.col + (lift.width || 1); col++) {
              expect(tileAt(level, col, row)).toBe(TileKind.EMPTY);
            }
          }
        }
        for (const pair of def.bookcases || []) {
          // Each bookcase stands on the floor and spins you out safely by the other one.
          for (const [col, row] of [pair.a, pair.b]) {
            expect(tileAt(level, col, row)).toBe(TileKind.EMPTY);
            expect(tileAt(level, col, row - 1)).toBe(TileKind.EMPTY);
            expect(isSolidKind(tileAt(level, col, row + 1))).toBe(true);
            expect(simulateDrop(level, padCenter([col, row]))).toBeTruthy();
          }
        }
      });

      it('has its computer things in sensible places', () => {
        const empty = (col, row) => tileAt(level, col, row) === TileKind.EMPTY;
        for (const popup of popupWindows(def)) {
          // A pop-up window opens in empty space.
          for (const c of popupCells(popup)) {
            expect(empty(c.col, c.row)).toBe(true);
          }
        }
        for (const cable of def.cables || []) {
          // Each cable plug is in an empty cell, and drops you somewhere safe.
          const path = cablePath(cable);
          for (const [col, row] of [cable.a, cable.b]) {
            expect(empty(col, row)).toBe(true);
          }
          expect(simulateDrop(level, path[0])).toBeTruthy();
          expect(simulateDrop(level, path[path.length - 1])).toBeTruthy();
        }
        for (const cursor of def.cursors || []) {
          // The mouse cursor drops you somewhere safe.
          const drop = padCenter(cursor.drop);
          expect(simulateDrop(level, { x: drop.x, y: drop.y + CURSOR_HANG })).toBeTruthy();
        }
        for (const pads of def.copyPads || []) {
          // Copy-paste pads lie on the floor, and the copy of you lands safely.
          for (const [col, row] of [pads.copy, pads.paste]) {
            expect(empty(col, row)).toBe(true);
            expect(isSolidKind(tileAt(level, col, row + 1))).toBe(true);
          }
          expect(simulateDrop(level, padCenter(pads.paste))).toBeTruthy();
        }
        for (const cell of [...level.viruses, ...level.circuitCells]) {
          // Viruses crawl, and wires run, along a floor, wall or ceiling.
          const next = [
            [0, 1],
            [0, -1],
            [1, 0],
            [-1, 0],
          ].some(([dc, dr]) => isSolidKind(tileAt(level, cell.col + dc, cell.row + dr)));
          expect(next).toBe(true);
        }
      });

      it('never rains sour candy on ice cream (you have to stand on it)', () => {
        level.tiles.forEach((row, r) =>
          row.forEach((kind, col) => {
            if (kind !== TileKind.SOUR_CLOUD) {
              return;
            }
            const bottom = rainBottom(level, r, col) / TILE;
            for (let below = r + 1; below < bottom; below++) {
              expect(tileAt(level, col, below)).not.toBe(TileKind.ICE_CREAM);
            }
          })
        );
      });

      it('leaves room to crawl under every candy cane', () => {
        for (const cane of level.candyCanes) {
          const { pivot } = caneShape(cane, 0);
          let row = cane.row + 1;
          while (row < level.height && !isSolidKind(tileAt(level, cane.col, row))) {
            row++;
          }
          // A slime on the floor under the cane has to fit below its hook.
          const gap = row * TILE - (pivot.y + CANE_LENGTH);
          expect(gap).toBeGreaterThan(2 * END_RADIUS + CANE_THICK);
        }
      });

      it('can be finished, and every item can be reached', { timeout: 90000 }, async () => {
        // The checker is slow and never waits on anything; give vitest a turn
        // first so its messages don't time out over a long run of levels.
        await new Promise(resolve => setTimeout(resolve, 0));
        const result = solveLevel(level);
        expect(result.exit).toBe(true);
        expect(result.tokens.every(Boolean)).toBe(true);
        expect(result.cores.every(Boolean)).toBe(true);
        // You have to collect every core (or pearl, crystal...), so none of them
        // can leave you stuck somewhere with no way back to the exit.
        for (const core of level.cores.filter(c => c.inBox === undefined)) {
          await new Promise(resolve => setTimeout(resolve, 0));
          expect(canGetBackFrom(level, result, core, ITEM_RADIUS)).toBe(true);
        }
        expect(result.checkpoints.every(Boolean)).toBe(true);
        expect(result.keys.every(Boolean)).toBe(true);
        expect(result.chests.every(Boolean)).toBe(true);
        expect(result.slimeMachines.every(Boolean)).toBe(true);
        // Every sleeping cloud can be woken up with a slime shot.
        expect(result.sleepingClouds).toHaveLength(sleepingClouds(level).length);
        expect(result.sleepingClouds.every(Boolean)).toBe(true);
        // Spare blobs a seagull barfs up must turn up somewhere you can get to.
        expect(result.blobSpots.every(Boolean)).toBe(true);
        // Every alien plant can be withered with a thrown moon rock.
        expect(result.plants).toHaveLength(level.plants.length);
        expect(result.plants.every(Boolean)).toBe(true);
        for (const gull of def.gulls || []) {
          if (gull.nice) {
            // Nice seagulls drop you somewhere safe.
            const [col, row] = gull.drop;
            expect(simulateDrop(level, { x: (col + 0.5) * 48, y: (row + 0.5) * 48 })).toBeTruthy();
          } else {
            // A level with mean seagulls needs spots for your barfed-up blobs.
            expect((def.blobSpots || []).length).toBeGreaterThanOrEqual(2);
          }
        }

        if (def.chaser) {
          // The chaser must leave enough time to reach the exit.
          let t = 0;
          while (t < 600) {
            const pos = chaserPosition(def.chaser, level, t);
            let caught;
            if (def.chaser.kind === 'rise') {
              caught = pos.y < level.exit.y + 24;
            } else if (def.chaser.kind === 'wall') {
              // The firewall's front edge reaching the door.
              caught = pos.dir > 0 ? pos.x > level.exit.x - 24 : pos.x < level.exit.x + 24;
            } else {
              caught = pos.x + pos.radius > level.exit.x - 24;
            }
            if (caught) {
              break;
            }
            t += 0.1;
          }
          expect(t).toBeGreaterThan(result.exitMoves * SECONDS_PER_DRAG);
        }
      });
    });
  }
});
