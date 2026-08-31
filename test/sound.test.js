import assert from 'node:assert/strict';
import test from 'node:test';

import { BEEPS, noteSequence } from '../src/sound.js';

test('every shot outcome and end state maps to a beep', () => {
  for (const name of ['miss', 'hit', 'sunk', 'win', 'lose']) {
    assert.ok(noteSequence(name).length > 0, `${name} has no notes`);
  }
  assert.deepEqual(noteSequence('nope'), []);
});

test('multi-note events are scheduled back-to-back', () => {
  for (const name of Object.keys(BEEPS)) {
    let expected = 0;
    for (const note of noteSequence(name)) {
      assert.equal(note.offset, expected);
      assert.ok(note.duration > 0 && note.frequency > 0);
      expected += note.duration;
    }
  }
});

test('sunk falls and win rises', () => {
  const sunk = noteSequence('sunk').map((note) => note.frequency);
  const win = noteSequence('win').map((note) => note.frequency);
  const lose = noteSequence('lose').map((note) => note.frequency);
  assert.ok(sunk[0] > sunk[1]);
  assert.deepEqual(win, [...win].sort((a, b) => a - b));
  assert.deepEqual(lose, [...lose].sort((a, b) => b - a));
});
