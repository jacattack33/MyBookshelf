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
        `<button type="button" class="recent-color-swatch" style="background:${c}; --swatch:${c};" onclick="pickRecentColor('${c}')" title="${c}"></button>`
    ).join('');
}

function pickRecentColor(color) {
    document.getElementById('book-color').value = color;
    updatePreview();
    if (!document.getElementById('color-pop').hidden) {
        pickerHsv = hexToHsv(color, pickerHsv.h);
        renderColorPicker();
    }
}

// ---------- Colour picker ----------
// Our own, opened from the colour circle in place of the browser's: each
// browser draws its own (Firefox on phones has no custom colour at all),
// and this one looks and works the same everywhere. The circle (a real
// <input type="color">) still holds the colour, so everything that reads
// it is unchanged.

// colours to start from, picked by hand for each theme: book-cover-ish,
// in that theme's own colours
const PICKER_PALETTES = {
    candy: ['#ff6fb0', '#ff2e93', '#ff9eb0', '#ffdcee', '#b57bff', '#8a4fe0', '#c9a6ff', '#4a2378',
        '#9fdcff', '#2b4a7e', '#5fe8c4', '#a0eab5', '#ffe066', '#fff6c2', '#ffb48c', '#7a1f5c'],
    seaglass: ['#14303f', '#1f3b4d', '#335c67', '#1f6f78', '#2a8c96', '#5fb8ad', '#9fc9c1', '#a7d7c5',
        '#3d7a5e', '#5a8fd6', '#7aa6c2', '#cfe2f2', '#e1f1ee', '#d9c7a0', '#f0a07a', '#e6efe9'],
    holo: ['#14161f', '#2b2f4a', '#4a5070', '#8e96ad', '#c0c6d6', '#e8e8f0', '#a6b1e1', '#9a7fd1',
        '#d6c1f0', '#e0b0ff', '#f2c1d6', '#ffd1e8', '#b8f2e6', '#6fc2b8', '#7fd1e8', '#b0e0ff'],
    library: ['#1a1410', '#2b1d14', '#4a3b2a', '#6b4a2b', '#a0522d', '#5c1f1a', '#7a2e1f', '#6b1e3b',
        '#3b2b4a', '#1a2b4a', '#2e4a4a', '#1f3a2b', '#3d5a3a', '#8a6a2a', '#c9a227', '#e8dcc0'],
    deco: ['#111111', '#2b2b2b', '#3a3a3a', '#14213d', '#2e5e6e', '#0f5c4a', '#1f4d3a', '#4a3b6b',
        '#5c1f3a', '#7a1f2b', '#b87333', '#8a7a4a', '#c9a227', '#e6c869', '#e8dcc0', '#f5ecd6'],
    loft: ['#1c2c3c', '#24272b', '#4a4f55', '#5a5047', '#7a8087', '#9aa5ad', '#a89f91', '#c9c4ba',
        '#e8e4dc', '#3d5a6b', '#2f4f4f', '#6b7f5a', '#8a3b2b', '#b87333', '#d4925a', '#c2a878'],
    blueprint: ['#0e1f3a', '#13294b', '#1f3a6e', '#2b5a8a', '#3d6a96', '#4a6380', '#5b7fa6', '#7aa6d6',
        '#8fb3d9', '#cfe0f2', '#d9e6f2', '#ffffff', '#f8c88a', '#e07a2b', '#c45a1a', '#a8420c'],
    terminal: ['#002200', '#0a1a0a', '#1c2b1c', '#1a3a2a', '#2f4f2f', '#3d7a3d', '#4a6b4a', '#5fbf5f',
        '#88aa88', '#9fdf9f', '#33ff66', '#7fff9f', '#c8ffc8', '#d8ffd8', '#ffb000', '#ff8c00'],
    typewriter: ['#111111', '#2b2b2b', '#4a4a4a', '#7a7a7a', '#a89a7a', '#d9c9a3', '#ece3cf', '#f5efe0',
        '#b5121b', '#7a0e14', '#4a1f1f', '#5c4a2b', '#8a7a5a', '#2b3d2b', '#1a2b4a', '#3a4f6b'],
    sunset: ['#ffcf87', '#ffd23f', '#ffb347', '#ff7a3d', '#e8401c', '#d40848', '#ff8fa3', '#f7a8b8',
        '#ffe6d0', '#c96b9a', '#a3086b', '#7a4fa0', '#6b1e7a', '#3d0a33', '#2a1b5c', '#14213d'],
    plain: ['#1a1a1a', '#3a3a3a', '#8a8a8a', '#d9d4c7', '#f2efe8', '#34495e', '#4f6d8a', '#1f3a6e',
        '#2e6b6b', '#5b7d63', '#7564a8', '#7a1f2b', '#b4643f', '#a3471b', '#5c4a3a', '#c9a227']
};

function pickerPalette() {
    const theme = document.documentElement.dataset.theme || 'candy';
    return PICKER_PALETTES[theme === 'plainbold' ? 'plain' : theme] || PICKER_PALETTES.candy;
}

let pickerHsv = { h: 0, s: 0, v: 0 };
let pickerDrag = null; // 'sv' or 'hue' while dragging

function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hexToHsv(hex, keepHue = 0) {
    const [r, g, b] = hexToRgb(hex).map(c => c / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = keepHue; // (a grey has no hue: keep the one it had)
    if (d) {
        if (max === r) h = 60 * (((g - b) / d) % 6);
        else if (max === g) h = 60 * ((b - r) / d + 2);
        else h = 60 * ((r - g) / d + 4);
        if (h < 0) h += 360;
    }
    return { h, s: max ? d / max : 0, v: max };
}

function hsvToHex({ h, s, v }) {
    const f = n => {
        const k = (n + h / 60) % 6;
        return Math.round(255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))));
    };
    return '#' + [f(5), f(3), f(1)].map(c => c.toString(16).padStart(2, '0')).join('');
}

function openColorPicker() {
    const pop = document.getElementById('color-pop');
    if (!pop.hidden) { closeColorPicker(); return; }
    // (drawn each time: the theme may have changed since)
    document.getElementById('cp-swatches').innerHTML = pickerPalette().map(c =>
        `<button type="button" class="cp-swatch" style="background:${c};" title="${c}" aria-label="${c}" onclick="pickPickerSwatch('${c}')"></button>`
    ).join('');
    pickerHsv = hexToHsv(document.getElementById('book-color').value);
    pop.hidden = false;
    renderColorPicker();
}

function closeColorPicker() {
    document.getElementById('color-pop').hidden = true;
    pickerDrag = null;
}

// the chosen colour goes into the circle, and the preview follows
function applyPickerColor(fromHexBox = false) {
    const input = document.getElementById('book-color');
    input.value = hsvToHex(pickerHsv);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    renderColorPicker(fromHexBox);
}

