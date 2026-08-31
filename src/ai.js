// AI shot selection strategies per difficulty. No DOM access.

import { BOARD_SIZE, canPlace, inBounds } from './board.js';

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

function afloatLengths(board) {
  return board.ships.filter((ship) => !ship.sunk).map((ship) => ship.length);
}

// A board holding only publicly known information (misses and sunk ships), used to
// enumerate the placements the remaining ships could still occupy.
function knowledgeBoard(board) {
  const grid = Array.from({ length: BOARD_SIZE }, () => new Array(BOARD_SIZE).fill(null));
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (board.shots[row][col] === 'miss') grid[row][col] = 'blocked';
    }
  }
  for (const ship of board.ships) {
    if (!ship.sunk) continue;
    for (const cell of ship.cells) grid[cell.row][cell.col] = 'blocked';
  }
  return { size: BOARD_SIZE, grid, shots: board.shots, ships: [] };
}

function probabilityMap(board) {
  const known = knowledgeBoard(board);
  const counts = Array.from({ length: BOARD_SIZE }, () => new Array(BOARD_SIZE).fill(0));
  for (const length of afloatLengths(board)) {
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        for (const orientation of ['horizontal', 'vertical']) {
          if (!canPlace(known, length, row, col, orientation)) continue;
          for (let i = 0; i < length; i += 1) {
            const r = orientation === 'vertical' ? row + i : row;
            const c = orientation === 'vertical' ? col : col + i;
            if (board.shots[r][c] === null) counts[r][c] += 1;
          }
        }
      }
    }
  }
  return counts;
}

export function createAI(difficulty = 'medium', random = Math.random) {
  // Cells confirmed as hits belonging to a ship that has not sunk yet.
  let activeHits = [];
  let queue = [];

  // Splits the open hits into orthogonally connected groups so two adjacent unsunk ships
  // never share an inferred orientation. The most recent hit's group is worked first.
  function hitClusters() {
    const pending = activeHits.slice();
    const groups = [];
    while (pending.length > 0) {
      const group = [pending.pop()];
      for (let grown = true; grown; ) {
        grown = false;
        for (let i = pending.length - 1; i >= 0; i -= 1) {
          const hit = pending[i];
          const touches = group.some(
            (member) => Math.abs(member.row - hit.row) + Math.abs(member.col - hit.col) === 1,
          );
          if (!touches) continue;
          group.push(hit);
          pending.splice(i, 1);
          grown = true;
        }
      }
      groups.push(group);
    }
    return groups;
  }

  function clusterCandidates(cluster, board, seen, candidates) {
    const rows = new Set(cluster.map((hit) => hit.row));
    const cols = new Set(cluster.map((hit) => hit.col));
    const alignedRow = cluster.length > 1 && rows.size === 1;
    const alignedCol = cluster.length > 1 && cols.size === 1;
    const deltas = alignedRow
      ? [
          [0, -1],
          [0, 1],
        ]
      : alignedCol
        ? [
            [-1, 0],
            [1, 0],
          ]
        : [
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1],
          ];

    for (const hit of cluster) {
      for (const [dr, dc] of deltas) {
        const row = hit.row + dr;
        const col = hit.col + dc;
        const key = `${row},${col}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (!inBounds(row, col)) continue;
        if (board.shots[row][col] !== null) continue;
        candidates.push({ row, col });
      }
    }
  }

  function queueNeighbours(board) {
    const candidates = [];
    const seen = new Set();
    for (const cluster of hitClusters()) clusterCandidates(cluster, board, seen, candidates);
    queue = candidates;
  }

  function huntShot(board) {
    const open = unshotCells(board);
    if (open.length === 0) return null;

    if (difficulty !== 'hard') return pick(open, random);

    const shortest = Math.min(...afloatLengths(board).concat([BOARD_SIZE]));
    const parity = shortest >= 2 ? open.filter((cell) => (cell.row + cell.col) % 2 === 0) : [];
    const pool = parity.length > 0 ? parity : open;

    const counts = probabilityMap(board);
    let best = [];
    let bestScore = -1;
    for (const cell of pool) {
      const score = counts[cell.row][cell.col];
      if (score > bestScore) {
        bestScore = score;
        best = [cell];
      } else if (score === bestScore) {
        best.push(cell);
      }
    }
    return bestScore > 0 ? pick(best, random) : pick(pool, random);
  }

  return {
    difficulty,

    nextShot(board) {
      if (difficulty !== 'easy' && activeHits.length > 0) {
        queueNeighbours(board);
        if (queue.length > 0) return queue[0];
        activeHits = [];
      }
      return huntShot(board);
    },

    registerResult(shot, outcome) {
      if (difficulty === 'easy') return;
      if (outcome.result === 'hit') {
        activeHits.push({ row: shot.row, col: shot.col });
      } else if (outcome.result === 'sunk') {
        const sunkCells = new Set(
          outcome.ship.cells.map((cell) => `${cell.row},${cell.col}`),
        );
        activeHits = activeHits.filter((hit) => !sunkCells.has(`${hit.row},${hit.col}`));
        queue = [];
      }
    },
  };
}
