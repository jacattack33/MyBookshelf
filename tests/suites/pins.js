// @size 1200x900
// The pin board (achievements) and the Slips window: lent out, recs
// from friends, and books to buy.
const DAY = 864e5;
const slots = () => [...document.querySelectorAll('#pins-board .pin-slot')];

// ---- the widget: Candy, Sea Glass, Loft, Blueprint and Sunset for now
setTheme('candy');
ok('pin board shows in Candy', getComputedStyle(q('#pin-home')).display !== 'none');
setTheme('blueprint');
ok('...and in Blueprint, a corkboard in a cobalt frame', getComputedStyle(q('#pin-home')).display !== 'none' && getComputedStyle(q('[data-setting-switch="pins"]')).display !== 'none' && getComputedStyle(document.documentElement).getPropertyValue('--pin-frame').trim() === '#2f5fa8' && getComputedStyle(q('#pin-home-board')).backgroundImage.includes('feTurbulence'));
setTheme('sunset');
ok('...and in Sunset, cork in a sunset-gradient frame', getComputedStyle(q('#pin-home')).display !== 'none' && getComputedStyle(q('[data-setting-switch="pins"]')).display !== 'none' && getComputedStyle(q('#pins-board'), '::after').backgroundImage.includes('linear-gradient') && getComputedStyle(q('#pin-home-board')).backgroundImage.includes('feTurbulence'));
setTheme('seaglass');
ok('...and in Sea Glass, in a frosted sea-glass frame', getComputedStyle(q('#pin-home')).display !== 'none' && getComputedStyle(q('[data-setting-switch="pins"]')).display !== 'none' && getComputedStyle(document.documentElement).getPropertyValue('--pin-frame').trim() === '#9fd3c7');
setTheme('loft');
ok('...and in Loft, a steel frame with rivets', getComputedStyle(q('#pin-home')).display !== 'none' && getComputedStyle(q('[data-setting-switch="pins"]')).display !== 'none' && getComputedStyle(document.documentElement).getPropertyValue('--pin-frame').trim() === '#3a3e44' && getComputedStyle(q('#pins-board'), '::after').backgroundImage.includes('radial-gradient'));
setTheme('library');
ok('...and not in other themes', getComputedStyle(q('#pin-home')).display === 'none' && getComputedStyle(q('[data-setting-switch="pins"]')).display === 'none');
setTheme('candy');
const rect = sel => q(sel).getBoundingClientRect();
const critterBottom = () => rect('#critter-home').bottom;
const withBoard = critterBottom();
ok('board hangs under the critter, above the goals card',
    rect('#pin-home').top >= rect('#critter-home').bottom - 4 && rect('#pin-home').bottom <= rect('#goals-card').top + 4,
    `${rect('#critter-home').bottom} / ${rect('#pin-home').top}-${rect('#pin-home').bottom} / ${rect('#goals-card').top}`);
setSetting('pins', false);
ok('Settings can switch it off', getComputedStyle(q('#pin-home')).display === 'none');
ok('...and the critter moves down into its spot', critterBottom() > withBoard, `${critterBottom()} vs ${withBoard}`);
setSetting('pins', true);
ok('back on', getComputedStyle(q('#pin-home')).display !== 'none' && critterBottom() === withBoard);
ok('its switch only shows in Candy', getComputedStyle(q('[data-setting-switch="pins"]')).display !== 'none');
ok('gold and silver only', PINS.every(p => ['gold', 'silver'].includes(p.metal)) && !('rose' in PIN_METALS));

// ---- the 3 starter books: two are Read
ok('reading earns pins at start', !!pinState.earned.first && !pinState.earned.bookworm);
ok('pins are saved', JSON.parse(localStorage.getItem(PINS_KEY)).earned.first > 0);
ok('pins go in backups', SETTINGS_BACKUP_KEYS.includes(PINS_KEY));
ok('new pin badge on the widget', q('#pin-new').classList.contains('visible') && q('#pin-new').textContent === `+${unseenPins().length}`);
ok('widget shows the pin', q('#pin-home-board .pin-home-pin .pin-art'));
setSetting('pinAlerts', false);
ok('new-pin alerts off hides the badge', !q('#pin-new').classList.contains('visible') && unseenPins().length > 0);
setSetting('pinAlerts', true);
ok('...and back on shows it again', q('#pin-new').classList.contains('visible'));

