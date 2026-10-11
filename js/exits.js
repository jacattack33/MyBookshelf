// Wait, then shrink the (hidden) book's spot to nothing so its
// neighbours slide over to fill it, instead of jumping
function closeGapAfter(id, delay) {
    const el = document.querySelector(`#library-room .book[data-id="${CSS.escape(id)}"]`);
    return new Promise(resolve => setTimeout(() => {
        if (!el || !el.isConnected) return resolve();
        const cs = getComputedStyle(el);
        const gap = parseFloat(getComputedStyle(el.parentElement).columnGap) || 0;
        const SLIDE = 320;
        // (max-width, as sticky notes set their width with !important)
        el.animate([
            { maxWidth: el.offsetWidth + 'px', minWidth: '0px', marginLeft: cs.marginLeft, marginRight: cs.marginRight },
            { maxWidth: '0px', minWidth: '0px', marginLeft: '0px', marginRight: -gap + 'px' }
        ], { duration: SLIDE, easing: 'ease-in-out', fill: 'forwards' });
        setTimeout(resolve, SLIDE);
    }, delay));
}

// The new book pops into place in a little cloud (after `delay` ms,
// once the sticky note has cleared the spot)
function poofBookIn(id, delay) {
    const el = document.querySelector(`#library-room .book[data-id="${CSS.escape(id)}"]`);
    if (!el) return;
    const POP = 520;
    const total = delay + POP;
    const at = ms => ms / total;
    el.animate([
        { opacity: 0, scale: '0.3', offset: 0 },
        { opacity: 0, scale: '0.3', offset: at(delay), easing: 'cubic-bezier(.2,.9,.3,1.3)' },
        { opacity: 1, scale: '1.12', offset: at(delay + POP * 0.6), easing: 'ease-in-out' },
        { opacity: 1, scale: '1', offset: 1 }
    ], { duration: total });
    setTimeout(() => {
        if (!el.isConnected) return;
        // (layout size - the book is still shrunk at the start of its pop)
        const reach = Math.max(el.offsetWidth, el.offsetHeight) * 0.9;
        // const TINTS = ['#ffffff', '#e6d4ff', '#ffd6ec', '#d2f7ec', '#d6ecff'];
        const puff = (min, spread) => () => {
            const pf = document.createElement('span');
            pf.className = 'fx-puff';
            pf.style.width = pf.style.height = (min + Math.random() * spread) + 'px';
            // pf.style.setProperty('--puff', TINTS[i % TINTS.length]);
            pf.style.setProperty('--puff-dur', (1 + Math.random() * 0.5) + 's');
            return pf;
        };
        burstFrom(el, 12, reach * 0.35, puff(60, 40)); // the cloud over the book
        burstFrom(el, 24, reach, puff(34, 30)); // billowing out
        // a glowing ring flashes out from the middle
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const ring = document.createElement('div');
        ring.className = 'fx-poof-ring';
        ring.style.left = cx + 'px';
        ring.style.top = cy + 'px';
        getFxLayer().appendChild(ring);
        setTimeout(() => ring.remove(), 500);
        // magic sparkles fly out, then a few stars float up (switched off for now)
        // const SPARKS = [['#ffe066', 'rgba(255,224,102,0.95)'], ['#ff8fcb', 'rgba(255,143,203,0.9)'], ['#c49bff', 'rgba(196,155,255,0.9)']];
        // const sparkle = (min, spread) => i => {
            // const sp = document.createElement('span');
            // sp.className = 'fx-sparkle';
            // sp.textContent = ['✦', '✧', '★'][i % 3];
            // sp.style.fontSize = (min + Math.random() * spread) + 'px';
            // const [c, glow] = SPARKS[i % SPARKS.length];
            // sp.style.color = c;
            // sp.style.textShadow = `0 0 8px ${glow}, 0 0 2px #fff`;
            // return sp;
        // };
        // burstFrom(el, 18, reach * 1.1, sparkle(14, 14));
        // setTimeout(() => {
            // if (!el.isConnected) return;
            // const er = el.getBoundingClientRect();
            // const ex = er.left + er.width / 2, ey = er.top + er.height / 2;
            // const layer = getFxLayer();
            // for (let i = 0; i < 8; i++) {
                // // these drift up rather than flying outward
                // const sp = sparkle(10, 10)(i);
                // sp.style.left = ex + (Math.random() - 0.5) * er.width + 'px';
                // sp.style.top = ey + 'px';
                // sp.style.setProperty('--dx', (Math.random() - 0.5) * 40 + 'px');
                // sp.style.setProperty('--dy', -(50 + Math.random() * 70) + 'px');
                // sp.style.setProperty('--rot', (Math.random() - 0.5) * 90 + 'deg');
                // sp.style.setProperty('--dur', (1.1 + Math.random() * 0.5) + 's');
                // layer.appendChild(sp);
                // sp.addEventListener('animationend', () => sp.remove());
            // }
        // }, 250);
    }, delay);
}

// beforeRemove can return how long (ms) to keep the book's spot open
// first - a tossed sticky note's spot stays put until the note has left
async function removeBook(id, beforeRemove) {
    if (confirm("Remove this book from the shelf?")) {
        const holdMs = (beforeRemove && beforeRemove()) || 0;
        library = library.filter(b => b.id !== id);
        await dbDelete(id);
        if (holdMs) await closeGapAfter(id, holdMs);
        animateLeans = true;
        renderBookshelf();
        return true;
    }
    return false;
}

async function deleteCurrentBook() {
    if (!editingId) return;
    const id = editingId;
    const book = library.find(b => b.id === id);
    // a to-get sticky note gets crumpled up and thrown off the screen;
    // a book leaves one of its own ways (its pulled-out pose is read
    // before the window closes and starts sliding it back)
    const toss = !book || prefersReducedMotion() ? null
        : isStickyPlaceholder(book)
            ? () => { closeModal(); return tossStickyNote(id); }
            : () => { const ms = tossBook(id); closeModal(); return ms; };
    if (await removeBook(id, toss)) {
        closeModal();
    }
}

// A deleted sticky note leaves the screen one of four ways (picked at
// random): crumpled into a ball and thrown off the side, folded into a
// paper airplane that swoops away, crumpled and dropped - it bounces
// on the bottom edge, sits a moment, then fades or rolls away - or set
// on fire, burning away from the bottom up.
// A copy of the note in the fx layer does the moving, inside two
// wrappers so x and y each get their own easing (a real arc); the
// note itself spins and squashes, and its face's clip-path is the
// paper's outline (square -> jagged ball, or -> dart).
const NOTE_EXITS = ['throw', 'plane', 'drop', 'burn'];
const CRUMPLE_MS = 560;
const POLY_N = 16;

