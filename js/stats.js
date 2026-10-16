// ---------- Reading stats ----------
// Counts only books you can see (hidden ones stay out of it). "Finished"
// means marked Read with a finish date, same as the reading goal, plus
// any other reads with a Returned date on the book's library card.

// One { book, date } per time a book was finished.
function finishedReads(books = visibleBooks()) {
    const out = [];
    books.forEach(b => {
        if (b.status === 'Read' && /^\d{4}/.test(b.finishedDate || '')) out.push({ book: b, date: b.finishedDate });
        (b.extraReads || []).forEach(r => {
            if (/^\d{4}/.test(r.finished || '')) out.push({ book: b, date: r.finished });
        });
    });
    return out;
}

function pagesOf(reads) {
    return reads.reduce((sum, r) => sum + (r.book.pages || 0), 0);
}

function fillTiles(box, tiles) {
    box.innerHTML = '';
    tiles.forEach(([label, value]) => {
        const tile = document.createElement('div');
        tile.className = 'stats-tile';
        const l = document.createElement('div');
        l.className = 'stats-tile-label';
        l.textContent = label;
        const v = document.createElement('div');
        v.className = 'stats-tile-value';
        v.textContent = value;
        tile.append(l, v);
        box.appendChild(tile);
    });
}

function emptyNote(box, text) {
    const p = document.createElement('div');
    p.className = 'stats-empty';
    p.textContent = text;
    box.appendChild(p);
}

// Read at least once: marked Read, or a re-read on the library card.
function hasBeenRead(b) {
    return b.status === 'Read' || (b.extraReads || []).some(r => r.finished);
}

// ---------- Series ----------
// Started: you've read, are reading, or gave up on a book in it.
// Finished: the series has a total and every number 1..total is read.
// With no total set there's no telling, so it never counts as finished.
function seriesSummary(books) {
    const groups = new Map();
    books.filter(b => (b.series || '').trim()).forEach(b => {
        const key = b.series.trim();
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(b);
    });
    return [...groups].map(([name, list]) => {
        const total = list.reduce((max, b) => Math.max(max, b.seriesTotal || 0), 0);
        const read = list.filter(hasBeenRead);
        const readNumbers = new Set(read.map(b => b.seriesNumber).filter(Number.isFinite));
        const readCount = total ? [...readNumbers].filter(n => n >= 1 && n <= total).length : read.length;
        const size = total || list.length;
        const started = read.length > 0 || list.some(b => b.status === 'Reading' || b.status === 'DNF');
        const finished = total > 0 && readCount >= total;
        return { name, total, size, readCount, started, finished, owned: list.filter(b => b.owned).length };
    });
}

function renderSeriesStats(books) {
    const all = seriesSummary(books);
    const started = all.filter(s => s.started);
    const finished = all.filter(s => s.finished);
    fillTiles(document.getElementById('stats-series-tiles'), [
        ['Series', all.length],
        ['Started', started.length],
        ['Finished', finished.length],
        ['In progress', started.length - finished.length]
    ]);

    const list = document.getElementById('stats-series-list');
    list.innerHTML = '';
    if (!all.length) {
        emptyNote(list, 'Give a book a series name to track it here.');
        return;
    }
    // unfinished ones you've started first (closest to done on top), then
    // not started, then finished
    const rank = s => s.finished ? 2 : s.started ? 0 : 1;
    all.sort((a, b) => rank(a) - rank(b) || (b.readCount / b.size) - (a.readCount / a.size) || a.name.localeCompare(b.name))
        .forEach(s => {
            const row = document.createElement('div');
            row.className = 'stats-series-row';
            row.innerHTML = '<span class="stats-series-name"></span><span class="stats-series-count"></span>' +
                '<div class="reading-goal-bar"><div class="reading-goal-fill"></div></div>';
            row.querySelector('.stats-series-name').textContent = s.name;
            row.querySelector('.stats-series-name').title = s.name;
            row.querySelector('.stats-series-count').textContent = s.finished
                ? `all ${s.total} read ✦`
                : s.total ? `${s.readCount} of ${s.total} read` : `${s.readCount} read`;
            setBarFill(row.querySelector('.reading-goal-fill'), s.readCount / s.size * 100);
            if (!s.total) row.title = 'Set how many books are in this series to track finishing it';
            list.appendChild(row);
        });
}

