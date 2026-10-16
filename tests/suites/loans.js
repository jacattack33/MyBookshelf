// @size 1100x850
// Page counts, dates written on the library card (re-reads), lending a
// book out, and the backup reminder / Export glow.
const DAY = 864e5;
const cell = (row, field) => q(`#lc-rows .lc-cell[data-row="${row}"][data-field="${field}"]`);
const write = async (td, text, key = 'Enter') => {
    td.click();
    const input = q('#lc-rows .lc-input'); // a blank line is redrawn as a new one first
    input.value = text;
    input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    await wait(50);
};

// ---- reading what's written on the card
ok('date: year', parseLooseDate('2024') === '2024');
ok('date: month name', parseLooseDate('March 2024') === '2024-03' && parseLooseDate('mar 2024') === '2024-03');
ok('date: full', parseLooseDate('Mar 15, 2024') === '2024-03-15' && parseLooseDate('15 March 2024') === '2024-03-15');
ok('date: slashes', parseLooseDate('3/2024') === '2024-03' && parseLooseDate('3/15/24') === '2024-03-15');
ok('date: iso', parseLooseDate('2024-03-15') === '2024-03-15');
ok('date: blank', parseLooseDate('  ') === '');
ok('date: nonsense', parseLooseDate('soon') === null && parseLooseDate('Feb 30, 2024') === null && parseLooseDate('13/2024') === null);

// ---- marking Read leaves the Finished date alone
openModal('2');
pickStatus('Read', q('.status-btn[data-status="Read"]'));
ok('Read does not fill in today', readDateField('finished', 'finished').value === '');
closeModal();
await wait(350);

// ---- page count saves with the book and shows on the card
openModal('1');
q('#book-pages').value = '412';
selectStatus('Read');
setDateField('started', '2024-01');
setDateField('finished', '2024-02-10');
openLibraryCard();
await wait(1900);
ok('card shows pages', q('#library-card .lc-pages .lc-hand').textContent === '412');
ok('card has blank lines to write on', document.querySelectorAll('#lc-rows .lc-cell[data-row="new"]').length >= 2);

// ---- writing dates on the card
await write(cell('main', 'finished'), 'Feb 20, 2024');
ok('first line writes the Finished date', readDateField('finished', 'finished').value === '2024-02-20' && cell('main', 'finished').textContent === 'Feb 20, 2024');
await write(cell('new', 'started'), '3/2025');
ok('a blank line starts another read', formExtraReads.length === 1 && formExtraReads[0].started === '2025-03' && cell('0', 'started').textContent === 'Mar 2025');
await write(cell('0', 'finished'), 'Jan 2025');
ok('returned before checked out is refused', formExtraReads[0].finished === '' && !!cell('0', 'finished').querySelector('.lc-input.lc-bad'));
const bad = cell('0', 'finished').querySelector('.lc-input');
bad.value = 'April 2, 2025';
bad.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
await wait(50);
ok('fixed date is written', formExtraReads[0].finished === '2025-04-02');
await write(cell('new', 'finished'), 'nonsense');
const stuck = q('#lc-rows .lc-input');
ok('unreadable date keeps you writing', !!stuck && stuck.classList.contains('lc-bad'));
stuck.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
await wait(50);
ok('escape drops the empty line', formExtraReads.length === 1 && !q('#lc-rows .lc-input'));
ok('clicking a line does not close the card', q('#library-card-overlay').classList.contains('open'));
closeLibraryCard();
await wait(2000);
await processBookForm();
const dune = library.find(b => b.id === '1');
ok('pages and re-reads saved', dune.pages === 412 && dune.extraReads.length === 1 && dune.extraReads[0].finished === '2025-04-02' && dune.finishedDate === '2024-02-20');

// ---- stats count the re-read and its pages
openStats();
const tile = label => [...document.querySelectorAll('.stats-tile')].find(t => t.firstChild.textContent === label).lastChild.textContent;
ok('pages read tile', tile('Pages read') === '824', tile('Pages read'));
q('#stats-year').value = '2025';
renderStatsChart();
ok('re-read counts in its year', q('#stats-chart-sub').textContent.startsWith('1 book finished in 2025') && q('#stats-chart-sub').textContent.includes('412 pages'));
closeStats();

