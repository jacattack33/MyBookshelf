// ---------- Shelf photo ----------
// One photo of a row of spines, split into a spine photo per book: the
// app guesses where each spine starts and ends, you drag, add or remove
// the dividers, then pick which book each slice is (or name a new one).
// The books can be standing on a shelf or lying in a stack.
// Opened from the Whole shelf button in the Add Book window.

const SHELF_PHOTO_FULL_MAX = 3200;   // the copy slices are cut from
const SHELF_PHOTO_SHOW_MAX = 2400;   // the copy shown (sharp when big)
const SHELF_PHOTO_VIEW_MAX = 1200;   // the copy searched for gaps
const SHELF_PHOTO_SPINE_MAX_H = 900; // a saved spine photo's height, at most
const SHELF_PHOTO_MIN_SLICE = 0.006; // dividers keep this far apart
// how much the colour must change (R+G+B, 0-765) to count as an edge:
// low enough for a cream book against a cream wall
const SHELF_PHOTO_EDGE_DIFF = 40;
const SHELF_PHOTO_MODE_KEY = 'shelfPhotoMode';
// a guessed end of a spine (or the shelf) is moved out this much (of
// the picture), so the cut keeps a sliver past the book's edge rather
// than shaving any of it off. Lines you drag go where you put them.
const SHELF_PHOTO_EDGE_PAD = 0.004;

// { img, turns, tilt, mode, full, view, pixels, rowPixels, bottom,
//   dividers, tops, ownTop, ends, ownEnd, blank, picks }
// Everything is measured "along the row": u runs across the spines
// (left to right on a shelf, top to bottom in a stack) and v along each
// spine (top to bottom on a shelf, left to right in a stack), both as
// fractions of the picture so they don't care how big it's drawn.
// dividers are u's. Each spine runs from tops[i] to its end: on a shelf
// that's the shelf itself (bottom), shared; in a stack each book has its
// own (ends[i]). ownTop/ownEnd/ownBottom are set once you've dragged one, so
// guessing again leaves it be. blank[i] marks a slice that isn't a
// book (the wall, a picture frame): guessed for the first and last
// slices, and set or cleared by hand. picks[i] is slice i's book: { id } or
// { isNew: true, title, author, genre }, or null.
let shelfPhoto = null;
let shelfPhotoDrag = null;
// 'shelf' or 'stack', answered on the first screen (null till then)
let shelfPhotoKind = null;

function shelfPhotoOpen() {
    return document.getElementById('shelf-photo-modal').style.display === 'flex';
}

function openShelfPhoto() {
    if (document.getElementById('book-modal').style.display === 'flex') closeModal();
    // last time's answer, if there was one
    shelfPhotoKind = null;
    try {
        const last = localStorage.getItem(SHELF_PHOTO_MODE_KEY);
        if (last === 'shelf' || last === 'stack') shelfPhotoKind = last;
    } catch (e) {}
    backToShelfPhotoPick();
    document.getElementById('shelf-photo-modal').style.display = 'flex';
}

// the first screen: shelf or stack, then the photo
function backToShelfPhotoPick() {
    shelfPhoto = null;
    shelfPhotoDrag = null;
    document.getElementById('shelf-photo-file').value = '';
    document.getElementById('shelf-photo-error').innerText = '';
    showShelfPhotoKind();
    showShelfPhotoStep('pick');
}

function pickShelfPhotoKind(kind) {
    shelfPhotoKind = kind;
    try { localStorage.setItem(SHELF_PHOTO_MODE_KEY, kind); } catch (e) {}
    document.getElementById('shelf-photo-error').innerText = '';
    showShelfPhotoKind();
}

function showShelfPhotoKind() {
    document.querySelectorAll('#shelf-photo-pick [data-sp-kind]').forEach(btn => {
        const on = btn.dataset.spKind === shelfPhotoKind;
        btn.classList.toggle('picked', on);
        btn.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    document.getElementById('shelf-photo-choose').disabled = !shelfPhotoKind;
    document.getElementById('shelf-photo-choose-hint').innerText = shelfPhotoKind
        ? '...or paste a picture anywhere in this window.'
        : 'Pick one first, then choose (or paste) your photo.';
}

function closeShelfPhoto() {
    document.getElementById('shelf-photo-modal').style.display = 'none';
    shelfPhoto = null;
    shelfPhotoDrag = null;
}

// 'pick' (choose a photo), 'split' (dividers and books) or 'done'
function showShelfPhotoStep(step) {
    const modal = document.getElementById('shelf-photo-modal');
    modal.dataset.step = step;
    document.getElementById('shelf-photo-pick').hidden = step !== 'pick';
    document.getElementById('shelf-photo-split').hidden = step !== 'split';
    document.getElementById('shelf-photo-done').hidden = step !== 'done';
    document.getElementById('shelf-photo-save').hidden = step !== 'split';
    document.getElementById('shelf-photo-cancel').innerText = step === 'done' ? 'Close' : 'Cancel';
    document.getElementById('shelf-photo-show').hidden = step !== 'done';
}

function handleShelfPhotoFile() {
    const input = document.getElementById('shelf-photo-file');
    if (input.files && input.files[0]) readFileAsDataURL(input.files[0]).then(loadShelfPhoto);
}

function loadShelfPhoto(dataUrl) {
    const img = new Image();
    img.onload = () => {
        const mode = shelfPhotoKind || 'shelf';
        shelfPhoto = { img, turns: 0, tilt: 0, mode, bottom: 0.97, ownBottom: false, dividers: [],
            tops: [0], ownTop: [false], ends: [1], ownEnd: [false], blank: [false], picks: [null] };
        document.getElementById('shelf-photo-tilt').value = 0;
        document.getElementById('shelf-photo-error').innerText = '';
        showShelfPhotoStep('split');
        showShelfPhotoMode();
        drawShelfPhoto();
        guessShelfDividers();
        startShelfPhotoZoom();
    };
    img.onerror = () => {
        document.getElementById('shelf-photo-error').innerText = "Couldn't open that picture. Try a JPEG or PNG.";
    };
    img.src = dataUrl;
}

// pasting a picture anywhere in the window uses it
document.addEventListener('paste', (e) => {
    if (!shelfPhotoOpen()) return;
    const file = clipboardImageFile(e);
    if (!file) return;
    e.preventDefault();
    if (!shelfPhotoKind) {
        document.getElementById('shelf-photo-error').innerText = 'First pick whether the books are on a shelf or in a stack.';
        return;
    }
    readFileAsDataURL(file).then(loadShelfPhoto);
});

document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !shelfPhotoOpen()) return;
    if (document.querySelector('#shelf-photo-rows .sp-options:not([hidden])')) {
        document.activeElement.blur();
        return;
    }
    closeShelfPhoto();
});

// ---------- Shelf or stack ----------

function setShelfPhotoMode(mode) {
    const sp = shelfPhoto;
    if (!sp || sp.mode === mode) return;
    sp.mode = mode;
    shelfPhotoKind = mode;
    try { localStorage.setItem(SHELF_PHOTO_MODE_KEY, mode); } catch (e) {}
    showShelfPhotoMode();
    sp.rowPixels = shelfRowPixels();
    guessShelfDividers();
}

