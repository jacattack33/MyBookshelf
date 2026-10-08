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
