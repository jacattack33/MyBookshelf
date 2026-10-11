// ---------- Recent colors (quick-select) ----------

function loadRecentColors() {
    try {
        recentColors = JSON.parse(localStorage.getItem(RECENT_COLORS_KEY)) || [];
    } catch (e) {
        recentColors = [];
    }
}

function recordRecentColor(color) {
    recentColors = [color, ...recentColors.filter(c => c.toLowerCase() !== color.toLowerCase())].slice(0, 5);
    localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(recentColors));
    renderRecentColorSwatches();
}

function renderRecentColorSwatches() {
    const row = document.getElementById('recent-colors');
    if (!row) return;
    row.innerHTML = recentColors.map(c =>
        `<button type="button" class="recent-color-swatch" style="background:${c};" onclick="pickRecentColor('${c}')" title="${c}"></button>`
    ).join('');
}

function pickRecentColor(color) {
    document.getElementById('book-color').value = color;
    updatePreview();
}

function saveCustomGenres() {
    localStorage.setItem(CUSTOM_GENRES_KEY, JSON.stringify(customGenres));
}

function getAllGenres() {
    return [...GENRES, ...customGenres];
}

function syncCustomGenresFromLibrary() {
    const known = getAllGenres().map(g => g.toLowerCase());
    const missing = [...new Set(visibleBooks().map(b => b.genre).filter(Boolean))]
        .filter(g => !known.includes(g.toLowerCase()));
    if (missing.length > 0) {
        customGenres.push(...missing);
        saveCustomGenres();
    }
}

function addCustomGenre(name) {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const exists = getAllGenres().some(g => g.toLowerCase() === trimmed.toLowerCase());
    if (!exists) {
        customGenres.push(trimmed);
        saveCustomGenres();
    }
    return exists ? getAllGenres().find(g => g.toLowerCase() === trimmed.toLowerCase()) : trimmed;
}

function buildGenreOptgroupsHTML() {
    const optionsHTML = (list) => list.map(g => `<option value="${g}">${g}</option>`).join('');
    let html = `<optgroup label="Fiction">${optionsHTML(FICTION_GENRES)}</optgroup>`;
    html += `<optgroup label="Non-Fiction">${optionsHTML(NONFICTION_GENRES)}</optgroup>`;
    if (customGenres.length > 0) {
        const sortedCustom = [...customGenres].sort((a, b) => a.localeCompare(b));
        html += `<optgroup label="Custom">${optionsHTML(sortedCustom)}</optgroup>`;
    }
    return html;
}

function populateGenreSelects() {
    const allGenres = getAllGenres();
    const groupsHTML = buildGenreOptgroupsHTML();

    const filterSelect = document.getElementById('filter-genre');
    const previousFilterValue = filterSelect.value || 'All';
    filterSelect.innerHTML = '<option value="All">All Genres</option>' + groupsHTML;
    filterSelect.value = allGenres.includes(previousFilterValue) ? previousFilterValue : 'All';

    const modalSelect = document.getElementById('book-genre');
    const previousModalValue = modalSelect.value;
    modalSelect.innerHTML = groupsHTML +
        `<option value="${ADD_GENRE_VALUE}">+ Add new genre...</option>`;
    if (allGenres.includes(previousModalValue)) {
        modalSelect.value = previousModalValue;
    }
}

function handleGenreSelectChange() {
    const select = document.getElementById('book-genre');
    if (select.value !== ADD_GENRE_VALUE) return;

    const name = prompt('New genre name:');
    if (!name || !name.trim()) {
        select.value = getAllGenres()[0] || '';
        return;
    }
    const finalName = addCustomGenre(name);
    populateGenreSelects();
    select.value = finalName;
}

// ---------- Authors (autocomplete from existing library) ----------

function visibleBooks() {
    return library.filter(b => !b.hiddenSecret);
}

function populateAuthorOptions() {
    const datalist = document.getElementById('author-options');
    const authors = [...new Set(visibleBooks().flatMap(b => b.authors || []))].sort((a, b) => a.localeCompare(b));
    datalist.innerHTML = authors.map(a => `<option value="${a}"></option>`).join('');
}

