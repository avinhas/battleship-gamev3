// Entry point: renders the three screens and wires up user interaction.

import {
  BOARD_SIZE,
  SHIP_TYPES,
  STANDARD_FLEET,
  canPlace,
  cellName,
  createBoard,
  fleetCellCount,
  fleetShipCount,
  fleetShips,
  placeShip,
  randomPlaceShips,
  removeShip,
  shipAt,
  shipCells,
  validateComposition,
} from './board.js';
import { createGame, enemyShot, playerShot, scoreboard } from './game.js';

const MAX_PER_TYPE = 4;

const state = {
  difficulty: 'medium',
  composition: { ...STANDARD_FLEET },
  fleet: [],
  playerBoard: createBoard(),
  selectedShipId: null,
  orientation: 'horizontal',
  game: null,
  busy: false,
  hovered: null,
};

const AI_DELAY_MS = 550;
const DIFFICULTY_LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

const el = (id) => document.getElementById(id);

function showScreen(id) {
  document.querySelectorAll('.screen').forEach((screen) => {
    screen.classList.toggle('active', screen.id === id);
  });
}

function openModal(id) {
  el(id).hidden = false;
}

function closeModal(id) {
  el(id).hidden = true;
  if (id === 'modal-history' && state.game && state.game.over) openModal('modal-gameover');
}

function closeAllModals() {
  document.querySelectorAll('.modal').forEach((modal) => {
    modal.hidden = true;
  });
}

function renderFleetEditor() {
  const editor = el('fleet-editor');
  editor.innerHTML = '';
  for (const type of SHIP_TYPES) {
    const count = state.composition[type.id] || 0;
    const row = document.createElement('div');
    row.className = 'fleet-row';
    row.innerHTML = `
      <span class="fleet-name">${type.name}</span>
      <span class="fleet-length">${'▮'.repeat(type.length)} <small>${type.length}</small></span>
      <span class="stepper">
        <button type="button" class="btn btn-icon" data-step="-1" data-type="${type.id}"
          aria-label="Remove one ${type.name}">−</button>
        <output class="fleet-count">${count}</output>
        <button type="button" class="btn btn-icon" data-step="1" data-type="${type.id}"
          aria-label="Add one ${type.name}">+</button>
      </span>
    `;
    editor.appendChild(row);
  }
  renderFleetSummary();
}

function renderFleetSummary() {
  const check = validateComposition(state.composition);
  const ships = fleetShipCount(state.composition);
  const cells = fleetCellCount(state.composition);
  el('fleet-summary').textContent = check.valid
    ? `${ships} ship${ships === 1 ? '' : 's'} · ${cells} cells`
    : check.reason;
  el('fleet-summary').classList.toggle('invalid', !check.valid);
  el('btn-start').disabled = !check.valid;
}

function stepComposition(typeId, delta) {
  const next = (state.composition[typeId] || 0) + delta;
  state.composition[typeId] = Math.min(MAX_PER_TYPE, Math.max(0, next));
  renderFleetEditor();
}

function randomizeFleet() {
  const composition = {};
  for (const type of SHIP_TYPES) composition[type.id] = 0;
  let guard = 0;
  do {
    for (const type of SHIP_TYPES) {
      composition[type.id] = Math.floor(Math.random() * 3);
    }
    guard += 1;
  } while (!validateComposition(composition).valid && guard < 100);
  if (!validateComposition(composition).valid) Object.assign(composition, STANDARD_FLEET);
  state.composition = composition;
  renderFleetEditor();
}

function startGame() {
  if (!validateComposition(state.composition).valid) return;
  beginPlacement();
}

/* ---------- Board rendering ---------- */

