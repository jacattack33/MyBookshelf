// ---------- Pin board (achievements) ----------
// Enamel pins you earn by reading, stuck on a little corkboard in the
// bottom-left stack (under the stats ledger). Once earned a pin stays, even
// if the books that earned it go. Only Candy, Sea Glass, Loft, Blueprint and
// Sunset show the board for now (and Settings can switch it off); pins are still earned in
// every theme.

const PINS_KEY = 'bookShelfPins';
// id -> when earned; ids already looked at; things counted as they happen
// (sticky notes stuck up, lent books back); every book ever lent out, and
// everyone it went to
let pinState = { earned: {}, seen: {}, counts: {}, lentIds: [], lentTo: [] };
let pinsReady = false;                    // checks wait until the critter's loaded
let pinUid = 0;                           // keeps gradient ids unique across SVG copies
let selectedPin = null;

// ----- Pin art -----
// Every pin is drawn in a 48x48 box as a list of parts, bottom to top:
//   ['e', d, colour]           enamel, with a metal border round it
//   ['e', d, colour, 'evenodd'] ...with a hole in it
//   ['e', d, colour, rule, width] ...with a thinner border than usual (1.8)
//   ['d', d, colour]           a bare enamel dot (eyes, cheeks), no border
//   ['l', d]                   a raised metal line
//   ['l', d, width]            ...thinner or thicker than usual (1)
//   ['m', d]                   a solid metal piece
//   ['t', x, y, size, text]    raised metal lettering
// The metal is a hard-banded gradient (polished metal reflects in sharp
// light and dark bands; soft blends are what make it look like wax).
const PIN_METALS = {
    gold: [[0, '#5c3a02'], [0.1, '#a8740f'], [0.2, '#f3d27a'], [0.26, '#fffbe6'], [0.33, '#e0b23e'], [0.46, '#7d5207'],
        [0.56, '#c7932a'], [0.64, '#fbe7a6'], [0.7, '#fffdf0'], [0.77, '#d8a63a'], [0.9, '#8a5c08'], [1, '#4e3102']],
    silver: [[0, '#3f454e'], [0.1, '#7f8792'], [0.2, '#d6dbe1'], [0.26, '#ffffff'], [0.33, '#c4cad2'], [0.46, '#666e79'],
        [0.56, '#a9b0ba'], [0.64, '#eef1f4'], [0.7, '#ffffff'], [0.77, '#b9c0c9'], [0.9, '#6a727d'], [1, '#353a42']]
};

// Candy's colours; each theme with a board can swap them (--pe-* in pins.css)
const PIN_ENAMEL = {
    pink: 'var(--pe-pink, #ff8cc3)', hot: 'var(--pe-hot, #ff4fa3)', lav: 'var(--pe-lav, #c9a6ff)',
    mint: 'var(--pe-mint, #7ee8c4)', teal: 'var(--pe-teal, #2fbf8f)', yellow: 'var(--pe-yellow, #ffe066)', sky: 'var(--pe-sky, #8fd3ff)',
    peach: 'var(--pe-peach, #ffb48c)', cream: 'var(--pe-cream, #fffaf2)', ink: 'var(--pe-ink, #4a2378)',
    // food that has to stay red-ish: the theme's hot colour, unless that's
    // something no pepperoni should be (Sea Glass's is teal)
    red: 'var(--pe-red, var(--pe-hot, #ff4fa3))'
};

const pinCircle = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;

