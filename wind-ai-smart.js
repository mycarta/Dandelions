// DANDELIONS — Guaranteed-Square-Aware Wind AI ("Smart Wind")
//
// A square is GUARANTEED once ≥2 available directions can reach it — the
// Wind skips exactly one direction all game, so it cannot save a square two
// separate flowers can each reach a different way. Those squares are already
// lost and cost nothing further; the only real fight is over IN-DOUBT squares
// (reachable via exactly one available direction), which the Wind saves only
// by reserving that one direction as its eventual skip.
//
// Depends only on the real propagation function (`blowWind`) passed in by the
// caller — never reimplements ray-casting — so classification can never
// drift from the actual engine.

const DIRECTION_ORDER = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

// Classify every empty square as GUARANTEED / IN_DOUBT / UNREACHABLE given the
// current board and the directions still available (not yet blown this game).
// `blowWind` must be the engine's real blowWind(board, direction) function.
function classifyBoard(board, availableDirections, blowWind) {
  const empties = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (board[r][c] === 0) empties.push({ row: r, col: c });
    }
  }

  // reachingDirs[key] = every available direction that would seed that square right now.
  const reachingDirs = {};
  for (const cell of empties) reachingDirs[`${cell.row}-${cell.col}`] = [];

  const seededBy = {};   // direction -> cells it would seed if blown now
  for (const dir of availableDirections) {
    const hypothetical = blowWind(board, dir);
    const seeded = [];
    for (const cell of empties) {
      if (hypothetical[cell.row][cell.col] === 2) {
        seeded.push(cell);
        reachingDirs[`${cell.row}-${cell.col}`].push(dir);
      }
    }
    seededBy[dir] = seeded;
  }

  const guaranteed = [];
  const inDoubt = [];
  const unreachable = [];
  for (const cell of empties) {
    const dirs = reachingDirs[`${cell.row}-${cell.col}`];
    if (dirs.length >= 2) {
      guaranteed.push({ row: cell.row, col: cell.col, reachingDirections: dirs });
    } else if (dirs.length === 1) {
      inDoubt.push({ row: cell.row, col: cell.col, direction: dirs[0] });
    } else {
      unreachable.push({ row: cell.row, col: cell.col });
    }
  }

  // Per-direction stats. GUARANTEED squares are already lost, so they carry
  // zero cost — realCost/skipValue only ever count IN_DOUBT squares.
  const perDirection = {};
  for (const dir of availableDirections) {
    const inDoubtForDir = inDoubt.filter(sq => sq.direction === dir).length;
    perDirection[dir] = {
      immediateSeeds: seededBy[dir].length,
      realCost: inDoubtForDir,
      skipValue: inDoubtForDir,
    };
  }

  return { guaranteed, inDoubt, unreachable, perDirection };
}

// Skip-centric choice: reserve the direction that saves the most in-doubt
// squares as the eventual "skip", then blow whichever remaining direction
// costs the fewest in-doubt squares right now. NOT per-blow seed minimization.
function chooseSmartDirection(board, availableDirections, blowWind) {
  if (availableDirections.length === 1) return availableDirections[0];

  const { perDirection } = classifyBoard(board, availableDirections, blowWind);
  const orderIndex = d => DIRECTION_ORDER.indexOf(d);

  // 1. Reserve the skip candidate: highest skipValue wins; ties prefer the
  //    higher realCost if blown; still tied, fall back to fixed direction order.
  let skipCandidate = availableDirections[0];
  for (const dir of availableDirections) {
    const cur = perDirection[dir];
    const best = perDirection[skipCandidate];
    if (
      cur.skipValue > best.skipValue ||
      (cur.skipValue === best.skipValue && cur.realCost > best.realCost) ||
      (cur.skipValue === best.skipValue && cur.realCost === best.realCost && orderIndex(dir) < orderIndex(skipCandidate))
    ) {
      skipCandidate = dir;
    }
  }

  // 2. Among the remaining directions, blow the lowest realCost; ties go to
  //    lower immediate seed count, then fixed direction order.
  const remaining = availableDirections.filter(dir => dir !== skipCandidate);
  let blow = remaining[0];
  for (const dir of remaining) {
    const cur = perDirection[dir];
    const best = perDirection[blow];
    if (
      cur.realCost < best.realCost ||
      (cur.realCost === best.realCost && cur.immediateSeeds < best.immediateSeeds) ||
      (cur.realCost === best.realCost && cur.immediateSeeds === best.immediateSeeds && orderIndex(dir) < orderIndex(blow))
    ) {
      blow = dir;
    }
  }

  return blow;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { classifyBoard, chooseSmartDirection, DIRECTION_ORDER };
}
