// DANDELIONS — Game Engine + UI
// 5×5 grid game. Board is a 2D array: 0=empty, 1=flower, 2=seed.
// Rows 0-4 top to bottom, columns 0-4 left to right.

// ── Compass Directions ───────────────────────────────────────────────────────

const DIRECTIONS = {
  N:  [-1,  0],
  NE: [-1,  1],
  E:  [ 0,  1],
  SE: [ 1,  1],
  S:  [ 1,  0],
  SW: [ 1, -1],
  W:  [ 0, -1],
  NW: [-1, -1]
};

// ── Core Engine ──────────────────────────────────────────────────────────────

// Create and return a fresh 5×5 board of zeros.
function createBoard() {
  return Array.from({ length: 5 }, () => Array(5).fill(0));
}

// Return a deep copy of the board (so mutations don't affect the original).
function copyBoard(board) {
  return board.map(row => [...row]);
}

// Place a flower (1) at (row, col). Return the new board.
// Rules: allowed on empty (0) or seed (2). Rejected if cell is already a flower (1).
// Return null if placement is invalid.
function placeFlower(board, row, col) {
  if (board[row][col] === 1) return null;
  const newBoard = copyBoard(board);
  newBoard[row][col] = 1;
  return newBoard;
}

// Blow wind in the given direction (a key from DIRECTIONS).
// For EACH flower (1) on the board, trace outward one step at a time.
// At each step: if the cell is empty (0), set it to seed (2).
// If occupied (flower or seed), SKIP it and CONTINUE — propagation is not blocked.
// Stop when the next step would leave the 0-4 grid bounds.
// Return the new board.
function blowWind(board, direction) {
  const [dr, dc] = DIRECTIONS[direction];
  const newBoard = copyBoard(board);
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (board[r][c] === 1) {
        let nr = r + dr;
        let nc = c + dc;
        while (nr >= 0 && nr < 5 && nc >= 0 && nc < 5) {
          if (newBoard[nr][nc] === 0) {
            newBoard[nr][nc] = 2;
          }
          nr += dr;
          nc += dc;
        }
      }
    }
  }
  return newBoard;
}

// Return true if no zeros remain on the board (dandelions win).
function checkWin(board) {
  return board.every(row => row.every(cell => cell !== 0));
}

// Return array of {row, col} objects where a flower can be placed (value 0 or 2).
function getValidPlacements(board) {
  const placements = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (board[r][c] === 0 || board[r][c] === 2) {
        placements.push({ row: r, col: c });
      }
    }
  }
  return placements;
}

// Given an array of already-used direction strings,
// return the array of unused direction strings.
function getUnusedDirections(usedDirections) {
  return Object.keys(DIRECTIONS).filter(d => !usedDirections.includes(d));
}

// Print the board to console in a readable format.
// Use . for empty, * for flower, · for seed.
function printBoard(board) {
  const symbols = { 0: '.', 1: '*', 2: '\u00b7' };
  for (const row of board) {
    console.log(row.map(cell => symbols[cell]).join(' '));
  }
}

// ── Game State ───────────────────────────────────────────────────────────────

let board, round, usedDirections, lastUsedDirection, gameOver, inputLocked;

function initState() {
  board             = createBoard();
  round             = 0;
  usedDirections    = [];
  lastUsedDirection = null;
  gameOver          = false;
  inputLocked       = false;
}

// ── SVG helpers ──────────────────────────────────────────────────────────────

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
  }
  return el;
}

// ── Build SVG Grid ───────────────────────────────────────────────────────────

// Compass (x, y) positions for each direction label, inside viewBox -110..110
const COMPASS_XY = {
  N:  [  0, -82],
  NE: [ 58, -58],
  E:  [ 82,   0],
  SE: [ 58,  58],
  S:  [  0,  82],
  SW: [-58,  58],
  W:  [-82,   0],
  NW: [-58, -58]
};

function buildGrid() {
  const svg = document.getElementById('grid');
  svg.innerHTML = '';

  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const g = svgEl('g', {
        id: `cell-${r}-${c}`,
        class: 'cell empty',
        role: 'button',
        tabindex: '0',
        'aria-label': `Row ${r + 1} column ${c + 1}`
      });

      const rect = svgEl('rect', {
        x: c * 100 + 5,
        y: r * 100 + 5,
        width: 90,
        height: 90,
        rx: 10
      });

      const text = svgEl('text', {
        x: c * 100 + 50,
        y: r * 100 + 50,
        'dominant-baseline': 'central',
        'text-anchor': 'middle',
        class: 'cell-symbol'
      });

      g.appendChild(rect);
      g.appendChild(text);

      g.addEventListener('click', () => handleCellClick(r, c));
      g.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') handleCellClick(r, c);
      });

      svg.appendChild(g);
    }
  }
}

// ── Build Compass Rose ───────────────────────────────────────────────────────

