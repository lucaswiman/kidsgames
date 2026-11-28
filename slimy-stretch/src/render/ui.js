import { isMuted, setMuted, unlockAudio } from '../audio/sound.js';
import { loadProgress, saveProgress } from '../logic/progress.js';

export const FONT = '"Trebuchet MS", "Arial Rounded MT Bold", Arial, sans-serif';

export function textStyle(size, color = '#ffffff', extra = {}) {
  return {
    fontFamily: FONT,
    fontSize: `${size}px`,
    color,
    fontStyle: 'bold',
    stroke: '#0b2a12',
    strokeThickness: Math.max(2, Math.round(size / 8)),
    ...extra,
  };
}

/** A big rounded button that's easy to tap. */
export function makeButton(scene, x, y, label, onClick, opts = {}) {
  const width = opts.width || 220;
  const height = opts.height || 70;
  const color = opts.color ?? 0x2fae4a;
  const container = scene.add.container(x, y).setDepth(opts.depth ?? 100);
  const bg = scene.add.graphics();
  const draw = pressed => {
    bg.clear();
    bg.fillStyle(0x000000, 0.3);
    bg.fillRoundedRect(-width / 2, -height / 2 + 5, width, height, 18);
    bg.fillStyle(color, 1);
    bg.fillRoundedRect(-width / 2, -height / 2 + (pressed ? 4 : 0), width, height, 18);
    bg.lineStyle(4, 0xffffff, 0.8);
    bg.strokeRoundedRect(-width / 2, -height / 2 + (pressed ? 4 : 0), width, height, 18);
  };
  draw(false);
  const text = scene.add.text(0, 0, label, textStyle(opts.fontSize || 30)).setOrigin(0.5);
  container.add([bg, text]);
  container.setSize(width, height);
  container.setInteractive({ useHandCursor: true });
  if (opts.fixed) {
    container.setScrollFactor(0);
  }
  container.on('pointerdown', (pointer, lx, ly, event) => {
    unlockAudio();
    draw(true);
    if (event) {
      event.stopPropagation();
    }
  });
  container.on('pointerout', () => draw(false));
  container.on('pointerup', (pointer, lx, ly, event) => {
    draw(false);
    if (event) {
      event.stopPropagation();
    }
    onClick();
  });
  container.label = text;
  return container;
}

/** Small round icon button in a screen corner (pause, restart, sound). */
export function makeIconButton(scene, x, y, label, onClick) {
  return makeButton(scene, x, y, label, onClick, {
    width: 64,
    height: 64,
    fontSize: 30,
    color: 0x24304a,
    fixed: true,
    depth: 200,
  });
}

export function makeMuteButton(scene, x, y) {
  const progress = loadProgress();
  setMuted(progress.muted);
  const button = makeIconButton(scene, x, y, isMuted() ? '🔇' : '🔊', () => {
    setMuted(!isMuted());
    const p = loadProgress();
    p.muted = isMuted();
    saveProgress(p);
    button.label.setText(isMuted() ? '🔇' : '🔊');
  });
  return button;
}

/**
 * A big round button you hold down, like the ◀ ▶ buttons for walking around
 * as Mega Slime. `onChange(true)` when it's pressed, `onChange(false)` when
 * it's let go.
 */
export function makeHoldButton(scene, x, y, label, onChange, size = 120) {
  const container = scene.add.container(x, y).setDepth(210).setScrollFactor(0);
  const bg = scene.add.graphics();
  const draw = pressed => {
    bg.clear();
    bg.fillStyle(0x000000, 0.3);
    bg.fillCircle(0, 5, size / 2);
    bg.fillStyle(pressed ? 0x55e05a : 0x24304a, 0.85);
    bg.fillCircle(0, pressed ? 4 : 0, size / 2);
    bg.lineStyle(5, 0xffffff, 0.8);
    bg.strokeCircle(0, pressed ? 4 : 0, size / 2);
  };
  draw(false);
  const text = scene.add.text(0, 0, label, textStyle(Math.round(size * 0.4))).setOrigin(0.5);
  container.add([bg, text]);
  container.setSize(size, size);
  container.setInteractive({ useHandCursor: true });
  container.pressed = false;
  const press = down => {
    if (container.pressed !== down) {
      container.pressed = down;
      draw(down);
      onChange(down);
    }
  };
  container.on('pointerdown', (pointer, lx, ly, event) => {
    unlockAudio();
    press(true);
    if (event) {
      event.stopPropagation();
    }
  });
  container.on('pointerup', () => press(false));
  container.on('pointerout', () => press(false));
  container.release = () => press(false);
  container.label = text;
  return container;
}
