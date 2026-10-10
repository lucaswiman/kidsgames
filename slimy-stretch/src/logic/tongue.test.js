import { describe, expect, it } from 'vitest';
import { parseLevel } from './level.js';
import { Tongue } from './tongue.js';
import { MAX_STRETCH } from './constants.js';

const level = parseLevel({
  id: 'tongue',
  type: 'normal',
  map: ['############', '#.........E#', '#.S.....M..#', '############'],
});
const boxes = level.boxes.map(b => ({ ...b, eaten: false }));
const head = { x: 2.5 * 48, y: 3 * 48 - 15 };

function run(tongue, seconds) {
  let eaten = null;
  for (let t = 0; t < seconds && eaten === null; t += 1 / 60) {
    eaten = tongue.update(1 / 60, level, head, boxes);
  }
  return eaten;
}

describe('Tongue', () => {
  it('reaches toward the finger but no farther than a stretch', () => {
    const tongue = new Tongue();
    tongue.start(head, { x: head.x + 2000, y: head.y - 40 });
    run(tongue, 0.3);
    expect(Math.hypot(tongue.tip.x - head.x, tongue.tip.y - head.y)).toBeLessThanOrEqual(
      MAX_STRETCH + 1
    );
  });

  it('eats a metal box it touches, then goes back in', () => {
    const tongue = new Tongue();
    tongue.start(head, { x: 8.5 * 48, y: 2.5 * 48 });
    // The box is 6 tiles away, too far: move closer first.
    const near = { x: 6.5 * 48, y: 3 * 48 - 15 };
    tongue.start(near, { x: 8.5 * 48, y: 2.5 * 48 });
    let eaten = null;
    for (let t = 0; t < 1 && eaten === null; t += 1 / 60) {
      eaten = tongue.update(1 / 60, level, near, boxes);
    }
    expect(eaten).toBe(0);
    expect(tongue.active).toBe(false);
  });

  it('snaps back when you let go', () => {
    const tongue = new Tongue();
    tongue.start(head, { x: head.x, y: head.y - 100 });
    run(tongue, 0.2);
    tongue.release();
    expect(run(tongue, 1)).toBe(null);
    expect(tongue.active).toBe(false);
  });
});
