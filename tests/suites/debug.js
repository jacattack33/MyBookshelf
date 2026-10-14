// @size 1100x850
// The debug panel (Settings > Debug panel): its buttons force the critter,
// sticky notes, books and dust to do things right away.
const debugBtn = label => [...document.querySelectorAll('#debug-body button')].find(b => b.textContent === label);
const press = async (label, ms = 50) => { debugBtn(label).click(); await wait(ms); };
const status = () => q('#debug-status').textContent;

ok('hidden by default', q('#debug-panel').style.display === 'none');
setSetting('debug', true);
ok('Settings switch shows the tab', q('#debug-panel').style.display === '');
toggleDebugPanel();
ok('tab opens the panel', q('#debug-panel').classList.contains('open') && !!debugBtn('Run away now'));
ok('critter popup has no diamond', !q('#critter-modal h3').textContent.includes('◆'));

// ---- critter
critter = newCritterEgg(); saveCritter(); renderCritter();
await press('Next stage');
ok('next stage hatches the egg', critterStage().id === 'baby');
await press('Next stage');
ok('next stage grows it', critterStage().id === 'kid');
await press('Previous stage');
ok('previous stage takes it back one', critterStage().id === 'baby' && !!critter.bornAt);
await press('Previous stage');
ok('...and a baby goes back in its egg', !critter.bornAt && critter.totalFed === 0);
await press('Next stage');
await press('Next stage');
const fedBefore = critter.totalFed;
await press('Take 50');
ok('take 50 takes pages back off it, dropping a stage', critter.totalFed === fedBefore - 50 && critterStage().id === 'baby', status());
await press('Hungry');
ok('hungry', critterMood() === 'hungry');
await press('1 day from leaving');
ok('one day from leaving', critterMood() === 'starving' && status().includes('1 day'));
await press('+1 day');
ok('a day later it ran away', !!critter.gone);
await press('New egg');
ok('new egg', !critter.bornAt && !critter.gone);
await press('Feed 50');
await press('Run away now');
ok('run away now', !!critter.gone && critter.past.length === 2);

// ---- books
const before = library.length;
const deleteBtns = [...document.querySelectorAll('#debug-body button')].filter(b => b.textContent === 'Delete one');
deleteBtns[1].click();
await wait(200);
ok('deletes leave real books alone', library.length === before && status().includes('debug-made'), status());
await press('Add a book', 200);
ok('adds a book', library.length === before + 1 && library.some(b => b.debug));
const exitSelect = [...document.querySelectorAll('#debug-body select')][1];
exitSelect.value = 'tip';
deleteBtns[1].click();
await wait(3000);
ok('deletes a debug book with a chosen exit', library.length === before && !library.some(b => b.debug), status());
await press('Add a book', 200);
await press('Remove debug books & notes', 200);
ok('removes debug books', library.length === before && !library.some(b => b.debug));
ok('no way to delete real books', !q('#debug-real-books'));

// ---- sticky notes
await press('New note', 1500);
const sticky = library.find(b => b.stickyNote);
ok('makes a sticky note, flagged as debug', !!sticky && sticky.debug);
await press('Make one fall', 1800);
ok('a note falls', fallenNotes.size === 1);
await press('Stick all back up', 800);
ok('notes stuck back up', fallenNotes.size === 0 && !q('.book.sticky-book.fallen'));
deleteBtns[0].click();
await wait(3000);
ok('deletes a sticky note', !library.some(b => b.id === sticky.id));

// ---- dust
library.push({ id: 'dd1', title: 'Dusty', authors: ['A'], genre: 'Fantasy', status: 'Want to Read', owned: true, color: '#ccc', width: 100, sortOrder: 90, statusSince: Date.now() });
await press('Dust one', 100);
ok('dusts a book', getDustLevel(library.find(b => b.id === 'dd1')) === 2 || status().includes('dust'), status());

await press('Image link fails', 100);
ok('shows the failed image-link message', q('#book-modal').style.display === 'flex' && q('#book-image-link-error').classList.contains('show') && q('#book-image-link-error').innerText.startsWith("Couldn't load that link"));
closeModal();

// ---- sections fold up, and stay folded
const section = name => [...document.querySelectorAll('#debug-body .debug-section')].find(s => s.querySelector('summary').textContent === name);
section('Critter').querySelector('summary').click();
await wait(50);
ok('a section folds up from its heading', !section('Critter').open && section('Books').open && JSON.parse(localStorage.getItem(DEBUG_FOLDED_KEY)).includes('Critter'));
q('#debug-body').innerHTML = '';
buildDebugPanel();
ok('...and is still folded next time', !section('Critter').open && section('Books').open);
localStorage.removeItem(DEBUG_FOLDED_KEY);

setSetting('debug', false);
ok('switch hides it again', q('#debug-panel').style.display === 'none');