function populateSeriesOptions() {
    const datalist = document.getElementById('series-options');
    const seriesNames = [...new Set(visibleBooks().map(b => b.series).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    datalist.innerHTML = seriesNames.map(s => `<option value="${s}"></option>`).join('');
}

function getAllTags() {
    return [...new Set(visibleBooks().flatMap(b => b.tags || []))].sort((a, b) => a.localeCompare(b));
}

// tags offered while tagging a book: the ones you use plus SUGGESTED_TAGS
function getTagSuggestions() {
    const mine = getAllTags();
    const extra = SUGGESTED_TAGS.filter(t => !mine.some(m => m.toLowerCase() === t.toLowerCase()));
    return [...mine, ...extra].sort((a, b) => a.localeCompare(b));
}

function capitalizeTag(tag) {
    return tag.charAt(0).toUpperCase() + tag.slice(1);
}

// ---------- Tag chips (book form) ----------
// The chosen tags live in editingTags and render as removable chips;
// #book-tags (hidden) mirrors them as the comma list the save code reads.

let editingTags = [];
let justAddedTags = new Set(); // chips to bounce in on the next render

function setTags(tags) {
    editingTags = [];
    tags.forEach(t => addTag(t, false));
    justAddedTags.clear(); // loading a book's tags shouldn't bounce
    document.getElementById('tag-entry').value = "";
    renderTagChips();
}

function addTag(raw, rerender = true) {
    // a pasted "a, b, c" still works - each piece becomes its own chip
    raw.split(',').map(t => t.trim()).filter(Boolean).forEach(t => {
        // reuse an existing tag's spelling so "romance" joins "Romance"
        const existing = getTagSuggestions().find(x => x.toLowerCase() === t.toLowerCase());
        const tag = capitalizeTag(existing || t);
        if (!editingTags.some(x => x.toLowerCase() === tag.toLowerCase())) {
            editingTags.push(tag);
            justAddedTags.add(tag);
        }
    });
    if (rerender) renderTagChips();
}

function removeTag(tag) {
    const index = editingTags.indexOf(tag);
    if (index < 0) return;
    editingTags.splice(index, 1);
    document.getElementById('book-tags').value = editingTags.join(', ');
    // shrink the old chip away, then redraw (an earlier redraw from
    // some other change just replaces it, which is fine too)
    const chip = [...document.querySelectorAll('.tag-chip')].find(c => c.dataset.tag === tag);
    if (chip && !prefersReducedMotion()) {
        chip.classList.add('tag-chip-leaving');
        setTimeout(renderTagChips, 200);
    } else {
        renderTagChips();
    }
    // refresh the open dropdown so the removed tag is pickable again
    if (document.activeElement === document.getElementById('tag-entry')) handleTagInput();
}

function renderTagChips() {
    const box = document.getElementById('tag-chips');
    box.innerHTML = '';
    editingTags.forEach((tag, i) => {
        const chip = document.createElement('span');
        chip.className = justAddedTags.has(tag) ? 'tag-chip tag-chip-new' : 'tag-chip';
        chip.dataset.tag = tag;
        chip.textContent = tag;
        const x = document.createElement('button');
        x.type = 'button';
        x.className = 'tag-chip-remove';
        x.setAttribute('aria-label', `Remove ${tag}`);
        x.innerHTML = '&times;';
        x.addEventListener('mousedown', e => e.preventDefault());
        x.addEventListener('click', () => removeTag(tag));
        chip.appendChild(x);
        box.appendChild(chip);
    });
    document.getElementById('book-tags').value = editingTags.join(', ');
    justAddedTags.clear();
}

// Turn whatever's typed into a chip (Enter, comma, blur, or Save).
function commitTagEntry() {
    const entry = document.getElementById('tag-entry');
    if (entry.value.trim()) addTag(entry.value);
    entry.value = "";
}

function handleTagEntryKeydown(e) {
    const entry = e.target;
    if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        commitTagEntry();
        handleTagInput();
    } else if (e.key === 'Backspace' && !entry.value && editingTags.length) {
        removeTag(editingTags[editingTags.length - 1]);
    } else if (e.key === 'Escape') {
        hideTagSuggestions();
    }
}

function handleTagEntryBlur() {
    commitTagEntry();
    hideTagSuggestionsDelayed();
}

function handleTagInput() {
    const entry = document.getElementById('tag-entry');
    const box = document.getElementById('tag-suggestions');
    // typing a comma (e.g. on mobile keyboards that skip keydown) commits too
    if (entry.value.includes(',')) commitTagEntry();
    const current = entry.value.trim().toLowerCase();
    const chosen = editingTags.map(t => t.toLowerCase());

    // Nothing typed yet -> act as a full dropdown of every existing tag;
    // typing narrows it down from there.
    const matches = getTagSuggestions().filter(t => {
        const lower = t.toLowerCase();
        if (chosen.includes(lower)) return false;
        return !current || lower.includes(current);
    });

    if (matches.length === 0) {
        hideTagSuggestions();
        return;
    }

    box.innerHTML = '';
    matches.forEach(t => {
        const item = document.createElement('div');
        item.className = 'tag-suggestion-item';
        item.textContent = t;
        item.addEventListener('mousedown', e => {
            e.preventDefault();
            pickTagSuggestion(t);
        });
        box.appendChild(item);
    });
    box.classList.add('visible');
}

function pickTagSuggestion(tag) {
    const entry = document.getElementById('tag-entry');
    entry.value = "";
    addTag(tag);
    entry.focus();
    // keep the list open (minus what's now picked) so several tags can
    // be chosen in a row
    handleTagInput();
}

function toggleTagDropdown() {
    const box = document.getElementById('tag-suggestions');
    if (box.classList.contains('visible')) {
        hideTagSuggestions();
        return;
    }
    document.getElementById('tag-entry').focus();
    handleTagInput();
}

function hideTagSuggestions() {
    const box = document.getElementById('tag-suggestions');
    box.classList.remove('visible');
    box.innerHTML = '';
}

function hideTagSuggestionsDelayed() {
    // onblur fires before a suggestion's onmousedown handler would
    // otherwise run - but that handler already calls
    // event.preventDefault() to stop blur from firing at all, so this
    // delay is just a safety net for closing on a genuine blur.
    setTimeout(hideTagSuggestions, 150);
}

function populateFilterTagSelect() {
    const select = document.getElementById('filter-tag');
    const previousValue = select.value || 'All';
    const allTags = getAllTags();
    select.innerHTML = '<option value="All">All Tags</option>' +
        allTags.map(t => `<option value="${t}">${t}</option>`).join('');
    select.value = allTags.includes(previousValue) ? previousValue : 'All';
}

// ---------- Add / Edit ----------

function openModal(bookId = null) {
    editingId = bookId;
    const modalTitle = document.getElementById('modal-title');
    const saveBtn = document.getElementById('modal-save-btn');
    const existingImageNote = document.getElementById('existing-image-note');
    document.getElementById('modal-delete-btn').style.display = bookId ? 'inline-block' : 'none';
    renderRecentColorSwatches();

    populateGenreSelects();
    populateAuthorOptions();
    populateSeriesOptions();
    populateDateMonthSelects();
    document.getElementById('book-image').value = "";
    document.getElementById('file-name-display').innerText = "No file chosen";
    document.getElementById('book-spine-image').value = "";
    document.getElementById('spine-file-name-display').innerText = "No file chosen";
    clearSpineImageFlag = false;
    pendingCoverCrop = null;
    pendingSpineCrop = null;

    if (bookId) {
        const book = library.find(b => b.id === bookId);
        if (!book) return;
        modalTitle.innerText = "Edit Book";
        saveBtn.innerText = "Save Changes";
        document.getElementById('book-title').value = book.title;
        document.getElementById('book-author').value = (book.authors || []).join(", ");
        document.getElementById('book-series').value = book.series || "";
        document.getElementById('book-series-number').value = book.seriesNumber || "";
        document.getElementById('book-series-total').value = book.seriesTotal || "";
        selectStatus(book.status || "Want to Read");
        document.getElementById('book-rating').value = normalizeRating(book.rating);
        updateRatingStarsUI(normalizeRating(book.rating));
        document.getElementById('book-genre').value = book.genre;
        document.getElementById('book-color').value = book.color || "#1a334d";
        document.getElementById('book-width').value = book.width || 120;
        document.getElementById('book-ratio-preset').value = book.ratioPreset || "";
        setTags(book.tags || []);
        setOwned(!!book.owned);
        setNotes(book.notes || "", book.notesFont);
        setDateField('started', book.startedDate);
        setDateField('finished', book.finishedDate);
        existingImageNote.style.display = book.image ? 'block' : 'none';
        document.getElementById('existing-spine-image-note').style.display = book.spineImage ? 'block' : 'none';
        document.getElementById('clear-spine-image-btn').style.display = book.spineImage ? 'inline-block' : 'none';
    } else {
        modalTitle.innerText = "Add a New Book";
        saveBtn.innerText = "Put on Shelf";
        document.getElementById('book-title').value = "";
        document.getElementById('book-author').value = "";
        document.getElementById('book-series').value = "";
        document.getElementById('book-series-number').value = "";
        document.getElementById('book-series-total').value = "";
        selectStatus(appSettings.defaultStatus);
        document.getElementById('book-rating').value = 0;
        updateRatingStarsUI(0);
        document.getElementById('book-genre').value = "Sci-Fi";
        document.getElementById('book-color').value = "#1a334d";
        document.getElementById('book-width').value = 120;
        document.getElementById('book-ratio-preset').value = "0.667";
        setTags([]);
        setOwned(false);
        setNotes("");
        setDateField('started', "");
        setDateField('finished', "");
        existingImageNote.style.display = 'none';
        document.getElementById('existing-spine-image-note').style.display = 'none';
        document.getElementById('clear-spine-image-btn').style.display = 'none';
    }

    document.getElementById('book-width-value').innerText = document.getElementById('book-width').value + 'px';
    updateWidthSliderFill();
    setTitlePlaceholders(!bookId);
    document.getElementById('book-modal').style.display = 'flex';
    suppressPreviewWiggle = true;
    updatePreview();
    suppressPreviewWiggle = false;
}

const PLACEHOLDER_BOOKS = [
    ["The Very Hungry Caterpillar", "Eric Carle"],
    ["Pride and Prejudice", "Jane Austen"],
    ["The Hitchhiker's Guide to the Galaxy", "Douglas Adams"],
    ["Little Women", "Louisa May Alcott"],
    ["Charlotte's Web", "E. B. White"],
    ["The Secret Garden", "Frances Hodgson Burnett"],
    ["Anne of Green Gables", "L. M. Montgomery"],
    ["Howl's Moving Castle", "Diana Wynne Jones"],
    ["Matilda", "Roald Dahl"],
    ["The Night Circus", "Erin Morgenstern"]
];

// A new book gets a random cute example in the Title/Author boxes.
function setTitlePlaceholders(isNew) {
    const titleInput = document.getElementById('book-title');
    const authorInput = document.getElementById('book-author');
    if (isNew) {
        const [title, author] = PLACEHOLDER_BOOKS[Math.floor(Math.random() * PLACEHOLDER_BOOKS.length)];
        titleInput.placeholder = `e.g. ${title}`;
        authorInput.placeholder = `e.g. ${author}`;
    } else {
        titleInput.placeholder = "Book Title";
        authorInput.placeholder = "e.g. Carl Sagan, Ann Druyan";
    }
}


// ---------- Library checkout card ----------
let libraryCardClosing = false;
let libraryCardBusy = false; // cover still opening
let libraryCardTimer = null;

function formatPartialDate(value) {
    const { year, month, day } = parsePartialDate(value);
    const MONTH_SHORT = MONTH_NAMES.map(m => m.slice(0, 3));
    if (!year) return '\u2014';
    if (!month) return year;
    if (!day) return `${MONTH_SHORT[month - 1]} ${year}`;
    return `${MONTH_SHORT[month - 1]} ${day}, ${year}`;
}

function openLibraryCard() {
    const overlay = document.getElementById('library-card-overlay');
    if (overlay.classList.contains('open') || libraryCardBusy || libraryCardClosing) return;
    if (overlay.parentElement !== document.body) document.body.appendChild(overlay);
    const title = document.getElementById('book-title').value.trim() || 'Untitled';
    const author = document.getElementById('book-author').value.trim() || 'Unknown';
    const started = readDateField('started', 'started').value || '';
    const finished = readDateField('finished', 'finished').value || '';
    const status = document.getElementById('book-status').value;
    const stamps = {
        'Want to Read': ['ON HOLD', 'want'],
        'Reading': ['CHECKED OUT', 'reading'],
        'Read': ['RETURNED \u2713', 'read'],
        'DNF': ['DNF', 'dnf']
    };
    const [stampText, stampClass] = stamps[status] || ['', ''];
    const cardFont = appSettings.cardFont || document.getElementById('book-notes-font').value;
    const hand = `font-family: ${noteFontStack(getNoteFont(cardFont))};`;

    const card = document.getElementById('library-card');
    card.innerHTML = `
        <div class="lc-head">LIBRARY CARD</div>
        <div class="lc-field">Title <span class="lc-hand lc-title" style="${hand}"></span></div>
        <div class="lc-field">Author <span class="lc-hand" style="${hand}"></span></div>
        <table class="lc-table">
            <tr><th>Checked out</th><th>Returned</th></tr>
            <tr><td class="lc-hand" style="${hand}"></td><td class="lc-hand" style="${hand}"></td></tr>
            <tr><td></td><td></td></tr>
        </table>
        <div class="lc-stamp ${stampClass}"></div>`;
    // textContent (not innerHTML) for anything the user typed
    const hands = card.querySelectorAll('.lc-hand');
    hands[0].textContent = title;
    hands[1].textContent = author;
    hands[2].textContent = formatPartialDate(started);
    hands[3].textContent = formatPartialDate(finished);
    card.querySelector('.lc-stamp').textContent = stampText;

    if (prefersReducedMotion()) {
        overlay.classList.add('open');
        return;
    }

    // swing the book's front cover wide open to show the pocket inside...
    libraryCardBusy = true;
    openBookFx();

    // ...then the card slides up out of it
    libraryCardTimer = setTimeout(() => {
        overlay.classList.add('open');
        overlay.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150 });
        card.animate([
            { transform: 'translateY(260px)' },
            { transform: 'translateY(-14px)', offset: 0.75 },
            { transform: 'translateY(0)' }
        ], { duration: 520, easing: 'ease-out', fill: 'backwards' });
        libraryCardBusy = false;
    }, COVER_OPEN_MS * 0.6); // the cover looks open well before its easing finishes
}

