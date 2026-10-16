// ---------- Slips ----------
// Three paper slips in one window (the Slips button above the shelves):
// books you've lent out, books friends recommended, and books to buy.
// Lent out and to buy are views of your shelf (a to-buy book added here
// goes on it as a sticky note); recs are their own list.

const SLIP_LATE_DAYS = 30; // lent longer than this gets an OVERDUE stamp

function openSlips() {
    populateFriendOptions();
    fillQuickAddGenres(document.getElementById('buy-genre'));
    renderSlips();
    document.getElementById('slips-modal').style.display = 'flex';
}

function closeSlips() {
    document.getElementById('slips-modal').style.display = 'none';
}

function renderSlips() {
    renderLentSlip();
    renderRecsSlip();
    renderBuySlip();
}

// names you've lent to or had recs from, offered in the name boxes
function populateFriendOptions() {
    const names = new Set();
    loadRecs().forEach(r => names.add(r.from));
    visibleBooks().forEach(b => {
        const gotFriend = ['borrowed', 'gift'].includes(b.gotHow) ? b.gotFrom : '';
        [b.lentTo, b.recommendedBy, gotFriend].forEach(n => { if (n && n.trim()) names.add(n.trim()); });
    });
    const list = document.getElementById('friend-options');
    list.innerHTML = '';
    [...names].sort((a, b) => a.localeCompare(b)).forEach(n => list.appendChild(new Option(n)));
}

// a book's title as a link that opens it
function slipBookButton(book) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'slip-book';
    btn.textContent = book.title;
    btn.title = `Open "${book.title}"`;
    btn.addEventListener('click', () => {
        closeSlips();
        openModal(book.id);
    });
    return btn;
}

function slipEmpty(list, text) {
    const li = document.createElement('li');
    li.className = 'slip-empty';
    li.textContent = text;
    list.appendChild(li);
}

const slipAuthors = book => (book.authors || []).filter(a => a && a !== 'Unknown').join(', ');

// ----- Lent out -----
function renderLentSlip() {
    const list = document.getElementById('slip-lent-list');
    list.innerHTML = '';
    // gone the longest on top
    const lent = visibleBooks().filter(isLentOut).sort((a, b) => (a.lentAt || 0) - (b.lentAt || 0));
    document.getElementById('slip-lent-sub').textContent = lent.length
        ? `${lent.length} book${lent.length === 1 ? '' : 's'} out`
        : '';
    if (!lent.length) return slipEmpty(list, 'Every book is home.');
    lent.forEach(book => {
        const li = document.createElement('li');
        li.className = 'slip-row';
        const late = book.lentAt && Date.now() - book.lentAt > SLIP_LATE_DAYS * DAY_MS;
        if (late) li.classList.add('late');
        const who = document.createElement('span');
        who.className = 'slip-who';
        who.textContent = book.lentTo;
        const when = document.createElement('span');
        when.className = 'slip-when';
        when.textContent = book.lentAt ? friendlyAge(book.lentAt) : '';
        const back = document.createElement('button');
        back.type = 'button';
        back.className = 'slip-action secondary';
        back.textContent = 'back ✓';
        back.title = `${book.lentTo} gave it back`;
        back.addEventListener('click', () => returnLentBook(book.id, li));
        li.append(slipBookButton(book), who, when);
        if (late) {
            const stamp = document.createElement('span');
            stamp.className = 'slip-stamp';
            stamp.textContent = 'OVERDUE';
            li.appendChild(stamp);
        }
        li.appendChild(back);
        list.appendChild(li);
    });
}

async function returnLentBook(id, row) {
    const book = library.find(b => b.id === id);
    if (!book) return;
    book.lentTo = '';
    book.lentAt = null;
    await dbPut(book);
    bookBackForPins();
    if (row) sparkleFrom(row, 6);
    renderBookshelf();
    renderLentSlip();
}

// ----- Recs from friends -----
// Its own list, kept apart from your shelf (a rec isn't a book you
// want, not yet). "on shelf" opens it in the Add Book window, filled in;
// once it's saved it leaves the list. Books on your shelf with a
// Recommended by name are listed underneath.
const RECS_KEY = 'bookShelfRecs';
let recToShelf = null; // the rec being added in the Add Book window

function loadRecs() {
    try {
        const recs = JSON.parse(localStorage.getItem(RECS_KEY));
        if (Array.isArray(recs)) return recs;
    } catch (e) {}
    return [];
}

function saveRecs(recs) {
    try { localStorage.setItem(RECS_KEY, JSON.stringify(recs)); } catch (e) {}
}