// ---- lending
openModal('2');
ok('lend box hidden until owned', !q('#lend-row').classList.contains('visible'));
setOwned(true);
ok('owning shows the lend box', q('#lend-row').classList.contains('visible'));
q('#book-lent-to').value = 'Sam';
updateLendHint();
ok('lend hint', q('#lend-hint').textContent === 'Lent from today.');
await processBookForm();
let hobbit = library.find(b => b.id === '2');
ok('lent saved', hobbit.lentTo === 'Sam' && hobbit.lentAt > Date.now() - 5000);
let el = q('.book[data-id="2"]');
ok('lent book leaves a tag on the shelf', el.classList.contains('lent-out') && el.querySelector('.lent-name').textContent === 'Sam');
ok('lent book is not dusty yet', !el.classList.contains('dusty'));
selectFilterOwned('Lent');
ok('Lent Out filter', [...document.querySelectorAll('#library-room .book')].map(b => b.dataset.id).join() === '2');
selectFilterOwned('All');
const sinceBefore = hobbit.lentAt;
openModal('2');
await processBookForm();
ok('same person keeps the lent date', library.find(b => b.id === '2').lentAt === sinceBefore);
// a month gone: dust
hobbit = library.find(b => b.id === '2');
hobbit.lentAt = Date.now() - 40 * DAY;
renderBookshelf();
ok('lent a month: dusty spot', q('.book[data-id="2"]').classList.contains('dusty') && !q('.book[data-id="2"]').classList.contains('dusty-heavy'));
hobbit.lentAt = Date.now() - 100 * DAY;
renderBookshelf();
ok('lent three months: heavy dust', q('.book[data-id="2"]').classList.contains('dusty-heavy'));
// back home
openModal('2');
markBookReturned();
await processBookForm();
hobbit = library.find(b => b.id === '2');
ok('returned clears it', !hobbit.lentTo && !hobbit.lentAt && !q('.book[data-id="2"]').classList.contains('lent-out'));
// unowned: can't be lent
openModal('2');
q('#book-lent-to').value = 'Alex';
setOwned(false);
await processBookForm();
ok('not owned: not lent', !library.find(b => b.id === '2').lentTo);

// ---- Series shelf: books you own carry a gold bookplate seal
library.push({ id: 'so1', title: 'Owned One', authors: ['A'], genre: 'Fantasy', status: 'Read', owned: true, color: '#345', width: 100, series: 'Saga', seriesNumber: 1, sortOrder: 60 });
library.push({ id: 'so2', title: 'Wanted Two', authors: ['A'], genre: 'Fantasy', status: 'Want to Read', owned: false, color: '#543', width: 100, series: 'Saga', seriesNumber: 2, sortOrder: 61 });
selectOrganizeBy('series');
ok('series: owned book has a seal', !!q('.book[data-id="so1"] .series-owned-seal'));
ok('series: not-owned book has none', !q('.book[data-id="so2"] .series-owned-seal'));
ok('series: unread book faded, read one not', q('.book[data-id="so2"]').classList.contains('faded-unread') && !q('.book[data-id="so1"]').classList.contains('faded-unread'));
setSetting('ownedSeal', 'off');
ok('Settings can turn the seal off', !q('.book[data-id="so1"] .series-owned-seal'));
setSetting('ownedSeal', 'series');
ok('...and back on', !!q('.book[data-id="so1"] .series-owned-seal'));
selectOrganizeBy('genre');
ok('seal and fade only on the Series shelf by default', !q('.book[data-id="so1"] .series-owned-seal') && !q('.book[data-id="so2"]').classList.contains('faded-unread'));
setSetting('ownedSeal', 'all');
setSetting('unreadFade', 'all');
ok('Every shelf: seal and fade on the Genre shelf', !!q('.book[data-id="so1"] .series-owned-seal') && q('.book[data-id="so2"]').classList.contains('faded-unread'));
ok('Every shelf button shows as chosen', q('[data-setting-choice="ownedSeal"][data-choice="all"]').classList.contains('active') && !q('[data-setting-choice="ownedSeal"][data-choice="series"]').classList.contains('active'));
selectOrganizeBy('status');
ok('...and on the Status shelf', !!q('.book[data-id="so1"] .series-owned-seal') && q('.book[data-id="so2"]').classList.contains('faded-unread'));
setSetting('unreadFade', 'off');
selectOrganizeBy('series');
ok('fade off: not even on the Series shelf', !q('.book[data-id="so2"]').classList.contains('faded-unread'));
setSetting('ownedSeal', 'series');
setSetting('unreadFade', 'series');
selectOrganizeBy('genre');
// the old on/off seal switch carries over
localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...appSettings, ownedSeal: undefined, seriesSeal: false }));
loadSettings();
ok('old seal switch (off) carries over', appSettings.ownedSeal === 'off' && !('seriesSeal' in appSettings));
setSetting('ownedSeal', 'series');
library = library.filter(b => !['so1', 'so2'].includes(b.id));
renderBookshelf();

