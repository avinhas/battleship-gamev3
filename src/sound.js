// Retro beeps synthesised with Web Audio oscillators — no assets, no dependencies.

const STORAGE_KEY = 'battleship:muted';
const GAIN = 0.12;

// Pure event -> note table. Each note is { frequency, duration } in Hz and seconds;
// notes of a sequence play back-to-back.
export const BEEPS = {
  place: [{ frequency: 330, duration: 0.07 }],
  fire: [{ frequency: 180, duration: 0.07 }],
  miss: [{ frequency: 220, duration: 0.16 }],
  hit: [{ frequency: 520, duration: 0.16 }],
  sunk: [
    { frequency: 440, duration: 0.14 },
    { frequency: 220, duration: 0.26 },
  ],
  win: [
    { frequency: 523, duration: 0.14 },
    { frequency: 659, duration: 0.14 },
    { frequency: 784, duration: 0.3 },
  ],
  lose: [
    { frequency: 392, duration: 0.16 },
    { frequency: 311, duration: 0.16 },
    { frequency: 196, duration: 0.36 },
  ],
};

// Schedules the notes of an event, each one starting where the previous ended.
export function noteSequence(name) {
  const notes = BEEPS[name];
  if (!notes) return [];
  let offset = 0;
  return notes.map((note) => {
    const scheduled = { ...note, offset };
    offset += note.duration;
    return scheduled;
  });
}

let context = null;
let muted = readMuted();

function readMuted() {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function storeMuted(value) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, String(value));
  } catch {
    // Private-mode storage failures must never break the game.
  }
}

// Browsers only allow audio after a user gesture, so this runs from a click handler.
export function unlock() {
  const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Ctor) return null;
  if (!context) context = new Ctor();
  if (context.state === 'suspended') context.resume();
  return context;
}

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = Boolean(value);
  storeMuted(muted);
  return muted;
}

export function play(name) {
  if (muted) return;
  const notes = noteSequence(name);
  if (notes.length === 0) return;
  const ctx = unlock();
  if (!ctx) return;

  const start = ctx.currentTime + 0.01;
  for (const note of notes) {
    const at = start + note.offset;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(note.frequency, at);
    // Ramp the envelope down rather than cutting the note, which would pop.
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(GAIN, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + note.duration);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(at);
    oscillator.stop(at + note.duration + 0.02);
  }
}