// ---- the window
const unseenPinsAtOpen = unseenPins().length;
const landingIds = unseenPins().map(p => p.id);
openPins();
ok('new pins wait as shadows in their spots till they land', landingIds.length > 0 && landingIds.every(id => !!q(`#pins-board .pin-slot[data-pin="${id}"] .pin-art.under .pin-ghost`)));
const firstLanding = q(`#pins-board .pin-slot[data-pin="${landingIds[0]}"]`);
setTimeout(() => { window.__landedShadowGone = !firstLanding.querySelector('.pin-art.under'); }, PIN_STICK_WAIT + 900);
await wait(450); // (the board's pop-up bounce)
ok('board has every pin', slots().length === PINS.length);
ok('earned pins are metal, the rest outlines', slots().filter(s => s.classList.contains('earned')).length === earnedPins().length && !!q('#pins-board .pin-slot.locked .pin-ghost'));
ok('no count line, no window round it', !q('#pins-count') && !q('#pins-modal .modal-content') && !!q('#pins-modal .pins-pop #pins-board'));
const centres = slots().map(s => { const r = s.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; });
ok('pins are scattered, not in rows', new Set(centres.map(c => Math.round(c.y / 8))).size > 10 && new Set(centres.map(c => Math.round(c.x / 8))).size > 10);
const closest = Math.min(...centres.flatMap((a, i) => centres.slice(i + 1).map(b => Math.hypot(a.x - b.x, a.y - b.y))));
ok('...never overlapping', closest >= centres[0].w, closest + ' / ' + centres[0].w);
const nearest = centres.map((a, i) => Math.min(...centres.filter((_, j) => j !== i).map(b => Math.hypot(a.x - b.x, a.y - b.y))));
ok('...and evenly spaced', Math.max(...nearest) / Math.min(...nearest) < 1.35, nearest.map(Math.round).join());
const brd = q('#pins-board').getBoundingClientRect();
ok('...all on the board', slots().every(s => { const r = s.getBoundingClientRect(); return r.left >= brd.left && r.right <= brd.right && r.top >= brd.top && r.bottom <= brd.bottom; }));
const spotsBefore = slots().map(s => s.style.left + s.style.top).join();
closePins();
openPins();
ok('the same spots every time', slots().map(s => s.style.left + s.style.top).join() === spotsBefore);
ok('opening it marks pins seen', unseenPins().length === 0 && !q('#pin-new').classList.contains('visible'));
ok('new pins wait a moment, no card yet', !q('#pin-detail').classList.contains('visible'));
await wait(1000 + unseenPinsAtOpen * 480 + 900);
ok('...and the shadow goes once its pin has landed', window.__landedShadowGone === true);
ok('the new pin is picked', q('#pin-detail').classList.contains('visible') && q('#pin-detail .pin-detail-name').textContent === 'First Chapter' && q('#pin-detail .pin-detail-when').textContent.startsWith('Pinned'));
ok('no names on the board', !q('#pins-board .pin-tag') && !q('#pins-board .pin-progress'));
// a pin near the bottom: its card is right by it, not under the board
const last = q('#pins-board .pin-slot[data-pin="collector"]');
last.click();
const near = (card, slot) => {
    const c = card.getBoundingClientRect(), s = slot.getBoundingClientRect();
    return Math.min(Math.abs(c.top - s.bottom), Math.abs(c.bottom - s.top)) < 14 && c.left < s.right && c.right > s.left;
};
const boardBox = q('#pins-board').getBoundingClientRect();
ok('card pops up by the pin', near(q('#pin-detail'), last) && q('#pin-detail .pin-detail-name').textContent === 'Collector');
ok('...inside the board', q('#pin-detail').getBoundingClientRect().bottom <= boardBox.bottom && q('#pin-detail').getBoundingClientRect().top >= boardBox.top);
const worm = q('#pins-board .pin-slot[data-pin="bookworm"]');
worm.click();
ok('picking a locked pin says how far along', near(q('#pin-detail'), worm) && q('#pin-detail .pin-detail-when').textContent === '2 of 10 so far' && !!q('#pin-detail .reading-goal-bar'));
worm.click();
ok('the same pin again puts the card away', !q('#pin-detail').classList.contains('visible'));
worm.click();
q('#pins-board').click();
ok('a click on the cork puts it away', !q('#pin-detail').classList.contains('visible'));
// a pin not earned yet: a plain shadow, and hovering it shows its card
const shadow = q('#pins-board .pin-slot.locked:not([data-pin="bookworm"])');
const ghost = shadow.querySelector('.pin-ghost');
ok('a shadow is one solid shape (no outline or details)', ghost && getComputedStyle(ghost.querySelector('path')).strokeDasharray === 'none' && getComputedStyle(ghost.querySelector('path')).fill === getComputedStyle(ghost.querySelector('path')).stroke && !shadow.querySelector('text, .pin-glint'));
shadow.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
ok('hovering a shadow shows what it is for', q('#pin-detail').classList.contains('visible') && q('#pin-detail .pin-detail-name').textContent === PINS.find(p => p.id === shadow.dataset.pin).name && near(q('#pin-detail'), shadow));
shadow.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
ok('...and it goes when the pointer leaves', !q('#pin-detail').classList.contains('visible'));
worm.click();
shadow.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
shadow.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
ok('a clicked pin keeps its card after hovering another', q('#pin-detail .pin-detail-name').textContent === 'Bookworm');
q('#pins-board').click();
ok('metal has hard bands (many stops)', q('#pins-board .pin-slot.earned linearGradient').querySelectorAll('stop').length >= 10);
ok('gradient ids are unique', new Set([...document.querySelectorAll('#pins-board linearGradient, #pin-home linearGradient')].map(g => g.id)).size === document.querySelectorAll('#pins-board linearGradient, #pin-home linearGradient').length);
closePins();

