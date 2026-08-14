/**
 * Dark mode toggle.
 *
 * The theme itself is already applied by the inline script in <head> — this file
 * only wires up the button, so it is safe to load with `defer`.
 */

(function () {
  var root = document.documentElement;
  var button = document.getElementById('theme-toggle');
  if (!button) return;

  function currentTheme() {
    return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  // The button's icon is driven by CSS off [data-theme], so it is already
  // correct on first paint and nothing here needs to touch it.
  function render(theme) {
    root.setAttribute('data-theme', theme);
    button.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
  }

  render(currentTheme());

  button.addEventListener('click', function () {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    render(next);
    try {
      localStorage.setItem('theme', next);
    } catch (e) {
      // Private browsing or blocked storage: the toggle still works for this
      // page view, it just won't be remembered.
    }
  });

  // Keep following the OS setting until the reader makes an explicit choice.
  var query = window.matchMedia('(prefers-color-scheme: dark)');
  var onSystemChange = function (event) {
    var stored = null;
    try {
      stored = localStorage.getItem('theme');
    } catch (e) {
      /* ignore */
    }
    if (!stored) render(event.matches ? 'dark' : 'light');
  };

  if (query.addEventListener) {
    query.addEventListener('change', onSystemChange);
  } else if (query.addListener) {
    query.addListener(onSystemChange);
  }
})();
