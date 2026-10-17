// @size 1100x850
// Shelf photo: finding the gaps between spines, moving the lines, and
// saving a slice to an existing book and to a new one.

// a made-up shelf: coloured spines of different widths and heights,
// with a bit of grain and some "lettering" on each, standing on a
// wooden shelf board with the board of the shelf above across the top
const WIDTHS = [60, 34, 90, 48, 70];
const TOPS = [24, 70, 16, 110, 45];
const COLORS = ['#7a2b2b', '#e8d9a8', '#2b4a7a', '#3d7a3a', '#c97a2b'];
function fakeShelf() {
    const c = document.createElement('canvas');
    c.width = WIDTHS.reduce((a, b) => a + b, 0);
    c.height = 300;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#d8d0c0';
    ctx.fillRect(0, 0, c.width, 270);
    ctx.fillStyle = '#5a3d22';
    ctx.fillRect(0, 0, c.width, 8);
    let x = 0;
    WIDTHS.forEach((w, i) => {
        ctx.fillStyle = COLORS[i];
        ctx.fillRect(x, TOPS[i], w, 270 - TOPS[i]);
        ctx.fillStyle = i === 1 ? '#222' : '#f4f0e0';
        for (let y = TOPS[i] + 25; y < 250; y += 22) ctx.fillRect(x + w * 0.3, y, w * 0.4, 12);
        x += w;
    });
    ctx.fillStyle = '#6b4a2a';
    ctx.fillRect(0, 270, c.width, 30);
    const img = ctx.getImageData(0, 0, c.width, c.height);
    let seed = 7;
    for (let i = 0; i < img.data.length; i += 4) {
        seed = (seed * 16807) % 2147483647;
        const n = (seed % 13) - 6;
        img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
    return c;
}
const shelfCanvas = fakeShelf();
const boundaries = WIDTHS.slice(0, -1).map((w, i) => WIDTHS.slice(0, i + 1).reduce((a, b) => a + b, 0));

// ---- finding the gaps
const shelfPixels = shelfCanvas.getContext('2d').getImageData(0, 0, shelfCanvas.width, shelfCanvas.height);
const gaps = findSpineGaps(shelfPixels, 116, 261);
ok('finds one gap per spine edge', gaps.length === boundaries.length, JSON.stringify(gaps));
ok('gaps are where the spines meet', boundaries.every(b => gaps.some(g => Math.abs(g - b) <= 3)), JSON.stringify({ gaps, boundaries }));

// ---- finding where each spine starts
const wide = rowEdgeShare(shelfPixels, 0, shelfPixels.width);
const starts = [0, ...boundaries, shelfPixels.width];
const tops = TOPS.map((_, i) => findSpineTop(shelfPixels, starts[i], starts[i + 1], 270, wide));
ok('each spine starts at its own height', tops.every((t, i) => Math.abs(t - TOPS[i]) <= 3), JSON.stringify({ tops, TOPS }));
const level = document.createElement('canvas');
level.width = 120; level.height = 200;
const lctx = level.getContext('2d');
lctx.fillStyle = '#d8d0c0'; lctx.fillRect(0, 0, 120, 200);
lctx.fillStyle = '#7a2b2b'; lctx.fillRect(0, 30, 60, 170);
lctx.fillStyle = '#2b4a7a'; lctx.fillRect(60, 30, 60, 170);
const levelPx = lctx.getImageData(0, 0, 120, 200);
ok('books all one height still get a top', Math.abs(findSpineTop(levelPx, 0, 60, 200, rowEdgeShare(levelPx, 0, 120)) - 30) <= 3);
const plain = document.createElement('canvas');
plain.width = 200; plain.height = 100;
plain.getContext('2d').fillStyle = '#888';
plain.getContext('2d').fillRect(0, 0, 200, 100);
ok('no gaps in a plain picture', findSpineGaps(plain.getContext('2d').getImageData(0, 0, 200, 100), 0, 100).length === 0);

// ---- the link only shows when adding a book
openModal('1');
ok('no shelf photo link while editing', q('#shelf-photo-link').style.display === 'none');
closeModal();
await wait(350);
openModal();
ok('shelf photo link in Add Book', q('#shelf-photo-link').style.display === '');
q('#shelf-photo-link').click();
ok('it closes Add Book', q('#book-modal').style.display === 'none');
ok('and opens the window', q('#shelf-photo-modal').style.display === 'flex' && !q('#shelf-photo-pick').hidden);

// ---- shelf or stack, asked first
ok('asks shelf or stack first', document.querySelectorAll('#shelf-photo-pick .sp-kind').length === 2 &&
    !q('#shelf-photo-pick .sp-kind.picked') && q('#shelf-photo-choose').disabled);
q('#shelf-photo-pick [data-sp-kind="stack"]').click();
ok('picking one lets you choose a photo', q('[data-sp-kind="stack"]').getAttribute('aria-checked') === 'true' &&
    !q('#shelf-photo-choose').disabled);
q('#shelf-photo-pick [data-sp-kind="shelf"]').click();
ok('and it can be changed', q('[data-sp-kind="shelf"]').classList.contains('picked') && !q('[data-sp-kind="stack"]').classList.contains('picked'));

// ---- loading the photo guesses the lines
loadShelfPhoto(shelfCanvas.toDataURL('image/png'));
await wait(300);
ok('loads as the kind picked', shelfPhoto.mode === 'shelf' && q('[data-sp-mode="shelf"]').classList.contains('active'));
ok('a small photo starts zoomed to the window width', shelfPhoto && shelfPhotoZoom > 1);
zoomShelfPhoto(0);
ok('picture shown', !q('#shelf-photo-split').hidden && q('#shelf-photo-canvas').width === shelfCanvas.width);
ok('one slice per spine', document.querySelectorAll('#shelf-photo-overlay .sp-slice').length === 5 &&
    document.querySelectorAll('#shelf-photo-rows .sp-row').length === 5);
ok('save waits for a book', q('#shelf-photo-save').disabled);
// (with a little room past the top, not cut right at it)
const PAD = SHELF_PHOTO_EDGE_PAD * 300;
ok('slices start just above each spine', shelfPhoto.tops.every((t, i) => Math.abs(t * 300 - (TOPS[i] - PAD)) <= 4), JSON.stringify(shelfPhoto.tops.map(t => Math.round(t * 300))));
ok('a top line per spine, and the shelf', document.querySelectorAll('#shelf-photo-overlay .sp-line.end.h').length === 6 &&
    document.querySelectorAll('#shelf-photo-overlay .sp-line.cut.v').length === 4);

// ---- adding and removing lines
addShelfDivider(0.1);
ok('a click adds a line', shelfPhoto.dividers.length === 5 && document.querySelectorAll('#shelf-photo-rows .sp-row').length === 6);
// the x stays put under the pointer while it's pressed
const x = q('#shelf-photo-overlay .sp-line.cut .sp-remove');
const xr = x.getBoundingClientRect();
ok('the x is what you press', document.elementFromPoint(xr.left + xr.width / 2, xr.top + xr.height / 2) === x);
const pressed = [...document.styleSheets].some(sheet => { try { return [...sheet.cssRules].some(r =>
    r.selectorText && r.selectorText.includes('#shelf-photo-overlay button:active') && r.style.transform === 'none'); } catch (e) { return false; } });
ok('pressing the x does not move it', pressed && getComputedStyle(x).transform === 'none');
x.click();
ok('its x removes it', shelfPhoto.dividers.length === 4 && document.querySelectorAll('#shelf-photo-rows .sp-row').length === 5);
ok('and the spine keeps its top', Math.abs(shelfPhoto.tops[0] * 300 - (TOPS[0] - PAD)) <= 4);
ok('the shelf line sits just below the books', Math.abs(shelfPhoto.bottom * 300 - (270 + PAD)) <= 4, shelfPhoto.bottom * 300);

// a dragged top stays put when the lines next to it change
shelfPhoto.tops[3] = 0.5; shelfPhoto.ownTop[3] = true;
guessShelfTops();
ok('a dragged top is kept', shelfPhoto.tops[3] === 0.5);
shelfPhoto.ownTop[3] = false;
guessShelfTops([3]);
renderShelfPhotoOverlay();

// ---- a slice that isn't a book
q('#shelf-photo-rows .sp-row[data-slice="4"] .sp-notbook').click();
ok('not a book: no row, no number', shelfPhoto.blank[4] && !q('#shelf-photo-rows .sp-row[data-slice="4"]') &&
    document.querySelectorAll('#shelf-photo-overlay .sp-slice:not(.blank)').length === 4 &&
    q('#shelf-photo-count').textContent.startsWith('4 spines'));
const unskip = q('#shelf-photo-overlay .sp-slice.blank .sp-unskip');
ok('a + to bring it back', !!unskip);
unskip.click();
ok('a book again', !shelfPhoto.blank[4] && !!q('#shelf-photo-rows .sp-row[data-slice="4"]') && shelfPhoto.dividers.length === 4);
q('#shelf-photo-overlay .sp-slice[data-slice="4"] .sp-skip').click();
ok('or from the photo', shelfPhoto.blank[4] && shelfPhoto.dividers.length === 4);
setShelfBlank(4, false);
const strip1 = q('#shelf-photo-rows .sp-row[data-slice="0"] .sp-strip canvas');
ok('standing spines lie down in the preview too', strip1.width > strip1.height * 2, strip1.width + 'x' + strip1.height);

// ---- picking books
const search = q('#shelf-photo-rows .sp-row[data-slice="0"] .sp-search input');
search.focus();
search.value = library[0].title.slice(0, 4);
search.dispatchEvent(new Event('input'));
const opt = [...document.querySelectorAll('#shelf-photo-rows .sp-row[data-slice="0"] .sp-options li')]
    .find(li => li.querySelector('.sp-opt-title') && li.querySelector('.sp-opt-title').textContent === library[0].title);
ok('search finds the book', !!opt);
opt.click();
ok('slice 1 is that book', shelfPhoto.picks[0] && shelfPhoto.picks[0].id === library[0].id);
ok('its x sits beside the title', !!q('#shelf-photo-rows .sp-row[data-slice="0"] .sp-picked .sp-unpick'));
tiltShelfPhoto(2.5);
ok('straighten turns it', shelfPhoto.tilt === 2.5);
tiltShelfPhoto(0);
ok('and back to as taken', shelfPhoto.tilt === 0 && q('#shelf-photo-tilt').value === '0');

// ---- brightness, contrast, warmth and saturation
const hexSum = hex => [1, 3, 5].reduce((s, k) => s + parseInt(hex.slice(k, k + 2), 16), 0);
const plainCut = cutShelfSlice(0).color;
const linesBefore = JSON.stringify([shelfPhoto.dividers, shelfPhoto.tops, shelfPhoto.bottom]);
ok('the colour sliders start in the middle', !q('#shelf-photo-split').classList.contains('sp-adjusted') && q('#shelf-photo-adjust-reset').hidden);
q('#shelf-photo-brightness').value = -80;
adjustShelfPhoto();
ok('moving one previews it on the photo and the spines in the list', getComputedStyle(q('#shelf-photo-canvas')).filter.includes('shelf-photo-adjust-filter') &&
    getComputedStyle(q('#shelf-photo-rows .sp-strip canvas')).filter.includes('shelf-photo-adjust-filter') && !q('#shelf-photo-adjust-reset').hidden);
ok('the lines stay where they were', JSON.stringify([shelfPhoto.dividers, shelfPhoto.tops, shelfPhoto.bottom]) === linesBefore);
const darkCut = cutShelfSlice(0).color;
ok('a saved spine gets the colours', hexSum(darkCut) < hexSum(plainCut) - 150, plainCut + ' -> ' + darkCut);
resetShelfPhotoAdjust();
ok('Reset colours puts them back', !q('#shelf-photo-split').classList.contains('sp-adjusted') && q('#shelf-photo-brightness').value === '0' && cutShelfSlice(0).color === plainCut);

// ---- zooming in
zoomShelfPhoto(0);
const fitW = q('#shelf-photo-canvas').getBoundingClientRect().width;
zoomShelfPhoto(1);
ok('zoom in makes the photo bigger', Math.abs(q('#shelf-photo-canvas').getBoundingClientRect().width - fitW * 1.5) <= 2 &&
    q('#shelf-photo-split .sp-stage-wrap').classList.contains('zoomed'));
const line0 = q('#shelf-photo-overlay .sp-line.cut').getBoundingClientRect();
const cv = q('#shelf-photo-canvas').getBoundingClientRect();
ok('lines stay on the photo', Math.abs((line0.left + line0.width / 2 - cv.left) / cv.width - shelfPhoto.dividers[0]) < 0.01);
zoomShelfPhoto(0);
ok('fit goes back', Math.abs(q('#shelf-photo-canvas').getBoundingClientRect().width - fitW) <= 1 && q('#shelf-photo-fit').classList.contains('active'));
setShelfPick(0, { id: library[0].id });
ok('save counts it', !q('#shelf-photo-save').disabled && q('#shelf-photo-save').textContent === 'Save 1 spine');

setShelfPick(2, { id: library[0].id });
ok('one book, one slice', !shelfPhoto.picks[0] && shelfPhoto.picks[2].id === library[0].id);
setShelfPick(0, { id: library[0].id });

const search2 = q('#shelf-photo-rows .sp-row[data-slice="1"] .sp-search input');
search2.focus();
search2.value = 'Spine Test Book';
search2.dispatchEvent(new Event('input'));
q('#shelf-photo-rows .sp-row[data-slice="1"] .sp-opt-new').click();
const newTitle = q('#shelf-photo-rows .sp-row[data-slice="1"] .sp-new-title');
ok('new book takes the typed title', !!newTitle && newTitle.value === 'Spine Test Book');
q('#shelf-photo-rows .sp-row[data-slice="1"] .sp-new-author').value = 'Ada Shelf';
q('#shelf-photo-rows .sp-row[data-slice="1"] .sp-new-author').dispatchEvent(new Event('input'));

// a new book with no title isn't saved
setShelfPick(3, { isNew: true, title: '', author: '', genre: null });
const before = library.length;
await saveShelfPhoto();
ok('untitled new book stops the save', library.length === before && q('#shelf-photo-done').hidden &&
    q('#shelf-photo-rows .sp-row[data-slice="3"] .sp-new-title').classList.contains('missing'));
q('#shelf-photo-rows .sp-row[data-slice="3"] .sp-unpick').click();
ok('skipping a slice', shelfPhoto.picks[3] === null);

// ---- saving
const untouched = JSON.stringify(library.slice(1));
await saveShelfPhoto();
const old = library[0];
const made = library.find(b => b.title === 'Spine Test Book');
ok('existing book has its spine', old.spineImage.startsWith('data:image/jpeg') && old.spineImageRatio > 0.1 && old.spineImageRatio < 0.6);
ok('new book on the shelf', !!made && made.authors[0] === 'Ada Shelf' && made.spineImage.startsWith('data:image/jpeg') &&
    made.status === appSettings.defaultStatus && made.owned === false && !made.stickyNote);
ok('nothing else changed', JSON.stringify(library.slice(1).filter(b => b !== made)) === untouched);
const saved = await new Promise(res => {
    const r = indexedDB.open('BookShelfDB');
    r.onsuccess = () => {
        const tx = r.result.transaction(r.result.objectStoreNames[0]);
        const g = tx.objectStore(r.result.objectStoreNames[0]).getAll();
        g.onsuccess = () => { res(g.result); r.result.close(); };
    };
});
ok('saved to the database', saved.some(b => b.title === 'Spine Test Book' && b.spineImage) && saved.find(b => b.id === old.id).spineImage === old.spineImage);
ok('done message', !q('#shelf-photo-done').hidden && /Saved 2 spine photos, with 1 new book/.test(q('#shelf-photo-done-text').textContent));

q('#shelf-photo-show').click();
await wait(200);
ok('Show Spines switches view', q('#view-mode').value === 'spine' && q('#shelf-photo-modal').style.display === 'none');
const spineEl = q(`.book[data-id="${old.id}"]`);
ok('spine photo on the shelf', !!spineEl && spineEl.style.backgroundImage.includes('blob:'));

// ---- going back for a different photo
openShelfPhoto();
ok('remembers last time', q('[data-sp-kind="shelf"]').classList.contains('picked') && !q('#shelf-photo-choose').disabled);
q('#shelf-photo-warmth').value = 50;
adjustShelfPhoto();
loadShelfPhoto(shelfCanvas.toDataURL('image/png'));
await wait(300);
ok('a new photo starts with the colour sliders in the middle', q('#shelf-photo-warmth').value === '0' && !q('#shelf-photo-split').classList.contains('sp-adjusted'));
[...document.querySelectorAll('#shelf-photo-split .sp-tools button')].find(b => b.textContent.includes('Different photo')).click();
ok('different photo goes back to the start', !q('#shelf-photo-pick').hidden && q('#shelf-photo-split').hidden && shelfPhoto === null);
try { localStorage.setItem('shelfPhotoMode', 'shelf'); } catch (e) {}

// ---- a stack of books lying down
// lying books of different lengths and thicknesses, each poking out a
// different amount either side, on a table
const LENGTHS = [[30, 300], [50, 280], [20, 330], [60, 260], [40, 310]];
const THICK = [30, 50, 24, 40, 56];
const stack = document.createElement('canvas');
stack.width = 360; stack.height = 280;
const sctx = stack.getContext('2d');
sctx.fillStyle = '#d8d0c0'; sctx.fillRect(0, 0, 360, 280);
sctx.fillStyle = '#6b4a2a'; sctx.fillRect(0, 250, 360, 30);
let sy = 250;
const layers = [];
THICK.forEach((t, i) => {
    sy -= t;
    layers.unshift(sy);
    const [x0, x1] = LENGTHS[i];
    sctx.fillStyle = COLORS[i];
    sctx.fillRect(x0, sy, x1 - x0, t);
    sctx.fillStyle = i === 1 ? '#222' : '#f4f0e0';
    for (let x = x0 + 20; x < x1 - 20; x += 22) sctx.fillRect(x, sy + t * 0.3, 12, t * 0.4);
});
// top to bottom: the last book drawn is on top
const stackOrder = THICK.map((_, i) => THICK.length - 1 - i);

openShelfPhoto();
loadShelfPhoto(stack.toDataURL('image/png'));
await wait(300);
ok('starts as a shelf', shelfPhoto.mode === 'shelf' && q('[data-sp-mode="shelf"]').classList.contains('active'));
q('[data-sp-mode="stack"]').click();
ok('stack mode', shelfPhoto.mode === 'stack' && q('[data-sp-mode="stack"]').classList.contains('active') &&
    q('#shelf-photo-overlay').classList.contains('stack'));
// the wall above the stack and the table under it aren't books
ok('wall and table left out', shelfPhoto.blank[0] && shelfPhoto.blank[shelfPhoto.blank.length - 1] &&
    document.querySelectorAll('#shelf-photo-rows .sp-row').length === 5);
const books = shelfPhoto.blank.map((b, i) => b ? -1 : i).filter(i => i >= 0);
ok('one slice per lying book', books.length === 5, JSON.stringify(shelfPhoto.dividers.map(d => Math.round(d * 280))));
ok('numbered from the top book', q('#shelf-photo-overlay .sp-slice[data-slice="' + books[0] + '"] .sp-num').textContent === '1');
const between = layers.slice(1);
ok('lines between the books', between.every(y => shelfPhoto.dividers.some(d => Math.abs(d * 280 - y) <= 3)),
    JSON.stringify({ got: shelfPhoto.dividers.map(d => Math.round(d * 280)), between }));
ok('lines run across', document.querySelectorAll('#shelf-photo-overlay .sp-line.cut.h').length === 6 &&
    document.querySelectorAll('#shelf-photo-overlay .sp-line.end.v').length === 10);
const near = (a, b) => Math.abs(a - b) <= 4;
ok('each book starts and stops where it does', stackOrder.every((b, n) =>
    near(shelfPhoto.tops[books[n]] * 360, LENGTHS[b][0] - SHELF_PHOTO_EDGE_PAD * 360) &&
    near(shelfPhoto.ends[books[n]] * 360, LENGTHS[b][1] + SHELF_PHOTO_EDGE_PAD * 360)),
    JSON.stringify(shelfPhoto.tops.map((t, i) => [Math.round(t * 360), Math.round(shelfPhoto.ends[i] * 360)])));
const strip = q('#shelf-photo-rows .sp-row[data-slice="' + books[0] + '"] .sp-strip canvas');
ok('previews lie the spine on its side', strip.width > strip.height * 3, strip.width + 'x' + strip.height);

setShelfPick(books[0], { id: library[1].id });
await saveShelfPhoto();
const stood = library.find(b => b.id === library[1].id);
const top = stackOrder[0];
const expect = THICK[top] / (LENGTHS[top][1] - LENGTHS[top][0]);
ok('saved spine stands upright', Math.abs(stood.spineImageRatio - expect) < 0.03, stood.spineImageRatio + ' vs ' + expect);
let remembered = null;
try { remembered = localStorage.getItem('shelfPhotoMode'); } catch (e) {}
ok('stack is remembered', remembered === 'stack');
closeShelfPhoto();

// ---- Cover / Spine in the edit window's preview
const withSpine = library.find(b => b.spineImage);
const noSpine = library.find(b => !b.spineImage && !b.stickyNote);
openModal(withSpine.id);
await wait(200);
ok('preview starts on the cover', q('[data-preview-face="cover"]').classList.contains('active') &&
    getComputedStyle(q('#preview-spine')).display === 'none' && getComputedStyle(q('#preview-book')).display !== 'none');
q('[data-preview-face="spine"]').click();
await wait(300);
const ps = q('#preview-spine');
ok('spine shows the spine photo', getComputedStyle(ps).display !== 'none' && getComputedStyle(q('#preview-book')).display === 'none' &&
    ps.style.backgroundImage.includes('data:image/jpeg') && !ps.classList.contains('spine-mode-generated'));
const psr = ps.getBoundingClientRect();
ok('at its shelf size', Math.abs(psr.width / psr.height - withSpine.spineImageRatio) < 0.05 || psr.width === 18, psr.width + 'x' + psr.height);
ps.click();
ok('clicking it shows the cover again', q('[data-preview-face="cover"]').classList.contains('active'));
closeModal();
await wait(350);
openModal(noSpine.id);
await wait(200);
setPreviewFace('spine');
await wait(300);
ok('no photo: the leather spine with the title', q('#preview-spine').classList.contains('spine-mode-generated') &&
    q('#preview-spine .spine-label').textContent.startsWith(noSpine.title));
// adding a spine photo turns the preview to it
setPreviewFace('cover');
cropContext = 'spine';
applyCropResult(shelfCanvas.toDataURL('image/jpeg'));
await wait(300);
ok('a new spine photo turns the preview to it', previewFace === 'spine' && q('#preview-spine').style.backgroundImage.includes('data:image/jpeg'));
cancelCrop();
closeModal();
await wait(350);
openModal();
ok('a new book starts on the cover', previewFace === 'cover');
closeModal();
await wait(350);
