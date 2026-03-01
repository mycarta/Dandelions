// DANDELIONS — Core Game Engine
// 5×5 grid game. Board is a 2D array: 0=empty, 1=flower, 2=seed.
// Rows 0-4 top to bottom, columns 0-4 left to right.

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
