// DANDELIONS — Scripted verification games (runtime-agnostic).
//
// Feeds five complete, legal game sequences through the REAL engine functions
// (game.js's own createBoard/placeFlower/blowWind/getUnusedDirections/
// pickGreedyDirection, and wind-ai-smart.js's classifyBoard/chooseSmartDirection)
// and checks the guaranteed-square classifier / smart-Wind choice function
// against hand-verified checkpoints. Nothing here reimplements propagation —
// every "would this seed X" check calls the real blowWind.
//
// The rendered trace narrates each move in plain English (Dandelions plant,
// the Wind blows), shows the board with row/column coordinates, and displays
// a compass rose of blown vs. still-available directions — adopting the
// vocabulary of Ben Orlin's Dandelions chapter (guaranteed / still in doubt)
// rather than the classifier's internal jargon.
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

function diffSeeds(before, after) {
  var seeds = [];
  for (var r = 0; r < 5; r++) {
    for (var c = 0; c < 5; c++) {
      if (before[r][c] === 0 && after[r][c] === 2) seeds.push(cellKey(r, c));
    }
  }
  return seeds;
}

// ── Presentation helpers ─────────────────────────────────────────────────────
// Board with row/column coordinates, a compass rose of blown directions, and
// plain-English narration of each move — Orlin's own words ("guaranteed",
// "still in doubt") in place of the classifier's internal jargon.

var COMPASS_ORDER = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
var compassNoteShown = false;

function snapshot(board) {
  var symbols = { 0: '.', 1: '*', 2: 'o' };
  var lines = ['    ' + [0, 1, 2, 3, 4].join(' ')];
  for (var r = 0; r < 5; r++) {
    lines.push('  ' + r + ' ' + board[r].map(function (cell) { return symbols[cell]; }).join(' '));
  }
  return lines.join('\n');
}

function showCompassRose(used) {
  var line = 'compass rose: ' + COMPASS_ORDER.map(function (d) {
    return used.indexOf(d) !== -1 ? '[' + d + ']' : d;
  }).join(' ');
  report(line);
  if (!compassNoteShown) {
    compassNoteShown = true;
    report('(the Wind blows each direction at most once; one direction is never blown.)');
  }
}

function showState(board, used) {
  report(snapshot(board));
  showCompassRose(used);
}

// Narrate a plant, then show the board it produces.
function plant(board, row, col, used) {
  var onSeed = board[row][col] === 2;
  report('');
  report('Dandelions plant a flower at (' + row + ',' + col + ')' + (onSeed ? ' — on top of a seed' : ''));
  var next = placeFlower(board, row, col);
  if (next === null) throw new Error('Illegal plant at (' + row + ',' + col + ') — cell already has a flower');
  showState(next, used);
  return next;
}

// Narrate a gust, then show the board it produces. Records the direction as blown.
function gust(board, dir, used) {
  var after = blowWind(board, dir);
  var newSeeds = diffSeeds(board, after);
  used.push(dir);
  var n = newSeeds.length;
  var phrase = n === 0 ? 'no new seeds' : (n + ' new seed' + (n === 1 ? '' : 's'));
  report('');
  report('The Wind blows ' + dir + ' -> ' + phrase);
  showState(after, used);
  return { board: after, newSeeds: newSeeds };
}

function checkpoint(label, explanation) {
  report('');
  report('--- CHECKPOINT (' + label + ') ---');
  report(explanation);
}

// ── Test 1 — Orlin's guaranteed square (Math Games with Bad Drawings, p.58) ─
function test1() {
  report('');
  report('========================================================');
  report('TEST 1 — Orlin’s guaranteed square (the book’s worked example)');
  report('========================================================');

  var board = createBoard();
  var used = [];

  board = plant(board, 0, 3, used);

  var g1 = gust(board, 'N', used);
  board = g1.board;
  assert(g1.newSeeds.length === 0,
    'the Wind blows N -> no new seeds — the flower sits on the board’s top edge, so the wind carries those seeds off the board');

  board = plant(board, 2, 1, used);

  checkpoint('Wind turn 2',
    'The square at (2,3) is guaranteed: it lies south of one flower (0,3) and east of another (2,1). ' +
    'The Wind can avoid blowing south, or east — but not both.');

  var available = getUnusedDirections(used);
  assert(setsEqual(available, ['NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']), 'not yet blown: ' + available.join(', '));

  var c1 = classifyBoard(board, available, blowWind);
  var sq23 = c1.guaranteed.filter(function (g) { return g.row === 2 && g.col === 3; })[0];
  assert(!!sq23, '(2,3) is guaranteed');
  assert(!!sq23 && setsEqual(sq23.reachingDirections, ['S', 'E']),
    '(2,3) is guaranteed by exactly two directions: S (from the flower at (0,3)) and E (from the flower at (2,1))');
}

