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
dropNote(note);
toggleSetting('noteFalls');
await wait(100);
ok('turning falls off sticks fallen notes back up', !q('.book[data-id="sn1"]').classList.contains('fallen') && fallenNotes.size === 0);
maybeDropNote(1);
ok('no notes fall while falls are off', fallenNotes.size === 0);
toggleSetting('noteFalls');

// ---- the book count on each shelf can be switched off
ok('shelves show their book count', !!q('.shelf-count'));
setSetting('shelfCounts', false);
ok('Book counts off hides them', !q('.shelf-count'));
setSetting('shelfCounts', true);
ok('...and back on', !!q('.shelf-count'));

// ---- new books always sort after every other book
library = library.filter(b => b.id !== '2');
openModal();
q('#book-title').value = 'Brand New';
ok('new book starts with no genre', q('#book-genre').value === '');
const countBeforeNoGenre = library.length;
await processBookForm();
ok('can\'t save without a genre', library.length === countBeforeNoGenre && q('#book-modal').style.display === 'flex');
q('#book-genre').value = 'Fantasy';
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

// ---- series, top lists and highlights in Stats
const statBooks = [
    { id: 'st1', title: 'Trilogy 1', authors: ['Ann Author'], genre: 'Fantasy', series: 'Trio', seriesNumber: 1, seriesTotal: 3, status: 'Read', pages: 300, startedDate: '2024-01-01', finishedDate: '2024-01-10', color: '#ccc', width: 100, sortOrder: 30 },
    { id: 'st2', title: 'Trilogy 2', authors: ['Ann Author'], genre: 'Fantasy', series: 'Trio', seriesNumber: 2, seriesTotal: 3, status: 'Read', pages: 500, startedDate: '2024-02-01', finishedDate: '2024-02-03', color: '#ccc', width: 100, sortOrder: 31 },
    { id: 'st3', title: 'Trilogy 3', authors: ['Ann Author'], genre: 'Fantasy', series: 'Trio', seriesNumber: 3, seriesTotal: 3, status: 'Read', color: '#ccc', width: 100, sortOrder: 32 },
    { id: 'st4', title: 'Duo 1', authors: ['Bo Writer'], genre: 'History', series: 'Duo', seriesNumber: 1, seriesTotal: 2, status: 'Reading', color: '#ccc', width: 100, sortOrder: 33 },
    { id: 'st5', title: 'Loose 1', authors: ['Bo Writer'], genre: 'History', series: 'Loose', seriesNumber: 1, status: 'Read', color: '#ccc', width: 100, sortOrder: 34 }
];
library.push(...statBooks);
openStats();
const seriesTile = label => [...q('#stats-series-tiles').children].find(t => t.firstChild.textContent === label).lastChild.textContent;
ok('series started / finished', seriesTile('Started') === '3' && seriesTile('Finished') === '1' && seriesTile('In progress') === '2',
    ['Started', 'Finished', 'In progress'].map(seriesTile).join());
ok('series with no total never counts as finished', [...document.querySelectorAll('.stats-series-row')].some(r => r.textContent.startsWith('Loose') && r.textContent.endsWith('1 read')));
ok('top author listed first', q('#stats-top-authors .stats-rank-name').textContent === 'Ann Author');
ok('fiction split shown', q('#stats-fiction-split').textContent.includes('fiction'));
const highlight = label => { const dt = [...document.querySelectorAll('#stats-highlights dt')].find(d => d.textContent === label); return dt && dt.nextElementSibling.textContent; };
ok('longest read highlight', highlight('Longest read') === 'Trilogy 2 (500 pages)', highlight('Longest read'));
ok('fastest read highlight', highlight('Fastest read') === 'Trilogy 2 (3 days)', highlight('Fastest read'));
closeStats();
statBooks.forEach(b => library.splice(library.indexOf(b), 1));

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

