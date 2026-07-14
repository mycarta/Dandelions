// DANDELIONS — Scripted verification games (runtime-agnostic).
//
// Feeds five complete, legal game sequences through the REAL engine functions
// (game.js's own createBoard/placeFlower/blowWind/getUnusedDirections/
// pickGreedyDirection, and wind-ai-smart.js's classifyBoard/chooseSmartDirection)
// and checks the guaranteed-square classifier / smart-Wind choice function
// against hand-verified checkpoints. Nothing here reimplements propagation —
// every "would this seed X" check calls the real blowWind.
//
// Only Test 1 is Ben Orlin's worked example (Math Games with Bad Drawings,
// p.58). Tests 2-5 are our own generalization of the guaranteed-square idea
// and must not be attributed to the book.
//
// This file is loaded two ways, never via require()/import — it expects
// createBoard/placeFlower/blowWind/getUnusedDirections/pickGreedyDirection
// (from game.js) and classifyBoard/chooseSmartDirection (from wind-ai-smart.js)
// to already be in scope as globals:
//   - Node: tools/replay.js runs game.js, wind-ai-smart.js, then this file,
//     all via vm.runInContext in one shared context (top-level function/const
//     declarations persist across runInContext calls on the same context,
//     exactly like multiple <script> tags in one HTML document).
//   - Browser: tools/replay.html loads game.js, wind-ai-smart.js, then this
//     file via three plain <script src> tags in one page.

var LOG_LINES = [];

function report(line) {
  LOG_LINES.push(line);
  if (typeof console !== 'undefined') console.log(line);
}

var passed = 0;
var failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
    report('  ✓ ' + msg);
  } else {
    failed++;
    report('  ✗ FAILED: ' + msg);
  }
}

function cellKey(row, col) { return row + '-' + col; }

function setsEqual(a, b) {
  var sa = {}, sb = {};
  a.forEach(function (x) { sa[x] = true; });
  b.forEach(function (x) { sb[x] = true; });
  var ka = Object.keys(sa), kb = Object.keys(sb);
  if (ka.length !== kb.length) return false;
  return ka.every(function (k) { return sb[k]; });
}

function snapshot(board) {
  var symbols = { 0: '.', 1: '*', 2: 'o' };
  return board.map(function (row) {
    return row.map(function (cell) { return symbols[cell]; }).join(' ');
  }).join('\n');
}

function logBoard(label, board, used) {
  var available = getUnusedDirections(used);
  report('');
  report(label);
  report(snapshot(board));
  report('used: {' + used.join(', ') + '}  available: {' + available.join(', ') + '}');
}

function plant(board, row, col) {
  var next = placeFlower(board, row, col);
  if (next === null) throw new Error('Illegal plant at (' + row + ',' + col + ') — cell already has a flower');
  return next;
}

function diffSeeds(before, after) {
  var seeds = [];
  for (var r = 0; r < 5; r++) {
    for (var c = 0; c < 5; c++) {
      if (before[r][c] === 0 && after[r][c] === 2) seeds.push(cellKey(r, c));
    }
  }
  return seeds;
}

// Blow the wind, recording it as used and returning the new board + new seeds.
function gust(board, dir, used) {
  var after = blowWind(board, dir);
  var newSeeds = diffSeeds(board, after);
  used.push(dir);
  return { board: after, newSeeds: newSeeds };
}

// ── Test 1 — Orlin's guaranteed square (Math Games with Bad Drawings, p.58) ─
function test1() {
  report('');
  report('========================================================');
  report('TEST 1 — Orlin’s guaranteed square (the book’s worked example)');
  report('========================================================');

  var board = createBoard();
  var used = [];

  board = plant(board, 0, 3);
  logBoard('After plant (0,3)', board, used);

  var g1 = gust(board, 'N', used);
  board = g1.board;
  assert(g1.newSeeds.length === 0, 'Gust N produces zero new seeds (top-edge flower, ray leaves the board)');
  logBoard('After gust N', board, used);

  board = plant(board, 2, 1);
  logBoard('CHECKPOINT (Wind turn 2)', board, used);

  var available = getUnusedDirections(used);
  assert(setsEqual(available, ['NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']), 'available = {NE,E,SE,S,SW,W,NW}');

  var c1 = classifyBoard(board, available, blowWind);
  var sq23 = c1.guaranteed.filter(function (g) { return g.row === 2 && g.col === 3; })[0];
  assert(!!sq23, '(2,3) is classified GUARANTEED');
  assert(!!sq23 && setsEqual(sq23.reachingDirections, ['S', 'E']), '(2,3) reachable via exactly {S from (0,3), E from (2,1)}');
}