const polyCss = pts => `polygon(${pts.map(([x, y]) => `${x.toFixed(1)}% ${y.toFixed(1)}%`).join(', ')})`;
// POLY_N points around the note's edge, clockwise from the right middle
function squarePoly() {
    const pts = [];
    for (let i = 0; i < POLY_N; i++) {
        const a = i / POLY_N * Math.PI * 2;
        const k = 50 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
        pts.push([50 + Math.cos(a) * k, 50 + Math.sin(a) * k]);
    }
    return pts;
}
// a crumpled ball: points sticking out, valleys pushed in, all a bit uneven
function ballPoly(spiky) {
    const pts = [];
    for (let i = 0; i < POLY_N; i++) {
        const a = (i + (Math.random() - 0.5) * 0.7) / POLY_N * Math.PI * 2;
        const r = i % 2 === 0
            ? 40 + Math.random() * 10 // a point (some sharper than others)
            : 50 - spiky + (Math.random() - 0.5) * 12; // a dent between points
        pts.push([50 + Math.cos(a) * r, 50 + Math.sin(a) * r]);
    }
    return pts;
}
// a paper airplane seen from above, nose pointing right (dir 1) or left
function planePoly(dir) {
    const A = [100, 50], B = [0, 92], C = [22, 50], D = [0, 8];
    const lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    const right = [];
    for (let i = 0; i < POLY_N; i++) {
        if (i <= 6) right.push(lerp(A, B, i / 6));
        else if (i <= 8) right.push(lerp(B, C, (i - 6) / 2));
        else if (i <= 10) right.push(lerp(C, D, (i - 8) / 2));
        else right.push(lerp(D, A, (i - 10) / 6));
    }
    if (dir > 0) return right;
    // mirrored, keeping each point matched to the same square point
    return right.map((_, j) => { const [x, y] = right[(POLY_N + POLY_N / 2 - j) % POLY_N]; return [100 - x, y]; });
}
const mixPoly = (a, b, t) => a.map((p, i) => [p[0] + (b[i][0] - p[0]) * t, p[1] + (b[i][1] - p[1]) * t]);

// Keyframes from [ms, value, easing-after] steps
function timeline(steps, prop, fmt) {
    const total = steps[steps.length - 1][0];
    return [steps.map(([ms, v, easing]) => {
        const k = { offset: total ? ms / total : 0, [prop]: fmt(v) };
        if (easing) k.easing = easing;
        return k;
    }), total];
}
function play(el, steps, prop, fmt, delay = 0) {
    const [frames, total] = timeline(steps, prop, fmt);
    el.animate(frames, { duration: total, delay, fill: 'forwards' });
    return total;
}

