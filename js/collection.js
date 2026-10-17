// ---------- Books or DVDs (Settings > Shelf of) ----------
// The same app can hold a DVD shelf instead. It's a separate collection:
// its own database, its own settings and backups, its own genres. Books
// and DVDs are saved the same way (a DVD's director is in `authors`, its
// runtime in `pages`, Watched is status 'Read'), so all the shelf logic
// is shared and only the words on screen change.
const COLLECTION_KEY = 'bookShelfCollection';
const COLLECTION = (() => {
    try { return localStorage.getItem(COLLECTION_KEY) === 'dvds' ? 'dvds' : 'books'; } catch (e) { return 'books'; }
})();
document.documentElement.dataset.collection = COLLECTION;

function isDvds() {
    return COLLECTION === 'dvds';
}

// localStorage keys that belong to one collection: the DVD shelf keeps
// its own copy under a prefix (theme, mode and tint stay shared)
function collKey(key) {
    return isDvds() ? 'dvd:' + key : key;
}

function setCollection(which) {
    if (which === COLLECTION) return;
    try { localStorage.setItem(COLLECTION_KEY, which); } catch (e) { return; }
    location.reload();
}

// Statuses are saved as the book words; DVDs show these instead
const DVD_STATUS_LABELS = {
    "Want to Read": "Want to Watch",
    "Reading": "Watching",
    "Read": "Watched",
    "DNF": "Didn't Finish"
};

function statusLabel(status) {
    return (isDvds() && DVD_STATUS_LABELS[status]) || status;
}

const DVD_FORMATS = { dvd: 'DVD', bluray: 'Blu-ray', uhd: '4K UHD' };
// a DVD case's spine is a little thicker than a Blu-ray's
const DVD_SPINE_WIDTHS = { dvd: 26, bluray: 22, uhd: 22 };
// cover shapes: a DVD case is 135 x 190 mm, a Blu-ray (and 4K) one 135 x 171
const DVD_CASE_RATIO = '0.71';
const BLURAY_CASE_RATIO = '0.79';

// Swap the words in the page for the DVD ones: data-dvd-text replaces an
// element's text, data-dvd-placeholder / data-dvd-title / data-dvd-label
// its placeholder, tooltip and aria-label. Elements with a data-status
// (or the status filters and options) get the DVD status names.
function applyCollectionLabels() {
    if (!isDvds()) return;
    document.querySelectorAll('[data-dvd-text]').forEach(el => { el.textContent = el.dataset.dvdText; });
    document.querySelectorAll('[data-dvd-placeholder]').forEach(el => { el.placeholder = el.dataset.dvdPlaceholder; });
    document.querySelectorAll('[data-dvd-title]').forEach(el => { el.title = el.dataset.dvdTitle; });
    document.querySelectorAll('[data-dvd-label]').forEach(el => { el.setAttribute('aria-label', el.dataset.dvdLabel); });
    document.querySelectorAll('[data-status], [data-filter-status], [data-default-status], #filter-status option').forEach(el => {
        const status = el.dataset.status || el.dataset.filterStatus || el.dataset.defaultStatus || el.value;
        if (DVD_STATUS_LABELS[status]) el.textContent = DVD_STATUS_LABELS[status];
    });
    // the case shapes go at the top of the cover Shape list
    const shape = document.getElementById('book-ratio-preset');
    const natural = shape.querySelector('option[value=""]');
    // (each one goes in right after Natural, so the last one here ends up first)
    [[BLURAY_CASE_RATIO, 'Blu-ray / 4K Case'], [DVD_CASE_RATIO, 'DVD Case']].forEach(([value, name]) => {
        natural.after(new Option(`${name} (${value})`, value));
    });
}
