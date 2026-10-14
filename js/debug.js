// ---------- Debug panel ----------
// Settings > Debug panel: buttons that make the slow or random things
// happen right now, instead of waiting days or poking at the console.

function debugSay(text) {
    const status = document.getElementById('debug-status');
    if (status) status.textContent = text;
}

function toggleDebugPanel() {
    const panel = document.getElementById('debug-panel');
    if (!document.getElementById('debug-body').childElementCount) buildDebugPanel();
    const open = panel.classList.toggle('open');
    panel.querySelector('.debug-tab').setAttribute('aria-expanded', open ? 'true' : 'false');
}

// books / sticky notes drawn on screen right now (exits only play for
// those). With `deleting`, only ones the panel made: debug deletes never
// touch your real books.
function debugOnScreen(selector, deleting = false) {
    return [...document.querySelectorAll(`#library-room ${selector}`)].filter(el => {
        const book = library.find(b => b.id === el.dataset.id);
        if (!book || (deleting && !book.debug)) return false;
        const r = el.getBoundingClientRect();
        return r.width && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
    });
}

const debugPick = list => list[Math.floor(Math.random() * list.length)];

// move the critter's clock back, as if `days` had gone by
function debugPassDays(days) {
    const c = critter;
    const ms = days * DAY_MS;
    ['updatedAt', 'bornAt', 'laidAt', 'emptySince'].forEach(k => { if (c[k]) c[k] -= ms; });
    if (c.gone) c.gone.at -= ms;
    settleCritter();
    renderCritter();
    debugSay(c.gone ? `${days} day(s) later… it ran away.` : `${days} day(s) later: ${c.bornAt ? critterMoodText() : 'still an egg'}`);
}

function debugSetBelly(days, emptyFor = 0) {
    settleCritter();
    const c = critter;
    if (c.gone || !c.bornAt) return debugSay(c.gone ? 'It ran away. Hatch a new egg first.' : 'Still an egg. Feed it first.');
    c.food = critterGoal() * days;
    c.emptySince = days > 0 ? null : Date.now() - emptyFor * DAY_MS;
    saveCritter();
    renderCritter();
    debugSay(critterMoodText());
}

// back a stage (a baby goes back to being an egg)
function debugPrevStage() {
    settleCritter();
    const c = critter;
    if (c.gone) return debugSay('It ran away. Hatch a new egg first.');
    if (!c.bornAt) return debugSay('Already an egg.');
    const i = CRITTER_STAGES.indexOf(critterStage(c));
    if (i <= 0) {
        Object.assign(c, { bornAt: null, totalFed: 0, food: 0, emptySince: null });
    } else {
        c.totalFed = CRITTER_STAGES[i - 1].at;
    }
    saveCritter();
    renderCritter();
    debugSay(c.bornAt ? `Back to a ${critterStage().id}.` : 'Back in its egg.');
}

// take pages back out of the pages log (the reading goals), newest first
function debugUnlogPages(pages) {
    const log = loadPagesLog().sort((a, b) => a.at - b.at);
    for (let i = log.length - 1; i >= 0 && pages > 0; i--) {
        const off = Math.min(pages, log[i].pages);
        log[i].pages -= off;
        pages -= off;
    }
    try { localStorage.setItem(PAGES_LOG_KEY, JSON.stringify(log.filter(e => e.pages > 0))); } catch (e) {}
    updateGoals();
}

// take pages back off it: off what it's eaten all told (which can drop
// it a stage), out of its belly, and off the reading goals
function debugTakePages(pages) {
    settleCritter();
    const c = critter;
    if (c.gone || !c.bornAt) return debugSay(c.gone ? 'It ran away. Hatch a new egg first.' : 'Still an egg: nothing to take.');
    debugUnlogPages(pages);
    c.totalFed = Math.max(0, c.totalFed - pages);
    c.food = Math.max(0, c.food - pages);
    if (c.food === 0 && !c.emptySince) c.emptySince = Date.now();
    saveCritter();
    renderCritter();
    debugSay(`Took ${pages}. ${c.totalFed.toLocaleString()} pages eaten, a ${critterStage().id}. ${critterMoodText()}`);
}

async function debugAddBook() {
    const [title, author] = debugPick(PLACEHOLDER_BOOKS);
    const genre = debugPick(getAllGenres());
    const status = debugPick(['Want to Read', 'Reading', 'Read', 'DNF']);
    const color = debugPick(CONFETTI_COLORS);
    const now = Date.now();
    const book = {
        id: now.toString(), title, authors: [author],
        series: "", seriesNumber: null, seriesTotal: null,
        status, rating: status === 'Read' ? 1 + Math.floor(Math.random() * 5) : 0, genre, color,
        width: 90 + Math.floor(Math.random() * 60),
        pages: 120 + Math.floor(Math.random() * 480),
        tags: [], owned: true, notes: "", notesFont: getLastNoteFont(),
        startedDate: "", finishedDate: status === 'Read' ? String(new Date().getFullYear()) : "",
        statusSince: now, dustedAt: null, stickyNote: false,
        sortOrder: library.reduce((max, b) => Math.max(max, Number.isFinite(b.sortOrder) ? b.sortOrder : -1), -1) + 1,
        image: "", imageRatio: null, ratioPreset: null,
        spineColor: color, spineImage: "", spineImageRatio: null,
        debug: true // so "Remove debug books" can find it
    };
    await dbPut(book);
    library.push(book);
    populateAuthorOptions();
    populateSeriesOptions();
    populateFilterTagSelect();
    animateLeans = true;
    renderBookshelf();
    // bring it into view, ready for a debug delete
    const el = document.querySelector(`#library-room .book[data-id="${book.id}"]`);
    if (el) el.scrollIntoView({ block: 'center' });
    debugSay(`Added "${title}" (${status}) to ${genre}.`);
}

