/**
 * Unit tests for assets/js/game-2048-core.js — run with `node scripts/test-2048.js`.
 *
 * No npm dependencies: node:test + node:assert only, same rule scripts/serve.js
 * follows.
 *
 * The core is a browser IIFE that assigns to `window`, so it cannot be
 * imported. We read the file and evaluate it through node:vm with a `window`
 * stub injected as a parameter. Deliberately `runInThisContext` rather than a
 * fresh vm context: values crossing a realm boundary carry that realm's
 * Array/Object prototypes, and assert.deepStrictEqual compares prototype
 * identity, so every grid comparison would fail for the wrong reason. Running
 * in this realm keeps the production file free of any test-only export branch.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import url from 'node:url';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const CORE_PATH = path.join(ROOT, 'assets', 'js', 'game-2048-core.js');

function loadCore() {
  const source = fs.readFileSync(CORE_PATH, 'utf8');
  const factory = vm.runInThisContext(`(function (window) {\n${source}\n})`, {
    filename: CORE_PATH
  });
  const windowStub = {};
  factory(windowStub);
  assert.ok(windowStub.Game2048Core, 'core did not attach itself to window');
  return windowStub.Game2048Core;
}

const Core = loadCore();

// ---------------------------------------------------------------- helpers

/** Deterministic LCG so spawn behaviour is reproducible. */
function seededRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** An rng that fails loudly — used to prove it is never consulted. */
function forbiddenRng() {
  throw new Error('rng must not be called');
}

/**
 * Reproduce a move's collapse without the spawn, so a test can ask what the
 * board looked like at the moment the new tile was placed. Built from the
 * already-verified collapseLine, not from move itself.
 */
function collapseBoard(grid, direction) {
  const next = grid.slice();
  for (let k = 0; k < 4; k++) {
    const idx = Core.lineIndices(direction, k);
    const { line } = Core.collapseLine(idx.map((i) => next[i]));
    idx.forEach((i, n) => {
      next[i] = line[n];
    });
  }
  return next;
}

const sum = (grid) => grid.reduce((a, b) => a + b, 0);
const filled = (grid) => grid.filter((v) => v !== 0).length;

function makeState(grid, rng) {
  return {
    size: 4,
    grid: grid.slice(),
    score: 0,
    won: false,
    over: false,
    rng: rng || forbiddenRng
  };
}

// An asymmetric board: every direction produces a different result, so a
// swapped row/column or a reversed scan order cannot pass by symmetry.
const FIXTURE = [
  2, 2, 4, 0,
  0, 4, 0, 4,
  8, 0, 2, 2,
  0, 0, 0, 2
];

// Fully alternating: no empty cell and no equal neighbours in any direction.
const DEADLOCK = [
  2, 4, 2, 4,
  4, 2, 4, 2,
  2, 4, 2, 4,
  4, 2, 4, 2
];

// ---------------------------------------------------------------- collapseLine

test('collapseLine covers every case in spec §3.2', () => {
  const cases = [
    { in: [2, 2, 4, 0], out: [4, 4, 0, 0], gained: 4, slots: [0] },
    { in: [4, 4, 4, 4], out: [8, 8, 0, 0], gained: 16, slots: [0, 1] },
    { in: [2, 2, 2, 0], out: [4, 2, 0, 0], gained: 4, slots: [0] },
    { in: [2, 0, 2, 0], out: [4, 0, 0, 0], gained: 4, slots: [0] },
    { in: [2, 4, 2, 4], out: [2, 4, 2, 4], gained: 0, slots: [] },
    { in: [0, 0, 0, 2], out: [2, 0, 0, 0], gained: 0, slots: [] }
  ];

  for (const c of cases) {
    const label = `[${c.in}]`;
    const result = Core.collapseLine(c.in);
    assert.deepEqual(result.line, c.out, `${label} line`);
    assert.equal(result.gained, c.gained, `${label} gained`);
    assert.deepEqual(result.mergedSlots, c.slots, `${label} mergedSlots`);
  }
});

test('collapseLine never merges the same tile twice', () => {
  // The classic bug: [2,2,4] collapsing to [8,0,0,0] because the freshly
  // merged 4 is compared against the original 4.
  assert.deepEqual(Core.collapseLine([2, 2, 4]).line, [4, 4, 0, 0]);
  assert.deepEqual(Core.collapseLine([2, 2, 4, 4]).line, [4, 8, 0, 0]);
  assert.deepEqual(Core.collapseLine([4, 4, 8, 0]).line, [8, 8, 0, 0]);
  assert.deepEqual(Core.collapseLine([2, 2, 2, 2]).line, [4, 4, 0, 0]);
});