function renderColorPicker(keepHexBox = false) {
    const hue = `hsl(${pickerHsv.h}, 100%, 50%)`;
    document.getElementById('cp-sv').style.setProperty('--cp-hue', hue);
    const hueThumb = document.getElementById('cp-hue-thumb');
    hueThumb.style.background = hue;
    hueThumb.style.left = (pickerHsv.h / 360 * 100) + '%';
    const svThumb = document.getElementById('cp-sv-thumb');
    svThumb.style.left = (pickerHsv.s * 100) + '%';
    svThumb.style.top = ((1 - pickerHsv.v) * 100) + '%';
    document.getElementById('cp-hue').setAttribute('aria-valuenow', Math.round(pickerHsv.h));
    const hex = hsvToHex(pickerHsv);
    document.getElementById('cp-now').style.background = hex;
    if (!keepHexBox) document.getElementById('cp-hex').value = hex;
}

function pickPickerSwatch(hex) {
    pickerHsv = hexToHsv(hex, pickerHsv.h);
    applyPickerColor();
}

function typedPickerHex(text) {
    const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(text.trim());
    if (!m) return;
    let digits = m[1].toLowerCase();
    if (digits.length === 3) digits = digits.split('').map(c => c + c).join('');
    pickerHsv = hexToHsv('#' + digits, pickerHsv.h);
    applyPickerColor(true);
}

function pickerPointer(e) {
    const el = document.getElementById(pickerDrag === 'sv' ? 'cp-sv' : 'cp-hue');
    const r = el.getBoundingClientRect();
    const x = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1);
    if (pickerDrag === 'sv') {
        const y = Math.min(Math.max((e.clientY - r.top) / r.height, 0), 1);
        pickerHsv = { ...pickerHsv, s: x, v: 1 - y };
    } else {
        pickerHsv = { ...pickerHsv, h: x * 360 };
    }
    applyPickerColor();
}

['sv', 'hue'].forEach(part => {
    const el = document.getElementById('cp-' + part);
    el.addEventListener('pointerdown', e => {
        e.preventDefault();
        el.focus();
        pickerDrag = part;
        el.setPointerCapture(e.pointerId);
        pickerPointer(e);
    });
    el.addEventListener('pointermove', e => { if (pickerDrag === part) pickerPointer(e); });
    el.addEventListener('pointerup', () => { pickerDrag = null; });
    el.addEventListener('pointercancel', () => { pickerDrag = null; });
    // arrow keys nudge it (Shift for bigger steps)
    el.addEventListener('keydown', e => {
        const dx = { ArrowRight: 1, ArrowLeft: -1 }[e.key] || 0;
        const dy = { ArrowUp: 1, ArrowDown: -1 }[e.key] || 0;
        if (!dx && !dy) return;
        e.preventDefault();
        const step = e.shiftKey ? 0.1 : 0.02;
        const clamp = n => Math.min(Math.max(n, 0), 1);
        pickerHsv = part === 'sv'
            ? { ...pickerHsv, s: clamp(pickerHsv.s + dx * step), v: clamp(pickerHsv.v + dy * step) }
            : { ...pickerHsv, h: clamp(pickerHsv.h / 360 + (dx || dy) * step) * 360 };
        applyPickerColor();
    });
});

// the circle opens ours instead of the browser's
document.getElementById('book-color').addEventListener('click', e => {
    e.preventDefault();
    openColorPicker();
});

// a click anywhere else, or Escape, puts it away
document.addEventListener('pointerdown', e => {
    const pop = document.getElementById('color-pop');
    if (pop.hidden || pop.contains(e.target) || e.target.id === 'book-color') return;
    closeColorPicker();
});

document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || document.getElementById('color-pop').hidden) return;
    e.preventDefault();
    closeColorPicker();
    document.getElementById('book-color').focus();
});

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
    modalSelect.innerHTML = '<option value="" disabled hidden>Choose a genre...</option>' + groupsHTML +
        `<option value="${ADD_GENRE_VALUE}">+ Add new genre...</option>`;
    modalSelect.value = allGenres.includes(previousModalValue) ? previousModalValue : '';
    modalSelect.dataset.previous = modalSelect.value;
}

