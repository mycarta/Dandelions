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
let difficulty = 'easy';   // 'easy' | 'hard' — persists across resets

// Per-cell random rotation so each flower looks slightly different
const cellRotation = {};

function initState() {
  board             = createBoard();
  round             = 0;
  usedDirections    = [];
  lastUsedDirection = null;
  gameOver          = false;
  inputLocked       = false;
  Object.keys(cellRotation).forEach(k => delete cellRotation[k]);
  // difficulty is intentionally not reset here
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
        text.removeAttribute('transform');
      } else if (val === 1) {
        g.classList.add('flower');
        text.textContent = '\u2731';   // ✱ heavy asterisk
        // Assign a random rotation once per cell so flowers look unique
        const key = `${r}-${c}`;
        if (!(key in cellRotation)) cellRotation[key] = Math.round(Math.random() * 80 - 40);
        const cx = c * 100 + 50;
        const cy = r * 100 + 50;
        text.setAttribute('transform', `rotate(${cellRotation[key]}, ${cx}, ${cy})`);
      } else {
        g.classList.add('seed');
        text.textContent = '\u2022';   // • bullet
        text.removeAttribute('transform');
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

// ── Wind AI ──────────────────────────────────────────────────────────────────

// Greedy strategy: pick the unused direction that produces the FEWEST new seeds.
// Ties are broken randomly.
function pickGreedyDirection(board, usedDirections) {
  const unused = getUnusedDirections(usedDirections);

  let minSeeds = Infinity;
  let best     = [];

  for (const dir of unused) {
    const after    = blowWind(board, dir);
    let   newSeeds = 0;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (board[r][c] === 0 && after[r][c] === 2) newSeeds++;
      }
    }
    if (newSeeds < minSeeds) {
      minSeeds = newSeeds;
      best     = [dir];
    } else if (newSeeds === minSeeds) {
      best.push(dir);
    }
  }

  return best[Math.floor(Math.random() * best.length)];
}

// ── Game Logic ───────────────────────────────────────────────────────────────

function handleCellClick(row, col) {
  // Tutorial tap interception
  if (tutState.active) {
    const step = TUT_STEPS[tutState.step];
    if (step && step.type === 'tap') {
      if (row !== step.highlight.r || col !== step.highlight.c) return;
      clearTutHighlight();
      tutState.board = placeFlower(tutState.board, row, col);
      const key = `tut-${row}-${col}`;
      if (!(key in cellRotation)) cellRotation[key] = Math.round(Math.random() * 80 - 40);
      renderBoardFrom(tutState.board);
      animateFlowerPop(row, col);
      // Defer the advance so the current event-handler and paint cycle
      // both complete before showTutStep mutates the DOM again.
      setTimeout(() => { if (tutState.active) advanceTutStep(); }, 0);
    }
    return;
  }

  if (gameOver || inputLocked)  return;
  if (board[row][col] === 1)    return;   // already a flower — invalid tap

  inputLocked = true;
  round++;

  board = placeFlower(board, row, col);
  renderBoard();
  animateFlowerPop(row, col);
  renderRound();
  setStatus('Wind is gathering\u2026');

  // Brief pause so the player sees their flower before seeds spread
  setTimeout(windTurn, 500);
}

function windTurn() {
  const unused = getUnusedDirections(usedDirections);
  const dir = difficulty === 'hard'
    ? pickGreedyDirection(board, usedDirections)
    : unused[Math.floor(Math.random() * unused.length)];

  usedDirections.push(dir);
  lastUsedDirection = dir;   // remember for the "last-used" highlight

  const beforeBoard = copyBoard(board);
  board = blowWind(board, dir);
  renderBoard();
  animateSeedsBlow(beforeBoard, dir);
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
    setStatus('\uD83C\uDF3B Dandelions win! All 25 squares covered!');
    document.getElementById('app').classList.add('win');
    setTimeout(animateWave,    100);
    setTimeout(launchConfetti, 400);
  } else {
    const empty = board.flat().filter(c => c === 0).length;
    setStatus(`Wind wins! ${empty} empty square${empty !== 1 ? 's' : ''} remain.`);
    document.getElementById('app').classList.add('lose');
    setTimeout(animateWilt, 200);
  }
}