// ---- deleting a real book: it leaves its own way (every exit, theme ones too)
library.push({ id: 'bk1', title: 'Doomed', authors: ['A'], genre: 'Fantasy', status: 'Read', color: '#5fe8c4', width: 110, sortOrder: 1 });
renderBookshelf();
q('.book[data-id="bk1"]').scrollIntoView({ block: 'center' });
openModal('bk1');
const bk1Next = q('#library-room .book[data-id="bk1"]').nextElementSibling;
const bk1Before = bk1Next && bk1Next.getBoundingClientRect().left;
const deletingBook = deleteCurrentBook();
await wait(250);
ok('deleting a book sends a copy of it off', q('#book-modal').style.display !== 'flex' && !!q('#fx-layer .tossed-book'));
ok('the next book waits while it leaves', !bk1Next || Math.abs(bk1Next.getBoundingClientRect().left - bk1Before) < 1);
await deletingBook;
ok('book is gone from the shelf and library', !q('#library-room .book[data-id="bk1"]') && !library.some(b => b.id === 'bk1'));
await wait(4000);
ok('its copy is cleaned up', !q('#fx-layer .tossed-book'));
// ---- switches for sparkles/confetti and goodbye scenes
setSetting('celebrations', false);
sparkleFrom(document.body);
confettiFrom(document.body);
ok('sparkles & confetti off: none fly', !q('#fx-layer .fx-sparkle, #fx-layer .fx-confetti'));
setSetting('celebrations', true);
sparkleFrom(document.body);
ok('...back on, they do', !!q('#fx-layer .fx-sparkle'));
setSetting('goodbyes', false);
library.push({ id: 'bk3', title: 'Quietly', authors: ['A'], genre: 'Fantasy', status: 'Read', color: '#5fe8c4', width: 110, sortOrder: 1 });
renderBookshelf();
openModal('bk3');
await deleteCurrentBook();
ok('goodbye animations off: a deleted book just goes', !q('#fx-layer .tossed-book') && !library.some(b => b.id === 'bk3'));
setSetting('goodbyes', true);

const allBookExits = [...BOOK_EXITS, ...Object.values(THEME_BOOK_EXITS)];
library.push({ id: 'bk2', title: 'Again', authors: ['A'], genre: 'Fantasy', status: 'Read', color: '#ff2e93', width: 110, sortOrder: 1 });
const leaving = {};
for (const exit of allBookExits) {
    renderBookshelf();
    q('.book[data-id="bk2"]').scrollIntoView({ block: 'center' });
    leaving[exit] = tossBook('bk2', exit);
}
ok('every book exit says how long to hold its spot', allBookExits.every(e => leaving[e] > 0), JSON.stringify(leaving));
await wait(600);
const bookLook = e => q(`#fx-layer .tossed-book[data-exit="${e}"]`);
ok('burning book has an ember edge', !!bookLook('burn') && !!bookLook('burn').parentElement.querySelector('.burn-ember'));
ok('shredder shows up for shredding', !!q('#fx-layer .fx-shredder'));
ok('pages flutter out', document.querySelectorAll('#fx-layer .fx-page').length >= 10);
ok('Library stamps it WITHDRAWN', !!bookLook('withdrawn') && bookLook('withdrawn').querySelector('.fx-stamp').textContent === 'WITHDRAWN');
ok('Terminal types the rm command', /rm "Again"/.test((q('#fx-layer .fx-term-line') || {}).textContent || ''));
ok('Blueprint leaves an outline to rub out', !!q('#fx-layer .fx-outline') && !!q('#fx-layer .fx-eraser'));
ok('Typewriter types X\'s over it', /X{3}/.test((bookLook('typed') && bookLook('typed').querySelector('.fx-typed') || {}).textContent || ''));
ok('Sunset sinks it behind a horizon', !!q('#fx-layer .fx-horizon'));
ok('Holo and Deco split it into visible pieces', [...document.querySelectorAll('#fx-layer .tossed-book')].filter(b => getComputedStyle(b).visibility === 'visible').length > 20);
await wait(5000);
ok('every leaving book cleaned up', !q('#fx-layer .tossed-book'));
library = library.filter(b => b.id !== 'bk2');

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
for (const th of ['seaglass', 'holo', 'library', 'deco', 'loft', 'blueprint', 'terminal', 'typewriter', 'sunset', 'plain', 'plainbold']) {
    setTheme(th);
    ok(`${th} theme applies`, document.documentElement.dataset.theme === th && q(`[data-theme-choice="${th}"]`).classList.contains('active') && collectSettingsForBackup().bookShelfTheme === th);
}
setTheme('candy');
ok('Candy again clears the theme', !document.documentElement.dataset.theme);

