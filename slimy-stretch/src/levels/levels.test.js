import { describe, expect, it } from 'vitest';
import { LEVELS, WORLDS } from './levels.js';
import { parseLevel } from '../logic/level.js';
import { solveLevel } from '../logic/solver.js';
import { chaserPosition } from '../logic/hazards.js';

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

  it('the last level is the robot boss', () => {
    const last = LEVELS[LEVELS.length - 1];
    expect(last.type).toBe('boss');
    expect(parseLevel(last).robot).toBeTruthy();
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

      it('can be finished, and every item can be reached', { timeout: 30000 }, () => {
        const result = solveLevel(level);
        expect(result.exit).toBe(true);
        expect(result.tokens.every(Boolean)).toBe(true);
        expect(result.cores.every(Boolean)).toBe(true);
        expect(result.checkpoints.every(Boolean)).toBe(true);

        if (def.chaser) {
          // The chaser must leave enough time to reach the exit.
          let t = 0;
          while (t < 600) {
            const pos = chaserPosition(def.chaser, level, t);
            const caught =
              def.chaser.kind === 'rise'
                ? pos.y < level.exit.y + 24
                : pos.x + pos.radius > level.exit.x - 24;
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
