// @size 1100x850
// Newer features: sticky-note filter, new-book sort order, settings in
// backups, custom genre removal, goal shortcut, cat placement, fallen notes.
const ids = () => [...document.querySelectorAll('#library-room .book')].map(b => b.dataset.id).sort().join();

// ---- sticky-note placeholders + Sticky Notes filter
library.push({ id: 'sn1', title: 'To get', authors: ['A'], genre: 'Fantasy', status: 'Want to Read', stickyNote: true, color: '#ccc', width: 100, sortOrder: 20 });
library.push({ id: 'sn2', title: 'Got it', authors: ['A'], genre: 'Fantasy', status: 'Want to Read', stickyNote: true, owned: true, color: '#ccc', width: 100, sortOrder: 21 });
renderBookshelf();
ok('to-get note shows as a sticky note', q('.book[data-id="sn1"]').classList.contains('sticky-book'));
ok('owned note shows as a real book', !q('.book[data-id="sn2"]').classList.contains('sticky-book'));
ok('Sticky filter: Show', ids() === '1,2,3,sn1,sn2', ids());
selectFilterSticky('Hide');
ok('Sticky filter: Hide', ids() === '1,2,3,sn2', ids());
selectFilterSticky('Only');
ok('Sticky filter: Only', ids() === 'sn1', ids());
selectFilterSticky('Show');

// ---- falling notes stay inside their shelf, click sticks them back
const note = q('.book[data-id="sn1"]');
dropNote(note);
ok('note falls', note.classList.contains('fallen'));
await wait(1700);
const shelfBox = note.closest('.shelf').getBoundingClientRect();
ok('fallen note stays inside the shelf', note.getBoundingClientRect().bottom <= shelfBox.bottom + 0.5);
note.click();
await wait(100);
ok('click sticks it back up (without opening the book)', !note.classList.contains('fallen') && q('#book-modal').style.display !== 'flex');

// ---- new books always sort after every other book
library = library.filter(b => b.id !== '2');
openModal();
q('#book-title').value = 'Brand New';
await processBookForm();
const nb = library.find(b => b.title === 'Brand New');
ok('new book sorts after every other book', nb.sortOrder > Math.max(...library.filter(b => b !== nb).map(b => b.sortOrder)));

// ---- settings travel with backups
setSetting('goal', 7);
setTheme('seaglass');
setMode('dark');
const st = collectSettingsForBackup();
ok('backup includes settings', st.bookShelfTheme === 'seaglass' && st.bookShelfMode === 'dark' && JSON.parse(st.bookShelfSettings).goal === 7);
setTheme('candy');
setMode('light');

// ---- reading goal in Stats (and the shortcut when there's none)
openStats();
ok('goal progress shown in Stats', q('#reading-goal span').textContent.includes('/ 7 books'));
closeStats();
setSetting('goal', 0);
openStats();
ok('no goal: shortcut to set one', !!q('.reading-goal-set'));
closeStats();

// ---- custom genres can be removed, moving their books
addCustomGenre('Spooky');
library[0].genre = 'Spooky';
populateGenreSelects();
openSettings();
startRemoveCustomGenre('Spooky');
q('#genre-move select').value = 'Fantasy';
[...q('#genre-move').querySelectorAll('button')].find(b => b.textContent.includes('Move')).click();
await wait(300);
ok('custom genre removed, its book moved', !customGenres.includes('Spooky') && library[0].genre === 'Fantasy');
closeSettings();

// ---- the cat never sits on a shelf title or count
library.push({ id: 'jg', title: 'News', authors: ['A'], genre: 'Journalism & Current Affairs', status: 'Read', color: '#ccc', width: 100, sortOrder: 50 });
renderBookshelf();
const overlap = (a, b) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
const secs = [...document.querySelectorAll('.genre-section')];
let hits = 0;
for (let i = 0; i < secs.length; i++) {
    for (const f of [0, 0.25, 0.5, 0.75, 1]) {
        catState.index = i; catState.frac = f; placeCat();
        const c = q('#shelf-cat').getBoundingClientRect();
        if (overlap(c, secs[i].querySelector('.genre-title').getBoundingClientRect()) ||
            overlap(c, secs[i].querySelector('.shelf-count').getBoundingClientRect())) hits++;
    }
}
ok('cat never on a shelf title or count', hits === 0, hits + ' overlaps');
