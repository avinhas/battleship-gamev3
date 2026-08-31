import assert from 'node:assert/strict';
import test from 'node:test';

import { createBoard, fire, placeShip } from '../src/board.js';
import { createGame, enemyShot, playerShot, scoreboard } from '../src/game.js';

const ship = (id, length) => ({ id, typeId: id, name: id, length });

function twoShipBoard() {
  const board = createBoard();
  placeShip(board, ship('cruiser', 3), 0, 0, 'horizontal');
  placeShip(board, ship('destroyer', 2), 5, 5, 'vertical');
  return board;
}

test('firing resolves miss, hit and sunk', () => {
  const board = twoShipBoard();
  assert.equal(fire(board, 9, 9).result, 'miss');
  assert.equal(fire(board, 0, 0).result, 'hit');
  assert.equal(fire(board, 0, 1).result, 'hit');
  const last = fire(board, 0, 2);
  assert.equal(last.result, 'sunk');
  assert.equal(last.ship.id, 'cruiser');
  assert.equal(last.gameOver, false);
});

test('sunk only triggers once every cell of the ship is hit', () => {
  const board = twoShipBoard();
  assert.equal(fire(board, 5, 5).result, 'hit');
  assert.equal(board.ships.find((s) => s.id === 'destroyer').sunk, false);
  assert.equal(fire(board, 6, 5).result, 'sunk');
  assert.equal(board.ships.find((s) => s.id === 'destroyer').sunk, true);
});

test('firing the same cell twice is invalid and does not double-count hits', () => {
  const board = twoShipBoard();
  fire(board, 0, 0);
  const repeat = fire(board, 0, 0);
  assert.equal(repeat.result, 'invalid');
  assert.equal(repeat.reason, 'already-fired');
  assert.equal(board.ships.find((s) => s.id === 'cruiser').hits, 1);
  assert.equal(fire(board, 0, 10).result, 'invalid');
});

test('the win condition fires exactly when the last enemy ship sinks', () => {
  const game = createGame({
    composition: { destroyer: 1 },
    difficulty: 'easy',
    playerBoard: twoShipBoard(),
  });
  const target = game.enemyBoard.ships[0];
  const [first, second] = target.cells;

  const opening = playerShot(game, first.row, first.col);
  assert.equal(opening.result, 'hit');
  assert.equal(game.over, false);
  assert.equal(game.turn, 'enemy');

  game.turn = 'player';
  const finisher = playerShot(game, second.row, second.col);
  assert.equal(finisher.result, 'sunk');
  assert.equal(game.over, true);
  assert.equal(game.winner, 'player');
  assert.equal(scoreboard(game).enemyRemaining, 0);
});

test('the player cannot shoot out of turn or after the game ends', () => {
  const game = createGame({
    composition: { destroyer: 1 },
    difficulty: 'easy',
    playerBoard: twoShipBoard(),
  });
  playerShot(game, 9, 9);
  assert.equal(game.turn, 'enemy');
  assert.equal(playerShot(game, 8, 8).result, 'invalid');
  assert.equal(enemyShot(game).result !== 'invalid', true);
  assert.equal(game.turn, 'player');
});

test('the enemy wins only once every player ship is sunk', () => {
  const game = createGame({
    composition: { destroyer: 1 },
    difficulty: 'medium',
    playerBoard: twoShipBoard(),
  });
  let guard = 0;
  while (!game.over && guard < 500) {
    game.turn = 'enemy';
    enemyShot(game);
    guard += 1;
  }
  assert.equal(game.over, true);
  assert.equal(game.winner, 'enemy');
  assert.equal(scoreboard(game).playerRemaining, 0);
  assert.equal(
    game.playerBoard.ships.every((s) => s.sunk),
    true,
  );
});

test('every shot is recorded in the move log', () => {
  const game = createGame({
    composition: { destroyer: 1 },
    difficulty: 'easy',
    playerBoard: twoShipBoard(),
  });
  playerShot(game, 3, 3);
  enemyShot(game);
  assert.equal(game.log.length, 2);
  assert.deepEqual(
    game.log.map((entry) => entry.actor),
    ['player', 'enemy'],
  );
  assert.equal(game.log[0].cell, 'D4');
});