function showShelfPhotoMode() {
    const stack = shelfPhoto.mode === 'stack';
    document.querySelectorAll('#shelf-photo-split [data-sp-mode]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.spMode === shelfPhoto.mode);
    });
    document.getElementById('shelf-photo-overlay').classList.toggle('stack', stack);
    document.getElementById('shelf-photo-hint').innerText = stack
        ? "Click between two books to add a line; drag a line to move it, or its × to remove it. Each spine's dashed lines at either end mark where it starts and stops (drag one if it's off). Something that isn't a book? Hover it and click ⊘."
        : "Click between two books to add a line; drag a line to move it, or its × to remove it. Each spine's dashed top line marks where it starts (drag it if it's off), and the one along the bottom marks the shelf. Something that isn't a book (the wall, a picture frame)? Hover it and click ⊘.";
}

// where slice i's spine stops (v)
function shelfSpineEnd(i) {
    return shelfPhoto.mode === 'stack' ? shelfPhoto.ends[i] : shelfPhoto.bottom;
}

// ---------- Turning and straightening ----------

function turnShelfPhoto(dir) {
    shelfPhoto.turns = (shelfPhoto.turns + dir + 4) % 4;
    shelfPhoto.ownBottom = false; // (it's somewhere else now)
    drawShelfPhoto();
    guessShelfDividers();
}

function tiltShelfPhoto(deg) {
    document.getElementById('shelf-photo-tilt').value = deg;
    shelfPhoto.tilt = Number(deg) || 0;
    shelfPhoto.ownBottom = false;
    drawShelfPhoto();
    guessShelfDividers();
}

// ---------- Zooming in ----------
// Zoom 1 fits the whole photo in the window; more makes it bigger than
// that, and the box around it scrolls. A photo starts as wide as the
// window, if fitting it whole would leave room at the sides.

const SHELF_PHOTO_ZOOMS = [1, 1.5, 2, 3, 4];
let shelfPhotoZoom = 1;

function startShelfPhotoZoom() {
    shelfPhotoZoom = 1;
    applyShelfPhotoZoom();
    // (less the scrollbar it'll need, once it's taller than the box)
    const room = document.querySelector('#shelf-photo-split .sp-stage-wrap').clientWidth - 20;
    const fit = document.getElementById('shelf-photo-canvas').getBoundingClientRect().width;
    if (fit > 0 && room / fit > 1.15) {
        shelfPhotoZoom = Math.min(2, Math.floor(room / fit * 100) / 100);
        applyShelfPhotoZoom();
    }
}

// dir: 1 in, -1 out, 0 back to fitting the window
function zoomShelfPhoto(dir, around) {
    const next = dir === 0 ? 1
        : dir > 0 ? (SHELF_PHOTO_ZOOMS.find(z => z > shelfPhotoZoom + 0.01) || shelfPhotoZoom)
        : ([...SHELF_PHOTO_ZOOMS].reverse().find(z => z < shelfPhotoZoom - 0.01) || 1);
    if (next === shelfPhotoZoom) return;
    // keep the same bit of the photo under the pointer (or in the middle)
    const wrap = document.querySelector('#shelf-photo-split .sp-stage-wrap');
    const box = wrap.getBoundingClientRect();
    const ax = around ? around.x - box.left : box.width / 2;
    const ay = around ? around.y - box.top : box.height / 2;
    const fx = (wrap.scrollLeft + ax) / Math.max(1, wrap.scrollWidth);
    const fy = (wrap.scrollTop + ay) / Math.max(1, wrap.scrollHeight);
    shelfPhotoZoom = next;
    applyShelfPhotoZoom();
    wrap.scrollLeft = fx * wrap.scrollWidth - ax;
    wrap.scrollTop = fy * wrap.scrollHeight - ay;
}

function applyShelfPhotoZoom() {
    const canvas = document.getElementById('shelf-photo-canvas');
    const wrap = document.querySelector('#shelf-photo-split .sp-stage-wrap');
    canvas.style.width = canvas.style.maxWidth = canvas.style.maxHeight = '';
    wrap.classList.toggle('zoomed', shelfPhotoZoom > 1);
    document.getElementById('shelf-photo-fit').classList.toggle('active', shelfPhotoZoom === 1);
    if (shelfPhotoZoom === 1) return;
    // fitted size first, then that times the zoom
    const fit = canvas.getBoundingClientRect().width;
    canvas.style.maxWidth = canvas.style.maxHeight = 'none';
    canvas.style.width = Math.round(fit * shelfPhotoZoom) + 'px';
}

// Ctrl + scroll (or a trackpad pinch) over the photo zooms
document.addEventListener('wheel', (e) => {
    if (!e.ctrlKey || !shelfPhoto || !e.target.closest || !e.target.closest('#shelf-photo-split .sp-stage-wrap')) return;
    e.preventDefault();
    zoomShelfPhoto(e.deltaY < 0 ? 1 : -1, { x: e.clientX, y: e.clientY });
}, { passive: false });

window.addEventListener('resize', () => {
    if (shelfPhoto && shelfPhotoOpen()) applyShelfPhotoZoom();
});

// The biggest upright rectangle inside a w x h picture turned by
// `angle`, so a straightened photo has no blank corners.
function innerRectAfterTurn(w, h, angle) {
    const sin = Math.abs(Math.sin(angle)), cos = Math.abs(Math.cos(angle));
    if (sin < 1e-6) return { w, h };
    const long = Math.max(w, h), short = Math.min(w, h);
    if (short <= 2 * sin * cos * long || Math.abs(sin - cos) < 1e-6) {
        const x = 0.5 * short;
        return w >= h ? { w: x / sin, h: x / cos } : { w: x / cos, h: x / sin };
    }
    const cos2 = cos * cos - sin * sin;
    return { w: (w * cos - h * sin) / cos2, h: (h * cos - w * sin) / cos2 };
}

function drawShelfPhoto() {
    const sp = shelfPhoto;
    const { img } = sp;
    const sideways = sp.turns % 2 === 1;
    const fit = Math.min(1, SHELF_PHOTO_FULL_MAX / Math.max(img.naturalWidth, img.naturalHeight));
    const iw = img.naturalWidth * fit, ih = img.naturalHeight * fit;
    const tw = sideways ? ih : iw, th = sideways ? iw : ih;
    const tilt = sp.tilt * Math.PI / 180;
    const inner = innerRectAfterTurn(tw, th, tilt);

    const full = document.createElement('canvas');
    full.width = Math.max(1, Math.floor(inner.w));
    full.height = Math.max(1, Math.floor(inner.h));
    const ctx = full.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, full.width, full.height);
    ctx.translate(full.width / 2, full.height / 2);
    ctx.rotate(sp.turns * Math.PI / 2 + tilt);
    ctx.drawImage(img, -iw / 2, -ih / 2, iw, ih);
    sp.full = full;

    const shown = document.getElementById('shelf-photo-canvas');
    const showScale = Math.min(1, SHELF_PHOTO_SHOW_MAX / Math.max(full.width, full.height));
    shown.width = Math.max(1, Math.round(full.width * showScale));
    shown.height = Math.max(1, Math.round(full.height * showScale));
    shown.getContext('2d').drawImage(full, 0, 0, shown.width, shown.height);

    // a smaller copy to look for the gaps in, which is quicker
    const view = document.createElement('canvas');
    const scale = Math.min(1, SHELF_PHOTO_VIEW_MAX / Math.max(full.width, full.height));
    view.width = Math.max(1, Math.round(full.width * scale));
    view.height = Math.max(1, Math.round(full.height * scale));
    view.getContext('2d').drawImage(full, 0, 0, view.width, view.height);
    sp.view = view;
    sp.pixels = view.getContext('2d').getImageData(0, 0, view.width, view.height);
    sp.rowPixels = shelfRowPixels();
}

