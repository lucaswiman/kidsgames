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
