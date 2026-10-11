# Tests

Browser tests for the bookshelf, run in a real (headless) Google Chrome.

```
python tests/run.py            # all suites
python tests/run.py phone      # just one: core / phone / features / critter / debug
```

Needs **Node.js 20+** and **Google Chrome** (set `CHROME_PATH` if Chrome isn't in the usual place). Each run uses a brand-new Chrome profile, so your own books and settings are never touched.

- `run.py` copies `index.html` into `tests/.out/` with a suite's script added, opens it, and prints a PASS/FAIL line per check (exits non-zero if anything fails).
- Pages are served from a small local web server that `run.py` starts, not opened as files. Chrome hides the details of errors from other files on `file://`, so a crash in `js/*.js` would go unreported. The server leaves out `starter-library.json`, so every suite starts from the 3 built-in books.
- Every suite ends with **no uncaught errors on the page**: any uncaught error or rejected promise fails it, including errors during startup and inside timers that no check looks at directly.
- `chrome-driver.js` drives Chrome over its DevTools protocol, on the real clock. Headless Chrome's virtual-time mode stalls on IndexedDB writes and never-ending CSS animations.
- `suites/*.js` are the checks. Each one runs inside the page after it loads, with `ok(name, condition, detail)`, `wait(ms)` and `q(selector)` available. A first line like `// @size 390x844` emulates that screen size (used for the phone suite).
