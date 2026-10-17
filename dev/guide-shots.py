"""Take the screenshots for the Guidebook (Settings > Open the guidebook).

    python dev/guide-shots.py            # every shot
    python dev/guide-shots.py shelf pins # just these

Each shot loads the real page in headless Chrome with the example shelf
(starter-library.json), runs a bit of JavaScript to set the scene, then
crops to an element and saves a WebP into assets/guide/. Numbered stickers
(see sticker() below) are drawn on the page to match the numbered tips in
the guide. Needs Node.js, Google Chrome and Pillow (pip install pillow).
"""
import functools
import http.server
import json
import shutil
import subprocess
import sys
import tempfile
import threading
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT / 'tests'))
import run  # noqa: E402  (the test harness: build_page, the driver)

OUT = ROOT / 'assets' / 'guide'

# runs before every shot's own script
PRELUDE = r"""
// numbered stickers on the page, to match the numbered tips in the guide
const sticker = (el, n, dx = 0, dy = 0) => {
    if (typeof el === 'string') el = q(el);
    const r = el.getBoundingClientRect();
    const s = document.createElement('div');
    s.className = 'guide-shot-sticker';
    s.textContent = n;
    s.style.cssText = `position:fixed;z-index:999999;left:${r.left + dx - 15}px;top:${r.top + dy - 15}px;width:30px;height:30px;border-radius:50%;background:#ff2e93;color:#fff;font:700 17px/30px Quicksand,sans-serif;text-align:center;border:3px solid #fff;box-shadow:2px 3px 0 #4a2378;pointer-events:none`;
    document.body.appendChild(s);
};
// where to crop: an element (plus padding), or a rect
const clip = (el, pad = 12) => {
    if (typeof el === 'string') el = q(el);
    const r = el.getBoundingClientRect();
    ok('CLIP', true, JSON.stringify({ x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 }));
};
const clipRect = (x, y, w, h) => ok('CLIP', true, JSON.stringify({ x, y, w, h }));
closeFreshStart();
{ const st = document.createElement('style'); st.textContent = 'html{scrollbar-width:none} ::-webkit-scrollbar{display:none}'; document.head.appendChild(st); }
const W = () => document.documentElement.clientWidth, H = () => window.innerHeight;
// scroll so an element's top sits near the top of the screen
const scrollTo_ = async (el, gap = 20) => { if (typeof el === 'string') el = q(el); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - gap); await wait(400); };
document.querySelectorAll('.backup-reminder').forEach(e => e.remove());
appSettings.backupReminders = false;
// the example shelf's blank test book doesn't photograph well
{ const bk = library.find(b => b.title === 'book'); if (bk) { library.splice(library.indexOf(bk), 1); renderBookshelf(); } }
"""

# a few things the example shelf doesn't have, for shots that need them
STICKIES = r"""
    for (const [t, a, g] of [['Piranesi', 'Susanna Clarke', 'Mystery'], ['The Secret History', 'Donna Tartt', 'Mystery'],
                             ['Circe', 'Madeline Miller', 'Mystery'], ['Mexican Gothic', 'Silvia Moreno-Garcia', 'Mystery']]) {
        await addStickyBook(t, a, g);
    }
    await wait(300);
"""
LENT = r"""
    const owned = visibleBooks().filter(x => x.owned && x.image);
    owned[0].lentTo = 'Sam'; owned[0].lentAt = Date.now() - 12 * 864e5;
    owned[1].lentTo = 'Priya'; owned[1].lentAt = Date.now() - 40 * 864e5;
"""
# a year of reading: finish dates, pages and stars on the Read books
FINISHED = r"""
    visibleBooks().filter(x => x.status === 'Read').forEach((x, i) => {
        const m = String(1 + (i * 7) % 10).padStart(2, '0'), d = String(3 + (i * 5) % 24).padStart(2, '0');
        x.finishedDate = `2026-${m}-${d}`; x.startedDate = `2026-${m}`;
        x.pages = x.pages || 180 + (i * 47) % 300; x.rating = x.rating || 3 + i % 3;
    });
    updateGoals();
"""
PAGES = FINISHED + r"""
    [40, 12, 0, 65, 30, 22].forEach((n, i) => { if (n) recordPages(n, Date.now() - (6 - i) * 864e5); });
    setSetting('goal', 30); setSetting('pagesGoal', 150); setSetting('pagesPeriod', 'week');
    feedCritter(260); critter.name = 'Gumdrop'; saveCritter(); renderCritter(); updateGoals();
"""