function starPath(cx, cy, outer, inner, points = 5) {
    let d = '';
    for (let i = 0; i < points * 2; i++) {
        const r = i % 2 ? inner : outer;
        const a = Math.PI / points * i - Math.PI / 2;
        d += `${i ? 'L' : 'M'}${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
    }
    return d + 'Z';
}

// a gear: flat-topped teeth round a circle
function gearPath(cx, cy, outer, inner, teeth) {
    const pt = (r, a) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
    const step = Math.PI * 2 / teeth, tip = step * 0.17, base = step * 0.27;
    let d = '';
    for (let i = 0; i < teeth; i++) {
        const a = step * i - Math.PI / 2;
        d += (i ? `A${inner} ${inner} 0 0 1 ` : 'M') + pt(inner, a - base) +
            `L${pt(outer, a - tip)}A${outer} ${outer} 0 0 1 ${pt(outer, a + tip)}L${pt(inner, a + base)}`;
    }
    return d + `A${inner} ${inner} 0 0 1 ${pt(inner, -Math.PI / 2 - base)}Z`;
}

// a circle with a wavy edge (a donut's icing)
function pinWavy(cx, cy, r, amp, waves) {
    let d = '';
    for (let i = 0; i < 96; i++) {
        const a = Math.PI * 2 * i / 96, rr = r + amp * Math.sin(a * waves);
        d += `${i ? 'L' : 'M'}${(cx + rr * Math.cos(a)).toFixed(2)} ${(cy + rr * Math.sin(a)).toFixed(2)}`;
    }
    return d + 'Z';
}

// a sprinkle: a little bar at (x, y), turned `deg`
function pinSprinkle(x, y, deg) {
    const a = deg * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a);
    const f = n => n.toFixed(2);
    const p = (s, t) => `${f(x + dx * s - dy * t)} ${f(y + dy * s + dx * t)}`;
    return `M${p(-1.4, -0.5)}L${p(1.4, -0.5)}L${p(1.4, 0.5)}L${p(-1.4, 0.5)}Z`;
}

// a puffy cloud sitting on (cx, cy), s times the usual 12 across
const pinCloud = (cx, cy, s = 1) => {
    const p = (x, y) => `${cx + x * s} ${cy + y * s}`;
    return `M${p(-6, 0)}A${2.6 * s} ${2.6 * s} 0 0 1 ${p(-4, -4.2)}A${4.2 * s} ${4.2 * s} 0 0 1 ${p(4, -4.2)}` +
        `A${2.6 * s} ${2.6 * s} 0 0 1 ${p(6, 0)}Z`;
};

// a macaron whose filling's at height y: shell, shell, then the filling
// laid over the inside half of their flat edges, so the gold lines either
// side of it are thin
const pinMacaron = (x, y, colour) => [
    ['e', `M${x - 15} ${y + 0.9}Q${x - 15} ${y - 5} ${x} ${y - 5}Q${x + 15} ${y - 5} ${x + 15} ${y + 0.9}Z`, colour],
    ['e', `M${x - 15} ${y + 2.5}H${x + 15}Q${x + 15} ${y + 7} ${x} ${y + 7}Q${x - 15} ${y + 7} ${x - 15} ${y + 2.5}Z`, colour],
    ['d', `M${x - 13.5} ${y + 0.9}H${x + 13.5}V${y + 2.5}H${x - 13.5}Z`, PIN_ENAMEL.cream]
];

// a heart centred on (cx, cy), r across
function pinHeart(cx, cy, r) {
    const f = n => n.toFixed(2);
    return `M${f(cx)} ${f(cy + r * 0.9)}C${f(cx - r * 1.35)} ${f(cy + r * 0.05)} ${f(cx - r * 1.05)} ${f(cy - r * 1.05)} ${f(cx)} ${f(cy - r * 0.42)}` +
        `C${f(cx + r * 1.05)} ${f(cy - r * 1.05)} ${f(cx + r * 1.35)} ${f(cy + r * 0.05)} ${f(cx)} ${f(cy + r * 0.9)}Z`;
}

// a lollipop's swirl: a stripe w wide winding out from (cx, cy) to the
// edge at r, with a gap as wide as itself between the turns
function pinSpiral(cx, cy, r, w) {
    const f = n => n.toFixed(2);
    const pitch = w * 2, end = (r - w) / pitch * Math.PI * 2, steps = 120;
    const at = (rr, a) => `${f(cx + rr * Math.cos(a))} ${f(cy + rr * Math.sin(a))}`;
    const out = [], back = [];
    for (let i = 0; i <= steps; i++) {
        const a = end * i / steps, rr = pitch * a / (Math.PI * 2);
        out.push(at(rr + w, a));
        back.unshift(at(rr, a));
    }
    return `M${out.join('L')}L${back.join('L')}Z`;
}

const PIN_HEART = 'M24 31.5C19 28 16.5 25.5 16.5 22.5C16.5 20 18.3 18.3 20.4 18.3C22 18.3 23.3 19.2 24 20.6C24.7 19.2 26 18.3 27.6 18.3C29.7 18.3 31.5 20 31.5 22.5C31.5 25.5 29 28 24 31.5Z';

// ----- What there is to earn -----
// progress() gives [have, need]; a pin is earned once have >= need.
// `event` pins are only ever handed out by awardPin.
const PIN_E = PIN_ENAMEL;
const PINS = [
    {
        id: 'first', name: 'First Chapter', desc: 'Finish your first book.', metal: 'silver', glint: [9, 12],
        progress: s => [s.readCount, 1],
        art: [
            ['e', 'M24 14C19 10.5 12 10.5 7 12.5V36C12 34 19 34 24 37.5Z', PIN_E.cream],
            ['e', 'M24 14C29 10.5 36 10.5 41 12.5V36C36 34 29 34 24 37.5Z', PIN_E.cream],
            ['e', 'M31 11.6V24l2.5-2.2L36 24V11.4Z', PIN_E.pink],
            ['l', 'M10.5 18c3.5-1 7-1 10.5 0'], ['l', 'M10.5 23c3.5-1 7-1 10.5 0'], ['l', 'M10.5 28c3.5-1 7-1 10.5 0'],
            ['l', 'M27 29c3.5-1 7-1 10.5 0']
        ]
    },
    {
        id: 'owned', name: 'Mine!', desc: 'Add your first book you own.', metal: 'gold', glint: [9, 19], rotate: -30,
        progress: s => [Math.min(s.owned, 1), 1],
        art: [
            // a key: a gold shaft, a heart in its bow
            ['m', 'M20 22H42V31H37V26H20Z'],
            ['e', pinCircle(13, 24, 9.5), PIN_E.pink],
            ['e', pinHeart(13, 24.6, 4.6), PIN_E.cream]
        ]
    },
    {
        id: 'hatched', name: 'Hatched!', desc: 'Hatch your reading critter (feed it some pages).', metal: 'gold', glint: [16, 13],
        progress: s => [s.hatched ? 1 : 0, 1],
        art: [
            ['e', pinCircle(24, 19, 9.5), PIN_E.yellow],
            ['d', pinCircle(20.8, 17.5, 1.3), PIN_E.ink], ['d', pinCircle(27.2, 17.5, 1.3), PIN_E.ink],
            ['d', 'M22.3 20.8h3.4L24 23.2Z', PIN_E.peach],
            ['e', 'M10 26L14.5 22.5L19 26.5L24 22L29 26.5L33.5 22.5L38 26C38 36 32 42.5 24 42.5C16 42.5 10 36 10 26Z', PIN_E.cream],
            ['d', pinCircle(17, 33, 1.6), PIN_E.pink], ['d', pinCircle(29, 36, 1.4), PIN_E.mint], ['d', pinCircle(31, 30.5, 1.1), PIN_E.sky]
        ]
    },
    {
        id: 'newlook', name: 'New Look', desc: 'Try another theme (Settings > Theme).', metal: 'gold', glint: [14, 12],
        progress: s => [s.otherTheme ? 1 : 0, 1],
        art: [
            ['e', 'M24 8C35 8 42 14.5 42 22C42 27.5 38 29.5 34 28.8C30.5 28.2 28.5 30.5 29.5 33.5C30.5 36.8 28 40.5 22.5 40.5C13 40.5 6 33.5 6 24C6 15 14 8 24 8Z' +
                pinCircle(20.5, 33, 2.9), PIN_E.cream, 'evenodd'],
            ['e', pinCircle(14, 21, 3.4), PIN_E.pink], ['e', pinCircle(22.5, 15, 3.4), PIN_E.mint],
            ['e', pinCircle(32, 17, 3.2), PIN_E.sky], ['e', pinCircle(11.5, 29.5, 2.8), PIN_E.yellow]
        ]
    },
    {
        id: 'tinker', name: 'Tinkerer', desc: 'Change some shelf settings (Settings > Shelf extras).', metal: 'silver', glint: [13, 12],
        progress: s => [s.tinkered ? 1 : 0, 1],
        art: [
            ['e', gearPath(24, 24, 18, 13.5, 8) + pinCircle(24, 24, 5.5), PIN_E.lav, 'evenodd'],
            ['l', pinCircle(24, 24, 9.5)]
        ]
    },
    {
        id: 'bookworm', name: 'Bookworm', desc: 'Read 10 books.', metal: 'gold', glint: [24, 14],
        progress: s => [s.readCount, 10],
        art: [
            ['e', pinCircle(11, 35, 6), PIN_E.mint], ['e', pinCircle(20, 30.5, 7), PIN_E.mint], ['e', pinCircle(31, 21, 9.5), PIN_E.mint],
            ['l', 'M27.5 12.2L25.5 7.5'], ['l', 'M34.5 12.2L36.5 7.5'], ['m', pinCircle(25.3, 7, 1.7)], ['m', pinCircle(36.7, 7, 1.7)],
            ['d', pinCircle(26.2, 25.6, 1.4), PIN_E.pink], ['d', pinCircle(37, 25.6, 1.4), PIN_E.pink],
            ['d', pinCircle(27.7, 20.8, 1.2), PIN_E.ink], ['d', pinCircle(34.5, 20.8, 1.2), PIN_E.ink],
            ['l', pinCircle(27.7, 20.5, 3)], ['l', pinCircle(34.5, 20.5, 3)], ['l', 'M30.7 20.3h0.8'], ['l', 'M29 26q2.5 2 5 0']
        ]
    },
    {
        id: 'shelf', name: 'Full Shelf', desc: 'Read 50 books.', metal: 'gold', glint: [10, 14],
        progress: s => [s.readCount, 50],
        art: [
            ['e', 'M7 31h33v8H7Z', PIN_E.lav], ['e', 'M11 23h29v8H11Z', PIN_E.pink], ['e', 'M9 15h28v8H9Z', PIN_E.mint],
            ['l', 'M11 31v8'], ['l', 'M36 31v8'], ['l', 'M15 23v8'], ['l', 'M36 23v8'], ['l', 'M13 15v8'], ['l', 'M33 15v8']
        ]
    },
    {
        id: 'century', name: 'Century', desc: 'Read 100 books.', metal: 'gold', glint: [16, 25],
        progress: s => [s.readCount, 100],
        art: [
            // a chubby crown with soft dips, pearl tips and a heart gem
            ['e', 'M8.5 32L7.5 15Q14 23 18 18.5Q21 15 24 10Q27 15 30 18.5Q34 23 40.5 15L39.5 32Z', PIN_E.yellow],
            ['e', pinCircle(7.5, 13.5, 3), PIN_E.mint], ['e', pinCircle(24, 8.5, 3.4), PIN_E.hot], ['e', pinCircle(40.5, 13.5, 3), PIN_E.sky],
            ['e', pinHeart(24, 24, 4.6), PIN_E.hot, null, 1.2],
            ['e', 'M9.5 31H38.5Q41.5 31 41.5 34V38Q41.5 41 38.5 41H9.5Q6.5 41 6.5 38V34Q6.5 31 9.5 31Z', PIN_E.pink],
            ['t', 24, 39.2, 9, '100']
        ]
    },
    {
        id: 'fivestar', name: 'Five Stars', desc: 'Give a book 5 stars.', metal: 'gold', glint: [24, 8],
        progress: s => [s.fiveStars ? 1 : 0, 1],
        art: [
            ['e', starPath(24, 25.5, 18.5, 8.2), PIN_E.yellow],
            ['d', pinCircle(18.6, 28.8, 1.4), PIN_E.pink], ['d', pinCircle(29.4, 28.8, 1.4), PIN_E.pink],
            ['d', pinCircle(20.6, 25.4, 1.4), PIN_E.ink], ['d', pinCircle(27.4, 25.4, 1.4), PIN_E.ink], ['l', 'M21.8 29.2q2.2 1.8 4.4 0']
        ]
    },
    {
        id: 'sundae', name: 'Sundae Best', desc: 'Give 10 books 5 stars.', metal: 'gold', glint: [12, 26],
        progress: s => [Math.min(s.fiveStarCount, 10), 10],
        art: [
            ['l', 'M24 9Q25 5.5 28.5 4.5'],
            ['e', pinCircle(17, 21, 6.5), PIN_E.pink], ['e', pinCircle(31, 21, 6.5), PIN_E.mint], ['e', pinCircle(24, 15.5, 6.5), PIN_E.yellow],
            ['e', pinCircle(24, 9.5, 3), PIN_E.hot], ['d', pinCircle(23, 8.6, 0.8), PIN_E.cream],
            ['e', 'M9 24H39L33 35H15Z', PIN_E.sky],
            ['m', 'M22 35h4v4.5h-4Z'], ['m', 'M15.5 39.5H32.5Q32.5 42.5 29.5 42.5H18.5Q15.5 42.5 15.5 39.5Z']
        ]
    },
    {
        id: 'bookone', name: 'Book One', desc: 'Start a series (give a book a series name, and read it or start it).', metal: 'silver', glint: [13, 12],
        progress: s => [s.seriesStarted ? 1 : 0, 1],
        art: [
            ['e', 'M24 6L38 11V24C38 33 31 39 24 42C17 39 10 33 10 24V11Z', PIN_E.lav],
            ['t', 24, 31, 15, '#1']
        ]
    },
    {
        id: 'boxset', name: 'Box Set', desc: 'Read every book in a series (set how many it has on a book).', metal: 'silver', glint: [12, 10],
        progress: s => [s.seriesDone ? 1 : 0, 1],
        art: [
            ['e', 'M9 12h9v27H9Z', PIN_E.pink], ['e', 'M18 9h10v30H18Z', PIN_E.lav], ['e', 'M28 13h10v26H28Z', PIN_E.mint],
            ['l', 'M9 16h9'], ['l', 'M18 13h10'], ['l', 'M28 17h10'], ['l', 'M9 35.5h9'], ['l', 'M18 35.5h10'], ['l', 'M28 35.5h10'],
            ['e', 'M4 24h40l-3.5 3.5L44 31H4l3.5-3.5Z', PIN_E.yellow]
        ]
    },
    {
        id: 'macaron', name: 'Macaron Stack', desc: 'Read 3 books in one series.', metal: 'gold', glint: [13, 7.5],
        progress: s => [Math.min(s.seriesMost, 3), 3],
        art: [
            ...pinMacaron(24, 36.5, PIN_E.lav), ...pinMacaron(25, 23, PIN_E.mint), ...pinMacaron(23, 9.5, PIN_E.pink)
        ]
    },
    {
        id: 'again', name: 'Second Helping', desc: 'Read a book again (write the re-read on its library card).', metal: 'silver', glint: [11, 13],
        progress: s => [s.reread ? 1 : 0, 1],
        art: [
            ['e', pinCircle(24, 24, 17) + pinCircle(24, 24, 12), PIN_E.lav, 'evenodd'],
            ['e', PIN_HEART, PIN_E.pink],
            ['m', 'M21.5 4.2L28.5 9.5L21.5 14.8Z'], ['m', 'M26.5 33.2L19.5 38.5L26.5 43.8Z']
        ]
    },
    {
        id: 'oldfriend', name: 'Old Friend', desc: 'Read a book 3 times (write the re-reads on its library card).', metal: 'gold', glint: [14, 15],
        progress: s => [Math.min(s.mostReads, 3), 3],
        art: [
            ['e', pinCircle(13, 11.5, 5), PIN_E.peach], ['e', pinCircle(35, 11.5, 5), PIN_E.peach],
            ['d', pinCircle(13, 11.5, 2.4), PIN_E.pink], ['d', pinCircle(35, 11.5, 2.4), PIN_E.pink],
            ['e', pinCircle(24, 22, 13), PIN_E.peach],
            ['e', 'M18 27.5a6 4.6 0 1 0 12 0a6 4.6 0 1 0 -12 0Z', PIN_E.cream],
            ['d', 'M21.8 25.4Q24 24.2 26.2 25.4Q25.6 27.4 24 27.6Q22.4 27.4 21.8 25.4Z', PIN_E.ink],
            ['l', 'M24 27.6V29.2'], ['l', 'M21.8 29.4q2.2 1.6 4.4 0'],
            ['d', pinCircle(19, 20, 1.5), PIN_E.ink], ['d', pinCircle(29, 20, 1.5), PIN_E.ink],
            ['e', 'M24 35.5L16.5 31.5V39.5Z', PIN_E.hot], ['e', 'M24 35.5L31.5 31.5V39.5Z', PIN_E.hot], ['m', pinCircle(24, 35.5, 2)]
        ]
    },
    {
        id: 'doorstop', name: 'Doorstopper', desc: 'Read a book of 500 pages or more.', metal: 'gold', glint: [12, 15],
        progress: s => [Math.min(s.longest, 500), 500],
        art: [
            // the back cover shows round the pages, top and bottom
            ['e', 'M8 11L19 6H39V38L28 43H8Z', PIN_E.sky],
            ['e', 'M10 10.5L20 6.3H37.6V36.4L28 40.8V11Z', PIN_E.cream], ['l', 'M28 11L37.6 6.6'],
            ['e', 'M8 11H28V43H8Z', PIN_E.sky],
            ['e', 'M11.5 17H24.5V23H11.5Z', PIN_E.yellow],
            ['l', 'M31.5 10.5V38.6'], ['l', 'M34.8 9V37.1']
        ]
    },
    {
        id: 'speedy', name: 'Speed Reader', desc: 'Finish a book within 3 days of starting it (full dates on both).', metal: 'silver', glint: [28.5, 7],
        progress: s => [s.speedy ? 1 : 0, 1],
        art: [
            ['e', 'M31 3L10 27H22L18 44L38 18H26Z', PIN_E.yellow],
            ['l', 'M4 31h5'], ['l', 'M6 36h6'], ['l', 'M8 41h5']
        ]
    },
    {
        id: 'slowburn', name: 'Slow Burn', desc: 'Finish a book you’ve been reading for over 3 months (full dates on both).', metal: 'gold', glint: [20, 26],
        progress: s => [s.slowBurn ? 1 : 0, 1],
        art: [
            ['e', 'M8 39.5H40Q40 44 35.5 44H12.5Q8 44 8 39.5Z', PIN_E.lav],
            ['e', 'M17 21Q24 18.5 31 21V39.5H17Z', PIN_E.cream],
            ['l', 'M24 16.5V20'],
            ['e', 'M24 4C27 9 29.5 11.5 29.5 14.5A5.5 5.5 0 0 1 18.5 14.5C18.5 11.5 21 9 24 4Z', PIN_E.yellow],
            ['d', 'M24 10C25.5 12.5 26.5 13.5 26.5 15A2.5 2.5 0 0 1 21.5 15C21.5 13.5 22.5 12.5 24 10Z', PIN_E.peach]
        ]
    },
    {
        id: 'halfway', name: 'Halfway There', desc: 'Get halfway to your yearly reading goal (set it in Reading Goals).', metal: 'gold', glint: [33, 10.5],
        progress: s => s.goal ? [Math.min(s.goalDone, Math.ceil(s.goal / 2)), Math.ceil(s.goal / 2)] : [0, 1],
        art: [
            // a flag planted halfway up (the pole covers the flag's own
            // edge, so they share the one line of metal)
            ['e', 'M6 43C9 37.5 21 37.5 25 43Z', PIN_E.mint],
            ['e', 'M15 9C22 6 28 12 35 9V24C28 27 22 21 15 24Z', PIN_E.cream],
            ['m', 'M13.5 7h3v35h-3Z'], ['m', pinCircle(15, 6, 2.6)],
            ['d', starPath(26, 16.6, 4.6, 2), PIN_E.hot]
        ]
    },
    {
        id: 'goal', name: 'Goal!', desc: 'Meet your yearly reading goal (set it in Reading Goals).', metal: 'gold', glint: [11, 17],
        progress: s => s.goal ? [Math.min(s.goalDone, s.goal), s.goal] : [0, 1],
        art: [
            ['e', pinCircle(22, 26, 17), PIN_E.hot], ['e', pinCircle(22, 26, 12), PIN_E.cream], ['e', pinCircle(22, 26, 7), PIN_E.hot], ['e', pinCircle(22, 26, 2.6), PIN_E.yellow],
            ['e', 'M36.5 5.5L40 2L41.3 8Z', PIN_E.lav], ['e', 'M42.5 11.5L46 8L40 6.7Z', PIN_E.lav],
            ['l', 'M22 26L40.5 7.5']
        ]
    },
    {
        id: 'bigyear', name: 'Big Year', desc: 'Read 50 books in one year (counts books with a finished date).', metal: 'gold', glint: [12, 12],
        progress: s => [Math.min(s.bestYear, 50), 50],
        // two bursts and two sparkles, with thin edges
        art: [
            ['e', starPath(17, 17, 12, 4.8, 8), PIN_E.pink, null, 1], ['e', starPath(32, 31, 10, 4, 8), PIN_E.mint, null, 1],
            ['e', starPath(34, 13.5, 4.5, 1.9, 4), PIN_E.yellow, null, 1], ['e', starPath(14, 33.5, 3.8, 1.6, 4), PIN_E.lav, null, 1],
            ['d', starPath(17, 17, 6, 2.4, 8), PIN_E.hot], ['d', starPath(32, 31, 5, 2, 8), PIN_E.teal]
        ]
    },
    {
        id: 'freshstart', name: 'Fresh Start', desc: 'Finish a book in January.', metal: 'gold', glint: [14, 26],
        progress: s => [s.january ? 1 : 0, 1],
        art: [
            ['l', 'M24 15V10'], ['l', 'M15 17.5L12 13.5'], ['l', 'M33 17.5L36 13.5'], ['l', 'M9.5 24.5L5 22.5'], ['l', 'M38.5 24.5L43 22.5'],
            ['e', 'M12 32A12 12 0 0 1 36 32Z', PIN_E.yellow],
            ['e', 'M5 32H43V36Q43 41 38 41H10Q5 41 5 36Z', PIN_E.sky],
            ['l', 'M8.5 35.2q2.2-1.5 4.4 0t4.4 0t4.4 0'], ['l', 'M25 38.3q2.2-1.5 4.4 0t4.4 0'], ['l', 'M33.5 34.6q1.8-1.2 3.6 0'],
            ['d', pinCircle(19.5, 27.5, 1.1), PIN_E.ink], ['d', pinCircle(28.5, 27.5, 1.1), PIN_E.ink], ['d', pinCircle(16.5, 30, 1.3), PIN_E.pink], ['d', pinCircle(31.5, 30, 1.3), PIN_E.pink]
        ]
    },
    {
        id: 'popsicle', name: 'Popsicle', desc: 'Finish a book in summer (June, July or August).', metal: 'gold', glint: [18, 8],
        progress: s => [s.summer ? 1 : 0, 1],
        art: [
            ['e', 'M21.5 34H26.5V42.5A2.5 2.5 0 0 1 21.5 42.5Z', PIN_E.peach],
            ['e', 'M14 14A10 10 0 0 1 29 5.34A4.6 4.6 0 0 0 33.85 12.26A10 10 0 0 1 34 14V35Q34 37 32 37H16Q14 37 14 35Z', PIN_E.pink],
            ['l', 'M18 12V21'], ['l', 'M30 18V21']
        ]
    },
    {
        id: 'lender', name: 'Lending Library', desc: 'Lend a book out (tick I Own This Book, then fill in Lent to).', metal: 'gold', glint: [21, 15],
        progress: s => [s.lentOut ? 1 : 0, 1],
        art: [
            ['l', 'M13 23C8 19 6 13 10 7'],
            ['e', 'M7 23L17 13H41V33H17Z', PIN_E.cream],
            ['m', pinCircle(14.5, 23, 2.6) + pinCircle(14.5, 23, 1.2)]
        ]
    },
    {
        id: 'cameback', name: 'It Came Back', desc: 'Get back a book you lent out.', metal: 'silver', glint: [17, 14], event: true, rotate: -8,
        progress: () => [0, 1],
        art: [
            ['e', 'M4 31C8 23 14 15 21 13.5C27 12.5 37 18 44 25A2.7 2.7 0 0 1 41.5 29.5' +
                'C35 24.5 28 21.5 23 22.5C17 23.5 12 29 8.5 34.5A2.9 2.9 0 0 1 4 31Z', PIN_E.peach],
            ['d', pinCircle(22, 18, 1.4), PIN_E.mint], ['d', pinCircle(15.5, 21.6, 1.15), PIN_E.mint], ['d', pinCircle(10.4, 27, 1), PIN_E.mint],
            ['d', pinCircle(29, 19.4, 1.15), PIN_E.mint], ['d', pinCircle(35.6, 22.6, 1), PIN_E.mint]
        ]
    },
    {
        id: 'recadd', name: 'Word of Mouth', desc: 'Jot down a book a friend recommended (Slips > From Friends).', metal: 'silver', glint: [10, 17],
        progress: s => [s.recAdded ? 1 : 0, 1],
        art: [
            ['e', 'M6 14H42V38H6Z', PIN_E.pink],
            ['e', 'M6 14L24 28L42 14Z', PIN_E.lav],
            ['e', 'M24 33C21 31 19.6 29.4 19.6 27.7C19.6 26.3 20.7 25.3 21.9 25.3C22.9 25.3 23.6 25.8 24 26.6C24.4 25.8 25.1 25.3 26.1 25.3C27.3 25.3 28.4 26.3 28.4 27.7C28.4 29.4 27 31 24 33Z', PIN_E.hot, null, 0.6]
        ]
    },
    {
        id: 'recread', name: 'Good Call', desc: 'Read a book a friend recommended.', metal: 'gold', glint: [11, 14],
        progress: s => [s.recRead ? 1 : 0, 1],
        art: [
            ['e', 'M10 9H38Q42 9 42 13V28Q42 32 38 32H22L13.5 39.5V32H10Q6 32 6 28V13Q6 9 10 9Z', PIN_E.cream],
            ['e', 'M24 27.5C19 24 16.5 21.5 16.5 18.5C16.5 16 18.3 14.3 20.4 14.3C22 14.3 23.3 15.2 24 16.6C24.7 15.2 26 14.3 27.6 14.3C29.7 14.3 31.5 16 31.5 18.5C31.5 21.5 29 24 24 27.5Z', PIN_E.pink, null, 0.6]
        ]
    },
    {
        id: 'grownup', name: 'All Grown Up', desc: 'Raise your reading critter to an adult.', metal: 'gold', glint: [12, 27],
        progress: s => [Math.min(s.critterFed, CRITTER_STAGES[CRITTER_STAGES.length - 1].at), CRITTER_STAGES[CRITTER_STAGES.length - 1].at],
        art: [
            ['e', 'M9 39C7 27 12 14.5 24 14.5C36 14.5 41 27 39 39C35 41.5 31 37.5 28 40.5C26 42.5 22 42.5 20 40.5C17 37.5 13 41.5 9 39Z', PIN_E.pink],
            ['d', pinCircle(16.5, 30.5, 1.6), PIN_E.hot], ['d', pinCircle(31.5, 30.5, 1.6), PIN_E.hot],
            ['d', pinCircle(19.5, 27, 1.8), PIN_E.ink], ['d', pinCircle(28.5, 27, 1.8), PIN_E.ink],
            ['d', pinCircle(20.1, 26.4, 0.6), '#fff'], ['d', pinCircle(29.1, 26.4, 0.6), '#fff'],
            ['l', 'M21.5 31q2.5 2.2 5 0'],
            ['m', 'M16 16L17 7.5L20.5 11.5L24 5.5L27.5 11.5L31 7.5L32 16Z'], ['d', pinCircle(24, 12.3, 1.4), PIN_E.hot]
        ]
    },
    {
        id: 'loyal', name: 'Loyal Critter', desc: 'Keep a reading critter 30 days without it running away.', metal: 'silver', glint: [11, 28],
        progress: s => [Math.min(s.critterDays, 30), 30],
        art: [
            // its bowl
            ['e', 'M7 22H41Q39 36 24 36Q9 36 7 22Z', PIN_E.pink],
            ['e', 'M5.5 18.5H42.5V23H5.5Z', PIN_E.hot],
            ['d', pinHeart(24, 29, 4.2), PIN_E.cream]
        ]
    },
    {
        id: 'genres', name: 'Genre Hopper', desc: 'Read books from 10 different genres.', metal: 'gold', glint: [12, 12],
        progress: s => [Math.min(s.genres, 10), 10],
        art: [
            ['e', pinCircle(24, 24, 17), PIN_E.sky], ['e', pinCircle(24, 24, 12.5), PIN_E.cream],
            ['l', 'M24 8.2v2.4'], ['l', 'M24 37.4v2.4'], ['l', 'M8.2 24h2.4'], ['l', 'M37.4 24h2.4'],
            ['e', 'M24 13L28 24H20Z', PIN_E.hot], ['e', 'M20 24H28L24 35Z', PIN_E.lav], ['m', pinCircle(24, 24, 2)]
        ]
    },
    {
        id: 'globe', name: 'Globe Trotter', desc: 'Read books from 25 different genres.', metal: 'gold', glint: [16, 13],
        progress: s => [Math.min(s.genres, 25), 25],
        art: [
            ['l', 'M24 5.5A15.5 15.5 0 0 1 24 36.5'],
            ['e', pinCircle(23, 21, 13), PIN_E.sky],
            // green land, in a thin line of gold
            ...['M15 14C18 12 21 13 21 16C21 19 18 19 17 22C16 24 13 22 13 19C13 17 13 15 15 14Z',
                'M26 20C29 19 33 21 32 25C31 29 27 31 26 28C25 26 24 21 26 20Z',
                'M24 11C26 10 29 11 29 13C27 14 25 14 24 11Z'].flatMap(d => [['d', d, PIN_E.mint], ['l', d, 0.5]]),
            ['m', 'M22.6 36.3h2.8v4.2h-2.8Z'],
            ['e', 'M15 40.5H33Q33 43.5 30 43.5H18Q15 43.5 15 40.5Z', PIN_E.lav]
        ]
    },
    {
        id: 'fanclub', name: 'Fan Club', desc: 'Read 5 books by the same author (not counting books in a series).', metal: 'silver', glint: [18, 14],
        progress: s => [Math.min(s.authorRun, 5), 5],
        art: [
            ['m', 'M10 7h3v36h-3Z'], ['m', pinCircle(11.5, 6, 2.6)],
            ['e', 'M13 9L42 18L13 27Z', PIN_E.lav]
        ]
    },
    {
        id: 'notes', name: 'Margin Notes', desc: 'Write notes on 10 books.', metal: 'silver', glint: [15, 29], rotate: -40,
        progress: s => [Math.min(s.withNotes, 10), 10],
        art: [
            ['e', 'M5 20h5v8H5Z', PIN_E.pink], ['m', 'M10 19.4h3.6v9.2H10Z'], ['l', 'M11.8 19.6v8.8'],
            ['e', 'M13.6 20h19v8h-19Z', PIN_E.yellow], ['l', 'M14.5 24h17'],
            ['e', 'M32.6 20L41 24L32.6 28Z', PIN_E.cream], ['d', 'M38.4 22.9L41 24L38.4 25.1Z', PIN_E.ink]
        ]
    },
    {
        id: 'pages', name: '10k Club', desc: 'Read 10,000 pages (counts finished books with page counts).', metal: 'gold', glint: [14, 12],
        progress: s => [Math.min(s.pages, 10000), 10000],
        art: [
            ['e', 'M17 30L12 44L17 41.5L20.5 45L24 32Z', PIN_E.pink], ['e', 'M31 30L36 44L31 41.5L27.5 45L24 32Z', PIN_E.pink],
            ['e', pinCircle(24, 21, 14.5), PIN_E.mint], ['e', pinCircle(24, 21, 10), PIN_E.cream],
            ['t', 24, 24.3, 8.6, '10k']
        ]
    },
    {
        id: 'streak', name: 'On a Roll', desc: 'Log pages 7 days in a row.', metal: 'gold', glint: [19.5, 12.5],
        progress: s => [Math.min(s.streak, 7), 7],
        art: [
            ['e', 'M24 5C27 12 35.5 15.5 35.5 27C35.5 35.5 30.5 42 24 42C17.5 42 12.5 36 12.5 28.5C12.5 22.5 16.5 19 18.5 14C20.5 17.5 21 20.5 22.5 22C24 17 25 11 24 5Z', PIN_E.hot],
            ['e', 'M24 22.5C27.5 26.5 30.5 29.5 30.5 34C30.5 37.5 27.5 39.8 24 39.8C20.5 39.8 17.5 37.5 17.5 34C17.5 30.5 21 28.5 24 22.5Z', PIN_E.yellow],
            ['d', pinCircle(21.8, 32.6, 1.1), PIN_E.ink], ['d', pinCircle(26.2, 32.6, 1.1), PIN_E.ink], ['l', 'M22.6 35.3q1.4 1.1 2.8 0']
        ]
    },
    {
        id: 'donut', name: 'Donut Stop', desc: 'Log pages 30 days in a row.', metal: 'gold', glint: [12, 14],
        progress: s => [Math.min(s.streak, 30), 30],
        art: [
            // gold all round, with the hole cut out (drawn the other way round)
            ['m', pinCircle(24, 24, 19.3) + 'M17.5 24a6.5 6.5 0 1 1 13 0a6.5 6.5 0 1 1 -13 0Z'],
            ['e', pinWavy(24, 24, 17, 1.3, 9) + pinCircle(24, 24, 6.5), PIN_E.pink, 'evenodd'],
            ...[[0, PIN_E.mint, 30], [50, PIN_E.yellow, -40], [100, PIN_E.sky, 70], [150, PIN_E.cream, 10], [200, PIN_E.lav, -60],
                [250, PIN_E.yellow, 45], [300, PIN_E.mint, -15]].map(([deg, colour, turn]) => {
                const a = deg * Math.PI / 180;
                return ['d', pinSprinkle(24 + 11.3 * Math.cos(a), 24 + 11.3 * Math.sin(a), turn), colour];
            })
        ]
    },
    {
        id: 'nightowl', name: 'Night Owl', desc: 'Log pages between midnight and 4am.', metal: 'silver', glint: [14, 12],
        progress: s => [s.nightOwl ? 1 : 0, 1],
        art: [
            ['e', 'M22.68 8.02A17 17 0 1 0 38.63 28.52A13 13 0 0 1 22.68 8.02Z', PIN_E.yellow],
            ['e', starPath(32.5, 14.5, 5.2, 2.3), PIN_E.lav],
            ['d', pinCircle(14.5, 30, 1.5), PIN_E.pink], ['l', 'M9.5 25.5q2.5 2.2 5 0']
        ]
    },
    {
        id: 'bedtime', name: 'Bedtime Story', desc: 'Log pages on 10 different nights (9pm to 4am).', metal: 'silver', glint: [16, 13],
        progress: s => [Math.min(s.nights, 10), 10],
        art: [
            ['e', 'M23.39 7.02A9 9 0 1 0 32.63 18.57A7.5 7.5 0 0 1 23.39 7.02Z', PIN_E.yellow],
            ['l', 'M16.6 15.6q1.4 1.2 2.8 0'], ['d', pinCircle(18.8, 19.4, 1), PIN_E.pink],
            ['t', 35.5, 22, 5.5, 'z'], ['t', 39.5, 15.5, 7.5, 'z'], ['t', 43, 8, 9.5, 'z'],
            ['e', 'M24 30C19 27 13 27 8 28.5V40C13 38.5 19 38.5 24 41.5Z', PIN_E.cream],
            ['e', 'M24 30C29 27 35 27 40 28.5V40C35 38.5 29 38.5 24 41.5Z', PIN_E.cream],
            ['l', 'M11 32c3-.8 6-.8 9 0'], ['l', 'M11 36c3-.8 6-.8 9 0'], ['l', 'M28 32c3-.8 6-.8 9 0']
        ]
    },
    {
        id: 'dnf', name: 'Life’s Too Short', desc: 'Put down a book you weren’t enjoying (mark it DNF).', metal: 'silver', glint: [13, 13],
        progress: s => [s.dnf ? 1 : 0, 1],
        art: [
            ['e', pinCircle(24, 24, 16.5), PIN_E.yellow],
            ['d', pinCircle(15.5, 28, 2.3), PIN_E.pink], ['d', pinCircle(32.5, 28, 2.3), PIN_E.pink],
            ['d', pinCircle(19.5, 24.5, 1.8), PIN_E.ink], ['d', pinCircle(28.5, 24.5, 1.8), PIN_E.ink],
            ['d', pinCircle(20.1, 23.9, 0.6), '#fff'], ['d', pinCircle(29.1, 23.9, 0.6), '#fff'],
            ['l', 'M21.5 31q2.5-2 5 0'],
            ['d', 'M28.6 27.2C27.8 28.7 27.5 29.3 27.5 29.8A1.1 1.1 0 0 0 29.7 29.8C29.7 29.3 29.4 28.7 28.6 27.2Z', PIN_E.sky]
        ]
    },
    {
        id: 'backup', name: 'Safe & Sound', desc: 'Back up your library (Export Library).', metal: 'silver', glint: [12, 12],
        progress: s => [s.backedUp ? 1 : 0, 1],
        art: [
            ['e', 'M9 8H35L40 13V40H9Z', PIN_E.sky],
            ['m', 'M16 8.5H31V19H16Z'], ['d', 'M26 10.5h3v6.5h-3Z', '#59606b'],
            ['e', 'M14 25H35V40H14Z', PIN_E.cream],
            ['d', 'M24.5 36.5C21.5 34.5 20.1 32.9 20.1 31.2C20.1 29.8 21.2 28.8 22.4 28.8C23.4 28.8 24.1 29.3 24.5 30.1C24.9 29.3 25.6 28.8 26.6 28.8C27.8 28.8 28.9 29.8 28.9 31.2C28.9 32.9 27.5 34.5 24.5 36.5Z', PIN_E.pink]
        ]
    },
    {
        id: 'dressed', name: 'Well Dressed Shelf', desc: 'Give 10 books a real cover image.', metal: 'gold', glint: [13.5, 11],
        progress: s => [Math.min(s.covers, 10), 10],
        art: [
            // a book in a tux: jacket cover, white shirt front, bow tie
            ['e', 'M11 7H37V41H11Z', PIN_E.ink], ['e', 'M11 7h5v34h-5Z', PIN_E.lav],
            ['e', 'M20 7H34L27 31Z', PIN_E.cream],
            ['e', 'M20 7L27 31L19.5 21L22.5 17.5Z', PIN_E.ink], ['e', 'M34 7L27 31L34.5 21L31.5 17.5Z', PIN_E.ink],
            ['d', pinCircle(27, 19, 0.9), PIN_E.ink], ['d', pinCircle(27, 23.5, 0.9), PIN_E.ink],
            ['e', 'M21.5 8.5L27 11.5L21.5 14.5Z', PIN_E.hot], ['e', 'M32.5 8.5L27 11.5L32.5 14.5Z', PIN_E.hot],
            ['m', pinCircle(27, 11.5, 1.7)],
            ['m', pinCircle(27, 34.5, 1.1)], ['m', pinCircle(27, 38.2, 1.1)],
            ['l', 'M30 30.5h4.5'], ['d', 'M30.6 30.5L31.6 28.2L32.4 30.5L33.4 28.6L34 30.5Z', PIN_E.hot]
        ]
    },
    {
        id: 'spines', name: 'Spine Collector', desc: 'Add a spine photo to 5 books.', metal: 'silver', glint: [12, 13],
        progress: s => [Math.min(s.spines, 5), 5],
        art: [
            ['e', 'M8 13h7v28H8Z', PIN_E.pink], ['e', 'M15 8h8v33h-8Z', PIN_E.yellow],
            ['e', 'M23 15h6v26h-6Z', PIN_E.mint], ['e', 'M30.5 10.5L37 9L42.5 39L36 40.5Z', PIN_E.lav],
            ['l', 'M8 17h7'], ['l', 'M8 36h7'], ['l', 'M15 12.5h8'], ['l', 'M15 36h8'], ['l', 'M23 19h6'], ['l', 'M23 37h6']
        ]
    },
    {
        id: 'rainbow', name: 'Rainbow Shelf', desc: 'Have spines in all 7 colours: red, orange, yellow, green, blue, purple and pink.', metal: 'silver', glint: [12, 22],
        progress: s => [s.colours, 7],
        art: [
            // one outline round the whole arch, the bands inside it split
            // by thin lines
            ['e', 'M7 32A17 17 0 0 1 41 32H30.2A6.2 6.2 0 0 0 17.8 32Z', PIN_E.hot],
            ['d', 'M10.6 32A13.4 13.4 0 0 1 37.4 32H33.8A9.8 9.8 0 0 0 14.2 32Z', PIN_E.yellow],
            ['d', 'M14.2 32A9.8 9.8 0 0 1 33.8 32H31.1A7.1 7.1 0 0 0 16.9 32Z', PIN_E.mint],
            ['l', 'M10.6 32A13.4 13.4 0 0 1 37.4 32', 0.9], ['l', 'M14.2 32A9.8 9.8 0 0 1 33.8 32', 0.9],
            // a cloud under each end
            ['e', pinCloud(12.4, 39, 1.5), PIN_E.cream], ['e', pinCloud(35.6, 39, 1.5), PIN_E.cream]
        ]
    },
    {
        id: 'tagger', name: 'Tagger', desc: 'Use 10 different tags on your books.', metal: 'gold', glint: [20, 9.5],
        progress: s => [Math.min(s.tags, 10), 10],
        art: [
            ['e', 'M17.6 6L24.6 6L23.2 13L29.2 13L30.6 6L37.6 6L36.2 13L44.2 13L42.8 20L34.8 20L33.2 28L41.2 28L39.8 35L31.8 35L30.4 42L23.4 42L24.8 35L18.8 35L17.4 42L10.4 42L11.8 35L3.8 35L5.2 28L13.2 28L14.8 20L6.8 20L8.2 13L16.2 13Z' +
                'M21.8 20L27.8 20L26.2 28L20.2 28Z', PIN_E.mint, 'evenodd']
        ]
    },
    {
        id: 'shortsweet', name: 'Short & Sweet', desc: 'Read a book under 100 pages.', metal: 'gold', glint: [17, 18],
        progress: s => [s.shortRead ? 1 : 0, 1],
        art: [
            ['e', 'M12.5 26H35.5L32 42H16Z', PIN_E.pink],
            ['l', 'M19 27.5l1 13'], ['l', 'M24 27.5v13.5'], ['l', 'M29 27.5l-1 13'],
            ['e', 'M10.5 26C9.5 20 14 15.5 19 16.5C20 11.5 27 11 29 15.5C34 14.5 38.5 19.5 37.5 26Z', PIN_E.cream],
            ['e', pinCircle(24, 11, 3), PIN_E.hot],
            ['d', pinCircle(17, 21.5, 1), PIN_E.mint], ['d', pinCircle(25, 19, 1), PIN_E.yellow],
            ['d', pinCircle(31, 21.5, 1), PIN_E.sky], ['d', pinCircle(21.5, 23.5, 0.9), PIN_E.hot]
        ]
    },
    {
        id: 'cake', name: 'Piece of Cake', desc: 'Finish a book the same day you start it (full dates on both).', metal: 'gold', glint: [13, 21],
        progress: s => [s.oneDay ? 1 : 0, 1],
        art: [
            // a little cake on a plate: dripping frosting, sprinkles, a cherry
            ['e', 'M4 40a20 4.5 0 1 0 40 0a20 4.5 0 1 0 -40 0Z', PIN_E.lav],
            ['e', 'M9 21Q24 17 39 21V38Q24 42 9 38Z', PIN_E.pink],
            ['d', pinCircle(14, 33, 1), PIN_E.mint], ['d', pinCircle(20, 35.8, 1), PIN_E.yellow], ['d', pinCircle(26.5, 33.2, 1), PIN_E.sky],
            ['d', pinCircle(33, 35.4, 1), PIN_E.cream], ['d', pinCircle(32, 30.4, 1), PIN_E.yellow], ['d', pinCircle(17.5, 29.8, 1), PIN_E.sky],
            ['e', 'M8.5 21.5Q24 15.5 39.5 21.5V24H38.3V28A1.8 1.8 0 0 1 34.7 28V24.5H30.8V26A1.8 1.8 0 0 1 27.2 26V24.5H23.3V29A1.8 1.8 0 0 1 19.7 29V24.5H15.8V26.5A1.8 1.8 0 0 1 12.2 26.5V24H8.5Z', PIN_E.cream],
            ['l', 'M24 12Q24.8 8.5 28 7'],
            ['e', pinCircle(24, 15, 3.6), PIN_E.hot], ['d', pinCircle(22.8, 13.8, 0.9), PIN_E.cream]
        ]
    },
    {
        id: 'sticky', name: 'Sticky Fingers', desc: 'Stick up 10 sticky notes (the pile in the corner, or To Buy).', metal: 'silver', glint: [12, 12], rotate: -6,
        progress: s => [Math.min(s.stickies, 10), 10],
        art: [
            ['e', 'M9 9H39V31L31 39H9Z', PIN_E.yellow],
            ['e', 'M31 39V31H39Z', PIN_E.peach],
            ['l', 'M14 17h19'], ['l', 'M14 23h15'], ['l', 'M14 29h11']
        ]
    },
    {
        id: 'gotit', name: 'Got It!', desc: 'Buy a book off your To Buy list (tick it in Slips > To Buy, or tick I Own This Book).', metal: 'gold', glint: [11, 27],
        progress: s => [s.bought ? 1 : 0, 1],
        art: [
            // a shopping bag, its side panel showing, a handle front and back
            ['l', 'M23 15V9A5.5 5.5 0 0 1 34 9V14', 1.4],
            ['e', 'M32 16L39 13V40L32 43Z', PIN_E.hot],
            ['e', 'M32 16L39 13V18.5L32 21.5Z', PIN_E.lav],
            ['e', 'M8 16H32V43H8Z', PIN_E.pink],
            ['e', 'M8 16H32V21.5H8Z', PIN_E.lav],
            ['l', 'M14 19V11A6 6 0 0 1 26 11V19', 1.8], ['m', pinCircle(14, 19, 1.4)], ['m', pinCircle(26, 19, 1.4)],
            ['e', starPath(20, 32, 6.5, 2.9), PIN_E.yellow]
        ]
    },
    {
        id: 'matchmaker', name: 'Matchmaker', desc: 'Lend out 5 different books.', metal: 'gold', glint: [12, 18],
        progress: s => [Math.min(s.lentBooks, 5), 5],
        art: [
            ['e', pinHeart(18, 24, 10.5), PIN_E.pink], ['e', pinHeart(31, 27, 9.5), PIN_E.lav],
            ['l', 'M6 39L41 10'], ['m', 'M43.5 8L35.8 10L40.5 14.2Z'],
            ['m', 'M6 39l-2 -4.5l3.5 -0.8Z'], ['m', 'M6 39l4.6 1.4l0.2 -3.6Z']
        ]
    },
    {
        id: 'bookclub', name: 'Book Club', desc: 'Lend books to 3 different people.', metal: 'gold', glint: [12, 25],
        progress: s => [Math.min(s.lentPeople, 3), 3],
        art: [
            ['e', pinHeart(24, 16, 9), PIN_E.hot],
            ['e', pinHeart(14.5, 31, 9), PIN_E.pink], ['e', pinHeart(33.5, 31, 9), PIN_E.lav]
        ]
    },
    {
        id: 'returns', name: 'Return Policy', desc: 'Get 5 lent books back.', metal: 'silver', glint: [12, 12],
        progress: s => [Math.min(s.returns, 5), 5],
        art: [
            // a little alarm clock (back right on time), with a happy face
            ['m', 'M13 36.5L9.5 42.5H14L16.5 38.5Z'], ['m', 'M35 36.5L38.5 42.5H34L31.5 38.5Z'],
            ['e', pinCircle(12.5, 12.5, 5), PIN_E.yellow], ['e', pinCircle(35.5, 12.5, 5), PIN_E.yellow],
            ['m', 'M22.6 7h2.8v4h-2.8Z'],
            ['e', pinCircle(24, 26, 15), PIN_E.hot],
            ['e', pinCircle(24, 26, 11.3), PIN_E.cream],
            ['l', 'M24 26V19.5'], ['l', 'M24 26L28.5 23.5'], ['m', pinCircle(24, 26, 1.3)],
            ['d', pinCircle(19, 28.5, 1.4), PIN_E.ink], ['d', pinCircle(29, 28.5, 1.4), PIN_E.ink],
            ['d', pinCircle(16.8, 31.3, 1.5), PIN_E.pink], ['d', pinCircle(31.2, 31.3, 1.5), PIN_E.pink],
            ['l', 'M22.3 31.5q1.7 1.4 3.4 0']
        ]
    },
    {
        id: 'collector', name: 'Collector', desc: 'Own 25 books.', metal: 'gold', glint: [11, 9],
        progress: s => [Math.min(s.owned, 25), 25],
        art: [
            ['e', 'M8 6h32v37H8Z', PIN_E.lav], ['e', 'M12 10h24v14H12Z', PIN_E.cream], ['e', 'M12 27h24v12.5H12Z', PIN_E.cream],
            ['e', 'M13.8 12.6h4.6v11.4h-4.6Z', PIN_E.pink], ['e', 'M18.4 13.8h4.6v10.2h-4.6Z', PIN_E.mint], ['e', 'M26.5 12.5L30.8 11.4L33.6 23.8H29.2Z', PIN_E.sky],
            ['e', 'M13.8 29.2h4.6v10.3h-4.6Z', PIN_E.yellow], ['e', 'M18.4 30.6h4.6v8.9h-4.6Z', PIN_E.hot], ['e', 'M23 29.6h4.6v9.9H23Z', PIN_E.peach]
        ]
    },
    {
        id: 'cookiejar', name: 'Cookie Jar', desc: 'Have 20 books waiting in Want to Read.', metal: 'silver', glint: [12, 20],
        progress: s => [Math.min(s.wantToRead, 20), 20],
        art: [
            ['e', pinCircle(24, 7.5, 2.6), PIN_E.lav],
            ['e', 'M11 16H37Q40 16 40 19V38Q40 42 36 42H12Q8 42 8 38V19Q8 16 11 16Z', PIN_E.sky],
            ['e', pinCircle(17, 34.5, 5.5), PIN_E.peach], ['e', pinCircle(30.5, 33.5, 6), PIN_E.peach], ['e', pinCircle(23, 24.5, 5.5), PIN_E.peach],
            ...[[15.5, 33], [18.5, 36.5], [29, 31.5], [32.5, 35], [30, 36.5], [21.5, 23], [24.5, 26.5]]
                .map(([x, y]) => ['d', pinCircle(x, y, 0.9), PIN_E.ink]),
            ['e', 'M10 9.5H38V16H10Z', PIN_E.lav]
        ]
    },
    {
        id: 'sweettooth', name: 'Sweet Tooth', desc: 'Read 5 books in one month (counts books with a finished date).', metal: 'gold', glint: [16, 11],
        progress: s => [Math.min(s.monthMost, 5), 5],
        art: [
            // a swirl lollipop: a pink stripe winding round a cream one
            ['m', 'M22.6 28h2.8v16h-2.8Z'],
            ['e', pinCircle(24, 16, 13), PIN_E.cream],
            ['d', pinSpiral(24, 16, 13, 2.6), PIN_E.hot],
            ['l', pinCircle(24, 16, 13), 1.8]
        ]
    },
    {
        id: 'doublescoop', name: 'Double Scoop', desc: 'Finish two books on the same day (full finished dates).', metal: 'silver', glint: [19, 21],
        progress: s => [s.sameDay ? 1 : 0, 1],
        art: [
            ['e', 'M15 25H33L24 45Z', PIN_E.peach],
            ['l', 'M21 25L27 38.3', 0.8], ['l', 'M27 25L30 31.7', 0.8], ['l', 'M27 25L21 38.3', 0.8], ['l', 'M21 25L18 31.7', 0.8],
            ['e', 'M15 26A9 9 0 0 1 33 26Q31 28.5 28.5 27Q26 29.5 24 27.5Q22 29.5 19.5 27Q17 28.5 15 26Z', PIN_E.mint],
            ['e', 'M16.5 17A7.5 7.5 0 0 1 31.5 17Q30 19.2 28 18Q26 20.2 24 18.6Q22 20.2 20 18Q18 19.2 16.5 17Z', PIN_E.pink],
            ['l', 'M24 6.5Q24.6 3.5 27.5 2.6'],
            ['e', pinCircle(24, 8, 2.6), PIN_E.hot], ['d', pinCircle(23.1, 7.1, 0.7), PIN_E.cream]
        ]
    },
    {
        id: 'cherry', name: 'Cherry on Top', desc: 'Read more books than your yearly goal (set it in Reading Goals).', metal: 'gold', glint: [12, 31],
        progress: s => s.goal ? [Math.min(s.goalDone, s.goal + 1), s.goal + 1] : [0, 1],
        art: [
            // green stems, curving up to meet under the leaf
            ['e', 'M14.2 27.2Q13 13 26.3 7.6L28 9.2Q15.2 14 17 27.4Z', PIN_E.teal, null, 0.9],
            ['e', 'M31.6 27.4Q26.5 17.5 26.3 9.2L28.3 8.4Q29 17 34.4 27.2Z', PIN_E.teal, null, 0.9],
            ['e', 'M27 8.5Q23 2.5 15 4.5Q19 11 27 8.5Z', PIN_E.mint], ['l', 'M25 8Q21 6 17.5 5.2', 0.6],
            ['e', pinCircle(15, 34, 8.5), PIN_E.hot], ['e', pinCircle(33, 35, 8.5), PIN_E.hot],
            ['d', pinCircle(11.8, 31, 1.6), PIN_E.cream], ['d', pinCircle(29.8, 32, 1.6), PIN_E.cream]
        ]
    },
    {
        id: 'cocoa', name: 'Cocoa Season', desc: 'Finish a book in December.', metal: 'silver', glint: [12, 26],
        progress: s => [s.december ? 1 : 0, 1],
        art: [
            ['l', 'M18 9.5Q16 7.5 18 5.5Q20 3.5 18 1.5'], ['l', 'M27 9.5Q25 7.5 27 5.5Q29 3.5 27 1.5'],
            ['e', pinCircle(36.5, 29.5, 7) + pinCircle(36.5, 29.5, 3.8), PIN_E.lav, 'evenodd'],
            ['e', 'M7 15H37V38Q37 44 31 44H13Q7 44 7 38Z', PIN_E.lav],
            ['e', 'M9 15a13 3 0 1 0 26 0a13 3 0 1 0 -26 0Z', PIN_E.peach],
            ['e', 'M12 11.5h5.5v4.5h-5.5Z', PIN_E.cream, null, 1.2], ['e', 'M19.5 10.5h5.5v4.5h-5.5Z', PIN_E.cream, null, 1.2],
            ['e', 'M27 12h5v4h-5Z', PIN_E.cream, null, 1.2],
            ['d', pinHeart(22, 30, 5), PIN_E.pink]
        ]
    },
    {
        id: 'shortstack', name: 'Short Stack', desc: 'Be reading 3 books at once.', metal: 'gold', glint: [12, 30],
        progress: s => [Math.min(s.readingNow, 3), 3],
        art: [
            // pancakes on a plate, honey dripping down, a pat of butter
            ['e', 'M4 38a20 3.5 0 1 0 40 0a20 3.5 0 1 0 -40 0Z', PIN_E.sky],
            ['e', 'M9.25 32.5H38.75A2.25 2.25 0 0 1 38.75 37H9.25A2.25 2.25 0 0 1 9.25 32.5Z', PIN_E.peach, null, 1.2],
            ['e', 'M10.25 28H37.75A2.25 2.25 0 0 1 37.75 32.5H10.25A2.25 2.25 0 0 1 10.25 28Z', PIN_E.peach, null, 1.2],
            ['e', 'M11.25 23.5H36.75A2.25 2.25 0 0 1 36.75 28H11.25A2.25 2.25 0 0 1 11.25 23.5Z', PIN_E.peach, null, 1.2],
            // maple syrup (the same brown in every theme)
            ['e', 'M10 25.5Q10 22.5 14 22.5H34Q38 22.5 38 25.5V26.5H35V31A1.5 1.5 0 0 1 32 31V26.5H24.5V34A1.5 1.5 0 0 1 21.5 34V26.5H15.5V29.5A1.5 1.5 0 0 1 12.5 29.5V26.5H10Z', '#b86a1c', null, 1.2],
            ['e', 'M19 20H29L29.6 22.5H18.4Z', PIN_E.yellow, null, 1]
        ]
    },
    {
        id: 'toughcookie', name: 'Tough Cookie', desc: 'Finish a book you rated 2 stars or less.', metal: 'silver', glint: [12, 15],
        progress: s => [s.toughCookie ? 1 : 0, 1],
        art: [
            // a chocolate chip cookie with a bite out of it
            ['e', 'M29.01 40.25A17 17 0 1 1 40.88 26.01A6 6 0 0 0 34.84 34A6 6 0 0 0 29.01 40.25Z', PIN_E.peach],
            ...[[15, 14], [24.5, 11], [33, 15], [19, 22], [29, 22.5], [11.5, 27], [22, 31], [16, 36.5], [36.5, 21.5], [26.5, 38]]
                .map(([x, y]) => ['d', pinCircle(x, y, 1.7), PIN_E.ink]),
            ['e', pinCircle(42.5, 38, 1.3), PIN_E.peach, null, 0.8], ['e', pinCircle(39.5, 43, 1), PIN_E.peach, null, 0.8]
        ]
    },
    {
        id: 'teatime', name: 'Tea Time', desc: 'Log pages in the afternoon, between 3pm and 5pm.', metal: 'gold', glint: [13, 24],
        progress: s => [s.teaTime ? 1 : 0, 1],
        art: [
            ['l', 'M18.5 12Q16 9.5 18.5 7Q21 4.5 18.5 2.5'], ['l', 'M26.5 12Q24 9.5 26.5 7Q29 4.5 26.5 2.5'],
            ['e', 'M3 38a21 4 0 1 0 42 0a21 4 0 1 0 -42 0Z', PIN_E.lav],
            ['e', pinCircle(36, 23.5, 5.5) + pinCircle(36, 23.5, 2.8), PIN_E.pink, 'evenodd'],
            ['e', 'M8 17H37Q37 37 22.5 37Q8 37 8 17Z', PIN_E.pink],
            ['e', 'M9.5 17a13 2.6 0 1 0 26 0a13 2.6 0 1 0 -26 0Z', PIN_E.peach]
        ]
    },
    {
        id: 'pie', name: 'Easy as Pie', desc: 'Read 10 books in one genre.', metal: 'gold', glint: [13, 14],
        progress: s => [Math.min(s.genreMost, 10), 10],
        art: [
            // a cherry pie with a lattice top and a crimped crust
            ['e', pinCircle(24, 24, 14), PIN_E.hot],
            ...[19, 29].map(x => ['e', `M${x - 2.3} 9H${x + 2.3}V39H${x - 2.3}Z`, PIN_E.peach, null, 0.9]),
            ...[19, 29].map(y => ['e', `M9 ${y - 2.3}H39V${y + 2.3}H9Z`, PIN_E.peach, null, 0.9]),
            ['e', pinWavy(24, 24, 18.5, 1.1, 16) + pinCircle(24, 24, 13.5), PIN_E.peach, 'evenodd']
        ]
    },
    {
        id: 'treat', name: 'Treat Yourself', desc: 'Buy 5 books off your To Buy list (tick them in Slips > To Buy, or tick I Own This Book).', metal: 'gold', glint: [18, 21], rotate: -20,
        progress: s => [Math.min(s.boughtCount, 5), 5],
        art: [
            // a sweet in a wrapper twisted at both ends
            ['e', 'M15 24L3.5 13Q6.5 18.5 3 24Q6.5 29.5 3.5 35Z', PIN_E.lav],
            ['e', 'M33 24L44.5 13Q41.5 18.5 45 24Q41.5 29.5 44.5 35Z', PIN_E.lav],
            ['e', 'M13 24a11 8.5 0 1 0 22 0a11 8.5 0 1 0 -22 0Z', PIN_E.lav],
        ]
    },
    {
        id: 'librarycard', name: 'Card Carrier', desc: 'Have a local library card (tick it in Settings > Your shelf).', metal: 'silver', glint: [10, 16], rotate: -10,
        progress: s => [s.libraryCard ? 1 : 0, 1],
        art: [
            // a library card: a coloured band across the top, lines to
            // write on, and a stamp in the corner
            ['e', 'M8 11H40Q43 11 43 14V35Q43 38 40 38H8Q5 38 5 35V14Q5 11 8 11Z', PIN_E.cream],
            ['e', 'M8 11H40Q43 11 43 14V18H5V14Q5 11 8 11Z', PIN_E.hot, null, 1],
            ['l', 'M10 24H27'], ['l', 'M10 28.5H24'], ['l', 'M10 33H21'],
            ['e', pinCircle(35, 29.5, 5), PIN_E.lav, null, 1],
            ['e', starPath(35, 29.5, 3.2, 1.4), PIN_E.yellow, null, 0.8]
        ]
    },
    {
        id: 'pizza', name: 'Pizza Night', desc: 'Log pages on a Friday evening, between 6pm and 10pm.', metal: 'silver', glint: [15, 9], rotate: -14,
        progress: s => [s.pizzaNight ? 1 : 0, 1],
        art: [
            // a slice of pepperoni, cheese dripping off one edge
            ['e', 'M8.5 13Q24 7.5 39.5 13L25.5 43Q24 45.5 22.5 43Z', PIN_E.yellow],
            ['e', 'M33.5 26Q35.5 31 34 33Q32 34.5 31.6 30.2Z', PIN_E.yellow, null, 1],
            ['e', 'M5.5 10.5Q24 2 42.5 10.5Q43 14.5 39.5 15Q24 9 8.5 15Q5 14.5 5.5 10.5Z', PIN_E.peach],
            ['e', pinCircle(18.5, 20.5, 3.4), PIN_E.red], ['e', pinCircle(29, 21.5, 3.1), PIN_E.red], ['e', pinCircle(24, 32, 2.8), PIN_E.red],
            ['d', pinCircle(23.5, 15.5, 0.9), PIN_E.teal], ['d', pinCircle(21, 26.5, 0.8), PIN_E.teal], ['d', pinCircle(28.5, 28, 0.8), PIN_E.teal]
        ]
    }
];

function pinSvg(pin, earned = true) {
    const id = `pin${++pinUid}`;
    const turn = pin.rotate ? ` transform="rotate(${pin.rotate} 24 24)"` : '';
    const enamel = pin.art.filter(p => p[0] === 'e' || p[0] === 'm');
    if (!earned) {
        // not earned yet: just its shape, a flat shadow on the cork
        // (dots too, for any pin drawn mostly in dots)
        const shapes = pin.art.filter(p => 'emd'.includes(p[0]))
            .map(p => `<path d="${p[1]}"${p[3] === 'evenodd' ? ' fill-rule="evenodd"' : ''}/>`).join('');
        return `<svg class="pin-art locked" viewBox="0 0 48 48" aria-hidden="true"><g class="pin-ghost"${turn}>${shapes}</g></svg>`;
    }
    const stops = PIN_METALS[pin.metal].map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('');
    const metal = `url(#${id}a)`;
    const parts = pin.art.map(([kind, a, b, c, d]) => {
        if (kind === 'e') {
            const rule = c === 'evenodd' ? ' fill-rule="evenodd"' : '';
            return `<path d="${a}" style="fill:${b}"${rule}/>` +
                `<path d="${a}" fill="none" stroke="${metal}" stroke-width="${d || 1.8}" stroke-linejoin="round"/>`;
        }
        if (kind === 'd') return `<path d="${a}" style="fill:${b}"/>`;
        if (kind === 'l') return `<path d="${a}" fill="none" stroke="${metal}" stroke-width="${b || 1}" stroke-linecap="round" stroke-linejoin="round"/>`;
        if (kind === 'm') return `<path d="${a}" fill="${metal}"/>`;
        if (kind === 't') return `<text x="${a}" y="${b}" font-size="${c}" text-anchor="middle" fill="${metal}" class="pin-text">${d}</text>`;
        return '';
    }).join('');
    // the enamel's shine: a crisp curved band across the top and one
    // bright streak, cut to the pin's shape
    const clip = enamel.map(p => `<path d="${p[1]}"${turn}${p[3] === 'evenodd' ? ' clip-rule="evenodd"' : ''}/>`).join('');
    const [gx, gy] = pin.glint;
    return `<svg class="pin-art" viewBox="0 0 48 48" aria-hidden="true">
        <defs>
            <linearGradient id="${id}a" gradientUnits="userSpaceOnUse" x1="6" y1="4" x2="42" y2="44">${stops}</linearGradient>
            <clipPath id="${id}c">${clip}</clipPath>
        </defs>
        <g${turn}>${parts}</g>
        <g clip-path="url(#${id}c)">
            <path d="M-2 19C12 9 32 5 50 9V-2H-2Z" fill="#fff" opacity="0.2"/>
            <path d="M9 17C15 11.5 22 9 30 8.4" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round" opacity="0.55"/>
            <path class="pin-gleam" d="M-16 -4H-6L-26 52H-36Z" fill="#fff" opacity="0"/>
        </g>
        <path class="pin-glint" d="M${gx} ${gy - 3.6}L${gx + 0.7} ${gy - 0.7}L${gx + 3.6} ${gy}L${gx + 0.7} ${gy + 0.7}L${gx} ${gy + 3.6}L${gx - 0.7} ${gy + 0.7}L${gx - 3.6} ${gy}L${gx - 0.7} ${gy - 0.7}Z" fill="#fff"/>
    </svg>`;
}

// ----- Working out what's been earned -----
// The books pins are worked out from: everything on the shelf except
// the ones ticked "Don't count toward pins" (books you already had
// before, say). They still count everywhere else.
function pinBooks() {
    return visibleBooks().filter(b => !b.noPins);
}

function pinStats() {
    const books = pinBooks();
    const read = books.filter(hasBeenRead);
    const timesRead = b => (b.status === 'Read' ? 1 : 0) + (b.extraReads || []).filter(r => r.finished).length;
    const spans = [];
    books.forEach(b => {
        if (b.status === 'Read') spans.push(daysBetween(b.startedDate, b.finishedDate));
        (b.extraReads || []).forEach(r => spans.push(daysBetween(r.started, r.finished)));
    });
    const log = loadPagesLog();
    const fed = critter ? Math.max(critter.totalFed || 0, ...(critter.past || []).map(p => p.totalFed || 0)) : 0;
    // every finish with a date (re-reads too), as [year, month]
    const finishes = [];
    books.forEach(b => {
        if (b.status === 'Read') finishes.push(b.finishedDate);
        (b.extraReads || []).forEach(r => finishes.push(r.finished));
    });
    const finished = finishes.filter(d => /^\d{4}-\d{2}/.test(d || '')).map(d => [+d.slice(0, 4), +d.slice(5, 7)]);
    const perYear = {}, perMonth = {}, perDay = {}, perGenre = {};
    finished.forEach(([y, m]) => {
        perYear[y] = (perYear[y] || 0) + 1;
        perMonth[`${y}-${m}`] = (perMonth[`${y}-${m}`] || 0) + 1;
    });
    finishes.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d || '')).forEach(d => { perDay[d] = (perDay[d] || 0) + 1; });
    read.filter(b => b.genre).forEach(b => { perGenre[b.genre] = (perGenre[b.genre] || 0) + 1; });
    // read books by each author, leaving out series books
    const byAuthor = {};
    read.filter(b => !(b.series || '').trim()).forEach(b => {
        new Set((b.authors || []).filter(a => a && a !== 'Unknown').map(a => a.trim().toLowerCase()))
            .forEach(a => { byAuthor[a] = (byAuthor[a] || 0) + 1; });
    });
    // nights read on (the small hours count as the night before)
    const nights = new Set(log.filter(e => e.pages > 0).map(e => new Date(e.at)).filter(d => d.getHours() >= 21 || d.getHours() < 4)
        .map(d => dateBoxValue(new Date(d.getTime() - (d.getHours() < 4 ? DAY_MS : 0)))));
    const critterDays = !critter ? 0 : Math.max(
        critter.bornAt && !critter.gone ? (Date.now() - critter.bornAt) / DAY_MS : 0,
        ...(critter.past || []).filter(p => p.bornAt).map(p => (p.endedAt - p.bornAt) / DAY_MS));
    return {
        readCount: read.length,
        fiveStars: books.some(b => normalizeRating(b.rating) >= 5),
        fiveStarCount: books.filter(b => normalizeRating(b.rating) >= 5).length,
        mostReads: books.reduce((max, b) => Math.max(max, timesRead(b)), 0),
        seriesMost: Math.max(0, ...seriesSummary(books).map(s => s.readCount)),
        slowBurn: spans.some(d => d !== null && d > 90),
        bestYear: Math.max(0, ...Object.values(perYear)),
        january: finished.some(([, m]) => m === 1),
        summer: finished.some(([, m]) => m >= 6 && m <= 8),
        authorRun: Math.max(0, ...Object.values(byAuthor)),
        nights: nights.size,
        critterDays: Math.floor(critterDays),
        colours: new Set(books.map(b => colourFamily(b.color)).filter(Boolean)).size,
        wantToRead: books.filter(b => b.status === 'Want to Read').length,
        seriesDone: seriesSummary(books).some(s => s.finished),
        reread: books.some(b => timesRead(b) >= 2),
        longest: read.reduce((max, b) => Math.max(max, b.pages || 0), 0),
        speedy: spans.some(d => d !== null && d <= 3),
        oneDay: spans.some(d => d === 1), // (the same day counts as 1)
        goal: appSettings.goal || 0,
        goalDone: finishedReads(books).filter(r => r.date.startsWith(String(new Date().getFullYear()))).length,
        critterFed: fed,
        genres: new Set(read.map(b => b.genre).filter(Boolean)).size,
        withNotes: books.filter(b => (b.notes || '').trim() || (b.notes2 || '').trim()).length,
        pages: pagesOf(finishedReads(books)),
        streak: longestStreak(log),
        nightOwl: log.some(e => new Date(e.at).getHours() < 4),
        dnf: books.some(b => b.status === 'DNF'),
        owned: books.filter(b => b.owned).length,
        lentOut: books.some(isLentOut),
        seriesStarted: seriesSummary(books).some(s => s.started),
        hatched: !!critter && (!!critter.bornAt || (critter.past || []).length > 0),
        backedUp: readTimeKey(LAST_BACKUP_KEY) > 0,
        otherTheme: currentTheme() !== 'candy',
        tinkered: SHELF_EXTRA_SETTINGS.some(k => appSettings[k] !== DEFAULT_SETTINGS[k]),
        recAdded: loadRecs().length > 0 || books.some(b => (b.recommendedBy || '').trim()),
        recRead: books.some(b => (b.recommendedBy || '').trim() && hasBeenRead(b)),
        covers: books.filter(b => b.image && !isStickyPlaceholder(b)).length,
        spines: books.filter(b => b.spineImage).length,
        tags: new Set(books.flatMap(b => b.tags || []).map(t => t.toLowerCase())).size,
        shortRead: read.some(b => b.pages > 0 && b.pages < 100),
        // (counted as they happen, as well as what's on the shelf now)
        stickies: Math.max(pinState.counts.stickies || 0, books.filter(b => b.stickyNote).length),
        lentBooks: new Set([...pinState.lentIds, ...books.filter(isLentOut).map(b => b.id)]).size,
        bought: (pinState.counts.bought || 0) > 0 || books.some(b => b.stickyNote && b.owned),
        lentPeople: new Set([...pinState.lentTo, ...books.filter(isLentOut).map(b => b.lentTo.trim().toLowerCase())]).size,
        returns: pinState.counts.returns || 0,
        boughtCount: pinState.counts.bought || 0,
        monthMost: Math.max(0, ...Object.values(perMonth)),
        sameDay: Object.values(perDay).some(n => n >= 2),
        december: finished.some(([, m]) => m === 12),
        readingNow: books.filter(b => b.status === 'Reading').length,
        toughCookie: read.some(b => normalizeRating(b.rating) >= 1 && normalizeRating(b.rating) <= 2),
        libraryCard: !!appSettings.libraryCard,
        teaTime: log.some(e => e.pages > 0 && [15, 16].includes(new Date(e.at).getHours())),
        pizzaNight: log.some(e => {
            const d = new Date(e.at);
            return e.pages > 0 && d.getDay() === 5 && d.getHours() >= 18 && d.getHours() < 22;
        }),
        genreMost: Math.max(0, ...Object.values(perGenre))
    };
}