function tossStickyNote(id, exit = NOTE_EXITS[Math.floor(Math.random() * NOTE_EXITS.length)]) {
    const el = document.querySelector(`#library-room .book.sticky-book[data-id="${CSS.escape(id)}"]`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (!r.width || r.bottom < 0 || r.top > innerHeight) return;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const m = new DOMMatrix(getComputedStyle(el).transform);
    const tilt = Math.atan2(m.b, m.a) * 180 / Math.PI;
    const dir = Math.random() < 0.5 ? -1 : 1; // which side of the screen it leaves by
    const w = el.offsetWidth, h = el.offsetHeight;

    const xWrap = document.createElement('div');
    const yWrap = document.createElement('div');
    xWrap.className = yWrap.className = 'toss-wrap';
    xWrap.style.left = cx + 'px';
    xWrap.style.top = cy + 'px';
    const note = el.cloneNode(true);
    note.classList.remove('fallen', 'pulled-out');
    note.classList.add('tossed-note');
    note.dataset.exit = exit;
    note.removeAttribute('draggable');
    note.style.left = -w / 2 + 'px';
    note.style.top = -h / 2 + 'px';
    yWrap.appendChild(note);
    xWrap.appendChild(yWrap);
    getFxLayer().appendChild(xWrap);
    el.style.visibility = 'hidden';
    const face = note.querySelector('.sticky-book-face');
    const square = squarePoly();
    const tf = (deg, sx, sy = sx) => `rotate(${deg}deg) scale(${sx}, ${sy})`;
    const tx = v => `translateX(${v}px)`;
    const ty = v => `translateY(${v}px)`;
    let total, clear;

    if (exit === 'burn') {
        // catches at the bottom, then smoulders steadily up to the top.
        // The face and the two ember layers share each step's ragged
        // edge (the embers sit a little lower, so they peek out as a rim);
        // a fresh edge each step keeps it gently shifting as it burns.
        const IGNITE = 450, BURN = 3000, N = 14;
        const steps = [];
        for (let k = 0; k <= N; k++) {
            const y = k === 0 ? 104 : 100 - 112 * (k / N);
            const jit = [];
            for (let i = 0; i <= 10; i++) jit.push((Math.random() - 0.5) * 9);
            steps.push([k === 0 ? 0 : IGNITE + (BURN - IGNITE) * (k / N), y, jit]);
        }
        const edge = (y, jit, drop) => {
            const pts = [[0, 0], [100, 0]];
            jit.forEach((d, i) => pts.push([100 - i * 10, y + d + drop]));
            return pts;
        };
        // the embers are just a band along the edge, so only it glows
        const band = (y, jit, drop) => [
            ...jit.map((d, i) => [i * 10, y + jit[10 - i] - 6]),
            ...jit.map((d, i) => [100 - i * 10, y + d + drop])
        ];
        const linear = st => st.map(([ms, y, jit], k) => [ms, { y, jit }, k ? 'linear' : 'ease-in']);
        const ember = document.createElement('div');
        ember.className = 'burn-ember';
        const outer = document.createElement('div');
        outer.className = 'ember-outer';
        const inner = document.createElement('div');
        inner.className = 'ember-inner';
        ember.append(outer, inner);
        note.insertBefore(ember, face);
        play(face, linear(steps), 'clipPath', v => polyCss(edge(v.y, v.jit, 0)));
        play(inner, linear(steps), 'clipPath', v => polyCss(band(v.y, v.jit, 2.2)));
        play(outer, linear(steps), 'clipPath', v => polyCss(band(v.y, v.jit, 4.2)));
        const char = document.createElement('div');
        char.className = 'burn-char';
        face.appendChild(char);
        play(char, linear(steps), 'top', v => `${v.y - 20}%`);
        ember.animate([{ opacity: 0 }, { opacity: 1, offset: 0.08 }, { opacity: 1, offset: 0.92 }, { opacity: 0 }],
            { duration: BURN, fill: 'forwards' });
        // thin wisps of smoke off the ember edge, an occasional spark, ash
        const bit = flyBit;
        const start = performance.now();
        let tick = 0;
        const sparks = setInterval(() => {
            if (!note.isConnected) return clearInterval(sparks);
            const t = performance.now() - start;
            if (t < IGNITE * 0.6) return;
            const k = Math.min(1, Math.max(0, (t - IGNITE) / (BURN - IGNITE)));
            const nr = note.getBoundingClientRect();
            const y = nr.top + nr.height * Math.min(1, (100 - 112 * k) / 100);
            const x = () => nr.left + nr.width * (0.08 + Math.random() * 0.84);
            bit('fx-smoke', x(), y - 6, (Math.random() - 0.5) * 24, -60 - Math.random() * 50, 1.3 + Math.random() * 0.6);
            if (tick % 3 === 0) bit('fx-ash', x(), y, (Math.random() - 0.5) * 20, 40 + Math.random() * 70, 1.1 + Math.random() * 0.5);
            if (tick % 5 === 0) bit('fx-ember', x(), y, (Math.random() - 0.5) * 24, -30 - Math.random() * 40, 0.6 + Math.random() * 0.4);
            tick++;
        }, 110);
        setTimeout(() => clearInterval(sparks), BURN);
        total = BURN + 100;
        clear = BURN - 250;
    } else if (exit === 'plane') {
        // fold (the note levels out and narrows into a dart), a little
        // pull back, then launch: dips, catches the air, climbs away
        const FOLD = 700;
        clear = FOLD + 350;
        const dart = planePoly(dir);
        play(face, [[0, square], [FOLD * 0.5, mixPoly(square, dart, 0.55)], [FOLD, dart]], 'clipPath', polyCss);
        setTimeout(() => note.classList.add('folded'), FOLD * 0.4);
        const dx = (dir > 0 ? innerWidth - cx : cx) + 220;
        const fly = 1700;
        play(note, [
            [0, tf(tilt, 1)],
            [FOLD * 0.5, tf(tilt / 2, 0.92, 0.8)],
            [FOLD, tf(0, 0.85, 0.55)],
            [FOLD + 150, tf(-dir * 6, 0.85, 0.55)],
            [FOLD + 150 + fly * 0.3, tf(dir * 12, 0.85, 0.55), 'ease-in-out'],
            [FOLD + 150 + fly * 0.65, tf(-dir * 16, 0.85, 0.55)],
            [FOLD + 150 + fly, tf(-dir * 24, 0.8, 0.5)]
        ], 'transform', v => v);
        play(xWrap, [
            [0, 0], [FOLD, 0], [FOLD + 150, -dir * 22, 'cubic-bezier(.3,0,.8,.6)'],
            [FOLD + 150 + fly, dir * dx]
        ], 'transform', tx);
        total = play(yWrap, [
            [0, 0], [FOLD + 150, 0, 'ease-in-out'],
            [FOLD + 150 + fly * 0.3, 38, 'ease-in-out'],
            [FOLD + 150 + fly * 0.65, -50, 'ease-in'],
            [FOLD + 150 + fly, -Math.min(cy + 120, 320)]
        ], 'transform', ty);
    } else {
        // crumple: squash and twist while the outline goes jagged
        const ball = ballPoly(16);
        play(face, [
            [0, square],
            [CRUMPLE_MS * 0.45, mixPoly(square, ballPoly(10), 0.6)],
            [CRUMPLE_MS * 0.75, ball],
            [CRUMPLE_MS, ball]
        ], 'clipPath', polyCss);
        setTimeout(() => note.classList.add('crumpled'), CRUMPLE_MS * 0.3);
        const end = tilt + 4;
        const ballSize = h * 0.5;
        const crumple = [
            [0, tf(tilt, 1)],
            [CRUMPLE_MS * 0.2, tf(tilt + 6, 0.9, 0.8)],
            [CRUMPLE_MS * 0.45, tf(tilt - 9, 0.68, 0.6)],
            [CRUMPLE_MS * 0.7, tf(tilt + 14, 0.54, 0.5)],
            [CRUMPLE_MS, tf(end, 0.5)]
        ];
        const C = CRUMPLE_MS;
        clear = C + (exit === 'throw' ? 150 : 250);
        if (exit === 'throw') {
            // wind up with a little dip back, then an arc off the side
            const T = 850;
            const dx = (dir > 0 ? innerWidth - cx : cx) + 120;
            play(note, [...crumple, [C + T, tf(end + dir * 720, 0.46)]], 'transform', v => v);
            play(xWrap, [[0, 0], [C, 0], [C + 100, -dir * 14], [C + T, dir * dx]], 'transform', tx);
            total = play(yWrap, [
                [0, 0], [C, 0, 'cubic-bezier(.2,.7,.4,1)'],
                [C + 100, 10, 'cubic-bezier(.2,.7,.4,1)'],
                [C + 330, -130, 'cubic-bezier(.5,0,.9,.6)'],
                [C + T, innerHeight - cy + 120]
            ], 'transform', ty);
        } else {
            // drop to the bottom of the screen, bounce twice, settle
            const floor = Math.max(20, innerHeight - cy - ballSize / 2 - 4);
            const fall = Math.min(900, Math.max(320, Math.sqrt(floor) * 26));
            const b1 = Math.min(70, floor * 0.3), b2 = b1 * 0.35;
            const land = C + fall, rest = land + 700;
            const drift = dir * 26;
            play(yWrap, [
                [0, 0], [C, 0, 'cubic-bezier(.55,0,1,.45)'],
                [land, floor, 'cubic-bezier(0,.55,.45,1)'],
                [land + 230, floor - b1, 'cubic-bezier(.55,0,1,.45)'],
                [land + 460, floor, 'cubic-bezier(0,.55,.45,1)'],
                [land + 590, floor - b2, 'cubic-bezier(.55,0,1,.45)'],
                [land + 720, floor]
            ], 'transform', ty);
            const spun = end + dir * 160;
            play(note, [...crumple, [land, tf(end + dir * 110, 0.5)], [land + 720, tf(spun, 0.5)]], 'transform', v => v);
            play(xWrap, [[0, 0], [C, 0], [land + 720, drift]], 'transform', tx);
            const settled = land + 720 + 600;
            if (Math.random() < 0.5) {
                // fades away where it landed
                setTimeout(() => xWrap.animate([{ opacity: 1 }, { opacity: 0 }],
                    { duration: 500, fill: 'forwards' }), settled);
                total = settled + 500;
            } else {
                // a breeze rolls it off the nearer side; it turns as far as it travels
                const dist = (dir > 0 ? innerWidth - cx : cx) - Math.abs(drift) + ballSize;
                const rollMs = Math.min(1600, Math.max(700, dist * 1.6));
                const turns = dir * dist / (Math.PI * ballSize) * 360;
                setTimeout(() => {
                    xWrap.animate([{ transform: tx(drift) }, { transform: tx(drift + dir * dist) }],
                        { duration: rollMs, easing: 'cubic-bezier(.5,0,.75,1)', fill: 'forwards' });
                    note.animate([{ transform: tf(spun, 0.5) }, { transform: tf(spun + turns, 0.5) }],
                        { duration: rollMs, easing: 'cubic-bezier(.5,0,.75,1)', fill: 'forwards' });
                }, settled);
                total = settled + rollMs;
            }
        }
    }
    setTimeout(() => xWrap.remove(), total + 50);
    return clear; // ms until the note has left its spot on the shelf
}

// ---------- Deleted books leave the shelf ----------
// A deleted book goes one of seven ways (picked at random): tipped
// forward off the ledge, toppled into its neighbours (knocking them down
// the row) before slipping down between them, pulled out and flung end
// over end, fed through a shredder, burnt down from the top like a
// match, burst into fluttering pages, or dropped through a trapdoor. Some themes have an exit of their own, picked half
// the time: Terminal glitches it out like a CRT switching off, Holo
// de-rezzes it into rainbow slices, Blueprint leaves a dashed drawing
// and rubs it out, Library stamps it WITHDRAWN, Deco gilds it and folds
// it up like a fan.
// As with sticky notes, a copy in the fx layer does the moving (inside
// x and y wrappers); a pulled-out book first settles back into its spot.
const BOOK_EXITS = ['tip', 'domino', 'fling', 'shred', 'burn', 'pages', 'trapdoor'];
const THEME_BOOK_EXITS = { terminal: 'glitch', holo: 'derez', blueprint: 'erase', library: 'withdrawn', deco: 'fan' };

function pickBookExit() {
    const own = THEME_BOOK_EXITS[document.documentElement.dataset.theme];
    if (own && Math.random() < 0.5) return own;
    return BOOK_EXITS[Math.floor(Math.random() * BOOK_EXITS.length)];
}

// a copy of a book for the fx layer, centred on its wrapper
function copyBook(el, w, h) {
    const c = el.cloneNode(true);
    c.classList.remove('leaning', 'dragging', 'dust-blowing');
    c.classList.add('tossed-book');
    c.removeAttribute('draggable');
    c.style.visibility = ''; // (the book itself is hidden while its copy leaves)
    c.style.width = w + 'px';
    c.style.height = h + 'px';
    c.style.left = -w / 2 + 'px';
    c.style.top = -h / 2 + 'px';
    return c;
}

// the part of a book inside a box (in % of the book; past 0-100 takes
// in its page tops and spine edge)
const slicePoly = (x1, y1, x2, y2) => `polygon(${x1}% ${y1}%, ${x2}% ${y1}%, ${x2}% ${y2}%, ${x1}% ${y2}%)`;
const WHOLE_BOOK = slicePoly(-12, -12, 112, 112);

function dustPuff(x, y, count, reach) {
    burstAt(x, y, count, reach, () => {
        const pf = document.createElement('span');
        pf.className = 'fx-puff';
        pf.style.width = pf.style.height = (14 + Math.random() * 16) + 'px';
        pf.style.setProperty('--puff', '#bdb5aa');
        pf.style.setProperty('--puff-dur', (0.7 + Math.random() * 0.4) + 's');
        return pf;
    });
}

function sparkleBurst(x, y, count, reach, colors) {
    burstAt(x, y, count, reach, i => {
        const sp = document.createElement('span');
        sp.className = 'fx-sparkle';
        sp.textContent = '✦';
        sp.style.fontSize = (10 + Math.random() * 10) + 'px';
        sp.style.color = colors[i % colors.length];
        return sp;
    });
}

// One function per exit. Each gets the shared setup from tossBook and
// returns { total, clear }: how long its scene runs, and how long until
// the book has left its spot on the shelf (both after the settle-back).
const BOOK_EXIT_FX = {
    tip(c) {
        const { w, cx, floor, dir, fallOff, yWrap, book, go, at, pose, ty } = c;
        // rocks back, then tips forward off the ledge toward you and drops
        book.style.transformOrigin = '50% 100%';
        go(book, [
            [0, {}, 'ease-in-out'],
            [220, { rx: 10 }, 'ease-in'],
            [560, { rx: -40, s: 1.04 }],
            [1250, { rx: -86, r: dir * 20, s: 1.14 }]
        ], 'transform', pose);
        const total = go(yWrap, [[0, 0], [480, 0, 'cubic-bezier(.45,0,1,.6)'], [1250, fallOff]], 'transform', ty);
        at(540, () => dustPuff(cx, floor, 10, w * 0.7));
        const clear = 650;
        return { total, clear };
    },

    domino(c) {
        const { el, h, floor, dir, xWrap, yWrap, book, go, at, pose, ty, clipAt } = c;
        // nudged, it tips into its neighbour - which knocks on down the
        // row - then slips down out of sight between them
        const isBook = n => n && n.classList.contains('book') && n.style.visibility !== 'hidden';
        const prev = el.previousElementSibling, next = el.nextElementSibling;
        let d = dir;
        if (isBook(prev) && !isBook(next)) d = -1;
        else if (isBook(next) && !isBook(prev)) d = 1;
        const gap = parseFloat(getComputedStyle(el.parentElement).columnGap) || 0;
        const lean = Math.max(7, Math.asin(Math.min(1, (gap + 2) / h)) * 180 / Math.PI);
        const pivot = d > 0 ? '100% 100%' : '0% 100%';
        book.style.transformOrigin = pivot;
        clipAt(floor).appendChild(xWrap);
        go(book, [
            [0, {}, 'ease-in-out'],
            [200, { r: -d * 3 }, 'ease-in'],
            [520, { r: d * lean }, 'ease-out'],
            [640, { r: d * lean * 0.55 }, 'ease-in'],
            [780, { r: d * lean }],
            [950, { r: d * lean }, 'ease-in'],
            [1500, { r: d * (lean + 8) }]
        ], 'transform', pose);
        const total = go(yWrap, [[0, 0], [950, 0, 'cubic-bezier(.5,0,.9,.5)'], [1500, h + 30]], 'transform', ty);
        let n = d > 0 ? next : prev;
        for (let k = 0; k < 4 && isBook(n); k++) {
            const target = n, amp = 5 * Math.pow(0.6, k);
            const wob = (deg, offset) => ({ transform: `rotate(${deg}deg)`, transformOrigin: pivot, offset });
            at(520 + k * 110, () => target.animate([
                wob(0, 0), wob(d * amp, 0.25), wob(-d * amp * 0.4, 0.55), wob(d * amp * 0.15, 0.8), wob(0, 1)
            ], { duration: 650, easing: 'ease-out' }));
            n = d > 0 ? n.nextElementSibling : n.previousElementSibling;
        }
        const clear = 1400;
        return { total, clear };
    },

    fling(c) {
        const { dir, away, fallOff, xWrap, yWrap, book, go, pose, tx, ty } = c;
        // pulled out toward you, a wind-up, then flung end over end off the side
        const T = 950;
        go(book, [
            [0, {}, 'ease-out'],
            [260, { s: 1.22, rx: -10 }, 'ease-in-out'],
            [380, { s: 1.25, rx: -10, r: -dir * 8 }],
            [380 + T, { s: 0.9, rx: -730, r: dir * 50 }]
        ], 'transform', pose);
        go(xWrap, [[0, 0], [260, 0, 'ease-in-out'], [380, -dir * 18], [380 + T, dir * away(dir)]], 'transform', tx);
        const total = go(yWrap, [
            [0, 0, 'ease-out'], [260, -24, 'ease-in-out'],
            [380, -16, 'cubic-bezier(.2,.7,.4,1)'],
            [380 + T * 0.35, -170, 'cubic-bezier(.5,0,.9,.6)'],
            [380 + T, fallOff]
        ], 'transform', ty);
        const clear = 500;
        return { total, clear };
    },

    shred(c) {
        const { el, w, h, cx, floor, scene, xWrap, yWrap, S, go, at, tx, ty, clipAt } = c;
        // a shredder pops up on the ledge; the book is fed down into it,
        // rattling, and comes out underneath as strips that flutter away
        const FEED0 = 350, FEED = 1500, MOUTH = 22, sw = w + 24;
        clipAt(floor).appendChild(xWrap);
        const outOfIt = clipAt(floor - 8 + MOUTH, true);
        const shredder = document.createElement('div');
        shredder.className = 'fx-shredder';
        shredder.style.left = cx - sw / 2 + 'px';
        shredder.style.top = floor - 8 + 'px';
        shredder.style.width = sw + 'px';
        scene.appendChild(shredder);
        shredder.animate([{ opacity: 0, transform: 'scaleX(0.6)' }, { opacity: 1, transform: 'none' }],
            { duration: 250, delay: S, easing: 'cubic-bezier(.2,.9,.3,1.3)', fill: 'backwards' });
        at(FEED0 + FEED + 150, () => shredder.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' }));
        const feed = [[0, { y: 0 }], [FEED0, { y: 0 }, 'linear'], [FEED0 + FEED, { y: h + 6 }]];
        go(yWrap, feed, 'transform', v => ty(v.y));
        const shake = [[0, 0], [FEED0, 0, 'steps(1, end)']];
        for (let t = FEED0 + 45; t < FEED0 + FEED; t += 45) shake.push([t, (Math.random() - 0.5) * 3, 'steps(1, end)']);
        shake.push([FEED0 + FEED, 0]);
        go(xWrap, shake, 'transform', tx);
        // the strips, lined up to carry on from where the book went in
        const strips = document.createElement('div');
        strips.className = 'toss-wrap';
        strips.style.left = cx + 'px';
        strips.style.top = -h / 2 + 'px';
        outOfIt.appendChild(strips);
        const N = Math.max(5, Math.min(14, Math.round(w / 9)));
        let last = 0;
        for (let i = 0; i < N; i++) {
            const strip = document.createElement('div');
            strip.className = 'toss-wrap';
            const piece = copyBook(el, w, h);
            piece.style.clipPath = slicePoly(i / N * 100 + 0.8, -12, (i + 1) / N * 100 - 0.8, 112);
            strip.appendChild(piece);
            strips.appendChild(strip);
            const end = FEED0 + FEED + 900 + Math.random() * 700;
            last = Math.max(last, end);
            go(strip, [...feed.slice(0, 2), [FEED0 + FEED, { y: h + 6 }, 'cubic-bezier(.4,0,.9,.6)'],
                [end, { y: h + 6 + innerHeight * 0.5, x: (Math.random() - 0.5) * 60, r: (Math.random() - 0.5) * 30 }]
            ], 'transform', v => `translate(${v.x || 0}px, ${v.y}px) rotate(${v.r || 0}deg)`);
            piece.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 700, delay: S + end - 700, fill: 'forwards' });
        }
        const total = last;
        const clear = FEED0 + FEED + 100;
        return { total, clear };
    },

    burn(c) {
        const { w, h, cx, floor, left, top, dir, scene, restWrap, book, S, go, at } = c;
        // lit at the top, it burns down like a match: the ember edge
        // creeps down with the char just ahead of it, and leaves a heap
        // of ash on the shelf that a breath of air then blows away
        const IGNITE = 400, BURN = 3200, N = 14;
        const steps = [];
        for (let k = 0; k <= N; k++) {
            // (the last edge lies flat on the bottom, nothing left)
            const jit = [];
            for (let i = 0; i <= 10; i++) jit.push(k === N ? 0 : (Math.random() - 0.5) * 8);
            steps.push([k === 0 ? 0 : IGNITE + (BURN - IGNITE) * (k / N),
                { y: k === 0 ? -12 : k === N ? 112 : -6 + 118 * (k / N), jit }, k ? 'linear' : 'ease-in']);
        }
        const edge = (v, shift) => v.jit.map((d, i) => [-12 + i * 12.4, v.y + d + shift]);
        const emberBox = document.createElement('div');
        emberBox.style.cssText = `position:absolute;left:${-w / 2}px;top:${-h / 2}px;width:${w}px;height:${h}px;`;
        const ember = document.createElement('div');
        ember.className = 'burn-ember';
        const outer = document.createElement('div');
        outer.className = 'ember-outer';
        const inner = document.createElement('div');
        inner.className = 'ember-inner';
        ember.append(outer, inner);
        emberBox.appendChild(ember);
        restWrap.insertBefore(emberBox, book);
        // (the embers are a band just above the edge, behind the book)
        const band = drop => v => polyCss([...edge(v, -drop), ...edge(v, 6).reverse()]);
        go(book, steps, 'clipPath', v => polyCss([...edge(v, 0), [112, 112], [-12, 112]]));
        go(inner, steps, 'clipPath', band(2.2));
        go(outer, steps, 'clipPath', band(4.2));
        ember.animate([{ opacity: 0 }, { opacity: 1, offset: 0.08 }, { opacity: 1, offset: 0.94 }, { opacity: 0 }],
            { duration: BURN, delay: S, fill: 'both' });
        const char = document.createElement('div');
        char.className = 'burn-char from-top';
        char.style.top = '-30%';
        book.appendChild(char);
        go(char, steps, 'top', v => `${v.y}%`);
        const pw = Math.min(w * 0.9, 90) + 20;
        const pile = document.createElement('div');
        pile.className = 'fx-ash-pile';
        pile.style.left = cx - pw / 2 + 'px';
        pile.style.top = floor - 12 + 'px';
        pile.style.width = pw + 'px';
        scene.insertBefore(pile, scene.firstChild);
        pile.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }],
            { duration: BURN - IGNITE, delay: S + IGNITE, fill: 'both' });
        // smoke off the ember edge, an occasional spark, falling ash
        const start = performance.now() + S;
        let tick = 0;
        const sparks = setInterval(() => {
            const t = performance.now() - start;
            if (!scene.isConnected || t > BURN) return clearInterval(sparks);
            if (t < IGNITE * 0.6) return;
            const k = Math.min(1, Math.max(0, (t - IGNITE) / (BURN - IGNITE)));
            const y = Math.min(floor, top + h * Math.max(0, (-6 + 120 * k) / 100));
            const x = () => left + w * (0.08 + Math.random() * 0.84);
            flyBit('fx-smoke', x(), y - 6, (Math.random() - 0.5) * 24, -60 - Math.random() * 50, 1.3 + Math.random() * 0.6);
            if (tick % 3 === 0) flyBit('fx-ash', x(), y, (Math.random() - 0.5) * 20, Math.max(10, floor - y) * Math.random(), 1 + Math.random() * 0.5);
            if (tick % 5 === 0) flyBit('fx-ember', x(), y, (Math.random() - 0.5) * 24, -30 - Math.random() * 40, 0.6 + Math.random() * 0.4);
            tick++;
        }, 110);
        at(BURN + 250, () => {
            pile.animate([{ opacity: 1 }, { opacity: 0, transform: `translateX(${dir * 16}px) scaleY(0.2)` }],
                { duration: 500, fill: 'forwards' });
            for (let i = 0; i < 24; i++) {
                flyBit('fx-ash', cx + (Math.random() - 0.5) * pw * 0.8, floor - Math.random() * 10,
                    dir * (50 + Math.random() * 130), -(10 + Math.random() * 50), 0.8 + Math.random() * 0.6);
            }
        });
        const clear = BURN + 600;
        const total = BURN + 1300;
        return { total, clear };
    },

    pages(c) {
        const { el, w, h, cx, restCy, dir, scene, book, S, go, at, pose } = c;
        // the cover swings open and the pages burst out, flapping away
        // like a flock of birds
        book.style.transformOrigin = '0% 50%';
        go(book, [[0, {}, 'ease-in-out'], [180, { s: 1.04, r: -dir * 2 }, 'ease-in'], [560, { ry: -80, s: 1.08 }]], 'transform', pose);
        book.animate([{ opacity: 1 }, { opacity: 1, offset: 0.5 }, { opacity: 0 }], { duration: 560, delay: S, fill: 'forwards' });
        // real-size pages, a touch smaller than the cover (a spine is
        // only the book's edge, so size those from its height)
        const pw = (el.classList.contains('spine-mode') ? h * 2 / 3 : w) * 0.92, ph = h * 0.95;
        const COUNT = 10;
        at(260, () => {
            for (let i = 0; i < COUNT; i++) {
                const wrap = document.createElement('div');
                wrap.className = 'toss-wrap';
                wrap.style.left = cx + (Math.random() - 0.5) * w * 0.3 + 'px';
                wrap.style.top = restCy + (Math.random() - 0.5) * h * 0.15 + 'px';
                const page = document.createElement('div');
                page.className = 'fx-page';
                page.style.width = pw + 'px';
                page.style.height = ph + 'px';
                page.style.left = -pw / 2 + 'px';
                page.style.top = -ph / 2 + 'px';
                page.style.animationDuration = (0.28 + Math.random() * 0.16) + 's';
                page.style.animationDelay = -Math.random() + 's';
                wrap.appendChild(page);
                scene.appendChild(wrap);
                const ex = (Math.random() - 0.5) * Math.min(innerWidth, 900) * 0.9, ey = -(160 + Math.random() * 320);
                const mx = ex * 0.35 + (Math.random() - 0.5) * 120, my = ey * 0.4 + (Math.random() - 0.5) * 50;
                const spin = (Math.random() - 0.5) * 60;
                wrap.animate([
                    { transform: 'translate(0, 0) rotate(0deg) scale(0.95)', opacity: 1 },
                    { transform: `translate(${mx}px, ${my}px) rotate(${spin}deg) scale(1)`, opacity: 1, offset: 0.4 },
                    { transform: `translate(${ex}px, ${ey}px) rotate(${-spin}deg) scale(0.9)`, opacity: 0 }
                ], { duration: 1500 + Math.random() * 900, delay: i * 50, easing: 'cubic-bezier(.25,.6,.45,1)', fill: 'both' });
            }
        });
        const total = 260 + 50 * COUNT + 2400;
        const clear = 600;
        return { total, clear };
    },

    trapdoor(c) {
        const { w, h, cx, floor, scene, xWrap, yWrap, book, S, go, at, pose, ty, clipAt } = c;
        // a trapdoor opens under it: it hangs in the air a beat (the
        // cartoon look down), then drops straight through
        const hw = w + 18;
        const hole = document.createElement('div');
        hole.className = 'fx-hole';
        hole.style.left = cx - hw / 2 + 'px';
        hole.style.top = floor - 8 + 'px';
        hole.style.width = hw + 'px';
        scene.insertBefore(hole, scene.firstChild);
        clipAt(floor).appendChild(xWrap);
        hole.animate([
            { transform: 'scaleX(0)' }, { transform: 'scaleX(1)', offset: 0.2 },
            { transform: 'scaleX(1)', offset: 0.82 }, { transform: 'scaleX(0)' }
        ], { duration: 1250, delay: S + 120, easing: 'ease-in-out', fill: 'both' });
        go(book, [[0, {}], [300, {}, 'ease-out'], [430, { sx: 0.97, sy: 1.04 }], [580, {}, 'ease-in'], [900, { r: (Math.random() - 0.5) * 10 }]],
            'transform', pose);
        go(yWrap, [[0, 0], [300, 0, 'ease-out'], [430, -12], [580, -12, 'cubic-bezier(.6,0,1,.6)'], [900, h + 24]], 'transform', ty);
        at(880, () => dustPuff(cx, floor, 8, w * 0.5));
        const total = 120 + 1250;
        const clear = 950;
        return { total, clear };
    },

    glitch(c) {
        const { floor, left, top, title, scene, xWrap, book, S, go, at, pose, tx, asIs } = c;
        // glitches - jumping, splitting into red/green ghosts, torn into
        // bands - then switches off like an old CRT: a line, a dot,
        // gone. The rm command types itself out above it meanwhile.
        const STEP = 55, G = 12, OFF = G * STEP;
        const split = 'drop-shadow(-4px 0 0 rgba(255, 40, 120, 0.75)) drop-shadow(4px 0 0 rgba(40, 255, 140, 0.75))';
        const clean = 'drop-shadow(0 0 0 transparent) drop-shadow(0 0 0 transparent)';
        const jx = [[0, 0, 'steps(1, end)']], cut = [[0, WHOLE_BOOK, 'steps(1, end)']], fl = [[0, clean, 'steps(1, end)']];
        for (let k = 1; k <= G; k++) {
            const t = k * STEP, end = k === G, a = Math.random() * 50;
            jx.push([t, end || Math.random() < 0.35 ? 0 : (Math.random() - 0.5) * 18, 'steps(1, end)']);
            cut.push([t, end || Math.random() < 0.5 ? WHOLE_BOOK : slicePoly(-12, a, 112, a + 30 + Math.random() * 50), 'steps(1, end)']);
            fl.push([t, !end && Math.random() < 0.6 ? split : clean, 'steps(1, end)']);
        }
        fl.push([OFF + 180, 'brightness(2.4) drop-shadow(0 0 8px #39ff6a)']);
        go(xWrap, jx, 'transform', tx);
        go(book, cut, 'clipPath', asIs);
        go(book, fl, 'filter', asIs);
        go(book, [[0, {}], [OFF, {}, 'ease-in'], [OFF + 180, { sx: 1.08, sy: 0.02 }, 'ease-in'], [OFF + 380, { sx: 0.03, sy: 0.02 }]], 'transform', pose);
        book.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, delay: S + OFF + 380, fill: 'forwards' });
        const cmd = `> rm "${title.length > 22 ? title.slice(0, 21) + '…' : title}"`;
        const term = document.createElement('div');
        term.className = 'fx-term-line';
        const typed = document.createElement('span');
        const cursor = document.createElement('span');
        cursor.className = 'cursor';
        term.append(typed, cursor);
        term.style.left = Math.max(12, Math.min(innerWidth - 280, left)) + 'px';
        term.style.top = (top - 52 > 8 ? top - 52 : floor + 14) + 'px'; // (two lines, above the book)
        scene.appendChild(term);
        let i = 0;
        const typing = setInterval(() => {
            if (!scene.isConnected || i >= cmd.length) return clearInterval(typing);
            typed.textContent = cmd.slice(0, ++i);
        }, 22);
        at(OFF + 420, () => { typed.textContent = cmd + '\ndeleted.'; });
        at(OFF + 1000, () => term.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' }));
        const total = OFF + 1350;
        const clear = OFF + 400;
        return { total, clear };
    },

    derez(c) {
        const { el, w, h, cx, restCy, left, top, dir, scene, book, S, go, at } = c;
        // a rainbow scanline passes over it, it shivers into glitchy
        // holographic slices, and the slices blink out top to bottom
        const N = 9, SHIVER = 520, STAGGER = 55;
        const slices = [];
        for (let i = 0; i < N; i++) {
            const s = copyBook(el, w, h);
            s.style.clipPath = slicePoly(-12, i === 0 ? -12 : i / N * 100, 112, i === N - 1 ? 112 : (i + 1) / N * 100);
            slices.push(s);
        }
        at(0, () => book.replaceWith(...slices));
        slices.forEach((s, i) => {
            const out = SHIVER + i * STAGGER;
            const shiver = [[0, { x: 0 }, 'steps(1, end)']];
            for (let t = 70; t < out; t += 70) shiver.push([t, { x: Math.random() < 0.4 ? 0 : (Math.random() - 0.5) * 16 }, 'steps(1, end)']);
            shiver.push([out, { x: 0 }, 'ease-in'], [out + 260, { x: dir * 30, sx: 0 }]);
            go(s, shiver, 'transform', v => `translateX(${v.x}px) scaleX(${v.sx ?? 1})`);
            s.animate([
                { filter: 'hue-rotate(0deg) saturate(1) brightness(1)' },
                { filter: 'hue-rotate(180deg) saturate(1.8) brightness(1.15)', offset: 0.5 },
                { filter: 'hue-rotate(360deg) saturate(2) brightness(1.6)' }
            ], { duration: out + 260, delay: S, fill: 'forwards' });
            s.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, delay: S + out + 60, fill: 'forwards' });
        });
        const scan = document.createElement('div');
        scan.className = 'fx-holo-scan';
        scan.style.left = left - 10 + 'px';
        scan.style.width = w + 20 + 'px';
        scan.style.top = top + 'px';
        scene.appendChild(scan);
        scan.animate([
            { transform: 'translateY(0)', opacity: 0 }, { opacity: 1, offset: 0.15 },
            { opacity: 1, offset: 0.85 }, { transform: `translateY(${h}px)`, opacity: 0 }
        ], { duration: 480, delay: S, easing: 'ease-in-out', fill: 'both' });
        at(SHIVER + N * STAGGER / 2, () => sparkleBurst(cx, restCy, 12, Math.max(w, 60), ['#ff8fdc', '#b29bff', '#7ad9ff', '#7dffc6', '#ffe388']));
        const total = SHIVER + N * STAGGER + 1300;
        const clear = SHIVER + N * STAGGER;
        return { total, clear };
    },

    erase(c) {
        const { id, w, h, cx, floor, left, top, dir, scene, book, S, go, at } = c;
        // it fades back to a dashed drawing on the blueprint (its width
        // dimensioned underneath), and an eraser rubs it out row by row
        const FADE = 650, RUB = 1200, STROKES = 8;
        book.animate([
            { filter: 'grayscale(0) brightness(1)', opacity: 1 },
            { filter: 'grayscale(1) brightness(1.6)', opacity: 0 }
        ], { duration: FADE, delay: S, fill: 'forwards' });
        const outline = document.createElement('div');
        outline.className = 'fx-outline';
        outline.style.left = left + 'px';
        outline.style.top = top + 'px';
        outline.style.width = w + 'px';
        outline.style.height = h + 'px';
        const dim = document.createElement('div');
        dim.className = 'fx-dim';
        const label = document.createElement('span');
        label.textContent = (library.find(b => b.id === id) || {}).width || Math.round(w);
        dim.appendChild(label);
        outline.appendChild(dim);
        scene.appendChild(outline);
        outline.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE * 0.7, delay: S + FADE * 0.3, fill: 'both' });
        go(outline, [[0, -12], [FADE, -12, 'linear'], [FADE + RUB, h + 36]], 'clipPath', y => `inset(${y}px -24px -40px -24px)`);
        const eraser = document.createElement('div');
        eraser.className = 'fx-eraser';
        scene.appendChild(eraser);
        const path = [[0, [left + w + 50, top - 50]], [FADE, [left + w, top - 6], 'ease-in-out']];
        for (let k = 1; k <= STROKES; k++) {
            path.push([FADE + RUB * k / STROKES, [k % 2 ? left : left + w, top - 6 + (h + 40) * k / STROKES], 'ease-in-out']);
        }
        path.push([FADE + RUB + 350, [cx + dir * 120, floor + 80]]);
        go(eraser, path, 'transform', ([x, y]) => `translate(${x}px, ${y}px) rotate(-25deg)`);
        eraser.animate([{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.88 }, { opacity: 0 }],
            { duration: FADE + RUB + 350, delay: S, fill: 'both' });
        at(FADE, () => {
            const crumbs = setInterval(() => {
                if (!scene.isConnected) return clearInterval(crumbs);
                const er = eraser.getBoundingClientRect();
                flyBit('fx-crumb', er.left + er.width / 2, er.bottom, (Math.random() - 0.5) * 40, 30 + Math.random() * 60, 0.6 + Math.random() * 0.4);
            }, 70);
            setTimeout(() => clearInterval(crumbs), RUB);
        });
        const total = FADE + RUB + 400;
        const clear = FADE + RUB;
        return { total, clear };
    },

    withdrawn(c) {
        const { w, h, dir, away, xWrap, yWrap, book, S, go, pose, tx, ty } = c;
        // stamped WITHDRAWN (the book gives a little under the stamp),
        // then slid up off the shelf and away
        const stamp = document.createElement('div');
        stamp.className = 'fx-stamp';
        stamp.textContent = 'WITHDRAWN';
        const narrow = w < 60;
        stamp.style.setProperty('--stamp-size', Math.max(7, narrow ? Math.min(h / 11, 15) : Math.min(w / 7.5, 18)) + 'px');
        const turn = (narrow ? -90 : -14) + (Math.random() - 0.5) * 8;
        book.appendChild(stamp);
        const st = (s, opacity, offset) => ({ transform: `translate(-50%, -50%) rotate(${turn}deg) scale(${s})`, opacity, offset });
        stamp.animate([st(2.4, 0, 0), st(0.94, 0.9, 0.7), st(1, 0.88, 1)], { duration: 260, delay: S + 150, easing: 'ease-in', fill: 'both' });
        go(book, [[0, {}], [380, {}, 'ease-out'], [440, { sx: 1.03, sy: 0.96 }, 'ease-out'], [560, {}]], 'transform', pose);
        go(yWrap, [[0, 0], [1000, 0, 'ease-in-out'], [1250, -26]], 'transform', ty);
        const total = go(xWrap, [[0, 0], [1150, 0, 'cubic-bezier(.5,0,.9,.5)'], [1800, dir * away(dir)]], 'transform', tx);
        const clear = 1250;
        return { total, clear };
    },

    fan(c) {
        const { el, w, h, cx, floor, yWrap, book, S, go, at, pose, ty } = c;
        // a sweep of gold leaf, then it opens out like a fan, snaps shut
        // into a thin gilt stick and sinks away in a glint
        const SHINE = 650, N = 7, SPREAD = 10;
        const sweep = document.createElement('div');
        sweep.className = 'fx-gold-sweep';
        book.appendChild(sweep);
        sweep.animate([{ backgroundPosition: '100% 0' }, { backgroundPosition: '0% 0' }],
            { duration: SHINE, delay: S, easing: 'ease-in-out', fill: 'both' });
        const ribs = [];
        for (let i = 0; i < N; i++) {
            const s = copyBook(el, w, h);
            s.style.clipPath = slicePoly(i === 0 ? -12 : i / N * 100, -12, i === N - 1 ? 112 : (i + 1) / N * 100, 112);
            s.style.transformOrigin = '50% 100%';
            ribs.push(s);
        }
        at(SHINE, () => book.replaceWith(...ribs));
        ribs.forEach((s, i) => {
            const a = (i - (N - 1) / 2) * SPREAD;
            go(s, [
                [0, {}], [SHINE, {}, 'cubic-bezier(.2,.9,.3,1.2)'],
                [SHINE + 380, { r: a }], [SHINE + 560, { r: a }, 'cubic-bezier(.6,0,.3,1)'],
                [SHINE + 900, { r: 0, sx: 0.12 }]
            ], 'transform', pose);
            s.animate([{ filter: 'none' }, { filter: 'sepia(0.6) saturate(1.6) brightness(1.1)' }],
                { duration: 400, delay: S + SHINE, fill: 'forwards' });
        });
        go(yWrap, [[0, 0], [SHINE + 950, 0, 'ease-in'], [SHINE + 1350, 40]], 'transform', ty);
        yWrap.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, delay: S + SHINE + 950, fill: 'forwards' });
        at(SHINE + 920, () => sparkleBurst(cx, floor - h * 0.6, 10, 50, ['#e8c66a', '#f6e3a1', '#c9a14a']));
        const total = SHINE + 1400;
        const clear = SHINE + 1000;
        return { total, clear };
    },
};