// ── Animation Helpers ────────────────────────────────────────────────────────

// Pop a newly placed flower (SVG text) from scale 0 → 1, preserving its rotation.
function animateFlowerPop(r, c) {
  const text = document.querySelector(`#cell-${r}-${c} text`);
  if (!text) return;
  // Read the rotation already set by renderBoard/renderBoardFrom and thread it
  // into the keyframe via a CSS custom property so the pop honours the angle.
  const match = (text.style.transform || '').match(/rotate\((-?\d+)deg\)/);
  const rotDeg = match ? match[1] : '0';
  text.style.setProperty('--fr', `${rotDeg}deg`);
  text.classList.remove('flower-pop');
  void text.getBoundingClientRect();
  text.classList.add('flower-pop');
  text.addEventListener('animationend', () => {
    text.classList.remove('flower-pop');
    text.style.removeProperty('--fr');
    text.style.transform = `rotate(${rotDeg}deg)`;   // reassert after keyframe
  }, { once: true });
}

// Stagger-animate seed cells appearing in order of distance along the wind ray.
// Call AFTER renderBoard() so the DOM already has the new seed symbols.
function animateSeedsBlow(beforeBoard, dir) {
  const [dr, dc] = DIRECTIONS[dir];
  const schedule = {};   // "r-c" → distance step from nearest source flower

  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (beforeBoard[r][c] === 1) {
        let step = 1, nr = r + dr, nc = c + dc;
        while (nr >= 0 && nr < 5 && nc >= 0 && nc < 5) {
          if (beforeBoard[nr][nc] === 0) {
            const key = `${nr}-${nc}`;
            if (!(key in schedule) || step < schedule[key]) schedule[key] = step;
          }
          step++; nr += dr; nc += dc;
        }
      }
    }
  }

  // Apply in the next frame so the DOM paint for renderBoard() has settled.
  requestAnimationFrame(() => {
    for (const [key, step] of Object.entries(schedule)) {
      const [r, c] = key.split('-').map(Number);
      const text = document.querySelector(`#cell-${r}-${c} text`);
      if (!text) continue;
      text.style.animationDelay = `${(step - 1) * 55}ms`;
      text.classList.remove('seed-appear');
      void text.getBoundingClientRect();
      text.classList.add('seed-appear');
      text.addEventListener('animationend', () => {
        text.classList.remove('seed-appear');
        text.style.animationDelay = '';
      }, { once: true });
    }
  });
}

// Win: brief ripple-wave across all cells.
function animateWave() {
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const rect = document.querySelector(`#cell-${r}-${c} rect`);
      if (!rect) continue;
      rect.style.animationDelay = `${(r + c) * 55}ms`;
      rect.classList.remove('cell-wave');
      void rect.getBoundingClientRect();
      rect.classList.add('cell-wave');
      rect.addEventListener('animationend', () => {
        rect.classList.remove('cell-wave');
        rect.style.animationDelay = '';
      }, { once: true });
    }
  }
}

// Win: confetti dots float upward out of the grid area.
function launchConfetti() {
  const container = document.getElementById('confetti');
  if (!container) return;
  container.innerHTML = '';
  const palette = ['#f5e642','#7dbe40','#c5e8c5','#f5a623','#ffffff','#a8ffa8'];
  for (let i = 0; i < 48; i++) {
    const dot = document.createElement('div');
    dot.className = 'confetti-dot';
    const sz = 4 + Math.random() * 7;
    dot.style.cssText = [
      `left:${3 + Math.random() * 94}%`,
      `animation-delay:${(Math.random() * 1.4).toFixed(2)}s`,
      `animation-duration:${(1.4 + Math.random() * 1.2).toFixed(2)}s`,
      `width:${sz.toFixed(1)}px`,
      `height:${sz.toFixed(1)}px`,
      `background:${palette[Math.floor(Math.random() * palette.length)]}`,
      `border-radius:${Math.random() > 0.45 ? '50%' : '3px'}`,
    ].join(';');
    container.appendChild(dot);
  }
  setTimeout(() => { container.innerHTML = ''; }, 3800);
}