// ---------- Top genres / authors ----------
function rankList(box, counts, limit, emptyText) {
    box.innerHTML = '';
    const top = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit);
    if (!top.length) {
        emptyNote(box, emptyText);
        return;
    }
    const max = top[0][1];
    top.forEach(([name, n]) => {
        const row = document.createElement('div');
        row.className = 'stats-rank-row';
        row.innerHTML = '<span class="stats-rank-name"></span><span class="stats-rank-value"></span>' +
            '<div class="stats-rank-track"><div class="stats-rank-bar"></div></div>';
        row.querySelector('.stats-rank-name').textContent = name;
        row.querySelector('.stats-rank-name').title = name;
        row.querySelector('.stats-rank-value').textContent = n;
        row.querySelector('.stats-rank-bar').style.width = (n / max) * 100 + '%';
        box.appendChild(row);
    });
}

function tally(values) {
    const counts = new Map();
    values.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
    return counts;
}

function renderTopLists(books) {
    const genres = books.map(b => b.genre).filter(Boolean);
    rankList(document.getElementById('stats-top-genres'), tally(genres), 5, 'No genres yet.');
    const fiction = genres.filter(g => FICTION_GENRES.includes(g)).length;
    const nonfiction = genres.filter(g => NONFICTION_GENRES.includes(g)).length;
    document.getElementById('stats-fiction-split').textContent = fiction + nonfiction
        ? `${Math.round((fiction / (fiction + nonfiction)) * 100)}% fiction · ${fiction} fiction, ${nonfiction} non-fiction`
        : '';

    const authors = books.flatMap(b => (b.authors || []).filter(a => a && a !== 'Unknown'));
    rankList(document.getElementById('stats-top-authors'), tally(authors), 5, 'No authors yet.');
}

// ---------- Highlights ----------
// Whole days between two full dates (YYYY-MM-DD), or null.
function daysBetween(start, end) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start || '') || !/^\d{4}-\d{2}-\d{2}$/.test(end || '')) return null;
    const d = (Date.parse(end) - Date.parse(start)) / 86400000;
    return d >= 0 ? d + 1 : null; // started and finished the same day = 1 day
}