async function debugDeleteOnScreen(selector, exit, toss) {
    const el = debugPick(debugOnScreen(selector, true));
    if (!el) return debugSay('No debug-made one on screen. Make one first (or scroll to it).');
    const id = el.dataset.id;
    const title = (library.find(b => b.id === id) || {}).title;
    const holdMs = (exit ? toss(id, exit) : toss(id)) || 0;
    library = library.filter(b => b.id !== id);
    await dbDelete(id);
    debugSay(`Deleted "${title}"${exit ? ` (${exit})` : ''}.`);
    if (holdMs) await closeGapAfter(id, holdMs);
    animateLeans = true;
    renderBookshelf();
}

async function debugRemoveDebugBooks() {
    const added = library.filter(b => b.debug);
    if (!added.length) return debugSay('No debug books or notes on the shelf.');
    library = library.filter(b => !b.debug);
    for (const b of added) await dbDelete(b.id);
    populateAuthorOptions();
    populateSeriesOptions();
    populateFilterTagSelect();
    renderBookshelf();
    debugSay(`Removed ${added.length} debug book(s) and note(s).`);
}

async function debugDust() {
    if (!appSettings.dust) return debugSay('Dust is off in Settings > Shelf extras.');
    const clean = library.filter(b => b.status === 'Want to Read' && getDustLevel(b) < 2 && !isStickyPlaceholder(b));
    const book = debugPick(clean);
    if (!book) return debugSay('No clean Want to Read books to dust up.');
    book.statusSince = Date.now() - 200 * DAY_MS;
    book.dustedAt = null;
    await dbPut(book);
    renderBookshelf();
    debugSay(`"${book.title}" is covered in dust.`);
}

function debugNewSticky() {
    if (!appSettings.sticky) return debugSay('The sticky-note pile is off in Settings > Shelf extras.');
    const [title, author] = debugPick(PLACEHOLDER_BOOKS);
    openStickyNote();
    document.getElementById('sticky-title').value = title;
    document.getElementById('sticky-author').value = author;
    const before = new Set(library.map(b => b.id));
    setTimeout(async () => {
        await submitStickyNote();
        // flag it so the debug deletes (and "Remove debug books") can find it
        const added = library.find(b => !before.has(b.id));
        if (added) {
            added.debug = true;
            await dbPut(added);
        }
    }, 600);
    debugSay(`Sticking up "${title}".`);
}

function debugDropNote() {
    const el = debugPick(debugOnScreen('.book.sticky-book:not(.fallen)'));
    if (!el) return debugSay('No stuck-up sticky note on screen. Scroll to one, or make one.');
    dropNote(el);
    debugSay('Whoops, one fell.');
}

function debugStickNotesBack() {
    const down = [...document.querySelectorAll('#library-room .book.sticky-book.fallen')];
    down.forEach(el => stickNoteBackUp(el, el.dataset.id));
    fallenNotes.clear();
    saveFallenNotes();
    debugSay(`Stuck ${down.length} note(s) back up.`);
}

function debugExitSelect(exits) {
    const select = document.createElement('select');
    select.add(new Option('random exit', ''));
    exits.forEach(e => select.add(new Option(e, e)));
    return select;
}

// which sections have been opened; they start folded up (just a
// convenience: forgotten is fine)
const DEBUG_OPEN_KEY = 'bookShelfDebugOpen';

function debugOpened() {
    try { return JSON.parse(localStorage.getItem(DEBUG_OPEN_KEY)) || []; } catch (e) { return []; }
}

