// DANDELIONS — Node entry point for the replay driver.
//
// Loads game.js (the real engine) and wind-ai-smart.js (the classifier +
// smart-Wind choice function) verbatim into one shared vm context, then runs
// tools/replay-tests.js in that same context — exactly like three plain
// <script> tags sharing one page (see tools/replay.html for the browser
// equivalent). Nothing here reimplements engine logic.
//
// Run with: node tools/replay.js

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const sandbox = {
  document: { addEventListener() {} },   // game.js touches this once, at load, to register a
                                          // DOMContentLoaded handler that never fires headlessly.
  console,
};
vm.createContext(sandbox);

function runFile(relPath) {
  const src = fs.readFileSync(path.join(root, relPath), 'utf8');
  vm.runInContext(src, sandbox, { filename: relPath });
}

runFile('game.js');
runFile('wind-ai-smart.js');
runFile('tools/replay-tests.js');

process.exit(sandbox.REPLAY_RESULT.failed > 0 ? 1 : 0);