function handleGenreSelectChange() {
    const select = document.getElementById('book-genre');
    if (select.value !== ADD_GENRE_VALUE) {
        select.dataset.previous = select.value;
        return;
    }

    const name = prompt('New genre name:');
    if (!name || !name.trim()) {
        select.value = select.dataset.previous || '';
        return;
    }
    const finalName = addCustomGenre(name);
    populateGenreSelects();
    select.value = finalName;
    select.dataset.previous = finalName;
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
    closeColorPicker();

    populateGenreSelects();
    populateAuthorOptions();
    populateSeriesOptions();
    populateDateMonthSelects();
    populateFriendOptions();
    document.getElementById('book-image').value = "";
    document.getElementById('file-name-display').innerText = "No file chosen";
    document.getElementById('book-spine-image').value = "";
    document.getElementById('spine-file-name-display').innerText = "No file chosen";
    document.getElementById('book-image-url').value = "";
    document.getElementById('book-spine-image-url').value = "";
    setImageLinkError('cover', '');
    setImageLinkError('spine', '');
    clearSpineImageFlag = false;
    pendingCoverCrop = null;
    pendingSpineCrop = null;
    setPreviewFace('cover');
    // (it closes this window, so not while editing a book)
    document.getElementById('shelf-photo-link').style.display = bookId ? 'none' : '';

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
        document.getElementById('book-genre').dataset.previous = book.genre;
        document.getElementById('book-color').value = book.color || "#1a334d";
        document.getElementById('book-width').value = book.width || 120;
        document.getElementById('book-spine-width').value = Number.isFinite(book.spineWidth) ? book.spineWidth : 30;
        document.getElementById('book-spine-width').dataset.auto = Number.isFinite(book.spineWidth) ? '' : '1';
        document.getElementById('book-ratio-preset').value = book.ratioPreset || "";
        setTags(book.tags || []);
        setOwned(!!book.owned);
        setNotes(book.notes || "", book.notesFont);
        setNotes(book.notes2 || "", book.notes2Font || book.notesFont, 2);
        setDateField('started', book.startedDate);
        setDateField('finished', book.finishedDate);
        formExtraReads = (book.extraReads || []).map(r => ({ ...r }));
        document.getElementById('book-pages').value = book.pages || "";
        document.getElementById('book-rec-by').value = book.recommendedBy || "";
        setGotHow(book.gotHow || "", book.gotFrom || "");
        document.getElementById('book-no-pins').checked = !!book.noPins;
        setLentTo(book.lentTo || "", book.lentAt || null);
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
        document.getElementById('book-genre').value = "";
        document.getElementById('book-genre').dataset.previous = "";
        document.getElementById('book-color').value = "#1a334d";
        document.getElementById('book-width').value = 120;
        document.getElementById('book-spine-width').dataset.auto = '1';
        document.getElementById('book-ratio-preset').value = "0.667";
        setTags([]);
        setOwned(false);
        setNotes("");
        setNotes("", "", 2);
        setDateField('started', "");
        setDateField('finished', "");
        formExtraReads = [];
        document.getElementById('book-pages').value = "";
        document.getElementById('book-rec-by').value = "";
        setGotHow("", "");
        document.getElementById('book-no-pins').checked = !appSettings.pinNewBooks;
        setLentTo("", null);
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
    const status = document.getElementById('book-status').value;
    const stamps = {
        'Want to Read': ['ON HOLD', 'want'],
        'Reading': ['CHECKED OUT', 'reading'],
        'Read': ['RETURNED \u2713', 'read'],
        'DNF': ['DNF', 'dnf']
    };
    const [stampText, stampClass] = stamps[status] || ['', ''];
    const pages = parseInt(document.getElementById('book-pages').value, 10);
    const lentTo = document.getElementById('book-owned').checked ? document.getElementById('book-lent-to').value.trim() : '';
    const hand = libraryCardHandStyle();

    const card = document.getElementById('library-card');
    card.innerHTML = `
        <div class="lc-head">LIBRARY CARD</div>
        <div class="lc-field">Title <span class="lc-hand lc-title" style="${hand}"></span></div>
        <div class="lc-field">Author <span class="lc-hand lc-grow" style="${hand}"></span>${pages > 0 ? `<span class="lc-pages">Pages <span class="lc-hand" style="${hand}"></span></span>` : ''}</div>
        <div class="lc-rows" id="lc-rows"></div>
        <div class="lc-foot">
            <div class="lc-foot-left">
                <span class="lc-got"></span>
                <span class="lc-lent"></span>
                <span class="lc-note" id="lc-note">Click a line to write a date.</span>
            </div>
            <span class="lc-stamp ${stampClass}"></span>
        </div>`;
    // textContent (not innerHTML) for anything the user typed
    const hands = card.querySelectorAll('.lc-hand');
    hands[0].textContent = title;
    hands[1].textContent = author;
    if (pages > 0) hands[2].textContent = pages.toLocaleString();
    card.querySelector('.lc-stamp').textContent = stampText;
    card.querySelector('.lc-lent').textContent = lentTo ? `On loan to ${lentTo}` : '';
    card.querySelector('.lc-lent').style.cssText = lentTo ? hand : '';
    const got = gotLine(document.getElementById('book-got-how').value, document.getElementById('book-got-from').value.trim());
    card.querySelector('.lc-got').textContent = got;
    card.querySelector('.lc-got').style.cssText = got ? hand : '';
    renderLibraryCardRows();

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

// ---------- How I got it ----------
// Bought, thrifted, from the library, borrowed, a gift or free, with an
// optional who or where. Written at the bottom of the library card.
const GOT_HOW = {
    bought: { from: 'Where', hint: 'Which shop? (optional)', line: f => f ? `Bought at ${f}` : 'Bought' },
    thrift: { from: 'Where', hint: 'Which shop? (optional)', line: f => f ? `Thrifted at ${f}` : 'Thrifted' },
    library: { from: 'Which library', hint: 'e.g. Main Street (optional)', line: f => f ? `From ${f} library` : 'From the library' },
    borrowed: { from: 'Who from', hint: "A friend's name", friends: true, line: f => f ? `Borrowed from ${f}` : 'Borrowed' },
    gift: { from: 'Who from', hint: "A friend's name", friends: true, line: f => f ? `A gift from ${f}` : 'A gift' },
    free: { from: 'Where', hint: 'e.g. a little free library (optional)', line: f => f ? `Free from ${f}` : 'Free' }
};

// the card's line, e.g. "Borrowed from Sam" ("" if it's not set)
function gotLine(how, from) {
    const g = GOT_HOW[how];
    if (!g) return '';
    // "Main Street Library" typed in full doesn't need "library" again
    if (how === 'library' && /library$/i.test(from)) return `From ${from}`;
    return g.line(from);
}

function setGotHow(how, from) {
    document.getElementById('book-got-how').value = GOT_HOW[how] ? how : '';
    document.getElementById('book-got-from').value = from;
    updateGotFromField();
}

// the who/where box only shows once you've picked how, and asks the
// right question (with your friends' names offered for people)
function updateGotFromField() {
    const g = GOT_HOW[document.getElementById('book-got-how').value];
    const input = document.getElementById('book-got-from');
    document.getElementById('book-got-from-label').style.visibility = g ? '' : 'hidden';
    if (!g) return;
    document.getElementById('book-got-from-title').textContent = g.from;
    input.placeholder = g.hint;
    if (g.friends) input.setAttribute('list', 'friend-options');
    else input.removeAttribute('list');
}

function libraryCardHandStyle() {
    const cardFont = appSettings.cardFont || document.getElementById('book-notes-font').value;
    return `font-family: ${noteFontStack(getNoteFont(cardFont))};`;
}

// Other times you read it (re-reads), written on the library card; the
// first line of the card is the Started / Finished dates in the form.
let formExtraReads = [];
const LC_MIN_ROWS = 3; // blank lines on the card, like a real one
let lcBlurCommitAt = 0;

// Compare only as precisely as both dates allow - "2024" vs
// "2024-03-10" can't be ordered, but "2023" vs "2024-03" can.
function finishedBeforeStarted(started, finished) {
    if (!started || !finished) return false;
    const len = Math.min(started.length, finished.length);
    return finished.slice(0, len) < started.slice(0, len);
}

// What you write on the card -> a partial date ("2024", "2024-03",
// "2024-03-15"), "" for blank, or null if it can't be read. Takes
// "today", "2024", "3/2024", "3/15/2024", "Mar 2024", "March 15, 2024",
// "15 March 2024" and "2024-03-15".
function parseLooseDate(text) {
    const s = String(text || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!s) return '';
    const pad = n => String(n).padStart(2, '0');
    const now = new Date();
    if (s === 'today') return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    // "mar", "march", "sept"...
    const monthOf = word => word.length >= 3 ? MONTH_NAMES.findIndex(m => m.toLowerCase().startsWith(word)) + 1 : 0;
    let y = 0, m = 0, d = 0, match;
    if ((match = /^(\d{4})$/.exec(s))) {
        y = +match[1];
    } else if ((match = /^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/.exec(s))) {
        [y, m, d] = [+match[1], +match[2], +(match[3] || 0)];
    } else if ((match = /^(\d{1,2})\/(\d{4})$/.exec(s))) {
        [m, y] = [+match[1], +match[2]];
    } else if ((match = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(s))) {
        [m, d, y] = [+match[1], +match[2], +match[3]];
        if (y < 100) y += 2000;
    } else if ((match = /^([a-z]+)\.? (?:(\d{1,2})(?:st|nd|rd|th)?,? )?(\d{4})$/.exec(s))) {
        [m, d, y] = [monthOf(match[1]), +(match[2] || 0), +match[3]];
        if (!m) return null;
    } else if ((match = /^(\d{1,2})(?:st|nd|rd|th)? ([a-z]+)\.?,? (\d{4})$/.exec(s))) {
        [d, m, y] = [+match[1], monthOf(match[2]), +match[3]];
        if (!m) return null;
    } else {
        return null;
    }
    if (y < 1000 || y > 9999) return null;
    if (!m) return String(y);
    if (m < 1 || m > 12) return null;
    if (!d) return `${y}-${pad(m)}`;
    if (d < 1 || d > new Date(y, m, 0).getDate()) return null;
    return `${y}-${pad(m)}-${pad(d)}`;
}

function libraryCardRows() {
    return [
        { row: 'main', started: readDateField('started', 'started').value || '', finished: readDateField('finished', 'finished').value || '' },
        ...formExtraReads.map((r, i) => ({ row: String(i), started: r.started, finished: r.finished }))
    ];
}

function renderLibraryCardRows() {
    const box = document.getElementById('lc-rows');
    if (!box) return;
    const hand = libraryCardHandStyle();
    const rows = libraryCardRows();
    const table = document.createElement('table');
    table.className = 'lc-table';
    table.innerHTML = '<tr><th>Checked out</th><th>Returned</th></tr>';
    // a blank line to write the next read on, and enough lines to look like a card
    const blanks = Math.max(1, LC_MIN_ROWS - rows.length);
    [...rows, ...Array.from({ length: blanks }, () => ({ row: 'new', started: '', finished: '' }))].forEach(r => {
        const tr = table.insertRow();
        ['started', 'finished'].forEach(field => {
            const td = tr.insertCell();
            td.className = 'lc-hand lc-cell';
            td.style.cssText = hand;
            td.dataset.row = r.row;
            td.dataset.field = field;
            td.tabIndex = 0;
            td.title = field === 'started' ? 'Write when you started it' : 'Write when you finished it';
            td.textContent = r[field] ? formatPartialDate(r[field]) : '';
            td.addEventListener('click', e => { e.stopPropagation(); editCardCell(td); });
            td.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); editCardCell(td); }
            });
        });
    });
    box.innerHTML = '';
    box.appendChild(table);
}

