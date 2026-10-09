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
