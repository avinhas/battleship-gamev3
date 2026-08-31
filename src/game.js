// Battle state and turn flow built on top of the board model. No DOM access.

import {
  allSunk,
  cellName,
  createBoard,
  fire,
  randomPlaceFleet,
  shipsRemaining,
} from './board.js';
import { createAI } from './ai.js';

export function createGame({ composition, difficulty, playerBoard }) {
  const enemyBoard = randomPlaceFleet(composition);
  if (!enemyBoard) throw new Error('Could not place the enemy fleet.');
  return {
    composition,
    difficulty,
    playerBoard: playerBoard || createBoard(),
    enemyBoard,
    ai: createAI(difficulty),
    log: [],
    turn: 'player',
    over: false,
    winner: null,
  };
}

function describe(actor, row, col, outcome) {
  const who = actor === 'player' ? 'You' : 'Enemy';
  const target = cellName(row, col);
  if (outcome.result === 'sunk') {
    const owner = actor === 'player' ? 'Enemy' : 'Your';
    return `${who} fired at ${target} — Sunk ${owner} ${outcome.ship.name}!`;
  }
  if (outcome.result === 'hit') return `${who} fired at ${target} — Hit!`;
  return `${who} fired at ${target} — Miss`;
}

function record(game, actor, row, col, outcome) {
  const entry = {
    index: game.log.length + 1,
    actor,
    row,
    col,
    cell: cellName(row, col),
    result: outcome.result,
    shipName: outcome.ship ? outcome.ship.name : null,
    text: describe(actor, row, col, outcome),
  };
  game.log.push(entry);
  return entry;
}

export function playerShot(game, row, col) {
  if (game.over || game.turn !== 'player') return { result: 'invalid' };
  const outcome = fire(game.enemyBoard, row, col);
  if (outcome.result === 'invalid') return outcome;
  const entry = record(game, 'player', row, col, outcome);
  if (allSunk(game.enemyBoard)) {
    game.over = true;
    game.winner = 'player';
  } else {
    game.turn = 'enemy';
  }
  return { ...outcome, entry };
}

export function enemyShot(game) {
  if (game.over || game.turn !== 'enemy') return { result: 'invalid' };
  const shot = game.ai.nextShot(game.playerBoard);
  if (!shot) {
    game.turn = 'player';
    return { result: 'invalid', reason: 'no-target' };
  }
  const outcome = fire(game.playerBoard, shot.row, shot.col);
  if (outcome.result === 'invalid') {
    game.turn = 'player';
    return outcome;
  }
  game.ai.registerResult(shot, outcome);
  const entry = record(game, 'enemy', shot.row, shot.col, outcome);
  if (allSunk(game.playerBoard)) {
    game.over = true;
    game.winner = 'enemy';
  } else {
    game.turn = 'player';
  }
  return { ...outcome, entry };
}

export function scoreboard(game) {
  return {
    playerRemaining: shipsRemaining(game.playerBoard),
    playerTotal: game.playerBoard.ships.length,
    enemyRemaining: shipsRemaining(game.enemyBoard),
    enemyTotal: game.enemyBoard.ships.length,
  };
}