function setCardNote(text) {
    const note = document.getElementById('lc-note');
    if (note) note.textContent = text;
}

function editCardCell(td) {
    if (td.querySelector('.lc-input')) return;
    let row = td.dataset.row;
    const field = td.dataset.field;
    if (row === 'new') {
        // start a new line for another read
        formExtraReads.push({ started: '', finished: '' });
        row = String(formExtraReads.length - 1);
        renderLibraryCardRows();
        td = document.querySelector(`#lc-rows .lc-cell[data-row="${row}"][data-field="${field}"]`);
    }
    const valueOf = (r, f) => r === 'main'
        ? (readDateField(f, f).value || '')
        : (formExtraReads[+r] || {})[f] || '';
    const current = valueOf(row, field);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'lc-input';
    input.style.cssText = libraryCardHandStyle();
    input.value = current ? formatPartialDate(current) : '';
    input.placeholder = 'Mar 3, 2024';
    input.setAttribute('aria-label', field === 'started' ? 'Checked out (started)' : 'Returned (finished)');
    input.autocomplete = 'off';
    input.spellcheck = false;
    td.textContent = '';
    td.appendChild(input);
    input.focus();
    input.select();

    let done = false;
    const finish = () => {
        done = true;
        // a line with nothing on it goes away...
        const lines = formExtraReads.length;
        formExtraReads = formExtraReads.filter(r => r.started || r.finished);
        if (formExtraReads.length !== lines) return renderLibraryCardRows();
        // ...otherwise just this cell changes (redrawing them all would
        // swallow a click that's moving on to the next line)
        const value = valueOf(row, field);
        td.textContent = value ? formatPartialDate(value) : '';
    };
    // Enter on a bad date keeps you writing; clicking away puts the old one back
    const reject = (msg, keepEditing) => {
        setCardNote(msg);
        if (!keepEditing) return finish();
        input.classList.add('lc-bad');
        if (!prefersReducedMotion()) {
            input.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' },
                { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }], { duration: 240, iterations: 2 });
        }
        input.focus();
    };
    const commit = (fromKey) => {
        if (done) return;
        const value = parseLooseDate(input.value);
        if (value === null) return reject(`Couldn't read "${input.value.trim()}". Try Mar 3, 2024, 3/2024 or 2024.`, fromKey);
        const other = field === 'started' ? 'finished' : 'started';
        const otherValue = valueOf(row, other);
        const [s, f] = field === 'started' ? [value, otherValue] : [otherValue, value];
        if (finishedBeforeStarted(s, f)) return reject('Returned before it was checked out? Check the dates.', fromKey);
        if (row === 'main') {
            setDateField(field, value);
        } else if (formExtraReads[+row]) {
            formExtraReads[+row][field] = value;
        }
        setCardNote('');
        finish();
    };
    input.addEventListener('click', e => e.stopPropagation());
    input.addEventListener('keydown', e => {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); commit(true); }
        if (e.key === 'Escape') { e.preventDefault(); setCardNote(''); finish(); }
    });
    input.addEventListener('input', () => input.classList.remove('lc-bad'));
    input.addEventListener('blur', () => {
        if (done) return;
        lcBlurCommitAt = Date.now();
        commit(false);
    });
}