// ---- earning from the shelf
library.push({ id: 'p1', title: 'Big One', authors: ['A'], genre: 'History', status: 'Read', rating: 5, pages: 650, startedDate: '2024-03-01', finishedDate: '2024-03-02', notes: 'great', color: '#345', width: 100, sortOrder: 80 });
library.push({ id: 'p2', title: 'Nope', authors: ['B'], genre: 'Horror', status: 'DNF', color: '#543', width: 100, sortOrder: 81 });
renderBookshelf();
['fivestar', 'doorstop', 'speedy', 'dnf'].forEach(id => ok(`earned: ${id}`, !!pinState.earned[id]));
ok('widget badge counts them', q('#pin-new').textContent === '+4');
ok('not yet: piece of cake (2 days)', !pinState.earned.cake);
library.push({ id: 'p3', title: 'Quick One', authors: ['C'], genre: 'History', status: 'Read', startedDate: '2024-04-05', finishedDate: '2024-04-05', color: '#345', width: 100, sortOrder: 82 });
renderBookshelf();
ok('earned: piece of cake (started and finished the same day)', !!pinState.earned.cake);
library = library.filter(b => b.id !== 'p3');
// pins stay once earned
library = library.filter(b => !['p1', 'p2'].includes(b.id));
renderBookshelf();
ok('pins stay after the books go', !!pinState.earned.fivestar && !!pinState.earned.dnf);

// ---- the bigger shelf pins
const extraBook = (id, extra) => library.push({ id, title: 'Extra ' + id, authors: ['A'], genre: 'Fantasy', status: 'Read', color: '#345', width: 100, sortOrder: 300, ...extra });
const newer = ['sundae', 'macaron', 'oldfriend', 'slowburn', 'bigyear', 'freshstart', 'popsicle', 'fanclub', 'rainbow', 'cookiejar'];
ok('not yet: the bigger shelf pins', newer.every(id => !pinState.earned[id]));
for (let i = 0; i < 10; i++) extraBook('x5' + i, { rating: 5 });
['Trio 1', 'Trio 2', 'Trio 3'].forEach((t, i) => extraBook('xt' + i, { series: 'Trio', seriesNumber: i + 1 }));
extraBook('xr', { extraReads: [{ started: '2023-01-01', finished: '2023-01-09' }, { started: '2024-01-01', finished: '2024-01-09' }] });
extraBook('xs', { startedDate: '2024-01-01', finishedDate: '2024-05-01' });
for (let i = 0; i < 50; i++) extraBook('xy' + i, { finishedDate: `2023-0${i % 2 ? 7 : 1}-1${i % 10}` });
for (let i = 0; i < 5; i++) extraBook('xa' + i, { authors: ['Solo Writer'] });
['#d93030', '#e8892a', '#f2d23a', '#3a9e4a', '#3060d0', '#8040c0', '#e060a0'].forEach((color, i) => extraBook('xc' + i, { color }));
for (let i = 0; i < 20; i++) extraBook('xw' + i, { status: 'Want to Read' });
renderBookshelf();
newer.forEach(id => ok(`earned: ${id}`, !!pinState.earned[id], JSON.stringify(PINS.find(p => p.id === id).progress(pinStats()))));
library = library.filter(b => !b.id.startsWith('x'));
delete pinState.earned.bookone; // (the series books earned it; it's checked later)
renderBookshelf();
// a series doesn't count toward Fan Club
for (let i = 0; i < 5; i++) extraBook('xf' + i, { authors: ['Series Writer'], series: 'Saga' });
ok('fan club leaves out series books', pinStats().authorRun < 5);
library = library.filter(b => !b.id.startsWith('x'));
ok('rainbow: greys aren\'t a colour', colourFamily('#808080') === null && colourFamily('#d93030') === 'red' && colourFamily('#e060a0') === 'pink');