// ── Test 2 — A square still in doubt ────────────────────────────────────────
function test2() {
  report('');
  report('========================================================');
  report('TEST 2 — A square still in doubt (our generalization, not from the book)');
  report('========================================================');

  var board = createBoard();
  var used = [];

  board = plant(board, 2, 2, used);

  checkpoint('Wind turn 1',
    'With a single flower, nothing is guaranteed yet: every one of the 16 squares on its row, column, and ' +
    'diagonals is still in doubt — each reachable by exactly one direction, so the Wind can save any one of ' +
    'them by never blowing that direction. The other 8 squares are out of the wind’s reach entirely. (2,4), ' +
    'reachable only via E, is the example the checks below verify. It takes a second flower to create the ' +
    'first guaranteed square — which is what Test 1 showed.');

  var available = getUnusedDirections(used);
  assert(setsEqual(available, ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']), 'not yet blown: ' + available.join(', '));

  var c2 = classifyBoard(board, available, blowWind);
  var sq24 = c2.inDoubt.filter(function (s) { return s.row === 2 && s.col === 4; })[0];
  assert(!!sq24 && sq24.direction === 'E', '(2,4) is still in doubt — only E can still seed it');
  assert(c2.guaranteed.length === 0, 'no squares are guaranteed yet (impossible with a single flower)');
  assert(c2.inDoubt.length === 16, 'exactly 16 squares are still in doubt — every square on the flower’s row, column, and both diagonals');
  assert(c2.unreachable.length === 8, 'exactly 8 squares are out of the wind’s reach — every other empty square on the board');
}

// ── Test 3 — Same direction, different flowers: between vs. beyond ─────────
function test3() {
  report('');
  report('========================================================');
  report('TEST 3 — Same direction, different flowers: between vs. beyond (our generalization)');
  report('========================================================');

  var board = createBoard();
  var used = [];

  board = plant(board, 0, 2, used);

  var g1 = gust(board, 'NE', used);
  board = g1.board;
  assert(g1.newSeeds.length === 0,
    'the Wind blows NE -> no new seeds — the flower sits on the board’s top edge, so the wind carries those seeds off the board');

  board = plant(board, 2, 2, used);

  checkpoint('Wind turn 2',
    'On this column, (1,2) sits between the two flowers and is guaranteed: south of (0,2) and north of (2,2) — ' +
    'the Wind can avoid blowing south, or north, but not both. (3,2) and (4,2) sit beyond both flowers; each is ' +
    'still in doubt, because both flowers can only reach them by blowing south — needing the same direction twice ' +
    'is not a guarantee.');

  var available = getUnusedDirections(used);
  assert(setsEqual(available, ['N', 'E', 'SE', 'S', 'SW', 'W', 'NW']), 'not yet blown: ' + available.join(', '));

  var c3 = classifyBoard(board, available, blowWind);
  var byKey = {};
  c3.guaranteed.forEach(function (s) { byKey[cellKey(s.row, s.col)] = { status: 'GUARANTEED', s: s }; });
  c3.inDoubt.forEach(function (s) { byKey[cellKey(s.row, s.col)] = { status: 'IN_DOUBT', s: s }; });

  var s42 = byKey[cellKey(4, 2)];
  assert(!!s42 && s42.status === 'IN_DOUBT' && s42.s.direction === 'S',
    '(4,2) is still in doubt — both flowers can reach it, but only by blowing S; two flowers needing the same direction is not a guarantee');

  var s12 = byKey[cellKey(1, 2)];
  assert(!!s12 && s12.status === 'GUARANTEED' && setsEqual(s12.s.reachingDirections, ['S', 'N']),
    '(1,2), between the flowers, is guaranteed: south of (0,2) and north of (2,2)');

  var s32 = byKey[cellKey(3, 2)];
  assert(!!s32 && s32.status === 'IN_DOUBT' && s32.s.direction === 'S',
    '(3,2), beyond both flowers, is still in doubt — only S can reach it');
}

// ── Test 4 — Seeds pass over occupied squares without stopping ─────────────
function test4() {
  report('');
  report('========================================================');
  report('TEST 4 — Seeds pass over occupied squares without stopping (our generalization)');
  report('========================================================');

  var board = createBoard();
  var used = [];

  board = plant(board, 0, 2, used);

  var g = gust(board, 'S', used);
  board = g.board;
  assert(setsEqual(g.newSeeds, ['1-2', '2-2', '3-2', '4-2']),
    'the Wind blows S -> new seeds land at exactly (1,2), (2,2), (3,2), (4,2)');

  board = plant(board, 2, 0, used);

  g = gust(board, 'E', used);
  board = g.board;
  assert(setsEqual(g.newSeeds, ['0-3', '0-4', '2-1', '2-3', '2-4']),
    'the Wind blows E -> new seeds land at exactly (0,3), (0,4), (2,1), (2,3), (2,4)');

  checkpoint('after step 4',
    'The seed at (2,2) does not block the wind — it just sits there while seeds keep moving. From the flower at ' +
    '(2,0), the squares (2,3) and (2,4), further downwind, still catch new seeds even though (2,2) is in the way.');
}

// ── Test 5 — Greedy Wind self-destructs; Smart Wind reserves the skip ─────
function test5() {
  report('');
  report('========================================================');
  report('TEST 5 — Greedy Wind self-destructs; Smart Wind reserves the skip (showcase, our generalization)');
  report('========================================================');

  var board = createBoard();
  var used = [];

  board = plant(board, 2, 1, used);
  var g = gust(board, 'N', used);
  board = g.board;

  board = plant(board, 2, 3, used);
  g = gust(board, 'NW', used);
  board = g.board;

  board = plant(board, 2, 0, used);
  g = gust(board, 'E', used);
  board = g.board;
  assert(setsEqual(g.newSeeds, ['2-2', '2-4']), 'the Wind blows E -> new seeds land at (2,2) and (2,4)');

  board = plant(board, 2, 2, used);   // on top of a seed — legal
  g = gust(board, 'W', used);
  board = g.board;
  assert(g.newSeeds.length === 0,
    'the Wind blows W -> no new seeds — row 2 is fully occupied to the west, so there is nothing left to seed');

  board = plant(board, 2, 4, used);   // on top of a seed — legal

  checkpoint('Wind turn 5',
    'Every empty square in the bottom two rows is guaranteed: each sits south of at least two of the five ' +
    'flowers now filling row 2. The five squares in the top-right corner are still in doubt — NE is the only ' +
    'direction left that can reach any of them. And (0,0) is out of the wind’s reach for now — safe unless a ' +
    'new flower changes that.');

  var available = getUnusedDirections(used);
  assert(setsEqual(used, ['N', 'NW', 'E', 'W']), 'the Wind has blown ' + used.join(', ') + ' so far');
  assert(setsEqual(available, ['NE', 'SE', 'S', 'SW']), 'not yet blown: ' + available.join(', '));

  var c5 = classifyBoard(board, available, blowWind);

  var guaranteedRows34 = c5.guaranteed.filter(function (sq) { return sq.row === 3 || sq.row === 4; });
  assert(guaranteedRows34.length === 10, 'every empty square in rows 3-4 (all 10 of them) is guaranteed');

  var inDoubtKeys = c5.inDoubt.map(function (sq) { return cellKey(sq.row, sq.col); });
  assert(setsEqual(inDoubtKeys, ['0-2', '0-3', '0-4', '1-3', '1-4']),
    'still in doubt: exactly (0,2), (0,3), (0,4), (1,3), (1,4)');
  assert(c5.inDoubt.every(function (sq) { return sq.direction === 'NE'; }),
    'every square still in doubt can only be reached via NE');

  var unreachableKeys = c5.unreachable.map(function (sq) { return cellKey(sq.row, sq.col); });
  assert(setsEqual(unreachableKeys, ['0-0']),
    '(0,0) is out of the wind’s reach (safe unless a new flower changes that) — it would need N or NW, and both are already blown');

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
      dir + ': ' + got.immediateSeeds + ' new seeds this gust, ' +
      got.realCost + ' squares still in doubt that this gust would seed, ' +
      got.skipValue + ' squares saved if the Wind never blows this direction ' +
      '(expected ' + want.immediateSeeds + ', ' + want.realCost + ', ' + want.skipValue + ')'
    );
  });

  var greedyChoice = pickGreedyDirection(board, used);
  assert(greedyChoice === 'NE',
    'Greedy Wind blows NE — it only minimizes new seeds this gust, so it seeds all 5 squares still in doubt and ' +
    'hands them straight to the Dandelions (got ' + greedyChoice + ')');

  var smartChoice = chooseSmartDirection(board, available, blowWind);
  assert(smartChoice === 'SE',
    'Smart Wind reserves NE (that would save 5 squares still in doubt) and blows SE instead (0 of those squares ' +
    'at risk; SE wins the tie-break over SW) (got ' + smartChoice + ')');
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
