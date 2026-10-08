"""Run the bookshelf's browser tests in headless Chrome.

    python tests/run.py            # every suite
    python tests/run.py core       # just one (core / phone / features)

Each file in tests/suites/ is a chunk of JavaScript that runs inside the real
page after it loads, using these helpers:
    ok(name, condition, detail)   record a PASS / FAIL line
    wait(ms)                      pause (real time)
    q(selector)                   document.querySelector

A suite's first line can set the screen size, e.g.  // @size 390x844
(phone suites are emulated at that size).

Every run uses a brand-new Chrome profile, so tests never touch your own
books. Needs Node.js (20+) and Google Chrome (or set CHROME_PATH).
"""
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
OUT = HERE / '.out'

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
  const r = document.createElement('pre'); r.id = 'r'; r.textContent = out.join('\n'); document.body.appendChild(r);
})();
</script></body>"""


def build_page(suite_js):
    page = (ROOT / 'index.html').read_text(encoding='utf-8')
    # the test page lives in tests/.out, so point the paper image at the real assets
    page = page.replace("url('assets/", "url('" + (ROOT / 'assets').as_uri() + "/")
    return page.replace('</body>', HARNESS_START + suite_js + HARNESS_END, 1)


def run_suite(path):
    js = path.read_text(encoding='utf-8')
    m = re.search(r'@size\s+(\d+)x(\d+)', js.splitlines()[0] if js else '')
    w, h = (m.group(1), m.group(2)) if m else ('1100', '850')
    OUT.mkdir(exist_ok=True)
    page = OUT / f'{path.stem}.html'
    page.write_text(build_page(js), encoding='utf-8')
    profile = tempfile.mkdtemp(prefix='bookshelf-test-')
    try:
        res = subprocess.run(
            ['node', '--experimental-websocket', str(HERE / 'chrome-driver.js'), page.as_uri(), profile, '', w, h],
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
    total = failed = 0
    for suite in suites:
        lines = run_suite(suite)
        print(f'\n== {suite.stem} ==')
        for line in lines:
            print('  ' + line)
        total += len(lines)
        failed += sum(1 for l in lines if l.startswith('FAIL'))
    print(f'\n{total - failed}/{total} passed')
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
