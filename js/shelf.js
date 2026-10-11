const room = document.getElementById('library-room');
const ghost = document.getElementById('drag-ghost');
let touchDraggingElement = null;

// ---------- Rendering ----------

function getAuthorLastName(authorStr) {
    if (!authorStr) return "Unknown";
    const parts = authorStr.trim().split(/\s+/);
    return parts[parts.length - 1] || "Unknown";
}

function getActiveGroupField() {
    const organizeBy = document.getElementById('organize-by').value;
    const sortMode = document.getElementById('sort-mode').value;
    if (sortMode !== 'custom') return null;
    if (organizeBy === 'genre' || organizeBy === 'status' || organizeBy === 'rating') return organizeBy;
    return null; // author mode: dragging to regroup by author isn't supported
}

// ---------- Phones ----------
// Books on the shelves are drawn at 72% size on narrow screens so a
// row holds more than two; the shelves redraw if you cross the line
// (e.g. rotating a phone).
const phoneQuery = window.matchMedia ? window.matchMedia('(max-width: 600px)') : null;

function shelfScale() {
    return phoneQuery && phoneQuery.matches ? 0.72 : 1;
}

if (phoneQuery && phoneQuery.addEventListener) {
    phoneQuery.addEventListener('change', () => renderBookshelf());
}

// Phones: everything but Search folds into a "Filters & sorting" panel.
function toggleFiltersPanel() {
    const panel = document.getElementById('filters-panel');
    const open = panel.classList.toggle('open');
    const btn = document.getElementById('filters-toggle');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.querySelector('.filters-arrow').innerHTML = open ? '&#9652;' : '&#9662;';
    placeCat(); // the shelves just moved down/up - keep the cat on its shelf
}

// phones: the bottom-left widgets (sticky pile, ledger, goals, critter)
// tuck away behind one button so they don't crowd the shelves
function toggleCornerDock() {
    const open = document.body.classList.toggle('corner-open');
    const btn = document.getElementById('corner-toggle');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.querySelector('.corner-toggle-icon').innerHTML = open ? '&times;' : '&#10022;';
    if (!open) closeStickyNote();
}

// how many filters/sorts differ from the defaults, shown on the closed
// panel's button so it's clear something is narrowing the shelf
function updateFiltersCount() {
    const v = id => document.getElementById(id).value;
    const active = [
        v('organize-by') !== 'genre',
        v('filter-status') !== 'All',
        v('filter-owned') !== 'All',
        stickyFilter !== 'Show',
        v('sort-mode') !== 'custom',
        v('filter-tag') !== 'All',
        v('filter-genre') !== 'All',
        v('filter-kind') !== 'All'
    ].filter(Boolean).length;
    document.getElementById('filters-count').textContent = active ? `\u2022 ${active}` : '';
}