function buildCompass() {
  const svg = document.getElementById('compass');
  svg.innerHTML = '';

  // Subtle outer ring
  svg.appendChild(svgEl('circle', { cx: 0, cy: 0, r: 100, class: 'compass-ring' }));

  // Center dot
  svg.appendChild(svgEl('circle', { cx: 0, cy: 0, r: 5, class: 'compass-center' }));

  for (const [dir, [cx, cy]] of Object.entries(COMPASS_XY)) {
    const g = svgEl('g', { id: `dir-${dir}`, class: 'dir-group' });

    // Spoke line from center to near the label
    const len = Math.hypot(cx, cy);
    const ux = cx / len;
    const uy = cy / len;
    g.appendChild(svgEl('line', {
      x1: ux * 8,  y1: uy * 8,
      x2: ux * 56, y2: uy * 56,
      class: 'dir-spoke'
    }));

    // Highlight ring (shown when active)
    g.appendChild(svgEl('circle', { cx, cy, r: 20, class: 'dir-bg' }));

    // Direction label
    const text = svgEl('text', {
      x: cx, y: cy,
      'dominant-baseline': 'central',
      'text-anchor': 'middle',
      class: 'dir-text'
    });
    text.textContent = dir;
    g.appendChild(text);

    svg.appendChild(g);
  }
}

// ── Render Functions ─────────────────────────────────────────────────────────

function renderBoard() {
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const g    = document.getElementById(`cell-${r}-${c}`);
      const text = g.querySelector('text');
      const val  = board[r][c];

      // Reset state classes
      g.className.baseVal = 'cell';

      if (val === 0) {
        g.classList.add('empty');
        text.textContent = '';
      } else if (val === 1) {
        g.classList.add('flower');
        text.textContent = '\u2731';   // ✱ heavy asterisk
      } else {
        g.classList.add('seed');
        text.textContent = '\u2022';   // • bullet
      }
    }
  }
}

function renderCompass(activeDir = null) {
  for (const dir of Object.keys(DIRECTIONS)) {
    const g = document.getElementById(`dir-${dir}`);
    g.className.baseVal = 'dir-group';   // reset all state classes
    if (dir === activeDir) {
      g.classList.add('active');          // currently blowing
    } else if (dir === lastUsedDirection) {
      g.classList.add('last-used');       // most recent gust (previous round)
    } else if (usedDirections.includes(dir)) {
      g.classList.add('used');            // older gusts
    }
  }
}

function renderRound() {
  document.getElementById('round-counter').textContent = `Round ${round} of 7`;
}

function setStatus(msg) {
  document.getElementById('status').textContent = msg;
}

// ── Game Logic ───────────────────────────────────────────────────────────────

function handleCellClick(row, col) {
  if (gameOver || inputLocked)  return;
  if (board[row][col] === 1)    return;   // already a flower — invalid tap

  inputLocked = true;
  round++;

  board = placeFlower(board, row, col);
  renderBoard();
  renderRound();
  setStatus('Wind is gathering\u2026');

  // Brief pause so the player sees their flower before seeds spread
  setTimeout(windTurn, 500);
}

function windTurn() {
  const unused = getUnusedDirections(usedDirections);
  const dir    = unused[Math.floor(Math.random() * unused.length)];
  usedDirections.push(dir);
  lastUsedDirection = dir;   // remember for the "last-used" highlight

  board = blowWind(board, dir);
  renderBoard();
  renderCompass(dir);
  setStatus(`Wind blows ${dir}!`);

  if (checkWin(board)) {
    setTimeout(endGame, 900);
    return;
  }

  if (round >= 7) {
    setTimeout(endGame, 900);
  } else {
    setTimeout(() => {
      renderCompass(null);    // de-highlight active direction
      setStatus('Tap a square to plant');
      inputLocked = false;
    }, 1200);
  }
}

function endGame() {
  gameOver = true;
  renderCompass(null);

  if (checkWin(board)) {
    setStatus('Dandelions win! All 25 squares covered!');
    document.getElementById('app').classList.add('win');
  } else {
    const empty = board.flat().filter(c => c === 0).length;
    setStatus(`Wind wins! ${empty} empty square${empty !== 1 ? 's' : ''} remain.`);
    document.getElementById('app').classList.add('lose');
  }
}

// ── Reset ────────────────────────────────────────────────────────────────────

function resetGame() {
  document.getElementById('app').classList.remove('win', 'lose');
  initState();
  renderBoard();
  renderCompass(null);
  document.getElementById('round-counter').textContent = 'Round 1 of 7';
  setStatus('Tap a square to plant');
}

// ── Initialise ───────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  buildGrid();
  buildCompass();
  initState();
  renderBoard();
  renderCompass(null);
  document.getElementById('reset-btn').addEventListener('click', resetGame);

  // How to Play toggle (mobile only — hidden via CSS on wide screens)
  const htpToggle = document.getElementById('htp-toggle');
  const htpBody   = document.getElementById('htp-body');
  htpToggle.addEventListener('click', () => {
    const expanded = htpToggle.getAttribute('aria-expanded') === 'true';
    htpToggle.setAttribute('aria-expanded', String(!expanded));
    htpBody.classList.toggle('htp-collapsed', expanded);
    htpToggle.textContent = expanded ? 'How to Play \u25B8' : 'How to Play \u25BE';
  });
});