function buildDebugPanel() {
    const body = document.getElementById('debug-body');
    const opened = debugOpened();
    // each section opens and folds up: click its heading
    const group = (title, items) => {
        const box = document.createElement('details');
        box.className = 'debug-section';
        box.open = opened.includes(title);
        box.addEventListener('toggle', () => {
            const now = debugOpened().filter(t => t !== title);
            if (box.open) now.push(title);
            try { localStorage.setItem(DEBUG_OPEN_KEY, JSON.stringify(now)); } catch (e) {}
        });
        const head = document.createElement('summary');
        head.className = 'debug-group';
        head.textContent = title;
        const row = document.createElement('div');
        row.className = 'debug-buttons';
        items.forEach(item => {
            if (item instanceof Node) return row.appendChild(item);
            const [label, fn] = item;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = label;
            btn.addEventListener('click', fn);
            row.appendChild(btn);
        });
        box.append(head, row);
        body.appendChild(box);
    };

    const critterOff = fn => () => appSettings.critter ? fn() : debugSay('The critter is off in Settings > Shelf extras.');
    group('Critter', [
        ['Feed 50', critterOff(() => { feedCritter(50); debugSay(critter.gone ? 'It ran away. Hatch a new egg first.' : `Fed 50. ${critterMoodText()}`); })],
        ['Next stage', critterOff(() => {
            if (critter.gone) return debugSay('It ran away. Hatch a new egg first.');
            const next = critter.bornAt ? CRITTER_STAGES.find(s => s.at > critter.totalFed) : CRITTER_STAGES[0];
            if (!next) return debugSay('Already all grown.');
            feedCritter(Math.max(1, next.at - critter.totalFed));
            debugSay(`Now ${critterStage().id === 'adult' ? 'an adult' : 'a ' + critterStage().id}.`);
        })],
        ['Previous stage', critterOff(debugPrevStage)],
        ['Take 50', critterOff(() => debugTakePages(50))],
        ['+1 day', critterOff(() => debugPassDays(1))],
        ['+1 week', critterOff(() => debugPassDays(7))],
        ['Full', critterOff(() => debugSetBelly(CRITTER_FOOD_DAYS))],
        ['Hungry', critterOff(() => debugSetBelly(0.5))],
        ['Starving', critterOff(() => debugSetBelly(0))],
        ['1 day from leaving', critterOff(() => debugSetBelly(0, CRITTER_RUNAWAY_DAYS - 0.9))],
        ['Run away now', critterOff(() => {
            settleCritter();
            if (critter.gone) return debugSay('Already gone.');
            critterRunsAway(Date.now());
            saveCritter();
            renderCritter();
            debugSay('It left a note.');
        })],
        ['New egg', critterOff(() => { hatchNewEgg(); debugSay('A new egg.'); })]
    ]);

    const noteExit = debugExitSelect(NOTE_EXITS);
    group('Sticky notes', [
        ['New note', debugNewSticky],
        ['Make one fall', debugDropNote],
        ['Stick all back up', debugStickNotesBack],
        noteExit,
        ['Delete one', () => debugDeleteOnScreen('.book.sticky-book', noteExit.value, tossStickyNote)]
    ]);

    const bookExit = debugExitSelect([...BOOK_EXITS, ...Object.values(THEME_BOOK_EXITS)]);
    group('Books', [
        ['Add a book', debugAddBook],
        ['Remove debug books & notes', debugRemoveDebugBooks],
        bookExit,
        ['Delete one', () => debugDeleteOnScreen('.book:not(.sticky-book)', bookExit.value, tossBook)],
        ['Dust one', debugDust]
    ]);

    group('Backups', [
        ['Backup reminder', () => {
            if (!library.length) return debugSay('No books, so nothing to back up.');
            showBackupReminder();
            debugSay(`Reminder up. ${lastBackupText()}`);
        }],
        ['Glow export', () => { glowExportButton(); debugSay('The Export button glows.'); }]
    ]);

    group('Example shelf', [
        ['Welcome popup', () => {
            freshStartPreview = true;
            document.getElementById('fresh-start-modal').style.display = 'flex';
            debugSay('Preview only: its buttons just close it.');
        }]
    ]);

    group('Pins', [
        ['Earn one', () => {
            const left = PINS.filter(p => !pinState.earned[p.id]);
            if (!left.length) return debugSay('Every pin is earned already.');
            const pin = left[Math.floor(Math.random() * left.length)];
            awardPin(pin.id);
            debugSay(`Earned "${pin.name}".`);
        }],
        ['Earn all', () => { PINS.forEach(p => awardPin(p.id)); debugSay('Every pin earned.'); }],
        ['Reset pins', () => {
            pinState = { earned: {}, seen: {}, counts: {}, lentIds: [], lentTo: [] };
            savePins();
            checkPins(); // anything your shelf has earned comes straight back
            renderPinWidget();
            debugSay(`Pins reset (${earnedPins().length} earned back from your shelf).`);
        }]
    ]);

    group('Other', [
        ['Wake the cat', () => appSettings.cat ? (wakeCat(), debugSay('The cat moves shelves.')) : debugSay('The cat is off in Settings > Shelf extras.')],
        ['Log 25 pages', () => { recordPages(25); debugSay('Logged 25 pages.'); }],
        ['Clear pages log', () => { try { localStorage.removeItem(PAGES_LOG_KEY); } catch (e) {} updateGoals(); debugSay('Pages log cleared.'); }],
        ['Confetti', () => confettiFrom(document.getElementById('debug-body'))],
        ['Image link fails', () => {
            if (document.getElementById('book-modal').style.display !== 'flex') openModal();
            showImageLinkFailure('cover');
            document.getElementById('book-image-link-error').scrollIntoView({ block: 'center' });
            debugSay('Showing the failed-link message under the cover link box.');
        }]
    ]);

    const status = document.createElement('div');
    status.className = 'debug-status';
    status.id = 'debug-status';
    body.appendChild(status);
}
