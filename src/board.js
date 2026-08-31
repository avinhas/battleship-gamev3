// Pure game-model helpers: grid, ships, placement validation and attack resolution.
// No DOM access lives in this module.

export const BOARD_SIZE = 10;

export const SHIP_TYPES = [
  { id: 'carrier', name: 'Carrier', length: 5 },
  { id: 'battleship', name: 'Battleship', length: 4 },
  { id: 'cruiser', name: 'Cruiser', length: 3 },
  { id: 'submarine', name: 'Submarine', length: 3 },
  { id: 'destroyer', name: 'Destroyer', length: 2 },
];

export const STANDARD_FLEET = {
  carrier: 1,
  battleship: 1,
  cruiser: 1,
  submarine: 1,
  destroyer: 1,
};

export const MAX_SHIPS = 10;
export const MAX_FLEET_CELLS = 30;

export function shipTypeById(id) {
  return SHIP_TYPES.find((type) => type.id === id) || null;
}

export function cellName(row, col) {
  return `${String.fromCharCode(65 + row)}${col + 1}`;
}

export function inBounds(row, col) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

export function fleetShips(composition) {
  const ships = [];
  for (const type of SHIP_TYPES) {
    const count = composition[type.id] || 0;
    for (let i = 0; i < count; i += 1) {
      ships.push({
        id: `${type.id}-${i + 1}`,
        typeId: type.id,
        name: count > 1 ? `${type.name} ${i + 1}` : type.name,
        length: type.length,
      });
    }
  }
  return ships;
}

export function fleetCellCount(composition) {
  return SHIP_TYPES.reduce(
    (total, type) => total + (composition[type.id] || 0) * type.length,
    0,
  );
}

export function fleetShipCount(composition) {
  return SHIP_TYPES.reduce((total, type) => total + (composition[type.id] || 0), 0);
}

export function validateComposition(composition) {
  const ships = fleetShipCount(composition);
  const cells = fleetCellCount(composition);
  if (ships < 1) return { valid: false, reason: 'Choose at least one ship.' };
  if (ships > MAX_SHIPS) return { valid: false, reason: `At most ${MAX_SHIPS} ships.` };
  if (cells > MAX_FLEET_CELLS) {
    return { valid: false, reason: `At most ${MAX_FLEET_CELLS} ship cells.` };
  }
  return { valid: true, reason: '' };
}

export function createBoard() {
  return {
    size: BOARD_SIZE,
    // grid[row][col] holds the id of the ship occupying the cell, or null.
    grid: Array.from({ length: BOARD_SIZE }, () => new Array(BOARD_SIZE).fill(null)),
    // shots[row][col] is null, 'miss' or 'hit'.
    shots: Array.from({ length: BOARD_SIZE }, () => new Array(BOARD_SIZE).fill(null)),
    ships: [],
  };
}

export function shipCells(length, row, col, orientation) {
  const cells = [];
  for (let i = 0; i < length; i += 1) {
    cells.push(
      orientation === 'vertical' ? { row: row + i, col } : { row, col: col + i },
    );
  }
  return cells;
}

export function canPlace(board, length, row, col, orientation, ignoreShipId = null) {
  if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
  if (length < 1) return false;
  const cells = shipCells(length, row, col, orientation);
  return cells.every((cell) => {
    if (!inBounds(cell.row, cell.col)) return false;
    const occupant = board.grid[cell.row][cell.col];
    return occupant === null || occupant === ignoreShipId;
  });
}

export function placeShip(board, ship, row, col, orientation) {
  if (!canPlace(board, ship.length, row, col, orientation, ship.id)) return false;
  removeShip(board, ship.id);
  const cells = shipCells(ship.length, row, col, orientation);
  const placed = {
    id: ship.id,
    typeId: ship.typeId,
    name: ship.name,
    length: ship.length,
    row,
    col,
    orientation,
    cells,
    hits: 0,
    sunk: false,
  };
  cells.forEach((cell) => {
    board.grid[cell.row][cell.col] = ship.id;
  });
  board.ships.push(placed);
  return placed;
}

export function removeShip(board, shipId) {
  const index = board.ships.findIndex((ship) => ship.id === shipId);
  if (index === -1) return false;
  board.ships[index].cells.forEach((cell) => {
    if (board.grid[cell.row][cell.col] === shipId) {
      board.grid[cell.row][cell.col] = null;
    }
  });
  board.ships.splice(index, 1);
  return true;
}

export function shipAt(board, row, col) {
  if (!inBounds(row, col)) return null;
  const id = board.grid[row][col];
  if (!id) return null;
  return board.ships.find((ship) => ship.id === id) || null;
}

export function randomPlaceShips(board, ships, random = Math.random) {
  for (const ship of ships) {
    const options = [];
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        for (const orientation of ['horizontal', 'vertical']) {
          if (canPlace(board, ship.length, row, col, orientation)) {
            options.push({ row, col, orientation });
          }
        }
      }
    }
    if (options.length === 0) return false;
    const pick = options[Math.floor(random() * options.length)];
    placeShip(board, ship, pick.row, pick.col, pick.orientation);
  }
  return true;
}

export function randomPlaceFleet(composition, random = Math.random) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const board = createBoard();
    if (randomPlaceShips(board, fleetShips(composition), random)) return board;
  }
  return null;
}

export function allSunk(board) {
  return board.ships.length > 0 && board.ships.every((ship) => ship.sunk);
}

export function shipsRemaining(board) {
  return board.ships.filter((ship) => !ship.sunk).length;
}

export function fire(board, row, col) {
  if (!inBounds(row, col)) return { result: 'invalid', reason: 'out-of-bounds' };
  if (board.shots[row][col] !== null) {
    return { result: 'invalid', reason: 'already-fired' };
  }
  const ship = shipAt(board, row, col);
  if (!ship) {
    board.shots[row][col] = 'miss';
    return { result: 'miss', row, col, gameOver: false };
  }
  board.shots[row][col] = 'hit';
  ship.hits += 1;
  if (ship.hits >= ship.length) ship.sunk = true;
  return {
    result: ship.sunk ? 'sunk' : 'hit',
    row,
    col,
    ship: ship.sunk ? ship : undefined,
    gameOver: allSunk(board),
  };
}
