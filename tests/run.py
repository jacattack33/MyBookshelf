"""Run the bookshelf's browser tests in headless Chrome.

    python tests/run.py            # every suite
    python tests/run.py core       # just one (core / phone / features)

Each file in tests/suites/ is a chunk of JavaScript that runs inside the real
page after it loads, using these helpers:
    ok(name, condition, detail)   record a PASS / FAIL line
    wait(ms)                      pause (real time)
    q(selector)                   document.querySelector

A suite's first line can set the screen size, e.g.  // @size 390x844
(phone suites are emulated at that size), and/or  @dvds  to open the page
as the DVD shelf (Settings > Shelf of > DVDs).

Pages are served from a little local web server rather than opened as
files: Chrome treats every file as its own origin, and hides script errors
from other origins (so a crash in js/*.js wouldn't be reported). The server
leaves out starter-library.json, so every suite starts from the 3 built-in
books, like a page opened from a file. Any uncaught error on the page fails
the suite.

Every run uses a brand-new Chrome profile, so tests never touch your own
books. Needs Node.js (20+) and Google Chrome (or set CHROME_PATH).
"""
import functools
import http.server
import re
import shutil
import subprocess
import sys
import tempfile
import threading
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
OUT = HERE / '.out'

# goes first in <head>, so it hears errors from the page's own startup too
HARNESS_HEAD = r"""
<script>
window.__pageErrors = [];
addEventListener('error', e => __pageErrors.push(e.message + (e.filename ? ' @ ' + e.filename.split('/').pop() + ':' + e.lineno : '')));
addEventListener('unhandledrejection', e => __pageErrors.push('unhandled: ' + (e.reason && e.reason.stack || e.reason)));
</script>"""
# (@dvds) before the page's own scripts, so it opens as the DVD shelf
DVDS_HEAD = r"""
<script>localStorage.setItem('bookShelfCollection', 'dvds');</script>"""
HARNESS_START = r"""
<style>.shelf-cat svg, .cat-z, h1 { animation: none !important; }</style>
<script>
window.alert = () => {}; window.confirm = () => true;
(async () => {
  await new Promise(r => setTimeout(r, 2500)); // let the page load its books
  const out = [];
  const ok = (name, cond, detail = '') => out.push((cond ? 'PASS ' : 'FAIL ') + name + (detail !== '' ? ' :: ' + detail : ''));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const q = sel => document.querySelector(sel);
  try {
"""
HARNESS_END = r"""
  } catch (e) { out.push('FAIL crashed :: ' + e.stack); }
  ok('no uncaught errors on the page', !__pageErrors.length, __pageErrors.join(' | '));
  const r = document.createElement('pre'); r.id = 'r'; r.textContent = out.join('\n'); document.body.appendChild(r);
})();
</script></body>"""


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.split('?')[0].endswith('/starter-library.json'):
            return self.send_error(404)
        super().do_GET()

    def log_message(self, *args):
        pass


def start_server():
    """Serve the app folder on a free local port; returns its base URL."""
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return f'http://127.0.0.1:{server.server_port}'


def build_page(suite_js, base, dvds=False):
    page = (ROOT / 'index.html').read_text(encoding='utf-8')
    # the test page lives in tests/.out, so resolve css/, js/ and assets/ from the app folder
    head = HARNESS_HEAD + (DVDS_HEAD if dvds else '')
    page = page.replace('<head>', f'<head>\n<base href="{base}/">' + head, 1)
    return page.replace('</body>', HARNESS_START + suite_js + HARNESS_END, 1)


def run_suite(path, base):
    js = path.read_text(encoding='utf-8')
    first = js.splitlines()[0] if js else ''
    m = re.search(r'@size\s+(\d+)x(\d+)', first)
    w, h = (m.group(1), m.group(2)) if m else ('1100', '850')
    OUT.mkdir(exist_ok=True)
    page = OUT / f'{path.stem}.html'
    page.write_text(build_page(js, base, '@dvds' in first), encoding='utf-8')
    profile = tempfile.mkdtemp(prefix='bookshelf-test-')
    try:
        res = subprocess.run(
            ['node', '--experimental-websocket', str(HERE / 'chrome-driver.js'), f'{base}/tests/.out/{page.name}', profile, '', w, h],
            capture_output=True, text=True, timeout=180)
    finally:
        shutil.rmtree(profile, ignore_errors=True)
    lines = [l for l in res.stdout.splitlines() if l.startswith(('PASS', 'FAIL'))]
    if not lines:
        lines = ['FAIL no results :: ' + (res.stdout + res.stderr).strip()[-400:]]
    return lines


def main():
    wanted = sys.argv[1:]
    suites = sorted((HERE / 'suites').glob('*.js'))
    if wanted:
        suites = [s for s in suites if s.stem in wanted]
    base = start_server()
    total = failed = 0
    for suite in suites:
        lines = run_suite(suite, base)
        print(f'\n== {suite.stem} ==')
        for line in lines:
            print('  ' + line)
        total += len(lines)
        failed += sum(1 for l in lines if l.startswith('FAIL'))
    print(f'\n{total - failed}/{total} passed')
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