// the picture as the gap-finding sees it: spines standing side by side.
// A stack is turned on its side for that (rows become columns).
function shelfRowPixels() {
    const sp = shelfPhoto;
    return sp.mode === 'stack' ? transposePixels(sp.pixels) : sp.pixels;
}

function transposePixels(src) {
    const { width: w, height: h, data } = src;
    const out = new ImageData(h, w);
    const o = out.data;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const a = (y * w + x) * 4, b = (x * h + y) * 4;
            o[b] = data[a]; o[b + 1] = data[a + 1]; o[b + 2] = data[a + 2]; o[b + 3] = 255;
        }
    }
    return out;
}

// upside down (rows in reverse), to look for where spines stop the same
// way as where they start
function flipPixelRows(src) {
    const { width: w, height: h, data } = src;
    const out = new ImageData(w, h);
    const rowBytes = w * 4;
    for (let y = 0; y < h; y++) {
        out.data.set(data.subarray(y * rowBytes, (y + 1) * rowBytes), (h - 1 - y) * rowBytes);
    }
    return out;
}

// ---------- Finding the gaps between spines ----------

// x positions (in pixels) where one spine likely ends and the next
// begins, looking only at rows top..bottom. A spine's edge runs the
// whole height and the colour changes across it; title lettering
// makes edges too, but only for a few rows.
function findSpineGaps(imageData, top, bottom) {
    const { width: w, height: h, data } = imageData;
    top = Math.max(0, Math.min(h - 1, Math.round(top)));
    bottom = Math.max(top + 1, Math.min(h, Math.round(bottom)));
    const rows = bottom - top;
    if (w < 16 || rows < 4) return [];
    const step = Math.max(1, Math.floor(rows / 300));

    const mean = new Float32Array(w * 3);  // each column's average colour
    const edgy = new Float32Array(w);      // rows with a sharp change at x
    let sampled = 0;
    for (let y = top; y < bottom; y += step) {
        sampled++;
        const row = y * w * 4;
        for (let x = 0; x < w; x++) {
            const i = row + x * 4;
            const r = data[i], g = data[i + 1], b = data[i + 2];
            mean[x * 3] += r; mean[x * 3 + 1] += g; mean[x * 3 + 2] += b;
        }
        // across a few pixels, since a photo's edges are a little soft;
        // any colour change counts, not just lighter/darker
        for (let x = 2; x < w - 1; x++) {
            const a = row + (x - 2) * 4, b = row + (x + 1) * 4;
            const diff = Math.abs(data[a] - data[b]) + Math.abs(data[a + 1] - data[b + 1]) + Math.abs(data[a + 2] - data[b + 2]);
            if (diff > SHELF_PHOTO_EDGE_DIFF) edgy[x]++;
        }
    }
    for (let i = 0; i < mean.length; i++) mean[i] /= sampled;

    const K = 4;
    const raw = new Float32Array(w);
    for (let x = K + 1; x < w - K; x++) {
        let dist = 0;
        for (let c = 0; c < 3; c++) {
            let left = 0, right = 0;
            for (let k = 0; k < K; k++) {
                left += mean[(x - 2 - k) * 3 + c];
                right += mean[(x + 1 + k) * 3 + c];
            }
            dist += ((left - right) / K) ** 2;
        }
        dist = Math.min(1, Math.sqrt(dist) / 255 * 2);
        const coherence = Math.max(edgy[x - 1], edgy[x], edgy[x + 1]) / sampled;
        // an edge most of the way down matters far more than how much
        // the colour changes (a title's edge changes it a lot, briefly),
        // and one down less than about half of it doesn't count at all
        const along = Math.max(0, (coherence - 0.45) / 0.55);
        raw[x] = along * (0.5 + 0.5 * dist);
    }
    const score = new Float32Array(w);
    for (let x = 1; x < w - 1; x++) score[x] = (raw[x - 1] + 2 * raw[x] + raw[x + 1]) / 4;

    const sorted = [...score].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const mad = [...score].map(s => Math.abs(s - median)).sort((a, b) => a - b)[Math.floor(w / 2)];
    const threshold = Math.max(0.3, median + 4 * mad);
    const minGap = Math.max(6, Math.round(rows * 0.035));

    const peaks = [];
    for (let x = 1; x < w - 1; x++) {
        if (score[x] >= threshold && score[x] >= score[x - 1] && score[x] >= score[x + 1]) peaks.push(x);
    }
    peaks.sort((a, b) => score[b] - score[a]);
    const kept = [];
    for (const x of peaks) {
        if (x < minGap / 2 || x > w - minGap / 2) continue;
        if (kept.some(k => Math.abs(k - x) < minGap)) continue;
        kept.push(x);
    }
    return kept.sort((a, b) => a - b);
}

// For each row, the share of columns x0..x1 where the colour changes
// sharply from just above to just below. The top of a spine runs right
// across its slice; lettering doesn't.
function rowEdgeShare(imageData, x0, x1) {
    const { width: w, height: h, data } = imageData;
    x0 = Math.max(0, Math.round(x0));
    x1 = Math.min(w, Math.round(x1));
    const cols = Math.max(1, x1 - x0);
    const share = new Float32Array(h);
    for (let y = 2; y < h - 1; y++) {
        let n = 0;
        for (let x = x0; x < x1; x++) {
            const a = ((y - 2) * w + x) * 4, b = ((y + 1) * w + x) * 4;
            if (Math.abs(data[a] - data[b]) + Math.abs(data[a + 1] - data[b + 1]) + Math.abs(data[a + 2] - data[b + 2]) > SHELF_PHOTO_EDGE_DIFF) n++;
        }
        share[y] = n / cols;
    }
    return share;
}