# name: (width, height, script). Every script ends with clip(...).
SHOTS = {
    'shelf': (1440, 1250, r"""
        selectOrganizeBy('status'); await wait(900);
        sticker('#shelf-name', 1, -50, 20);
        sticker('.controls', 2, 24, 24);
        sticker('.backup-bar', 3, -14, 18);
        sticker('.library-room .book', 4, 20, 30);
        sticker('#critter-home', 5, 50, 10);
        sticker('.sticky-pile', 6, 70, 20);
        await wait(300);
        clipRect(0, 0, W(), H());
    """),
    'backup': (1280, 900, r"""
        openBackupHelp(); await wait(400);
        clip('#backup-help-modal .modal-content', 4);
    """),
    'add': (1280, 950, r"""
        openModal(); await wait(500);
        q('#book-title').value = 'The Hobbit';
        q('#book-author').value = 'J.R.R. Tolkien';
        q('#book-pages').value = '310';
        q('#book-color').value = '#2e6b4f';
        updatePreview();
        await wait(600);
        clip('#book-modal .modal-content', 4);
    """),
    'sticky': (1280, 900, r"""
        openStickyNote(); await wait(300);
        q('#sticky-title').value = 'Piranesi';
        q('#sticky-author').value = 'Susanna Clarke';
        await wait(500);
        const r = q('.sticky-pile').getBoundingClientRect();
        clipRect(0, r.top - 250, 400, H() - r.top + 250);
    """),
    'stickyshelf': (1440, 1000, STICKIES + r"""
        selectFilterSticky('Only'); await wait(900);
        const room = q('.library-room').getBoundingClientRect();
        clipRect(110, room.top - 50, W() - 220, Math.min(470, room.height + 60));
    """),
    'covers': (1440, 1000, r"""
        selectOrganizeBy('status'); await wait(900);
        await scrollTo_('.library-room', 70);
        clipRect(110, 0, W() - 220, 470);
    """),
    'spines': (1440, 1000, r"""
        selectOrganizeBy('status'); selectViewMode('spine'); await wait(900);
        await scrollTo_('.library-room', 70);
        clipRect(110, 0, W() - 220, 470);
    """),
    'lent': (1440, 1000, r"""
        const first = visibleBooks().filter(x => x.genre === 'Adventure' && x.image);
        first[1].owned = true; first[1].lentTo = 'Sam'; first[1].lentAt = Date.now() - 12 * 864e5;
        renderBookshelf(); await wait(900);
        await scrollTo_('.library-room', 70);
        clipRect(110, 0, W() - 220, 470);
    """),
    'organize': (1280, 900, r"""
        sticker('[data-organize="genre"]', 1, -12, -8);
        sticker('[data-view-mode="cover"]', 2, -12, -8);
        sticker('#sort-mode', 3, -12, -8);
        sticker('[data-filter-sticky="Show"]', 4, -12, -8);
        sticker('#filter-genre', 5, -12, -8);
        await wait(200);
        clip('.controls', 16);
    """),
    'card': (1280, 950, r"""
        const b = visibleBooks().find(x => x.image && x.status === 'Read') || visibleBooks()[0];
        openModal(b.id); await wait(500);
        setGotHow('thrift', 'the church sale');
        q('#started-month').value = '3'; q('#started-day').value = '2'; q('#started-year').value = '2025';
        q('#finished-month').value = '3'; q('#finished-day').value = '19'; q('#finished-year').value = '2025';
        q('#book-pages').value = '256';
        openLibraryCard(); await wait(2200);
        clip('#book-modal .modal-content', 4);
    """),
    'dates': (1280, 1000, r"""
        const b = visibleBooks().find(x => x.image && x.status === 'Read') || visibleBooks()[0];
        openModal(b.id); await wait(500);
        q('#started-month').value = '3'; q('#started-day').value = ''; q('#started-year').value = '2025';
        q('#finished-month').value = ''; q('#finished-day').value = ''; q('#finished-year').value = '';
        updateDateFieldState('started'); updateDateFieldState('finished');
        q('#status-buttons').scrollIntoView({ block: 'start' }); await wait(300);
        const top = q('#status-buttons').getBoundingClientRect().top - 50;
        const bot = q('[data-date-field="finished"]').getBoundingClientRect().bottom + 10;
        const sec = q('#status-buttons').closest('.field-section').getBoundingClientRect();
        const tb = q('[data-date-field="started"] .date-today-btn');
        sticker(tb, 1, tb.offsetWidth + 22, 12);
        sticker('#started-year', 2, q('#started-year').offsetWidth + 2, 0);
        await wait(200);
        clipRect(sec.left - 10, top, sec.width + 20, bot - top);
    """),
    'notes': (1280, 950, r"""
        const b = visibleBooks().find(x => x.image && x.status === 'Read') || visibleBooks()[0];
        b.notes = 'the bit with the riddles!!'; b.notes2 = 'lend to Sam next';
        openModal(b.id); await wait(800);
        sticker('#preview-notes-peek', 1, 52, 4);
        sticker('#preview-notes-peek-2', 2, 44, 18);
        sticker('.preview-faces', 3, -64, 0);
        await wait(200);
        clip('.modal-preview', 34);
    """),
    'notepad': (1280, 950, r"""
        const b = visibleBooks().find(x => x.image && x.status === 'Read') || visibleBooks()[0];
        b.notes = 'the bit with the riddles!!\n\nmade me want second breakfast';
        openModal(b.id); await wait(500);
        openNotepad(q('#preview-notes-peek'), 1); await wait(1000);
        clip('#notepad-modal .notepad', 30);
    """),
    'slips': (1280, 900, STICKIES + LENT + r"""
        saveRecs([{ id: 'r1', title: 'Project Hail Mary', author: 'Andy Weir', from: 'Sam', at: Date.now() },
                  { id: 'r2', title: 'Tomorrow, and Tomorrow, and Tomorrow', author: 'Gabrielle Zevin', from: 'Mum', at: Date.now() }]);
        const done = visibleBooks().filter(x => x.status === 'Read');
        done[0].recommendedBy = 'Priya';
        openSlips(); await wait(800);
        clip('#slips-modal .modal-content', 4);
    """),
    'goals': (1280, 1300, PAGES + r"""
        openGoals(); await wait(900);
        clip('#goals-modal .modal-content', 4);
    """),
    'critter': (1280, 1100, PAGES + r"""
        openCritter(); await wait(1000);
        clip('#critter-modal .modal-content', 4);
    """),
    'corner': (1280, 900, PAGES + r"""
        await wait(800);
        const r = q('#corner-stack').getBoundingClientRect();
        const p = q('.sticky-pile').getBoundingClientRect();
        clipRect(0, r.top - 30, 200, p.bottom - r.top + 50);
    """),
    'pins': (1280, 950, r"""
        PINS.slice(0, 26).forEach((p, i) => { pinState.earned[p.id] = Date.now() - i * 1000; pinState.seen[p.id] = true; });
        savePins(); renderPinWidget();
        openPins(); await wait(1200);
        clip('.pins-pop', 6);
    """),
    'stats': (1280, 1200, FINISHED + r"""
        openStats(); await wait(900);
        clip('#stats-modal .modal-content', 4);
    """),
    'phone': (390, 844, r"""
        toggleFiltersPanel(); await wait(500);
        clipRect(0, 0, W(), H());
    """),
    'phoneshelf': (390, 844, r"""
        selectOrganizeBy('status'); await wait(800);
        await scrollTo_('.library-room', 10);
        sticker('#corner-toggle', 1, 0, -30);
        await wait(200);
        clipRect(0, 0, W(), H());
    """),
}