// ---- switching to Typewriter types the title in
const titleName = q('#shelf-name').textContent;
const typedLetters = () => [...document.querySelectorAll('#shelf-name span')];
const shownLetters = () => typedLetters().filter(s => getComputedStyle(s).visibility === 'visible').length;
setTheme('typewriter');
await wait(700);
ok('Typewriter title types itself in, whole letters at a time', typedLetters().length === [...titleName].length && shownLetters() > 0 && shownLetters() < typedLetters().length && !('typing' in document.documentElement.dataset));
await wait(3000);
ok('...and ends as the plain name again', !typedLetters().length && q('#shelf-name').textContent === titleName);
setTheme('candy');
openSettings();
setTheme('typewriter');
await wait(500);
ok('picked in Settings, it waits (hidden) for the window to close', !typedLetters().length && getComputedStyle(q('#shelf-name')).visibility === 'hidden');
closeSettings();
await wait(700);
ok('...then types in once Settings closes', typedLetters().length > 0 && shownLetters() < typedLetters().length && getComputedStyle(q('#shelf-name')).visibility === 'visible');
await wait(3000);
openSettings();
setTheme('typewriter');
setTheme('candy');
closeSettings();
ok('switching away before closing leaves the title showing', getComputedStyle(q('#shelf-name')).visibility === 'visible');

// ---- Typewriter machine: off by default, Roller or Full front from Settings, Typewriter only
ok('machine choice hidden in other themes', getComputedStyle(q('.machine-row')).display === 'none' && getComputedStyle(q('.tw-machine')).display === 'none');
setTheme('typewriter');
ok('machine off by default; choice shows in Typewriter', getComputedStyle(q('.machine-row')).display !== 'none' && getComputedStyle(q('.tw-machine')).display === 'none');
setSetting('typewriterMachine', 'roller');
ok('Roller: the panel comes out of the machine', getComputedStyle(q('.tw-machine')).display === 'block' && getComputedStyle(q('.tw-platen')).display !== 'none' && getComputedStyle(q('.tw-scale')).display === 'none' && getComputedStyle(q('.controls .window-titlebar')).display === 'none');
setSetting('typewriterMachine', 'full');
ok('Full front adds the typing scale, and it is saved', getComputedStyle(q('.tw-scale')).display === 'block' && JSON.parse(collectSettingsForBackup().bookShelfSettings).typewriterMachine === 'full');
setTheme('candy');
ok('other themes never show it', getComputedStyle(q('.tw-machine')).display === 'none');
setSetting('typewriterMachine', 'off');

// ---- the plain themes come in six colours, chosen only while one is on
ok('colour choice hidden in other themes', getComputedStyle(q('.tint-row')).display === 'none' && !document.documentElement.dataset.tint);
setTheme('plain');
ok('colour choice shows for Plain, Paper by default', getComputedStyle(q('.tint-row')).display !== 'none' && document.documentElement.dataset.tint === 'paper');
setTint('sage');
ok('picking a colour applies it and travels with backups', document.documentElement.dataset.tint === 'sage' && q('[data-tint-choice="sage"]').classList.contains('active') && collectSettingsForBackup().bookShelfTint === 'sage');
const sageBg = getComputedStyle(document.body).backgroundColor;
setTheme('plainbold');
ok('Plain Bold keeps the colour', document.documentElement.dataset.tint === 'sage' && getComputedStyle(document.body).backgroundColor === sageBg);
setTheme('candy');
ok('leaving the plain themes drops the colour', !document.documentElement.dataset.tint);
setTint('paper');