// The row where the spine between x0 and x1 starts: the highest edge
// running right across it, with the spine's sides showing just below
// it (above a book there's wall, with no sides). Of those, edges that
// run across half the photo or more (the shelf above, a line on the
// wall) are skipped, unless that's all there is (every book the same
// height): then the lowest of them. `wide` is rowEdgeShare over the
// whole width. 0 if there's no edge.
function findSpineTop(imageData, x0, x1, bottom, wide) {
    const inset = (x1 - x0) * 0.1;
    const own = rowEdgeShare(imageData, x0 + inset, x1 - inset);
    const limit = Math.round(bottom * 0.8); // no spine is that short
    let found = [];
    for (let y = 3; y < limit; y++) {
        if (own[y] >= 0.7 && own[y] >= own[y - 1] && own[y] > own[y + 1]) found.push(y);
    }
    if (!found.length) return 0;
    const withSides = found.filter(y => spineSidesBelow(imageData, x0, x1, y));
    if (withSides.length) found = withSides;
    const isWide = y => wide && Math.max(wide[y - 1], wide[y], wide[y + 1]) >= 0.5;
    const narrow = found.find(y => !isWide(y));
    return narrow !== undefined ? narrow : found[found.length - 1];
}

// whether, just below row y, the colour changes across both sides of
// x0..x1, on average down those rows: a spine against its neighbours or
// the wall does, plain wall (however textured) doesn't. The photo's own
// edges don't count as sides.
function spineSidesBelow(imageData, x0, x1, y) {
    const { width: w, height: h, data } = imageData;
    const rows = Math.max(4, Math.round(h * 0.04));
    const sides = [Math.round(x0), Math.round(x1)].filter(x => x > 8 && x < w - 8);
    if (!sides.length) return true;
    const mean = (xa, xb) => {
        const c = [0, 0, 0];
        let n = 0;
        for (let r = y + 2; r < Math.min(h, y + 2 + rows); r++) {
            for (let x = xa; x <= xb; x++) {
                const i = (r * w + x) * 4;
                c[0] += data[i]; c[1] += data[i + 1]; c[2] += data[i + 2];
                n++;
            }
        }
        return c.map(v => v / Math.max(1, n));
    };
    return sides.every(x => {
        const left = mean(x - 7, x - 3), right = mean(x + 3, x + 7);
        return Math.abs(left[0] - right[0]) + Math.abs(left[1] - right[1]) + Math.abs(left[2] - right[2]) > SHELF_PHOTO_EDGE_DIFF;
    });
}

// The row the books stand on: where the lines between them stop,
// going down. (Edges across the photo don't do: a textured wall has them
// everywhere, white books on a white shelf barely make one, and the
// front of the shelf and a lower shelf make stronger ones.) `gaps` are
// x's found higher up. null if they run to the bottom of the photo.
function findShelfLine(imageData, gaps) {
    const { width: w, height: h, data } = imageData;
    if (gaps.length < 2) return null;
    const edgeAt = (x, y) => {
        for (let dx = -1; dx <= 1; dx++) {
            const a = (y * w + x + dx - 2) * 4, b = (y * w + x + dx + 1) * 4;
            if (Math.abs(data[a] - data[b]) + Math.abs(data[a + 1] - data[b + 1]) + Math.abs(data[a + 2] - data[b + 2]) > SHELF_PHOTO_EDGE_DIFF) return true;
        }
        return false;
    };
    const cols = gaps.filter(x => x > 3 && x < w - 3);
    const share = new Float32Array(h);
    for (let y = 0; y < h; y++) share[y] = cols.filter(x => edgeAt(x, y)).length / cols.length;
    // a few rows at a time, since a gap's edge flickers row to row
    const run = Math.max(3, Math.round(h * 0.015));
    const avg = y => { let t = 0; for (let k = 0; k < run; k++) t += share[y + k]; return t / run; };
    for (let y = Math.round(h * 0.4); y < h - run; y++) {
        if (avg(y) < 0.25) return y;
    }
    return null;
}

function guessShelfDividers() {
    const sp = shelfPhoto;
    const px = sp.rowPixels;
    let gaps;
    if (sp.mode === 'stack') {
        // the middle, where even short books reach
        gaps = findSpineGaps(px, px.height * 0.35, px.height * 0.65);
    } else {
        // the middle of the photo first, to find the shelf; then the
        // lower part of the books, where even short ones reach
        if (!sp.ownBottom) {
            const shelf = findShelfLine(px, findSpineGaps(px, px.height * 0.3, px.height * 0.7));
            sp.bottom = shelf === null ? 0.98 : Math.min(1, shelf / px.height + SHELF_PHOTO_EDGE_PAD);
        }
        const bottom = (sp.bottom - SHELF_PHOTO_EDGE_PAD) * px.height;
        gaps = findSpineGaps(px, bottom * 0.45, bottom - px.height * 0.01);
    }
    setShelfDividers(gaps.map(x => x / px.width));
    mergeShelfStripes();
}

// A stripe in a book's design can run its whole length and look just
// like the gap between two books. Two real books next to each other
// rarely start and stop in the same place, though, so a sliver that
// matches its neighbour at both ends is taken as part of it.
function mergeShelfStripes() {
    const sp = shelfPhoto;
    const stack = sp.mode === 'stack';
    const same = (i, j) => Math.abs(sp.tops[i] - sp.tops[j]) < 0.015 &&
        (!stack || Math.abs(sp.ends[i] - sp.ends[j]) < 0.015);
    for (let pass = 0; pass < 50; pass++) {
        const edges = shelfSliceEdges();
        const sizes = sp.picks.map((_, i) => edges[i + 1] - edges[i]);
        const median = [...sizes].sort((a, b) => a - b)[Math.floor(sizes.length / 2)];
        let merged = false;
        for (let i = 0; i < sizes.length && !merged; i++) {
            if (sp.blank[i] || sizes[i] >= median * 0.5) continue;
            // into the neighbour it matches, the thinner one if both do
            const sides = [i - 1, i + 1].filter(j => j >= 0 && j < sizes.length && !sp.blank[j] && same(i, j))
                .sort((a, b) => sizes[a] - sizes[b]);
            if (!sides.length) continue;
            removeShelfDivider(Math.min(i, sides[0]));
            merged = true;
        }
        if (!merged) break;
    }
}

// guess where slices `only` (or all of them) start, and in a stack
// where they stop, except ends you've dragged
function guessShelfTops(only) {
    const sp = shelfPhoto;
    const px = sp.rowPixels;
    const stack = sp.mode === 'stack';
    const edges = shelfSliceEdges();
    const wanted = i => !only || only.includes(i);
    const wide = rowEdgeShare(px, 0, px.width);
    sp.tops = sp.tops.map((t, i) => {
        if (sp.ownTop[i] || !wanted(i)) return t;
        const top = findSpineTop(px, edges[i] * px.width, edges[i + 1] * px.width,
            (stack ? 1 : sp.bottom) * px.height, wide) / px.height;
        return Math.max(0, top - SHELF_PHOTO_EDGE_PAD);
    });
    if (stack) guessShelfEnds(wanted);
}

function guessShelfEnds(wanted) {
    const sp = shelfPhoto;
    const px = sp.rowPixels;
    const edges = shelfSliceEdges();
    // the far end: the same search, from the other end
    const flipped = flipPixelRows(px);
    const flippedWide = rowEdgeShare(flipped, 0, px.width);
    sp.ends = sp.ends.map((e, i) => {
        if (sp.ownEnd[i] || !wanted(i)) return e;
        const fromEnd = findSpineTop(flipped, edges[i] * px.width, edges[i + 1] * px.width, px.height, flippedWide);
        return Math.max(sp.tops[i] + 0.05, Math.min(1, 1 - fromEnd / px.height + SHELF_PHOTO_EDGE_PAD));
    });
}