// Loss: flowers droop gently.
function animateWilt() {
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (board[r][c] === 1) {
        const text = document.querySelector(`#cell-${r}-${c} text`);
        if (!text) continue;
        text.classList.remove('flower-wilt');
        void text.getBoundingClientRect();
        text.classList.add('flower-wilt');
      }
    }
  }
}

// ── Tutorial ─────────────────────────────────────────────────────────────────

const TUT_STEPS = [
  // Step 0 ── Welcome
  {
    type:     'message',
    msg:      'Welcome to Dandelions! \uD83C\uDF3B Plant flowers and the Wind will spread seeds. Cover all 25 squares to win!',
    btnLabel: 'Show me how \u2192',
  },
  // Step 1 ── First flower (centre)
  {
    type:      'tap',
    highlight: { r: 2, c: 2 },
    msg:       '\uD83D\uDC46 Tap the glowing square to plant your first flower.',
  },
  // Step 2 ── Wind W   → seeds at (2,1) and (2,0)
  {
    type:     'wind',
    dir:      'W',
    msg:      'The Wind blows West! Seeds spread left from your flower along the row.',
    btnLabel: 'Got it \u2192',
  },
  // Step 3 ── Second flower (top-right corner)
  {
    type:      'tap',
    highlight: { r: 0, c: 4 },
    msg:       '\uD83D\uDC46 Now plant a flower in the top-right corner.',
  },
  // Step 4 ── Wind S   → seeds fill column 4 and column 2 downward
  {
    type:     'wind',
    dir:      'S',
    msg:      'The Wind blows South! Both flowers spread seeds downward.',
    btnLabel: 'Interesting! \u2192',
  },
  // Step 5 ── Third flower (not on the (4,0)–(2,2)–(0,4) diagonal)
  //   Board so far: flowers at (2,2) and (0,4);
  //   seeds at (2,0),(2,1) from W; (3,2),(4,2),(1,4),(2,4),(3,4),(4,4) from S.
  //   (4,1) is empty. ✓
  //
  //   Guaranteed square (1,3):
  //     Flower (2,2) going NE  → (1,3) empty → seed ✓
  //     Flower (0,4) going SW  → (1,3) empty → seed ✓
  //   Both NE and SW are still unused after W and S. ✓
  {
    type:      'tap',
    highlight: { r: 4, c: 1 },
    msg:       '\uD83D\uDC46 Plant a third flower here. \uD83D\uDCA1 While you decide — look at the square in row\u00a02, column\u00a04 (second from top, fourth from left). Your centre flower can reach it going north-east, AND your corner flower can reach it going south-west. The Wind can only skip one of those directions\u00a0— so that square is already guaranteed!',
  },
  // Step 6 ── Wind NE  → fills (1,3) from flower (2,2); (0,4)→SW would also cover it
  {
    type:     'wind',
    dir:      'NE',
    msg:      'The Wind blows north-east! See row\u00a02, column\u00a04? It just filled — your centre flower pushed a seed there. But it didn\u2019t matter which way the Wind chose: your corner flower would have filled it from the south-west too. Two flowers, two paths — that square was never in doubt!',
    btnLabel: 'Makes sense! \u2192',
  },
  // Step 7 ── Final message
  {
    type:     'message',
    msg:      '3 rounds down, 4 to go in a real game. Find more of these guaranteed squares and spend your remaining flowers on the truly uncertain spots. You\u2019ve got this! \uD83C\uDF3B',
    btnLabel: 'Play for real! \uD83C\uDF3B',
  },
];

let tutState = { active: false, step: 0, board: null, usedDirs: [] };

function startTutorial() {
  // Freeze any running game
  inputLocked = true;
  tutState = { active: true, step: 0, board: createBoard(), usedDirs: [] };
  renderCompass(null);
  renderBoardFrom(tutState.board);
  showTutStep(0);
}

