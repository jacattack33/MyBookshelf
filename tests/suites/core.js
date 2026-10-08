// @size 1100x850
// Core checks: leaning books, dust, pull-out, library card, sticky-note
// quick add, and the shelf cat.
 const DAY = 864e5;
 const extra = [
   { id: 't1', title: 'Second Fantasy', authors: ['A'], genre: 'Fantasy', status: 'Want to Read', color: '#ff2e93', width: 110, sortOrder: 10, statusSince: Date.now() - 100 * DAY },
   { id: 't2', title: 'Third Fantasy', authors: ['B'], genre: 'Fantasy', status: 'Want to Read', color: '#5fe8c4', width: 100, sortOrder: 11, statusSince: Date.now() - 200 * DAY }
 ];
 for (const b of extra) { library.push(b); await dbPut(b); }
 renderBookshelf();

  // ---- lean
  const leaner = q('.shelf[data-group="Fantasy"] .book.leaning');
  ok('last fantasy book leans', leaner && leaner.dataset.id === 't2', leaner && leaner.style.getPropertyValue('--lean'));
  ok('single-book shelf no lean', !q('.shelf[data-group="Sci-Fi"] .book.leaning'));
  // ---- dust
  ok('100d dusty light', q('.book[data-id="t1"]').classList.contains('dusty') && !q('.book[data-id="t1"]').classList.contains('dusty-heavy'));
  ok('200d dusty heavy', q('.book[data-id="t2"]').classList.contains('dusty-heavy'));
  ok('read book clean', !q('.book[data-id="1"]').classList.contains('dusty'));
  q('.book[data-id="t1"]').dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
  await wait(800);
  ok('dust blown off', !q('.book[data-id="t1"]').classList.contains('dusty'));
  const stored = (await dbGetAll()).find(b => b.id === 't1');
  ok('dustedAt saved', stored && stored.dustedAt > Date.now() - 5000);
  renderBookshelf();
  ok('stays clean after render', !q('.book[data-id="t1"]').classList.contains('dusty'));
  // ---- pull-out
  const dune = q('.book[data-id="1"]');
  dune.click();
  ok('pull-out delays modal', document.getElementById('book-modal').style.display !== 'flex');
  await wait(350);
  ok('modal opens after pull', document.getElementById('book-modal').style.display === 'flex');
  // ---- library card
  setDateField('started', '2023-11');
  setDateField('finished', '2024-03-15');
  selectStatus('Read');
  document.getElementById('preview-book').click();
  ok('cover opens first', !q('#library-card-overlay').classList.contains('open') && !!q('#open-book-fx') && q('#preview-book').style.visibility === 'hidden');
  await wait(1900);
  ok('card out after cover', q('#library-card-overlay').classList.contains('open'));
  const hands = [...document.querySelectorAll('#library-card .lc-hand')].map(h => h.textContent);
  ok('card contents', hands.join('|') === 'Dune|Frank Herbert|Nov 2023|Mar 15, 2024', hands.join('|'));
  ok('card stamp', q('.lc-stamp').textContent.startsWith('RETURNED'));
  closeLibraryCard();
  await wait(2000);
  ok('card closed', !q('#library-card-overlay').classList.contains('open'));
  ok('cover shut again', !q('#open-book-fx') && q('#preview-book').style.visibility === '');
  closeModal();
  await wait(350);
  ok('pulled book settled back', dune.getAnimations().length === 0);
  // ---- sticky note
  openStickyNote();
  ok('sticky open', q('#sticky-pile').classList.contains('open'));
  const before = library.length;
  await submitStickyNote();
  ok('empty title rejected', library.length === before);
  document.getElementById('sticky-title').value = 'Quick Pick';
  document.getElementById('sticky-author').value = 'Some Author';
  document.getElementById('sticky-genre').value = 'Fantasy';
  await submitStickyNote();
  const nb = library[library.length - 1];
  ok('quick add', library.length === before + 1 && nb.title === 'Quick Pick' && nb.status === 'Want to Read' && nb.genre === 'Fantasy' && nb.statusSince > 0, JSON.stringify([nb.title, nb.status, nb.genre]));
  ok('quick-add book on shelf', !!q(`.book[data-id="${nb.id}"]`));
  ok('quick-added note shows as a sticky note, not leaning', q(`.book[data-id="${nb.id}"]`).classList.contains('sticky-book') && !q(`.book[data-id="${nb.id}"]`).classList.contains('leaning'));
  await wait(700);
  ok('note reset', !q('#sticky-pile').classList.contains('open'));
  openStickyNote(); closeStickyNote(); await wait(400);
  ok('esc/close discards', !q('#sticky-pile').classList.contains('open') && library.length === before + 1);
  // ---- cat
  const cat = q('#shelf-cat');
  ok('cat visible', cat.style.display === 'block' && !!cat.querySelector('svg'));
  const shelfTop = document.querySelectorAll('.genre-section')[catState.index].querySelector('.shelf').getBoundingClientRect().top + scrollY;
  ok('cat on shelf top', Math.abs(cat.offsetTop + cat.offsetHeight - shelfTop) < 2, (cat.offsetTop + cat.offsetHeight) + ' vs ' + shelfTop);
  const startIdx = catState.index;
  cat.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
  await wait(2000);
  ok('cat hopped shelves', catState.index !== startIdx, startIdx + '->' + catState.index);
  await wait(2300);
  ok('cat back asleep', cat.classList.contains('sleeping') && !catState.busy);