// ---- retired genres get a real genre; audience/format ones become tags
const oldGenreBooks = [
    { id: 'mig1', title: 'Twilight', authors: ['Stephenie Meyer'], genre: 'Fiction', tags: [] },
    { id: 'mig2', title: 'Someone Unknown', authors: ['Nobody'], genre: 'Fiction', tags: [] },
    { id: 'mig3', title: 'Hamlet', authors: ['William Shakespeare'], genre: 'Drama', tags: [] },
    { id: 'mig4', title: 'The Bad Beginning', authors: ['Lemony Snicket'], genre: 'Young Adult', tags: [] },
    { id: 'mig5', title: 'Logic Book', authors: ['Stephenie Meyer'], genre: 'Critical Thinking', tags: [] },
    { id: 'mig6', title: 'The Ersatz Elevator', authors: ['Unknown'], series: 'Snicket Test Series', genre: 'Fiction', tags: [] },
    { id: 'mig7', title: 'The Bad Beginning', authors: ['Lemony Snicket'], series: 'Snicket Test Series', genre: 'Mystery', tags: [] }
];
library.push(...oldGenreBooks);
await migrateGenresToTags();
const mig = id => library.find(b => b.id === id);
ok('known author leaves Fiction for their genre', mig('mig1').genre === 'Paranormal', mig('mig1').genre);
ok('unknown author leaves Fiction for Contemporary Fiction', mig('mig2').genre === 'Contemporary Fiction', mig('mig2').genre);
ok('Drama becomes a tag on a Literary Fiction book', mig('mig3').genre === 'Literary Fiction' && mig('mig3').tags.includes('Drama'));
ok('Young Adult becomes a tag, genre by author', mig('mig4').genre === 'Mystery' && mig('mig4').tags.includes('Young Adult'), mig('mig4').genre);
ok('non-fiction topic ignores the fiction author map', mig('mig5').genre === 'Philosophy' && mig('mig5').tags.includes('Critical Thinking'), mig('mig5').genre);
ok('unknown author takes a series-mate\'s genre', mig('mig6').genre === 'Mystery', mig('mig6').genre);
const leftover = ['Fiction', 'Drama', 'Essays', 'Reference', 'Critical Thinking'].filter(g => GENRES.includes(g));
ok('retired genres are gone from the list', leftover.length === 0, leftover.join(', '));
for (const b of oldGenreBooks) await dbDelete(b.id);
library = library.filter(b => !b.id.startsWith('mig'));

// ---- a cover can be pasted, or come from a link, as well as a file
const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const pngFile = new File([await (await fetch(PIXEL)).blob()], 'cover.png', { type: 'image/png' });
openModal();
const pasteDt = new DataTransfer();
pasteDt.items.add(pngFile);
document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: pasteDt, bubbles: true }));
await wait(300);
ok('pasting a picture in the edit window opens the cropper for the cover', q('#crop-modal').style.display === 'flex' && cropContext === 'cover' && q('#file-name-display').innerText === 'Pasted image');
useFullImageForCrop();
ok('the pasted picture becomes the pending cover', pendingCoverCrop && pendingCoverCrop.startsWith('data:image/png'));
const textDt = new DataTransfer();
textDt.setData('text/plain', 'just words');
document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: textDt, bubbles: true }));
ok('pasting plain text leaves the cropper shut', q('#crop-modal').style.display !== 'flex');
q('#book-spine-image-url').value = PIXEL;
loadImageFromLinkField('spine');
await wait(300);
ok('an image link loads into the cropper for the spine', q('#crop-modal').style.display === 'flex' && cropContext === 'spine' && q('#book-spine-image-url').value === '');
useFullImageForCrop();
ok('the linked picture becomes the pending spine', pendingSpineCrop && pendingSpineCrop.startsWith('data:image/png'));
ok('setting a spine turns the preview to Spine', previewFace === 'spine', previewFace);
document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: pasteDt, bubbles: true }));
await wait(300);
ok('pasting with the preview on Spine opens the cropper for the spine, not the cover', q('#crop-modal').style.display === 'flex' && cropContext === 'spine', cropContext);
cancelCrop();
setPreviewFace('cover');
document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: pasteDt, bubbles: true }));
await wait(300);
confirmCrop();
ok('a cropped cover is saved as JPEG', pendingCoverCrop && pendingCoverCrop.startsWith('data:image/jpeg'), (pendingCoverCrop || '').slice(0, 30));

