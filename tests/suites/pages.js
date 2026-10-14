// Taking back pages logged by mistake: the x on the Goals window's Recent
// pages and the critter's Recent meals. They come off the goals and the
// critter, and pins they earned go too, unless still earned without them.
const realConfirm = window.confirm;
const answer = yes => { window.confirm = () => yes; };
const DAY = 864e5;
const logged = () => loadPagesLog();
const meals = () => critter.log;

// ---- a big feed by mistake grows the critter up: take it back
critter = newCritterEgg(); saveCritter();
feedCritter(100);
feedCritter(1500);
ok('the feed earned All Grown Up', !!pinState.earned.grownup && critterStage().id === 'adult');
const big = logged().find(e => e.pages === 1500);
ok('log entry and meal share an id, and the entry knows its pin', big && big.id && meals()[0].id === big.id && big.pins.includes('grownup'), JSON.stringify(big));

openCritter();
const mealX = () => [...document.querySelectorAll('#critter-meal-list .pages-x')];
ok('each meal has an x', mealX().length === 2);
answer(false);
mealX()[0].click();
ok('cancel keeps it', logged().length === 2 && meals().length === 2 && critter.totalFed === 1600);
answer(true);
mealX()[0].click();
ok('OK takes it off the goals', logged().length === 1 && logged()[0].pages === 100);
ok('...and out of the critter', meals().length === 1 && critter.totalFed === 100 && critter.food <= 100 && critterStage().id !== 'adult');
ok('...and takes back All Grown Up', !pinState.earned.grownup && !JSON.parse(localStorage.getItem(PINS_KEY)).earned.grownup);
ok('the critter says so', q('#critter-say').textContent.includes('All Grown Up'));
closeCritter();

// ---- a 7-day streak finished by mistake: take it back from the Goals window
const now = Date.now();
savePagesLog([1, 2, 3, 4, 5, 6].map(d => ({ id: 'old' + d, at: now - d * DAY, pages: 10 })));
setSetting('critter', false);
openGoals();
q('#goal-log-pages').value = '12';
submitLoggedPages();
ok('logging today finishes On a Roll', !!pinState.earned.streak);
const recentX = () => [...document.querySelectorAll('#goal-recent-list .pages-x')];
ok('Recent pages lists them, newest first, with an x', !q('#goal-recent').hidden && recentX().length === 7 && q('#goal-recent-list li').textContent.startsWith('12 pages'));
recentX()[0].click();
ok('removing it takes back On a Roll', !logged().some(e => e.pages === 12) && !pinState.earned.streak && q('#goal-log-note').textContent.includes('On a Roll'));

// ---- a pin still earned without the pages stays
q('#goal-log-pages').value = '5';
submitLoggedPages();
q('#goal-log-pages').value = '7';
submitLoggedPages();
ok('On a Roll again', !!pinState.earned.streak && logged().find(e => e.pages === 5).pins.includes('streak'));
recentX().find(b => b.getAttribute('aria-label').startsWith('Remove 5 ')).click();
ok('removing the entry that earned it keeps it, since today still has pages', !!pinState.earned.streak && !logged().some(e => e.pages === 5) && q('#goal-log-note').textContent === 'Removed.');
closeGoals();
setSetting('critter', true);

// ---- older entries, from before ids, still match up
critter = newCritterEgg(); saveCritter();
feedCritter(40);
const t = Date.now();
critter.log.unshift({ at: t, pages: 33 }); critter.totalFed += 33; saveCritter();
savePagesLog([...logged(), { at: t - 1000, pages: 33 }]);
openCritter();
mealX()[0].click();
ok('an old meal and its log entry go together', !meals().some(m => m.pages === 33) && !logged().some(e => e.pages === 33) && critter.totalFed === 40);
closeCritter();
window.confirm = realConfirm;