// The first or last slice may be no book at all: the wall above a
// stack, the table under it, the side of a bookcase. If nothing in it
// changes colour sharply along it, it starts out as not a book.
function markBlankSlices() {
    const sp = shelfPhoto;
    const px = sp.rowPixels;
    const edges = shelfSliceEdges();
    const n = sp.picks.length;
    sp.blank = new Array(n).fill(false);
    if (n < 2) return;
    [0, n - 1].forEach(i => {
        if (sp.picks[i]) return;
        const share = rowEdgeShare(px, edges[i] * px.width, edges[i + 1] * px.width);
        sp.blank[i] = share.reduce((a, b) => a + b, 0) / share.length < 0.004;
    });
}

// slice i's number, counting only the books
function shelfSliceNumber(i) {
    return shelfPhoto.blank.slice(0, i).filter(b => !b).length + 1;
}

// Not a book (shaded, no number, nothing to fill in), or a book again
function setShelfBlank(i, blank) {
    const sp = shelfPhoto;
    sp.blank[i] = blank;
    if (blank) sp.picks[i] = null;
    renderShelfPhotoOverlay();
    renderShelfPhotoRows();
}

function clearShelfDividers() {
    setShelfDividers([]);
}

// new dividers: books stay with the slices they were on, by position
function setShelfDividers(dividers) {
    const sp = shelfPhoto;
    sp.dividers = dividers;
    const count = dividers.length + 1;
    sp.picks = Array.from({ length: count }, (_, i) => sp.picks[i] || null);
    sp.tops = new Array(count).fill(0);
    sp.ownTop = new Array(count).fill(false);
    sp.ends = new Array(count).fill(1);
    sp.ownEnd = new Array(count).fill(false);
    sp.blank = new Array(count).fill(false);
    guessShelfTops();
    markBlankSlices();
    renderShelfPhotoOverlay();
    renderShelfPhotoRows();
}

// slice i runs from edges[i] to edges[i + 1] (u)
function shelfSliceEdges() {
    return [0, ...shelfPhoto.dividers, 1];
}

// ---------- The picture: dividers, ends, slice numbers ----------

// Puts el over the picture from u0..u1 across the spines and v0..v1
// along them. A line has no size one way; its thickness is in the CSS.
function placeOnShelfPhoto(el, u0, u1, v0, v1) {
    const stack = shelfPhoto.mode === 'stack';
    const [x0, x1, y0, y1] = stack ? [v0, v1, u0, u1] : [u0, u1, v0, v1];
    const pct = f => (f * 100) + '%';
    el.style.left = pct(x0);
    el.style.top = pct(y0);
    if (x1 > x0) el.style.width = pct(x1 - x0);
    if (y1 > y0) el.style.height = pct(y1 - y0);
}

// a draggable line: 'cut' between spines, or 'end' at a spine's end
function shelfPhotoLine(kind, betweenSpines, drag, title) {
    const stack = shelfPhoto.mode === 'stack';
    // a line between spines runs along them (up and down on a shelf),
    // an end line across them
    const vertical = betweenSpines ? !stack : stack;
    const line = document.createElement('div');
    line.className = `sp-line ${kind} ${vertical ? 'v' : 'h'}`;
    line.title = title;
    line.addEventListener('pointerdown', e => startShelfPhotoDrag(e, drag));
    return line;
}

function renderShelfPhotoOverlay() {
    const sp = shelfPhoto;
    const stack = sp.mode === 'stack';
    const overlay = document.getElementById('shelf-photo-overlay');
    overlay.innerHTML = '';
    const edges = shelfSliceEdges();
    overlay.appendChild(shelfPhotoShade(edges));

    for (let i = 0; i < edges.length - 1; i++) {
        const u0 = edges[i], u1 = edges[i + 1];
        if (sp.blank[i]) {
            const spot = document.createElement('div');
            spot.className = 'sp-slice blank';
            placeOnShelfPhoto(spot, u0, u1, 0, 1);
            spot.appendChild(shelfPhotoButton('sp-unskip', '+', 'This is a book', () => setShelfBlank(i, false)));
            overlay.appendChild(spot);
            continue;
        }
        const top = sp.tops[i], end = shelfSpineEnd(i);

        const slice = document.createElement('div');
        slice.className = 'sp-slice' + (sp.picks[i] ? ' assigned' : '');
        slice.dataset.slice = i;
        placeOnShelfPhoto(slice, u0, u1, top, end);
        const num = document.createElement('span');
        num.className = 'sp-num';
        num.innerText = shelfSliceNumber(i);
        slice.append(num, shelfPhotoButton('sp-skip', '⊘', 'Not a book', () => setShelfBlank(i, true)));
        slice.addEventListener('pointerenter', () => highlightShelfSlice(i, true));
        slice.addEventListener('pointerleave', () => highlightShelfSlice(i, false));
        overlay.appendChild(slice);

        const start = shelfPhotoLine('end' + (sp.ownTop[i] ? ' own' : ''), false, { top: i }, 'Drag to where this spine starts');
        start.dataset.slice = i;
        placeOnShelfPhoto(start, u0, u1, top, top);
        overlay.appendChild(start);
        if (stack) {
            const stop = shelfPhotoLine('end' + (sp.ownEnd[i] ? ' own' : ''), false, { end: i }, 'Drag to where this spine stops');
            stop.dataset.slice = i;
            placeOnShelfPhoto(stop, u0, u1, end, end);
            overlay.appendChild(stop);
        }
    }

    if (!stack) {
        const shelf = shelfPhotoLine('end sp-shelf-line', false, { bottom: true }, 'Drag to where the spines end (the shelf)');
        placeOnShelfPhoto(shelf, 0, 1, sp.bottom, sp.bottom);
        overlay.appendChild(shelf);
    }

    sp.dividers.forEach((u, k) => {
        const line = shelfPhotoLine('cut', true, { divider: k }, 'Drag to move this line');
        placeOnShelfPhoto(line, u, u, Math.min(sp.tops[k], sp.tops[k + 1]), Math.max(shelfSpineEnd(k), shelfSpineEnd(k + 1)));
        line.appendChild(shelfPhotoButton('sp-remove', '×', 'Remove this line', () => removeShelfDivider(k)));
        overlay.appendChild(line);
    });
}

// a small round button on the picture (one that doesn't add a line
// where it's clicked)
function shelfPhotoButton(className, text, label, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = className;
    btn.textContent = text;
    btn.title = label;
    btn.setAttribute('aria-label', label);
    btn.addEventListener('pointerdown', e => e.stopPropagation());
    btn.addEventListener('click', e => { e.stopPropagation(); onClick(); });
    return btn;
}