test('collapseLine merges from the pushed-toward wall first', () => {
  // [2,2,2] must give [4,2,0,0]; scanning from the far end gives [2,4,0,0].
  const result = Core.collapseLine([2, 2, 2, 0]);
  assert.deepEqual(result.line, [4, 2, 0, 0]);
  assert.equal(result.mergedSlots[0], 0);
});

test('collapseLine does not mutate its argument', () => {
  const line = [2, 2, 4, 0];
  Core.collapseLine(line);
  assert.deepEqual(line, [2, 2, 4, 0]);
});

// ---------------------------------------------------------------- move: directions

test('move produces the right board for each of the four directions', () => {
  const expected = {
    left: [
      4, 4, 0, 0,
      8, 0, 0, 0,
      8, 4, 0, 0,
      2, 0, 0, 0
    ],
    right: [
      0, 0, 4, 4,
      0, 0, 0, 8,
      0, 0, 8, 4,
      0, 0, 0, 2
    ],
    up: [
      2, 2, 4, 4,
      8, 4, 2, 4,
      0, 0, 0, 0,
      0, 0, 0, 0
    ],
    down: [
      0, 0, 0, 0,
      0, 0, 0, 0,
      2, 2, 4, 4,
      8, 4, 2, 4
    ]
  };
  const expectedGain = { left: 16, right: 16, up: 4, down: 4 };

  for (const direction of ['left', 'right', 'up', 'down']) {
    // Spawning would add a tile we did not predict, so compare the board
    // before the spawn by neutralising it: fill the fixture result and remove
    // the one reported spawn cell again.
    const result = Core.move(makeState(FIXTURE, seededRng(7)), direction);
    assert.equal(result.moved, true, `${direction} should move`);
    assert.equal(result.gained, expectedGain[direction], `${direction} gained`);

    const board = result.state.grid.slice();
    assert.ok(result.spawn, `${direction} should spawn a tile`);
    board[result.spawn.index] = 0;
    assert.deepEqual(board, expected[direction], `${direction} board`);
  }
});

test('move directions are not interchangeable', () => {
  const boards = ['left', 'right', 'up', 'down'].map((direction) =>
    Core.move(makeState(FIXTURE, seededRng(1)), direction).state.grid.join(',')
  );
  assert.equal(new Set(boards).size, 4, 'each direction must give a distinct board');
});

test('move rejects an unknown direction', () => {
  assert.throws(() => Core.move(makeState(FIXTURE), 'sideways'), /Unknown direction/);
});

// ---------------------------------------------------------------- move: blocked

test('a blocked move reports moved:false and spawns nothing', () => {
  const state = makeState(DEADLOCK, forbiddenRng);
  for (const direction of ['left', 'right', 'up', 'down']) {
    const result = Core.move(state, direction);
    assert.equal(result.moved, false, `${direction} must not move`);
    assert.equal(result.spawn, null, `${direction} must not spawn`);
    assert.equal(result.gained, 0, `${direction} must not score`);
    assert.deepEqual(result.merged, []);
    assert.deepEqual(result.state.grid, DEADLOCK);
  }
});

test('a blocked move on a board with empty cells still spawns nothing', () => {
  // DEADLOCK is full, so spawnTile would decline anyway and could hide a bug.
  // This board is blocked leftward but has twelve free cells, so a stray spawn
  // has somewhere to go — forbiddenRng makes the attempt fatal.
  const grid = [
    2, 4, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 0
  ];
  const before = filled(grid);

  const blocked = Core.move(makeState(grid, forbiddenRng), 'left');
  assert.equal(blocked.moved, false);
  assert.equal(blocked.spawn, null, 'a no-op move must not spawn');
  assert.equal(filled(blocked.state.grid), before);

  const right = Core.move(makeState(grid, seededRng(3)), 'right');
  assert.equal(right.moved, true);
  assert.equal(filled(right.state.grid), before + 1);
});

// ---------------------------------------------------------------- score

