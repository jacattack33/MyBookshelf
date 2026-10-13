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

// `at` is when they were read: now, or midday on an earlier day when
// they're logged after the fact
function recordPages(pages, at = Date.now()) {
    const cutoff = Date.now() - PAGES_LOG_DAYS * DAY_MS;
    const log = loadPagesLog().filter(e => e.at >= cutoff);
    log.push({ at, pages });
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
    return finishedReads().filter(r => r.date.startsWith(year)).length;
}

function goalRow(label, done, goal) {
    const row = document.createElement('div');
    row.className = 'goals-row';
    const l = document.createElement('span');
    l.textContent = label;
    const n = document.createElement('span');
    n.textContent = `${compactNumber(done)}/${compactNumber(goal)}`;
    row.append(l, n);
    return [row, goalBar(done, goal)];
}

// The corner card is tiny: 1250 -> "1.2k", 12500 -> "12k". Rounded down,
// so 1990 of 2000 never looks like the goal's met. (The tooltip and the
// Goals window show the exact numbers.)
function compactNumber(n) {
    if (n < 1000) return String(n);
    const k = n < 10000 ? Math.floor(n / 100) / 10 : Math.floor(n / 1000);
    return `${k}k`;
}

// ...and if a row still doesn't fit (a long period name), shrink its text
function fitGoalRows(card) {
    card.querySelectorAll('.goals-row').forEach(row => {
        let size = parseFloat(getComputedStyle(row).fontSize) || 9;
        while (row.scrollWidth > row.clientWidth && size > 6) {
            size -= 0.5;
            row.style.fontSize = size + 'px';
        }
    });
}

function goalBar(done, goal) {
    const bar = document.createElement('div');
    bar.className = 'reading-goal-bar';
    const fill = document.createElement('div');
    fill.className = 'reading-goal-fill' + (done >= goal ? ' done' : '');
    setBarFill(fill, done / goal * 100);
    bar.appendChild(fill);
    return bar;
}

// Fill a progress bar to `pct`. Its gradient is sized to the whole bar
// (--bar-span, used by the CSS), so a half-full bar shows the first half
// of the gradient rather than all of it squeezed into half the room.
function setBarFill(fill, pct) {
    pct = Math.max(0, Math.min(100, pct));
    fill.style.width = pct + '%';
    fill.style.setProperty('--bar-span', pct ? (100 / pct * 100) + '%' : '100%');
}

// The Goals window's progress: a line of text and a bar, plus a ring with
// the count in it and (if given) a pace line under the bar, which only
// Candy and Blueprint show (the other themes hide them)
function goalProgress(box, done, goal, unit, text, pace) {
    const ring = document.createElement('div');
    ring.className = 'goals-ring' + (done >= goal ? ' done' : '');
    ring.style.setProperty('--pct', Math.min(100, done / goal * 100));
    ring.setAttribute('aria-hidden', 'true');
    const count = document.createElement('span');
    count.className = 'goals-ring-count';
    count.textContent = compactNumber(done);
    const of = document.createElement('span');
    of.className = 'goals-ring-of';
    of.textContent = `of ${compactNumber(goal)} ${unit}`;
    ring.append(count, of);
    const line = document.createElement('div');
    line.className = 'goals-progress-text';
    line.textContent = text;
    box.append(ring, line, goalBar(done, goal));
    if (pace) {
        const paceLine = document.createElement('div');
        paceLine.className = 'goals-pace';
        paceLine.textContent = pace;
        box.appendChild(paceLine);
    }
}

// what's left of this day / week / month's pages, spread over its days
function pagesPace(done, goal) {
    if (done >= goal) return done > goal ? `${(done - goal).toLocaleString()} pages extra` : 'Right on the nose';
    const left = goal - done;
    const start = new Date(pagesPeriodStart());
    const end = new Date(start);
    if (pagesPeriod() === 'day') end.setDate(end.getDate() + 1);
    if (pagesPeriod() === 'week') end.setDate(end.getDate() + 7);
    if (pagesPeriod() === 'month') end.setMonth(end.getMonth() + 1);
    const daysLeft = Math.max(1, Math.round((end - pagesPeriodStart('day')) / DAY_MS));
    if (daysLeft === 1) return `${left.toLocaleString()} page${left === 1 ? '' : 's'} to go today`;
    return `${left.toLocaleString()} to go · about ${Math.ceil(left / daysLeft)} a day for ${daysLeft} days`;
}