const COVER_OPEN = 'rotateY(-165deg)';
const COVER_OPEN_MS = 1500;  // how long the cover takes to swing open
const COVER_CLOSE_MS = 1100; // ...and shut, bounces included

// Build the on-top copy of the preview book and swing its cover open.
function openBookFx() {
    closeBookFx(true);
    const preview = document.getElementById('preview-book');
    const rect = document.getElementById('preview-book-wrap').getBoundingClientRect();
    const startAngle = preview.matches(':hover') && !prefersReducedMotion()
        ? parseFloat(getComputedStyle(preview).getPropertyValue('--cover-lift')) : 0;

    const fx = document.createElement('div');
    fx.className = 'open-book-fx';
    fx.id = 'open-book-fx';
    Object.assign(fx.style, {
        left: rect.left + 'px', top: rect.top + 'px',
        width: rect.width + 'px', height: rect.height + 'px'
    });
    fx.innerHTML = `
        <div class="ob-page"><span class="preview-inside-pocket"></span></div>
        <div class="ob-cover">
            <div class="ob-front"></div>
            <div class="ob-back"></div>
        </div>`;

    // the cover is a copy of the preview book itself (minus its ids and
    // handlers, so it doesn't clash with the real one)
    const copy = preview.cloneNode(true);
    [copy, ...copy.querySelectorAll('[id]')].forEach(el => el.removeAttribute('id'));
    copy.removeAttribute('onclick');
    copy.removeAttribute('title');
    fx.querySelector('.ob-front').appendChild(copy);

    ['--spine-top-a', '--spine-top-b', '--spine-bottom-a', '--spine-bottom-b'].forEach(v => {
        const value = preview.style.getPropertyValue(v);
        if (value) fx.style.setProperty(v, value);
    });
    document.body.appendChild(fx);
    preview.style.visibility = 'hidden';
    fx.querySelector('.ob-cover').animate([
        { transform: `rotateY(${startAngle}deg)` },
        { transform: 'rotateY(-175deg)', offset: 0.8 },
        { transform: COVER_OPEN }
    ], { duration: COVER_OPEN_MS, easing: 'cubic-bezier(.3, .6, .4, 1)', fill: 'forwards' });
}