// streak and night owl, from the pages log
localStorage.setItem(PAGES_LOG_KEY, JSON.stringify([...Array(7)].map((_, i) => {
    const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - i);
    return { at: d.getTime(), pages: 10 };
})));
ok('streak counted', longestStreak(loadPagesLog()) === 7);
updateGoals();
ok('earned: streak', !!pinState.earned.streak);
const late = new Date(); late.setHours(2, 30, 0, 0);
recordPages(5, late.getTime());
ok('earned: night owl', !!pinState.earned.nightowl);
// nights: the small hours count as the night before
const evening = new Date(); evening.setDate(evening.getDate() - 1); evening.setHours(22, 0, 0, 0);
recordPages(5, evening.getTime());
ok('2:30am and 10pm the night before are one night', pinStats().nights === 1, pinStats().nights);
localStorage.removeItem(PAGES_LOG_KEY);

// ---- lending: getting it back earns a pin, from the edit window...
openModal('2');
setOwned(true);
q('#book-lent-to').value = 'Sam';
await processBookForm();
ok('not earned just for lending', !pinState.earned.cameback);
openModal('2');
markBookReturned();
await processBookForm();
ok('earned: it came back (edit window)', !!pinState.earned.cameback);

// ---- Slips: lent out
delete pinState.earned.cameback;
const hobbit = library.find(b => b.id === '2');
hobbit.lentTo = 'Sam';
hobbit.lentAt = Date.now() - 45 * DAY;
library.push({ id: 'l2', title: 'Short Trip', authors: ['C'], genre: 'Travel', status: 'Read', owned: true, lentTo: 'Alex', lentAt: Date.now() - 2 * DAY, color: '#345', width: 100, sortOrder: 82 });
openSlips();
const lentRows = () => [...document.querySelectorAll('#slip-lent-list .slip-row')];
ok('lent slip lists them, longest gone first', lentRows().map(r => r.querySelector('.slip-book').textContent).join() === 'The Hobbit,Short Trip');
ok('over a month: overdue stamp', !!lentRows()[0].querySelector('.slip-stamp') && !lentRows()[1].querySelector('.slip-stamp'));
ok('lent slip count', q('#slip-lent-sub').textContent === '2 books out');
lentRows()[0].querySelector('.slip-action').click();
await wait(150);
ok('back ✓ clears the loan', !library.find(b => b.id === '2').lentTo && lentRows().length === 1);
ok('...and earns the pin', !!pinState.earned.cameback);