test('score accumulates exactly the sum of merged tile values', () => {
  let state = makeState(
    [
      2, 2, 4, 4,
      8, 8, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0
    ],
    seededRng(11)
  );

  const first = Core.move(state, 'left');
  // 2+2=4, 4+4=8, 8+8=16
  assert.equal(first.gained, 28);
  assert.equal(first.state.score, 28);
  assert.equal(
    first.merged.reduce((sum, m) => sum + m.value, 0),
    first.gained,
    'merged[] values must add up to gained'
  );

  let running = first.state.score;
  state = first.state;
  for (const direction of ['up', 'left', 'down', 'right', 'up', 'left']) {
    const result = Core.move(state, direction);
    if (!result.moved) continue;
    assert.equal(
      result.merged.reduce((sum, m) => sum + m.value, 0),
      result.gained,
      `${direction}: merged[] must match gained`
    );
    running += result.gained;
    assert.equal(result.state.score, running, `${direction}: running score`);
    state = result.state;
  }
});

test('merged[] reports the grid position of each new tile', () => {
  const result = Core.move(makeState(FIXTURE, seededRng(5)), 'left');
  for (const m of result.merged) {
    assert.equal(m.index, m.row * 4 + m.col, 'index/row/col must agree');
    assert.equal(result.state.grid[m.index], m.value, 'merged value must be on the board');
  }
  assert.equal(result.merged.length, 3, 'rows 0,1,2 each merge once');
});

// ---------------------------------------------------------------- purity

test('move does not mutate the state it is given', () => {
  const state = makeState(FIXTURE, seededRng(2));
  const gridBefore = state.grid.slice();
  const scoreBefore = state.score;

  const result = Core.move(state, 'left');

  assert.deepEqual(state.grid, gridBefore, 'input grid must be untouched');
  assert.equal(state.score, scoreBefore, 'input score must be untouched');
  assert.notEqual(result.state, state, 'a moving move must return a new state');
  assert.notEqual(result.state.grid, state.grid, 'grid must not be shared');
});

test('a blocked move returns the state object unchanged', () => {
  const state = makeState(DEADLOCK, forbiddenRng);
  const result = Core.move(state, 'left');
  assert.equal(result.state, state);
});

// ---------------------------------------------------------------- hasMoves

test('hasMoves is true whenever an empty cell exists', () => {
  assert.equal(Core.hasMoves(FIXTURE), true);
});

test('hasMoves is true on a full board with an adjacent equal pair', () => {
  const horizontal = [
    2, 4, 2, 4,
    4, 2, 4, 2,
    2, 4, 2, 4,
    4, 2, 4, 4 // last two are equal
  ];
  const vertical = [
    2, 4, 2, 4,
    4, 2, 4, 2,
    2, 4, 2, 4,
    2, 2, 4, 2 // column 0 rows 2,3 are equal
  ];
  assert.equal(horizontal.includes(0), false);
  assert.equal(vertical.includes(0), false);
  assert.equal(Core.hasMoves(horizontal), true, 'horizontal pair');
  assert.equal(Core.hasMoves(vertical), true, 'vertical pair');
});

test('hasMoves is false only on a full, fully alternating board', () => {
  assert.equal(DEADLOCK.includes(0), false);
  assert.equal(Core.hasMoves(DEADLOCK), false);
});

test('state.over stays false while moves remain', () => {
  const result = Core.move(makeState(FIXTURE, seededRng(9)), 'left');
  assert.equal(result.state.over, false);
  assert.equal(result.state.over, !Core.hasMoves(result.state.grid));
});

// ---------------------------------------------------------------- isWon

test('isWon flips exactly when a 2048 tile appears', () => {
  const notYet = [
    1024, 1024, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 0
  ];
  assert.equal(Core.isWon(notYet), false);

  const result = Core.move(makeState(notYet, seededRng(4)), 'left');
  assert.equal(result.state.grid[0], 2048);
  assert.equal(Core.isWon(result.state.grid), true);
  assert.equal(result.state.won, true);
  assert.equal(result.gained, 2048);
});

test('isWon stays true past 2048 so the player can keep going', () => {
  const beyond = [
    4096, 0, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 0
  ];
  assert.equal(Core.isWon(beyond), true);
});

// ---------------------------------------------------------------- spawning

test('createGame starts with two tiles, zero score, and no win/loss', () => {
  const game = Core.createGame(seededRng(42));
  assert.equal(game.grid.length, 16);
  assert.equal(game.score, 0);
  assert.equal(game.won, false);
  assert.equal(game.over, false);
  assert.equal(game.grid.filter((v) => v !== 0).length, 2);
  for (const v of game.grid) {
    assert.ok(v === 0 || v === 2 || v === 4, `unexpected starting tile ${v}`);
  }
});