function renderBoard(container, board, { showShips = false, interactive = false } = {}) {
  container.innerHTML = '';
  container.classList.toggle('interactive', interactive);

  const corner = document.createElement('span');
  corner.className = 'label';
  container.appendChild(corner);
  for (let col = 0; col < BOARD_SIZE; col += 1) {
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = String(col + 1);
    container.appendChild(label);
  }

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = String.fromCharCode(65 + row);
    container.appendChild(label);

    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell';
      cell.dataset.row = String(row);
      cell.dataset.col = String(col);
      cell.setAttribute('aria-label', cellName(row, col));

      const ship = shipAt(board, row, col);
      const shot = board.shots[row][col];
      if (showShips && ship) cell.classList.add('ship');
      if (shot === 'miss') {
        cell.classList.add('miss', 'fired');
        cell.textContent = '•';
      } else if (shot === 'hit') {
        cell.classList.add(ship && ship.sunk ? 'sunk' : 'hit', 'fired');
        cell.textContent = '✕';
      }
      container.appendChild(cell);
    }
  }
}

function boardCell(container, row, col) {
  return container.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
}

/* ---------- Screen 2: placement ---------- */

function beginPlacement() {
  state.fleet = fleetShips(state.composition);
  state.playerBoard = createBoard();
  state.orientation = 'horizontal';
  state.selectedShipId = state.fleet[0].id;
  renderPlacement();
  setPlacementMessage('');
  showScreen('screen-placement');
}

function placedShip(shipId) {
  return state.playerBoard.ships.find((ship) => ship.id === shipId) || null;
}

function remainingShips() {
  return state.fleet.filter((ship) => !placedShip(ship.id));
}

function setPlacementMessage(text) {
  el('placement-message').textContent = text;
}

function selectShip(shipId) {
  state.selectedShipId = shipId;
  const ship = placedShip(shipId);
  if (ship) state.orientation = ship.orientation;
  renderPlacement();
}

function renderPlacement() {
  renderBoard(el('placement-board'), state.playerBoard, {
    showShips: true,
    interactive: true,
  });
  renderTray();
  el('orientation-label').textContent =
    state.orientation === 'horizontal' ? 'Horizontal' : 'Vertical';
  el('btn-ready').disabled = remainingShips().length > 0;
}

function renderTray() {
  const tray = el('ship-tray');
  tray.innerHTML = '';
  for (const ship of state.fleet) {
    const isPlaced = Boolean(placedShip(ship.id));
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tray-ship';
    button.classList.toggle('placed', isPlaced);
    button.classList.toggle('selected', ship.id === state.selectedShipId);
    button.dataset.shipId = ship.id;
    button.innerHTML = `
      <span>${ship.name}</span>
      <span class="pips">${'▮'.repeat(ship.length)}</span>
      <span class="status">${isPlaced ? 'Placed' : 'Waiting'}</span>
    `;
    tray.appendChild(button);
  }
}

function selectedFleetShip() {
  return state.fleet.find((ship) => ship.id === state.selectedShipId) || null;
}

function clearPreview() {
  el('placement-board')
    .querySelectorAll('.preview-valid, .preview-invalid')
    .forEach((cell) => cell.classList.remove('preview-valid', 'preview-invalid'));
}

function showPreview(row, col) {
  clearPreview();
  const ship = selectedFleetShip();
  if (!ship || placedShip(ship.id)) return;
  const valid = canPlace(state.playerBoard, ship.length, row, col, state.orientation);
  const container = el('placement-board');
  for (const cell of shipCells(ship.length, row, col, state.orientation)) {
    const node = boardCell(container, cell.row, cell.col);
    if (node) node.classList.add(valid ? 'preview-valid' : 'preview-invalid');
  }
}

function handlePlacementClick(row, col) {
  const existing = shipAt(state.playerBoard, row, col);
  const ship = selectedFleetShip();

  if (existing) {
    removeShip(state.playerBoard, existing.id);
    state.orientation = existing.orientation;
    setPlacementMessage(`${existing.name} returned to the tray.`);
    selectShip(existing.id);
    return;
  }

  if (!ship || placedShip(ship.id)) {
    setPlacementMessage('Select a ship from the tray first.');
    return;
  }

  if (!canPlace(state.playerBoard, ship.length, row, col, state.orientation)) {
    setPlacementMessage(
      `${ship.name} does not fit at ${cellName(row, col)} — out of bounds or overlapping.`,
    );
    return;
  }

  placeShip(state.playerBoard, ship, row, col, state.orientation);
  setPlacementMessage(`${ship.name} placed at ${cellName(row, col)}.`);
  const next = remainingShips()[0];
  state.selectedShipId = next ? next.id : ship.id;
  renderPlacement();
}