function buildBookElement(book, draggableEnabled, spineMode) {
    const bookDiv = document.createElement('div');
    bookDiv.className = 'book';
    bookDiv.draggable = draggableEnabled;
    bookDiv.dataset.id = book.id;

    applySpineVars(bookDiv, book.spineColor || book.color);

    // A book missing its width (an old/partial entry, e.g. from a
    // hand-edited import) would otherwise turn every size calculation
    // below into NaN - most visibly in spine mode, where an invalid
    // "NaNpx" height/width collapses the whole spine to nothing.
    // books are drawn smaller on phones (see shelfScale)
    const width = (Number.isFinite(book.width) ? book.width : 120) * shelfScale();

    if (isStickyPlaceholder(book)) {
        buildStickyNoteFace(bookDiv, book);
        if (fallenNotes.has(book.id)) markFallen(bookDiv);
    } else if (spineMode) {
        // Spine view shows what you'd actually see on a real shelf - the
        // spine's edge color, not the front cover art - at the book's
        // real height but a narrow width, with the title read sideways.
        // A real spine photo (if uploaded) takes over entirely instead.
        bookDiv.classList.add('spine-mode');

        const coverRatio = book.imageRatio || book.ratioPreset || (2 / 3);
        const coverHeight = Math.round(width / coverRatio);
        bookDiv.style.height = coverHeight + 'px';

        if (book.spineImage) {
            bookDiv.style.backgroundImage = `url(${book.spineImage})`;
            bookDiv.style.backgroundSize = 'cover';
            bookDiv.style.backgroundColor = 'transparent';
            const spineImageRatio = book.spineImageRatio || 0.25;
            bookDiv.style.width = Math.max(18, Math.round(coverHeight * spineImageRatio)) + 'px';
        } else {
            bookDiv.classList.add('spine-mode-generated');
            bookDiv.style.backgroundColor = 'transparent';
            bookDiv.style.width = Math.max(18, Math.round(width / 4)) + 'px';

            const label = document.createElement('span');
            label.className = 'spine-label';
            const byline = (book.authors && book.authors.length) ? ` — ${book.authors[0]}` : '';
            label.innerText = book.title + byline;
            bookDiv.appendChild(label);
        }
    } else if (book.image) {
        bookDiv.style.backgroundImage = `url(${book.image})`;
        bookDiv.innerText = "";
        if (book.imageRatio) {
            bookDiv.style.aspectRatio = book.imageRatio;
        }
        bookDiv.style.width = width + 'px';
    } else {
        bookDiv.style.backgroundColor = book.color;
        bookDiv.innerText = book.title;
        bookDiv.style.width = width + 'px';
    }

    if (!isStickyPlaceholder(book)) {
        const spineTop = document.createElement('div');
        spineTop.className = 'spine-top';
        bookDiv.appendChild(spineTop);
    }

    if (isLentOut(book)) addLentTag(bookDiv, book);

    const dustLevel = getDustLevel(book);
    if (dustLevel > 0) {
        bookDiv.classList.add('dusty');
        if (dustLevel > 1) bookDiv.classList.add('dusty-heavy');
        const dust = document.createElement('span');
        dust.className = 'dust-layer';
        bookDiv.appendChild(dust);
        bookDiv.addEventListener('pointerenter', (e) => {
            if (e.pointerType === 'mouse' || e.pointerType === 'pen') blowDust(bookDiv, book.id);
        });
    }

    bookDiv.addEventListener('click', () => {
        if (touchDraggingElement) return;
        if (bookDiv.classList.contains('fallen')) {
            stickNoteBackUp(bookDiv, book.id);
            return;
        }
        // on touch there's no hover, so the first tap dusts the book off
        if (bookDiv.classList.contains('dusty') && !bookDiv.classList.contains('dust-blowing')) {
            blowDust(bookDiv, book.id);
            return;
        }
        pullOutAndOpen(bookDiv, book.id);
    });

    if (draggableEnabled) {
        bookDiv.addEventListener('dragstart', () => {
            bookDiv.classList.add('dragging');
            document.body.classList.add('drag-active');
        });
        bookDiv.addEventListener('dragend', () => {
            bookDiv.classList.remove('dragging');
            document.body.classList.remove('drag-active');
        });

        // Touch drag has to coexist with the shelf's native horizontal
        // scroll, and both are the same horizontal gesture - so a quick
        // swipe can't be told apart from a drag by direction alone.
        // Instead, treat touch as a scroll by default (don't touch
        // preventDefault) and only arm dragging after a short hold with
        // little movement; a real scroll swipe cancels the pending hold
        // before it fires.
        const TOUCH_HOLD_MS = 300;
        const TOUCH_CANCEL_PX = 10;
        let touchHoldTimer = null;
        let touchStartX = 0;
        let touchStartY = 0;

        const beginTouchDrag = (touch) => {
            touchDraggingElement = bookDiv;

            ghost.style.width = bookDiv.offsetWidth + 'px';
            ghost.style.height = bookDiv.offsetHeight + 'px';
            if (spineMode) {
                ghost.style.backgroundImage = bookDiv.style.backgroundImage;
                ghost.style.backgroundColor = 'transparent';
                ghost.innerText = "";
            } else if (book.image) {
                ghost.style.backgroundImage = `url(${book.image})`;
                ghost.style.backgroundColor = 'transparent';
                ghost.innerText = "";
            } else {
                ghost.style.backgroundImage = 'none';
                ghost.style.backgroundColor = book.color;
                ghost.innerText = book.title;
                ghost.style.color = 'white';
                ghost.style.display = 'flex';
                ghost.style.alignItems = 'center';
                ghost.style.justifyContent = 'center';
                ghost.style.fontSize = '12px';
                ghost.style.padding = '10px';
                ghost.style.textAlign = 'center';
                ghost.style.textShadow = '1px 1px 4px rgba(0,0,0,0.8)';
            }

            ghost.style.left = touch.clientX + 'px';
            ghost.style.top = touch.clientY + 'px';
            ghost.style.display = 'block';

            bookDiv.classList.add('dragging');
        };

        const cancelTouchHold = () => {
            clearTimeout(touchHoldTimer);
            touchHoldTimer = null;
        };

        const endTouchDrag = () => {
            cancelTouchHold();
            if (touchDraggingElement) {
                touchDraggingElement.classList.remove('dragging');
            }
            touchDraggingElement = null;
            ghost.style.display = 'none';
        };

        bookDiv.addEventListener('touchstart', (e) => {
            if (e.touches.length === 0) return;
            const touch = e.touches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            cancelTouchHold();
            touchHoldTimer = setTimeout(() => {
                touchHoldTimer = null;
                beginTouchDrag(touch);
            }, TOUCH_HOLD_MS);
        });

        bookDiv.addEventListener('touchmove', (e) => {
            if (e.touches.length === 0) return;
            const touch = e.touches[0];

            if (touchHoldTimer !== null) {
                const dx = touch.clientX - touchStartX;
                const dy = touch.clientY - touchStartY;
                if (Math.hypot(dx, dy) > TOUCH_CANCEL_PX) {
                    cancelTouchHold();
                }
                return;
            }

            if (!touchDraggingElement) return;
            e.preventDefault();

            ghost.style.left = touch.clientX + 'px';
            ghost.style.top = touch.clientY + 'px';

            ghost.style.pointerEvents = 'none';
            const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
            const currentShelf = elementBelow?.closest('.shelf');

            if (currentShelf) {
                const afterElement = getDragAfterElement(currentShelf, touch.clientX);
                if (afterElement == null) {
                    currentShelf.appendChild(touchDraggingElement);
                } else {
                    currentShelf.insertBefore(touchDraggingElement, afterElement);
                }
            }
        }, { passive: false });

        bookDiv.addEventListener('touchend', () => {
            const wasDragging = !!touchDraggingElement;
            endTouchDrag();
            if (wasDragging) {
                setTimeout(() => {
                    reorderLibraryData();
                }, 50);
            }
        });

        bookDiv.addEventListener('touchcancel', endTouchDrag);
    }

    return bookDiv;
}

function decorateSeriesBookElement(book, draggableEnabled, spineMode) {
    const el = buildBookElement(book, draggableEnabled, spineMode);
    el.classList.add(book.status === 'Read' ? 'series-read' : 'series-unread');
    // books you own carry a little gold bookplate seal (Settings can hide it)
    if (appSettings.seriesSeal && book.owned && !isStickyPlaceholder(book)) {
        const seal = document.createElement('span');
        seal.className = 'series-owned-seal';
        seal.textContent = '✓';
        seal.title = 'You own this one';
        el.appendChild(seal);
    }
    return el;
}

function buildMissingSeriesSlot(seriesName, slotNumber, seriesTotal, spineMode, refWidth) {
    const el = document.createElement('div');
    el.className = spineMode ? 'book series-missing spine-mode' : 'book series-missing';
    el.draggable = false;

    const width = (refWidth || 120) * shelfScale();
    if (spineMode) {
        const coverHeight = Math.round(width / (2 / 3));
        el.style.height = coverHeight + 'px';
        el.style.width = Math.max(18, Math.round(width / 4)) + 'px';
    } else {
        el.style.width = width + 'px';
        el.style.aspectRatio = '2 / 3';
    }

    if (!spineMode) {
        const spineTop = document.createElement('div');
        spineTop.className = 'spine-top';
        el.appendChild(spineTop);
    }

    const label = document.createElement('span');
    label.className = 'series-missing-label';
    label.innerText = '#' + slotNumber;
    el.appendChild(label);

    el.addEventListener('click', () => {
        openModal();
        document.getElementById('book-series').value = seriesName;
        document.getElementById('book-series-number').value = slotNumber;
        document.getElementById('book-series-total').value = seriesTotal || '';
        updatePreview();
    });

    return el;
}

function renderBookshelf() {
    renderShelves();
    updateReadingGoal();
    updateStatsLedger();
    updateFiltersCount();
}

// How far each sideways-scrolling shelf was scrolled before a full
// redraw (by its expand key), so editing or moving a book doesn't throw
// you back to the start of the shelf. Only set during renderShelves.
let restoreShelfScroll = null;

