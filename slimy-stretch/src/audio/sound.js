// All sounds and music are made in code with the Web Audio API, so there are
// no audio files to download.

let ctx = null;
let master = null;
let musicGain = null;
let muted = false;
let music = null;

function audio() {
  if (!ctx) {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) {
      return null;
    }
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.6;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.22;
    musicGain.connect(master);
  }
  return ctx;
}

/** iPads only allow sound after a touch, so call this from a touch handler. */
export function unlockAudio() {
  const ac = audio();
  if (ac && ac.state === 'suspended') {
    ac.resume();
  }
}

export function setMuted(value) {
  muted = value;
  if (master) {
    master.gain.value = muted ? 0 : 0.6;
  }
}

export function isMuted() {
  return muted;
}

function tone({ freq, to, type = 'sine', dur = 0.15, vol = 0.3, delay = 0, dest }) {
  const ac = audio();
  if (!ac) {
    return;
  }
  const t = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) {
    osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  }
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain);
  gain.connect(dest || master);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noise({ dur = 0.2, vol = 0.3, filter = 1200, to = 200, delay = 0 }) {
  const ac = audio();
  if (!ac) {
    return;
  }
  const t = ac.currentTime + delay;
  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(filter, t);
  lp.frequency.exponentialRampToValueAtTime(to, t + dur);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(lp);
  lp.connect(gain);
  gain.connect(master);
  src.start(t);
}