// Swing the cover shut and remove the copy (instantly if `instant`).
function closeBookFx(instant) {
    const fx = document.getElementById('open-book-fx');
    const preview = document.getElementById('preview-book');
    const reset = () => {
        if (fx) fx.remove();
        preview.style.visibility = '';
    };
    if (!fx) {
        preview.style.visibility = '';
        return;
    }
    if (instant || prefersReducedMotion()) {
        reset();
        return;
    }
    fx.querySelector('.ob-cover').animate([
        { transform: COVER_OPEN, easing: 'cubic-bezier(.5, 0, .9, .6)' },
        { transform: 'rotateY(0deg)', offset: 0.55, easing: 'ease-out' },
        { transform: 'rotateY(-16deg)', offset: 0.7, easing: 'ease-in' },
        { transform: 'rotateY(0deg)', offset: 0.82, easing: 'ease-out' },
        { transform: 'rotateY(-5deg)', offset: 0.91, easing: 'ease-in' },
        { transform: 'rotateY(0deg)' }
    ], { duration: COVER_CLOSE_MS, fill: 'forwards' });
    setTimeout(reset, COVER_CLOSE_MS);
}

// instant reset (also used when the edit window closes)
function hideLibraryCard() {
    clearTimeout(libraryCardTimer);
    libraryCardClosing = false;
    libraryCardBusy = false;
    closeBookFx(true);
    const overlay = document.getElementById('library-card-overlay');
    overlay.classList.remove('open');
    overlay.getAnimations().forEach(a => a.cancel());
    document.getElementById('library-card').getAnimations().forEach(a => a.cancel());
}

// slide the card back down into its pocket, then fade away
function closeLibraryCard() {
    if (libraryCardClosing || libraryCardBusy) return;
    if (prefersReducedMotion()) {
        hideLibraryCard();
        return;
    }
    libraryCardClosing = true;
    document.getElementById('library-card').animate([
        { transform: 'translateY(0)' },
        { transform: 'translateY(240px)' }
    ], { duration: 300, easing: 'ease-in', fill: 'forwards' });
    document.getElementById('library-card-overlay').animate([{ opacity: 1 }, { opacity: 0 }],
        { duration: 150, delay: 280, fill: 'forwards' });
    setTimeout(() => {
        const overlay = document.getElementById('library-card-overlay');
        overlay.classList.remove('open');
        overlay.getAnimations().forEach(a => a.cancel());
        document.getElementById('library-card').getAnimations().forEach(a => a.cancel());
        // ...and the cover swings shut
        closeBookFx(false);
        setTimeout(() => { libraryCardClosing = false; }, COVER_CLOSE_MS);
    }, 440);
}

// ---------- Reading dates (started / finished) ----------

// Dates are stored as partial ISO strings - "2024", "2024-03", or
// "2024-03-15" - so a book can have just a year or a month. Grouping
// for a books-per-month/year chart is then just a prefix slice.
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
const DATE_FIELDS = ['started', 'finished'];

function populateDateMonthSelects() {
    DATE_FIELDS.forEach(field => {
        const select = document.getElementById(`${field}-month`);
        if (select.options.length) return;
        select.innerHTML = `<option value="">month</option>` +
            MONTH_NAMES.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('');
    });
}

function parsePartialDate(value) {
    const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(value || "");
    if (!match) return { year: "", month: "", day: "" };
    return {
        year: match[1],
        month: match[2] ? String(parseInt(match[2], 10)) : "",
        day: match[3] ? String(parseInt(match[3], 10)) : ""
    };
}

function setDateField(field, value) {
    const { year, month, day } = parsePartialDate(value);
    document.getElementById(`${field}-year`).value = year;
    document.getElementById(`${field}-month`).value = month;
    document.getElementById(`${field}-day`).value = day;
    updateDateFieldState(field);
}

function setDateFieldToday(field) {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    setDateField(field, `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
}

// Day only makes sense once there's a month; keep it disabled (and
// clamp its max to that month's length) so "day with no month" can't
// be entered in the first place.
function updateDateFieldState(field) {
    const year = parseInt(document.getElementById(`${field}-year`).value, 10);
    const month = parseInt(document.getElementById(`${field}-month`).value, 10);
    const dayInput = document.getElementById(`${field}-day`);
    dayInput.disabled = !month;
    if (!month) dayInput.value = "";
    dayInput.max = month ? new Date(Number.isFinite(year) ? year : 2000, month, 0).getDate() : 31;
}

// Returns { value } with the partial date string ("" if blank), or
// { error } describing what's wrong.
function readDateField(field, label) {
    const yearRaw = document.getElementById(`${field}-year`).value.trim();
    const month = parseInt(document.getElementById(`${field}-month`).value, 10);
    const dayRaw = document.getElementById(`${field}-day`).value.trim();

    if (!yearRaw) {
        return month || dayRaw ? { error: `Please add a year for the ${label} date.` } : { value: "" };
    }
    const year = parseInt(yearRaw, 10);
    if (!/^\d{4}$/.test(yearRaw)) return { error: `The ${label} year should be 4 digits, like 2024.` };
    if (!month) return { value: String(year) };

    const pad = n => String(n).padStart(2, '0');
    if (!dayRaw) return { value: `${year}-${pad(month)}` };

    const day = parseInt(dayRaw, 10);
    const daysInMonth = new Date(year, month, 0).getDate();
    if (!Number.isInteger(day) || day < 1 || day > daysInMonth) {
        return { error: `${MONTH_NAMES[month - 1]} ${year} doesn't have a day ${dayRaw}.` };
    }
    return { value: `${year}-${pad(month)}-${pad(day)}` };
}

// ---------- Notes (notepad) ----------

// size/shift are in cqw (% of the paper's width) - tuned per font so
// each one's letters rest on the paper's ruled lines (see #notepad-text).
const NOTE_FONTS = [
    { name: 'Caveat', size: 5.6, shift: 1.04 },
    { name: 'Indie Flower', size: 5.0, shift: 1.6 },
    { name: 'Homemade Apple', size: 3.8, shift: 0.8 },
    { name: 'Nanum Pen Script', size: 6.4, shift: 1.5 },
    { name: 'Shadows Into Light', size: 4.9, shift: 1.0 },
    { name: 'Gloria Hallelujah', size: 4.2, shift: 1.0 },
    // typed, not handwritten - falls back to monospace, not cursive
    { name: 'Special Elite', size: 4.2, shift: 1.6, fallback: 'monospace' }
];
const LAST_NOTE_FONT_KEY = 'bookShelfLastNoteFont';

function getNoteFont(name) {
    return NOTE_FONTS.find(f => f.name === name) || NOTE_FONTS[0];
}