function renderHighlights(books) {
    const box = document.getElementById('stats-highlights');
    box.innerHTML = '';
    const rows = [];
    const plural = (n, word) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

    const reads = finishedReads();
    const thisYear = new Date().getFullYear();
    const inYear = y => reads.filter(r => r.date.startsWith(String(y))).length;
    if (reads.length) rows.push(['Finished this year', `${inYear(thisYear)} (last year ${inYear(thisYear - 1)})`]);

    const readBooks = books.filter(hasBeenRead);
    const withPages = readBooks.filter(b => b.pages > 0);
    if (withPages.length) {
        const longest = withPages.reduce((a, b) => b.pages > a.pages ? b : a);
        const shortest = withPages.reduce((a, b) => b.pages < a.pages ? b : a);
        rows.push(['Longest read', `${longest.title} (${plural(longest.pages, 'page')})`]);
        if (shortest !== longest) rows.push(['Shortest read', `${shortest.title} (${plural(shortest.pages, 'page')})`]);
        const avg = Math.round(withPages.reduce((s, b) => s + b.pages, 0) / withPages.length);
        rows.push(['Average length', plural(avg, 'page')]);
    }

    // time to finish, from every read with full start and finish dates
    const spans = [];
    books.forEach(b => {
        if (b.status === 'Read') spans.push({ book: b, days: daysBetween(b.startedDate, b.finishedDate) });
        (b.extraReads || []).forEach(r => spans.push({ book: b, days: daysBetween(r.started, r.finished) }));
    });
    const timed = spans.filter(s => s.days !== null);
    if (timed.length) {
        const avgDays = Math.round(timed.reduce((s, t) => s + t.days, 0) / timed.length);
        rows.push(['Average time to finish', plural(avgDays, 'day')]);
        const fastest = timed.reduce((a, b) => b.days < a.days ? b : a);
        rows.push(['Fastest read', `${fastest.book.title} (${plural(fastest.days, 'day')})`]);
    }

    const reReads = books.map(b => ({ book: b, n: reads.filter(r => r.book === b).length })).filter(x => x.n > 1);
    if (reReads.length) {
        const most = reReads.reduce((a, b) => b.n > a.n ? b : a);
        rows.push(['Re-read books', reReads.length]);
        rows.push(['Most re-read', `${most.book.title} (${most.n} times)`]);
    }

    const fiveStars = books.filter(b => normalizeRating(b.rating) >= 5).length;
    if (fiveStars) rows.push(['5-star books', fiveStars]);

    const authorCount = new Set(readBooks.flatMap(b => (b.authors || []).filter(a => a && a !== 'Unknown'))).size;
    if (authorCount) rows.push(['Authors read', authorCount]);
    const genreCount = new Set(readBooks.map(b => b.genre).filter(Boolean)).size;
    if (genreCount) rows.push(['Genres read', genreCount]);

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const reading = books.filter(b => b.status === 'Reading')
        .map(b => ({ book: b, days: daysBetween(b.startedDate, today) }))
        .filter(x => x.days !== null);
    if (reading.length) {
        const oldest = reading.reduce((a, b) => b.days > a.days ? b : a);
        rows.push(['Reading the longest', `${oldest.book.title} (${plural(oldest.days, 'day')} so far)`]);
    }

    if (!rows.length) {
        emptyNote(box, 'Finish a few books (with dates and page counts) and highlights show up here.');
        return;
    }
    rows.forEach(([label, value]) => {
        const dt = document.createElement('dt');
        dt.textContent = label;
        const dd = document.createElement('dd');
        dd.textContent = value;
        box.append(dt, dd);
    });
}

function updateStatsLedger() {
    // the ledger's cover is blank; keep the total in its tooltip
    document.getElementById('stats-ledger').title = `Reading stats (${visibleBooks().length} books)`;
}

function openStats() {
    const books = visibleBooks();
    document.getElementById('stats-total').textContent = books.length.toLocaleString();
    updateReadingGoal();

    const count = status => books.filter(b => b.status === status).length;
    const rated = books.map(b => normalizeRating(b.rating)).filter(r => r > 0);
    const avg = rated.length ? (rated.reduce((a, b) => a + b, 0) / rated.length).toFixed(1) : '\u2014';
    const tiles = [
        ['Read', count('Read')],
        ['Reading', count('Reading')],
        ['Want to Read', count('Want to Read')],
        ['DNF', count('DNF')],
        ['Owned', books.filter(b => b.owned).length],
        ['Lent out', books.filter(isLentOut).length],
        ['With notes', books.filter(b => (b.notes || '').trim() || (b.notes2 || '').trim()).length],
        ['Average rating', rated.length ? `${avg} \u2605` : avg],
        ['Pages read', pagesOf(finishedReads()).toLocaleString()]
    ];
    fillTiles(document.getElementById('stats-tiles'), tiles);
    renderSeriesStats(books);
    renderTopLists(books);
    renderHighlights(books);

    // years with finished books, plus this year; newest first
    const thisYear = new Date().getFullYear();
    const years = [...new Set([thisYear, ...finishedReads().map(r => Number(r.date.slice(0, 4)))])].sort((a, b) => b - a);
    const select = document.getElementById('stats-year');
    const keep = Number(select.value);
    select.innerHTML = '';
    years.forEach(y => select.add(new Option(String(y), String(y))));
    select.value = years.includes(keep) ? String(keep) : String(thisYear);

    document.getElementById('stats-table').classList.remove('visible');
    document.getElementById('stats-table-toggle').textContent = 'Show as table';
    document.getElementById('stats-modal').style.display = 'flex';
    renderStatsChart();
}

function closeStats() {
    document.getElementById('stats-modal').style.display = 'none';
}

