// ---------- Reading stats ----------
// Counts only books you can see (hidden ones stay out of it). "Finished"
// means marked Read with a finish date, same as the reading goal.

function finishedBooks() {
    return visibleBooks().filter(b => b.status === 'Read' && /^\d{4}/.test(b.finishedDate || ''));
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
        ['With notes', books.filter(b => (b.notes || '').trim()).length],
        ['Average rating', rated.length ? `${avg} \u2605` : avg]
    ];
    const tileBox = document.getElementById('stats-tiles');
    tileBox.innerHTML = '';
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
        tileBox.appendChild(tile);
    });

    // years with finished books, plus this year; newest first
    const thisYear = new Date().getFullYear();
    const years = [...new Set([thisYear, ...finishedBooks().map(b => Number(b.finishedDate.slice(0, 4)))])].sort((a, b) => b - a);
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
    const inYear = finishedBooks().filter(b => b.finishedDate.startsWith(year));
    const byMonth = Array.from({ length: 12 }, () => []);
    let noMonth = 0;
    inYear.forEach(b => {
        const m = parseInt(b.finishedDate.slice(5, 7), 10);
        if (m >= 1 && m <= 12) byMonth[m - 1].push(b); else noMonth++;
    });
    const counts = byMonth.map(list => list.length);
    const MONTH_SHORT = MONTH_NAMES.map(m => m.slice(0, 3));

    document.getElementById('stats-chart-sub').textContent =
        `${inYear.length} book${inYear.length === 1 ? '' : 's'} finished in ${year}`;
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
    box.querySelector('.reading-goal-fill').style.width = Math.min(100, (done / goal) * 100) + '%';
    box.classList.add('visible');
}