// CSS font-family value for a note font, with its own fallback
function noteFontStack(font) {
    return `'${font.name}', ${font.fallback || 'cursive'}`;
}

// font new notes start in: the Settings choice, else the last one used
function getLastNoteFont() {
    if (appSettings.noteFont) return getNoteFont(appSettings.noteFont).name;
    try {
        return getNoteFont(localStorage.getItem(LAST_NOTE_FONT_KEY)).name;
    } catch (e) {
        return NOTE_FONTS[0].name;
    }
}

function setNotes(notes, font) {
    document.getElementById('book-notes').value = notes;
    document.getElementById('book-notes-font').value = getNoteFont(font || getLastNoteFont()).name;
    document.getElementById('modal-notes-btn').innerHTML =
        notes.trim() ? '&#9998; Edit Notes' : '&#9998; Add Notes';
    document.getElementById('preview-notes-peek').classList.toggle('visible', !!notes.trim());
}

function applyNotepadFont(name) {
    const font = getNoteFont(name);
    const text = document.getElementById('notepad-text');
    text.dataset.font = font.name;
    text.style.setProperty('--np-font', noteFontStack(font));
    text.style.setProperty('--np-size', font.size + 'cqw');
    text.style.setProperty('--np-shift', font.shift + 'cqw');
    document.querySelectorAll('.notepad-font-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.font === font.name);
    });
}

function renderNotepadFontButtons() {
    const row = document.getElementById('notepad-fonts');
    if (row.childElementCount) return;
    NOTE_FONTS.forEach(font => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'notepad-font-btn';
        btn.dataset.font = font.name;
        btn.style.fontFamily = noteFontStack(font);
        btn.innerText = font.name;
        btn.addEventListener('click', () => {
            applyNotepadFont(font.name);
            document.getElementById('notepad-text').focus();
        });
        row.appendChild(btn);
    });
}

// Offset that moves the notepad's centre onto `el`'s centre - the
// notepad flies out of (and back into) whatever opened it.
function offsetToElement(el) {
    const pad = document.querySelector('.notepad-wrap').getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return {
        dx: (r.left + r.width / 2) - (pad.left + pad.width / 2),
        dy: (r.top + r.height / 2) - (pad.top + pad.height / 2)
    };
}

let notepadOrigin = null;
let notepadClosing = false;

// fromEl: the peeking paper or the Add/Edit Notes button
function openNotepad(fromEl) {
    renderNotepadFontButtons();
    const text = document.getElementById('notepad-text');
    text.value = document.getElementById('book-notes').value;
    applyNotepadFont(document.getElementById('book-notes-font').value);
    notepadOrigin = fromEl || document.getElementById('modal-notes-btn');

    const showPad = () => {
        document.getElementById('notepad-modal').style.display = 'flex';
        text.focus();
        if (prefersReducedMotion()) return;
        const { dx, dy } = offsetToElement(notepadOrigin);
        document.querySelector('.notepad-wrap').animate([
            { transform: `translate(${dx}px, ${dy}px) scale(0.12) rotate(10deg)`, opacity: 0.4 },
            { transform: 'none', opacity: 1 }
        ], { duration: 450, easing: 'cubic-bezier(.2, .8, .3, 1.05)' });
    };

    const peek = document.getElementById('preview-notes-peek');
    if (notepadOrigin === peek && !prefersReducedMotion()) {
        // slide the paper the rest of the way out from behind the book,
        // then the notepad unfolds from where it was
        peek.animate([
            { transform: 'rotate(14deg) translate(4px, -4px)' },
            { transform: 'rotate(22deg) translate(26px, -46px) scale(1.25)', opacity: 0 }
        ], { duration: 220, easing: 'ease-in' });
        setTimeout(showPad, 220); // timer, not onfinish - see closeNotepad
    } else {
        showPad();
    }
}

async function closeNotepad() {
    if (notepadClosing) return;
    const notes = document.getElementById('notepad-text').value;
    const font = document.getElementById('notepad-text').dataset.font;
    setNotes(notes, font);

    // tuck the notepad back where it came from - into the peeking paper
    // if the book has notes now, otherwise back into the Notes button
    const modal = document.getElementById('notepad-modal');
    const peek = document.getElementById('preview-notes-peek');
    const target = peek.classList.contains('visible') ? peek : document.getElementById('modal-notes-btn');
    if (!prefersReducedMotion()) {
        notepadClosing = true;
        const { dx, dy } = offsetToElement(target);
        document.querySelector('.notepad-wrap').animate([
            { transform: 'none', opacity: 1 },
            { transform: `translate(${dx}px, ${dy}px) scale(0.12) rotate(10deg)`, opacity: 0.3 }
        ], { duration: 320, easing: 'cubic-bezier(.5, 0, .8, .4)', fill: 'forwards' });
        // a timer rather than awaiting .finished, which can stall if the
        // tab is hidden mid-animation and leave the notepad stuck open
        await new Promise(r => setTimeout(r, 320));
        notepadClosing = false;
    }
    modal.style.display = 'none';
    // drop the held "tucked away" pose so the next open starts fresh
    document.querySelector('.notepad-wrap').getAnimations().forEach(a => a.cancel());
    if (target === peek && !prefersReducedMotion()) {
        peek.animate([
            { transform: 'rotate(22deg) translate(26px, -46px)', opacity: 0 },
            { transform: 'rotate(10deg)', opacity: 1 }
        ], { duration: 260, easing: 'cubic-bezier(.2, .8, .3, 1.2)' });
    }
    try { localStorage.setItem(LAST_NOTE_FONT_KEY, font); } catch (e) {}

    // For a book already on the shelf, save the notes right away -
    // otherwise closing the edit window with Cancel/X would silently
    // throw away everything just written.
    const existing = editingId ? library.find(b => b.id === editingId) : null;
    if (existing && ((existing.notes || "") !== notes || existing.notesFont !== font)) {
        existing.notes = notes;
        existing.notesFont = font;
        await dbPut(existing);
    }
}


// Wiggle the preview book for the big moments only - changing status
// or putting on a new cover. Suppressed while the window is first
// being filled in.
let suppressPreviewWiggle = false;
let previewWiggleTimer = null;

function wigglePreview() {
    if (suppressPreviewWiggle || prefersReducedMotion()) return;
    clearTimeout(previewWiggleTimer);
    previewWiggleTimer = setTimeout(() => {
        const wrap = document.getElementById('preview-book-wrap');
        wrap.classList.remove('wiggle');
        void wrap.offsetWidth; // restart the animation
        wrap.classList.add('wiggle');
    }, 200);
}

function selectStatus(status) {
    document.getElementById('book-status').value = status;
    document.querySelectorAll('.status-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.status === status);
    });
    document.getElementById('preview-sticker').classList.toggle('visible', status === 'Reading');
}

