async function init() {
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
    if (library.length === 0 && !startedFresh) {
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
}

init();