// ---- Slips: recs from friends (their own list, not your shelf)
q('#rec-title').value = 'Piranesi';
q('#rec-author').value = 'Susanna Clarke';
addRecFromSlip();
ok('a rec needs who it is from', !loadRecs().length);
q('#rec-from').value = 'Jo';
const booksBefore = library.length;
addRecFromSlip();
ok('a rec is saved on its own list', loadRecs().length === 1 && loadRecs()[0].title === 'Piranesi' && loadRecs()[0].from === 'Jo' && loadRecs()[0].author === 'Susanna Clarke');
ok('...not on the shelf or Want to Read', library.length === booksBefore && !library.some(b => b.title === 'Piranesi'));
ok('recs go in backups', SETTINGS_BACKUP_KEYS.includes(RECS_KEY));
const recRow = () => [...document.querySelectorAll('#slip-recs-list .slip-row')].find(r => r.textContent.includes('Piranesi'));
ok('rec shows on the recs slip', recRow() && recRow().textContent.includes('from Jo'));
ok('...and not on the to-buy slip', ![...document.querySelectorAll('#slip-buy-list .slip-row')].some(r => r.textContent.includes('Piranesi')));
ok('the form box is cleared, the name kept', q('#rec-title').value === '' && q('#rec-from').value === 'Jo');
ok('friend names offered', [...q('#friend-options').options].map(o => o.value).includes('Jo'));
// crossing one off
q('#rec-title').value = 'Meh Book';
addRecFromSlip();
[...document.querySelectorAll('#slip-recs-list .slip-row')].find(r => r.textContent.includes('Meh Book')).querySelector('.slip-x').click();
ok('crossing a rec off', loadRecs().length === 1 && loadRecs()[0].title === 'Piranesi');
// putting one on the shelf: the Add Book window, filled in
recRow().querySelector('.slip-action').click();
ok('on shelf opens Add Book filled in', q('#book-modal').style.display === 'flex' && q('#book-title').value === 'Piranesi' && q('#book-author').value === 'Susanna Clarke' && q('#book-rec-by').value === 'Jo');
closeModal();
await wait(350);
ok('cancelling keeps the rec', loadRecs().length === 1);
openSlips();
recRow().querySelector('.slip-action').click();
q('#book-genre').value = 'Fantasy';
await processBookForm();
const rec = library.find(b => b.title === 'Piranesi');
ok('saved: on the shelf with who recommended it', rec && rec.recommendedBy === 'Jo' && !rec.stickyNote);
ok('...and off the recs list', loadRecs().length === 0);
openSlips();
ok('listed under On your shelf', !!q('#slip-recs-list .slip-subhead') && recRow() && !recRow().querySelector('.slip-x'));

// ---- Slips: to buy
q('#buy-title').value = 'Dune Messiah';
await addBuyFromSlip();
const messiah = library.find(b => b.title === 'Dune Messiah');
ok('to-buy adds a sticky note', messiah && isStickyPlaceholder(messiah));
ok('to-buy total', q('#slip-buy-total').textContent === 'ITEMS: 1');
const buyRowFor = title => [...document.querySelectorAll('#slip-buy-list .slip-row')].find(r => r.textContent.includes(title));
const box = buyRowFor('Dune Messiah').querySelector('input[type="checkbox"]');
ok('not yet: got it', !pinState.earned.gotit);
box.click();
await wait(150);
ok('ticking it means you own it', messiah.owned && !isStickyPlaceholder(messiah) && buyRowFor('Dune Messiah').classList.contains('bought'));
ok('earned: got it (ticked off To Buy)', !!pinState.earned.gotit);
box.click();
await wait(150);
ok('unticking puts it back', !messiah.owned && isStickyPlaceholder(messiah) && !buyRowFor('Dune Messiah').classList.contains('bought'));
// clicking a title opens the book
buyRowFor('Dune Messiah').querySelector('.slip-book').click();
ok('a title opens the book', q('#slips-modal').style.display === 'none' && q('#book-modal').style.display === 'flex' && q('#book-title').value === 'Dune Messiah');

// ---- the edit window keeps who recommended it
q('#book-rec-by').value = 'Pat';
await processBookForm();
ok('recommended by saved from the form', library.find(b => b.title === 'Dune Messiah').recommendedBy === 'Pat');
// ...or by ticking I Own This Book on it
delete pinState.earned.gotit;
delete pinState.counts.bought;
checkPins();
ok('got it: not for a to-buy book you don\'t own', !pinState.earned.gotit);
openModal(messiah.id);
setOwned(true);
await processBookForm();
ok('earned: got it (edit window)', !!pinState.earned.gotit);
openModal(rec.id);
ok('...and shown when opened', q('#book-rec-by').value === 'Jo');
closeModal();
await wait(350);

