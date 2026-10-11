async function init() {
    loadCustomGenres();
    loadRecentColors();
    loadExpandedShelves();
    initThemeToggle();
    loadSettings();
    selectFilterSticky(stickyFilter, false);
    initShelfCat();
    populateGenreSelects();
    db = await openDB();
    library = await dbGetAll();
    let startedFresh = false;
    try { startedFresh = localStorage.getItem(STARTED_FRESH_KEY) === '1'; } catch (e) {}
    if (library.length === 0 && !startedFresh) {
        await dbBulkPut(await loadStarterBooks());
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
    initBackupReminder();
}

init();