// the last 7 days of the pages log as little bars, today last, with a
// dashed line at the goal's daily pace
function renderPagesWeek(box) {
    box.innerHTML = '';
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date(pagesPeriodStart('day'));
        date.setDate(date.getDate() - i);
        days.push({ start: date.getTime(), date, pages: 0 });
    }
    loadPagesLog().forEach(e => {
        const day = days.findLast(d => e.at >= d.start);
        if (day) day.pages += e.pages;
    });
    const pace = critterGoal();
    const top = Math.max(pace, ...days.map(d => d.pages)) || 1;

    const title = document.createElement('div');
    title.className = 'goals-week-title';
    title.textContent = 'Last 7 days';
    const chart = document.createElement('div');
    chart.className = 'goals-week-chart';
    chart.style.setProperty('--pace', Math.min(100, pace / top * 100));
    days.forEach((d, i) => {
        const col = document.createElement('div');
        col.className = 'goals-day' + (i === 6 ? ' today' : '') + (d.pages >= pace ? ' met' : '');
        const name = d.date.toLocaleDateString(undefined, { weekday: 'short' });
        col.title = `${i === 6 ? 'Today' : name}: ${d.pages.toLocaleString()} page${d.pages === 1 ? '' : 's'}`;
        const bar = document.createElement('div');
        bar.className = 'goals-day-bar';
        bar.style.height = (d.pages / top * 100) + '%';
        const label = document.createElement('span');
        label.className = 'goals-day-name';
        label.textContent = name.charAt(0);
        col.append(bar, label);
        chart.appendChild(col);
    });
    chart.setAttribute('role', 'img');
    chart.setAttribute('aria-label', 'Pages read, last 7 days: ' +
        days.map((d, i) => `${i === 6 ? 'today' : d.date.toLocaleDateString(undefined, { weekday: 'long' })} ${d.pages}`).join(', '));
    box.append(title, chart);
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
    fitGoalRows(card);
    const title = (books ? `${booksDone} of ${books} books this year · ` : '') +
        `${pagesDone} of ${pages} pages ${period.label}`;
    card.title = `Reading goals: ${title}`;
    card.setAttribute('aria-label', card.title);
    checkPins(); // (books read, pages logged and goals all earn pins)

    if (document.getElementById('goals-modal').style.display !== 'flex') return;
    const booksBox = document.getElementById('goal-books-progress');
    booksBox.innerHTML = '';
    if (books) {
        goalProgress(booksBox, booksDone, books, 'books',
            `${booksDone} / ${books} books${booksDone >= books ? ' — you did it! ✦' : ''}`);
    }
    const pagesBox = document.getElementById('goal-pages-progress');
    pagesBox.innerHTML = '';
    goalProgress(pagesBox, pagesDone, pages, 'pages',
        `${pagesDone.toLocaleString()} / ${pages.toLocaleString()} pages ${period.label}${pagesDone >= pages ? ' — goal met! ✦' : ''}`,
        pagesPace(pagesDone, pages));
    renderPagesWeek(document.getElementById('goal-pages-week'));
    const perDay = critterGoal();
    document.getElementById('goal-pages-hint').textContent = appSettings.critter
        ? `Your reading critter gets hungry at this pace (${perDay % 1 ? perDay.toFixed(1) : perDay} pages a day).`
        : 'Log pages here, or by feeding your reading critter.';
}

// a day as the date box writes it, "2026-10-13" (from local fields, not
// toISOString, which is UTC and can be a day off in the evening)
function dateBoxValue(d) {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// The Log box's day, back as far as the pages log keeps. Today's pages
// are stamped now; an earlier day's at midday, so they land on that day.
function resetLogDate() {
    const box = document.getElementById('goal-log-date');
    const earliest = new Date(pagesPeriodStart('day'));
    earliest.setDate(earliest.getDate() - (PAGES_LOG_DAYS - 2));
    box.max = box.value = dateBoxValue(new Date());
    box.min = dateBoxValue(earliest);
}

function loggedDay() {
    const box = document.getElementById('goal-log-date');
    const [y, m, d] = (box.value || '').split('-').map(Number);
    const day = y ? new Date(y, m - 1, d, 12) : null;
    if (!day || box.value >= box.max) return { at: Date.now(), label: '' };
    if (box.value < box.min) return { error: `That's too far back — pages can go back to ${new Date(box.min + 'T12:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}.` };
    const yesterday = new Date(pagesPeriodStart('day') - DAY_MS / 2);
    const label = dateBoxValue(yesterday) === box.value ? ' for yesterday'
        : ` for ${day.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}`;
    return { at: day.getTime(), label };
}

function submitLoggedPages() {
    const input = document.getElementById('goal-log-pages');
    const note = document.getElementById('goal-log-note');
    const pages = Math.min(2000, parseInt(input.value) || 0);
    if (pages < 1) {
        note.textContent = 'How many pages did you read?';
        return;
    }
    const { at, label, error } = loggedDay();
    if (error) {
        note.textContent = error;
        return;
    }
    input.value = '';
    resetLogDate();
    const logged = `Logged ${pages} page${pages === 1 ? '' : 's'}${label}`;
    // the critter eats them too, if it's around to (whatever day they
    // were read, it's eating them now)
    if (appSettings.critter && critter && !critter.gone) {
        feedCritter(pages, at);
        note.textContent = `${logged}, and fed them to ${critterName()}.`;
    } else {
        recordPages(pages, at);
        note.textContent = `${logged}.`;
    }
}

function openGoals() {
    document.getElementById('goal-books').value = appSettings.goal || '';
    document.getElementById('goal-pages').value = appSettings.pagesGoal === DEFAULT_SETTINGS.pagesGoal ? '' : appSettings.pagesGoal;
    document.getElementById('goal-log-pages').value = '';
    document.getElementById('goal-log-note').textContent = '';
    resetLogDate();
    refreshSettingsButtons();
    document.getElementById('goals-modal').style.display = 'flex';
    updateGoals();
}

function closeGoals() {
    document.getElementById('goals-modal').style.display = 'none';
}