// ── Test 2 — Clear in-doubt ──────────────────────────────────────────────────
function test2() {
  report('');
  report('========================================================');
  report('TEST 2 — Clear in-doubt (our generalization, not from the book)');
  report('========================================================');

  var board = createBoard();
  var used = [];

  board = plant(board, 2, 2);
  logBoard('CHECKPOINT (Wind turn 1)', board, used);

  var available = getUnusedDirections(used);
  assert(setsEqual(available, ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']), 'all 8 directions available');

  var c2 = classifyBoard(board, available, blowWind);
  var sq24 = c2.inDoubt.filter(function (s) { return s.row === 2 && s.col === 4; })[0];
  assert(!!sq24 && sq24.direction === 'E', '(2,4) reachable via exactly {E} -> IN_DOUBT');
  assert(c2.guaranteed.length === 0, 'total GUARANTEED squares = 0 (impossible with a single flower)');
}

// ── Test 3 — Same-direction trap + between/beyond distinction ──────────────
function test3() {
  report('');
  report('========================================================');
  report('TEST 3 — Same-direction trap + between/beyond (our generalization)');
  report('========================================================');

  var board = createBoard();
  var used = [];

  board = plant(board, 0, 2);
  logBoard('After plant (0,2)', board, used);

  var g1 = gust(board, 'NE', used);
  board = g1.board;
  assert(g1.newSeeds.length === 0, 'Gust NE produces zero new seeds (top-edge flower)');
  logBoard('After gust NE', board, used);

  board = plant(board, 2, 2);
  logBoard('CHECKPOINT (Wind turn 2)', board, used);

  var available = getUnusedDirections(used);
  assert(setsEqual(available, ['N', 'E', 'SE', 'S', 'SW', 'W', 'NW']), 'available = {N,E,SE,S,SW,W,NW}');

  var c3 = classifyBoard(board, available, blowWind);
  var byKey = {};
  c3.guaranteed.forEach(function (s) { byKey[cellKey(s.row, s.col)] = { status: 'GUARANTEED', s: s }; });
  c3.inDoubt.forEach(function (s) { byKey[cellKey(s.row, s.col)] = { status: 'IN_DOUBT', s: s }; });

  var s42 = byKey[cellKey(4, 2)];
  assert(!!s42 && s42.status === 'IN_DOUBT' && s42.s.direction === 'S',
    '(4,2): reachable from BOTH flowers but only via {S} -> IN_DOUBT (same direction is not a guarantee)');

  var s12 = byKey[cellKey(1, 2)];
  assert(!!s12 && s12.status === 'GUARANTEED' && setsEqual(s12.s.reachingDirections, ['S', 'N']),
    '(1,2) BETWEEN the flowers: via {S from (0,2), N from (2,2)} -> GUARANTEED');

  var s32 = byKey[cellKey(3, 2)];
  assert(!!s32 && s32.status === 'IN_DOUBT' && s32.s.direction === 'S',
    '(3,2) BEYOND both flowers: via {S} only -> IN_DOUBT');
}

// ── Test 4 — Occupied squares are skipped, not blocking ─────────────────────
function test4() {
  report('');
  report('========================================================');
  report('TEST 4 — Occupied squares are skipped, not blocking (our generalization)');
  report('========================================================');

  var board = createBoard();
  var used = [];

  board = plant(board, 0, 2);
  logBoard('After plant (0,2)', board, used);

  var g = gust(board, 'S', used);
  board = g.board;
  assert(setsEqual(g.newSeeds, ['1-2', '2-2', '3-2', '4-2']), 'Gust S seeds exactly {(1,2),(2,2),(3,2),(4,2)}');
  logBoard('After gust S', board, used);

  board = plant(board, 2, 0);
  logBoard('After plant (2,0)', board, used);

  g = gust(board, 'E', used);
  board = g.board;
  assert(setsEqual(g.newSeeds, ['0-3', '0-4', '2-1', '2-3', '2-4']),
    'Gust E seeds exactly {(0,3),(0,4),(2,1),(2,3),(2,4)} — (2,2) is skipped, not blocking; (2,3)/(2,4) seeded beyond it');
  logBoard('CHECKPOINT (after step 4)', board, used);
}

// ── Test 5 — Greedy self-destructs, smart Wind sees the skip ───────────────
function test5() {
  report('');
  report('========================================================');
  report('TEST 5 — Greedy self-destructs, smart Wind sees the skip (showcase, our generalization)');
  report('========================================================');

  var board = createBoard();
  var used = [];

  board = plant(board, 2, 1);
  var g = gust(board, 'N', used);
  board = g.board;
  logBoard('After plant(2,1) + gust N', board, used);

  board = plant(board, 2, 3);
  g = gust(board, 'NW', used);
  board = g.board;
  logBoard('After plant(2,3) + gust NW', board, used);

  board = plant(board, 2, 0);
  g = gust(board, 'E', used);
  board = g.board;
  assert(setsEqual(g.newSeeds, ['2-2', '2-4']), 'Gust E seeds (2,2) and (2,4)');
  logBoard('After plant(2,0) + gust E', board, used);

  board = plant(board, 2, 2);   // on top of a seed — legal
  g = gust(board, 'W', used);
  board = g.board;
  assert(g.newSeeds.length === 0, 'Gust W produces zero new seeds (row 2 fully occupied to the west)');
  logBoard('After plant(2,2)-on-seed + gust W', board, used);

  board = plant(board, 2, 4);   // on top of a seed — legal
  logBoard('CHECKPOINT (Wind turn 5)', board, used);

  var available = getUnusedDirections(used);
  assert(setsEqual(used, ['N', 'NW', 'E', 'W']), 'used = {N,NW,E,W}');
  assert(setsEqual(available, ['NE', 'SE', 'S', 'SW']), 'available = {NE,SE,S,SW}');

  var c5 = classifyBoard(board, available, blowWind);

  var guaranteedRows34 = c5.guaranteed.filter(function (sq) { return sq.row === 3 || sq.row === 4; });
  assert(guaranteedRows34.length === 10, 'every empty square in rows 3-4 (all 10) is GUARANTEED');

  var inDoubtKeys = c5.inDoubt.map(function (sq) { return cellKey(sq.row, sq.col); });
  assert(setsEqual(inDoubtKeys, ['0-2', '0-3', '0-4', '1-3', '1-4']),
    'IN_DOUBT = exactly {(0,2),(0,3),(0,4),(1,3),(1,4)}');
  assert(c5.inDoubt.every(function (sq) { return sq.direction === 'NE'; }), 'every IN_DOUBT square is reachable via NE only');

  var unreachableKeys = c5.unreachable.map(function (sq) { return cellKey(sq.row, sq.col); });
  assert(setsEqual(unreachableKeys, ['0-0']), '(0,0) is UNREACHABLE (would need N or NW; both used)');

  var expected = {
    NE: { immediateSeeds: 5, realCost: 5, skipValue: 5 },
    SE: { immediateSeeds: 7, realCost: 0, skipValue: 0 },
    S:  { immediateSeeds: 10, realCost: 0, skipValue: 0 },
    SW: { immediateSeeds: 7, realCost: 0, skipValue: 0 }
  };
  Object.keys(expected).forEach(function (dir) {
    var got = c5.perDirection[dir];
    var want = expected[dir];
    assert(
      got.immediateSeeds === want.immediateSeeds && got.realCost === want.realCost && got.skipValue === want.skipValue,
      dir + ': immediateSeeds=' + got.immediateSeeds + ' realCost=' + got.realCost + ' skipValue=' + got.skipValue + ' (expected ' + JSON.stringify(want) + ')'
    );
  });

  var greedyChoice = pickGreedyDirection(board, used);
  assert(greedyChoice === 'NE', 'Greedy blows NE, minimizing immediate count, self-destructively seeding all 5 in-doubt squares (got ' + greedyChoice + ')');

  var smartChoice = chooseSmartDirection(board, available, blowWind);
  assert(smartChoice === 'SE', 'Smart Wind reserves NE (skipValue 5) and blows SE (realCost 0, beats SW on direction-order tie-break) (got ' + smartChoice + ')');
}

test1();
test2();
test3();
test4();
test5();

report('');
report('========================================================');
report(passed + ' passed, ' + failed + ' failed');

var REPLAY_RESULT = { passed: passed, failed: failed, log: LOG_LINES.join('\n') };

if (typeof document !== 'undefined' && document.body) {
  var pre = document.createElement('pre');
  pre.id = 'replay-log';
  pre.style.cssText = 'font-family: ui-monospace, Consolas, monospace; white-space: pre-wrap; padding: 16px;';
  pre.textContent = LOG_LINES.join('\n');
  document.body.appendChild(pre);
  document.title = (failed === 0 ? 'PASS' : 'FAIL') + ' — ' + passed + ' passed, ' + failed + ' failed';
}
