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