function rotateSelection() {
  state.orientation = state.orientation === 'horizontal' ? 'vertical' : 'horizontal';
  el('orientation-label').textContent =
    state.orientation === 'horizontal' ? 'Horizontal' : 'Vertical';
  if (state.hovered) showPreview(state.hovered.row, state.hovered.col);
}

function randomizePlacement() {
  const remaining = remainingShips();
  if (remaining.length === 0) return;
  if (!randomPlaceShips(state.playerBoard, remaining)) {
    setPlacementMessage('No room left for the remaining ships — clear the board and retry.');
    return;
  }
  setPlacementMessage('Remaining ships placed at random.');
  const next = remainingShips()[0];
  state.selectedShipId = next ? next.id : state.selectedShipId;
  renderPlacement();
}

function clearBoard() {
  state.playerBoard = createBoard();
  state.selectedShipId = state.fleet[0].id;
  setPlacementMessage('Board cleared.');
  renderPlacement();
}

/* ---------- Screen 3: battle ---------- */

function startBattle() {
  state.game = createGame({
    composition: state.composition,
    difficulty: state.difficulty,
    playerBoard: state.playerBoard,
  });
  state.busy = false;
  el('live-feed').innerHTML = '';
  el('score-difficulty').textContent = DIFFICULTY_LABELS[state.difficulty];
  setStatus('Your turn — click a cell on the enemy board to fire.');
  renderBattle();
  showScreen('screen-battle');
}

function setStatus(text) {
  el('battle-status').textContent = text;
}

function renderBattle() {
  const { game } = state;
  renderBoard(el('player-board'), game.playerBoard, { showShips: true });
  renderBoard(el('enemy-board'), game.enemyBoard, {
    showShips: false,
    interactive: !game.over,
  });
  const score = scoreboard(game);
  el('score-player').textContent = `${score.playerRemaining}/${score.playerTotal}`;
  el('score-enemy').textContent = `${score.enemyRemaining}/${score.enemyTotal}`;
}

function appendFeed(entry) {
  const feed = el('live-feed');
  const node = document.createElement('div');
  node.className = `feed-entry ${entry.actor} result-${entry.result}`;
  node.textContent = entry.text;
  feed.appendChild(node);
  feed.scrollTop = feed.scrollHeight;
}

function renderHistory() {
  const list = el('history-list');
  list.innerHTML = '';
  if (!state.game || state.game.log.length === 0) {
    const empty = document.createElement('li');
    empty.textContent = 'No moves yet.';
    list.appendChild(empty);
    return;
  }
  for (const entry of state.game.log) {
    const item = document.createElement('li');
    item.innerHTML = `<span class="turn-number">${entry.index}</span><span>${entry.text}</span>`;
    list.appendChild(item);
  }
}

function showHistory() {
  renderHistory();
  openModal('modal-history');
}

function finishGame() {
  const won = state.game.winner === 'player';
  el('gameover-message').textContent = won
    ? 'You sank the entire enemy fleet. Victory!'
    : 'The enemy sank your entire fleet. Defeat.';
  el('gameover-title').textContent = won ? 'Victory' : 'Defeat';
  setStatus(won ? 'You win!' : 'You lose.');
  renderBattle();
  openModal('modal-gameover');
}

function handleEnemyTurn() {
  let over = false;
  try {
    const outcome = enemyShot(state.game);
    if (outcome.entry) {
      appendFeed(outcome.entry);
      setStatus(outcome.entry.text);
    }
    renderBattle();
    over = state.game.over;
    if (over) {
      finishGame();
      return;
    }
    setStatus('Your turn — fire at the enemy board.');
  } finally {
    if (!over) state.busy = false;
  }
}

