// Entry point: renders the three screens and wires up user interaction.

import {
  SHIP_TYPES,
  STANDARD_FLEET,
  fleetCellCount,
  fleetShipCount,
  validateComposition,
} from './board.js';

const MAX_PER_TYPE = 4;

const state = {
  difficulty: 'medium',
  composition: { ...STANDARD_FLEET },
};

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
  showScreen('screen-placement');
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
    if (event.key === 'Escape') closeAllModals();
  });
}

function init() {
  bindSetupScreen();
  bindGlobalControls();
  renderFleetEditor();
  showScreen('screen-setup');
}

init();