// ---- the cropper can turn and straighten; a sideways spine starts upright
const wideCanvas = document.createElement('canvas');
wideCanvas.width = 200; wideCanvas.height = 40;
const WIDE = wideCanvas.toDataURL('image/png');
const cropImgSize = () => [q('#crop-image').naturalWidth, q('#crop-image').naturalHeight].join('x');
openCropModal(WIDE, 'spine');
await wait(400);
ok('a sideways spine photo is turned upright in the cropper', cropImgSize() === '40x200' && !q('#crop-turn-note').hidden, cropImgSize());
turnCropImage(1);
await wait(300);
ok('Turn turns it another quarter', cropImgSize() === '200x40' && q('#crop-turn-note').hidden, cropImgSize());
tiltCropImage(10);
await wait(300);
ok('straightening trims off the blank corners', q('#crop-image').naturalWidth < 200 && q('#crop-image').naturalHeight < 40, cropImgSize());
useFullImageForCrop();
ok('the turned picture is what gets used', pendingSpineCrop && pendingSpineCrop.startsWith('data:image/jpeg'));
openCropModal(WIDE, 'cover');
await wait(400);
ok('a wide cover is left as it is', cropImgSize() === '200x40' && q('#crop-turn-note').hidden && q('#crop-tilt').value === '0', cropImgSize());
cancelCrop();
closeModal();

// ---- our own colour picker, in place of the browser one
openModal();
const circleClick = new MouseEvent('click', { bubbles: true, cancelable: true });
q('#book-color').dispatchEvent(circleClick);
ok('the colour circle opens our picker instead of the browser one', !q('#color-pop').hidden && circleClick.defaultPrevented);
ok('it starts on the current colour', q('#cp-hex').value === q('#book-color').value, q('#cp-hex').value);
ok('the swatches are the theme ones', q('#cp-swatches .cp-swatch').title === PICKER_PALETTES.candy[0], q('#cp-swatches .cp-swatch').title);
const firstSwatch = q('#cp-swatches .cp-swatch').title;
q('#cp-swatches .cp-swatch').click();
ok('a swatch sets the colour', q('#book-color').value === firstSwatch, q('#book-color').value);
const hexBox = q('#cp-hex');
hexBox.value = '#3a5f8c';
hexBox.dispatchEvent(new Event('input', { bubbles: true }));
ok('a typed hex code sets the colour', q('#book-color').value === '#3a5f8c', q('#book-color').value);
hexBox.value = 'f0c';
hexBox.dispatchEvent(new Event('input', { bubbles: true }));
ok('a short hex code works too', q('#book-color').value === '#ff00cc', q('#book-color').value);
const svRect = q('#cp-sv').getBoundingClientRect();
const svAt = (type, fx, fy) => q('#cp-sv').dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, clientX: svRect.left + svRect.width * fx, clientY: svRect.top + svRect.height * fy }));
svAt('pointerdown', 1, 1);
svAt('pointerup', 1, 1);
ok('dragging to the bottom of the square makes it black', q('#book-color').value === '#000000', q('#book-color').value);
ok('and the preview follows', getComputedStyle(q('#preview-book')).backgroundColor === 'rgb(0, 0, 0)', getComputedStyle(q('#preview-book')).backgroundColor);
document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
ok('Escape puts the picker away', q('#color-pop').hidden);
ok('hex round trip', hsvToHex(hexToHsv('#5b3f94')) === '#5b3f94');
setTheme('sunset');
openColorPicker();
ok('another theme gets its own swatches', q('#cp-swatches .cp-swatch').title === PICKER_PALETTES.sunset[0], q('#cp-swatches .cp-swatch').title);
setTheme('plainbold');
closeColorPicker(); openColorPicker();
ok('Plain Bold shares the Plain swatches', q('#cp-swatches .cp-swatch').title === PICKER_PALETTES.plain[0]);
closeColorPicker();
setTheme('candy');
closeModal();