// Everything that isn't a spine is shaded: one shape over the whole
// picture with a hole running along the spines, so there are no seams
// where two shaded bits would meet.
function shelfPhotoShade(edges) {
    const sp = shelfPhoto;
    const stack = sp.mode === 'stack';
    const pt = (u, v) => stack ? `${v} ${u}` : `${u} ${v}`;
    const starts = [], stops = [];
    for (let i = 0; i < edges.length - 1; i++) {
        // (a blank slice pinches the hole shut)
        const a = sp.blank[i] ? 0.5 : sp.tops[i];
        const b = sp.blank[i] ? 0.5 : shelfSpineEnd(i);
        starts.push(pt(edges[i], a), pt(edges[i + 1], a));
        stops.unshift(pt(edges[i + 1], b), pt(edges[i], b));
    }
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'sp-shade');
    svg.setAttribute('viewBox', '0 0 1 1');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('fill-rule', 'evenodd');
    path.setAttribute('d', `M0 0H1V1H0Z M${[...starts, ...stops].join(' L')}Z`);
    svg.appendChild(path);
    return svg;
}

function highlightShelfSlice(i, on) {
    document.querySelectorAll(`#shelf-photo-overlay .sp-slice[data-slice="${i}"], #shelf-photo-rows .sp-row[data-slice="${i}"]`)
        .forEach(el => el.classList.toggle('hot', on));
}

// where the pointer is on the picture, as { u, v }
function shelfPhotoPointer(e) {
    const rect = document.getElementById('shelf-photo-canvas').getBoundingClientRect();
    const fx = (e.clientX - rect.left) / rect.width;
    const fy = (e.clientY - rect.top) / rect.height;
    return shelfPhoto.mode === 'stack' ? { u: fy, v: fx } : { u: fx, v: fy };
}

// a click on the picture (not a drag) adds a divider there
function handleShelfPhotoStageClick(e) {
    if (!shelfPhoto || e.target.closest('.sp-line')) return;
    const { u, v } = shelfPhotoPointer(e);
    if (shelfPhoto.mode === 'shelf' && v > shelfPhoto.bottom) return;
    addShelfDivider(u);
}

function addShelfDivider(u) {
    const sp = shelfPhoto;
    if (u < SHELF_PHOTO_MIN_SLICE || u > 1 - SHELF_PHOTO_MIN_SLICE) return;
    if (sp.dividers.some(d => Math.abs(d - u) < SHELF_PHOTO_MIN_SLICE)) return;
    const k = sp.dividers.filter(d => d < u).length; // the slice being split
    sp.dividers.splice(k, 0, u);
    sp.picks.splice(k + 1, 0, null); // its book stays on the first half
    sp.tops.splice(k + 1, 0, sp.tops[k]);
    sp.ownTop.splice(k, 1, false, false);
    sp.ends.splice(k + 1, 0, sp.ends[k]);
    sp.ownEnd.splice(k, 1, false, false);
    sp.blank.splice(k + 1, 0, sp.blank[k]); // (both halves of a non-book aren't books)
    guessShelfTops([k, k + 1]);
    renderShelfPhotoOverlay();
    renderShelfPhotoRows();
}

function removeShelfDivider(k) {
    const sp = shelfPhoto;
    sp.dividers.splice(k, 1);
    // the two slices merge: keep the first one's book, or else the other's
    const merged = sp.picks[k] || sp.picks[k + 1];
    sp.picks.splice(k, 2, merged);
    // (the longer of the two)
    sp.tops.splice(k, 2, Math.min(sp.tops[k], sp.tops[k + 1]));
    sp.ownTop.splice(k, 2, sp.ownTop[k] || sp.ownTop[k + 1]);
    sp.ends.splice(k, 2, Math.max(sp.ends[k], sp.ends[k + 1]));
    sp.ownEnd.splice(k, 2, sp.ownEnd[k] || sp.ownEnd[k + 1]);
    sp.blank.splice(k, 2, sp.blank[k] && sp.blank[k + 1]);
    guessShelfTops([k]);
    renderShelfPhotoOverlay();
    renderShelfPhotoRows();
}

function startShelfPhotoDrag(e, what) {
    e.preventDefault();
    e.stopPropagation();
    shelfPhotoDrag = { ...what };
    e.target.setPointerCapture(e.pointerId);
}

window.addEventListener('pointermove', (e) => {
    if (!shelfPhotoDrag || !shelfPhoto) return;
    const sp = shelfPhoto;
    const { u, v } = shelfPhotoPointer(e);
    const drag = shelfPhotoDrag;
    const gap = SHELF_PHOTO_MIN_SLICE;
    if (drag.top !== undefined) {
        sp.tops[drag.top] = Math.min(Math.max(v, 0), shelfSpineEnd(drag.top) - 0.05);
        sp.ownTop[drag.top] = true;
    } else if (drag.end !== undefined) {
        sp.ends[drag.end] = Math.max(Math.min(v, 1), sp.tops[drag.end] + 0.05);
        sp.ownEnd[drag.end] = true;
    } else if (drag.bottom) {
        sp.bottom = Math.max(Math.min(v, 1), Math.max(...sp.tops) + 0.05);
        sp.ownBottom = true;
    } else {
        const k = drag.divider;
        const lo = (k > 0 ? sp.dividers[k - 1] : 0) + gap;
        const hi = (k < sp.dividers.length - 1 ? sp.dividers[k + 1] : 1) - gap;
        sp.dividers[k] = Math.min(Math.max(u, lo), hi);
    }
    drag.moved = true;
    renderShelfPhotoOverlay();
});

window.addEventListener('pointerup', () => {
    if (!shelfPhotoDrag) return;
    const drag = shelfPhotoDrag;
    shelfPhotoDrag = null;
    if (!drag.moved) return;
    // re-guess the spines' tops for a moved shelf. A moved side line
    // leaves its spines' ends where they are: they were fine, or you'd
    // have dragged them.
    if (drag.bottom) guessShelfTops();
    renderShelfPhotoOverlay();
    renderShelfPhotoRows(); // new thumbnails
});

// ---------- Which book is which ----------

// slice i's spine, cut out of canvas and stood upright, height px tall
// (or at most maxH tall, never enlarged). A stack's spines lie with the
// book's top to the left (face up), so they're turned clockwise.
function uprightShelfSlice(i, canvas, { height, maxH }) {
    const sp = shelfPhoto;
    const stack = sp.mode === 'stack';
    const edges = shelfSliceEdges();
    const [u0, u1, v0, v1] = [edges[i], edges[i + 1], sp.tops[i], shelfSpineEnd(i)];
    const [fx0, fx1, fy0, fy1] = stack ? [v0, v1, u0, u1] : [u0, u1, v0, v1];
    const sx = Math.round(fx0 * canvas.width), sy = Math.round(fy0 * canvas.height);
    const sw = Math.max(1, Math.round(fx1 * canvas.width) - sx);
    const sh = Math.max(1, Math.round(fy1 * canvas.height) - sy);
    const long = stack ? sw : sh, across = stack ? sh : sw;
    const scale = height ? height / long : Math.min(1, maxH / long);

    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(across * scale));
    out.height = Math.max(1, Math.round(long * scale));
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, out.width, out.height);
    if (stack) {
        ctx.translate(out.width, 0);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, out.height, out.width);
    } else {
        ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, out.width, out.height);
    }
    return out;
}

