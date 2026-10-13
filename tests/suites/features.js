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
document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: pasteDt, bubbles: true }));
await wait(300);
confirmCrop();
ok('a cropped cover is saved as JPEG', pendingCoverCrop && pendingCoverCrop.startsWith('data:image/jpeg'), (pendingCoverCrop || '').slice(0, 30));
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