// A status button click (vs. selectStatus, which openModal also uses
// just to fill the form in).
function pickStatus(status, btn) {
    const previous = document.getElementById('book-status').value;
    selectStatus(status);
    wigglePreview();
    if (status === 'Read' && previous !== 'Read') {
        confettiFrom(btn);
        if (!document.getElementById('finished-year').value.trim()) {
            setDateFieldToday('finished');
        }
    }
}

function setOwned(owned) {
    document.getElementById('book-owned').checked = owned;
    document.getElementById('owned-toggle-btn').classList.toggle('active', owned);
}

function toggleOwned() {
    setOwned(!document.getElementById('book-owned').checked);
}

function updateRatingStarsUI(rating) {
    document.querySelectorAll('#rating-stars .star-btn').forEach(star => {
        star.classList.toggle('filled', parseInt(star.dataset.star) <= rating);
    });
}

function setRating(n) {
    const current = parseInt(document.getElementById('book-rating').value) || 0;
    // clicking the already-selected star clears the rating, so there's
    // a way to unrate a book without a separate "clear" control.
    const newRating = current === n ? 0 : n;
    document.getElementById('book-rating').value = newRating;
    updateRatingStarsUI(newRating);

    if (newRating > 0) {
        const stars = [...document.querySelectorAll('#rating-stars .star-btn')];
        if (newRating === 5) {
            // a little extra for a 5-star book: every star sparkles
            stars.forEach(star => sparkleFrom(star, 6));
        } else {
            sparkleFrom(stars[newRating - 1]);
        }
    }
}

function previewRating(n) {
    const current = parseInt(document.getElementById('book-rating').value) || 0;
    updateRatingStarsUI(n === null ? current : n);
}

function updateFileNameDisplay() {
    const input = document.getElementById('book-image');
    const display = document.getElementById('file-name-display');
    display.innerText = (input.files && input.files[0]) ? input.files[0].name : "No file chosen";
}

function updateSpineFileNameDisplay() {
    const input = document.getElementById('book-spine-image');
    const display = document.getElementById('spine-file-name-display');
    display.innerText = (input.files && input.files[0]) ? input.files[0].name : "No file chosen";
    if (input.files && input.files[0]) {
        clearSpineImageFlag = false;
    }
}

function handleCoverFileSelected() {
    updateFileNameDisplay();
    const input = document.getElementById('book-image');
    if (input.files && input.files[0]) {
        readFileAsDataURL(input.files[0]).then(dataUrl => openCropModal(dataUrl, 'cover'));
    } else {
        pendingCoverCrop = null;
        updatePreview();
    }
}

function handleSpineFileSelected() {
    updateSpineFileNameDisplay();
    const input = document.getElementById('book-spine-image');
    if (input.files && input.files[0]) {
        readFileAsDataURL(input.files[0]).then(dataUrl => openCropModal(dataUrl, 'spine'));
    } else {
        pendingSpineCrop = null;
    }
}

function clearSpineImage() {
    clearSpineImageFlag = true;
    pendingSpineCrop = null;
    document.getElementById('book-spine-image').value = "";
    document.getElementById('spine-file-name-display').innerText = "No file chosen";
    document.getElementById('existing-spine-image-note').style.display = 'none';
    document.getElementById('clear-spine-image-btn').style.display = 'none';
}

// how far along the Cover Width slider's track the gradient fills
function updateWidthSliderFill() {
    const slider = document.getElementById('book-width');
    const pct = (slider.value - slider.min) / (slider.max - slider.min) * 100;
    slider.style.setProperty('--fill', pct + '%');
}

// the edit window's preview book is drawn smaller on phones
function previewScale() {
    return phoneQuery && phoneQuery.matches ? 0.85 : 1;
}

function updatePreview() {
    const previewBook = document.getElementById('preview-book');
    const titleEl = document.getElementById('preview-book-title');
    const title = document.getElementById('book-title').value.trim() || 'Book Title';
    const color = document.getElementById('book-color').value;
    const width = document.getElementById('book-width').value;

    // (phones: bigger than before, but never so wide it can't sit beside the buttons)
    previewBook.style.width = Math.round(previewScale() < 1 ? Math.min(width * previewScale(), 130) : width) + 'px';
    const ratioPreset = document.getElementById('book-ratio-preset').value;

    const applyImage = async (src) => {
        previewBook.style.backgroundImage = `url(${src})`;
        previewBook.style.aspectRatio = ratioPreset || (await getImageAspectRatio(src) || '2 / 3');
        applyPreviewSpineVars(await getImageEdgeColor(src) || color);
        titleEl.innerText = '';
    };
    const applyColor = () => {
        previewBook.style.backgroundImage = 'none';
        previewBook.style.backgroundColor = color;
        previewBook.style.aspectRatio = '2 / 3';
        applyPreviewSpineVars(color);
        titleEl.innerText = title;
    };

    if (pendingCoverCrop) {
        applyImage(pendingCoverCrop);
    } else {
        const existing = editingId ? library.find(b => b.id === editingId) : null;
        if (existing && existing.image) {
            applyImage(existing.image);
        } else {
            applyColor();
        }
    }
}

function closeModal() {
    document.getElementById('book-modal').style.display = 'none';
    editingId = null;
    hideLibraryCard();
    slidePulledBookBack();
}

// ---------- Crop modal ----------

function openCropModal(dataUrl, context) {
    cropContext = context;
    document.getElementById('crop-modal').style.display = 'flex';
    const img = document.getElementById('crop-image');
    img.onload = () => {
        cropNaturalWidth = img.naturalWidth;
        cropNaturalHeight = img.naturalHeight;
        const rect = img.getBoundingClientRect();
        // Start with the whole image selected - cropping is opt-in, not
        // forced, so doing nothing still uses the full picture.
        cropBoxState = { x: 0, y: 0, w: rect.width, h: rect.height };
        renderCropBox();
    };
    img.src = dataUrl;
}

function renderCropBox() {
    const box = document.getElementById('crop-box');
    box.style.left = cropBoxState.x + 'px';
    box.style.top = cropBoxState.y + 'px';
    box.style.width = cropBoxState.w + 'px';
    box.style.height = cropBoxState.h + 'px';
}

