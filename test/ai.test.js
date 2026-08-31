import assert from 'node:assert/strict';
import test from 'node:test';

import { createAI } from '../src/ai.js';
import { BOARD_SIZE, STANDARD_FLEET, fire, randomPlaceFleet } from '../src/board.js';

const DIFFICULTIES = ['easy', 'medium', 'hard'];

function isAdjacent(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

function playGame(difficulty) {
  const board = randomPlaceFleet(STANDARD_FLEET);
  const ai = createAI(difficulty);
  const fired = new Set();
  let guard = 0;

  while (board.ships.some((ship) => !ship.sunk) && guard < BOARD_SIZE * BOARD_SIZE) {
    const shot = ai.nextShot(board);
    assert.ok(shot, 'the AI must always find a target while ships remain');
    const key = `${shot.row},${shot.col}`;
    assert.ok(
      shot.row >= 0 && shot.row < BOARD_SIZE && shot.col >= 0 && shot.col < BOARD_SIZE,
      `${difficulty} fired out of bounds at ${key}`,
    );
    assert.equal(fired.has(key), false, `${difficulty} repeated a shot at ${key}`);
    fired.add(key);

    const outcome = fire(board, shot.row, shot.col);
    assert.notEqual(outcome.result, 'invalid');
    ai.registerResult(shot, outcome);
    guard += 1;
  }

  assert.equal(
    board.ships.every((ship) => ship.sunk),
    true,
    `${difficulty} failed to clear the fleet within 100 shots`,
  );
  return fired.size;
}

for (const difficulty of DIFFICULTIES) {
  test(`${difficulty} AI stays legal across simulated games`, () => {
    for (let game = 0; game < 40; game += 1) playGame(difficulty);
  });
}

for (const difficulty of ['medium', 'hard']) {
  test(`${difficulty} AI works adjacent cells after a hit`, () => {
    const board = randomPlaceFleet(STANDARD_FLEET);
    const ai = createAI(difficulty);
    const hit = board.ships[0].cells[0];
    const outcome = fire(board, hit.row, hit.col);
    assert.equal(outcome.result, 'hit');
    ai.registerResult(hit, outcome);

    for (let i = 0; i < 25; i += 1) {
      const shot = ai.nextShot(board);
      assert.ok(isAdjacent(shot, hit), 'target mode must stay next to the open hit');
      assert.equal(board.shots[shot.row][shot.col], null);
    }
  });

  test(`${difficulty} AI returns to hunt mode after a sink`, () => {
    const board = randomPlaceFleet(STANDARD_FLEET);
    const ai = createAI(difficulty);
    const target = board.ships.reduce((a, b) => (a.length <= b.length ? a : b));

    for (const cell of target.cells) {
      const outcome = fire(board, cell.row, cell.col);
      ai.registerResult(cell, outcome);
    }
    assert.equal(target.sunk, true);

    let offTarget = 0;
    for (let i = 0; i < 60; i += 1) {
      const shot = ai.nextShot(board);
      assert.equal(board.shots[shot.row][shot.col], null);
      if (!target.cells.some((cell) => isAdjacent(shot, cell))) offTarget += 1;
    }
    assert.ok(offTarget > 0, 'the AI should hunt the whole board again after a sink');
  });
}

test('easy AI never enters target mode', () => {
  const board = randomPlaceFleet(STANDARD_FLEET);
  const ai = createAI('easy');
  const hit = board.ships[0].cells[0];
  ai.registerResult(hit, fire(board, hit.row, hit.col));

  let adjacent = 0;
  for (let i = 0; i < 200; i += 1) {
    const shot = ai.nextShot(board);
    assert.equal(board.shots[shot.row][shot.col], null);
    if (isAdjacent(shot, hit)) adjacent += 1;
  }
  // Uniform choice over ~95 open cells: at most a few of 200 draws land adjacent.
  assert.ok(adjacent < 40, `easy behaved like target mode (${adjacent}/200 adjacent)`);
});

test('the AI returns null once the board is exhausted', () => {
  const board = randomPlaceFleet(STANDARD_FLEET);
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) board.shots[row][col] = 'miss';
  }
  for (const difficulty of DIFFICULTIES) {
    assert.equal(createAI(difficulty).nextShot(board), null);
  }
});
