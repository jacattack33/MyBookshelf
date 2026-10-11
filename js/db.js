// ---------- IndexedDB layer ----------

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            const database = e.target.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

function dbGetAll() {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function dbPut(book) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(book);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

function dbDelete(id) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

function dbClear() {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

function dbBulkPut(books) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        books.forEach(b => store.put(b));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

const SEED_LIBRARY = [
    { id: "1", title: "Dune", authors: ["Frank Herbert"], genre: "Sci-Fi", status: "Read", color: "#cc7a00", image: "", width: 120 },
    { id: "2", title: "The Hobbit", authors: ["J.R.R. Tolkien"], genre: "Fantasy", status: "Read", color: "#196619", image: "", width: 110 },
    { id: "3", title: "The Republic", authors: ["Plato"], genre: "Philosophy", status: "Want to Read", color: "#1a334d", image: "", width: 125 }
];

// First visit: start with the example shelf in starter-library.json (a
// real shelf, minus notes, dates and ratings) so people can see how it
// all works, then delete what they don't want. Opened straight from a
// file (no web server) the browser won't let us fetch it, so fall back
// to the 3 built-in books.
async function loadStarterBooks() {
    try {
        const res = await fetch('starter-library.json', { cache: 'no-store' });
        if (!res.ok) throw new Error(res.status);
        const data = await res.json();
        if (!Array.isArray(data.books) || data.books.length === 0) throw new Error('empty');
        if (Array.isArray(data.customGenres)) {
            data.customGenres.forEach(g => addCustomGenre(g));
        }
        return data.books;
    } catch (e) {
        return SEED_LIBRARY;
    }
}

async function runMigrations() {
    await backfillMissingWidth();
    await backfillRatings();
    await backfillStatusSince();
    await backfillSortOrder();
    await backfillImageRatios();
    await backfillSquareRatios();
    await backfillAuthorsField();
    await migrateSpineColorsForGammaFix();
    await backfillSpineColors();
    await backfillTagCapitalization();
    await migrateGenresToTags();
}

// ---------- Backup: export / import ----------

// Preferences that travel with a backup (not one-time migration flags or
// things like a currently-fallen sticky note).
const SETTINGS_BACKUP_KEYS = [
    'bookShelfSettings', 'bookShelfTheme', 'bookShelfMode', 'bookShelfStickyFilter',
    'bookShelfQuickAddGenre', 'bookShelfLastNoteFont', 'bookShelfExpandedShelves', 'bookShelfRecentColors',
    'bookShelfCritter', 'bookShelfPagesLog'
];

function collectSettingsForBackup() {
    const out = {};
    try {
        SETTINGS_BACKUP_KEYS.forEach(k => {
            const v = localStorage.getItem(k);
            if (v !== null) out[k] = v;
        });
    } catch (e) {}
    return out;
}

function exportLibrary() {
    const payload = { books: library, customGenres: customGenres, settings: collectSettingsForBackup() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    // toISOString() reports UTC, not local time - late evening in most
    // US timezones is already past midnight UTC, stamping tomorrow's
    // date on a backup made tonight. Build the stamp from local fields.
    const now = new Date();
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    a.href = url;
    a.download = `bookshelf-backup-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importLibrary(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        let parsed;
        try {
            parsed = JSON.parse(e.target.result);
        } catch (err) {
            alert('That file is not valid library JSON.');
            return;
        }

        // Supports both the current {books, customGenres} format and
        // older backups that were just a bare array of books.
        const importedBooks = Array.isArray(parsed) ? parsed : parsed.books;
        const importedGenres = Array.isArray(parsed) ? [] : (parsed.customGenres || []);
        // newer backups also carry your Settings (older ones just books)
        const importedSettings = !Array.isArray(parsed) && parsed.settings && typeof parsed.settings === 'object'
            ? parsed.settings : null;

        if (!Array.isArray(importedBooks)) {
            alert('That file is not valid library JSON.');
            return;
        }
        const alsoSettings = importedSettings && Object.keys(importedSettings).length
            ? ' and your settings (theme, mode, name, reading goal, fonts...)' : '';
        if (!confirm(`Replace your current library with the ${importedBooks.length} book(s) in this file${alsoSettings}? This cannot be undone.`)) {
            return;
        }
        await dbClear();
        await dbBulkPut(importedBooks);
        library = await dbGetAll();
        await runMigrations();

        customGenres = [...new Set([...customGenres, ...importedGenres])];
        saveCustomGenres();
        syncCustomGenresFromLibrary();

        if (alsoSettings) {
            // restore the preferences, then reload so every one applies
            try {
                Object.entries(importedSettings).forEach(([k, v]) => {
                    if (SETTINGS_BACKUP_KEYS.includes(k) && typeof v === 'string') localStorage.setItem(k, v);
                });
            } catch (e) {}
            location.reload();
            return;
        }

        populateGenreSelects();
        populateAuthorOptions();
        populateSeriesOptions();
        populateFilterTagSelect();
        renderBookshelf();
    };
    reader.readAsText(file);
    event.target.value = "";
}