export const sfx = {
  grab: () => tone({ freq: 220, to: 330, dur: 0.08, vol: 0.15 }),
  splorch: () => {
    noise({ dur: 0.18, vol: 0.35, filter: 900, to: 120 });
    tone({ freq: 160, to: 70, dur: 0.15, vol: 0.3 });
  },
  boing: () => {
    tone({ freq: 260, to: 620, dur: 0.12, vol: 0.25, type: 'triangle' });
    tone({ freq: 620, to: 300, dur: 0.18, vol: 0.2, type: 'triangle', delay: 0.1 });
  },
  land: () => tone({ freq: 140, to: 60, dur: 0.12, vol: 0.25 }),
  token: () => {
    tone({ freq: 988, dur: 0.08, vol: 0.18, type: 'square' });
    tone({ freq: 1319, dur: 0.18, vol: 0.18, type: 'square', delay: 0.07 });
  },
  core: () => {
    [523, 659, 784, 1047].forEach((f, i) =>
      tone({ freq: f, dur: 0.15, vol: 0.18, type: 'triangle', delay: i * 0.06 })
    );
  },
  checkpoint: () => {
    [392, 523, 659].forEach((f, i) =>
      tone({ freq: f, dur: 0.15, vol: 0.18, type: 'square', delay: i * 0.08 })
    );
  },
  locked: () => tone({ freq: 160, dur: 0.2, vol: 0.2, type: 'square' }),
  death: () => {
    tone({ freq: 500, to: 80, dur: 0.6, vol: 0.3, type: 'sawtooth' });
    noise({ dur: 0.3, vol: 0.2, filter: 2000, to: 200 });
  },
  win: () => {
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) =>
      tone({ freq: f, dur: 0.2, vol: 0.2, type: 'square', delay: i * 0.11 })
    );
  },
  explode: () => {
    noise({ dur: 0.6, vol: 0.5, filter: 1500, to: 60 });
    tone({ freq: 90, to: 30, dur: 0.5, vol: 0.4 });
  },
  throwBomb: () => noise({ dur: 0.2, vol: 0.2, filter: 4000, to: 800 }),
  robotThrow: () => tone({ freq: 300, to: 200, dur: 0.1, vol: 0.15, type: 'square' }),
  clang: () => {
    tone({ freq: 880, dur: 0.4, vol: 0.2, type: 'square' });
    tone({ freq: 1245, dur: 0.3, vol: 0.15, type: 'square' });
  },
  robotHurt: () => tone({ freq: 400, to: 100, dur: 0.5, vol: 0.3, type: 'sawtooth' }),
  stomp: () => {
    noise({ dur: 0.4, vol: 0.5, filter: 600, to: 40 });
    tone({ freq: 70, to: 30, dur: 0.4, vol: 0.5 });
  },
  jump: () => tone({ freq: 150, to: 500, dur: 0.3, vol: 0.2, type: 'square' }),
  shield: () => tone({ freq: 600, to: 1200, dur: 0.3, vol: 0.12, type: 'sine' }),
  rumble: () => noise({ dur: 0.5, vol: 0.18, filter: 300, to: 80 }),
  crumble: () => {
    noise({ dur: 0.5, vol: 0.4, filter: 900, to: 60 });
    tone({ freq: 110, to: 50, dur: 0.3, vol: 0.25 });
  },
  key: () => {
    [784, 988, 1175].forEach((f, i) =>
      tone({ freq: f, dur: 0.12, vol: 0.18, type: 'triangle', delay: i * 0.05 })
    );
  },
  gateOpen: () => {
    tone({ freq: 900, to: 200, dur: 0.4, vol: 0.2, type: 'sawtooth' });
    [523, 784].forEach((f, i) =>
      tone({ freq: f, dur: 0.15, vol: 0.15, type: 'square', delay: 0.3 + i * 0.08 })
    );
  },
  tongue: () => tone({ freq: 300, to: 700, dur: 0.12, vol: 0.18, type: 'triangle' }),
  chomp: () => {
    noise({ dur: 0.12, vol: 0.35, filter: 1800, to: 300 });
    tone({ freq: 200, to: 90, dur: 0.15, vol: 0.3, type: 'square', delay: 0.05 });
    tone({ freq: 180, to: 80, dur: 0.15, vol: 0.25, type: 'square', delay: 0.2 });
  },
  boulderCrack: () => noise({ dur: 0.25, vol: 0.25, filter: 2500, to: 400 }),
  thud: () => {
    noise({ dur: 0.35, vol: 0.4, filter: 500, to: 40 });
    tone({ freq: 80, to: 35, dur: 0.3, vol: 0.4 });
  },
  wind: () => noise({ dur: 1.6, vol: 0.12, filter: 1400, to: 500 }),
  cannonIn: () => tone({ freq: 180, to: 90, dur: 0.15, vol: 0.3, type: 'square' }),
  cannonFire: () => {
    noise({ dur: 0.45, vol: 0.5, filter: 2500, to: 100 });
    tone({ freq: 120, to: 40, dur: 0.35, vol: 0.45 });
  },
  clawGrab: () => {
    tone({ freq: 700, dur: 0.08, vol: 0.2, type: 'square' });
    tone({ freq: 500, dur: 0.12, vol: 0.2, type: 'square', delay: 0.07 });
  },
  clawDrop: () => tone({ freq: 400, to: 900, dur: 0.25, vol: 0.15, type: 'triangle' }),
  sore: () => tone({ freq: 500, to: 150, dur: 0.6, vol: 0.25, type: 'sawtooth' }),
  wave: () => noise({ dur: 1.4, vol: 0.18, filter: 900, to: 250 }),
  squawk: () => {
    tone({ freq: 1100, to: 700, dur: 0.12, vol: 0.14, type: 'sawtooth' });
    tone({ freq: 1000, to: 600, dur: 0.14, vol: 0.14, type: 'sawtooth', delay: 0.16 });
  },
  rustle: () => noise({ dur: 0.35, vol: 0.12, filter: 3000, to: 1500 }),
  coconut: () => {
    tone({ freq: 300, to: 120, dur: 0.12, vol: 0.3, type: 'triangle' });
    noise({ dur: 0.1, vol: 0.15, filter: 2000, to: 600 });
  },
  bonk: () => tone({ freq: 700, to: 250, dur: 0.18, vol: 0.3, type: 'triangle' }),
  bounce: () => tone({ freq: 200, to: 800, dur: 0.3, vol: 0.25, type: 'sine' }),
  barf: () => {
    tone({ freq: 220, to: 70, dur: 0.4, vol: 0.3, type: 'sawtooth' });
    noise({ dur: 0.35, vol: 0.2, filter: 800, to: 200, delay: 0.05 });
  },
  gloop: () => {
    tone({ freq: 120, to: 60, dur: 0.35, vol: 0.3, type: 'sine' });
    tone({ freq: 220, to: 140, dur: 0.12, vol: 0.15, type: 'sine', delay: 0.15 });
  },
  chatter: () => {
    for (let i = 0; i < 4; i++) {
      tone({ freq: 900 + (i % 2) * 300, dur: 0.06, vol: 0.12, type: 'square', delay: i * 0.07 });
    }
  },
  whoosh: () => noise({ dur: 0.25, vol: 0.15, filter: 3000, to: 900 }),
  squish: () => {
    noise({ dur: 0.15, vol: 0.25, filter: 1200, to: 200 });
    tone({ freq: 300, to: 120, dur: 0.12, vol: 0.15, type: 'triangle' });
  },
  eek: () => tone({ freq: 1200, to: 1800, dur: 0.2, vol: 0.15, type: 'square' }),
  hiss: () => noise({ dur: 0.6, vol: 0.14, filter: 6000, to: 3000 }),
  snakeSnap: () => {
    noise({ dur: 0.1, vol: 0.25, filter: 4000, to: 1000 });
    tone({ freq: 500, to: 200, dur: 0.1, vol: 0.2, type: 'square' });
  },
  leafBreak: () => {
    noise({ dur: 0.4, vol: 0.3, filter: 3500, to: 400 });
    tone({ freq: 400, to: 90, dur: 0.5, vol: 0.2, type: 'triangle' });
  },
  vine: () => tone({ freq: 260, to: 180, dur: 0.15, vol: 0.2, type: 'triangle' }),
  wheee: () => tone({ freq: 400, to: 1200, dur: 0.35, vol: 0.18, type: 'triangle' }),
  zip: () => tone({ freq: 700, to: 1500, dur: 0.9, vol: 0.1, type: 'sawtooth' }),
  creak: () => tone({ freq: 180, to: 140, dur: 0.4, vol: 0.18, type: 'sawtooth' }),
  yum: () => {
    tone({ freq: 523, dur: 0.1, vol: 0.18, type: 'triangle' });
    tone({ freq: 784, dur: 0.18, vol: 0.18, type: 'triangle', delay: 0.1 });
  },
  chest: () => {
    for (const [i, f] of [523, 659, 784, 1047, 1319].entries()) {
      tone({ freq: f, dur: 0.14, vol: 0.18, type: 'triangle', delay: i * 0.07 });
    }
  },
  steam: () => noise({ dur: 0.7, vol: 0.2, filter: 5000, to: 1500 }),
  power: () => {
    tone({ freq: 200, to: 900, dur: 0.4, vol: 0.2, type: 'square' });
    tone({ freq: 900, dur: 0.15, vol: 0.15, type: 'triangle', delay: 0.4 });
  },
  liftMove: () => tone({ freq: 120, to: 160, dur: 0.6, vol: 0.18, type: 'sawtooth' }),
  roar: () => {
    tone({ freq: 90, to: 50, dur: 0.9, vol: 0.35, type: 'sawtooth' });
    noise({ dur: 0.9, vol: 0.25, filter: 600, to: 100 });
  },
  fireball: () => noise({ dur: 0.3, vol: 0.2, filter: 2500, to: 600 }),
  gulp: () => tone({ freq: 300, to: 80, dur: 0.35, vol: 0.3, type: 'triangle' }),
  button: () => {
    tone({ freq: 880, dur: 0.1, vol: 0.25, type: 'square' });
    tone({ freq: 660, dur: 0.15, vol: 0.25, type: 'square', delay: 0.1 });
  },
  split: () => {
    tone({ freq: 500, to: 250, dur: 0.25, vol: 0.25, type: 'triangle' });
    tone({ freq: 500, to: 750, dur: 0.25, vol: 0.2, type: 'triangle', delay: 0.05 });
  },
  merge: () => {
    tone({ freq: 300, to: 600, dur: 0.2, vol: 0.25, type: 'sine' });
    tone({ freq: 600, dur: 0.15, vol: 0.2, type: 'sine', delay: 0.2 });
  },
  zap: () => {
    noise({ dur: 0.5, vol: 0.3, filter: 8000, to: 400 });
    tone({ freq: 1600, to: 120, dur: 0.25, vol: 0.18, type: 'sawtooth' });
  },
  yawn: () => {
    tone({ freq: 300, to: 500, dur: 0.35, vol: 0.2, type: 'triangle' });
    tone({ freq: 500, to: 220, dur: 0.6, vol: 0.2, type: 'triangle', delay: 0.35 });
  },
  fluff: () => noise({ dur: 0.3, vol: 0.12, filter: 1500, to: 300 }),
  balloon: () => {
    noise({ dur: 0.5, vol: 0.12, filter: 600, to: 200 });
    tone({ freq: 330, to: 440, dur: 0.4, vol: 0.15, type: 'sine' });
  },
  rainbow: () => {
    [0, 4, 7, 12, 16].forEach((n, i) =>
      tone({ freq: 523 * 2 ** (n / 12), dur: 0.12, vol: 0.15, type: 'triangle', delay: i * 0.06 })
    );
  },
  alarm: () => {
    tone({ freq: 880, dur: 0.12, vol: 0.14, type: 'square' });
    tone({ freq: 660, dur: 0.12, vol: 0.14, type: 'square', delay: 0.16 });
  },
  asteroid: () => noise({ dur: 0.8, vol: 0.15, filter: 1800, to: 300 }),
  ufoWarn: () => {
    for (let i = 0; i < 3; i++) {
      tone({ freq: 500, to: 900, dur: 0.15, vol: 0.12, type: 'sine', delay: i * 0.18 });
    }
  },
  beam: () => tone({ freq: 300, to: 1200, dur: 0.6, vol: 0.14, type: 'triangle' }),
  teleport: () => {
    tone({ freq: 1200, to: 300, dur: 0.2, vol: 0.18, type: 'sine' });
    tone({ freq: 300, to: 1400, dur: 0.25, vol: 0.18, type: 'sine', delay: 0.18 });
  },
  rocket: () => {
    noise({ dur: 0.6, vol: 0.4, filter: 3000, to: 200 });
    tone({ freq: 100, to: 400, dur: 0.4, vol: 0.25, type: 'sawtooth' });
  },
  gravity: () => {
    tone({ freq: 700, to: 200, dur: 0.35, vol: 0.2, type: 'triangle' });
    tone({ freq: 200, to: 700, dur: 0.35, vol: 0.2, type: 'triangle', delay: 0.3 });
  },
  wither: () => tone({ freq: 500, to: 120, dur: 0.7, vol: 0.2, type: 'triangle' }),
  poof: () => noise({ dur: 0.25, vol: 0.18, filter: 2500, to: 600 }),
  float: () => tone({ freq: 400, to: 520, dur: 0.5, vol: 0.12, type: 'sine' }),
  caramel: () => {
    noise({ dur: 0.3, vol: 0.2, filter: 600, to: 150 });
    tone({ freq: 220, to: 160, dur: 0.35, vol: 0.18, type: 'triangle' });
  },
  unstick: () => tone({ freq: 300, to: 700, dur: 0.15, vol: 0.15, type: 'triangle' }),
  marshmallow: () => tone({ freq: 180, to: 120, dur: 0.25, vol: 0.15, type: 'sine' }),
  spring: () => tone({ freq: 300, to: 900, dur: 0.2, vol: 0.2, type: 'triangle' }),
  rope: () => tone({ freq: 600, to: 250, dur: 0.6, vol: 0.12, type: 'sine' }),
  lick: () => {
    [784, 988, 1175, 1568].forEach((f, i) =>
      tone({ freq: f, dur: 0.1, vol: 0.15, type: 'triangle', delay: i * 0.05 })
    );
  },
  drip: () => tone({ freq: 1200, to: 500, dur: 0.12, vol: 0.12, type: 'sine' }),
  melt: () => noise({ dur: 0.4, vol: 0.15, filter: 1500, to: 300 }),
  rattle: () => {
    for (let i = 0; i < 4; i++) {
      noise({ dur: 0.05, vol: 0.15, filter: 3000, to: 1500, delay: i * 0.08 });
    }
  },
  gumball: () => tone({ freq: 500, to: 250, dur: 0.12, vol: 0.18, type: 'square' }),
  pop: () => tone({ freq: 900, to: 1500, dur: 0.06, vol: 0.15, type: 'square' }),
  rain: () => noise({ dur: 1.2, vol: 0.12, filter: 4000, to: 2000 }),
  superStretch: () => {
    tone({ freq: 200, to: 1200, dur: 0.3, vol: 0.2, type: 'sawtooth' });
    noise({ dur: 0.3, vol: 0.15, filter: 3000, to: 800 });
  },
  clawWarn: () => {
    for (let i = 0; i < 3; i++) {
      tone({ freq: 700, dur: 0.08, vol: 0.12, type: 'square', delay: i * 0.12 });
    }
  },
  ice: () => {
    [1568, 1319, 1047, 784].forEach((f, i) =>
      tone({ freq: f, dur: 0.18, vol: 0.14, type: 'sine', delay: i * 0.07 })
    );
  },
  // A creeeeaky old floorboard.
  floorCreak: () => {
    tone({ freq: 210, to: 150, dur: 0.35, vol: 0.14, type: 'sawtooth' });
    tone({ freq: 170, to: 240, dur: 0.4, vol: 0.12, type: 'sawtooth', delay: 0.3 });
  },
  boardBreak: () => {
    noise({ dur: 0.3, vol: 0.3, filter: 3000, to: 300 });
    tone({ freq: 160, to: 60, dur: 0.25, vol: 0.2, type: 'triangle' });
  },
  // Ooooooo! (a silly, not-too-scary ghost)
  ghost: () => {
    tone({ freq: 330, to: 440, dur: 0.5, vol: 0.12, type: 'sine' });
    tone({ freq: 440, to: 300, dur: 0.8, vol: 0.12, type: 'sine', delay: 0.45 });
    tone({ freq: 660, to: 600, dur: 1.1, vol: 0.04, type: 'triangle', delay: 0.1 });
  },
  shove: () => {
    noise({ dur: 0.15, vol: 0.3, filter: 800, to: 150 });
    tone({ freq: 240, to: 120, dur: 0.2, vol: 0.2, type: 'triangle' });
  },
  // Sticky web strands stretching.
  web: () => {
    tone({ freq: 500, to: 950, dur: 0.22, vol: 0.08, type: 'sawtooth' });
    tone({ freq: 900, to: 600, dur: 0.3, vol: 0.06, type: 'sawtooth', delay: 0.18 });
  },
  // Click... whoosh! A secret bookcase spins around.
  bookcase: () => {
    tone({ freq: 900, dur: 0.05, vol: 0.15, type: 'square' });
    noise({ dur: 0.5, vol: 0.18, filter: 2500, to: 500, delay: 0.05 });
    tone({ freq: 200, to: 500, dur: 0.45, vol: 0.12, type: 'triangle', delay: 0.05 });
  },
  // The chandelier's crystals tinkling.
  chandelier: () => {
    [1568, 2093, 1760].forEach((f, i) =>
      tone({ freq: f, dur: 0.15, vol: 0.08, type: 'sine', delay: i * 0.05 })
    );
  },
};