// ---- the getting-started pins
ok('earned: new look (another theme)', !!pinState.earned.newlook);
ok('earned: tinkerer (shelf settings)', !!pinState.earned.tinker);
ok('earned: lending library', !!pinState.earned.lender);
ok('earned: mine! (owned a book)', !!pinState.earned.owned);
ok('earned: word of mouth (a rec)', !!pinState.earned.recadd);
ok('not yet: good call', !pinState.earned.recread);
const piranesi = library.find(b => b.title === 'Piranesi');
piranesi.status = 'Read';
renderBookshelf();
ok('earned: good call (read a rec)', !!pinState.earned.recread);
ok('not yet: book one / hatched / safe & sound', !pinState.earned.bookone && !pinState.earned.hatched && !pinState.earned.backup);
library.push({ id: 's1', title: 'Saga One', authors: ['A'], genre: 'Fantasy', status: 'Reading', series: 'Saga', seriesNumber: 1, color: '#345', width: 100, sortOrder: 90 });
renderBookshelf();
ok('earned: book one (started a series)', !!pinState.earned.bookone);
library = library.filter(b => b.id !== 's1');
feedCritter(10);
ok('earned: hatched', !!pinState.earned.hatched);
exportLibrary();
ok('earned: safe & sound (backed up)', !!pinState.earned.backup);
// shelf pins
ok('not yet: well dressed / spines / tagger / short & sweet', !pinState.earned.dressed && !pinState.earned.spines && !pinState.earned.tagger && !pinState.earned.shortsweet);
for (let i = 0; i < 10; i++) library.push({ id: 'wd' + i, title: 'Dressed ' + i, authors: ['A'], genre: 'Fantasy', status: 'Read', pages: i ? 300 : 80, image: 'data:image/png;base64,xx', spineImage: i < 5 ? 'data:image/png;base64,xx' : '', tags: ['T' + i], color: '#345', width: 100, sortOrder: 100 + i });
renderBookshelf();
['dressed', 'spines', 'tagger', 'shortsweet'].forEach(id => ok(`earned: ${id}`, !!pinState.earned[id]));
library = library.filter(b => !b.id.startsWith('wd'));
renderBookshelf();
// counted as they happen
const stickiesBefore = pinState.counts.stickies || 0;
for (let i = 0; i < 10; i++) await addStickyBook('Note ' + i, '', 'Fantasy');
ok('sticky notes are counted', pinState.counts.stickies === stickiesBefore + 10);
ok('earned: sticky fingers', !!pinState.earned.sticky);
library = library.filter(b => !/^Note \d$/.test(b.title));
renderBookshelf();
ok('the count stays after the notes go', pinState.stats === undefined && pinStats().stickies >= 10);
for (let i = 0; i < 5; i++) {
    library.push({ id: 'mm' + i, title: 'Lendable ' + i, authors: ['A'], genre: 'Fantasy', status: 'Read', owned: true, color: '#345', width: 100, sortOrder: 120 + i });
    openModal('mm' + i);
    q('#book-lent-to').value = 'Friend ' + i;
    await processBookForm();
}
ok('earned: matchmaker (5 books lent)', !!pinState.earned.matchmaker && pinState.lentIds.length >= 5);
ok('not yet: return policy', !pinState.earned.returns);
for (let i = 0; i < 5; i++) {
    openModal('mm' + i);
    markBookReturned();
    await processBookForm();
}
ok('earned: return policy (5 back)', !!pinState.earned.returns && pinState.counts.returns >= 5);
library = library.filter(b => !b.id.startsWith('mm'));
renderBookshelf();
ok('book club remembers who you lent to, after the books come back', !!pinState.earned.bookclub && pinStats().lentPeople >= 5);
// a critter kept a month
const bornWas = critter.bornAt;
critter.bornAt = Date.now() - 31 * DAY;
checkPins();
ok('earned: loyal critter (30 days)', !!pinState.earned.loyal);
critter.bornAt = bornWas;
ok('every pin has art that draws', PINS.every(p => { const svg = pinSvg(p); return svg.includes('<path') && !svg.includes('undefined') && !svg.includes('NaN'); }));
// settled pins gleam
pinState.seen = Object.fromEntries(PINS.filter(p => p.id !== 'backup').map(p => [p.id, true]));
openPins();
const gleam = q('#pins-board .pin-slot[data-pin="backup"] .pin-gleam');
ok('a new pin gleams once it settles', !!gleam && gleam.getAnimations().length === 1 && gleam.getAnimations()[0].effect.getTiming().delay >= PIN_STICK_WAIT + 500);
closePins();

// ---- debug buttons
setSetting('debug', true);
toggleDebugPanel();
const debugBtn = label => [...document.querySelectorAll('#debug-body button')].find(b => b.textContent === label);
debugBtn('Earn all').click();
ok('debug: earn all', earnedPins().length === PINS.length);
openPins();
ok('every pin on the board earned', slots().every(s => s.classList.contains('earned')));
closePins();
debugBtn('Reset pins').click();
ok('debug: reset keeps what the shelf has earned', !!pinState.earned.first && !pinState.earned.century);
setSetting('debug', false);

library = library.filter(b => !['l2'].includes(b.id) && !['Piranesi', 'Dune Messiah'].includes(b.title));
renderBookshelf();