function handlePlayerShot(row, col) {
  const { game } = state;
  if (!game || game.over || state.busy) return;
  const outcome = playerShot(game, row, col);
  if (outcome.result === 'invalid') {
    setStatus('You already fired at that cell.');
    return;
  }
  state.busy = true;
  appendFeed(outcome.entry);
  setStatus(outcome.entry.text);
  renderBattle();
  if (game.over) {
    finishGame();
    return;
  }
  setStatus(`${outcome.entry.text} Enemy is aiming…`);
  window.setTimeout(handleEnemyTurn, AI_DELAY_MS);
}

function playAgain() {
  closeAllModals();
  state.game = null;
  state.playerBoard = createBoard();
  state.busy = false;
  showScreen('screen-setup');
}

function bindBattleScreen() {
  el('enemy-board').addEventListener('click', (event) => {
    const cell = event.target.closest('.cell');
    if (!cell) return;
    handlePlayerShot(Number(cell.dataset.row), Number(cell.dataset.col));
  });
  el('btn-history').addEventListener('click', showHistory);
  el('btn-gameover-history').addEventListener('click', () => {
    closeModal('modal-gameover');
    showHistory();
  });
  el('btn-new-game').addEventListener('click', playAgain);
  el('btn-play-again').addEventListener('click', playAgain);
}

function bindPlacementScreen() {
  const board = el('placement-board');

  board.addEventListener('click', (event) => {
    const cell = event.target.closest('.cell');
    if (!cell) return;
    handlePlacementClick(Number(cell.dataset.row), Number(cell.dataset.col));
  });

  board.addEventListener('mouseover', (event) => {
    const cell = event.target.closest('.cell');
    if (!cell) return;
    state.hovered = { row: Number(cell.dataset.row), col: Number(cell.dataset.col) };
    showPreview(state.hovered.row, state.hovered.col);
  });

  board.addEventListener('mouseleave', () => {
    state.hovered = null;
    clearPreview();
  });

  el('ship-tray').addEventListener('click', (event) => {
    const button = event.target.closest('.tray-ship');
    if (!button) return;
    const shipId = button.dataset.shipId;
    if (placedShip(shipId)) {
      removeShip(state.playerBoard, shipId);
      setPlacementMessage('Ship returned to the tray — place it again.');
    }
    selectShip(shipId);
  });

  el('btn-rotate').addEventListener('click', rotateSelection);
  el('btn-randomize-placement').addEventListener('click', randomizePlacement);
  el('btn-clear-board').addEventListener('click', clearBoard);
  el('btn-back-setup').addEventListener('click', () => showScreen('screen-setup'));
  el('btn-ready').addEventListener('click', () => {
    if (remainingShips().length > 0) return;
    startBattle();
  });
}

function bindSetupScreen() {
  el('fleet-editor').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-step]');
    if (!button) return;
    stepComposition(button.dataset.type, Number(button.dataset.step));
  });

  el('difficulty-options').addEventListener('change', (event) => {
    if (event.target.name === 'difficulty') state.difficulty = event.target.value;
  });

  el('btn-randomize-fleet').addEventListener('click', randomizeFleet);
  el('btn-standard-fleet').addEventListener('click', () => {
    state.composition = { ...STANDARD_FLEET };
    renderFleetEditor();
  });
  el('btn-how-to-play').addEventListener('click', () => openModal('modal-how-to-play'));
  el('btn-start').addEventListener('click', startGame);
}

function bindGlobalControls() {
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-close-modal]')) {
      closeModal(event.target.closest('.modal').id);
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      const historyWasOpen = !el('modal-history').hidden;
      closeAllModals();
      if (historyWasOpen && state.game && state.game.over) openModal('modal-gameover');
    }
    if (
      (event.key === 'r' || event.key === 'R') &&
      el('screen-placement').classList.contains('active')
    ) {
      rotateSelection();
    }
  });
}

function init() {
  bindSetupScreen();
  bindPlacementScreen();
  bindBattleScreen();
  bindGlobalControls();
  renderFleetEditor();
  showScreen('screen-setup');
}

init();