function renderShelfPhotoRows() {
    const sp = shelfPhoto;
    const list = document.getElementById('shelf-photo-rows');
    list.innerHTML = '';
    sp.picks.forEach((pick, i) => { if (!sp.blank[i]) list.appendChild(buildShelfPhotoRow(i)); });
    updateShelfPhotoSave();
}

// Slice i's spine laid on its side, top of the book to the left, so
// its title reads left to right across the row (like a book in a stack).
// Cut from the full-size photo, so it stays sharp when it's enlarged.
function sidewaysShelfSlice(i) {
    const up = uprightShelfSlice(i, shelfPhoto.full, { maxH: 700 });
    const out = document.createElement('canvas');
    out.width = up.height;
    out.height = up.width;
    const ctx = out.getContext('2d');
    ctx.translate(0, out.height);
    ctx.rotate(-Math.PI / 2);
    ctx.drawImage(up, 0, 0);
    return out;
}

function buildShelfPhotoRow(i) {
    const sp = shelfPhoto;
    const pick = sp.picks[i];
    const row = document.createElement('li');
    row.className = 'sp-row';
    row.dataset.slice = i;
    row.addEventListener('pointerenter', () => highlightShelfSlice(i, true));
    row.addEventListener('pointerleave', () => highlightShelfSlice(i, false));

    const num = document.createElement('span');
    num.className = 'sp-row-num';
    num.innerText = shelfSliceNumber(i);

    const main = document.createElement('div');
    main.className = 'sp-row-main';
    // hover (or tap) it for a bigger look
    const strip = document.createElement('div');
    strip.className = 'sp-strip';
    strip.tabIndex = 0;
    strip.title = 'Spine ' + shelfSliceNumber(i);
    strip.appendChild(sidewaysShelfSlice(i));
    // grown away from the nearer side of the window, so it isn't cut off
    const growInward = () => {
        const list = document.getElementById('shelf-photo-rows').getBoundingClientRect();
        const box = strip.getBoundingClientRect();
        strip.style.transformOrigin = (box.left + box.width / 2 < list.left + list.width / 2) ? 'left center' : 'right center';
    };
    strip.addEventListener('pointerenter', growInward);
    strip.addEventListener('focus', growInward);
    main.appendChild(strip);

    if (pick && pick.isNew) {
        main.appendChild(buildNewBookFields(i, pick));
    } else {
        main.appendChild(buildBookSearch(i, pick));
    }

    const notBook = document.createElement('button');
    notBook.type = 'button';
    notBook.className = 'secondary sp-notbook';
    notBook.textContent = 'Not a book';
    notBook.title = 'Leave this slice out (the wall, a picture frame...)';
    notBook.addEventListener('click', () => setShelfBlank(i, true));
    main.appendChild(notBook);

    row.append(num, main);
    return row;
}

// the x beside a picked (or new) book, to clear it
function shelfUnpickButton(i) {
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'sp-unpick';
    clear.title = 'Clear the book picked';
    clear.setAttribute('aria-label', `Clear the book picked for slice ${shelfSliceNumber(i)}`);
    clear.innerHTML = '&times;';
    clear.addEventListener('click', () => setShelfPick(i, null));
    return clear;
}

function buildBookSearch(i, pick) {
    const wrap = document.createElement('div');
    wrap.className = 'sp-search';
    const input = document.createElement('input');
    input.type = 'text';
    input.autocomplete = 'off';
    input.placeholder = pick ? '' : 'Which book? Type a title or author';
    input.setAttribute('aria-label', `Book for slice ${shelfSliceNumber(i)}`);
    const book = pick ? library.find(b => b.id === pick.id) : null;
    input.value = book ? book.title : '';
    const options = document.createElement('ul');
    options.className = 'sp-options';
    options.setAttribute('role', 'listbox');
    options.hidden = true;
    // picking with the mouse shouldn't blur the box first
    options.addEventListener('mousedown', e => e.preventDefault());

    const show = () => {
        fillShelfBookOptions(options, i, input.value);
        options.hidden = false;
    };
    input.addEventListener('focus', () => { if (book) input.select(); show(); });
    input.addEventListener('input', show);
    input.addEventListener('blur', () => {
        options.hidden = true;
        if (book) input.value = book.title;
    });
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const first = options.querySelector('li');
            if (first) first.click();
        }
    });
    if (book) {
        const line = document.createElement('div');
        line.className = 'sp-picked';
        line.append(input, shelfUnpickButton(i));
        wrap.append(line, options);
    } else {
        wrap.append(input, options);
    }
    if (book) {
        const by = document.createElement('div');
        by.className = 'sp-by';
        by.innerText = 'by ' + (book.authors || []).join(', ') + (book.spineImage ? ' · its spine photo will be replaced' : '');
        wrap.appendChild(by);
    }
    return wrap;
}

function fillShelfBookOptions(list, i, query) {
    const sp = shelfPhoto;
    const q = query.trim().toLowerCase();
    const matches = visibleBooks()
        .filter(b => !q || (b.title || '').toLowerCase().includes(q) ||
            (b.authors || []).some(a => a.toLowerCase().includes(q)))
        .sort((a, b) => (a.title || '').localeCompare(b.title || ''))
        .slice(0, 8);
    list.innerHTML = '';
    matches.forEach(book => {
        const li = document.createElement('li');
        li.setAttribute('role', 'option');
        const title = document.createElement('span');
        title.className = 'sp-opt-title';
        title.innerText = book.title;
        const by = document.createElement('span');
        by.className = 'sp-opt-by';
        by.innerText = (book.authors || []).join(', ');
        li.append(title, by);
        const elsewhere = sp.picks.findIndex((p, j) => j !== i && p && p.id === book.id);
        if (elsewhere >= 0) li.appendChild(shelfOptionTag('on #' + shelfSliceNumber(elsewhere)));
        if (book.spineImage) li.appendChild(shelfOptionTag('has spine', 'has-spine'));
        li.addEventListener('click', () => setShelfPick(i, { id: book.id }));
        list.appendChild(li);
    });
    if (!matches.length && q) {
        const none = document.createElement('li');
        none.className = 'sp-opt-none';
        none.innerText = 'No book like that on your shelf';
        list.appendChild(none);
    }
    const add = document.createElement('li');
    add.setAttribute('role', 'option');
    add.className = 'sp-opt-new';
    add.innerText = '＋ New book' + (query.trim() ? `: "${query.trim()}"` : '');
    add.addEventListener('click', () => setShelfPick(i, { isNew: true, title: query.trim(), author: '', genre: null }));
    list.appendChild(add);
}

// dark or light writing, whichever reads better on the theme's accent
function shelfOnAccentInk() {
    const rgb = getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb')
        .split(',').map(n => parseFloat(n) / 255);
    if (rgb.length !== 3 || rgb.some(isNaN)) return '#fff';
    const lin = c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    const lum = 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
    // (the lightness where black and white writing contrast equally)
    return lum > 0.18 ? '#1b1b1b' : '#ffffff';
}

