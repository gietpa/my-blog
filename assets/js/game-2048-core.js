/**
 * 2048 — pure game logic.
 *
 * This file knows nothing about the DOM, `window` (beyond attaching itself),
 * `localStorage`, or timers. Everything here is a plain function over plain
 * data, which is what lets `scripts/test-2048.js` run it under `node:vm`.
 *
 * The grid is a flat array of SIZE * SIZE numbers, `index = row * SIZE + col`.
 * A 0 means "empty". Flat beats nested here because the four directions are
 * then just four different orders of reading the same array (see lineIndices),
 * with no grid rotation to undo when reporting merge positions back to the UI.
 */

(function () {
  var SIZE = 4;
  var WIN_VALUE = 2048;
  var DIRECTIONS = ['left', 'right', 'up', 'down'];

  /**
   * Indices of line `k` (row for left/right, column for up/down), ordered so
   * that element 0 is the cell CLOSEST TO THE WALL we are pushing toward.
   *
   * That order is load-bearing: collapseLine scans front to back, so scanning
   * from the far wall would turn [2,2,2] pushed left into [2,4,0,0] instead of
   * the correct [4,2,0,0].
   */
  function lineIndices(direction, k) {
    var idx = [];
    var i;
    for (i = 0; i < SIZE; i++) {
      switch (direction) {
        case 'left':
          idx.push(k * SIZE + i);
          break;
        case 'right':
          idx.push(k * SIZE + (SIZE - 1 - i));
          break;
        case 'up':
          idx.push(i * SIZE + k);
          break;
        case 'down':
          idx.push((SIZE - 1 - i) * SIZE + k);
          break;
        default:
          throw new Error('Unknown direction: ' + direction);
      }
    }
    return idx;
  }

  /**
   * Push one line toward index 0, merging equal neighbours.
   *
   * `line[0]` must be the cell nearest the wall being pushed toward.
   * Returns { line, gained, mergedSlots } where mergedSlots are indices into
   * the returned line at which a merge produced a new tile.
   *
   * Double merges are prevented by the `i += 2` below and nothing else: a tile
   * that just merged is skipped over entirely, so it cannot merge again in the
   * same move. [2,2,4,0] -> [4,4,0,0], never [8,0,0,0].
   */
  function collapseLine(line) {
    var values = [];
    var out = [];
    var mergedSlots = [];
    var gained = 0;
    var i;

    for (i = 0; i < line.length; i++) {
      if (line[i]) values.push(line[i]);
    }

    i = 0;
    while (i < values.length) {
      if (i + 1 < values.length && values[i] === values[i + 1]) {
        var merged = values[i] * 2;
        out.push(merged);
        gained += merged;
        mergedSlots.push(out.length - 1);
        i += 2; // skip the consumed partner — it must not merge again
      } else {
        out.push(values[i]);
        i += 1;
      }
    }

    var target = Math.max(SIZE, line.length);
    while (out.length < target) out.push(0);

    return { line: out, gained: gained, mergedSlots: mergedSlots };
  }

  function emptyIndices(grid) {
    var empty = [];
    for (var i = 0; i < grid.length; i++) {
      if (!grid[i]) empty.push(i);
    }
    return empty;
  }

  /**
   * Place one new tile on a randomly chosen empty cell: 2 with 90% probability,
   * 4 with 10%. Mutates `grid` (always a fresh copy by the time we get here) and
   * returns a descriptor, or null when the grid is full.
   */
  function spawnTile(grid, rng) {
    var empty = emptyIndices(grid);
    if (empty.length === 0) return null;

    // The min() guards an rng that can return exactly 1, which would otherwise
    // index one past the end and place the tile nowhere.
    var pick = Math.min(empty.length - 1, Math.floor(rng() * empty.length));
    var index = empty[pick];
    var value = rng() < 0.9 ? 2 : 4;
    grid[index] = value;

    return {
      index: index,
      row: Math.floor(index / SIZE),
      col: index % SIZE,
      value: value
    };
  }

  /**
   * A move is available when there is an empty cell, or when some pair of
   * orthogonally adjacent cells holds the same value. Checking emptiness alone
   * would call a full-but-mergeable board a loss.
   */
  function hasMoves(grid) {
    for (var i = 0; i < grid.length; i++) {
      if (!grid[i]) return true;
    }
    for (var row = 0; row < SIZE; row++) {
      for (var col = 0; col < SIZE; col++) {
        var value = grid[row * SIZE + col];
        if (col + 1 < SIZE && grid[row * SIZE + col + 1] === value) return true;
        if (row + 1 < SIZE && grid[(row + 1) * SIZE + col] === value) return true;
      }
    }
    return false;
  }

  function isWon(grid) {
    for (var i = 0; i < grid.length; i++) {
      if (grid[i] >= WIN_VALUE) return true;
    }
    return false;
  }

  function createGame(rng) {
    var random = typeof rng === 'function' ? rng : Math.random;
    var grid = [];
    for (var i = 0; i < SIZE * SIZE; i++) grid.push(0);

    spawnTile(grid, random);
    spawnTile(grid, random);

    return {
      size: SIZE,
      grid: grid,
      score: 0,
      won: isWon(grid),
      over: !hasMoves(grid),
      rng: random
    };
  }

  /**
   * Apply one move. Pure: `state` is never mutated, a new state is returned.
   *
   * Returns { moved, state, gained, merged, spawn }.
   *   moved  — did any cell change? If false, `state` is returned unchanged:
   *            no score, no new tile. Spawning against a wall would let the
   *            player lose without ever giving anything up.
   *   merged — [{ index, row, col, value }] for tiles produced by a merge.
   *   spawn  — { index, row, col, value } for the new tile, or null.
   */
  function move(state, direction, rng) {
    if (DIRECTIONS.indexOf(direction) === -1) {
      throw new Error('Unknown direction: ' + direction);
    }

    var random = typeof rng === 'function' ? rng : state.rng || Math.random;
    var next = state.grid.slice();
    var merged = [];
    var moved = false;
    var gained = 0;
    var k, n, idx, line, result, index;

    for (k = 0; k < SIZE; k++) {
      idx = lineIndices(direction, k);
      line = [];
      for (n = 0; n < idx.length; n++) line.push(next[idx[n]]);

      result = collapseLine(line);
      gained += result.gained;

      for (n = 0; n < idx.length; n++) {
        if (next[idx[n]] !== result.line[n]) moved = true;
        next[idx[n]] = result.line[n];
      }

      for (n = 0; n < result.mergedSlots.length; n++) {
        index = idx[result.mergedSlots[n]];
        merged.push({
          index: index,
          row: Math.floor(index / SIZE),
          col: index % SIZE,
          value: next[index]
        });
      }
    }

    if (!moved) {
      return { moved: false, state: state, gained: 0, merged: [], spawn: null };
    }

    var spawn = spawnTile(next, random);

    return {
      moved: true,
      gained: gained,
      merged: merged,
      spawn: spawn,
      state: {
        size: SIZE,
        grid: next,
        score: state.score + gained,
        won: state.won || isWon(next),
        over: !hasMoves(next),
        rng: random
      }
    };
  }

  var api = {
    SIZE: SIZE,
    WIN_VALUE: WIN_VALUE,
    createGame: createGame,
    move: move,
    collapseLine: collapseLine,
    lineIndices: lineIndices,
    hasMoves: hasMoves,
    isWon: isWon
  };

  window.Game2048Core = api;
})();
