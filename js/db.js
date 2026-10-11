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
    try { localStorage.setItem(LAST_BACKUP_KEY, String(Date.now())); } catch (e) {}
    hideBackupReminder();
    const lastLine = document.getElementById('setting-last-backup');
    if (lastLine) lastLine.textContent = lastBackupText();
}

// ---------- Backup reminder ----------
// Kept per device (not in backups): when you last exported here, and when
// this copy of the app was first opened (the clock for "never backed up").
const LAST_BACKUP_KEY = 'bookShelfLastBackup';
const FIRST_SEEN_KEY = 'bookShelfFirstSeen';
const BACKUP_SNOOZE_KEY = 'bookShelfBackupSnooze';
const BACKUP_REMIND_DAYS = 30;       // since the last backup...
const BACKUP_FIRST_REMIND_DAYS = 7;  // ...or since first opened, if you never have
const BACKUP_SNOOZE_DAYS = 7;        // "Remind me later"
const BACKUP_GLOW_DAYS = 7;          // the Export button glows once a backup is this old
const BACKUP_GLOW_EVERY_MS = 10 * 60 * 1000;

function readTimeKey(key) {
    try { return Number(localStorage.getItem(key)) || 0; } catch (e) { return 0; }
}

function daysSince(ms) {
    return Math.floor((Date.now() - ms) / DAY_MS);
}

function lastBackupText() {
    const last = readTimeKey(LAST_BACKUP_KEY);
    if (!last) return 'Last backup: never (from this browser).';
    const days = daysSince(last);
    return `Last backup: ${days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`}.`;
}

// days since the last backup (or since first opened), and whether one was ever made
function backupAge() {
    const last = readTimeKey(LAST_BACKUP_KEY);
    return { days: daysSince(last || readTimeKey(FIRST_SEEN_KEY) || Date.now()), ever: !!last };
}

function backupReminderDue() {
    if (!appSettings.backupReminders || !library.length) return false;
    if (readTimeKey(BACKUP_SNOOZE_KEY) > Date.now()) return false;
    const { days, ever } = backupAge();
    return days >= (ever ? BACKUP_REMIND_DAYS : BACKUP_FIRST_REMIND_DAYS);
}

function showBackupReminder() {
    const { days, ever } = backupAge();
    const count = library.length;
    document.getElementById('backup-reminder-text').textContent = ever
        ? `It's been ${days} day${days === 1 ? '' : 's'} since your last backup. Your ${count} book${count === 1 ? '' : 's'} only live in this browser, so it's worth saving a copy.`
        : `You haven't backed up your shelf yet. Your ${count} book${count === 1 ? '' : 's'} only live in this browser, so it's worth saving a copy.`;
    const box = document.getElementById('backup-reminder');
    box.classList.add('visible');
    if (!prefersReducedMotion()) {
        box.animate([
            { opacity: 0, transform: 'translateY(-10px) scale(0.97)' },
            { opacity: 1, transform: 'none' }
        ], { duration: 320, easing: 'ease-out' });
    }
    glowExportButton();
}

function hideBackupReminder() {
    const box = document.getElementById('backup-reminder');
    box.classList.remove('visible');
}

function snoozeBackupReminder() {
    try { localStorage.setItem(BACKUP_SNOOZE_KEY, String(Date.now() + BACKUP_SNOOZE_DAYS * DAY_MS)); } catch (e) {}
    hideBackupReminder();
}

// a soft pulse around the Export button (calm mode: a steady highlight)
function glowExportButton() {
    const btn = document.getElementById('export-btn');
    btn.classList.remove('backup-glow');
    void btn.offsetWidth; // restart the animation if it's mid-glow
    btn.classList.add('backup-glow');
    clearTimeout(btn.glowTimer);
    btn.glowTimer = setTimeout(() => btn.classList.remove('backup-glow'), 4000);
}

function initBackupReminder() {
    try {
        if (!localStorage.getItem(FIRST_SEEN_KEY)) localStorage.setItem(FIRST_SEEN_KEY, String(Date.now()));
    } catch (e) {}
    if (backupReminderDue()) setTimeout(() => { if (backupReminderDue()) showBackupReminder(); }, 2500);
    // ...and the Export button glows every so often while a backup is getting old
    const glowIfOld = () => {
        if (appSettings.backupReminders && library.length && backupAge().days >= BACKUP_GLOW_DAYS) glowExportButton();
    };
    setTimeout(glowIfOld, 20 * 1000);
    setInterval(glowIfOld, BACKUP_GLOW_EVERY_MS);
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