// Each world has its own little looping tune. Notes are semitones above the
// root (null = rest); there are 16 steps per loop.
const SONGS = {
  menu: {
    bpm: 110,
    root: 60,
    lead: [0, null, 4, null, 7, null, 4, null, 9, null, 7, null, 4, null, 2, null],
    bass: [0, null, null, null, -3, null, null, null, -7, null, null, null, -5, null, null, null],
  },
  lab: {
    bpm: 126,
    root: 62,
    lead: [0, 3, 7, 3, 10, 7, 3, 7, 0, 3, 7, 12, 10, 7, 5, 3],
    bass: [-12, null, -12, null, -9, null, -9, null, -14, null, -14, null, -10, null, -10, null],
  },
  tundra: {
    bpm: 96,
    root: 64,
    lead: [7, null, 4, null, 0, null, 4, 7, 9, null, 7, null, 4, null, 2, null],
    bass: [
      -12,
      null,
      null,
      null,
      -15,
      null,
      null,
      null,
      -19,
      null,
      null,
      null,
      -17,
      null,
      null,
      null,
    ],
  },
  volcano: {
    bpm: 140,
    root: 57,
    lead: [0, 0, 3, 0, 6, 0, 5, 3, 0, 0, 3, 0, 7, 6, 5, 3],
    bass: [-12, -12, null, -12, -9, null, -10, null, -12, -12, null, -12, -6, null, -7, null],
  },
  warehouse: {
    bpm: 118,
    root: 52,
    // A clanky, busy factory beat.
    lead: [0, 7, null, 7, 12, null, 10, 7, 0, 7, null, 7, 15, 14, 12, 10],
    bass: [-12, -12, null, -12, -12, null, -9, null, -12, -12, null, -12, -14, null, -10, null],
  },
  cave: {
    bpm: 88,
    root: 50,
    // Slow and echoey, like dripping water in a cave.
    lead: [12, null, null, 15, null, null, 19, null, 17, null, null, 15, null, 12, null, null],
    bass: [
      -12,
      null,
      null,
      null,
      null,
      null,
      -9,
      null,
      -14,
      null,
      null,
      null,
      null,
      null,
      -10,
      null,
    ],
  },
  canyon: {
    bpm: 108,
    root: 55,
    // A bouncy cowboy tune on the minor pentatonic scale.
    lead: [0, null, 3, 5, 7, null, 5, 3, 0, null, 10, null, 7, 5, 3, null],
    bass: [-12, null, -5, null, -12, null, -5, null, -14, null, -7, null, -12, null, -5, null],
  },
  island: {
    bpm: 116,
    root: 60,
    // A sunny, bouncy beach tune.
    lead: [7, null, 4, 7, null, 9, 7, null, 4, null, 2, 4, null, 0, 2, null],
    bass: [-12, null, -12, -5, null, -5, -7, null, -12, null, -12, -5, null, -10, -7, null],
  },
  jungle: {
    bpm: 112,
    root: 57,
    // Bongo-ish bass with a marimba melody, deep in the jungle.
    lead: [12, null, 7, 9, null, 12, 14, null, 12, 9, null, 7, 9, null, 4, null],
    bass: [-12, -12, null, -5, -12, null, -5, null, -10, -10, null, -3, -10, null, -5, -7],
  },
  factory: {
    bpm: 132,
    root: 50,
    // A clunky, chugging machine beat.
    lead: [0, null, 0, 7, null, 6, 7, null, 0, null, 0, 10, null, 9, 7, 5],
    bass: [-12, -12, -12, null, -12, -12, -12, null, -14, -14, -14, null, -10, -10, -9, null],
  },
  sky: {
    bpm: 100,
    root: 65,
    // Light and floaty, like drifting along on a cloud.
    lead: [12, null, 16, null, 19, null, 16, 14, 12, null, 9, null, 7, null, 9, null],
    bass: [-12, null, null, -5, null, null, -7, null, -10, null, null, -3, null, null, -5, null],
  },
  space: {
    bpm: 96,
    root: 57,
    // Twinkly arpeggios over a slow, deep bass, floating among the stars.
    lead: [0, 7, 12, 16, 19, 16, 12, 7, 2, 9, 14, 17, 21, 17, 14, 9],
    bass: [-12, null, null, null, -12, null, -5, null, -10, null, null, null, -10, null, -3, null],
  },
  candy: {
    bpm: 120,
    root: 64,
    // A sweet, bouncy music-box tune, like a candy shop.
    lead: [12, 16, 19, 16, 12, null, 14, 16, 17, 21, 19, 17, 16, null, 14, 12],
    bass: [-12, null, -5, null, -7, null, -5, null, -15, null, -8, null, -10, null, -5, null],
  },
  haunted: {
    bpm: 104,
    root: 57,
    // A sneaky, tiptoeing tune with a silly spooky wobble: more fun than scary.
    lead: [12, null, 15, 19, 18, null, 15, null, 12, 13, 12, null, 10, null, 7, null],
    bass: [-12, null, -5, null, -12, null, -6, null, -14, null, -7, null, -13, null, -6, null],
  },
  boss: {
    bpm: 156,
    root: 57,
    lead: [12, 11, 12, 7, 8, 7, 3, 7, 12, 11, 12, 15, 14, 12, 11, 7],
    bass: [-12, -12, -12, -12, -16, -16, -16, -16, -14, -14, -14, -14, -13, -13, -13, -13],
  },
};

