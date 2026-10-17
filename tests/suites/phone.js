// @size 390x844
// Phone layout: Filters & sorting panel, filter badge, smaller books,
// compact (not pinned) edit preview, and drag reorder still saving.
const vis = el => getComputedStyle(el).display !== 'none';

ok('phone layout active', shelfScale() === 0.72 && innerWidth === 390, innerWidth);
ok('filters panel starts closed', !vis(q('#filters-panel')) && vis(q('#filters-toggle')));
toggleFiltersPanel();
ok('filters panel opens', vis(q('#filters-panel')) && q('#filters-toggle').getAttribute('aria-expanded') === 'true');
toggleFiltersPanel();
ok('filters panel closes', !vis(q('#filters-panel')));

ok('no filter badge with defaults', q('#filters-count').textContent === '');
selectFilterStatus('Read');
selectFilterSticky('Hide');
ok('badge counts active filters', q('#filters-count').textContent.includes('2'), q('#filters-count').textContent);
selectFilterStatus('All');
selectFilterSticky('Show');

const hobbit = q('.book[data-id="2"]');
ok('books drawn smaller', Math.round(parseFloat(hobbit.style.width)) === Math.round(110 * 0.72), hobbit.style.width);

selectOrganizeBy('status');
const shelf = q('.shelf[data-group="Read"]');
shelf.insertBefore(q('.book[data-id="2"]'), q('.book[data-id="1"]'));
await reorderLibraryData();
const order = (await dbGetAll()).filter(b => b.status === 'Read').sort((a, b) => a.sortOrder - b.sortOrder).map(b => b.id).join();
ok('drag reorder still saves', order.startsWith('2,1'), order);

openModal('1');
ok('edit preview scrolls with the form (not pinned)', getComputedStyle(q('.modal-preview')).position === 'static');
ok('preview book scaled for phones', parseFloat(q('#preview-book').style.width) < 120, q('#preview-book').style.width);
closeModal();

ok('pinch-zoom allowed', !q('meta[name=viewport]').content.includes('user-scalable=no'));

// corner widgets: tucked away behind the round button until it's tapped
const box = sel => q(sel).getBoundingClientRect();
const hidden = sel => getComputedStyle(q(sel)).visibility === 'hidden';
ok('corner widgets start tucked away', vis(q('#corner-toggle')) && ['#sticky-pile', '#stats-ledger', '#corner-stack'].every(hidden));
toggleCornerDock();
await wait(400);
ok('toggle shows the corner widgets', !['#sticky-pile', '#stats-ledger', '#corner-stack'].some(hidden) && q('#corner-toggle').getAttribute('aria-expanded') === 'true');
const toggleTop = box('#corner-toggle').top;
ok('sticky pile stands above the toggle', Math.max(...[...document.querySelectorAll('.sticky-sheet')].map(s => s.getBoundingClientRect().bottom)) <= toggleTop + 2, toggleTop);

// sticky pile at the bottom, ledger on it, goals card, critter on top
// (the sheets are drawn crooked, so measure their real corners)
const pileTop = Math.min(...[...document.querySelectorAll('.sticky-sheet')].map(s => s.getBoundingClientRect().top));
const ledger = box('#stats-ledger'), goals = box('#goals-card'), pet = box('#critter-home');
ok('ledger clear of the sticky pile', ledger.bottom + 3 <= pileTop, `${ledger.bottom} / ${pileTop}`);
ok('goals card clear of the ledger', goals.bottom <= ledger.top && goals.left >= 0, `${goals.bottom} / ${ledger.top}`);
ok('critter on top of the goals card', pet.bottom <= goals.top, `${pet.bottom} / ${goals.top}`);
const panel = getComputedStyle(q('#corner-stack'), '::before');
const stackBox = box('#corner-stack');
ok('frosted panel behind the open column', panel.content !== 'none' && panel.backgroundColor !== 'rgba(0, 0, 0, 0)' && stackBox.bottom + parseFloat(panel.bottom) * -1 >= innerHeight - 10, panel.bottom);
ok('ledger and pile drawn over the panel', +getComputedStyle(q('#stats-ledger')).zIndex > +getComputedStyle(q('#corner-stack')).zIndex);
ok('goals card shows its numbers', goals.height > 20 && q('#goals-card').textContent.includes('/20'), goals.height);
setTheme('terminal');
ok('terminal: critter on top of the goals card', box('#critter-home').bottom <= box('#goals-card').top, `${box('#critter-home').bottom} / ${box('#goals-card').top}`);
ok('terminal: goals card clear of the ledger', box('#goals-card').bottom <= box('#stats-ledger').top, `${box('#goals-card').bottom} / ${box('#stats-ledger').top}`);
setTheme('candy');
openStickyNote();
toggleCornerDock();
await wait(400);
ok('toggle hides them again (and drops an open note)', ['#sticky-pile', '#stats-ledger', '#corner-stack'].every(hidden) && !q('#sticky-pile').classList.contains('open'));

// ---- Whole shelf photo on a phone: a smaller toolbar, the colours
// folded away, and a wide photo starting big enough to tap
{
    const wide = document.createElement('canvas');
    wide.width = 1200; wide.height = 500;
    const wx = wide.getContext('2d');
    wx.fillStyle = '#d8d0c0'; wx.fillRect(0, 0, 1200, 500);
    ['#7a2b2b', '#2b4a7a', '#3d7a3a', '#c97a2b', '#5b3f94', '#2b6a6a', '#9a3a5a', '#e8d9a8'].forEach((col, i) => { wx.fillStyle = col; wx.fillRect(i * 150, 40, 150, 420); });
    openShelfPhoto();
    pickShelfPhotoKind('shelf');
    loadShelfPhoto(wide.toDataURL('image/png'));
    await wait(500);
    const backBtn = [...document.querySelectorAll('#shelf-photo-split .sp-tools button')].find(b => b.textContent.includes('Different photo'));
    ok('"Different photo" is just "Back"', backBtn.innerText.trim() === '← Back', encodeURIComponent(backBtn.innerText));
    ok('the colour sliders start folded away', !vis(q('#shelf-photo-colours')) && vis(q('#shelf-photo-colours-btn')));
    q('#shelf-photo-colours-btn').click();
    ok('Colours opens them', vis(q('#shelf-photo-colours')) && q('#shelf-photo-colours-btn').getAttribute('aria-expanded') === 'true');
    q('#shelf-photo-warmth').value = 40;
    adjustShelfPhoto();
    q('#shelf-photo-colours-btn').click();
    ok('folded with a colour moved, the button shows a dot', !vis(q('#shelf-photo-colours')) && q('#shelf-photo-colours-btn').classList.contains('sp-colours-changed'));
    const photoH = q('#shelf-photo-canvas').getBoundingClientRect().height;
    ok('a wide photo starts about half the screen tall', shelfPhotoZoom > 1 && photoH > innerHeight * 0.4, `${shelfPhotoZoom} / ${Math.round(photoH)}px`);
    ok('and scrolls sideways', q('#shelf-photo-split .sp-stage-wrap').scrollWidth > q('#shelf-photo-split .sp-stage-wrap').clientWidth);
    ok('the hint says tap on a touch screen', !matchMedia('(hover: none)').matches || q('#shelf-photo-hint').innerText.startsWith('Tap'), q('#shelf-photo-hint').innerText.slice(0, 20));
    ok('no sideways scrolling of the window itself', q('#shelf-photo-modal .modal-content').scrollWidth <= q('#shelf-photo-modal .modal-content').clientWidth + 1);
    closeShelfPhoto();
}