// Clicking the card slides it back in - unless you were just writing on it.
function libraryCardClick(e) {
    if (e.target.closest('.lc-cell, .lc-input')) return;
    if (Date.now() - lcBlurCommitAt < 400) return;
    closeLibraryCard();
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

// A book can have two notes, for two kinds of thing: one on cream paper
// peeking out at the top right of the preview, one on pink paper lower
// down the same side, only its corner showing. Either can be written without the other, and each
// keeps its own font.
const NOTE_PAGES = {
    1: { text: 'book-notes', font: 'book-notes-font', peek: 'preview-notes-peek',
         rest: 'rotate(10deg)', lift: 'rotate(14deg) translate(4px, -4px)', out: 'rotate(22deg) translate(26px, -46px)' },
    2: { text: 'book-notes-2', font: 'book-notes-2-font', peek: 'preview-notes-peek-2',
         rest: 'rotate(42deg)', lift: 'rotate(38deg) translate(6px, -2px)', out: 'rotate(30deg) translate(44px, 6px)' }
};

const pageNotes = page => document.getElementById(NOTE_PAGES[page].text).value;
const pageFont = page => document.getElementById(NOTE_PAGES[page].font).value;

function setNotes(notes, font, page = 1) {
    const p = NOTE_PAGES[page];
    document.getElementById(p.text).value = notes;
    document.getElementById(p.font).value = getNoteFont(font || getLastNoteFont()).name;
    document.getElementById(p.peek).classList.toggle('visible', !!notes.trim());
    document.getElementById('modal-notes-btn').innerHTML =
        (pageNotes(1).trim() || pageNotes(2).trim()) ? '&#9998; Edit Notes' : '&#9998; Add Notes';
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
let notepadPage = 1;

// put which note is open on the paper: its words, font and colour
function showNotepadPage(page) {
    notepadPage = page;
    const text = document.getElementById('notepad-text');
    text.value = pageNotes(page);
    applyNotepadFont(pageFont(page));
    document.querySelector('.notepad').classList.toggle('page-2', page === 2);
    updateNotepadFlip();
}

// the corner button: turn to the other note (or start it)
function updateNotepadFlip() {
    const btn = document.getElementById('notepad-flip');
    const hasOther = !!pageNotes(notepadPage === 1 ? 2 : 1).trim();
    const name = notepadPage === 1 ? 'pink note' : 'cream note';
    btn.textContent = hasOther ? `To the ${name}` : `\uFF0B A ${name}`;
}

// keep what's written on this note, then turn to the other one
function flipNotepad() {
    const text = document.getElementById('notepad-text');
    setNotes(text.value, text.dataset.font, notepadPage);
    showNotepadPage(notepadPage === 1 ? 2 : 1);
    text.focus();
    if (prefersReducedMotion()) return;
    const dir = notepadPage === 2 ? 1 : -1;
    document.querySelector('.notepad').animate([
        { transform: `translateX(${dir * 40}px) rotate(${dir * 3}deg)`, opacity: 0 },
        { transform: 'none', opacity: 1 }
    ], { duration: 260, easing: 'cubic-bezier(.2, .8, .3, 1.05)' });
}

// fromEl: the peeking paper or the Add/Edit Notes button; page: which
// note (the Notes button opens the first one with words on it)
function openNotepad(fromEl, page) {
    renderNotepadFontButtons();
    const text = document.getElementById('notepad-text');
    if (!page) page = !pageNotes(1).trim() && pageNotes(2).trim() ? 2 : 1;
    showNotepadPage(page);
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

    const p = NOTE_PAGES[page];
    const peek = document.getElementById(p.peek);
    if (notepadOrigin === peek && !prefersReducedMotion()) {
        // slide the paper the rest of the way out from behind the book,
        // then the notepad unfolds from where it was
        peek.animate([
            { transform: p.lift },
            { transform: `${p.out} scale(1.25)`, opacity: 0 }
        ], { duration: 220, easing: 'ease-in' });
        setTimeout(showPad, 220); // timer, not onfinish - see closeNotepad
    } else {
        showPad();
    }
}

async function closeNotepad() {
    if (notepadClosing) return;
    const font = document.getElementById('notepad-text').dataset.font;
    setNotes(document.getElementById('notepad-text').value, font, notepadPage);

    // tuck the notepad back where it came from - into this note's
    // peeking paper if it has words now, otherwise the Notes button
    const modal = document.getElementById('notepad-modal');
    const p = NOTE_PAGES[notepadPage];
    const peek = document.getElementById(p.peek);
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
            { transform: p.out, opacity: 0 },
            { transform: p.rest, opacity: 1 }
        ], { duration: 260, easing: 'cubic-bezier(.2, .8, .3, 1.2)' });
    }
    try { localStorage.setItem(LAST_NOTE_FONT_KEY, font); } catch (e) {}

    // For a book already on the shelf, save the notes right away -
    // otherwise closing the edit window with Cancel/X would silently
    // throw away everything just written.
    const existing = editingId ? library.find(b => b.id === editingId) : null;
    const notes = { notes: pageNotes(1), notesFont: pageFont(1), notes2: pageNotes(2), notes2Font: pageFont(2) };
    if (existing && Object.keys(notes).some(k => (existing[k] || '') !== notes[k])) {
        Object.assign(existing, notes);
        await dbPut(existing);
    }
}


// Wiggle the preview book for the big moments only - changing status
// or putting on a new cover. Suppressed while the window is first
// being filled in.
let suppressPreviewWiggle = false;
let previewWiggleTimer = null;

function wigglePreview() {
    if (suppressPreviewWiggle || celebrationsOff()) return;
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
    if (status === 'Read' && previous !== 'Read') confettiFrom(btn);
}

function setOwned(owned) {
    document.getElementById('book-owned').checked = owned;
    document.getElementById('owned-toggle-btn').classList.toggle('active', owned);
    // only a book you own can be lent out
    document.getElementById('lend-row').classList.toggle('visible', owned);
}

function toggleOwned() {
    setOwned(!document.getElementById('book-owned').checked);
}

// ---------- Lending ----------
// A lent book keeps its spot on the shelf as an empty outline with a
// tag hanging in it. lentAt is when it went out (kept while the same
// person has it).
let formLentAt = null;

function setLentTo(name, lentAt) {
    document.getElementById('book-lent-to').value = name;
    formLentAt = name ? lentAt : null;
    updateLendHint();
}

function markBookReturned() {
    setLentTo("", null);
}