// ---- covers saved as PNG before that are shrunk to JPEG once, at startup
const pngOf = (alpha) => {
    const c = document.createElement('canvas');
    c.width = 120; c.height = 180;
    const img = c.getContext('2d').createImageData(120, 180);
    for (let i = 0; i < img.data.length; i++) img.data[i] = i % 4 === 3 ? alpha : Math.random() * 256; // noisy like a photo
    c.getContext('2d').putImageData(img, 0, 0);
    return c.toDataURL('image/png');
};
const opaquePng = pngOf(255), seeThroughPng = pngOf(128);
library.push({ id: 'png1', title: 'Old Crop', authors: ['A'], genre: 'Fantasy', status: 'Read', color: '#345', width: 100, sortOrder: 80, image: opaquePng, imageRatio: 2 / 3, spineImage: opaquePng });
library.push({ id: 'png2', title: 'Cut Out', authors: ['A'], genre: 'Fantasy', status: 'Read', color: '#345', width: 100, sortOrder: 81, image: seeThroughPng, imageRatio: 2 / 3 });
await convertPngCoversToJpeg();
const oldCrop = library.find(b => b.id === 'png1');
ok('an old PNG cover becomes a smaller JPEG', oldCrop.image.startsWith('data:image/jpeg') && oldCrop.image.length < opaquePng.length, `${opaquePng.length} -> ${oldCrop.image.length}`);
ok('an old PNG spine photo becomes JPEG too', oldCrop.spineImage.startsWith('data:image/jpeg'));
ok('a see-through PNG cover is left alone', library.find(b => b.id === 'png2').image === seeThroughPng);
ok('the shrunk cover is saved', (await dbGetAll()).find(b => b.id === 'png1')?.image === oldCrop.image);
for (const id of ['png1', 'png2']) await dbDelete(id);
library = library.filter(b => !b.id.startsWith('png'));

// ---- "How backups work" explains export / import to new users
ok('the backup bar has no How backups work button', ![...document.querySelectorAll('.backup-bar button')].some(b => b.textContent.includes('How backups work')));
const helpBtn = [...document.querySelectorAll('#settings-modal button')].find(b => b.textContent.includes('How backups work'));
ok('Settings has a How backups work button', !!helpBtn);
helpBtn.click();
ok('it opens the backup help window', q('#backup-help-modal').style.display === 'flex' && /Export/.test(q('.backup-help-body').innerText) && /Import/.test(q('.backup-help-body').innerText));
q('#backup-help-modal').click();
ok('clicking outside closes it', q('#backup-help-modal').style.display === 'none');

// ---- spine width: from the page count, or set by hand
const spineBook = library.find(b => !isStickyPlaceholder(b) && !b.spineImage);
const sid = spineBook.id;
ok('no pages: a quarter of the cover', autoSpineWidth(null, 120) === 30 && autoSpineWidth(0, 160) === 40);
ok('more pages, a thicker spine', autoSpineWidth(100, 120) < autoSpineWidth(300, 120) && autoSpineWidth(300, 120) < autoSpineWidth(800, 120));
ok('kept between the min and max', autoSpineWidth(1, 120) === SPINE_WIDTH_MIN && autoSpineWidth(50000, 120) === SPINE_WIDTH_MAX);
openModal(spineBook.id);
setPreviewFace('spine');
const sw = q('#book-spine-width');
q('#book-pages').value = 800;
q('#book-pages').dispatchEvent(new Event('input'));
ok('pages move the auto slider', sw.value == autoSpineWidth(800, spineBook.width || 120) && q('#book-spine-width-auto').disabled, sw.value);
sw.value = 50;
sw.dispatchEvent(new Event('input'));
q('#book-pages').value = 100;
q('#book-pages').dispatchEvent(new Event('input'));
ok('dragged by hand, it stays put', sw.value == 50 && !q('#book-spine-width-auto').disabled);
await processBookForm();
await wait(300);
ok('the hand-set width is saved', library.find(b => b.id === sid).spineWidth === 50);
selectViewMode('spine');
await wait(300);
ok('and used on the shelf (at the Spines view size)', q(`.book.spine-mode[data-id="${sid}"]`).offsetWidth === Math.round(50 * SPINE_VIEW_SCALE), q(`.book.spine-mode[data-id="${sid}"]`).offsetWidth);
openModal(sid);
ok('it opens as set by hand', sw.value == 50 && !sw.dataset.auto);
setSpineWidthAuto(true);
ok('Auto goes back to the page count', sw.value == autoSpineWidth(100, library.find(b => b.id === sid).width || 120));
await processBookForm();
await wait(300);
ok('auto is saved as no width', library.find(b => b.id === sid).spineWidth === null);
selectViewMode('cover');