# a strip of themes for "Make it yours"
THEMES = ['candy', 'seaglass', 'terminal', 'loft', 'typewriter', 'sunset', 'holo', 'blueprint', 'deco']
for t in THEMES:
    SHOTS['theme-' + t] = (1440, 1000, ("" if t == 'candy' else f"setTheme('{t}');") + r"""
        selectOrganizeBy('status'); await wait(1500);
        await scrollTo_('.library-room', 90);
        clipRect(100, 30, 820, 470);
    """)
SHOTS['theme-dark'] = (1440, 1000, r"""
    setMode('dark'); selectOrganizeBy('status'); await wait(1500);
    await scrollTo_('.library-room', 90);
    clipRect(100, 30, 820, 470);
""")


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve():
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return f'http://127.0.0.1:{server.server_port}'


def main():
    wanted = sys.argv[1:]
    OUT.mkdir(parents=True, exist_ok=True)
    run.OUT.mkdir(exist_ok=True)
    base = serve()
    for name, (w, h, js) in SHOTS.items():
        if wanted and name not in wanted:
            continue
        page = run.OUT / f'guide-{name}.html'
        page.write_text(run.build_page(PRELUDE + js, base), encoding='utf-8')
        prof = tempfile.mkdtemp()
        png = run.OUT / f'guide-{name}.png'
        try:
            r = subprocess.run(['node', '--experimental-websocket', str(run.HERE / 'chrome-driver.js'),
                                f'{base}/tests/.out/{page.name}', prof, str(png), str(w), str(h)],
                               capture_output=True, text=True, timeout=180)
        finally:
            shutil.rmtree(prof, ignore_errors=True)
            page.unlink()
        lines = r.stdout.splitlines()
        fails = [l for l in lines if l.startswith('FAIL')]
        clips = [l.split(' :: ', 1)[1] for l in lines if l.startswith('PASS CLIP')]
        if fails or not clips or not png.exists():
            print(name, 'FAILED', fails or r.stdout[-300:], r.stderr[-300:])
            continue
        c = json.loads(clips[-1])
        img = Image.open(png).convert('RGB')
        box = (max(0, round(c['x'])), max(0, round(c['y'])), min(img.width, round(c['x'] + c['w'])), min(img.height, round(c['y'] + c['h'])))
        img = img.crop(box)
        img.save(OUT / f'{name}.webp', 'WEBP', quality=82, method=6)
        png.unlink()
        print(name, img.size, (OUT / f'{name}.webp').stat().st_size // 1024, 'KB')


if __name__ == '__main__':
    main()