// ---- only the 3 placeholder books: no nagging, and export warns first
localStorage.removeItem(LAST_BACKUP_KEY);
localStorage.setItem(FIRST_SEEN_KEY, String(Date.now() - 8 * DAY));
ok('placeholder shelf detected', onlyPlaceholderBooks());
ok('no reminder for just the placeholders', !backupReminderDue());
const realConfirm = window.confirm;
let asked = '';
window.confirm = msg => { asked = msg; return false; };
exportLibrary();
ok('export warns about placeholder-only shelf', asked.includes('3 placeholder books') && !readTimeKey(LAST_BACKUP_KEY));
window.confirm = realConfirm;

// ---- backup reminder (with a real book on the shelf)
library.push({ id: 'bk1', title: 'My Own Book', authors: ['A'], genre: 'Fantasy', status: 'Read', color: '#345', width: 100, sortOrder: 65 });
ok('a real book: not just placeholders', !onlyPlaceholderBooks());
localStorage.removeItem(LAST_BACKUP_KEY);
localStorage.setItem(FIRST_SEEN_KEY, String(Date.now() - 2 * DAY));
ok('not due right after first opening', !backupReminderDue());
localStorage.setItem(FIRST_SEEN_KEY, String(Date.now() - 8 * DAY));
ok('never backed up: due after a week', backupReminderDue());
localStorage.setItem(LAST_BACKUP_KEY, String(Date.now() - 10 * DAY));
ok('backed up 10 days ago: not due', !backupReminderDue());
localStorage.setItem(LAST_BACKUP_KEY, String(Date.now() - 31 * DAY));
ok('backed up a month ago: due', backupReminderDue());
showBackupReminder();
ok('reminder shows', q('#backup-reminder').classList.contains('visible') && q('#backup-reminder-text').textContent.includes('31 days'));
scrollTo(0, document.body.scrollHeight);
const reminderBox = q('#backup-reminder').getBoundingClientRect();
ok('reminder pops up on screen, even scrolled down', getComputedStyle(q('#backup-reminder')).position === 'fixed' && reminderBox.top >= 0 && reminderBox.bottom <= innerHeight, `${reminderBox.top} / ${reminderBox.bottom}`);
scrollTo(0, 0);
ok('export glows with it', q('#export-btn').classList.contains('backup-glow'));
snoozeBackupReminder();
ok('later: hidden and snoozed', !q('#backup-reminder').classList.contains('visible') && !backupReminderDue());
localStorage.removeItem(BACKUP_SNOOZE_KEY);
setSetting('backupReminders', false);
ok('setting off: never due', !backupReminderDue());
setSetting('backupReminders', true);
showBackupReminder();
exportLibrary();
ok('exporting hides it and records the backup', !q('#backup-reminder').classList.contains('visible') && Date.now() - readTimeKey(LAST_BACKUP_KEY) < 5000 && lastBackupText() === 'Last backup: today.');
ok('just backed up: not due', !backupReminderDue());
library = library.filter(b => b.id !== 'bk1');

// ---- big page counts fit on the tiny goals card
ok('compact numbers', compactNumber(999) === '999' && compactNumber(1250) === '1.2k' && compactNumber(1999) === '1.9k' && compactNumber(2000) === '2k' && compactNumber(12500) === '12k');
setSetting('goal', 120);
setSetting('pagesPeriod', 'month');
setSetting('pagesGoal', 2000);
recordPages(1250);
updateGoals();
ok('goals card shows compact pages', [...document.querySelectorAll('#goals-card .goals-row')].some(r => r.lastChild.textContent === '1.2k/2k'));
ok('goals card rows fit', [...document.querySelectorAll('#goals-card .goals-row')].every(r => r.scrollWidth <= r.clientWidth), [...document.querySelectorAll('#goals-card .goals-row')].map(r => r.scrollWidth + '/' + r.clientWidth).join());
ok('tooltip keeps exact numbers', q('#goals-card').title.includes('1250 of 2000 pages'));

