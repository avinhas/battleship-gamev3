// AI shot selection strategies per difficulty. No DOM access.

import { BOARD_SIZE } from './board.js';

function unshotCells(board) {
  const cells = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (board.shots[row][col] === null) cells.push({ row, col });
    }
  }
  return cells;
}

function pick(cells, random) {
  if (cells.length === 0) return null;
  return cells[Math.floor(random() * cells.length)];
}

export function createAI(difficulty = 'medium', random = Math.random) {
  return {
    difficulty,
    nextShot(board) {
      return pick(unshotCells(board), random);
    },
    registerResult() {},
  };
}
