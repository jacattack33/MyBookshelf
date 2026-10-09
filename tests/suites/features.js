// @size 1100x850
// Newer features: sticky-note filter, new-book sort order, settings in
// backups, custom genre removal, goal shortcut, cat placement, fallen notes,
// tossing deleted notes.
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

// ---- deleting a to-get sticky note sends it off screen (thrown, paper
// airplane, dropped and bounced, or burned up)
openModal('sn1');
const sn1 = q('#library-room .book[data-id="sn1"]');
const neighbour = sn1.nextElementSibling;
const before = neighbour && neighbour.getBoundingClientRect().left;
const deleting = deleteCurrentBook();
await wait(250);
ok('delete closes the window and sends the note off', q('#book-modal').style.display !== 'flex' && !!q('#fx-layer .tossed-note'));
ok('the next book waits while the note leaves', !neighbour || Math.abs(neighbour.getBoundingClientRect().left - before) < 1);
await deleting;
ok('note is gone from the shelf and library', !q('#library-room .book[data-id="sn1"]') && !library.some(b => b.id === 'sn1'));
await wait(4500);
library.push({ id: 'sn3', title: 'Another', authors: ['A'], genre: 'Fantasy', status: 'Want to Read', stickyNote: true, color: '#ccc', width: 100, sortOrder: 2 });
for (const exit of NOTE_EXITS) {
    renderBookshelf();
    q('.book[data-id="sn3"]').scrollIntoView({ block: 'center' });
    tossStickyNote('sn3', exit);
}
await wait(650);
const look = e => q(`#fx-layer .tossed-note[data-exit="${e}"]`);
ok('throw and drop crumple into a ball', look('throw').classList.contains('crumpled') && look('drop').classList.contains('crumpled'));
ok('plane folds up', look('plane').classList.contains('folded'));
ok('burning note has a glowing ember edge', !!look('burn') && !!look('burn').querySelector('.burn-ember'));
const bottom = innerHeight;
await wait(1300);
const db = look('drop') && look('drop').getBoundingClientRect();
// (its box spins bigger than the clipped ball, so judge by the centre)
const mid = db && (db.top + db.bottom) / 2;
ok('dropped ball lands on the bottom edge', db && mid > bottom - 60 && mid < bottom - 20, mid + ' vs ' + bottom);
await wait(2800);
ok('every tossed note cleaned up', !q('#fx-layer .tossed-note'));

// ---- getting a to-get book: the sticky note leaves, the real book poofs in
library.push({ id: 'sn4', title: 'Got it now', authors: ['A'], genre: 'Fantasy', status: 'Want to Read', stickyNote: true, color: '#ccc', width: 100, sortOrder: 3 });
renderBookshelf();
q('.book[data-id="sn4"]').scrollIntoView({ block: 'center' });
openModal('sn4');
q('#book-owned').checked = true;
await processBookForm();
const got = q('#library-room .book[data-id="sn4"]');
ok('got-it note leaves, real book in its place', !!q('#fx-layer .tossed-note') && got && !got.classList.contains('sticky-book'));
let puffed = false;
for (let i = 0; i < 40 && !puffed; i++) { await wait(100); puffed = !!q('#fx-layer .fx-puff'); }
ok('the book poofs in', puffed);
await wait(700);
ok('book fully there after the poof', getComputedStyle(got).opacity === '1' && got.getAnimations().every(a => a.playState !== 'running' || a.effect.getComputedTiming().iterations === Infinity));

// ---- restyling a to-get note (color, size) turns it into a book; a plain save doesn't
library.push({ id: 'sn5', title: 'Plain', authors: ['A'], genre: 'Fantasy', status: 'Want to Read', stickyNote: true, color: '#ccc', width: 120, sortOrder: 4 });
library.push({ id: 'sn6', title: 'Recolored', authors: ['A'], genre: 'Fantasy', status: 'Want to Read', stickyNote: true, color: '#ff2e93', width: 120, sortOrder: 5 });
library.push({ id: 'sn7', title: 'Resized', authors: ['A'], genre: 'Fantasy', status: 'Want to Read', stickyNote: true, color: '#ff2e93', width: 120, sortOrder: 6 });
renderBookshelf();
openModal('sn5'); q('#book-title').value = 'Plain still'; await processBookForm();
ok('editing just the title keeps it a sticky note', isStickyPlaceholder(library.find(b => b.id === 'sn5')));
openModal('sn6'); q('#book-color').value = '#5fe8c4'; await processBookForm();
ok('changing the cover color makes it a book', !isStickyPlaceholder(library.find(b => b.id === 'sn6')));
openModal('sn7'); q('#book-width').value = '150'; await processBookForm();
ok('changing the size makes it a book', !isStickyPlaceholder(library.find(b => b.id === 'sn7')));
await wait(3500);

// ---- a long shelf keeps its sideways scroll through redraws and re-layouts
for (let i = 0; i < 20; i++) library.push({ id: 'lg' + i, title: 'Long ' + i, authors: ['A'], genre: 'Fantasy', status: 'Read', color: '#ccc', width: 120, sortOrder: 100 + i });
renderBookshelf();
const longShelf = () => q('.shelf[data-group="Fantasy"]');
ok('long shelf scrolls sideways', longShelf().classList.contains('scrolls'));
longShelf().scrollLeft = longShelf().scrollWidth;
const endScroll = longShelf().scrollLeft;
renderBookshelf();
ok('redraw keeps the shelf scrolled', Math.abs(longShelf().scrollLeft - endScroll) < 2 && endScroll > 0, longShelf().scrollLeft + ' vs ' + endScroll);
layoutAllShelfSections();
ok('re-layout (drag/resize) keeps it too', Math.abs(longShelf().scrollLeft - endScroll) < 2, longShelf().scrollLeft + ' vs ' + endScroll);

// ---- the Holo theme switches on and off and travels with backups
setTheme('holo');
ok('Holo theme applies', document.documentElement.dataset.theme === 'holo' && q('[data-theme-choice="holo"]').classList.contains('active'));
ok('Holo theme saved in backups', collectSettingsForBackup().bookShelfTheme === 'holo');
setTheme('candy');
ok('back to Candy clears it', !document.documentElement.dataset.theme && q('[data-theme-choice="candy"]').classList.contains('active'));

// ---- Holo buttons: capsules for choices, cut corners for actions
setTheme('holo');
ok('Holo choice buttons are capsules', getComputedStyle(q('.toggle-btn')).borderRadius === '999px');
ok('Holo action buttons have cut corners', getComputedStyle(q('.add-book-btn')).clipPath.startsWith('polygon'));
setTheme('candy');
ok('other themes keep their usual buttons', getComputedStyle(q('.toggle-btn')).borderRadius === '8px' && getComputedStyle(q('.add-book-btn')).clipPath === 'none');

// ---- every theme applies, shows as chosen, and travels with backups
for (const th of ['seaglass', 'holo', 'library', 'deco', 'loft', 'blueprint', 'terminal']) {
    setTheme(th);
    ok(`${th} theme applies`, document.documentElement.dataset.theme === th && q(`[data-theme-choice="${th}"]`).classList.contains('active') && collectSettingsForBackup().bookShelfTheme === th);
}
setTheme('candy');
ok('Candy again clears the theme', !document.documentElement.dataset.theme);
