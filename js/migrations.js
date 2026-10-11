async function backfillMissingWidth() {
    // A book missing `width` (e.g. a hand-edited or partial import)
    // turns spine-mode's size math into NaN, collapsing it to nothing
    // visually. buildBookElement now defaults this at render time too,
    // but fix the stored data itself so the Cover Width slider reflects
    // a real saved value instead of silently falling back every time.
    const needsWidth = library.filter(b => !Number.isFinite(b.width));
    if (needsWidth.length === 0) return;

    needsWidth.forEach(b => { b.width = 120; });
    await dbBulkPut(needsWidth);
}

function normalizeRating(rating) {
    const n = Math.round(Number(rating));
    return Number.isFinite(n) && n >= 1 && n <= 5 ? n : 0;
}

async function migrateGenresToTags() {
    // Audience/format labels (Young Adult, Poetry, Essays...) and topics
    // (Critical Thinking) used to be genres; they're tags now. Keep the
    // label as a tag. Those, plus the old catch-all "Fiction", get a real
    // genre: by author when we know them (or a series-mate's author, for
    // one saved as "Unknown"), else RETIRED_GENRE_HOMES.
    const moved = library.filter(b => RETIRED_GENRE_HOMES[b.genre]);
    if (moved.length === 0) return;
    const byAuthor = b => (b.authors || []).map(a => FICTION_BY_AUTHOR[a.toLowerCase()]).find(Boolean);
    const bySeries = b => b.series && library
        .filter(o => o !== b && o.series === b.series).map(byAuthor).find(Boolean);
    moved.forEach(b => {
        const tag = GENRES_NOW_TAGS[b.genre];
        if (tag) {
            b.tags = b.tags || [];
            if (!b.tags.some(t => t.toLowerCase() === tag.toLowerCase())) b.tags.push(tag);
        }
        const fictionish = !NONFICTION_GENRES.includes(RETIRED_GENRE_HOMES[b.genre]);
        b.genre = (fictionish && (byAuthor(b) || bySeries(b))) || RETIRED_GENRE_HOMES[b.genre];
    });
    await dbBulkPut(moved);
}

async function backfillStatusSince() {
    // Dust needs to know how long a book has waited. Ids are
    // Date.now() at creation, so that's the best guess for books made
    // before statusSince existed; anything else starts counting now.
    const missing = library.filter(b => !Number.isFinite(b.statusSince));
    if (missing.length === 0) return;
    const now = Date.now();
    missing.forEach(b => {
        const created = Number(b.id);
        b.statusSince = Number.isFinite(created) && created > 1e12 && created <= now ? created : now;
    });
    await dbBulkPut(missing);
}

async function backfillRatings() {
    // Books from before the rating system have no `rating` (or a
    // non-numeric one like "" / "0" from a backup), which never
    // strictly equals any shelf key - so they vanished from every
    // Rating shelf, Unrated included. Store a clean 0-5 integer.
    const needsRating = library.filter(b => b.rating !== normalizeRating(b.rating));
    if (needsRating.length === 0) return;

    needsRating.forEach(b => { b.rating = normalizeRating(b.rating); });
    await dbBulkPut(needsRating);
}

async function backfillSortOrder() {
    // Books predate the sortOrder field (used to persist drag-and-drop
    // position). Seed it from the current array order - which, fresh
    // from dbGetAll(), is id/creation order - so nothing visually jumps
    // around the first time this runs.
    const needsOrder = library.filter(b => !Number.isFinite(b.sortOrder));
    if (needsOrder.length === 0) return;

    library.forEach((b, idx) => {
        if (!Number.isFinite(b.sortOrder)) {
            b.sortOrder = idx;
        }
    });
    await dbBulkPut(needsOrder);
}

async function backfillImageRatios() {
    // Books added before per-image aspect ratio was tracked are stuck
    // showing the old fixed 2:3 box (and whatever cropping that caused)
    // until something computes and saves a ratio for them. Do that once
    // here instead of requiring every book to be manually re-edited.
    const needsRatio = library.filter(b => b.image && !b.imageRatio);
    if (needsRatio.length === 0) return;

    for (const book of needsRatio) {
        book.imageRatio = await getImageAspectRatio(book.image);
    }
    await dbBulkPut(needsRatio);
}

async function migrateSpineColorsForGammaFix() {
    // getImageEdgeColor used to average sRGB bytes directly, which reads
    // darker than the strip actually looks. One-time pass to recompute
    // already-cached spineColors for books with a cover image now that
    // the averaging is gamma-correct, instead of waiting on edits.
    if (localStorage.getItem(SPINE_GAMMA_FIX_KEY)) return;
    const withImages = library.filter(b => b.image);
    for (const book of withImages) {
        book.spineColor = await getImageEdgeColor(book.image) || book.color;
    }
    if (withImages.length > 0) await dbBulkPut(withImages);
    localStorage.setItem(SPINE_GAMMA_FIX_KEY, '1');
}

async function backfillSquareRatios() {
    // getImageAspectRatio used to cap width:height at 0.85, so a
    // genuinely square cover saved before that cap was raised to 1 is
    // stuck looking "nearly square" instead of square. Only touches
    // natural-mode images (no explicit ratioPreset) sitting right at
    // the old ceiling, so a deliberately-chosen 0.85 preset is untouched.
    const clamped = library.filter(b => b.image && !b.ratioPreset && b.imageRatio === 0.85);
    if (clamped.length === 0) return;

    for (const book of clamped) {
        book.imageRatio = await getImageAspectRatio(book.image);
    }
    await dbBulkPut(clamped);
}

async function backfillAuthorsField() {
    // Books predate the switch from a single free-text `author` string
    // to an `authors` array (multi-author support). Split the old string
    // on commas/"&"/"and" so existing multi-author entries typed as one
    // string come along as separate names instead of one combined blob.
    const needsAuthors = library.filter(b => !b.authors);
    if (needsAuthors.length === 0) return;

    for (const book of needsAuthors) {
        const legacy = (book.author || "Unknown").toString();
        const split = legacy.split(/,|&|\band\b/i).map(a => a.trim()).filter(Boolean);
        book.authors = split.length ? split : ["Unknown"];
        delete book.author;
    }
    await dbBulkPut(needsAuthors);
}

async function backfillSpineColors() {
    const needsColor = library.filter(b => !b.spineColor);
    if (needsColor.length === 0) return;

    for (const book of needsColor) {
        book.spineColor = book.image ? (await getImageEdgeColor(book.image) || book.color) : book.color;
    }
    await dbBulkPut(needsColor);
}

async function backfillTagCapitalization() {
    // Tags predate capitalizing on save, so a library built up earlier
    // can have mixed casing - which also breaks dedup elsewhere, since
    // "Fantasy" and "fantasy" land as two separate Set entries instead
    // of merging into one.
    const needsCap = library.filter(b => (b.tags || []).some(t => t !== capitalizeTag(t)));
    if (needsCap.length === 0) return;

    for (const book of needsCap) {
        book.tags = book.tags.map(capitalizeTag);
    }
    await dbBulkPut(needsCap);
}