function renderShelves() {
    restoreShelfScroll = new Map();
    room.querySelectorAll('.genre-section').forEach(section => {
        const shelf = section.querySelector('.shelf');
        if (shelf && shelf.scrollLeft) restoreShelfScroll.set(section.dataset.expandKey, shelf.scrollLeft);
    });
    room.innerHTML = '';
    const selectedGenre = document.getElementById('filter-genre').value;
    const selectedKind = document.getElementById('filter-kind').value;
    const selectedStatus = document.getElementById('filter-status').value;
    const selectedOwned = document.getElementById('filter-owned').value;
    const selectedSticky = stickyFilter; // Show / Hide / Only (the to-get notes)
    const selectedTag = document.getElementById('filter-tag').value;
    const searchTerm = document.getElementById('search-input').value.trim().toLowerCase();
    const sortMode = document.getElementById('sort-mode').value;
    const organizeBy = document.getElementById('organize-by').value;
    const spineMode = document.getElementById('view-mode').value === 'spine';

    let workingLibrary = visibleBooks().filter(b =>
        (selectedKind === "All" || (selectedKind === "Fiction" ? FICTION_GENRES : NONFICTION_GENRES).includes(b.genre)) &&
        (selectedStatus === "All" || b.status === selectedStatus) &&
        (selectedGenre === "All" || b.genre === selectedGenre) &&
        (selectedOwned === "All" || (selectedOwned === "Lent" ? isLentOut(b) : selectedOwned === "Owned" ? !!b.owned : !b.owned)) &&
        (selectedSticky === "Show" || (selectedSticky === "Only" ? isStickyPlaceholder(b) : !isStickyPlaceholder(b))) &&
        (selectedTag === "All" || (b.tags && b.tags.includes(selectedTag))) &&
        (searchTerm === "" || b.title.toLowerCase().includes(searchTerm) || (b.authors || []).some(a => a.toLowerCase().includes(searchTerm)))
    );

    if (sortMode === "author") {
        workingLibrary.sort((a, b) => {
            const nameA = getAuthorLastName((a.authors || [])[0]).toLowerCase();
            const nameB = getAuthorLastName((b.authors || [])[0]).toLowerCase();
            return nameA.localeCompare(nameB);
        });
    } else if (sortMode === "rating") {
        workingLibrary.sort((a, b) =>
            normalizeRating(b.rating) - normalizeRating(a.rating) || a.title.localeCompare(b.title));
    } else {
        // Custom (drag & drop) order - sorting by the persisted
        // sortOrder, not just whatever order IndexedDB happened to
        // return, is what makes a drag survive a reload.
        workingLibrary.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    }

    if (workingLibrary.length === 0) {
        room.innerHTML = library.length === 0
            ? `<p class="empty-note">Your shelf is empty - add a book to get started!</p>`
            : `<p class="empty-note">No books match this view yet.</p>`;
        placeCat();
        return;
    }

    let sectionKeys;
    if (organizeBy === 'status') {
        sectionKeys = STATUSES;
    } else if (organizeBy === 'author') {
        const authorNames = [...new Set(workingLibrary.flatMap(b => b.authors || []))].sort((a, b) => {
            const cmp = getAuthorLastName(a).toLowerCase().localeCompare(getAuthorLastName(b).toLowerCase());
            return cmp !== 0 ? cmp : a.localeCompare(b);
        });
        const hasNoAuthor = workingLibrary.some(b => !b.authors || b.authors.length === 0);
        sectionKeys = hasNoAuthor ? [...authorNames, NO_AUTHOR_LABEL] : authorNames;
    } else if (organizeBy === 'series') {
        const seriesNames = [...new Set(workingLibrary.map(b => b.series).filter(Boolean))].sort((a, b) => a.localeCompare(b));
        const hasNoSeries = workingLibrary.some(b => !b.series);
        sectionKeys = hasNoSeries ? [...seriesNames, NO_SERIES_LABEL] : seriesNames;
    } else if (organizeBy === 'tag') {
        const tagNames = [...new Set(workingLibrary.flatMap(b => b.tags || []))].sort((a, b) => a.localeCompare(b));
        const hasNoTags = workingLibrary.some(b => !b.tags || b.tags.length === 0);
        sectionKeys = hasNoTags ? [...tagNames, NO_TAGS_LABEL] : tagNames;
    } else if (organizeBy === 'rating') {
        sectionKeys = [5, 4, 3, 2, 1, 0];
    } else {
        sectionKeys = getAllGenres();
    }

    const groupField = getActiveGroupField();
    const draggableEnabled = groupField !== null;
    let renderedAny = false;

    sectionKeys.forEach(key => {
        const booksInSection = workingLibrary.filter(b => {
            if (organizeBy === 'series') {
                return key === NO_SERIES_LABEL ? !b.series : b.series === key;
            }
            if (organizeBy === 'tag') {
                return key === NO_TAGS_LABEL ? (!b.tags || b.tags.length === 0) : (b.tags && b.tags.includes(key));
            }
            if (organizeBy === 'author') {
                return key === NO_AUTHOR_LABEL ? (!b.authors || b.authors.length === 0) : (b.authors && b.authors.includes(key));
            }
            if (organizeBy === 'rating') {
                return normalizeRating(b.rating) === key;
            }
            return (b[organizeBy] || "Unknown") === key;
        });
        // In Rating view with drag enabled, keep every star level's shelf
        // (even empty ones) so a book can be dragged to re-rate it.
        const keepEmpty = organizeBy === 'rating' && draggableEnabled;
        if (booksInSection.length === 0 && !keepEmpty) return;
        renderedAny = true;

        const isSeriesGroup = organizeBy === 'series' && key !== NO_SERIES_LABEL;
        let seriesTotal = 0;

        if (isSeriesGroup) {
            booksInSection.sort((a, b) => {
                const na = Number.isFinite(a.seriesNumber) ? a.seriesNumber : Infinity;
                const nb = Number.isFinite(b.seriesNumber) ? b.seriesNumber : Infinity;
                return na !== nb ? na - nb : a.title.localeCompare(b.title);
            });
            // Missing-slot placeholders and the owned/total count need the
            // FULL series (not just what survives the current status/
            // genre/search filters) - otherwise a filtered-out book you
            // actually own would get flagged as "missing".
            seriesTotal = visibleBooks()
                .filter(b => b.series === key)
                .reduce((max, b) => Math.max(max, b.seriesTotal || 0), 0);
        }

        const section = document.createElement('div');
        section.className = 'genre-section';

        const title = document.createElement('div');
        title.className = 'genre-title';
        if (organizeBy === 'status') {
            title.classList.add(STATUS_TAG_CLASS[key] || 'tag-status-other');
        }
        title.innerText = organizeBy === 'rating' ? RATING_LABELS[key] : key;

        const shelf = document.createElement('div');
        shelf.className = spineMode ? 'shelf spine-shelf' : 'shelf';
        shelf.dataset.group = key;

        const countBadge = document.createElement('span');
        countBadge.className = 'shelf-count';
        countBadge.innerText = seriesTotal > 0 ? `${booksInSection.length} of ${seriesTotal}` : booksInSection.length;
        // appended to the section, not the shelf - the shelf scrolls
        // horizontally, and a child of it scrolls right along with the
        // books, dragging the count off to the side as you scroll.
        section.appendChild(countBadge);

        if (isSeriesGroup) {
            const ownedNumbers = new Set(
                visibleBooks().filter(b => b.series === key).map(b => b.seriesNumber).filter(n => Number.isFinite(n))
            );
            const refWidth = booksInSection.length ? booksInSection[0].width : 120;
            let bi = 0;

            for (let slot = 1; slot <= seriesTotal; slot++) {
                while (bi < booksInSection.length && booksInSection[bi].seriesNumber === slot) {
                    shelf.appendChild(decorateSeriesBookElement(booksInSection[bi], draggableEnabled, spineMode));
                    bi++;
                }
                if (!ownedNumbers.has(slot)) {
                    shelf.appendChild(buildMissingSeriesSlot(key, slot, seriesTotal, spineMode, refWidth));
                }
            }
            // anything left over has no series number, or a number past
            // the declared total - still show it, just at the end.
            while (bi < booksInSection.length) {
                shelf.appendChild(decorateSeriesBookElement(booksInSection[bi], draggableEnabled, spineMode));
                bi++;
            }
        } else {
            booksInSection.forEach(book => {
                shelf.appendChild(buildBookElement(book, draggableEnabled, spineMode));
            });
        }

        if (booksInSection.length === 0) {
            shelf.classList.add('shelf-empty');
            const hint = document.createElement('span');
            hint.className = 'shelf-empty-hint';
            hint.innerText = 'Drag a book here to rate it';
            shelf.appendChild(hint);
        }

        if (draggableEnabled) {
            attachShelfDropHandlers(shelf);
        }

        section.dataset.expandKey = `${organizeBy}::${key}`;
        section.dataset.draggable = draggableEnabled ? '1' : '';

        const expandBtn = document.createElement('button');
        expandBtn.type = 'button';
        expandBtn.className = 'shelf-expand-btn';
        expandBtn.addEventListener('click', () => {
            const expandKey = section.dataset.expandKey;
            if (expandedShelves.has(expandKey)) {
                expandedShelves.delete(expandKey);
            } else {
                expandedShelves.add(expandKey);
            }
            saveExpandedShelves();
            layoutShelfSection(section);
        });

        section.appendChild(title);
        section.appendChild(shelf);
        section.appendChild(expandBtn);
        room.appendChild(section);
    });

    if (!renderedAny) {
        room.innerHTML = library.length === 0
            ? `<p class="empty-note">Your shelf is empty - add a book to get started!</p>`
            : `<p class="empty-note">No books match this view yet.</p>`;
        placeCat();
        restoreShelfScroll = null;
        return;
    }

    // Needs to run after every section is in the DOM - wrapping into
    // rows and the "does it overflow" check both measure real widths.
    layoutAllShelfSections();
    restoreShelfScroll = null;
}