const midiToFreq = m => 440 * 2 ** ((m - 69) / 12);

export function playMusic(name) {
  if (music && music.name === name) {
    return;
  }
  stopMusic();
  const ac = audio();
  const song = SONGS[name];
  if (!ac || !song) {
    return;
  }
  const stepDur = 60 / song.bpm / 2; // eighth notes
  let step = 0;
  let nextTime = ac.currentTime + 0.1;
  // Schedule a little ahead of time so the beat stays steady.
  const timer = setInterval(() => {
    while (nextTime < ac.currentTime + 0.25) {
      const lead = song.lead[step % 16];
      const bass = song.bass[step % 16];
      const delay = Math.max(0, nextTime - ac.currentTime);
      if (lead !== null) {
        tone({
          freq: midiToFreq(song.root + lead),
          dur: stepDur * 0.9,
          vol: 0.25,
          type: 'square',
          delay,
          dest: musicGain,
        });
      }
      if (bass !== null) {
        tone({
          freq: midiToFreq(song.root + bass),
          dur: stepDur * 1.8,
          vol: 0.4,
          type: 'triangle',
          delay,
          dest: musicGain,
        });
      }
      nextTime += stepDur;
      step++;
    }
  }, 50);
  music = { name, timer };
}

export function stopMusic() {
  if (music) {
    clearInterval(music.timer);
    music = null;
  }
}
