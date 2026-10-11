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
// those). With `deleting`, only ones the panel made, unless "Deletes can
// hit real books" is ticked.
function debugOnScreen(selector, deleting = false) {
    const real = document.getElementById('debug-real-books');
    const anyBook = !deleting || (real && real.checked);
    return [...document.querySelectorAll(`#library-room ${selector}`)].filter(el => {
        const book = library.find(b => b.id === el.dataset.id);
        if (!book || (!anyBook && !book.debug)) return false;
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
    if (!el) {
        return debugSay(document.getElementById('debug-real-books').checked
            ? 'Nothing like that on screen. Scroll to one first.'
            : 'No debug-made one on screen. Make one first (or scroll to it), or tick "Deletes can hit real books".');
    }
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

function buildDebugPanel() {
    const body = document.getElementById('debug-body');
    const group = (title, items) => {
        const head = document.createElement('div');
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
        body.append(head, row);
    };

    // deletes stick to books and notes the panel made, unless this is ticked
    const real = document.createElement('label');
    real.className = 'debug-real';
    real.innerHTML = '<input type="checkbox" id="debug-real-books"> Deletes can hit real books';
    body.appendChild(real);

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
        ['New egg', critterOff(() => { hatchNewEgg(); debugSay('A new egg.'); })],
        ['Favorite?', () => debugSay(`It loves ${critter.favoriteGenre}.`)]
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

    group('Other', [
        ['Wake the cat', () => appSettings.cat ? (wakeCat(), debugSay('The cat moves shelves.')) : debugSay('The cat is off in Settings > Shelf extras.')],
        ['Log 25 pages', () => { recordPages(25); debugSay('Logged 25 pages.'); }],
        ['Clear pages log', () => { try { localStorage.removeItem(PAGES_LOG_KEY); } catch (e) {} updateGoals(); debugSay('Pages log cleared.'); }],
        ['Confetti', () => confettiFrom(document.getElementById('debug-body'))]
    ]);

    const status = document.createElement('div');
    status.className = 'debug-status';
    status.id = 'debug-status';
    body.appendChild(status);
}