function renderRecsSlip() {
    const list = document.getElementById('slip-recs-list');
    list.innerHTML = '';
    const recs = loadRecs();
    const order = { 'Reading': 0, 'Want to Read': 1, 'Read': 2, 'DNF': 3 };
    const shelved = visibleBooks().filter(b => (b.recommendedBy || '').trim())
        .sort((a, b) => (order[a.status] ?? 1) - (order[b.status] ?? 1) || a.title.localeCompare(b.title));
    document.getElementById('slip-recs-sub').textContent = recs.length + shelved.length
        ? `${recs.length} rec${recs.length === 1 ? '' : 's'}${shelved.length ? ` \u00b7 ${shelved.length} on your shelf` : ''}`
        : '';
    if (!recs.length && !shelved.length) return slipEmpty(list, 'No recs yet. When a friend says "you have to read this", jot it down here.');

    recs.forEach(rec => {
        const li = document.createElement('li');
        li.className = 'slip-row';
        const title = document.createElement('span');
        title.className = 'slip-title';
        title.textContent = rec.title;
        const who = document.createElement('span');
        who.className = 'slip-who';
        who.textContent = [rec.author, `from ${rec.from}`].filter(Boolean).join(' \u00b7 ');
        const shelf = document.createElement('button');
        shelf.type = 'button';
        shelf.className = 'slip-action secondary';
        shelf.textContent = '\uff0b shelf';
        shelf.title = 'Put it on your shelf';
        shelf.addEventListener('click', () => addRecToShelf(rec.id));
        const drop = document.createElement('button');
        drop.type = 'button';
        drop.className = 'slip-x';
        drop.innerHTML = '&times;';
        drop.title = 'Cross it off';
        drop.setAttribute('aria-label', `Cross off "${rec.title}"`);
        drop.addEventListener('click', () => {
            saveRecs(loadRecs().filter(r => r.id !== rec.id));
            renderRecsSlip();
        });
        li.append(title, who, shelf, drop);
        list.appendChild(li);
    });

    if (!shelved.length) return;
    const head = document.createElement('li');
    head.className = 'slip-subhead';
    head.textContent = 'On your shelf';
    list.appendChild(head);
    shelved.forEach(book => {
        const li = document.createElement('li');
        li.className = 'slip-row';
        const who = document.createElement('span');
        who.className = 'slip-who';
        who.textContent = `from ${book.recommendedBy.trim()}`;
        const status = document.createElement('span');
        status.className = 'slip-status';
        const stars = normalizeRating(book.rating);
        status.textContent = book.status === 'Read' ? (stars ? '\u2605'.repeat(stars) : 'read') : book.status === 'Reading' ? 'reading' : book.status === 'DNF' ? 'DNF' : 'to read';
        if (book.status === 'Read') status.classList.add('done');
        li.append(slipBookButton(book), who, status);
        list.appendChild(li);
    });
}

function addRecFromSlip() {
    const title = document.getElementById('rec-title');
    const from = document.getElementById('rec-from');
    if (!title.value.trim()) return nudgeSlipInput(title);
    if (!from.value.trim()) return nudgeSlipInput(from);
    const recs = loadRecs();
    recs.push({
        id: 'rec' + Date.now() + Math.floor(Math.random() * 1000),
        title: title.value.trim(),
        author: document.getElementById('rec-author').value.trim(),
        from: from.value.trim(),
        at: Date.now()
    });
    saveRecs(recs);
    checkPins(); // your first rec earns one
    title.value = '';
    document.getElementById('rec-author').value = '';
    // keep the name: recs often come in batches from one person
    populateFriendOptions();
    renderRecsSlip();
    title.focus();
}

// the Add Book window, filled in from the rec (you pick the genre and
// status); saving it takes the rec off the list
function addRecToShelf(id) {
    const rec = loadRecs().find(r => r.id === id);
    if (!rec) return;
    closeSlips();
    openModal();
    recToShelf = id;
    document.getElementById('book-title').value = rec.title;
    document.getElementById('book-author').value = rec.author || '';
    document.getElementById('book-rec-by').value = rec.from;
    updatePreview();
}

// (processBookForm, once the new book's saved)
function recPutOnShelf() {
    if (!recToShelf) return;
    saveRecs(loadRecs().filter(r => r.id !== recToShelf));
    recToShelf = null;
}
// ----- To buy -----
// the sticky notes: books you want but don't have yet
function renderBuySlip() {
    const list = document.getElementById('slip-buy-list');
    list.innerHTML = '';
    const buy = visibleBooks().filter(isStickyPlaceholder)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    document.getElementById('slip-buy-total').textContent = `ITEMS: ${buy.length}`;
    if (!buy.length) return slipEmpty(list, 'Nothing on the list. Add one below, or with the sticky notes.');
    buy.forEach(book => list.appendChild(buyRow(book)));
}

function buyRow(book) {
    const li = document.createElement('li');
    li.className = 'slip-row';
    const label = document.createElement('label');
    label.className = 'slip-check';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.setAttribute('aria-label', `Got "${book.title}"`);
    box.addEventListener('change', () => setBought(book.id, box.checked, li));
    label.appendChild(box);
    const what = document.createElement('span');
    what.className = 'slip-what';
    what.appendChild(slipBookButton(book));
    const extra = [slipAuthors(book), book.recommendedBy ? `from ${book.recommendedBy.trim()}` : ''].filter(Boolean).join(' · ');
    if (extra) {
        const by = document.createElement('span');
        by.className = 'slip-by';
        by.textContent = extra;
        what.appendChild(by);
    }
    li.append(label, what);
    return li;
}

// ticked: you own it now, so its sticky note turns into a real book.
// The row stays (crossed off) while the slip's open, so a slip of the
// finger can be unticked.
async function setBought(id, bought, row) {
    const book = library.find(b => b.id === id);
    if (!book) return;
    book.owned = bought;
    await dbPut(book);
    row.classList.toggle('bought', bought);
    if (bought) sparkleFrom(row, 5);
    renderBookshelf();
    if (bought) countForPins('bought');
}

async function addBuyFromSlip() {
    const title = document.getElementById('buy-title');
    if (!title.value.trim()) return nudgeSlipInput(title);
    await addStickyBook(title.value, document.getElementById('buy-author').value, document.getElementById('buy-genre').value);
    title.value = '';
    document.getElementById('buy-author').value = '';
    renderBuySlip();
    title.focus();
}

function nudgeSlipInput(input) {
    input.focus();
    if (prefersReducedMotion()) return;
    input.animate([
        { translate: '0' }, { translate: '-6px' }, { translate: '6px' },
        { translate: '-4px' }, { translate: '4px' }, { translate: '0' }
    ], { duration: 300 });
}