// ---- a second note: its own pink page, lower down the same side
{
    const book = library.find(b => b.id === '1');
    book.notes = ''; book.notes2 = '';
    openModal('1');
    const peek1 = q('#preview-notes-peek'), peek2 = q('#preview-notes-peek-2'), flip = q('#notepad-flip');
    ok('no notes: neither page peeks out', !peek1.classList.contains('visible') && !peek2.classList.contains('visible'));
    openNotepad();
    ok('the pink note can be started straight away', !flip.hidden && /A pink note/.test(flip.textContent), flip.textContent);
    flipNotepad();
    const text = q('#notepad-text');
    text.value = 'just the pink one';
    await closeNotepad();
    await wait(100);
    ok('a pink note on its own peeks out by itself', !peek1.classList.contains('visible') && peek2.classList.contains('visible'));
    ok('and is saved without a first note', book.notes === '' && book.notes2 === 'just the pink one');
    ok('Edit Notes then opens the pink one', (openNotepad(), q('.notepad').classList.contains('page-2')));
    ok('which offers a cream note', /A cream note/.test(flip.textContent), flip.textContent);
    flipNotepad();
    text.value = 'first thoughts';
    flipNotepad();
    text.value = '';
    ok('the second note is a fresh pink page', text.value === '' && q('.notepad').classList.contains('page-2'));
    text.value = 'second thoughts';
    flipNotepad();
    ok('flipping back shows the first note again', text.value === 'first thoughts' && !q('.notepad').classList.contains('page-2'));
    ok('and offers the other one', /To the pink note/.test(flip.textContent), flip.textContent);
    await closeNotepad();
    await wait(100);
    ok('both pages peek out', peek1.classList.contains('visible') && peek2.classList.contains('visible'));
    const cover = q('#preview-book').getBoundingClientRect(), r1 = peek1.getBoundingClientRect(), r2 = peek2.getBoundingClientRect();
    ok('the pink one sits lower down', r2.top > r1.bottom - 10, r1.bottom + ' ' + r2.top);
    ok('both stick out of the pages side, not the spine', r1.right > cover.right && r2.right > cover.right && r2.left > cover.left + cover.width / 2);
    ok('both are saved on the book straight away', book.notes === 'first thoughts' && book.notes2 === 'second thoughts');
    openNotepad(peek2, 2);
    ok('the pink peek opens the second note', text.value === 'second thoughts' && q('.notepad').classList.contains('page-2'));
    await closeNotepad();
    await processBookForm();
    await wait(300);
    const saved = library.find(b => b.id === '1');
    ok('Save keeps both notes', saved.notes === 'first thoughts' && saved.notes2 === 'second thoughts' && !!saved.notes2Font);
}