// which of 7 colour families a spine colour's in (greys, near-blacks
// and near-whites aren't in any), for Rainbow Shelf
function colourFamily(hex) {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return null;
    const h6 = m[1].length === 3 ? [...m[1]].map(c => c + c).join('') : m[1];
    const [r, g, b] = [0, 2, 4].map(i => parseInt(h6.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
    const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
    if (s < 0.25 || l < 0.12 || l > 0.92) return null;
    const d = max - min;
    let hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hue = (hue * 60 + 360) % 360;
    return hue < 15 || hue >= 345 ? 'red' : hue < 45 ? 'orange' : hue < 70 ? 'yellow' : hue < 170 ? 'green'
        : hue < 255 ? 'blue' : hue < 290 ? 'purple' : 'pink';
}

// the Settings > Shelf extras switches (changing any earns Tinkerer)
const SHELF_EXTRA_SETTINGS = ['cat', 'dust', 'lean', 'sticky', 'noteFalls', 'shelfCounts', 'critter', 'pins', 'pinAlerts', 'ownedSeal', 'unreadFade'];

// the most days in a row with pages logged
function longestStreak(log) {
    const days = [...new Set(log.filter(e => e.pages > 0).map(e => dateBoxValue(new Date(e.at))))].sort();
    let best = 0, run = 0, prev = null;
    days.forEach(day => {
        const d = new Date(day + 'T12:00');
        run = prev && Math.round((d - prev) / DAY_MS) === 1 ? run + 1 : 1;
        best = Math.max(best, run);
        prev = d;
    });
    return best;
}

function loadPins() {
    try {
        const saved = JSON.parse(localStorage.getItem(PINS_KEY));
        if (saved && typeof saved === 'object') {
            pinState = {
                earned: saved.earned || {}, seen: saved.seen || {}, counts: saved.counts || {},
                lentIds: saved.lentIds || [], lentTo: saved.lentTo || []
            };
        }
    } catch (e) {}
}

function savePins() {
    try { localStorage.setItem(PINS_KEY, JSON.stringify(pinState)); } catch (e) {}
}

// an empty board (Settings > Remove example shelf), then whatever the books
// still here earn
function resetPins() {
    pinState = { earned: {}, seen: {}, counts: {}, lentIds: [], lentTo: [] };
    savePins();
    checkPins();
    renderPinWidget();
}

// Settings > Shelf extras: leave every book on the shelf out of pins
// (an existing library, typed in), then offer to restart the board so
// the pins those books earned go too
async function excludeShelfFromPins() {
    const books = visibleBooks().filter(b => !b.noPins);
    if (!books.length) { alert('Every book on your shelf is already left out of pins.'); return; }
    if (!confirm(`Leave all ${books.length} book${books.length === 1 ? '' : 's'} on your shelf out of pins? You can untick any of them later in its edit window.`)) return;
    books.forEach(b => { b.noPins = true; });
    await dbBulkPut(books);
    if (confirm('Also restart your pin board? Pins your counting books still earn come straight back; one-off ones (like a book you lent coming back) don\'t.')) {
        resetPins();
    }
    checkPins();
    renderPinWidget();
}

// ...and the way back, for a slip
async function includeShelfInPins() {
    const books = visibleBooks().filter(b => b.noPins);
    if (!books.length) { alert('Every book on your shelf already counts toward pins.'); return; }
    if (!confirm(`Count all ${books.length} book${books.length === 1 ? '' : 's'} left out of pins again?`)) return;
    books.forEach(b => { b.noPins = false; });
    await dbBulkPut(books);
    checkPins();
    renderPinWidget();
}

// Settings > Start over > Restart pins
function restartPins() {
    if (!confirm('Take every pin off the board and start again? Pins your books still earn come straight back. This can\'t be undone.')) return;
    resetPins();
    closeSettings();
}

// Pages logged by mistake were taken back out: any of these pins they
// earned goes too, unless it's still earned without them. Gives the names
// of the ones taken back.
function takeBackPins(ids) {
    const stats = pinStats();
    const lost = PINS.filter(pin => ids.includes(pin.id) && pinState.earned[pin.id] && !pin.event)
        .filter(pin => { const [have, need] = pin.progress(stats); return have < need; });
    if (!lost.length) return [];
    lost.forEach(pin => { delete pinState.earned[pin.id]; delete pinState.seen[pin.id]; });
    savePins();
    renderPinWidget();
    return lost.map(pin => pin.name);
}

// hand out any pins that have been earned since we last looked
function checkPins() {
    if (!pinsReady) return;
    const stats = pinStats();
    let changed = false;
    PINS.forEach(pin => {
        if (pin.event || pinState.earned[pin.id]) return;
        const [have, need] = pin.progress(stats);
        if (have >= need) {
            pinState.earned[pin.id] = Date.now();
            changed = true;
        }
    });
    if (changed) {
        savePins();
        renderPinWidget(true);
    }
}

function awardPin(id) {
    if (pinState.earned[id] || !PINS.some(p => p.id === id)) return;
    pinState.earned[id] = Date.now();
    savePins();
    renderPinWidget(true);
}

// count something toward a pin (a sticky note stuck up, a book back)
function countForPins(key) {
    pinState.counts[key] = (pinState.counts[key] || 0) + 1;
    savePins();
    checkPins();
}

// a book's been lent out (each book counts once toward Matchmaker, each
// person once toward Book Club)
function noteLentForPins(id, name) {
    const who = (name || '').trim().toLowerCase();
    if (!pinState.lentIds.includes(id)) pinState.lentIds.push(id);
    if (who && !pinState.lentTo.includes(who)) pinState.lentTo.push(who);
    savePins();
}

// a lent book came back
function bookBackForPins() {
    awardPin('cameback');
    countForPins('returns');
}

const earnedPins = () => PINS.filter(p => pinState.earned[p.id]);
const unseenPins = () => earnedPins().filter(p => !pinState.seen[p.id]);

// a stable little tilt per pin, so the board doesn't reshuffle
function pinTilt(id, range) {
    let h = 0;
    for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return (h % (range * 2 + 1)) - range;
}

// ----- The corner widget -----
// the three newest pins on a little corkboard, and a "new" badge
function renderPinWidget(justEarned = false) {
    const board = document.getElementById('pin-home-board');
    if (!board) return;
    const newest = earnedPins().sort((a, b) => pinState.earned[b.id] - pinState.earned[a.id]).slice(0, 3);
    board.innerHTML = '';
    newest.forEach(pin => {
        const spot = document.createElement('span');
        spot.className = 'pin-home-pin';
        spot.style.setProperty('--tilt', pinTilt(pin.id, 12) + 'deg');
        spot.innerHTML = pinSvg(pin);
        board.appendChild(spot);
    });
    const fresh = appSettings.pinAlerts ? unseenPins().length : 0;
    const badge = document.getElementById('pin-new');
    badge.textContent = fresh ? `+${fresh}` : '';
    badge.classList.toggle('visible', fresh > 0);
    const home = document.getElementById('pin-home');
    const title = `Pin board: ${earnedPins().length} of ${PINS.length} pins` + (fresh ? ` (${fresh} new)` : '');
    home.title = title;
    home.setAttribute('aria-label', title);
    if (justEarned && appSettings.pinAlerts && !prefersReducedMotion() && home.offsetParent) {
        home.animate([
            { transform: 'rotate(0)' }, { transform: 'rotate(-6deg) scale(1.08)' },
            { transform: 'rotate(5deg)' }, { transform: 'rotate(0)' }
        ], { duration: 600, easing: 'ease-in-out' });
        sparkleFrom(home, 6);
    }
}

// ----- The pin board window -----
const PIN_STICK_WAIT = 1000; // a moment to look at the board before new pins go in

function openPins() {
    checkPins();
    const fresh = unseenPins();
    selectedPin = null;
    document.getElementById('pins-modal').style.display = 'flex';
    renderPinBoard(prefersReducedMotion() ? [] : fresh.map(p => p.id));
    if (!prefersReducedMotion()) {
        document.querySelector('.pins-pop').animate([
            { transform: 'translateY(30px) rotate(-3deg) scale(0.85)', opacity: 0 },
            { transform: 'translateY(-4px) rotate(1deg) scale(1.01)', opacity: 1, offset: 0.65 },
            { transform: 'none' }
        ], { duration: 380, easing: 'cubic-bezier(.3, .8, .4, 1)' });
    }
    if (!fresh.length) return;
    fresh.forEach(p => { pinState.seen[p.id] = true; });
    savePins();
    renderPinWidget();
    // ...then the first of them is picked, so you can see what it's for
    const pickFirst = () => {
        if (pinsOpen() && !selectedPin) showPinDetail(fresh[0].id);
    };
    if (prefersReducedMotion()) return pickFirst();
    // new pins wait off the board, then get pushed in one by one, a
    // little unevenly: dropped in at a slant, pressed down, a wobble
    let at = PIN_STICK_WAIT;
    fresh.forEach((pin, i) => {
        const slot = document.querySelector(`#pins-board .pin-slot[data-pin="${pin.id}"]`);
        const art = slot && slot.querySelector('.pin-art:not(.under)');
        const shadow = slot && slot.querySelector('.pin-art.under');
        if (!art) return;
        const lean = (i % 2 ? 1 : -1) * (6 + Math.random() * 8);
        const dur = 560 + Math.random() * 160;
        // its shadow on the cork shows the whole way down: far off and
        // soft while the pin's up high, closing in and sharpening as it lands
        art.animate([
            { transform: `translate(${lean * 0.8}px, -34px) rotate(${lean}deg) scale(1.55)`, opacity: 0,
                filter: 'drop-shadow(10px 26px 6px rgba(50, 25, 5, 0.38)) drop-shadow(0 30px 14px rgba(40, 20, 5, 0.2))' },
            { opacity: 1, offset: 0.12 },
            { transform: `translate(${lean * 0.15}px, 3px) rotate(${-lean * 0.35}deg) scale(0.9)`, offset: 0.55,
                filter: 'drop-shadow(0.6px 1.3px 0 rgba(60, 30, 8, 0.55)) drop-shadow(0 3px 3px rgba(40, 20, 5, 0.25))' },
            { transform: `rotate(${lean * 0.15}deg) scale(1.04)`, offset: 0.78 },
            { transform: 'none' }
        ], { duration: dur, delay: at, easing: 'cubic-bezier(.3, .7, .4, 1)', fill: 'backwards' });
        setTimeout(() => sparkleFrom(art, 6, 'fx-sparkle-pale'), at + dur * 0.55);
        // it's landed on its shadow: the shadow's gone under it
        if (shadow) setTimeout(() => shadow.remove(), at + dur * 0.55);
        // settled in: light runs across its enamel
        const gleam = art.querySelector('.pin-gleam');
        if (gleam) {
            gleam.animate([
                { transform: 'translateX(0)', opacity: 0.85 },
                { transform: 'translateX(92px)', opacity: 0.85 }
            ], { duration: 750, delay: at + dur + 150, easing: 'ease-in-out' });
        }
        at += 260 + Math.random() * 200;
    });
    setTimeout(pickFirst, at + 500);
}

function closePins() {
    document.getElementById('pins-modal').style.display = 'none';
}

const pinsOpen = () => document.getElementById('pins-modal').style.display === 'flex';

// a little seeded random, so a pin lands in the same spot every time
function pinRandom(seed) {
    let h = 2166136261;
    for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    return () => {
        h = Math.imul(h ^ (h >>> 15), h | 1);
        h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
        return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
    };
}

// Where each pin goes: spread evenly over the board, but by hand, not
// in rows. Each pin starts somewhere random (the roomiest of a few
// spots), then they settle: every pin moves to the middle of the patch
// of board that's closer to it than to any other pin, over and over,
// until each has about the same room (Lloyd's relaxation). That evens
// them out without lining them up, and they never overlap. Worked out
// for the board's size, the same every time.
function scatterPins(width, height, size) {
    const pad = 16 + size / 2;   // clear of the frame
    const w = width - 2 * pad, h = height - 2 * pad;
    const sites = [];
    PINS.forEach(pin => {
        const rand = pinRandom(pin.id);
        let best = null;
        for (let i = 0; i < 8; i++) {
            const x = pad + rand() * w, y = pad + rand() * h;
            const room = sites.reduce((min, p) => Math.min(min, Math.hypot(p.x - x, p.y - y)), Infinity);
            if (!best || room > best.room) best = { x, y, room };
        }
        sites.push({ x: best.x, y: best.y });
    });
    // the board as a fine grid of points, each one counted for its nearest pin
    const step = Math.sqrt(w * h / 6000);
    const points = [];
    for (let y = pad + step / 2; y < pad + h; y += step) {
        for (let x = pad + step / 2; x < pad + w; x += step) points.push([x, y]);
    }
    for (let round = 0; round < 80; round++) {
        const sum = sites.map(() => ({ x: 0, y: 0, n: 0 }));
        points.forEach(([x, y]) => {
            let near = 0, nearD = Infinity;
            sites.forEach((s, i) => {
                const d = (s.x - x) ** 2 + (s.y - y) ** 2;
                if (d < nearD) { nearD = d; near = i; }
            });
            sum[near].x += x; sum[near].y += y; sum[near].n++;
        });
        sites.forEach((s, i) => { if (sum[i].n) { s.x = sum[i].x / sum[i].n; s.y = sum[i].y / sum[i].n; } });
    }
    // settling pulls them in off the edges: stretch them back out to fill
    // the board, so there's no bare strip of cork round the outside
    ['x', 'y'].forEach(k => {
        const lo = Math.min(...sites.map(s => s[k])), hi = Math.max(...sites.map(s => s[k]));
        const span = k === 'x' ? w : h;
        if (hi > lo) sites.forEach(s => { s[k] = pad + (s[k] - lo) / (hi - lo) * span; });
    });
    // then any two a bit closer than the usual gap ease apart, so none
    // end up cramped next to a roomy one
    const nearest = () => sites.map((a, i) => Math.min(...sites.filter((_, j) => j !== i).map(b => Math.hypot(a.x - b.x, a.y - b.y))));
    const gap = 0.97 * nearest().reduce((s, d) => s + d, 0) / sites.length;
    for (let round = 0; round < 80; round++) {
        let moved = false;
        for (let i = 0; i < sites.length; i++) {
            for (let j = i + 1; j < sites.length; j++) {
                const a = sites[i], b = sites[j];
                const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01;
                if (d >= gap) continue;
                const push = (gap - d) / 2 / d * 0.5;
                a.x -= dx * push; a.y -= dy * push;
                b.x += dx * push; b.y += dy * push;
                moved = true;
            }
        }
        sites.forEach(s => {
            s.x = Math.max(pad, Math.min(pad + w, s.x));
            s.y = Math.max(pad, Math.min(pad + h, s.y));
        });
        if (!moved) break;
    }
    // with lots of pins on a small board, the pins get a little smaller
    // rather than overlap
    const closest = Math.min(...sites.flatMap((a, i) => sites.slice(i + 1).map(b => Math.hypot(a.x - b.x, a.y - b.y))));
    return { sites, size: Math.min(size, Math.floor(closest / 1.06)) };
}
// `landing`: ids of new pins about to be pushed in; their shadow shows in
// their spot until they land on it
function renderPinBoard(landing = []) {
    const stats = pinStats();
    const board = document.getElementById('pins-board');
    board.innerHTML = '';
    let size = board.clientWidth >= 560 ? 86 : 62;
    let layout = scatterPins(board.clientWidth, board.clientHeight, size);
    // shrunk to fit: lay them out again at that size, so the margin round
    // the edge is for the smaller pins and they get the room back
    if (layout.size < size) {
        const again = scatterPins(board.clientWidth, board.clientHeight, layout.size);
        if (again.size >= layout.size) layout = again;
    }
    const spots = layout.sites;
    size = layout.size;
    PINS.forEach((pin, i) => {
        const earned = !!pinState.earned[pin.id];
        const slot = document.createElement('div');
        slot.className = 'pin-slot' + (earned ? ' earned' : ' locked');
        slot.dataset.pin = pin.id;
        slot.tabIndex = 0;
        slot.setAttribute('role', 'button');
        // stuck in by hand: a little off its spot and crooked (the same
        // way every time, so the board doesn't reshuffle)
        slot.style.setProperty('--tilt', pinTilt(pin.id, 18) + 'deg');
        slot.style.left = (spots[i].x - size / 2) + 'px';
        slot.style.top = (spots[i].y - size / 2) + 'px';
        slot.style.width = slot.style.height = size + 'px';
        slot.setAttribute('aria-label', earned ? `${pin.name}: earned` : `${pin.name}: not earned yet`);
        slot.title = pin.name;
        slot.innerHTML = (landing.includes(pin.id) ? pinSvg(pin, false).replace('class="pin-art locked"', 'class="pin-art locked under"') : '') + pinSvg(pin, earned);
        // the same pin again puts its card away
        const pick = () => showPinDetail(selectedPin === pin.id ? null : pin.id, stats);
        slot.addEventListener('click', e => { e.stopPropagation(); pick(); });
        // hovering a pin (or a shadow of one to come) shows its card too,
        // till the pointer leaves; a clicked one's card then comes back
        slot.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') drawPinCard(pin.id, stats); });
        slot.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') drawPinCard(selectedPin, stats); });
        slot.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); }
        });
        board.appendChild(slot);
    });
    const card = document.createElement('div');
    card.className = 'pin-detail';
    card.id = 'pin-detail';
    card.setAttribute('role', 'status');
    card.addEventListener('click', e => e.stopPropagation());
    board.appendChild(card);
    showPinDetail(selectedPin, stats);
}