function clampCrop(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function startCropDrag(e, mode) {
    e.preventDefault();
    e.stopPropagation();
    cropDrag = {
        mode,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startBox: { ...cropBoxState }
    };
    e.target.setPointerCapture(e.pointerId);
}

function onCropPointerMove(e) {
    if (!cropDrag) return;
    const img = document.getElementById('crop-image');
    const rect = img.getBoundingClientRect();
    const maxW = rect.width;
    const maxH = rect.height;
    const dx = e.clientX - cropDrag.startClientX;
    const dy = e.clientY - cropDrag.startClientY;
    const start = cropDrag.startBox;
    let { x, y, w, h } = start;

    if (cropDrag.mode === 'move') {
        x = clampCrop(start.x + dx, 0, maxW - start.w);
        y = clampCrop(start.y + dy, 0, maxH - start.h);
    } else {
        if (cropDrag.mode.includes('n')) {
            y = clampCrop(start.y + dy, 0, start.y + start.h - CROP_MIN_SIZE);
            h = start.h - (y - start.y);
        }
        if (cropDrag.mode.includes('s')) {
            h = clampCrop(start.h + dy, CROP_MIN_SIZE, maxH - start.y);
        }
        if (cropDrag.mode.includes('w')) {
            x = clampCrop(start.x + dx, 0, start.x + start.w - CROP_MIN_SIZE);
            w = start.w - (x - start.x);
        }
        if (cropDrag.mode.includes('e')) {
            w = clampCrop(start.w + dx, CROP_MIN_SIZE, maxW - start.x);
        }
    }

    cropBoxState = { x, y, w, h };
    renderCropBox();
}

function onCropPointerUp() {
    cropDrag = null;
}

window.addEventListener('pointermove', onCropPointerMove);
window.addEventListener('pointerup', onCropPointerUp);

function confirmCrop() {
    const img = document.getElementById('crop-image');
    const rect = img.getBoundingClientRect();
    const scaleX = cropNaturalWidth / rect.width;
    const scaleY = cropNaturalHeight / rect.height;

    const sx = Math.round(cropBoxState.x * scaleX);
    const sy = Math.round(cropBoxState.y * scaleY);
    const sw = Math.round(cropBoxState.w * scaleX);
    const sh = Math.round(cropBoxState.h * scaleY);

    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    applyCropResult(canvas.toDataURL('image/png'));
}

function useFullImageForCrop() {
    applyCropResult(document.getElementById('crop-image').src);
}

function applyCropResult(dataUrl) {
    if (cropContext === 'cover') {
        pendingCoverCrop = dataUrl;
    } else if (cropContext === 'spine') {
        pendingSpineCrop = dataUrl;
    }
    closeCropModal();
    updatePreview();
    if (pendingCoverCrop === dataUrl) wigglePreview(); // new cover, not a spine photo
}

function cancelCrop() {
    // Cancel abandons the upload entirely, not just the crop - there's
    // no "keep the uncropped picture" state once the cropper's open.
    if (cropContext === 'cover') {
        document.getElementById('book-image').value = '';
        document.getElementById('file-name-display').innerText = 'No file chosen';
        pendingCoverCrop = null;
    } else if (cropContext === 'spine') {
        document.getElementById('book-spine-image').value = '';
        document.getElementById('spine-file-name-display').innerText = 'No file chosen';
        pendingSpineCrop = null;
    }
    closeCropModal();
}

function closeCropModal() {
    document.getElementById('crop-modal').style.display = 'none';
    cropContext = null;
    cropDrag = null;
}

function getImageAspectRatio(dataUrl) {
    // Clamped to a book-like range so the spine/page-edge 3D effects
    // (tuned with fixed px values assuming a roughly book-shaped box)
    // still look right - an extreme landscape image gets held to a
    // normal book proportion instead of going stubby. Upper bound is
    // 1 (square), not narrower - a genuinely square cover (e.g. a
    // reference book like "The Elements") should display as square,
    // not get squeezed into "nearly square".
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const raw = img.naturalWidth / img.naturalHeight;
            resolve(Math.min(Math.max(raw, 0.45), 1));
        };
        img.onerror = () => resolve(null);
        img.src = dataUrl;
    });
}

function getSpineImageAspectRatio(dataUrl) {
    // A real spine photo is much narrower than a front cover - a 0.45-1
    // clamp (tuned for covers) would badly distort it. Clamp to a
    // believable thin-to-thick spine range instead.
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const raw = img.naturalWidth / img.naturalHeight;
            resolve(Math.min(Math.max(raw, 0.04), 0.6));
        };
        img.onerror = () => resolve(null);
        img.src = dataUrl;
    });
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function srgbToLinear(c) {
    const cs = c / 255;
    return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c) {
    const cl = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, cl)) * 255);
}

function getImageEdgeColor(dataUrl) {
    // Samples a thin strip along the image's left edge (the side that
    // touches the spine) and averages it, so the spine can be colored
    // to match whatever's actually drawn right next to it. Averaging is
    // done in linear light (not raw sRGB bytes) - sRGB is gamma-encoded,
    // so a naive byte average of a strip with mixed light/dark pixels
    // comes out noticeably darker than the strip actually looks.
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            try {
                const sampleWidth = Math.max(1, Math.min(6, img.naturalWidth));
                const canvas = document.createElement('canvas');
                canvas.width = sampleWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, sampleWidth, img.naturalHeight, 0, 0, sampleWidth, img.naturalHeight);
                const data = ctx.getImageData(0, 0, sampleWidth, img.naturalHeight).data;
                let r = 0, g = 0, b = 0, count = 0;
                for (let i = 0; i < data.length; i += 4) {
                    r += srgbToLinear(data[i]);
                    g += srgbToLinear(data[i + 1]);
                    b += srgbToLinear(data[i + 2]);
                    count++;
                }
                if (!count) { resolve(null); return; }
                resolve(`rgb(${linearToSrgb(r / count)}, ${linearToSrgb(g / count)}, ${linearToSrgb(b / count)})`);
            } catch (e) {
                resolve(null);
            }
        };
        img.onerror = () => resolve(null);
        img.src = dataUrl;
    });
}

function parseColorToRgb(color) {
    if (!color) return null;
    if (color.startsWith('#')) {
        const hex = color.slice(1);
        const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
        const num = parseInt(full, 16);
        if (isNaN(num)) return null;
        return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
    }
    const match = color.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
    if (match) {
        return { r: +match[1], g: +match[2], b: +match[3] };
    }
    return null;
}

// The preview's spine is drawn by the page under the cover (see
// .preview-under-page), so its colours go on the wrapper too.
function applyPreviewSpineVars(spineBase) {
    applySpineVars(document.getElementById('preview-book'), spineBase);
    applySpineVars(document.getElementById('preview-book-wrap'), spineBase);
}

function applySpineVars(el, spineBase) {
    if (!spineBase) return;
    el.style.setProperty('--spine-top-a', darkenColor(spineBase, 1) || spineBase);
    el.style.setProperty('--spine-top-b', darkenColor(spineBase, 0.8) || spineBase);
    el.style.setProperty('--spine-bottom-a', darkenColor(spineBase, 0.65) || spineBase);
    el.style.setProperty('--spine-bottom-b', darkenColor(spineBase, 0.5) || spineBase);
}

function darkenColor(color, factor) {
    // Scaling the raw sRGB byte by `factor` isn't the same as scaling
    // brightness by that much - sRGB is gamma-encoded, so e.g. factor
    // 0.5 on the byte crushes it to ~19% of its actual linear-light
    // brightness instead of 50%. Scale in linear light, then re-encode.
    const rgb = parseColorToRgb(color);
    if (!rgb) return null;
    const r = linearToSrgb(srgbToLinear(rgb.r) * factor);
    const g = linearToSrgb(srgbToLinear(rgb.g) * factor);
    const b = linearToSrgb(srgbToLinear(rgb.b) * factor);
    return `rgb(${r}, ${g}, ${b})`;
}