// ---- a cover's Shape reaches the shelf, also when set back to Natural
{
    const mk = (w, h, c) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, w, h); return cv.toDataURL('image/png'); };
        openModal('1');
    pendingCoverCrop = mk(200, 300, '#f00');
    await processBookForm(); await wait(300);
    const el = () => q('.book[data-id="1"]');
    ok('cover saved', !!library.find(x => x.id === '1').image, el().style.aspectRatio);
    openModal('1');
    pendingCoverCrop = mk(300, 300, '#0f0');
    document.getElementById('book-ratio-preset').value = '';
    await processBookForm(); await wait(300);
    ok('re-cropped square shows square on shelf', Math.abs(el().offsetWidth - el().offsetHeight) < 3, el().offsetWidth + 'x' + el().offsetHeight + ' ' + el().style.aspectRatio + ' ' + library.find(x => x.id === '1').imageRatio);
    openModal('1');
    document.getElementById('book-ratio-preset').value = '0.667';
    await processBookForm(); await wait(300);
    openModal('1');
    document.getElementById('book-ratio-preset').value = '';
    await processBookForm(); await wait(300);
    ok('shape back to natural updates shelf', Math.abs(el().offsetWidth - el().offsetHeight) < 3, el().offsetWidth + 'x' + el().offsetHeight + ' ' + library.find(x => x.id === '1').imageRatio);
}

// ---- the guidebook: a big window of chapters with screenshots, opened from Settings
openSettings();
ok('Settings opens with the guidebook button', q('.settings-body').firstElementChild === q('#settings-guide'));
q('#settings-guide button').click();
await wait(100);
const guideModal = q('#guide-modal');
ok('the guidebook pops up over Settings', guideModal.style.display === 'flex' && guideModal.compareDocumentPosition(q('#settings-modal')) & Node.DOCUMENT_POSITION_PRECEDING);
ok('it is big', q('.guide-content').offsetWidth > 900, q('.guide-content').offsetWidth);
const tocBtns = [...document.querySelectorAll('.guide-toc-btn')];
ok('a chapter list down the side', tocBtns.length === GUIDE.length && GUIDE.length >= 12, tocBtns.length);
showGuidePage(0);
ok('chapter 1 is the welcome tour, with a screenshot', q('.guide-title').textContent.includes('Welcome') && !!q('.guide-shot img'));
const shotsOk = [];
for (const c of GUIDE) for (const s of [...(c.shots || []).map(x => x.src), ...(c.themes || []).map(t => 'theme-' + t[0])]) {
    const res = await fetch(`assets/guide/${s}.webp`, { method: 'HEAD' });
    if (!res.ok) shotsOk.push(s);
}
ok('every screenshot is there', !shotsOk.length, shotsOk.join(', '));
ok('numbered tips match the stickers', !!q('.guide-tips.steps li'));
q('#guide-next').click();
ok('Next goes to chapter 2', guidePage === 1 && q('.guide-kicker').textContent.startsWith('Chapter 2'));
document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
ok('the right arrow key turns the page', guidePage === 2);
document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
ok('...and the left one turns back', guidePage === 1);
tocBtns.find(b => b.textContent.includes('Pins')).click();
ok('a chapter opens from the list', q('.guide-title').textContent.includes('Pins') && q('.guide-toc-btn.active').textContent.includes('Pins'));
ok('the pins chapter explains leaving old books out', q('#guide-page').textContent.includes("Don't count toward pins"));
ok('it counts the pins', q('.guide-lead').textContent.includes(String(PINS.length)));
q('.guide-shot-frame').click();
ok('a screenshot opens big', !q('#guide-zoom').hidden);
document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
ok('Esc puts the big screenshot away first', q('#guide-zoom').hidden && guideModal.style.display === 'flex');
document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
ok('...then closes the guide, leaving Settings open', guideModal.style.display === 'none' && q('#settings-modal').style.display === 'flex');
openGuide();
ok('it opens where you left off', q('.guide-title').textContent.includes('Pins'));
showGuidePage(GUIDE.length - 1);
ok('the last page says done', q('#guide-next').textContent.startsWith('Done'));
q('#guide-next').click();
ok('Done closes it', guideModal.style.display === 'none');
closeSettings();
offerFreshStart && (document.getElementById('fresh-start-modal').style.display = 'flex');
q('.fresh-start-guide').click();
ok('the welcome window can open the guide at the start', guideModal.style.display === 'flex' && guidePage === 0 && q('#fresh-start-modal').style.display === 'none');
closeGuide();
