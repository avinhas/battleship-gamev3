import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BOARD_SIZE,
  STANDARD_FLEET,
  canPlace,
  createBoard,
  fleetShips,
  placeShip,
  randomPlaceFleet,
  removeShip,
  shipAt,
} from '../src/board.js';

const ship = (id, length) => ({ id, typeId: id, name: id, length });

test('canPlace accepts a placement that fits on an empty board', () => {
  const board = createBoard();
  assert.equal(canPlace(board, 5, 0, 0, 'horizontal'), true);
  assert.equal(canPlace(board, 5, 5, 5, 'vertical'), true);
  assert.equal(canPlace(board, 1, 9, 9, 'horizontal'), true);
});

test('canPlace rejects placements that leave the grid', () => {
  const board = createBoard();
  assert.equal(canPlace(board, 5, 0, 6, 'horizontal'), false);
  assert.equal(canPlace(board, 5, 6, 0, 'vertical'), false);
  assert.equal(canPlace(board, 2, -1, 0, 'horizontal'), false);
  assert.equal(canPlace(board, 2, 0, -1, 'horizontal'), false);
  assert.equal(canPlace(board, 2, BOARD_SIZE, 0, 'horizontal'), false);
});

test('canPlace rejects overlapping placements', () => {
  const board = createBoard();
  placeShip(board, ship('carrier', 5), 4, 2, 'horizontal');
  assert.equal(canPlace(board, 3, 4, 0, 'horizontal'), false);
  assert.equal(canPlace(board, 3, 2, 3, 'vertical'), false);
  assert.equal(canPlace(board, 3, 5, 2, 'horizontal'), true);
});

test('ignoreShipId lets a ship reposition over its own footprint', () => {
  const board = createBoard();
  const carrier = ship('carrier', 5);
  placeShip(board, carrier, 0, 0, 'horizontal');
  assert.equal(canPlace(board, 5, 0, 0, 'vertical'), false);
  assert.equal(canPlace(board, 5, 0, 0, 'vertical', 'carrier'), true);
  assert.equal(canPlace(board, 5, 0, 0, 'vertical', 'destroyer'), false);
});

test('placeShip writes the ship id into every occupied cell', () => {
  const board = createBoard();
  const placed = placeShip(board, ship('cruiser', 3), 2, 7, 'vertical');
  assert.ok(placed);
  assert.deepEqual(placed.cells, [
    { row: 2, col: 7 },
    { row: 3, col: 7 },
    { row: 4, col: 7 },
  ]);
  for (const cell of placed.cells) {
    assert.equal(board.grid[cell.row][cell.col], 'cruiser');
    assert.equal(shipAt(board, cell.row, cell.col).id, 'cruiser');
  }
  assert.equal(board.ships.length, 1);
});

test('placeShip refuses invalid placements and leaves the board untouched', () => {
  const board = createBoard();
  placeShip(board, ship('carrier', 5), 0, 0, 'horizontal');
  assert.equal(placeShip(board, ship('battleship', 4), 0, 3, 'horizontal'), false);
  assert.equal(placeShip(board, ship('battleship', 4), 0, 7, 'horizontal'), false);
  assert.equal(board.ships.length, 1);
  assert.equal(board.grid[0][3], 'carrier');
});

test('placeShip moving an existing ship frees its previous cells', () => {
  const board = createBoard();
  const carrier = ship('carrier', 5);
  placeShip(board, carrier, 0, 0, 'horizontal');
  placeShip(board, carrier, 0, 0, 'vertical');
  assert.equal(board.ships.length, 1);
  assert.equal(board.grid[0][1], null);
  assert.equal(board.grid[4][0], 'carrier');
});

test('removeShip clears only that ship\u2019s cells', () => {
  const board = createBoard();
  placeShip(board, ship('carrier', 5), 0, 0, 'horizontal');
  placeShip(board, ship('destroyer', 2), 1, 0, 'horizontal');
  assert.equal(removeShip(board, 'carrier'), true);
  assert.equal(board.ships.length, 1);
  for (let col = 0; col < 5; col += 1) assert.equal(board.grid[0][col], null);
  assert.equal(board.grid[1][0], 'destroyer');
  assert.equal(board.grid[1][1], 'destroyer');
  assert.equal(removeShip(board, 'carrier'), false);
});

test('randomPlaceFleet always yields a fully valid, non-overlapping layout', () => {
  const composition = { ...STANDARD_FLEET, destroyer: 3, submarine: 2 };
  const expected = fleetShips(composition);
  const expectedCells = expected.reduce((total, s) => total + s.length, 0);

  for (let i = 0; i < 500; i += 1) {
    const board = randomPlaceFleet(composition);
    assert.ok(board, 'randomPlaceFleet should find a layout');
    assert.equal(board.ships.length, expected.length);

    const occupied = new Set();
    for (const placed of board.ships) {
      assert.equal(placed.cells.length, placed.length);
      for (const cell of placed.cells) {
        const key = `${cell.row},${cell.col}`;
        assert.equal(occupied.has(key), false, `overlap at ${key}`);
        occupied.add(key);
        assert.ok(cell.row >= 0 && cell.row < BOARD_SIZE, 'row in bounds');
        assert.ok(cell.col >= 0 && cell.col < BOARD_SIZE, 'col in bounds');
        assert.equal(board.grid[cell.row][cell.col], placed.id);
      }
    }
    assert.equal(occupied.size, expectedCells);
  }
});
