// Count a visit, to see if anyone's using the shelf (GoatCounter: no
// cookies, no IP addresses kept). Only on the real site, so copies of the
// app, files opened from disk and the tests count nothing, and as an image,
// so no outside code runs on the page. Nothing about the books is sent.
const VISIT_HOST = 'jacattack33.github.io';
const VISIT_COUNTER = 'https://mybookshelf.goatcounter.com/count';

function countVisit(host = location.hostname) {
    if (host !== VISIT_HOST) return null;
    const params = new URLSearchParams({
        p: location.pathname, t: document.title, r: document.referrer,
        s: `${screen.width},${screen.height},${window.devicePixelRatio || 1}`,
        rnd: Math.random().toString(36).slice(2) // (never a cached copy)
    });
    const img = new Image();
    img.src = `${VISIT_COUNTER}?${params}`;
    return img;
}

async function init() {
    applyCollectionLabels(); // Books or DVDs
    loadCustomGenres();
    loadRecentColors();
    loadExpandedShelves();
    initThemeToggle();
    loadSettings();
    typeInTitle(); // (Typewriter only) now the bookshelf name is in
    selectFilterSticky(stickyFilter, false);
    initShelfCat();
    populateGenreSelects();
    db = await openDB();
    requestPersistentStorage();
    library = await dbGetAll();
    let startedFresh = false;
    try { startedFresh = localStorage.getItem(STARTED_FRESH_KEY) === '1'; } catch (e) {}
    // (the DVD shelf has no example shelf: it starts empty)
    if (library.length === 0 && !startedFresh && !isDvds()) {
        const starter = await loadStarterBooks();
        await dbBulkPut(starter);
        rememberStarterBooks(starter);
        library = await dbGetAll();
    }
    await runMigrations();
    syncCustomGenresFromLibrary();
    populateGenreSelects();
    populateAuthorOptions();
    populateSeriesOptions();
    populateFilterTagSelect();
    renderBookshelf();
    scheduleNoteFalls();
    initCritter();
    initPins();
    initBackupReminder();
    if (starterIsExample) offerFreshStart();
    countVisit();
}

init();
