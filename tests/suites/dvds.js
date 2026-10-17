// @dvds  The DVD shelf (Settings > Shelf of > DVDs): a separate collection
// with its own database, settings and backups, and film words on screen.

ok('opens as the DVD shelf', COLLECTION === 'dvds' && isDvds() && document.documentElement.dataset.collection === 'dvds');
ok('its own database', DB_NAME === 'DvdShelfDB' && db.name === 'DvdShelfDB');
ok('starts empty: no example shelf or placeholder books', library.length === 0 && !q('.book[data-id]'));
ok('...and no welcome popup', q('#fresh-start-modal').style.display !== 'flex');
ok('its own name', q('#shelf-name').textContent === 'My DVD Shelf');
ok('per-shelf keys get a prefix, shared ones don\'t', SETTINGS_KEY === 'dvd:bookShelfSettings' && PINS_KEY === 'dvd:bookShelfPins' && THEME_KEY === 'bookShelfTheme');

// the words
ok('Add DVD button', q('.controls-row .add-book-btn').textContent.includes('Add New DVD'));
ok('Director instead of Author', q('[data-organize="author"]').textContent === 'Director');
ok('watch statuses in the filters', q('[data-filter-status="Read"]').textContent === 'Watched' && q('[data-filter-status="Want to Read"]').textContent === 'Want to Watch');
ok('film genres', GENRES.includes('Documentary') && GENRES.includes('Animation') && !GENRES.includes('Literary Fiction'));
ok('Drama stays a genre (not turned into a book tag)', !RETIRED_GENRE_HOMES.Drama && GENRES.includes('Drama'));

// the reading bits are hidden
const shown = sel => { const el = q(sel); return !!el && getComputedStyle(el).display !== 'none'; };
ok('no critter, goals card or pin board', !shown('#critter-home') && !shown('#goals-card') && !shown('#pin-home'));
ok('the stats ledger and sticky pile stay', shown('#stats-ledger') && shown('#sticky-pile'));

// adding a DVD
openModal();
ok('the form says DVD', q('#modal-title').textContent.includes('DVD'));
ok('format and year fields show', shown('.dvd-only') && shown('#book-format'));
ok('Runtime instead of Pages', q('#book-pages').closest('label').textContent.includes('Runtime'));
ok('new cases start in the DVD case shape', q('#book-ratio-preset').value === DVD_CASE_RATIO);
ok('status buttons say Watched', q('.status-btn[data-status="Read"]').textContent === 'Watched');
q('#book-title').value = 'Spirited Away';
q('#book-author').value = 'Hayao Miyazaki';
q('#book-genre').value = 'Animation';
q('#book-format').value = 'bluray';
q('#book-year').value = '2001';
q('#book-pages').value = '125';
selectStatus('Read');
refreshSpineWidthField();
ok('auto spine width comes from the case, not the runtime', parseInt(q('#book-spine-width').value, 10) === DVD_SPINE_WIDTHS.bluray);
await processBookForm();
await wait(300);
const dvd = library.find(b => b.title === 'Spirited Away');
ok('saved with its format and year', dvd && dvd.format === 'bluray' && dvd.year === 2001 && dvd.pages === 125 && dvd.authors[0] === 'Hayao Miyazaki');
ok('on the shelf with a Blu-ray band', !!q(`.book[data-id="${dvd && dvd.id}"] .format-band.format-bluray`));
const stored = await dbGetAll();
ok('...in the DVD database', stored.length === 1 && stored[0].title === 'Spirited Away');

selectOrganizeBy('status');
ok('status shelves say Watched', [...document.querySelectorAll('.genre-title')].some(t => t.textContent === 'Watched'));
selectOrganizeBy('genre');

openStats();
ok('stats count DVDs in hours, not pages', q('#stats-tiles').textContent.includes('Hours watched') && !q('#stats-tiles').textContent.includes('Pages read'));
ok('...with no reading goal link', !q('#reading-goal').classList.contains('visible'));
closeStats();

// settings stay on this shelf
setSetting('name', 'Film Night');
ok('settings save under the DVD key only', JSON.parse(localStorage.getItem('dvd:bookShelfSettings')).name === 'Film Night' && localStorage.getItem('bookShelfSettings') === null);
openSettings();
ok('Settings shows the Shelf of choice, DVDs picked', q('[data-collection-choice="dvds"]').classList.contains('active') && !q('[data-collection-choice="books"]').classList.contains('active'));
ok('...and hides the pin settings and library card', !shown('.pins-setting') && !shown('.library-card-check'));
closeSettings();

// backups stay separate
let saved = null;
const realCreate = URL.createObjectURL;
URL.createObjectURL = blob => { saved = blob; return realCreate.call(URL, blob); };
HTMLAnchorElement.prototype.click = function () {}; // (no real download)
exportLibrary();
URL.createObjectURL = realCreate;
const payload = saved ? JSON.parse(await saved.text()) : {};
ok('a backup says it is a DVD shelf', payload.collection === 'dvds' && payload.books.length === 1);
ok('...and carries the DVD shelf\'s settings under the plain name', payload.settings && JSON.parse(payload.settings.bookShelfSettings).name === 'Film Night');

const alerts = [];
window.alert = msg => alerts.push(msg);
const importFile = async (obj) => {
    const file = new File([JSON.stringify(obj)], 'backup.json', { type: 'application/json' });
    importLibrary({ target: { files: [file], value: '' } });
    await wait(500);
};
await importFile({ books: [{ id: 'b1', title: 'Dune', authors: ['Frank Herbert'], genre: 'Sci-Fi', status: 'Read', color: '#c70', width: 120 }], customGenres: [] });
ok('a bookshelf backup is refused here', alerts.some(a => a.includes('backup of a bookshelf')) && library.length === 1 && library[0].title === 'Spirited Away');
const dvdBackup = { ...payload, settings: {} };
dvdBackup.books = [...payload.books, { id: 'd2', title: 'Coco', authors: ['Lee Unkrich'], genre: 'Animation', status: 'Want to Read', color: '#a33', width: 120, format: 'dvd' }];
await importFile(dvdBackup);
ok('a DVD backup comes back in', library.length === 2 && library.some(b => b.title === 'Coco'));

// the book shelf is untouched
const bookDb = await new Promise((res, rej) => { const r = indexedDB.open('BookShelfDB', 1); r.onupgradeneeded = e => e.target.result.createObjectStore('books', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const bookCount = await new Promise(res => { const r = bookDb.transaction('books').objectStore('books').count(); r.onsuccess = () => res(r.result); });
bookDb.close();
ok('nothing went into the book database', bookCount === 0);
ok('no book-shelf settings, pins or genres written', ['bookShelfSettings', 'bookShelfPins', 'bookShelfCustomGenres', 'bookShelfStarterIds'].every(k => localStorage.getItem(k) === null));