function toggleStatsTable() {
    const table = document.getElementById('stats-table');
    const showing = table.classList.toggle('visible');
    document.getElementById('stats-table-toggle').textContent = showing ? 'Hide table' : 'Show as table';
}

// Column chart of books finished per month (single series: no legend -
// the title names it). Bars <= 24px with a 4px rounded top, recessive
// hairline grid, the busiest month labelled, every column hoverable /
// focusable for its count and titles, and a table view with the same data.
function renderStatsChart() {
    const year = document.getElementById('stats-year').value;
    const inYear = finishedReads().filter(r => r.date.startsWith(year));
    const byMonth = Array.from({ length: 12 }, () => []);
    let noMonth = 0;
    inYear.forEach(r => {
        const m = parseInt(r.date.slice(5, 7), 10);
        if (m >= 1 && m <= 12) byMonth[m - 1].push(r.book); else noMonth++;
    });
    const counts = byMonth.map(list => list.length);
    const MONTH_SHORT = MONTH_NAMES.map(m => m.slice(0, 3));

    const yearPages = pagesOf(inYear);
    document.getElementById('stats-chart-sub').textContent =
        `${inYear.length} book${inYear.length === 1 ? '' : 's'} finished in ${year}` +
        (yearPages ? ` · ${yearPages.toLocaleString()} pages` : '');
    document.getElementById('stats-chart-note').textContent = noMonth
        ? `Plus ${noMonth} finished in ${year} with no month set (not shown in the chart).`
        : '';

    // geometry (viewBox units)
    const W = 600, H = 240, left = 34, right = 8, top = 18, bottom = 26;
    const plotW = W - left - right, plotH = H - top - bottom;
    const maxCount = Math.max(...counts, 0);
    const step = maxCount <= 5 ? 1 : maxCount <= 10 ? 2 : maxCount <= 25 ? 5 : 10;
    const yMax = Math.max(step, Math.ceil(maxCount / step) * step);
    const y = v => top + plotH - (v / yMax) * plotH;
    const band = plotW / 12;
    const barW = Math.min(24, band * 0.6);

    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `Books finished by month in ${year}`);
    const el = (tag, attrs, text) => {
        const n = document.createElementNS(NS, tag);
        Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
        if (text !== undefined) n.textContent = text;
        svg.appendChild(n);
        return n;
    };

    for (let v = 0; v <= yMax; v += step) {
        el('line', { class: 'stats-grid', x1: left, x2: W - right, y1: y(v), y2: y(v) });
        el('text', { class: 'stats-axis-text', x: left - 8, y: y(v) + 4, 'text-anchor': 'end' }, String(v));
    }

    const chart = document.getElementById('stats-chart');
    chart.innerHTML = '';
    const tip = document.createElement('div');
    tip.className = 'stats-tooltip';

    const busiest = maxCount > 0 ? counts.indexOf(maxCount) : -1;
    counts.forEach((c, i) => {
        const cx = left + band * i + band / 2;
        const x = cx - barW / 2;
        // whole-column hit area, bigger than the mark
        const hit = el('rect', { class: 'stats-hit', x: left + band * i, y: top, width: band, height: plotH, tabindex: 0 });
        hit.setAttribute('aria-label', `${MONTH_NAMES[i]} ${year}: ${c} book${c === 1 ? '' : 's'}`);
        if (c > 0) {
            const h = y(0) - y(c);
            const r = Math.min(4, h, barW / 2);
            // rounded data end, square at the baseline
            el('path', {
                class: 'stats-bar',
                d: `M${x},${y(0)} V${y(c) + r} Q${x},${y(c)} ${x + r},${y(c)} H${x + barW - r} Q${x + barW},${y(c)} ${x + barW},${y(c) + r} V${y(0)} Z`
            });
        } else {
            el('path', { class: 'stats-bar', d: '' });
        }
        if (i === busiest) {
            el('text', { class: 'stats-value-text', x: cx, y: y(c) - 6, 'text-anchor': 'middle' }, String(c));
        }
        el('text', { class: 'stats-axis-text', x: cx, y: H - 8, 'text-anchor': 'middle' }, MONTH_SHORT[i]);

        const show = () => {
            tip.innerHTML = '';
            const value = document.createElement('div');
            value.className = 'stats-tooltip-value';
            value.textContent = `${c} book${c === 1 ? '' : 's'}`;
            const label = document.createElement('div');
            label.textContent = `${MONTH_NAMES[i]} ${year}`;
            tip.append(value, label);
            if (c > 0) {
                const list = document.createElement('ul');
                list.className = 'stats-tooltip-books';
                byMonth[i].slice(0, 6).forEach(b => {
                    const li = document.createElement('li');
                    li.textContent = b.title;
                    list.appendChild(li);
                });
                if (c > 6) {
                    const li = document.createElement('li');
                    li.textContent = `and ${c - 6} more`;
                    list.appendChild(li);
                }
                tip.appendChild(list);
            }
            const box = chart.getBoundingClientRect();
            const rect = hit.getBoundingClientRect();
            tip.classList.add('visible');
            const tipW = tip.offsetWidth, tipH = tip.offsetHeight;
            // the column's top, viewBox units -> pixels
            const svgRect = svg.getBoundingClientRect();
            const barTop = (svgRect.top - box.top) + y(c) * (svgRect.height / H);
            const colLeft = rect.left - box.left, colRight = colLeft + rect.width;
            let lx, ly;
            if (barTop - tipH - 10 >= 0) {
                // room above: centred over the column
                lx = colLeft + rect.width / 2 - tipW / 2;
                ly = barTop - tipH - 10;
            } else {
                // tall column: beside it instead, so the bar stays visible
                lx = colRight + tipW + 6 <= box.width ? colRight + 6 : colLeft - tipW - 6;
                ly = Math.max(0, barTop);
            }
            tip.style.left = Math.max(0, Math.min(lx, box.width - tipW)) + 'px';
            tip.style.top = ly + 'px';
        };
        const hide = () => tip.classList.remove('visible');
        hit.addEventListener('pointerenter', show);
        hit.addEventListener('focus', show);
        hit.addEventListener('pointerleave', hide);
        hit.addEventListener('blur', hide);
    });
    // each bar right after its hit rect, so the :hover + .stats-bar lift works
    [...svg.querySelectorAll('.stats-hit')].forEach((hit, i) => {
        const bar = svg.querySelectorAll('.stats-bar')[i];
        hit.after(bar);
    });

    chart.append(svg, tip);

    // table view: same numbers, no hovering needed
    const table = document.getElementById('stats-table');
    table.innerHTML = '';
    const head = table.insertRow();
    ['Month', 'Books'].forEach(t => {
        const th = document.createElement('th');
        th.textContent = t;
        head.appendChild(th);
    });
    counts.forEach((c, i) => {
        const row = table.insertRow();
        row.insertCell().textContent = `${MONTH_NAMES[i]} ${year}`;
        row.insertCell().textContent = c;
    });
    if (noMonth) {
        const row = table.insertRow();
        row.insertCell().textContent = 'No month set';
        row.insertCell().textContent = noMonth;
    }
}

function updateReadingGoal() {
    updateGoals();
    const box = document.getElementById('reading-goal');
    const goal = appSettings.goal;
    if (!goal) {
        // no goal on this copy of the site yet: offer a shortcut to set one
        box.innerHTML = '';
        const link = document.createElement('button');
        link.type = 'button';
        link.className = 'reading-goal-set';
        link.textContent = '＋ Set a yearly reading goal';
        link.addEventListener('click', () => {
            closeStats();
            openGoals();
            document.getElementById('goal-books').focus();
        });
        box.appendChild(link);
        box.classList.add('visible');
        return;
    }
    const year = String(new Date().getFullYear());
    const done = booksReadThisYear();
    box.innerHTML = `<span></span><div class="reading-goal-bar"><div class="reading-goal-fill"></div></div>`;
    box.querySelector('span').textContent = done >= goal
        ? `${year} goal: ${done} / ${goal} books \u2014 you did it! \u2726`
        : `${year} goal: ${done} / ${goal} books`;
    setBarFill(box.querySelector('.reading-goal-fill'), done / goal * 100);
    box.classList.add('visible');
}