function attachShelfDropHandlers(shelf) {
    shelf.addEventListener('dragover', (e) => {
        e.preventDefault();
        const draggingElement = document.querySelector('.dragging');
        if (!draggingElement) return;
        const afterElement = getDragAfterElement(shelf, e.clientX);
        if (afterElement == null) {
            shelf.appendChild(draggingElement);
        } else {
            shelf.insertBefore(draggingElement, afterElement);
        }
    });

    shelf.addEventListener('drop', () => {
        reorderLibraryData();
    });
}

// ---------- Expandable shelves ----------

function loadExpandedShelves() {
    try {
        expandedShelves = new Set(JSON.parse(localStorage.getItem(EXPANDED_SHELVES_KEY)) || []);
    } catch (e) {
        expandedShelves = new Set();
    }
}

function saveExpandedShelves() {
    try {
        localStorage.setItem(EXPANDED_SHELVES_KEY, JSON.stringify([...expandedShelves]));
    } catch (e) {}
}

function layoutAllShelfSections() {
    const sections = [...document.querySelectorAll('.genre-section')];
    sections.forEach(section => layoutShelfSection(section, true));
    refreshShelfLeans(sections);
    placeCat();
}

function layoutShelfSection(section, skipLeans = false) {
    clearShelfLeans(section);
    // Fold any previous rows back into the first shelf (in order), so
    // re-laying out after a resize, toggle, or drag always starts from
    // the one-long-shelf state.
    const shelves = [...section.querySelectorAll('.shelf')];
    const firstShelf = shelves[0];
    if (!firstShelf) return;
    // keep the sideways scroll position (or the one from before a redraw)
    const prevScroll = restoreShelfScroll
        ? (restoreShelfScroll.get(section.dataset.expandKey) || 0)
        : firstShelf.scrollLeft;
    shelves.slice(1).forEach(row => {
        [...row.children].forEach(child => firstShelf.appendChild(child));
        row.remove();
    });
    firstShelf.classList.remove('shelf-continues');
    firstShelf.scrollLeft = 0;

    const btn = section.querySelector('.shelf-expand-btn');
    const overflows = firstShelf.scrollWidth > firstShelf.clientWidth + 1;
    const expanded = expandedShelves.has(section.dataset.expandKey);
    // a shelf that scrolls sideways gets the classic border ledge, so its
    // scrollbar sits above the ledge (see .shelf.scrolls)
    firstShelf.classList.toggle('scrolls', overflows && !expanded);

    btn.style.display = overflows ? '' : 'none';
    btn.classList.toggle('expanded', expanded);
    btn.title = expanded ? 'Collapse' : 'Show all';
    btn.setAttribute('aria-label', btn.title);
    if (!btn.firstElementChild) {
        btn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 9.5 Q12 16.5 18 9.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>`;
    }
    if (overflows && expanded) packShelfRows(section, firstShelf);
    if (overflows && !expanded && prevScroll) firstShelf.scrollLeft = prevScroll;
    if (!skipLeans) refreshShelfLeans([section]);
}

function packShelfRows(section, firstShelf) {
    // Greedily pack books into rows the width of the shelf, moving each
    // row past the first into its own .shelf so every row gets a ledge.
    // Rows share the same data-group, and reorderLibraryData reads
    // shelves in DOM order, so drag & drop across rows just works.
    const style = getComputedStyle(firstShelf);
    const gap = parseFloat(style.columnGap) || 0;
    const available = firstShelf.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);

    const rows = [[]];
    let rowWidth = 0;
    [...firstShelf.children].forEach(child => {
        const childStyle = getComputedStyle(child);
        const w = child.offsetWidth + parseFloat(childStyle.marginLeft) + parseFloat(childStyle.marginRight);
        const needed = rows[rows.length - 1].length ? rowWidth + gap + w : w;
        if (needed > available && rows[rows.length - 1].length) {
            rows.push([child]);
            rowWidth = w;
        } else {
            rows[rows.length - 1].push(child);
            rowWidth = needed;
        }
    });

    let insertAfter = firstShelf;
    rows.slice(1).forEach(rowChildren => {
        const row = document.createElement('div');
        row.className = firstShelf.className.replace(' shelf-continues', '') + ' shelf-row';
        row.dataset.group = firstShelf.dataset.group;
        rowChildren.forEach(child => row.appendChild(child));
        if (section.dataset.draggable) attachShelfDropHandlers(row);
        // the row above runs straight on into this one - no ledge between
        insertAfter.classList.add('shelf-continues');
        insertAfter.after(row);
        insertAfter = row;
    });
}


// ---------- Leaning last book ----------
// When a shelf (or an expanded shelf's last row) has room left over,
// its last book tips over to rest on its neighbour, like a real shelf.
const LEAN_MIN_ROOM = 40;
const LEAN_MAX_DEG = 12;
const SPINE_LEAN_GAP = 12; // spines sit flush, so the leaner steps out this far
let leanState = new Map(); // bookId -> lean angle (deg) from the last layout
let animateLeans = false;  // set by save/add/delete/drop to animate changes

function clearShelfLeans(section) {
    section.querySelectorAll('.book.leaning').forEach(b => {
        b.classList.remove('leaning', 'leaning-spine');
        b.style.removeProperty('--lean');
    });
}

function computeShelfLean(section) {
    const rows = [...section.querySelectorAll('.shelf')];
    const row = rows[rows.length - 1];
    if (!row || row.scrollWidth > row.clientWidth + 1) return null;

    const children = [...row.children];
    if (children.length < 2) return null;
    const last = children[children.length - 1];
    const prev = children[children.length - 2];
    const isRealBook = el => el.classList.contains('book') && !el.classList.contains('series-missing') && !el.classList.contains('sticky-book');
    // an empty spot (lent out) has nothing to lean, or lean on
    if (!isRealBook(last) || !prev.classList.contains('book') || last.classList.contains('lent-out') || prev.classList.contains('lent-out')) return null;

    const style = getComputedStyle(row);
    const spine = row.classList.contains('spine-shelf');
    const shelfGap = parseFloat(style.columnGap) || 0;
    const gap = spine ? SPINE_LEAN_GAP : shelfGap;
    if (gap <= 0) return null;

    const available = row.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const used = children.reduce((sum, c) => sum + c.offsetWidth, 0) + shelfGap * (children.length - 1) + (spine ? gap : 0);
    if (available - used < LEAN_MIN_ROOM) return null;

    const contactHeight = Math.min(last.offsetHeight, prev.offsetHeight);
    if (contactHeight <= 0) return null;
    const deg = Math.min(LEAN_MAX_DEG, Math.atan(gap / contactHeight) * 180 / Math.PI);
    return { el: last, deg, spine };
}

// In Covers view a leaning book on every shelf is a bit much, so only
// a couple of shelves get one. The pick is by a hash of the shelf's
// name (not random), so the same shelves lean every time you load.
const MAX_COVER_LEANS = 2;

function shelfHash(key) {
    let h = 0x811c9dc5;
    for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
    return h;
}

// Which sections may lean right now. Decided across the whole page
// (not just the sections being re-laid out) so it stays consistent.
function leaningSectionKeys() {
    if (!appSettings.lean) return new Set();
    const all = [...document.querySelectorAll('.genre-section')];
    const candidates = all.filter(sec => computeShelfLean(sec));
    const spineMode = document.getElementById('view-mode').value === 'spine';
    if (spineMode) return new Set(candidates.map(sec => sec.dataset.expandKey));
    return new Set(candidates
        .map(sec => sec.dataset.expandKey)
        .sort((a, b) => shelfHash(a) - shelfHash(b))
        .slice(0, MAX_COVER_LEANS));
}

function refreshShelfLeans(sections) {
    const animate = animateLeans && !prefersReducedMotion();
    animateLeans = false;
    const allowed = leaningSectionKeys();

    sections.forEach(section => {
        const lean = allowed.has(section.dataset.expandKey) ? computeShelfLean(section) : null;
        const idsHere = [...section.querySelectorAll('.book[data-id]')].map(b => b.dataset.id);

        // books here that used to lean but don't now: stand back up
        idsHere.forEach(id => {
            const oldDeg = leanState.get(id);
            if (oldDeg === undefined || (lean && lean.el.dataset.id === id)) return;
            leanState.delete(id);
            const el = section.querySelector(`.book[data-id="${CSS.escape(id)}"]`);
            if (animate && el) {
                el.animate([
                    { rotate: `${-oldDeg}deg`, transformOrigin: 'bottom left' },
                    { rotate: '0deg', transformOrigin: 'bottom left' }
                ], { duration: 380, easing: 'cubic-bezier(.3, 1.4, .5, 1)' });
            }
        });

        if (!lean) return;
        const id = lean.el.dataset.id;
        lean.el.classList.add('leaning');
        if (lean.spine) lean.el.classList.add('leaning-spine');
        lean.el.style.setProperty('--lean', `${-lean.deg}deg`);
        const wasLeaning = leanState.has(id);
        leanState.set(id, lean.deg);
        if (animate && !wasLeaning) {
            // tip over onto the neighbour with a little bounce
            lean.el.animate([
                { rotate: '0deg' },
                { rotate: `${-lean.deg * 1.35}deg`, offset: 0.65 },
                { rotate: `${-lean.deg}deg` }
            ], { duration: 520, easing: 'ease-in' });
        }
    });
}

let shelfResizeTimer = null;
window.addEventListener('resize', () => {
    clearTimeout(shelfResizeTimer);
    shelfResizeTimer = setTimeout(layoutAllShelfSections, 150);
});

function getDragAfterElement(shelf, x) {
    const draggableElements = [...shelf.querySelectorAll('.book:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = x - box.left - box.width / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

async function reorderLibraryData() {
    const groupField = getActiveGroupField();
    if (!groupField) return;

    // A re-render below can remove the dragged element before its
    // dragend fires, which would leave hover disabled on every book.
    document.body.classList.remove('drag-active');
    animateLeans = true;

    const updatedLibrary = [];
    const activeShelves = document.querySelectorAll('.shelf');

    activeShelves.forEach(shelf => {
        const currentGroup = shelf.dataset.group;
        const bookElements = shelf.querySelectorAll('.book');

        bookElements.forEach(elem => {
            const bookId = elem.dataset.id;
            const bookMatch = library.find(b => b.id === bookId);
            if (bookMatch) {
                if (groupField === 'status' && bookMatch.status !== currentGroup) {
                    bookMatch.statusSince = Date.now();
                }
                // data-group is always a string; ratings are stored as numbers
                bookMatch[groupField] = groupField === 'rating' ? normalizeRating(currentGroup) : currentGroup;
                updatedLibrary.push(bookMatch);
            }
        });
    });

    library.forEach(b => {
        if (!updatedLibrary.some(ub => ub.id === b.id)) {
            updatedLibrary.push(b);
        }
    });

    // Persist the drag order itself, not just which genre/status group
    // each book landed in - without this, a reload re-fetches from
    // IndexedDB sorted by id (creation order) and the arrangement you
    // just dragged into place is gone.
    updatedLibrary.forEach((b, idx) => { b.sortOrder = idx; });

    library = updatedLibrary;
    if (groupField === 'rating') {
        // Re-rating changes more than position - the hover stars, the
        // shelf counts, and which shelves are empty - so redraw fully.
        renderBookshelf();
    } else {
        // A drop can overfill one row of an expanded shelf (or empty one
        // out) - re-pack the rows so nothing ends up needing a scrollbar.
        layoutAllShelfSections();
    }
    await dbBulkPut(library);
}

// ---------- Secret purge ----------

function handleSecretHeartClick() {
    const now = Date.now();
    secretHeartClicks = secretHeartClicks.filter(t => now - t < SECRET_HEART_WINDOW_MS);
    secretHeartClicks.push(now);
    if (secretHeartClicks.length >= 3) {
        secretHeartClicks = [];
        togglePrivateBooks();
    }
}

async function togglePrivateBooks() {
    // letters only, so variants with extra letters or symbols match too
    const isPrivateLabel = (label) => (label || '').toLowerCase().replace(/[^a-z]/g, '').startsWith('lgbt');
    const isPrivate = (b) => isPrivateLabel(b.genre) || (b.tags || []).some(isPrivateLabel);

    const matches = library.filter(isPrivate);
    if (matches.length > 0) {
        // Toggle: if any matching book is currently showing, hide the
        // whole set; if they're all already hidden, bring them back.
        // Same three-click gesture both hides and un-hides, so there's
        // still a way back in without the data ever leaving storage.
        const shouldHide = matches.some(b => !b.hiddenSecret);
        matches.forEach(b => { b.hiddenSecret = shouldHide; });
        await dbBulkPut(matches);

        populateAuthorOptions();
        populateSeriesOptions();
        populateFilterTagSelect();
        renderBookshelf();
    }

    // Pulses regardless of whether anything matched, so the heart's
    // reaction never gives away whether there was anything there.
    const heart = document.getElementById('secret-heart');
    if (heart) {
        heart.classList.add('pulse');
        setTimeout(() => heart.classList.remove('pulse'), 400);
    }
}

// ---------- Pull a book out to open it ----------
// A click (never fired after a drag) slides the book out of the shelf
// toward you, then opens it; Cancel/X slides it back in.
const PULL_OUT_POSE = { transform: 'translateY(-34px) scale(1.06) rotate(-2deg)', boxShadow: '12px 22px 26px rgba(0,0,0,0.45)' };
let pulledBook = null;

function pullOutAndOpen(bookDiv, id) {
    if (pulledBook && pulledBook.pending) return; // double click
    if (prefersReducedMotion()) {
        openModal(id);
        return;
    }
    // start from the current (usually hover-lifted) pose, not the
    // resting one, or it dips down to the shelf before sliding out
    const current = getComputedStyle(bookDiv).transform;
    const anim = bookDiv.animate([{ transform: current === 'none' ? 'none' : current }, PULL_OUT_POSE],
        { duration: 220, easing: 'cubic-bezier(.2, .8, .3, 1)', fill: 'forwards' });
    pulledBook = { el: bookDiv, anim, pending: true };
    setTimeout(() => {
        if (pulledBook) pulledBook.pending = false;
        openModal(id);
    }, 220);
}

function slidePulledBookBack() {
    const pulled = pulledBook;
    pulledBook = null;
    if (!pulled) return;
    if (!pulled.el.isConnected || prefersReducedMotion()) {
        pulled.anim.cancel();
        return;
    }
    const back = pulled.el.animate([PULL_OUT_POSE, { transform: 'none' }],
        { duration: 200, easing: 'ease-in', fill: 'forwards' });
    setTimeout(() => {
        pulled.anim.cancel();
        back.cancel();
    }, 200);
}

// ---------- Dust ----------
const DAY_MS = 24 * 60 * 60 * 1000;
const DUST_LIGHT_MS = 90 * DAY_MS;
const DUST_HEAVY_MS = 180 * DAY_MS;

const LENT_DUST_LIGHT_MS = 30 * DAY_MS;
const LENT_DUST_HEAVY_MS = 90 * DAY_MS;

// 0 = clean, 1 = light dust, 2 = heavy. Want to Read books gather dust,
// counting from whenever they entered that status or were last dusted
// off. So does the empty spot a lent book left, only faster: a month
// gone, then three.
function getDustLevel(book) {
    if (!appSettings.dust) return 0;
    if (isLentOut(book)) {
        const age = Date.now() - Math.max(book.lentAt || 0, book.dustedAt || 0);
        return !book.lentAt ? 0 : age >= LENT_DUST_HEAVY_MS ? 2 : age >= LENT_DUST_LIGHT_MS ? 1 : 0;
    }
    if (book.status !== 'Want to Read') return 0;
    const since = Math.max(book.statusSince || 0, book.dustedAt || 0);
    if (!since) return 0;
    const age = Date.now() - since;
    return age >= DUST_HEAVY_MS ? 2 : age >= DUST_LIGHT_MS ? 1 : 0;
}

async function blowDust(bookDiv, id) {
    if (bookDiv.classList.contains('dust-blowing')) return;
    bookDiv.classList.add('dust-blowing');
    burstFrom(bookDiv.querySelector('.dust-layer') || bookDiv, 16, 70, () => {
        const puff = document.createElement('span');
        puff.className = 'fx-dust';
        return puff;
    });
    setTimeout(() => {
        bookDiv.classList.remove('dusty', 'dusty-heavy');
        const layer = bookDiv.querySelector('.dust-layer');
        if (layer) layer.remove();
    }, 650);

    // dusting is permanent - it starts slowly building up again from now
    const book = library.find(b => b.id === id);
    if (book) {
        book.dustedAt = Date.now();
        await dbPut(book);
    }
}

// ---------- Lent-out books ----------
// The book's spot stays on the shelf as an empty outline, with a paper
// tag on a string saying who has it.
function isLentOut(book) {
    return !!(book.lentTo && book.owned) && !isStickyPlaceholder(book);
}

function addLentTag(bookDiv, book) {
    bookDiv.classList.add('lent-out');
    const shade = document.createElement('span');
    shade.className = 'lent-shade';
    const tag = document.createElement('span');
    tag.className = 'lent-tag';
    tag.innerHTML = '<span class="lent-string"></span><span class="lent-card"><span class="lent-label">lent to</span><span class="lent-name"></span></span>';
    const name = tag.querySelector('.lent-name');
    name.textContent = book.lentTo;
    // the tag is narrow: long words are written smaller so they don't split
    const longest = Math.max(...book.lentTo.split(/\s+/).map(w => w.length));
    if (longest > 10) name.classList.add('longer');
    else if (longest > 7) name.classList.add('long');
    // a little different swing for each book
    tag.style.setProperty('--swing-delay', `${-(shelfHash(book.id) % 40) / 10}s`);
    bookDiv.append(shade, tag);
    bookDiv.title = book.lentAt
        ? `"${book.title}" is lent to ${book.lentTo} (${friendlyAge(book.lentAt)})`
        : `"${book.title}" is lent to ${book.lentTo}`;
}

// ---------- Shelf cat ----------
// Hand-drawn pixel frames: k = black fur, y = yellow eye, p = pink,
// e = closed-eye line. Drawn at 4px per pixel.
const CAT_PALETTE = { k: '#1d1626', y: '#ffe066', p: '#ff9eb0', e: '#5b4f6e' };
// in dark mode the cat is white, so it shows up on the dark page
const CAT_PALETTE_DARK = { k: '#f3eefa', y: '#3a9a6b', p: '#ff8fa8', e: '#9a8fae' };
const catPalette = () => document.documentElement.dataset.mode === 'dark' ? CAT_PALETTE_DARK : CAT_PALETTE;
const CAT_FRAMES = {
    sleep: [
        '..............k.....k.',
        '.............kpk...kpk',
        '.............kkkkkkkkk',
        '.....kkkkkkkkkkkkkkkkk',
        '...kkkkkkkkkkkkkkkkkkk',
        '..kkkkkkkkkkkeekkkeekk',
        '.kkkkkkkkkkkkkkkkpkkk.',
        'kkkkkkkkkkkkkkkkkkkkk.',
        'kk.kkkkkkkkkkkkkkkkkk.',
        'kkkkkkkkkkkkkkkkkkkkk.',
        '.kkkkkkkkkkkkkkkkkkk..'
    ],
    awake: [
        '..............k.....k.',
        '.............kpk...kpk',
        '.............kkkkkkkkk',
        '.....kkkkkkkkkkykkkykk',
        '...kkkkkkkkkkkkykkkykk',
        '..kkkkkkkkkkkkkkkkkkkk',
        '.kkkkkkkkkkkkkkkkpkkk.',
        'kkkkkkkkkkkkkkkkkkkkk.',
        'kk.kkkkkkkkkkkkkkkkkk.',
        'kkkkkkkkkkkkkkkkkkkkk.',
        '.kkkkkkkkkkkkkkkkkkk..'
    ],
    stretch: [
        '.k......................',
        '.k......................',
        '.kk.....................',
        '..kkkkkk................',
        '..kkkkkkkk.......k....k.',
        '..kkkkkkkkkkk...kpk..kpk',
        '..kkkkkkkkkkkkkkkkkkkkkk',
        '...kkkkkkkkkkkkkkeekkeek',
        '...kkk..kkkkkkkkkkkpkkk.',
        '...kk.......kkkkkkkkkkkk',
        '...kkk.......kkkkkkkkkkk'
    ]
};
const CAT_PX = 4;
let catState = { index: null, frac: 0.5, busy: false };

function catFrameSvg(name) {
    const rows = CAT_FRAMES[name];
    const w = rows[0].length;
    const h = rows.length;
    let rects = '';
    rows.forEach((row, y) => {
        [...row].forEach((ch, x) => {
            const palette = catPalette();
            if (palette[ch]) rects += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${palette[ch]}"/>`;
        });
    });
    return `<svg width="${w * CAT_PX}" height="${h * CAT_PX}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
}

function setCatFrame(name) {
    const cat = document.getElementById('shelf-cat');
    const old = cat.querySelector('svg');
    if (old) old.remove();
    cat.insertAdjacentHTML('afterbegin', catFrameSvg(name));
    cat.classList.toggle('sleeping', name === 'sleep');
    catState.frame = name;
}

// Where the cat sits: on top of a shelf box, in document coordinates.
// The cat sits in the clear part of a shelf's top: right of the shelf's
// title tag and left of the book count, never on either of them.
const CAT_HALF_WIDTH = 46;

function catSpot(index, frac) {
    const sections = document.querySelectorAll('.genre-section');
    const section = sections[index];
    const shelf = section && section.querySelector('.shelf');
    if (!shelf) return null;
    const rect = shelf.getBoundingClientRect();
    const title = section.querySelector('.genre-title');
    const count = section.querySelector('.shelf-count');
    let min = rect.left + CAT_HALF_WIDTH + 6;
    let max = rect.right - CAT_HALF_WIDTH - 6;
    if (title) min = Math.max(min, title.getBoundingClientRect().right + CAT_HALF_WIDTH + 8);
    if (count && count.textContent) max = Math.min(max, count.getBoundingClientRect().left - CAT_HALF_WIDTH - 6);
    let x = rect.left + rect.width * frac;
    // squeeze into the clear stretch (if a long title leaves none, sit at
    // its far end rather than on top of it)
    x = max >= min ? Math.min(Math.max(x, min), max) : min;
    return { x: x + window.scrollX, y: rect.top + window.scrollY, roomy: max >= min };
}

// a random shelf (other than `skip`) with room for the cat, if any
function pickCatShelf(skip) {
    const count = document.querySelectorAll('.genre-section').length;
    const all = [...Array(count).keys()].filter(i => i !== skip);
    const roomy = all.filter(i => { const sp = catSpot(i, 0.5); return sp && sp.roomy; });
    const pool = roomy.length ? roomy : all;
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : skip;
}

function placeCat() {
    const cat = document.getElementById('shelf-cat');
    if (!cat) return;
    const count = document.querySelectorAll('.genre-section').length;
    if (count === 0 || !appSettings.cat) {
        cat.style.display = 'none';
        return;
    }
    if (catState.index === null || catState.index >= count) {
        catState.index = pickCatShelf(null);
        catState.frac = 0.3 + Math.random() * 0.5;
    }
    if (!cat.querySelector('svg')) setCatFrame('sleep');
    cat.style.display = 'block';
    const spot = catSpot(catState.index, catState.frac);
    cat.style.left = (spot.x - cat.offsetWidth / 2) + 'px';
    cat.style.top = (spot.y - cat.offsetHeight) + 'px';
}

function wakeCat() {
    if (catState.busy) return;
    catState.busy = true;
    setCatFrame('awake');
    setTimeout(() => {
        setCatFrame('stretch');
        setTimeout(hopCat, 650);
    }, 350);
}

function hopCat() {
    const cat = document.getElementById('shelf-cat');
    const count = document.querySelectorAll('.genre-section').length;
    if (!count) {
        catState.busy = false;
        return;
    }
    // another shelf if there is one, otherwise the other end of this one
    let index = catState.index;
    if (count > 1) {
        index = pickCatShelf(catState.index);
    }
    let frac = 0.3 + Math.random() * 0.5;
    if (count === 1 && Math.abs(frac - catState.frac) < 0.2) frac = catState.frac < 0.55 ? 0.78 : 0.32;

    const from = catSpot(catState.index, catState.frac);
    const to = catSpot(index, frac);
    setCatFrame('awake');
    cat.classList.toggle('flipped', to.x < from.x);

    const land = () => {
        catState.index = index;
        catState.frac = frac;
        placeCat();
        burstFrom(cat, 5, 22, () => {
            const puff = document.createElement('span');
            puff.className = 'fx-dust';
            return puff;
        });
        setTimeout(() => {
            setCatFrame('sleep');
            catState.busy = false;
        }, 2000);
    };

    if (prefersReducedMotion() || !from || !to) {
        land();
        return;
    }
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const hop = cat.animate([
        { transform: 'translate(0, 0)' },
        { transform: `translate(${dx / 2}px, ${Math.min(0, dy) - 90}px)`, offset: 0.5 },
        { transform: `translate(${dx}px, ${dy}px)` }
    ], { duration: 750, easing: 'cubic-bezier(.4, 0, .6, 1)', fill: 'forwards' });
    setTimeout(() => {
        hop.cancel();
        land();
    }, 750);
}

function initShelfCat() {
    const cat = document.getElementById('shelf-cat');
    // body is the containing block for absolute coords
    document.body.appendChild(cat);
    cat.addEventListener('pointerenter', (e) => {
        if (e.pointerType === 'mouse' || e.pointerType === 'pen') wakeCat();
    });
    cat.addEventListener('click', wakeCat); // taps on touch screens
    window.addEventListener('load', placeCat);
}

// (the search box's flowing border is pure CSS - see #search-input:focus)
// Rebuilding every shelf on each keystroke made typing stutter with a
// real library (all the cover images get re-laid out), so wait for a
// short pause in typing and redraw once.
const SEARCH_DEBOUNCE_MS = 160;
let searchRenderTimer = null;

function handleSearchInput() {
    const input = document.getElementById('search-input');
    document.getElementById('search-clear').classList.toggle('visible', input.value !== '');
    clearTimeout(searchRenderTimer);
    searchRenderTimer = setTimeout(renderBookshelf, SEARCH_DEBOUNCE_MS);
}

function clearSearch() {
    const input = document.getElementById('search-input');
    input.value = '';
    document.getElementById('search-clear').classList.remove('visible');
    clearTimeout(searchRenderTimer);
    renderBookshelf();
    input.focus();
}

function selectViewMode(value) {
    document.getElementById('view-mode').value = value;
    document.querySelectorAll('[data-view-mode]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.viewMode === value);
    });
    renderBookshelf();
}

function selectOrganizeBy(value) {
    document.getElementById('organize-by').value = value;
    document.querySelectorAll('[data-organize]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.organize === value);
    });
    renderBookshelf();
}

function selectFilterStatus(value) {
    document.getElementById('filter-status').value = value;
    document.querySelectorAll('[data-filter-status]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filterStatus === value);
    });
    renderBookshelf();
}

// Sticky-note filter: Show (mixed in), Hide (only real books), or Only
// (just the to-get notes - a shopping list). Remembered between visits.
const STICKY_FILTER_KEY = 'bookShelfStickyFilter';
let stickyFilter = 'Show';
try {
    const saved = localStorage.getItem(STICKY_FILTER_KEY);
    if (['Show', 'Hide', 'Only'].includes(saved)) stickyFilter = saved;
} catch (e) {}

function selectFilterSticky(value, rerender = true) {
    stickyFilter = value;
    try { localStorage.setItem(STICKY_FILTER_KEY, value); } catch (e) {}
    document.querySelectorAll('[data-filter-sticky]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filterSticky === value);
    });
    if (rerender) renderBookshelf();
}

function selectFilterOwned(value) {
    document.getElementById('filter-owned').value = value;
    document.querySelectorAll('[data-filter-owned]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filterOwned === value);
    });
    renderBookshelf();
}

// custom genres are neither, so they only show under All
function selectFilterKind(value) {
    document.getElementById('filter-kind').value = value;
    document.querySelectorAll('[data-filter-kind]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filterKind === value);
    });
    renderBookshelf();
}