// A paper card about the picked pin, popped up right under it (or above
// it, near the bottom of the board), so it's always next to the pin you
// clicked however far down the board that is.
function showPinDetail(id, stats = pinStats()) {
    selectedPin = id;
    drawPinCard(id, stats);
}

// (draws the card for any pin, picked or just hovered)
function drawPinCard(id, stats = pinStats()) {
    const board = document.getElementById('pins-board');
    const card = document.getElementById('pin-detail');
    if (!board || !card) return;
    board.querySelectorAll('.pin-slot').forEach(s => s.classList.toggle('selected', s.dataset.pin === selectedPin));
    const pin = PINS.find(p => p.id === id);
    const slot = pin && board.querySelector(`.pin-slot[data-pin="${id}"]`);
    card.innerHTML = '';
    card.classList.toggle('visible', !!slot);
    if (!slot) return;

    const name = document.createElement('div');
    name.className = 'pin-detail-name';
    name.textContent = pin.name;
    const desc = document.createElement('div');
    desc.className = 'pin-detail-desc';
    desc.textContent = pin.desc;
    const when = document.createElement('div');
    when.className = 'pin-detail-when';
    card.append(name, desc, when);
    const at = pinState.earned[pin.id];
    const [have, need] = pin.progress(stats);
    if (at) {
        when.textContent = `Pinned ${new Date(at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}`;
    } else if (need > 1) {
        when.textContent = `${have.toLocaleString()} of ${need.toLocaleString()} so far`;
        card.appendChild(goalBar(have, need));
    } else {
        when.textContent = 'Not yet.';
    }

    const gap = 4;
    const left = slot.offsetLeft + slot.offsetWidth / 2 - card.offsetWidth / 2;
    card.style.left = Math.max(8, Math.min(left, board.clientWidth - card.offsetWidth - 8)) + 'px';
    const below = slot.offsetTop + slot.offsetHeight + gap;
    const fitsBelow = below + card.offsetHeight <= board.clientHeight - 6;
    card.style.top = (fitsBelow ? below : slot.offsetTop - card.offsetHeight - gap) + 'px';
    card.classList.toggle('above', !fitsBelow);
    // where its little arrow points (at the pin's middle)
    card.style.setProperty('--point', (slot.offsetLeft + slot.offsetWidth / 2 - parseFloat(card.style.left)) + 'px');
}
function initPins() {
    loadPins();
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && pinsOpen()) closePins(); });
    // the pins are placed for the board's size
    window.addEventListener('resize', () => { if (pinsOpen()) renderPinBoard(); });
    // a click on the cork (not a pin) puts the card away
    document.getElementById('pins-board').addEventListener('click', () => showPinDetail(null));
    pinsReady = true;
    checkPins();
    renderPinWidget();
}