function showTutStep(n) {
  tutState.step = n;
  if (n >= TUT_STEPS.length) { endTutorial(); return; }
  const step = TUT_STEPS[n];

  clearTutHighlight();
  renderBoardFrom(tutState.board);

  const panel  = document.getElementById('tut-panel');
  const msgEl  = document.getElementById('tut-msg');
  const actEl  = document.getElementById('tut-actions');
  const overlay = document.getElementById('tut-overlay');

  panel.hidden  = false;
  overlay.hidden = false;

  // Update message (swap for instructions that live over the grid on 'tap' steps)
  if (step.type === 'tap') {
    msgEl.textContent = step.msg;
    actEl.innerHTML   = '';
  } else {
    msgEl.textContent = step.msg;
    actEl.innerHTML   = '';

    const nextBtn = document.createElement('button');
    nextBtn.type      = 'button';
    nextBtn.className = 'tut-btn';
    nextBtn.textContent = step.btnLabel || 'Next \u2192';
    nextBtn.addEventListener('click', () => {
      nextBtn.disabled = true;
      if (step.type === 'wind') {
        runTutWind(step.dir, advanceTutStep);
      } else if (step.type === 'message' && n === TUT_STEPS.length - 1) {
        endTutorial();
      } else {
        advanceTutStep();
      }
    }, { once: true });
    actEl.appendChild(nextBtn);
  }

  // Always show skip
  const skipBtn = document.createElement('button');
  skipBtn.type      = 'button';
  skipBtn.className = 'tut-btn tut-skip';
  skipBtn.textContent = 'Skip tutorial';
  skipBtn.addEventListener('click', endTutorial, { once: true });
  actEl.appendChild(skipBtn);

  if (step.type === 'tap') setTutHighlight(step.highlight.r, step.highlight.c);
}

function advanceTutStep() { showTutStep(tutState.step + 1); }

function runTutWind(dir, cb) {
  tutState.usedDirs.push(dir);
  const before = copyBoard(tutState.board);
  tutState.board = blowWind(tutState.board, dir);
  renderBoardFrom(tutState.board);
  animateSeedsBlow(before, dir);

  // Flash compass rose
  const dg = document.getElementById(`dir-${dir}`);
  if (dg) {
    dg.className.baseVal = 'dir-group active';
    setTimeout(() => { dg.className.baseVal = 'dir-group last-used'; }, 1400);
  }
  setTimeout(cb, 1500);
}

function setTutHighlight(r, c) {
  document.getElementById(`cell-${r}-${c}`)?.classList.add('tut-highlight');
}

function clearTutHighlight() {
  document.querySelectorAll('.tut-highlight').forEach(el => el.classList.remove('tut-highlight'));
}

// Render an arbitrary board object (used during tutorial).
function renderBoardFrom(brd) {
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const g    = document.getElementById(`cell-${r}-${c}`);
      const text = g.querySelector('text');
      const val  = brd[r][c];
      g.className.baseVal = 'cell';

      if (val === 0) {
        g.classList.add('empty');
        text.textContent   = '';
        text.style.transform = '';
      } else if (val === 1) {
        g.classList.add('flower');
        text.textContent = '\u2731';
        const key = `tut-${r}-${c}`;
        if (!(key in cellRotation)) cellRotation[key] = Math.round(Math.random() * 80 - 40);
        text.style.transform = `rotate(${cellRotation[key]}deg)`;
      } else {
        g.classList.add('seed');
        text.textContent   = '\u2022';
        text.style.transform = '';
      }
    }
  }
}

function endTutorial() {
  tutState.active = false;
  clearTutHighlight();
  document.getElementById('tut-overlay').hidden = true;
  document.getElementById('tut-panel').hidden   = true;
  renderCompass(null);
  resetGame();
}

// ── Reset ────────────────────────────────────────────────────────────────────

function resetGame() {
  document.getElementById('app').classList.remove('win', 'lose');
  document.getElementById('confetti').innerHTML = '';
  initState();   // also clears cellRotation
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

  // Tutorial button
  document.getElementById('tutorial-btn').addEventListener('click', startTutorial);

  // Difficulty toggle
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      difficulty = btn.dataset.diff;
      document.querySelectorAll('.diff-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.diff === difficulty)
      );
    });
  });

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
