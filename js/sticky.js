// ---------- Sticky-note placeholders ----------
// Books added from the sticky-note pile sit on the shelf as a sticky
// note - a reminder to go get it - until you own it or give it a cover.
function isStickyPlaceholder(book) {
    return !!book.stickyNote && !book.owned && !book.image;
}

// ---------- Sticky notes that fall down ----------
// Now and then one to-get note comes unstuck, flutters down and lands
// crooked at the bottom of its shelf. It stays down (even after a
// reload) until you click it to stick it back up. One at a time; never
// in Calm mode or with reduced motion.
const FALLEN_KEY = 'bookShelfFallenNotes';
let fallenNotes = new Set();
try { fallenNotes = new Set(JSON.parse(localStorage.getItem(FALLEN_KEY)) || []); } catch (e) {}

function saveFallenNotes() {
    try { localStorage.setItem(FALLEN_KEY, JSON.stringify([...fallenNotes])); } catch (e) {}
}

function markFallen(el) {
    el.classList.add('fallen');
    // a stable "landed" angle per note, tipped one way or the other
    let h = 0;
    for (const ch of String(el.dataset.id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    el.style.setProperty('--fallen-tilt', (h % 2 ? 1 : -1) * (10 + (h % 7)) + 'deg'); // 10-16deg
    el.title = 'Oops, it fell! Click to stick it back up.';
}

function dropNote(el) {
    const first = el.getBoundingClientRect();
    markFallen(el);
    fallenNotes.add(el.dataset.id);
    saveFallenNotes();
    if (prefersReducedMotion()) return;
    const last = el.getBoundingClientRect();
    const dx = first.left - last.left, dy = first.top - last.top;
    const end = el.style.getPropertyValue('--fallen-tilt');
    // flutter: swing side to side on the way down, then settle crooked
    el.animate([
        { transform: `translate(${dx}px, ${dy}px) rotate(var(--note-tilt, 0deg))` },
        { transform: `translate(${dx - 4}px, ${dy + 6}px) rotate(-10deg)`, offset: 0.12 },
        { transform: `translate(${dx * 0.7 - 10}px, ${dy * 0.62}px) rotate(14deg)`, offset: 0.38 },
        { transform: `translate(${dx * 0.35 + 8}px, ${dy * 0.28}px) rotate(-12deg)`, offset: 0.62 },
        { transform: `translate(-3px, -4px) rotate(calc(${end} + 6deg))`, offset: 0.86 },
        { transform: `rotate(${end})` }
    ], { duration: 1600, easing: 'ease-in-out' });
}

function stickNoteBackUp(el, id) {
    const first = el.getBoundingClientRect();
    el.classList.remove('fallen');
    el.style.removeProperty('--fallen-tilt');
    el.title = '';
    fallenNotes.delete(id);
    saveFallenNotes();
    if (prefersReducedMotion()) return;
    const last = el.getBoundingClientRect();
    const dx = first.left - last.left, dy = first.top - last.top;
    // a little hop back up, pressed onto the shelf with a squish
    el.animate([
        { transform: `translate(${dx}px, ${dy}px) rotate(15deg)` },
        { transform: `translate(${dx * 0.4}px, -14px) rotate(-4deg) scale(1.08)`, offset: 0.55 },
        { transform: 'rotate(var(--note-tilt, 0deg)) scale(0.95, 1.04)', offset: 0.82 },
        { transform: 'rotate(var(--note-tilt, 0deg))' }
    ], { duration: 650, easing: 'cubic-bezier(.3, .8, .4, 1)' });
}

// maybe let one note fall (only if none is down, and one is on screen)
function maybeDropNote(chance) {
    if (prefersReducedMotion() || fallenNotes.size > 0 || Math.random() > chance) return;
    const onScreen = [...document.querySelectorAll('#library-room .book.sticky-book:not(.fallen)')].filter(el => {
        const r = el.getBoundingClientRect();
        return r.bottom > 0 && r.top < window.innerHeight;
    });
    if (onScreen.length === 0) return;
    dropNote(onScreen[Math.floor(Math.random() * onScreen.length)]);
}

function scheduleNoteFalls() {
    // a few seconds after the page opens, sometimes...
    setTimeout(() => maybeDropNote(0.3), 5000 + Math.random() * 7000);
    // ...and once in a while as you browse
    setInterval(() => maybeDropNote(0.2), 4 * 60 * 1000);
}

function buildStickyNoteFace(el, book) {
    el.classList.add('sticky-book');
    // A little haphazard, like notes stuck up by hand - but stable per
    // book (from its id), so a note doesn't jump around between visits:
    // its own tilt, a bit higher or lower than its neighbours, and
    // about half have a bottom corner curling up.
    let h = 0;
    for (const ch of String(book.id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    el.style.setProperty('--note-tilt', ((h % 11) - 5) + 'deg');
    el.style.setProperty('--note-y', (((h >>> 4) % 29) - 14) + 'px');
    const curl = (h >>> 9) % 2 === 0 ? ((h >>> 11) % 2 ? 'curl-right' : 'curl-left') : '';
    if (curl) el.classList.add(curl);

    // the paper itself (the outer element casts the shadow, so the shadow
    // follows the curled shape)
    const face = document.createElement('div');
    face.className = 'sticky-book-face';
    const title = document.createElement('div');
    title.className = 'sticky-book-title';
    title.textContent = book.title;
    const author = document.createElement('div');
    author.className = 'sticky-book-author';
    const authors = (book.authors || []).filter(a => a && a !== 'Unknown');
    author.textContent = authors.length ? `by ${authors.join(', ')}` : '';
    face.append(title, author);
    el.append(face);
    el.title = `${book.title} - on your list to get`;
}

// ---------- Sticky-note pile (quick add to Want to Read) ----------
const QUICK_ADD_GENRE_KEY = 'bookShelfQuickAddGenre';

function openStickyNote() {
    const pile = document.getElementById('sticky-pile');
    if (pile.classList.contains('open')) return;
    const select = document.getElementById('sticky-genre');
    let lastGenre = null;
    try { lastGenre = localStorage.getItem(QUICK_ADD_GENRE_KEY); } catch (e) {}
    const genres = getAllGenres();
    select.innerHTML = '';
    genres.forEach(g => select.add(new Option(g, g)));
    select.value = genres.includes(lastGenre) ? lastGenre : (genres.includes('Sci-Fi') ? 'Sci-Fi' : genres[0]);

    document.getElementById('sticky-title').value = '';
    document.getElementById('sticky-author').value = '';
    pile.classList.add('open');
    const note = document.getElementById('sticky-note');
    if (!prefersReducedMotion()) {
        // peel up off the pile
        note.animate([
            { transform: 'rotate(-12deg) translate(-6px, 10px) scale(0.32)', opacity: 0.7 },
            { transform: 'rotate(2deg) scale(1.03)', offset: 0.7 },
            { transform: 'rotate(-1.5deg)' }
        ], { duration: 380, easing: 'ease-out' });
    }
    document.getElementById('sticky-title').focus();
    setTimeout(() => document.addEventListener('pointerdown', stickyOutsideClick), 0);
}

function stickyOutsideClick(e) {
    if (!document.getElementById('sticky-pile').contains(e.target)) closeStickyNote();
}

function resetStickyNote() {
    document.getElementById('sticky-pile').classList.remove('open');
    document.removeEventListener('pointerdown', stickyOutsideClick);
    document.getElementById('sticky-note').getAnimations().forEach(a => a.cancel());
}

// discard: the note flutters back down onto the pile
function closeStickyNote() {
    const pile = document.getElementById('sticky-pile');
    if (!pile.classList.contains('open')) return;
    document.removeEventListener('pointerdown', stickyOutsideClick);
    if (prefersReducedMotion()) {
        resetStickyNote();
        return;
    }
    document.getElementById('sticky-note').animate([
        { transform: 'rotate(-1.5deg)' },
        { transform: 'rotate(-12deg) translate(-6px, 10px) scale(0.32)', opacity: 0.6 }
    ], { duration: 260, easing: 'ease-in', fill: 'forwards' });
    setTimeout(resetStickyNote, 260);
}

async function submitStickyNote() {
    const note = document.getElementById('sticky-note');
    const titleInput = document.getElementById('sticky-title');
    const title = titleInput.value.trim();
    if (!title) {
        note.animate([
            { translate: '0' }, { translate: '-8px' }, { translate: '8px' },
            { translate: '-5px' }, { translate: '5px' }, { translate: '0' }
        ], { duration: 320 });
        titleInput.focus();
        return;
    }

    const rawAuthors = document.getElementById('sticky-author').value.split(',').map(a => a.trim()).filter(Boolean);
    const genre = document.getElementById('sticky-genre').value;
    try { localStorage.setItem(QUICK_ADD_GENRE_KEY, genre); } catch (e) {}
    const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    const now = Date.now();

    // same shape processBookForm saves, with everything optional left blank
    const book = {
        id: now.toString(),
        title,
        authors: rawAuthors.length ? rawAuthors : ["Unknown"],
        series: "", seriesNumber: null, seriesTotal: null,
        status: 'Want to Read', rating: 0, genre, color, width: 120,
        tags: [], owned: false, notes: "", notesFont: getLastNoteFont(),
        startedDate: "", finishedDate: "",
        statusSince: now, dustedAt: null,
        stickyNote: true, // shows as a sticky note until owned or given a cover
        // after every existing book, even if deletions left gaps
        sortOrder: library.reduce((max, b) => Math.max(max, Number.isFinite(b.sortOrder) ? b.sortOrder : -1), -1) + 1,
        image: "", imageRatio: null, ratioPreset: null,
        spineColor: color, spineImage: "", spineImageRatio: null
    };
    await dbPut(book);
    library.push(book);
    populateAuthorOptions();
    populateSeriesOptions();
    populateFilterTagSelect();
    animateLeans = true;
    renderBookshelf();

    document.removeEventListener('pointerdown', stickyOutsideClick);
    const target = document.querySelector(`.book[data-id="${now}"]`);
    if (prefersReducedMotion()) {
        resetStickyNote();
        return;
    }

    // crumple the note and fly it onto the shelf (or off the top of
    // the screen if the new book isn't in view / is filtered out)
    const noteRect = note.getBoundingClientRect();
    let dx, dy;
    const targetRect = target && target.getBoundingClientRect();
    if (targetRect && targetRect.bottom > 0 && targetRect.top < window.innerHeight) {
        dx = (targetRect.left + targetRect.width / 2) - (noteRect.left + noteRect.width / 2);
        dy = (targetRect.top + targetRect.height / 2) - (noteRect.top + noteRect.height / 2);
    } else {
        dx = 60;
        dy = -window.innerHeight;
    }
    note.animate([
        { transform: 'rotate(-1.5deg)' },
        { transform: 'rotate(8deg) scale(0.55, 0.4)', offset: 0.3 },
        { transform: `translate(${dx}px, ${dy}px) rotate(200deg) scale(0.1)`, opacity: 0.4 }
    ], { duration: 520, easing: 'cubic-bezier(.5, 0, .7, 1)', fill: 'forwards' });
    setTimeout(() => {
        resetStickyNote();
        if (target && target.isConnected) {
            target.animate([
                { transform: 'scale(0.4)', opacity: 0 },
                { transform: 'scale(1.12)', opacity: 1, offset: 0.7 },
                { transform: 'scale(1)' }
            ], { duration: 360, easing: 'ease-out' });
        }
    }, 520);
}