test('a seeded rng makes createGame reproducible', () => {
  const a = Core.createGame(seededRng(123)).grid;
  const b = Core.createGame(seededRng(123)).grid;
  assert.deepEqual(a, b);
});

test('spawned tiles land only on empty cells and are only 2 or 4', () => {
  const rng = seededRng(2026);
  let state = Core.createGame(rng);
  const directions = ['left', 'up', 'right', 'down'];
  let spawns = 0;
  const values = new Set();

  for (let i = 0; i < 400; i++) {
    const direction = directions[i % directions.length];
    const before = state.grid.slice();
    const result = Core.move(state, direction);
    if (!result.moved) continue;

    // The spawn goes onto the collapsed board, not the pre-move one: a cell can
    // be vacated by the slide and is a legal target in the same move.
    const collapsed = collapseBoard(before, direction);

    assert.ok(result.spawn, 'a move that changed the board must spawn');
    assert.equal(collapsed[result.spawn.index], 0, 'spawn must target an empty cell');
    assert.ok(
      result.spawn.value === 2 || result.spawn.value === 4,
      `spawn value must be 2 or 4, got ${result.spawn.value}`
    );
    assert.equal(result.state.grid[result.spawn.index], result.spawn.value);
    assert.equal(result.spawn.index, result.spawn.row * 4 + result.spawn.col);

    // Merging conserves total pip value, so the whole board's sum can only
    // grow by the spawned tile. Catches a tile invented or lost mid-move.
    assert.equal(sum(result.state.grid), sum(before) + result.spawn.value, 'tile sum');
    assert.equal(
      filled(result.state.grid),
      filled(before) - result.merged.length + 1,
      'exactly one new tile, one cell freed per merge'
    );

    values.add(result.spawn.value);
    spawns++;
    state = result.state;
    if (state.over) state = Core.createGame(rng);
  }

  assert.ok(spawns > 50, `expected plenty of spawns, saw ${spawns}`);
  assert.deepEqual([...values].sort((x, y) => x - y), [2, 4]);
});

test('spawn is 2 about 90% of the time', () => {
  const rng = seededRng(99);
  let twos = 0;
  const trials = 2000;
  for (let i = 0; i < trials; i++) {
    const grid = new Array(16).fill(0);
    grid[0] = 2;
    grid[1] = 2;
    const result = Core.move(makeState(grid, rng), 'left');
    if (result.spawn.value === 2) twos++;
  }
  const ratio = twos / trials;
  assert.ok(ratio > 0.86 && ratio < 0.94, `2s appeared ${(ratio * 100).toFixed(1)}% of the time`);
});

test('the last free cell is taken by the spawn and ends the game', () => {
  const nearlyFull = [
    2, 4, 8, 8,
    16, 32, 64, 128,
    256, 512, 1024, 2,
    4, 2, 8, 16
  ];
  // Only row 0 can move (8+8 -> 16). That frees exactly one cell, the spawn
  // takes it, and the resulting board has no empty cell and no equal
  // neighbours — so `over` must be true.
  const result = Core.move(makeState(nearlyFull, seededRng(8)), 'left');
  assert.equal(result.moved, true);
  assert.equal(result.gained, 16);
  assert.ok(result.spawn);
  assert.equal(result.state.grid.includes(0), false, 'board should now be full');
  assert.equal(result.state.over, true, 'a full board with no pairs is game over');
});

// ---------------------------------------------------------------- API surface

test('the core exposes exactly the contracted API', () => {
  for (const name of ['createGame', 'move', 'collapseLine', 'hasMoves', 'isWon']) {
    assert.equal(typeof Core[name], 'function', `${name} must be a function`);
  }
  assert.equal(Core.SIZE, 4);
  assert.equal(Core.WIN_VALUE, 2048);
});

test('the core touches no browser API beyond window', () => {
  const source = fs.readFileSync(CORE_PATH, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
  for (const forbidden of ['document', 'localStorage', 'sessionStorage', 'setTimeout', 'fetch']) {
    assert.equal(
      source.includes(forbidden),
      false,
      `core must not reference ${forbidden} — it has to run headless in node:vm`
    );
  }
});
