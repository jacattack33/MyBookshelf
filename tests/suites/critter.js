// @size 1100x850
// The reading critter: hatching, feeding, growing, hunger,
// running away, the scrapbook, theme critters, the switch and backups.
const DAY = 864e5;
const fresh = () => { critter = newCritterEgg(); saveCritter(); renderCritter(); };
fresh();

// ---- egg and widget
ok('widget shows', getComputedStyle(q('#critter-home')).display !== 'none' && !!q('#critter-home .cr.stage-egg'));
openCritter();
ok('window opens', q('#critter-modal').style.display === 'flex');
ok('egg has no fullness meter yet', q('#critter-care').style.display === 'none');

// ---- feeding hatches it
q('#critter-pages').value = '';
submitCritterFeed();
ok('empty feed rejected', critter.totalFed === 0);
addCritterPages(10);
addCritterPages(25);
ok('chips add up', q('#critter-pages').value === '35');
submitCritterFeed();
ok('first meal hatches it', critter.bornAt && critter.totalFed === 35 && critterStage().id === 'baby');
ok('newborn gets at least a day of food', critter.food >= critterGoal());
ok('meal logged', critter.log.length === 1 && critter.log[0].pages === 35);
ok('unnamed goes by the theme name', critterName() === 'Gummy');
const nameBox = q('#critter-name');
nameBox.focus();
ok('clicking the name puts the real name in, selected', nameBox.value === 'Gummy' && nameBox.selectionEnd - nameBox.selectionStart === 5);
nameBox.blur();
ok('left alone it stays unnamed', critter.name === '' && nameBox.value === '');
nameBox.focus();
nameBox.value = 'Nibs';
nameBox.dispatchEvent(new Event('input'));
nameBox.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
ok('typing renames it, Enter finishes', critter.name === 'Nibs' && document.activeElement !== nameBox);
critter.name = '';
renderCritter();

// ---- no genres: meals are just pages
feedCritter(5);
ok('meal logs pages only', critter.log[0].pages === 5 && !('genre' in critter.log[0]));
ok('no favorite-genre tile', !q('#critter-tiles').textContent.includes('Loves'));

// ---- growing up
feedCritter(200);
ok('grows into a kid at 150', critterStage().id === 'kid' && !!q('#critter-home .cr.stage-kid'));
feedCritter(1400);
ok('adult at 1500', critterStage().id === 'adult');
ok('belly capped at 3 days', critter.food === critterGoal() * 3);

// ---- hunger
const goal = critterGoal();
critter.food = goal * 1.5;
critter.updatedAt = Date.now() - DAY;
settleCritter();
ok('drains a day of pages a day', Math.abs(critter.food - goal * 0.5) < 0.01, critter.food);
renderCritter();
ok('hungry shows a bubble', critterMood() === 'hungry' && q('#critter-alert').textContent === '!');
critter.updatedAt = Date.now() - DAY;
settleCritter();
ok('starving when empty', critter.food === 0 && critterMood() === 'starving' && critter.emptySince > 0);

// ---- night owls
const realHours = Date.prototype.getHours;
const emptiedAt = critter.emptySince;
Date.prototype.getHours = () => 2;
critter.food = goal * 1.5;
critter.awakeUntil = 0;
ok('asleep at 2am', critterMood() === 'asleep');
petCritter();
ok('one poke lets it sleep', critterMood() === 'asleep');
petCritter();
ok('second poke wakes it', critterMood() === 'content');
critter.awakeUntil = 0;
feedCritter(5);
ok('a late feed keeps it up', critterMood() === 'content' && critter.awakeUntil > Date.now() + 60 * 60 * 1000);
Date.prototype.getHours = realHours;
critter.awakeUntil = 0;
critter.food = 0;
critter.emptySince = emptiedAt;

// ---- switched off: no hunger
setSetting('critter', false);
ok('switch hides widget', q('#critter-home').style.display === 'none');
const emptyBefore = critter.emptySince;
critter.updatedAt -= 10 * DAY;
settleCritter();
ok('no running away while off', !critter.gone && critter.emptySince > emptyBefore);
setSetting('critter', true);
ok('switch shows widget again', q('#critter-home').style.display === '');

// ---- running away
critter.name = 'Nibbles';
critter.emptySince = Date.now() - 8 * DAY;
critter.updatedAt = Date.now() - 1000;
settleCritter();
renderCritter();
ok('runs away after a week starving', !!critter.gone && critter.gone.note.includes('Nibbles'));
ok('empty home with a note', !q('#critter-home .cr-critter') && q('#critter-gone-note').style.display === '' && q('#critter-hatch').style.display === '');
feedCritter(10);
ok('can’t feed an empty home', critter.totalFed > 0 && critter.log[0].pages !== 10);
ok('scrapbook entry', critter.past.length === 1 && critter.past[0].name === 'Nibbles' && critter.past[0].stage === 'adult');
hatchNewEgg();
ok('new egg keeps the scrapbook', !critter.bornAt && !critter.gone && critter.past.length === 1);
q('.critter-content').style.maxHeight = '300px';
ok('buttons not squashed in a short window', q('#critter-scrap-toggle').getBoundingClientRect().height > 20);
q('.critter-content').style.maxHeight = '';
toggleCritterScrapbook();
ok('scrapbook lists past critters', q('#critter-scrapbook').classList.contains('visible') && q('#critter-scrapbook').textContent.includes('Nibbles'));

