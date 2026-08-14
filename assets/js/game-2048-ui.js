/**
 * 2048 — DOM rendering and input.
 *
 * All game rules live in game-2048-core.js; this file only calls it and paints
 * the result. The core is pure, so every question about "is the game over" or
 * "did that move do anything" is answered by the state it hands back — nothing
 * here re-derives it.
 *
 * The tile layer is rebuilt from scratch on every move (16 nodes, no identity
 * tracking). That is why there is no slide animation: tiles have no continuity
 * to animate along. See spec §6.
 */

(function () {
  var core = window.Game2048Core;
  if (!core) return;

  var board = document.getElementById('board');
  var scoreValue = document.getElementById('score-value');
  var bestValue = document.getElementById('best-value');
  var newGameButton = document.getElementById('new-game');
  var overlay = document.getElementById('game-over');
  var status = document.getElementById('game-status');
  if (!board || !overlay) return;

  var cells = board.querySelectorAll('.board__cell');
  if (cells.length !== core.SIZE * core.SIZE) return;

  var BEST_KEY = 'my-blog:2048:best';
  var SWIPE_THRESHOLD = 30;
  var KEYS = {
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ArrowUp: 'up',
    ArrowDown: 'down'
  };

  var state = null;
  var best = 0;
  // Set when the player dismisses the win overlay, so reaching 4096 does not
  // interrupt them a second time.
  var dismissedWin = false;

  /* --- Best score ------------------------------------------------------- */

  // Same defensive shape as theme-toggle.js: private browsing throws on both
  // read and write, and the game must survive that by simply forgetting.
  function loadBest() {
    var raw = null;
    try {
      raw = localStorage.getItem(BEST_KEY);
    } catch (e) {
      return 0;
    }
    var value = Number(raw);
    // The value is user-editable, so anything that is not a finite,
    // non-negative integer is treated as absent rather than trusted.
    if (!isFinite(value) || value < 0 || Math.floor(value) !== value) return 0;
    return value;
  }

  function saveBest(value) {
    try {
      localStorage.setItem(BEST_KEY, String(value));
    } catch (e) {
      /* storage unavailable — the score just won't outlive this page view */
    }
  }

  /* --- Overlay ---------------------------------------------------------- */

  var overlayMessage = document.createElement('p');
  overlayMessage.className = 'game__overlay-message';

  var overlayActions = document.createElement('div');
  overlayActions.className = 'game__overlay-actions';

  var keepGoingButton = document.createElement('button');
  keepGoingButton.type = 'button';
  keepGoingButton.textContent = 'Keep going';

  var overlayNewGame = document.createElement('button');
  overlayNewGame.type = 'button';
  overlayNewGame.textContent = 'New Game';

  overlayActions.appendChild(keepGoingButton);
  overlayActions.appendChild(overlayNewGame);
  overlay.appendChild(overlayMessage);
  overlay.appendChild(overlayActions);

  function hideOverlay() {
    overlay.hidden = true;
  }

  /**
   * Show the end-of-game panel and move focus into it.
   *
   * The focus move is not decoration: once the game is over the arrow keys do
   * nothing, so a keyboard player left focused on the board has no way out.
   */
  function showOverlay(message, canContinue) {
    overlayMessage.textContent = message;
    keepGoingButton.hidden = !canContinue;
    overlay.hidden = false;
    (canContinue ? keepGoingButton : overlayNewGame).focus();
  }

  /* --- Rendering -------------------------------------------------------- */

  function announce(text) {
    if (status) status.textContent = text;
  }

  function scoreSentence() {
    return 'Score ' + state.score + ', best ' + best + '.';
  }

  /**
   * Repaint every cell. `highlights` maps a grid index to the animation class
   * that cell earned this move ('tile--new' or 'tile--merged').
   */
  function render(highlights) {
    var i;
    for (i = 0; i < cells.length; i++) {
      var cell = cells[i];
      var value = state.grid[i];
      var existing = cell.firstChild;
      if (existing) cell.removeChild(existing);

      if (!value) {
        cell.setAttribute('aria-label', 'empty');
        continue;
      }

      var tile = document.createElement('div');
      tile.className = 'tile tile--' + (value > 2048 ? 'super' : value);
      if (String(value).length > 3) tile.className += ' tile--len4';
      if (highlights && highlights[i]) tile.className += ' ' + highlights[i];
      tile.textContent = String(value);
      // The cell's aria-label already carries the number; without this the
      // screen reader reads every tile twice.
      tile.setAttribute('aria-hidden', 'true');
      cell.appendChild(tile);
      cell.setAttribute('aria-label', String(value));
    }

    if (scoreValue) scoreValue.textContent = String(state.score);
    if (bestValue) bestValue.textContent = String(best);
  }

  /* --- Game flow -------------------------------------------------------- */

  function startGame() {
    state = core.createGame();
    dismissedWin = false;
    hideOverlay();
    render(null);
    announce('New game started.');
    board.focus();
  }

  function attemptMove(direction) {
    if (!state || state.over) return;

    var result = core.move(state, direction);
    // A move into a wall changes nothing: no score, no spawn, and — per spec
    // §7 — no announcement either. Silence is the information.
    if (!result.moved) return;

    state = result.state;

    var highlights = {};
    var i;
    for (i = 0; i < result.merged.length; i++) {
      highlights[result.merged[i].index] = 'tile--merged';
    }
    // Applied after the merges so a tile spawning is never mistaken for one.
    if (result.spawn) highlights[result.spawn.index] = 'tile--new';

    if (state.score > best) {
      best = state.score;
      saveBest(best);
    }

    render(highlights);

    // One live region, one announcement per move — win and loss included.
    // A second live region (or aria-live on the score) reads it all twice.
    if (state.over) {
      announce('Game over. ' + scoreSentence());
      showOverlay('Game over', false);
    } else if (state.won && !dismissedWin) {
      announce('You win! ' + scoreSentence());
      showOverlay('You win!', true);
    } else {
      announce(scoreSentence());
    }
  }

  /* --- Input ------------------------------------------------------------ */

  // Listener on the board, not the document: with focus elsewhere the arrow
  // keys must still scroll the help text below the game.
  board.addEventListener('keydown', function (event) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    var direction = KEYS[event.key];
    if (!direction) return;
    event.preventDefault();
    attemptMove(direction);
  });

  var touchStartX = 0;
  var touchStartY = 0;
  var touchTracked = false;

  board.addEventListener('touchstart', function (event) {
    if (event.touches.length !== 1) {
      touchTracked = false;
      return;
    }
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
    touchTracked = true;
  });

  board.addEventListener('touchend', function (event) {
    if (!touchTracked) return;
    touchTracked = false;

    var touch = event.changedTouches[0];
    if (!touch) return;

    var dx = touch.clientX - touchStartX;
    var dy = touch.clientY - touchStartY;
    // One dominant axis only, and anything shorter than the threshold is a tap
    // — otherwise tapping the board to focus it would register as a move.
    if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return;

    if (Math.abs(dx) > Math.abs(dy)) {
      attemptMove(dx > 0 ? 'right' : 'left');
    } else {
      attemptMove(dy > 0 ? 'down' : 'up');
    }
  });

  if (newGameButton) newGameButton.addEventListener('click', startGame);
  overlayNewGame.addEventListener('click', startGame);

  keepGoingButton.addEventListener('click', function () {
    dismissedWin = true;
    hideOverlay();
    board.focus();
  });

  best = loadBest();
  startGame();
})();
