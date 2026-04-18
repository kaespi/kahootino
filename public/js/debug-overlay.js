/**
 * On-screen debug overlay for mobile devices.
 *
 * Activate by adding ?debug=1 to the page URL.
 * Captures console.log, console.warn, and console.error and displays
 * them in a small floating panel at the bottom of the viewport.
 */
(function () {
  const params = new URLSearchParams(window.location.search);
  if (params.get('debug') !== '1') return;

  // --- build DOM elements ---
  const overlay = document.createElement('div');
  overlay.id = 'debug-overlay';

  const header = document.createElement('div');
  header.id = 'debug-overlay-header';

  const title = document.createElement('span');
  title.textContent = 'Debug Log';

  const controls = document.createElement('span');

  const clearBtn = document.createElement('button');
  clearBtn.textContent = '✕ Clear';
  clearBtn.addEventListener('click', () => { logContainer.innerHTML = ''; });

  const toggleBtn = document.createElement('button');
  toggleBtn.textContent = '▼';
  toggleBtn.addEventListener('click', () => {
    const collapsed = logContainer.classList.toggle('debug-collapsed');
    toggleBtn.textContent = collapsed ? '▲' : '▼';
  });

  controls.appendChild(clearBtn);
  controls.appendChild(toggleBtn);
  header.appendChild(title);
  header.appendChild(controls);

  const logContainer = document.createElement('div');
  logContainer.id = 'debug-overlay-log';

  overlay.appendChild(header);
  overlay.appendChild(logContainer);

  // insert as soon as the body is available
  if (document.body) {
    document.body.appendChild(overlay);
  } else {
    document.addEventListener('DOMContentLoaded', () => document.body.appendChild(overlay));
  }

  // --- helpers ---
  function timestamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  function formatArg(arg) {
    if (arg === undefined) return 'undefined';
    if (arg === null) return 'null';
    if (typeof arg === 'object') {
      try { return JSON.stringify(arg); } catch (_) { return String(arg); }
    }
    return String(arg);
  }

  function addEntry(level, args) {
    const line = document.createElement('div');
    line.className = 'debug-entry debug-' + level;
    line.textContent = '[' + timestamp() + '] ' + Array.from(args).map(formatArg).join(' ');
    logContainer.appendChild(line);
    // keep scrolled to bottom
    logContainer.scrollTop = logContainer.scrollHeight;
    // cap entries to avoid memory issues
    while (logContainer.childElementCount > 200) {
      logContainer.removeChild(logContainer.firstChild);
    }
  }

  // --- intercept console methods ---
  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;

  console.log = function () { origLog.apply(console, arguments); addEntry('log', arguments); };
  console.warn = function () { origWarn.apply(console, arguments); addEntry('warn', arguments); };
  console.error = function () { origError.apply(console, arguments); addEntry('error', arguments); };

  // also capture uncaught errors
  window.addEventListener('error', (e) => {
    addEntry('error', [e.message, '@ ' + (e.filename || '') + ':' + (e.lineno || '')]);
  });

  window.addEventListener('unhandledrejection', (e) => {
    addEntry('error', ['Unhandled rejection:', e.reason]);
  });
})();