function shelfOptionTag(text, kind) {
    const tag = document.createElement('span');
    tag.className = 'sp-opt-tag' + (kind ? ' ' + kind : '');
    if (kind === 'has-spine') {
        tag.title = 'Already has a spine photo; picking it replaces that';
        tag.style.color = shelfOnAccentInk();
    }
    tag.append(text);
    return tag;
}

function buildNewBookFields(i, pick) {
    const wrap = document.createElement('div');
    wrap.className = 'sp-new';
    const label = document.createElement('div');
    label.className = 'sp-new-label';
    const labelText = document.createElement('span');
    labelText.textContent = 'New book';
    label.append(labelText, shelfUnpickButton(i));
    const title = document.createElement('input');
    title.type = 'text';
    title.className = 'sp-new-title';
    title.placeholder = 'title';
    title.setAttribute('aria-label', `New book title for slice ${shelfSliceNumber(i)}`);
    title.value = pick.title;
    title.addEventListener('input', () => { pick.title = title.value; title.classList.remove('missing'); updateShelfPhotoSave(); });
    const author = document.createElement('input');
    author.type = 'text';
    author.className = 'sp-new-author';
    author.placeholder = 'by';
    author.setAttribute('list', 'author-options');
    author.setAttribute('aria-label', `New book author for slice ${shelfSliceNumber(i)}`);
    author.value = pick.author;
    author.addEventListener('input', () => { pick.author = author.value; });
    const genre = document.createElement('select');
    genre.className = 'sp-new-genre';
    genre.setAttribute('aria-label', `New book genre for slice ${shelfSliceNumber(i)}`);
    fillQuickAddGenres(genre);
    if (pick.genre) genre.value = pick.genre;
    pick.genre = genre.value;
    genre.addEventListener('change', () => { pick.genre = genre.value; });
    wrap.append(label, title, author, genre);
    return wrap;
}

function setShelfPick(i, pick) {
    const sp = shelfPhoto;
    // one book, one spine: picking it here takes it off another slice
    if (pick && pick.id) sp.picks = sp.picks.map((p, j) => (j !== i && p && p.id === pick.id) ? null : p);
    sp.picks[i] = pick;
    renderShelfPhotoOverlay();
    renderShelfPhotoRows();
    if (pick && pick.isNew) {
        const title = document.querySelector(`#shelf-photo-rows .sp-row[data-slice="${i}"] .sp-new-title`);
        if (title) title.focus();
    }
}

function updateShelfPhotoSave() {
    const count = shelfPhoto ? shelfPhoto.picks.filter(Boolean).length : 0;
    const btn = document.getElementById('shelf-photo-save');
    btn.disabled = !count;
    btn.innerText = count ? `Save ${count} spine${count === 1 ? '' : 's'}` : 'Save spines';
    const total = shelfPhoto ? shelfPhoto.blank.filter(b => !b).length : 0;
    document.getElementById('shelf-photo-count').innerText = total
        ? `${total} spine${total === 1 ? '' : 's'} · ${count} matched to a book`
        : '';
}

// ---------- Saving ----------

// slice i cut from the full-size picture, as a JPEG, plus its colour
function cutShelfSlice(i) {
    const canvas = uprightShelfSlice(i, shelfPhoto.full, { maxH: SHELF_PHOTO_SPINE_MAX_H });
    const tiny = document.createElement('canvas');
    tiny.width = tiny.height = 1;
    const tctx = tiny.getContext('2d');
    tctx.drawImage(canvas, 0, 0, 1, 1);
    const [red, green, blue] = tctx.getImageData(0, 0, 1, 1).data;
    const color = '#' + [red, green, blue].map(v => v.toString(16).padStart(2, '0')).join('');
    return { dataUrl: canvas.toDataURL('image/jpeg', COVER_JPEG_QUALITY), color };
}

async function saveShelfPhoto() {
    const sp = shelfPhoto;
    if (!sp) return;
    // a new book needs at least a title
    const untitled = sp.picks.findIndex(p => p && p.isNew && !p.title.trim());
    if (untitled >= 0) {
        const input = document.querySelector(`#shelf-photo-rows .sp-row[data-slice="${untitled}"] .sp-new-title`);
        if (input) { input.classList.add('missing'); input.focus(); }
        return;
    }
    const saveBtn = document.getElementById('shelf-photo-save');
    saveBtn.disabled = true;
    saveBtn.innerText = 'Saving...';

    let spines = 0, added = 0;
    let nextOrder = library.reduce((max, b) => Math.max(max, Number.isFinite(b.sortOrder) ? b.sortOrder : -1), -1) + 1;
    for (let i = 0; i < sp.picks.length; i++) {
        const pick = sp.picks[i];
        if (!pick) continue;
        const { dataUrl, color } = cutShelfSlice(i);
        const spineImageRatio = await getSpineImageAspectRatio(dataUrl);
        let book;
        if (pick.isNew) {
            const now = Date.now();
            let id = now;
            while (library.some(b => b.id === String(id))) id++;
            const authors = pick.author.split(',').map(a => a.trim()).filter(Boolean);
            // same shape processBookForm saves
            book = {
                id: String(id),
                title: pick.title.trim(),
                authors: authors.length ? authors : ["Unknown"],
                series: "", seriesNumber: null, seriesTotal: null,
                status: appSettings.defaultStatus, rating: 0, genre: pick.genre, color, width: 120,
                tags: [], owned: false, notes: "", notesFont: getLastNoteFont(),
                startedDate: "", finishedDate: "",
                statusSince: now, dustedAt: null, stickyNote: false,
                pages: null, extraReads: [], lentTo: "", lentAt: null, recommendedBy: "",
                noPins: !appSettings.pinNewBooks,
                sortOrder: nextOrder++,
                image: "", imageRatio: null, ratioPreset: null,
                spineColor: color, spineImage: dataUrl, spineImageRatio
            };
            added++;
        } else {
            const existing = library.find(b => b.id === pick.id);
            if (!existing) continue;
            // a spine photo makes a sticky note a real book, like in the edit window
            book = { ...existing, spineImage: dataUrl, spineImageRatio, stickyNote: false };
        }
        await dbPut(book);
        const idx = library.findIndex(b => b.id === book.id);
        if (idx >= 0) library[idx] = book; else library.push(book);
        spines++;
    }

    populateAuthorOptions();
    populateSeriesOptions();
    populateFilterTagSelect();
    animateLeans = true;
    renderBookshelf();

    const inSpines = document.getElementById('view-mode').value === 'spine';
    document.getElementById('shelf-photo-done-text').innerText =
        `Saved ${spines} spine photo${spines === 1 ? '' : 's'}` +
        (added ? `, with ${added} new book${added === 1 ? '' : 's'} on your shelf.` : '.') +
        (inSpines ? '' : ' They show in Spines view.');
    showShelfPhotoStep('done');
    document.getElementById('shelf-photo-show').hidden = inSpines;
}

function showShelfPhotoSpines() {
    selectViewMode('spine');
    closeShelfPhoto();
}
