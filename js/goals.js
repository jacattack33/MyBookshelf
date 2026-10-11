// ---------- Reading goals ----------
// A card under the critter with the yearly books goal and a pages goal
// per day, week or month. Pages come from a log of pages read, filled
// by feeding the critter or by the Log box in the goals window. The
// critter eats at the pages goal's pace.

const PAGES_LOG_KEY = 'bookShelfPagesLog';
const PAGES_LOG_DAYS = 40;   // enough for this month
const PAGES_PERIODS = {
    day: { days: 1, label: 'today', unit: 'a day', short: 'Today' },
    week: { days: 7, label: 'this week', unit: 'a week', short: 'Week' },
    month: { days: 30, label: 'this month', unit: 'a month', short: 'Month' }
};

const pagesPeriod = () => PAGES_PERIODS[appSettings.pagesPeriod] ? appSettings.pagesPeriod : 'day';
const pagesGoalAmount = () => Math.max(1, parseInt(appSettings.pagesGoal) || DEFAULT_SETTINGS.pagesGoal);
const pagesGoalText = () => `${pagesGoalAmount().toLocaleString()} pages ${PAGES_PERIODS[pagesPeriod()].unit}`;

function loadPagesLog() {
    try {
        const log = JSON.parse(localStorage.getItem(PAGES_LOG_KEY));
        if (Array.isArray(log)) return log;
    } catch (e) {}
    return [];
}

function recordPages(pages) {
    const cutoff = Date.now() - PAGES_LOG_DAYS * DAY_MS;
    const log = loadPagesLog().filter(e => e.at >= cutoff);
    log.push({ at: Date.now(), pages });
    try { localStorage.setItem(PAGES_LOG_KEY, JSON.stringify(log)); } catch (e) {}
    updateGoals();
}

// when the current day / week (from Monday) / month began
function pagesPeriodStart(period = pagesPeriod()) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (period === 'week') d.setDate(d.getDate() - (d.getDay() + 6) % 7);
    if (period === 'month') d.setDate(1);
    return d.getTime();
}

function pagesReadThisPeriod() {
    const start = pagesPeriodStart();
    return loadPagesLog().reduce((sum, e) => sum + (e.at >= start ? e.pages : 0), 0);
}

function booksReadThisYear() {
    const year = String(new Date().getFullYear());
    return visibleBooks().filter(b => b.status === 'Read' && (b.finishedDate || '').startsWith(year)).length;
}

function goalRow(label, done, goal) {
    const row = document.createElement('div');
    row.className = 'goals-row';
    const l = document.createElement('span');
    l.textContent = label;
    const n = document.createElement('span');
    n.textContent = `${done}/${goal}`;
    row.append(l, n);
    return [row, goalBar(done, goal)];
}

function goalBar(done, goal) {
    const bar = document.createElement('div');
    bar.className = 'reading-goal-bar';
    const fill = document.createElement('div');
    fill.className = 'reading-goal-fill' + (done >= goal ? ' done' : '');
    fill.style.width = Math.min(100, done / goal * 100) + '%';
    bar.appendChild(fill);
    return bar;
}

function updateGoals() {
    const card = document.getElementById('goals-card');
    if (!card) return;
    const books = appSettings.goal;
    const booksDone = booksReadThisYear();
    const pages = pagesGoalAmount();
    const pagesDone = pagesReadThisPeriod();
    const period = PAGES_PERIODS[pagesPeriod()];

    card.innerHTML = '';
    if (books) card.append(...goalRow('Books', booksDone, books));
    card.append(...goalRow(period.short, pagesDone, pages));
    const title = (books ? `${booksDone} of ${books} books this year · ` : '') +
        `${pagesDone} of ${pages} pages ${period.label}`;
    card.title = `Reading goals: ${title}`;
    card.setAttribute('aria-label', card.title);

    if (document.getElementById('goals-modal').style.display !== 'flex') return;
    const booksBox = document.getElementById('goal-books-progress');
    booksBox.innerHTML = '';
    if (books) {
        const text = document.createElement('div');
        text.textContent = `${booksDone} / ${books} books${booksDone >= books ? ' — you did it! ✦' : ''}`;
        booksBox.append(text, goalBar(booksDone, books));
    }
    const pagesBox = document.getElementById('goal-pages-progress');
    pagesBox.innerHTML = '';
    const text = document.createElement('div');
    text.textContent = `${pagesDone.toLocaleString()} / ${pages.toLocaleString()} pages ${period.label}${pagesDone >= pages ? ' — goal met! ✦' : ''}`;
    pagesBox.append(text, goalBar(pagesDone, pages));
    const perDay = critterGoal();
    document.getElementById('goal-pages-hint').textContent = appSettings.critter
        ? `Your reading critter gets hungry at this pace (${perDay % 1 ? perDay.toFixed(1) : perDay} pages a day).`
        : 'Log pages here, or by feeding your reading critter.';
}

function submitLoggedPages() {
    const input = document.getElementById('goal-log-pages');
    const note = document.getElementById('goal-log-note');
    const pages = Math.min(2000, parseInt(input.value) || 0);
    if (pages < 1) {
        note.textContent = 'How many pages did you read?';
        return;
    }
    input.value = '';
    // the critter eats them too, if it's around to
    if (appSettings.critter && critter && !critter.gone) {
        feedCritter(pages);
        note.textContent = `Logged ${pages} page${pages === 1 ? '' : 's'}, and fed them to ${critterName()}.`;
    } else {
        recordPages(pages);
        note.textContent = `Logged ${pages} page${pages === 1 ? '' : 's'}.`;
    }
}

function openGoals() {
    document.getElementById('goal-books').value = appSettings.goal || '';
    document.getElementById('goal-pages').value = appSettings.pagesGoal === DEFAULT_SETTINGS.pagesGoal ? '' : appSettings.pagesGoal;
    document.getElementById('goal-log-pages').value = '';
    document.getElementById('goal-log-note').textContent = '';
    refreshSettingsButtons();
    document.getElementById('goals-modal').style.display = 'flex';
    updateGoals();
}

function closeGoals() {
    document.getElementById('goals-modal').style.display = 'none';
}