function friendlyAge(ms) {
    const days = Math.max(0, Math.floor((Date.now() - ms) / DAY_MS));
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 14) return `${days} days ago`;
    if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 730) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)} years ago`;
}

function updateLendHint() {
    const name = document.getElementById('book-lent-to').value.trim();
    const hint = document.getElementById('lend-hint');
    document.getElementById('lend-back-btn').style.display = name ? '' : 'none';
    const same = formLentAt && editingId && (library.find(b => b.id === editingId) || {}).lentTo === name;
    hint.textContent = !name ? 'Lend it out and it leaves a tag in its spot on the shelf.'
        : same ? `Lent ${friendlyAge(formLentAt)}.` : 'Lent from today.';
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
        setImageLinkError('cover', '');
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
        setImageLinkError('spine', '');
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
    refreshSpineWidthField();
    if (previewFace === 'spine') renderPreviewSpine();
}

// ---------- Image by link or paste ----------
// Besides choosing a file, a cover or spine can come from a pasted
// picture or an image's web address. Either way it's turned into the
// same data URL a chosen file would be, then goes through the cropper.

function imageFieldIds(context) {
    return context === 'cover'
        ? { file: 'book-image', display: 'file-name-display', link: 'book-image-url', error: 'book-image-link-error' }
        : { file: 'book-spine-image', display: 'spine-file-name-display', link: 'book-spine-image-url', error: 'book-spine-image-link-error' };
}

function setImageLinkError(context, msg) {
    const ids = imageFieldIds(context);
    const error = document.getElementById(ids.error);
    error.innerText = msg;
    error.classList.toggle('show', !!msg);
    document.getElementById(ids.link).closest('.image-link-row').classList.toggle('link-failed', !!msg);
}

function startImageCrop(dataUrl, context, label) {
    const ids = imageFieldIds(context);
    setImageLinkError(context, '');
    document.getElementById(ids.file).value = '';
    document.getElementById(ids.display).innerText = label;
    document.getElementById(ids.link).value = '';
    if (context === 'spine') clearSpineImageFlag = false;
    openCropModal(dataUrl, context);
}

function clipboardImageFile(e) {
    const items = e.clipboardData ? [...e.clipboardData.items] : [];
    const item = items.find(i => i.kind === 'file' && i.type.startsWith('image/'));
    return item ? item.getAsFile() : null;
}

function handleImagePaste(e, context) {
    const file = clipboardImageFile(e);
    if (file) {
        e.preventDefault();
        e.stopPropagation(); // (not the whole window's paste too)
        readFileAsDataURL(file).then(dataUrl => startImageCrop(dataUrl, context, 'Pasted image'));
        return;
    }
    // a pasted link loads right away, no need to press Use
    const text = (e.clipboardData ? e.clipboardData.getData('text') : '').trim();
    if (/^(https?:\/\/|data:image\/)/i.test(text)) {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById(imageFieldIds(context).link).value = text;
        loadImageFromLink(text, context);
    }
}

function loadImageFromLinkField(context) {
    const url = document.getElementById(imageFieldIds(context).link).value.trim();
    if (url) loadImageFromLink(url, context);
}

async function loadImageFromLink(url, context) {
    const display = document.getElementById(imageFieldIds(context).display);
    if (/^data:image\//i.test(url)) {
        startImageCrop(url, context, 'Pasted image');
        return;
    }
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    setImageLinkError(context, '');
    display.innerText = 'Fetching image...';
    try {
        // fetched (not just pointed at) so the cover is kept with the
        // book and the cropper can read its pixels
        const res = await fetch(url);
        if (!res.ok) throw new Error(res.status);
        const blob = await res.blob();
        if (!blob.type.startsWith('image/')) throw new Error('not an image');
        const dataUrl = await readFileAsDataURL(blob);
        if (document.getElementById('book-modal').style.display !== 'flex') return;
        const name = decodeURIComponent(new URL(url).pathname.split('/').pop() || '') || 'Image from link';
        startImageCrop(dataUrl, context, name);
    } catch (err) {
        showImageLinkFailure(context);
    }
}

// most often the site won't let other pages download its images
function showImageLinkFailure(context) {
    const display = document.getElementById(imageFieldIds(context).display);
    if (display.innerText === 'Fetching image...') display.innerText = 'No file chosen';
    setImageLinkError(context,
        "Couldn't load that link. Try right-clicking the image, Copy Image, then paste it here.");
    const error = document.getElementById(imageFieldIds(context).error);
    if (!prefersReducedMotion()) {
        error.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' },
            { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }], { duration: 240, iterations: 2 });
    }
}

// pasting a picture anywhere in the edit window makes it whichever
// side the preview is showing - the cover, or the spine once it's
// turned to Spine (choosing or cropping a spine turns it there too)
document.addEventListener('paste', (e) => {
    if (document.getElementById('book-modal').style.display !== 'flex') return;
    if (document.getElementById('crop-modal').style.display === 'flex') return;
    const file = clipboardImageFile(e);
    if (!file) return; // ordinary text pastes are left alone
    e.preventDefault();
    const side = previewFace === 'spine' ? 'spine' : 'cover';
    readFileAsDataURL(file).then(dataUrl => startImageCrop(dataUrl, side, 'Pasted image'));
});

// how far along the Cover Width (or another) slider's track the gradient fills
function updateWidthSliderFill(slider = document.getElementById('book-width')) {
    const pct = (slider.value - slider.min) / (slider.max - slider.min) * 100;
    slider.style.setProperty('--fill', pct + '%');
}

// ---------- Spine width ----------
// Auto follows the page count (see autoSpineWidth); dragging the slider
// sets it by hand, and Auto goes back. A spine photo is as wide as the
// photo, so the slider's off while there's one.

function setSpineWidthAuto(auto) {
    document.getElementById('book-spine-width').dataset.auto = auto ? '1' : '';
    refreshSpineWidthField();
    if (previewFace === 'spine') renderPreviewSpine();
}

// what's saved: px, or null for auto
function formSpineWidth() {
    const slider = document.getElementById('book-spine-width');
    return slider.dataset.auto ? null : parseInt(slider.value, 10);
}

function refreshSpineWidthField() {
    const slider = document.getElementById('book-spine-width');
    const auto = !!slider.dataset.auto;
    const pages = parseInt(document.getElementById('book-pages').value, 10);
    if (auto) slider.value = autoSpineWidth(pages, parseInt(document.getElementById('book-width').value, 10));
    const existing = editingId ? library.find(b => b.id === editingId) : null;
    const photo = !!(pendingSpineCrop || (!clearSpineImageFlag && existing && existing.spineImage));
    slider.disabled = photo;
    document.getElementById('book-spine-width-auto').disabled = auto || photo;
    document.getElementById('book-spine-width-value').innerText = photo ? '\u2014' : slider.value + 'px';
    document.getElementById('book-spine-width-hint').innerText = photo
        ? 'A spine photo is as wide as the photo.'
        : !auto ? ''
        : pages > 0 ? 'Auto: based on the total page count.'
        : 'Auto: based on the total page count, once Pages is filled in.';
    updateWidthSliderFill(slider);
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
    refreshSpineWidthField();

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
    if (previewFace === 'spine') renderPreviewSpine();
}

// ---------- Cover or spine in the preview ----------
// Under the preview, Cover / Spine: the spine is the book as it stands
// on the shelf in Spines view, the real spine photo or the generated
// leather one, at the size it'd be there.

let previewFace = 'cover';
let previewSpineDraw = 0; // (only the latest of overlapping redraws lands)

function setPreviewFace(face) {
    previewFace = face;
    document.querySelectorAll('#book-modal [data-preview-face]').forEach(btn => {
        const on = btn.dataset.previewFace === face;
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    document.getElementById('preview-book-wrap').classList.toggle('spine-face', face === 'spine');
    if (face === 'spine') renderPreviewSpine();
}

async function renderPreviewSpine() {
    const draw = ++previewSpineDraw;
    const el = document.getElementById('preview-spine');
    const existing = editingId ? library.find(b => b.id === editingId) : null;
    const color = document.getElementById('book-color').value;
    const width = parseFloat(document.getElementById('preview-book').style.width) || 120;

    // as tall as the cover, like on the shelf
    const cover = pendingCoverCrop || (existing && existing.image) || '';
    let ratio = 2 / 3;
    if (cover) {
        const preset = Number(document.getElementById('book-ratio-preset').value);
        ratio = preset || await getImageAspectRatio(cover) || 2 / 3;
    }
    const height = Math.round(width / ratio);

    const spine = pendingSpineCrop || (!clearSpineImageFlag && existing && existing.spineImage) || '';
    const spineRatio = spine
        ? (pendingSpineCrop ? await getSpineImageAspectRatio(spine) : existing.spineImageRatio) || 0.25
        : null;
    const edge = cover && !spine ? await getImageEdgeColor(cover) : null;
    if (draw !== previewSpineDraw) return;

    el.innerHTML = '';
    el.style.height = height + 'px';
    el.classList.toggle('spine-mode-generated', !spine);
    if (spine) {
        el.style.backgroundImage = `url(${spine})`;
        el.style.backgroundSize = '100% 100%'; // (as on the shelf)
        el.style.padding = '0';
        el.style.width = Math.max(12, Math.round(height * spineRatio)) + 'px';
    } else {
        el.style.backgroundImage = '';
        el.style.backgroundSize = '';
        el.style.padding = '';
        // the shelf's width, shrunk as much as the preview is
        const coverWidth = parseInt(document.getElementById('book-width').value, 10) || 120;
        const spineWidth = parseInt(document.getElementById('book-spine-width').value, 10) || 30;
        el.style.width = Math.max(12, Math.round(spineWidth * width / coverWidth)) + 'px';
        applySpineVars(el, edge || (existing && cover && existing.spineColor) || color);
        const label = document.createElement('span');
        label.className = 'spine-label';
        const title = document.getElementById('book-title').value.trim() || 'Book Title';
        const author = document.getElementById('book-author').value.split(',')[0].trim();
        label.innerText = title + (author ? ` — ${author}` : '');
        el.appendChild(label);
    }
}

function closeModal() {
    document.getElementById('book-modal').style.display = 'none';
    editingId = null;
    recToShelf = null;
    hideLibraryCard();
    slidePulledBookBack();
}

// ---------- Crop modal ----------

// The picture as it came in, and how far it's been turned (quarter
// turns) and straightened (degrees) - the Whole shelf window's tools.
let cropSourceUrl = null;
let cropSourceImg = null;
let cropTurns = 0;
let cropTilt = 0;

function openCropModal(dataUrl, context) {
    cropContext = context;
    cropSourceUrl = dataUrl;
    cropSourceImg = null;
    cropTurns = 0;
    cropTilt = 0;
    document.getElementById('crop-tilt').value = 0;
    resetCropAdjust();
    document.getElementById('crop-turn-note').hidden = true;
    document.getElementById('crop-modal').style.display = 'flex';
    const src = new Image();
    src.onload = () => {
        if (cropSourceUrl !== dataUrl) return; // (another picture came in since)
        cropSourceImg = src;
        // a spine stands tall and thin, so one photographed lying down
        // starts out turned upright - clockwise, so a title that read
        // left to right reads top to bottom, as on most spines
        if (context === 'spine' && src.naturalWidth > src.naturalHeight) {
            cropTurns = 1;
            document.getElementById('crop-turn-note').hidden = false;
        }
        showCropImage();
    };
    src.src = dataUrl;
}

function showCropImage() {
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
    // (left as it came, it isn't redrawn at all)
    img.src = (cropTurns || cropTilt) ? turnedCropImage() : cropSourceUrl;
}

// the picture turned and straightened, trimmed to the biggest upright
// rectangle inside it so a straightened one has no blank corners
function turnedCropImage() {
    const src = cropSourceImg;
    const iw = src.naturalWidth, ih = src.naturalHeight;
    const sideways = cropTurns % 2 === 1;
    const tilt = cropTilt * Math.PI / 180;
    const inner = innerRectAfterTurn(sideways ? ih : iw, sideways ? iw : ih, tilt);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(inner.w));
    canvas.height = Math.max(1, Math.floor(inner.h));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(cropTurns * Math.PI / 2 + tilt);
    ctx.drawImage(src, -iw / 2, -ih / 2, iw, ih);
    return canvas.toDataURL('image/jpeg', 0.95);
}

function turnCropImage(dir) {
    if (!cropSourceImg) return;
    cropTurns = (cropTurns + dir + 4) % 4;
    document.getElementById('crop-turn-note').hidden = true;
    showCropImage();
}

function tiltCropImage(deg) {
    if (!cropSourceImg) return;
    document.getElementById('crop-tilt').value = deg;
    cropTilt = Number(deg) || 0;
    showCropImage();
}

// ---- brightness, contrast, warmth and saturation
// All four make one colour matrix (3 rows of r, g, b, plus-this, in
// 0-1 units). The cropper previews it as an SVG filter on the picture
// and the saved picture gets the same sums pixel by pixel, so what you
// see is what you keep - and no canvas filter, which older Safari lacks.

// (the Whole shelf window has the same four sliders - see shelfphoto.js)
const CROP_ADJUST_IDS = ['crop-brightness', 'crop-contrast', 'crop-warmth', 'crop-saturation'];
const CROP_ADJUST_IDENTITY = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0]];

// a then b: the matrix that does a, then does b to the result
function thenColourMatrix(a, b) {
    return b.map(row => [0, 1, 2, 3].map(c =>
        row[0] * a[0][c] + row[1] * a[1][c] + row[2] * a[2][c] + (c === 3 ? row[3] : 0)));
}

// the sliders (-100 to 100 each, 0 in the middle) as one matrix
function cropAdjustMatrix(values) {
    const [bright, contrast, warmth, sat] = values.map(v => (Number(v) || 0) / 100);
    // saturation 0 to 2 times, mixing toward grey the way CSS saturate() does
    const s = 1 + sat;
    const lr = 0.2126, lg = 0.7152, lb = 0.0722;
    const saturate = [
        [lr + (1 - lr) * s, lg - lg * s, lb - lb * s, 0],
        [lr - lr * s, lg + (1 - lg) * s, lb - lb * s, 0],
        [lr - lr * s, lg - lg * s, lb + (1 - lb) * s, 0]
    ];
    // contrast 0.5 to 1.5 times, about the middle grey
    const c = 1 + contrast / 2;
    const contrastM = [[c, 0, 0, (1 - c) / 2], [0, c, 0, (1 - c) / 2], [0, 0, c, (1 - c) / 2]];
    // brightness 0.5 to 1.5 times
    const b = 1 + bright / 2;
    const brightM = [[b, 0, 0, 0], [0, b, 0, 0], [0, 0, b, 0]];
    // warmth: more red and less blue, or the other way to cool it
    const warmM = [[1 + 0.15 * warmth, 0, 0, 0], [0, 1 + 0.03 * warmth, 0, 0], [0, 0, 1 - 0.15 * warmth, 0]];
    return [saturate, contrastM, brightM, warmM].reduce(thenColourMatrix, CROP_ADJUST_IDENTITY);
}

// a set of four sliders' values, by their ids
function colourAdjustValues(ids) {
    return ids.map(id => Number(document.getElementById(id).value) || 0);
}

// puts the values into an SVG feColorMatrix, for the preview
function showColourAdjust(matrixId, values) {
    const m = cropAdjustMatrix(values);
    document.getElementById(matrixId).setAttribute('values',
        m.map(row => row.join(' ') + ' 0').join(' ') + ' 0 0 0 1 0');
}

function cropAdjustValues() {
    return colourAdjustValues(CROP_ADJUST_IDS);
}

function cropIsAdjusted() {
    return cropAdjustValues().some(v => v !== 0);
}

function adjustCropImage() {
    const adjusted = cropIsAdjusted();
    showColourAdjust('crop-adjust-matrix', cropAdjustValues());
    document.getElementById('crop-image').style.filter = adjusted ? 'url(#crop-adjust-filter)' : '';
    // (its room is kept while it's hidden, so showing it can't move the sliders)
    document.getElementById('crop-adjust-reset').style.visibility = adjusted ? '' : 'hidden';
}

function resetCropAdjust() {
    CROP_ADJUST_IDS.forEach(id => { document.getElementById(id).value = 0; });
    adjustCropImage();
}

function applyCropAdjust(canvas) {
    applyColourAdjust(canvas, cropAdjustValues());
}

// four sliders' colours, painted into a canvas's pixels
function applyColourAdjust(canvas, values) {
    if (!values.some(v => v !== 0)) return;
    const m = cropAdjustMatrix(values);
    const ctx = canvas.getContext('2d');
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = data.data;
    const o0 = m[0][3] * 255, o1 = m[1][3] * 255, o2 = m[2][3] * 255;
    for (let i = 0; i < px.length; i += 4) {
        const r = px[i], g = px[i + 1], b = px[i + 2];
        // (the pixel array clamps to 0-255 and rounds by itself)
        px[i] = m[0][0] * r + m[0][1] * g + m[0][2] * b + o0;
        px[i + 1] = m[1][0] * r + m[1][1] * g + m[1][2] * b + o1;
        px[i + 2] = m[2][0] * r + m[2][1] * g + m[2][2] * b + o2;
    }
    ctx.putImageData(data, 0, 0);
}

function renderCropBox() {
    ['crop-box', 'crop-shade'].forEach(id => {
        const el = document.getElementById(id);
        el.style.left = cropBoxState.x + 'px';
        el.style.top = cropBoxState.y + 'px';
        el.style.width = cropBoxState.w + 'px';
        el.style.height = cropBoxState.h + 'px';
    });
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
    const ctx = canvas.getContext('2d');
    // JPEG has no see-through parts; without this they'd come out black
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, sw, sh);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    applyCropAdjust(canvas);
    // JPEG, not PNG: a cover photo is about 5x smaller this way and looks
    // the same at shelf size
    applyCropResult(canvas.toDataURL('image/jpeg', COVER_JPEG_QUALITY));
}

const COVER_JPEG_QUALITY = 0.92;

// A JPEG copy of a PNG data: URL, or null when the PNG has see-through
// pixels (JPEG would fill them in) or the JPEG wouldn't be any smaller.
function pngDataUrlToJpeg(dataUrl) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                for (let i = 3; i < px.length; i += 4) {
                    if (px[i] < 255) return resolve(null);
                }
                const jpeg = canvas.toDataURL('image/jpeg', COVER_JPEG_QUALITY);
                resolve(jpeg.length < dataUrl.length ? jpeg : null);
            } catch (e) {
                resolve(null);
            }
        };
        img.onerror = () => resolve(null);
        img.src = dataUrl;
    });
}

function useFullImageForCrop() {
    const img = document.getElementById('crop-image');
    if (!cropIsAdjusted()) return applyCropResult(img.src);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    applyCropAdjust(canvas);
    applyCropResult(canvas.toDataURL('image/jpeg', COVER_JPEG_QUALITY));
}

function applyCropResult(dataUrl) {
    if (cropContext === 'cover') {
        pendingCoverCrop = dataUrl;
    } else if (cropContext === 'spine') {
        pendingSpineCrop = dataUrl;
    }
    const context = cropContext;
    closeCropModal();
    // turn the preview to whichever side just changed
    setPreviewFace(context === 'spine' ? 'spine' : 'cover');
    updatePreview();
    wigglePreview();
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
    cropSourceUrl = null;
    cropSourceImg = null;
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
    const notes2 = document.getElementById('book-notes-2').value;
    const notes2Font = document.getElementById('book-notes-2-font').value;

    if (!title) {
        alert('Please include a book title!');
        return;
    }

    if (!genre || genre === ADD_GENRE_VALUE) {
        alert('Please choose a genre!');
        document.getElementById('book-genre').focus();
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
    if (finishedBeforeStarted(startedDate, finishedDate)) {
        alert('The finished date is before the started date.');
        return;
    }

    const pagesRaw = parseInt(document.getElementById('book-pages').value, 10);
    const pages = pagesRaw > 0 ? Math.min(pagesRaw, 99999) : null;
    const extraReads = formExtraReads.filter(r => r.started || r.finished).map(r => ({ started: r.started || "", finished: r.finished || "" }));

    const existing = editingId ? library.find(b => b.id === editingId) : null;

    const recommendedBy = document.getElementById('book-rec-by').value.trim();
    const gotHow = document.getElementById('book-got-how').value;
    const noPins = document.getElementById('book-no-pins').checked;
    const gotFrom = gotHow ? document.getElementById('book-got-from').value.trim() : "";
    const lentTo = owned ? document.getElementById('book-lent-to').value.trim() : "";
    // same person still has it: keep when it went out
    const lentAt = !lentTo ? null
        : (existing && existing.lentTo === lentTo && existing.lentAt) ? existing.lentAt
        : Date.now();

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
    // the cover's shape: the Shape picked, or else the picture's own.
    // A kept picture is measured again, since its saved ratio may be an
    // old Shape (switching back to Natural has to undo that).
    let finalRatio = null;
    if (finalImage) {
        finalRatio = ratioPreset || (image !== null ? imageRatio : await getImageAspectRatio(finalImage));
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
        formSpineWidth() !== (Number.isFinite(existing.spineWidth) ? existing.spineWidth : null) ||
        (ratioPreset || null) !== (existing.ratioPreset || null) ||
        (!!finalSpineImage && finalSpineImage !== (existing.spineImage || '')) ||
        (!!finalImage && finalImage !== (existing.image || '')));
    const stickyNote = existing ? !!existing.stickyNote && !restyled : false;

    const book = {
        id: editingId || Date.now().toString(),
        title, authors, series, seriesNumber, seriesTotal, status, rating, genre, color, width, tags, owned, notes, notesFont, notes2, notes2Font, startedDate, finishedDate,
        statusSince, dustedAt, stickyNote, pages, extraReads, lentTo, lentAt, recommendedBy, gotHow, gotFrom, noPins,
        sortOrder: existing && Number.isFinite(existing.sortOrder)
            ? existing.sortOrder
            : library.reduce((max, b) => Math.max(max, Number.isFinite(b.sortOrder) ? b.sortOrder : -1), -1) + 1,
        image: finalImage,
        imageRatio: finalImage ? finalRatio : null,
        ratioPreset: finalImage ? ratioPreset : null,
        spineColor: finalSpineColor,
        spineImage: finalSpineImage,
        spineImageRatio: finalSpineImage ? finalSpineImageRatio : null,
        spineWidth: formSpineWidth()
    };
    await dbPut(book);
    // a lent book back home (and still yours)
    if (existing && existing.lentTo && !lentTo && owned) bookBackForPins();
    if (lentTo && (!existing || existing.lentTo !== lentTo)) noteLentForPins(book.id, lentTo);
    // a book off the To Buy list, bought
    if (existing && isStickyPlaceholder(existing) && owned) countForPins('bought');
    if (!existing) recPutOnShelf(); // added from a rec on the Slips window
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
    const gotIt = existing && isStickyPlaceholder(existing) && !isStickyPlaceholder(book) && appSettings.goodbyes && !prefersReducedMotion();
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