function tossBook(id, exit = pickBookExit()) {
    const el = document.querySelector(`#library-room .book[data-id="${CSS.escape(id)}"]`);
    if (!el || el.classList.contains('sticky-book')) return;
    const r = el.getBoundingClientRect();
    if (!r.width || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return;
    const cs = getComputedStyle(el);
    const m = new DOMMatrix(cs.transform);
    const tilt = Math.atan2(m.b, m.a) * 180 / Math.PI + (parseFloat(cs.rotate) || 0);
    const lift = Math.hypot(m.a, m.b); // pulled out, it's a little bigger
    const w = el.offsetWidth, h = el.offsetHeight;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    // where it stands on the shelf (its layout box, not the pulled-out pose)
    const op = el.offsetParent;
    const opTop = !op || op === document.body ? -scrollY : op.getBoundingClientRect().top + op.clientTop - op.scrollTop;
    let floor = opTop + el.offsetTop + h;
    if (!Number.isFinite(floor) || Math.abs(floor - r.bottom) > h) floor = r.bottom;
    const restCy = floor - h / 2;
    const left = cx - w / 2, top = floor - h;
    const dir = Math.random() < 0.5 ? -1 : 1;
    const away = d => (d > 0 ? innerWidth - cx : cx) + Math.max(w, h) + 40;
    const fallOff = innerHeight - restCy + h;
    const title = (library.find(b => b.id === id) || {}).title || 'book';

    // everything for this exit lives in one scene in the fx layer
    const scene = document.createElement('div');
    const xWrap = document.createElement('div');
    const yWrap = document.createElement('div');
    const restWrap = document.createElement('div');
    scene.className = xWrap.className = yWrap.className = restWrap.className = 'toss-wrap';
    xWrap.style.left = cx + 'px';
    xWrap.style.top = restCy + 'px';
    const book = copyBook(el, w, h);
    book.dataset.exit = exit;
    restWrap.appendChild(book);
    yWrap.appendChild(restWrap);
    xWrap.appendChild(yWrap);
    scene.appendChild(xWrap);
    getFxLayer().appendChild(scene);
    el.style.visibility = 'hidden';

    // a pulled-out book slides back into its spot first; everything
    // below starts S ms in
    const S = (Math.abs(cy - restCy) > 1 || Math.abs(tilt) > 0.5 || Math.abs(lift - 1) > 0.01) ? 200 : 0;
    if (S) restWrap.animate([
        { transform: `translateY(${cy - restCy}px) rotate(${tilt}deg) scale(${lift})` },
        { transform: 'none' }
    ], { duration: S, easing: 'ease-in', fill: 'forwards' });
    const go = (target, steps, prop, fmt) => play(target, steps, prop, fmt, S);
    const at = (ms, fn) => setTimeout(() => { if (scene.isConnected) fn(); }, S + ms);
    const pose = p => `perspective(900px) rotateX(${p.rx || 0}deg) rotateY(${p.ry || 0}deg) rotate(${p.r || 0}deg) scale(${p.sx ?? p.s ?? 1}, ${p.sy ?? p.s ?? 1})`;
    const tx = v => `translateX(${v}px)`;
    const ty = v => `translateY(${v}px)`;
    const asIs = v => v;
    // a box cutting things off above (or below) a line across the screen
    const clipAt = (y, below) => {
        const c = document.createElement('div');
        c.className = 'fx-clip';
        c.style.top = (below ? y : 0) + 'px';
        c.style.height = (below ? innerHeight - y + 100 : y) + 'px';
        scene.appendChild(c);
        return c;
    };
    const fx = BOOK_EXIT_FX[exit];
    const { total = 0, clear = 0 } = fx ? fx({ id, el, w, h, cx, cy, floor, restCy, left, top, dir, away, fallOff, title,
        scene, xWrap, yWrap, restWrap, book, S, go, at, pose, tx, ty, asIs, clipAt }) : {};
    setTimeout(() => scene.remove(), S + total + 80);
    return S + clear; // ms until the book has left its spot on the shelf
}