async function processBookForm() {
    const title = document.getElementById('book-title').value.trim();
    const rawAuthors = document.getElementById('book-author').value.split(',').map(a => a.trim()).filter(Boolean);
    const authors = rawAuthors.length ? rawAuthors : ["Unknown"];
    const series = document.getElementById('book-series').value.trim();
    const seriesNumberRaw = document.getElementById('book-series-number').value;
    const seriesNumber = seriesNumberRaw === "" ? null : parseInt(seriesNumberRaw);
    const seriesTotalRaw = document.getElementById('book-series-total').value;
    const seriesTotal = seriesTotalRaw === "" ? null : parseInt(seriesTotalRaw);
    const status = document.getElementById('book-status').value;
    const rating = parseInt(document.getElementById('book-rating').value) || 0;
    const genre = document.getElementById('book-genre').value;
    const color = document.getElementById('book-color').value;
    recordRecentColor(color);
    const width = parseInt(document.getElementById('book-width').value);
    const ratioPresetRaw = document.getElementById('book-ratio-preset').value;
    const ratioPreset = ratioPresetRaw ? parseFloat(ratioPresetRaw) : null;
    commitTagEntry(); // a half-typed tag still counts when you hit Save
    const tags = document.getElementById('book-tags').value.split(',').map(t => t.trim()).filter(Boolean).map(capitalizeTag);
    const owned = document.getElementById('book-owned').checked;
    const notes = document.getElementById('book-notes').value;
    const notesFont = document.getElementById('book-notes-font').value;

    if (!title) {
        alert('Please include a book title!');
        return;
    }

    const started = readDateField('started', 'started');
    const finished = readDateField('finished', 'finished');
    const dateError = started.error || finished.error;
    if (dateError) {
        alert(dateError);
        return;
    }
    const startedDate = started.value;
    const finishedDate = finished.value;
    // Compare only as precisely as both dates allow - "2024" vs
    // "2024-03-10" can't be ordered, but "2023" vs "2024-03" can.
    if (startedDate && finishedDate) {
        const len = Math.min(startedDate.length, finishedDate.length);
        if (finishedDate.slice(0, len) < startedDate.slice(0, len)) {
            alert('The finished date is before the started date.');
            return;
        }
    }

    const existing = editingId ? library.find(b => b.id === editingId) : null;

    let image = null, imageRatio = null;
    if (pendingCoverCrop) {
        image = pendingCoverCrop;
        imageRatio = await getImageAspectRatio(image);
    }

    let spineImageChanged = false;
    let spineImage = "";
    let spineImageRatio = null;
    if (pendingSpineCrop) {
        spineImage = pendingSpineCrop;
        spineImageRatio = await getSpineImageAspectRatio(spineImage);
        spineImageChanged = true;
    } else if (clearSpineImageFlag) {
        spineImageChanged = true;
    }

    const finalImage = image !== null ? image : (existing ? existing.image : "");
    let finalRatio = image !== null ? imageRatio : (existing ? existing.imageRatio : null);
    if (finalImage && !finalRatio) {
        // keeping an existing image that predates imageRatio tracking -
        // compute it now instead of leaving the shelf stuck on the old
        // fixed 2:3 box forever.
        finalRatio = await getImageAspectRatio(finalImage);
    }
    if (finalImage && ratioPreset) {
        finalRatio = ratioPreset;
    }

    // spine color: for a solid-color book, just use that color; for
    // a cover image, sample its left edge (the side touching the
    // spine) so the spine looks like it belongs to that cover.
    let finalSpineColor;
    if (finalImage) {
        finalSpineColor = image !== null
            ? (await getImageEdgeColor(finalImage) || color)
            : ((existing && existing.spineColor) || await getImageEdgeColor(finalImage) || color);
    } else {
        finalSpineColor = color;
    }

    const finalSpineImage = spineImageChanged ? spineImage : (existing ? (existing.spineImage || "") : "");
    const finalSpineImageRatio = spineImageChanged ? spineImageRatio : (existing ? (existing.spineImageRatio || null) : null);

    // how long a book has sat in its current status (drives dust)
    const statusSince = (!existing || existing.status !== status || !existing.statusSince)
        ? Date.now() : existing.statusSince;
    const dustedAt = existing ? (existing.dustedAt || null) : null;
    // a to-get note given a look of its own (cover color, size, shape,
    // spine or cover image) has been got: it becomes a regular book
    const hex = c => {
        c = String(c || '').toLowerCase();
        return /^#[0-9a-f]{3}$/.test(c) ? '#' + [...c.slice(1)].map(d => d + d).join('') : c;
    };
    const restyled = existing && (
        hex(color) !== hex(existing.color) ||
        width !== (Number.isFinite(existing.width) ? existing.width : 120) ||
        (ratioPreset || null) !== (existing.ratioPreset || null) ||
        (!!finalSpineImage && finalSpineImage !== (existing.spineImage || '')) ||
        (!!finalImage && finalImage !== (existing.image || '')));
    const stickyNote = existing ? !!existing.stickyNote && !restyled : false;

    const book = {
        id: editingId || Date.now().toString(),
        title, authors, series, seriesNumber, seriesTotal, status, rating, genre, color, width, tags, owned, notes, notesFont, startedDate, finishedDate,
        statusSince, dustedAt, stickyNote,
        sortOrder: existing && Number.isFinite(existing.sortOrder)
            ? existing.sortOrder
            : library.reduce((max, b) => Math.max(max, Number.isFinite(b.sortOrder) ? b.sortOrder : -1), -1) + 1,
        image: finalImage,
        imageRatio: finalImage ? finalRatio : null,
        ratioPreset: finalImage ? ratioPreset : null,
        spineColor: finalSpineColor,
        spineImage: finalSpineImage,
        spineImageRatio: finalSpineImage ? finalSpineImageRatio : null
    };
    await dbPut(book);
    const idx = library.findIndex(b => b.id === book.id);
    if (idx >= 0) {
        library[idx] = book;
    } else {
        library.push(book);
    }
    clearSpineImageFlag = false;
    pendingCoverCrop = null;
    pendingSpineCrop = null;
    // got the book (owned, or a cover added): the sticky note leaves
    // like a deleted one, and the real book poofs in where it was
    const gotIt = existing && isStickyPlaceholder(existing) && !isStickyPlaceholder(book) && !prefersReducedMotion();
    let poofAt = 0;
    if (gotIt) {
        closeModal();
        poofAt = tossStickyNote(book.id) || 0;
    }
    closeModal();
    populateAuthorOptions();
    populateSeriesOptions();
    populateFilterTagSelect();
    animateLeans = true;
    renderBookshelf();
    if (gotIt) poofBookIn(book.id, poofAt);
}