// ---- theme critters and backups
setTheme('library');
ok('theme swaps the critter', !!q('#critter-home .cr') && q('#critter-sub').textContent.includes('bookworm'));
setTheme('plain');
ok('plain themes have their own cat', q('#critter-sub').textContent.includes('cat') && (setTheme('plainbold'), q('#critter-sub').textContent.includes('cat')));
setTheme('candy');
ok('critter travels with backups', JSON.parse(collectSettingsForBackup().bookShelfCritter).past.length === 1);
closeCritter();
ok('window closes', q('#critter-modal').style.display === 'none');
fresh();

// corner stack on desktop: sticky pile, ledger on it, goals card, critter on top
const pileTop = Math.min(...[...document.querySelectorAll('.sticky-sheet')].map(s => s.getBoundingClientRect().top));
const ledgerBox = q('#stats-ledger').getBoundingClientRect(), goalsBox = q('#goals-card').getBoundingClientRect();
ok('ledger clear of the sticky pile', ledgerBox.bottom + 3 <= pileTop, `${ledgerBox.bottom} / ${pileTop}`);
ok('goals card clear of the ledger', goalsBox.bottom <= ledgerBox.top, `${goalsBox.bottom} / ${ledgerBox.top}`);
ok('critter on top of the goals card', q('#critter-home').getBoundingClientRect().bottom <= goalsBox.top, `${q('#critter-home').getBoundingClientRect().bottom} / ${goalsBox.top}`);
setTheme('terminal');
ok('terminal: critter on top of the goals card', q('#critter-home').getBoundingClientRect().bottom <= q('#goals-card').getBoundingClientRect().top);
ok('terminal: goals card clear of the ledger', q('#goals-card').getBoundingClientRect().bottom <= q('#stats-ledger').getBoundingClientRect().top);
setTheme('candy');

// ---- goals
ok('settings no longer has the goals', !q('#setting-goal') && !q('#setting-pages-goal'));
ok('goals card shows pages only with no books goal', q('#goals-card').textContent.startsWith('Today') && !q('#goals-card').textContent.includes('Books'));
openGoals();
ok('goals window opens', q('#goals-modal').style.display === 'flex');
q('#goal-books').value = '12';
q('#goal-books').dispatchEvent(new Event('input'));
ok('books goal set from the goals window', appSettings.goal === 12 && q('#goals-card').textContent.includes('Books'));
const logged = pagesReadThisPeriod();
feedCritter(30);
ok('feeding counts toward the pages goal', pagesReadThisPeriod() === logged + 30);
q('#goal-log-pages').value = '15';
submitLoggedPages();
ok('logging pages feeds the critter too', pagesReadThisPeriod() === logged + 45 && critter.log[0].pages === 15);
setSetting('pagesGoal', 70);
setSetting('pagesPeriod', 'week');
ok('weekly goal: critter eats a seventh a day', Math.abs(critterGoal() - 10) < 1e-9 && q('#goals-card').textContent.includes('Week'));
ok('weekly goal shown in the critter window', (openCritter(), q('#critter-meter-text').textContent.includes('70 pages a week')));
closeCritter();
setSetting('pagesPeriod', 'month');
ok('month period starts on the 1st', new Date(pagesPeriodStart()).getDate() === 1);
setSetting('critter', false);
q('#goal-log-pages').value = '5';
const fedBefore = critter.totalFed;
submitLoggedPages();
ok('logging with the critter off still counts', pagesReadThisPeriod() === logged + 50 && critter.totalFed === fedBefore);
ok('goals card stays on the ledger with the critter off', Math.abs(q('#goals-card').getBoundingClientRect().bottom - goalsBox.bottom) < 1);
setSetting('critter', true);
ok('pages log travels with backups', JSON.parse(collectSettingsForBackup().bookShelfPagesLog).length >= 3);
closeGoals();
setSetting('pagesGoal', 20);
setSetting('pagesPeriod', 'day');
setSetting('goal', 0);

// ---- age counts calendar days, not 24-hour stretches
const lateLastNight = new Date(); lateLastNight.setHours(0, 0, 0, 0); lateLastNight.setMinutes(-60); // 11pm yesterday
ok('hatched 11pm yesterday reads "born yesterday"', critterAge({ bornAt: lateLastNight.getTime() }) === 'born yesterday', critterAge({ bornAt: lateLastNight.getTime() }));
ok('hatched just now reads "born today"', critterAge({ bornAt: Date.now() }) === 'born today');
const threeDays = new Date(); threeDays.setDate(threeDays.getDate() - 3);
ok('three calendar days back reads "3 days old"', critterAge({ bornAt: threeDays.getTime() }) === '3 days old', critterAge({ bornAt: threeDays.getTime() }));
