// Clearing out the example shelf a copy of the app starts with (for
// friends starting their own shelf from it): its books and the pins they
// earned go, books added since stay.

// the test server leaves out starter-library.json, so the 3 built-in books
// loaded, and nothing pops up for them
ok('no welcome popup for the 3 built-in books', q('#fresh-start-modal').style.display !== 'flex');
ok('the built-in books are remembered as the example shelf', starterBooksLeft().length === 3);
ok('...and earned a pin', !!pinState.earned.first);

openSettings();
ok('Settings offers to remove the example shelf', !q('#starter-remove').hidden && q('#starter-remove').offsetParent);
closeSettings();

// as if the example shelf had loaded
offerFreshStart();
ok('welcome popup offers a fresh start', q('#fresh-start-modal').style.display === 'flex');
closeFreshStart();
ok('"Keep them for now" just closes it', q('#fresh-start-modal').style.display === 'none' && library.length === 3);

const mine = { id: 'mine1', title: 'My Own Book', authors: ['Me'], genre: 'Fantasy', status: 'Want to Read', color: '#345', width: 100, sortOrder: 9 };
await dbPut(mine);
library.push(mine);
renderBookshelf();

offerFreshStart();
q('#fresh-start-modal .danger').click();
await wait(300);
ok('popup closes', q('#fresh-start-modal').style.display === 'none');
ok('example books are gone, mine stays', library.length === 1 && library[0].id === 'mine1');
const stored = await dbGetAll();
ok('...in the database too', stored.length === 1 && stored[0].id === 'mine1');
ok('...and on the shelf', !document.querySelector('.book[data-id="1"]') && document.querySelector('[data-id="mine1"]'));
ok('pins earned by them are gone', !pinState.earned.first && Object.keys(JSON.parse(localStorage.getItem(PINS_KEY)).earned).length === 0);
ok('an empty shelf won\'t refill with example books', localStorage.getItem(STARTED_FRESH_KEY) === '1');

openSettings();
ok('the Settings button goes away', q('#starter-remove').hidden);
closeSettings();
offerFreshStart();
ok('nothing left to offer', q('#fresh-start-modal').style.display !== 'flex');

// the debug panel can show the popup, but only as a preview
const pinsBefore = JSON.stringify(pinState.earned);
setSetting('debug', true);
toggleDebugPanel();
[...document.querySelectorAll('#debug-body button')].find(b => b.textContent === 'Welcome popup').click();
ok('debug: welcome popup shows', q('#fresh-start-modal').style.display === 'flex');
q('#fresh-start-modal .danger').click();
await wait(300);
ok('...and its button removes nothing', q('#fresh-start-modal').style.display === 'none' && library.length === 1 && JSON.stringify(pinState.earned) === pinsBefore);
toggleDebugPanel();
setSetting('debug', false);

// ---- All books: every book in a list, to tick and delete. The example
// shelf's books are found by starter-library.json's ids, as after a backup
// brought them back (this browser no longer remembers them).
const exA = { id: 'ex1', title: 'zebra Example', authors: ['Ex Author'], genre: 'Fantasy', status: 'Read', color: '#345', width: 100, sortOrder: 20 };
const exB = { id: 'ex2', title: 'Another Example', authors: ['Ex Author'], genre: 'Fantasy', status: 'Want to Read', color: '#543', width: 100, sortOrder: 21 };
const mine2 = { id: 'mine2', title: 'Mine Too', authors: ['Me'], genre: 'Fantasy', status: 'Want to Read', color: '#454', width: 100, sortOrder: 22 };
for (const b of [exA, exB, mine2]) { await dbPut(b); library.push(b); }
localStorage.removeItem(STARTER_IDS_KEY);
starterFileIds = Promise.resolve(['ex1', 'ex2', 'not-on-this-shelf']);
checkPins();
renderBookshelf();
ok('(an example book earned a pin)', !!pinState.earned.first);

openSettings();
[...document.querySelectorAll('#settings-modal button')].find(b => b.textContent.startsWith('All books')).click();
await wait(100);
const rowTitles = () => [...document.querySelectorAll('#all-books-list .all-books-title')].map(t => t.textContent);
ok('All books lists every book, A to Z', rowTitles().join('|') === 'Another Example|Mine Too|My Own Book|zebra Example', rowTitles().join('|'));
ok('nothing ticked yet, so Delete waits', q('#all-books-delete').disabled && q('#all-books-count').textContent === '4 books · 0 ticked');
ok('it offers to tick the example shelf books, found by the file', !q('#all-books-example').hidden && q('#all-books-example').textContent.includes('(2)'));

q('#all-books-search').value = 'mine';
q('#all-books-search').dispatchEvent(new Event('input'));
ok('search narrows the list', rowTitles().join('|') === 'Mine Too', rowTitles().join('|'));
tickAllBooks(true);
ok('Tick all ticks only what the search shows', allBooksTicked.size === 1 && allBooksTicked.has('mine2'));
tickAllBooks(false);
ok('Untick all', allBooksTicked.size === 0);

await tickExampleBooks();
ok('Tick example shelf books ticks just those, and clears the search', allBooksTicked.size === 2 && allBooksTicked.has('ex1') && allBooksTicked.has('ex2') &&
    q('#all-books-search').value === '' && rowTitles().length === 4);
ok('...with their pins set to go too', q('#all-books-pins').checked);
ok('the Delete button says how many', !q('#all-books-delete').disabled && q('#all-books-delete').textContent.startsWith('Delete 2 books'));
q('#all-books-delete').click();
ok('Delete asks first', q('#all-books-ask').hidden && !q('#all-books-confirm').hidden && q('#all-books-confirm-text').textContent.startsWith('Delete 2 books'));
document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
ok('Escape backs out of asking, leaving the window open', !q('#all-books-ask').hidden && q('#all-books-modal').style.display === 'flex' && library.length === 4);
q('#all-books-delete').click();
q('#all-books-confirm-btn').click();
await wait(300);
ok('the ticked books are gone, the rest stay', library.map(b => b.id).sort().join() === 'mine1,mine2');
ok('...from the database too', (await dbGetAll()).map(b => b.id).sort().join() === 'mine1,mine2');
ok('...and the shelf', !document.querySelector('.book[data-id="ex1"]') && !!document.querySelector('.book[data-id="mine2"]'));
ok('the pin only they earned came off, and it says so', !pinState.earned.first && q('#all-books-done').textContent.includes('First Chapter'), q('#all-books-done').textContent);
ok('the list is up to date, with no example books left to tick', rowTitles().join('|') === 'Mine Too|My Own Book' && q('#all-books-example').hidden);
document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
ok('Escape closes it', q('#all-books-modal').style.display !== 'flex');
closeSettings();
ok('backups carry which books came with the example shelf', SETTINGS_BACKUP_KEYS.includes(STARTER_IDS_KEY));