// ---- debug buttons
setSetting('debug', true);
toggleDebugPanel();
const debugBtn = label => [...document.querySelectorAll('#debug-body button')].find(b => b.textContent === label);
q('#export-btn').classList.remove('backup-glow');
debugBtn('Glow export').click();
ok('debug: glow export', q('#export-btn').classList.contains('backup-glow'));
debugBtn('Backup reminder').click();
ok('debug: backup reminder', q('#backup-reminder').classList.contains('visible'));
hideBackupReminder();
library.push({ id: 'fk1', title: 'A Story', authors: ['A'], genre: 'Fantasy', status: 'Read', color: '#345', width: 100, sortOrder: 70 });
library.push({ id: 'fk2', title: 'A Fact', authors: ['A'], genre: 'History', status: 'Read', color: '#543', width: 100, sortOrder: 71 });
const shownIds = () => [...document.querySelectorAll('#library-room .book')].map(el => el.dataset.id);
q('[data-filter-kind="Fiction"]').click();
ok('filter: fiction only', shownIds().includes('fk1') && !shownIds().includes('fk2'));
ok('fiction filter counts on the badge', q('#filters-count').textContent.includes('1'));
q('[data-filter-kind="Non-Fiction"]').click();
ok('filter: non-fiction only', shownIds().includes('fk2') && !shownIds().includes('fk1'));
q('[data-filter-kind="All"]').click();
ok('filter: both', shownIds().includes('fk1') && shownIds().includes('fk2'));
library = library.filter(b => !b.id.startsWith('fk'));
renderBookshelf();
setSetting('debug', false);

// ---- how I got it: saved with the book, written at the bottom of the card
openModal('2');
const gotLabel = q('#book-got-from-label');
ok('how I got it starts blank, no who/where box', q('#book-got-how').value === '' && gotLabel.style.visibility === 'hidden');
q('#book-got-how').value = 'borrowed';
updateGotFromField();
ok('Borrowed asks who from, offering friends', gotLabel.style.visibility === '' && q('#book-got-from-title').textContent === 'Who from' && q('#book-got-from').getAttribute('list') === 'friend-options');
q('#book-got-from').value = 'Priya';
await processBookForm();
await wait(300);
ok('saved with the book', library.find(b => b.id === '2').gotHow === 'borrowed' && library.find(b => b.id === '2').gotFrom === 'Priya');
populateFriendOptions();
ok('who you borrowed from joins the friend names', [...q('#friend-options').options].some(o => o.value === 'Priya'));
openModal('2');
ok('opens with it filled in', q('#book-got-how').value === 'borrowed' && q('#book-got-from').value === 'Priya');
openLibraryCard();
await wait(1900);
ok('the card says so at the bottom', q('#library-card .lc-foot .lc-got').textContent === 'Borrowed from Priya');
closeLibraryCard();
await wait(600);
q('#book-got-how').value = 'thrift';
updateGotFromField();
ok('Thrifted asks where, no friend names', q('#book-got-from-title').textContent === 'Where' && !q('#book-got-from').hasAttribute('list'));
ok('card lines', gotLine('thrift', 'Goodwill') === 'Thrifted at Goodwill' && gotLine('library', 'Main Street Library') === 'From Main Street Library'
    && gotLine('library', '') === 'From the library' && gotLine('gift', 'Mom') === 'A gift from Mom' && gotLine('', 'x') === '');
q('#book-got-how').value = '';
await processBookForm();
await wait(300);
ok('clearing it clears who/where too', library.find(b => b.id === '2').gotHow === '' && library.find(b => b.id === '2').gotFrom === '');

// ---- the year boxes can't be nudged to 1000 (an empty number box's
// up arrow or a scroll jumped to its minimum)
openModal('1');
setDateField('finished', '');
const yearBox = q('#finished-year');
ok('year box has no spinner to nudge', yearBox.type === 'text' && yearBox.inputMode === 'numeric');
yearBox.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
ok('up arrow leaves an empty year empty', yearBox.value === '');
yearBox.value = '2o25';
yearBox.dispatchEvent(new Event('input'));
ok('only digits stay in the year', yearBox.value === '225');
yearBox.value = '2025';
yearBox.dispatchEvent(new Event('input'));
ok('a typed year still reads', readDateField('finished', 'finished').value === '2025');
closeModal();
await wait(350);
