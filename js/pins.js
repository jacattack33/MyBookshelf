// ---------- Pin board (achievements) ----------
// Enamel pins you earn by reading, stuck on a little corkboard in the
// bottom-left stack (under the stats ledger). Once earned a pin stays, even
// if the books that earned it go. Only Candy shows the board for now (and
// Settings can switch it off); pins are still earned in every theme.

const PINS_KEY = 'bookShelfPins';
// id -> when earned; ids already looked at; things counted as they happen
// (sticky notes stuck up, lent books back); every book ever lent out
let pinState = { earned: {}, seen: {}, counts: {}, lentIds: [] };
let pinsReady = false;                    // checks wait until the critter's loaded
let pinUid = 0;                           // keeps gradient ids unique across SVG copies
let selectedPin = null;

// ----- Pin art -----
// Every pin is drawn in a 48x48 box as a list of parts, bottom to top:
//   ['e', d, colour]           enamel, with a metal border round it
//   ['e', d, colour, 'evenodd'] ...with a hole in it
//   ['d', d, colour]           a bare enamel dot (eyes, cheeks), no border
//   ['l', d]                   a raised metal line
//   ['m', d]                   a solid metal piece
//   ['t', x, y, size, text]    raised metal lettering
// The metal is a hard-banded gradient (polished metal reflects in sharp
// light and dark bands; soft blends are what make it look like wax), plus
// a thin reversed band down the middle of each border for a bevelled edge.
const PIN_METALS = {
    gold: [[0, '#5c3a02'], [0.1, '#a8740f'], [0.2, '#f3d27a'], [0.26, '#fffbe6'], [0.33, '#e0b23e'], [0.46, '#7d5207'],
        [0.56, '#c7932a'], [0.64, '#fbe7a6'], [0.7, '#fffdf0'], [0.77, '#d8a63a'], [0.9, '#8a5c08'], [1, '#4e3102']],
    silver: [[0, '#3f454e'], [0.1, '#7f8792'], [0.2, '#d6dbe1'], [0.26, '#ffffff'], [0.33, '#c4cad2'], [0.46, '#666e79'],
        [0.56, '#a9b0ba'], [0.64, '#eef1f4'], [0.7, '#ffffff'], [0.77, '#b9c0c9'], [0.9, '#6a727d'], [1, '#353a42']]
};

// Candy's colours; each theme with a board can swap them (--pe-* in pins.css)
const PIN_ENAMEL = {
    pink: 'var(--pe-pink, #ff8cc3)', hot: 'var(--pe-hot, #ff4fa3)', lav: 'var(--pe-lav, #c9a6ff)',
    mint: 'var(--pe-mint, #7ee8c4)', yellow: 'var(--pe-yellow, #ffe066)', sky: 'var(--pe-sky, #8fd3ff)',
    peach: 'var(--pe-peach, #ffb48c)', cream: 'var(--pe-cream, #fffaf2)', ink: 'var(--pe-ink, #4a2378)'
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

// a heart centred on (cx, cy), r across
function pinHeart(cx, cy, r) {
    const f = n => n.toFixed(2);
    return `M${f(cx)} ${f(cy + r * 0.9)}C${f(cx - r * 1.35)} ${f(cy + r * 0.05)} ${f(cx - r * 1.05)} ${f(cy - r * 1.05)} ${f(cx)} ${f(cy - r * 0.42)}` +
        `C${f(cx + r * 1.05)} ${f(cy - r * 1.05)} ${f(cx + r * 1.35)} ${f(cy + r * 0.05)} ${f(cx)} ${f(cy + r * 0.9)}Z`;
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
        id: 'owned', name: 'Mine!', desc: 'Add your first book you own.', metal: 'silver', glint: [9, 21], rotate: -25,
        progress: s => [Math.min(s.owned, 1), 1],
        art: [
            ['e', pinCircle(14, 24, 9) + pinCircle(14, 24, 3.6), PIN_E.pink, 'evenodd'],
            ['e', 'M23 21.5h19v5H23Z', PIN_E.pink], ['e', 'M33.5 26.5h3.2v6h-3.2Z', PIN_E.pink], ['e', 'M38.8 26.5h3.2v4h-3.2Z', PIN_E.pink],
            ['d', pinCircle(10.2, 20.6, 1.1), PIN_E.cream]
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
            ['e', 'M24 8C35 8 42 15 42 23C42 29 37 30 33 29C29 28 27 31 29 35C31 39 27 41 22 41C13 41 6 34 6 24C6 15 14 8 24 8Z' + pinCircle(19, 33, 3), PIN_E.cream, 'evenodd'],
            ['e', pinCircle(14, 21, 3.4), PIN_E.pink], ['e', pinCircle(22.5, 15, 3.4), PIN_E.mint],
            ['e', pinCircle(32, 17, 3.2), PIN_E.sky], ['e', pinCircle(11.5, 29.5, 2.8), PIN_E.yellow]
        ]
    },
    {
        id: 'tinker', name: 'Tinkerer', desc: 'Change some shelf settings (Settings > Shelf extras).', metal: 'silver', glint: [13, 12],
        progress: s => [s.tinkered ? 1 : 0, 1],
        art: [
            ['e', starPath(24, 24, 18, 14, 9) + pinCircle(24, 24, 5.5), PIN_E.lav, 'evenodd'],
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
            ['l', 'M11 31v8'], ['l', 'M36 31v8'], ['l', 'M15 23v8'], ['l', 'M36 23v8'], ['l', 'M13 15v8'], ['l', 'M33 15v8'],
            ['d', 'M20 25.6h11v2.8H20Z', PIN_E.yellow]
        ]
    },
    {
        id: 'century', name: 'Century', desc: 'Read 100 books.', metal: 'gold', glint: [16, 25],
        progress: s => [s.readCount, 100],
        art: [
            ['e', 'M8 31L10 13L17.5 22L24 8L30.5 22L38 13L40 31Z', PIN_E.yellow], ['e', 'M7 31h34v10H7Z', PIN_E.pink],
            ['e', pinCircle(10, 12.5, 2.6), PIN_E.mint], ['e', pinCircle(24, 7.5, 3), PIN_E.hot], ['e', pinCircle(38, 12.5, 2.6), PIN_E.sky],
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
        id: 'again', name: 'Second Helping', desc: 'Read a book again (write the re-read on its library card).', metal: 'silver', glint: [11, 13],
        progress: s => [s.reread ? 1 : 0, 1],
        art: [
            ['e', pinCircle(24, 24, 17) + pinCircle(24, 24, 12), PIN_E.lav, 'evenodd'],
            ['e', PIN_HEART, PIN_E.pink],
            ['m', 'M21.5 4.2L28.5 9.5L21.5 14.8Z'], ['m', 'M26.5 33.2L19.5 38.5L26.5 43.8Z']
        ]
    },
    {
        id: 'doorstop', name: 'Doorstopper', desc: 'Read a book of 500 pages or more.', metal: 'gold', glint: [12, 15],
        progress: s => [Math.min(s.longest, 500), 500],
        art: [
            ['e', 'M31 9L39 12.5V42L31 39Z', PIN_E.cream], ['e', 'M9 12L31 9V39L9 41.5Z', PIN_E.sky],
            ['e', 'M13 17L27 15.2V21L13 22.8Z', PIN_E.yellow],
            ['l', 'M33.6 12.6V39.6'], ['l', 'M36.3 13.8V40.6']
        ]
    },
    {
        id: 'speedy', name: 'Speed Reader', desc: 'Finish a book within 3 days of starting it (full dates on both).', metal: 'silver', glint: [28.5, 7],
        progress: s => [s.speedy ? 1 : 0, 1],
        art: [
            ['e', 'M27 4L10 27H22L18 44L38 18H26L31 4Z', PIN_E.yellow],
            ['l', 'M4 31h5'], ['l', 'M6 36h6'], ['l', 'M8 41h5']
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
        id: 'lender', name: 'Lending Library', desc: 'Lend a book out (tick I Own This Book, then fill in Lent to).', metal: 'gold', glint: [21, 15],
        progress: s => [s.lentOut ? 1 : 0, 1],
        art: [
            ['l', 'M13 23C8 19 6 13 10 7'],
            ['e', 'M7 23L17 13H41V33H17Z', PIN_E.cream],
            ['m', pinCircle(14.5, 23, 2.6) + pinCircle(14.5, 23, 1.2)],
            ['t', 29.5, 26.2, 7.4, 'LENT']
        ]
    },
    {
        id: 'cameback', name: 'It Came Back', desc: 'Get back a book you lent out.', metal: 'silver', glint: [24, 8.5], event: true,
        progress: () => [0, 1],
        art: [
            ['e', 'M7 31C13 22 17 15 21 9C23 7 27 8 27 11C24 17 20 24 17 31C25 30 33 31 40 33.5C42 35 41 38.5 38.5 38.5C29 37 19 37 10 38C6 38 5 34 7 31Z', PIN_E.peach],
            ['d', pinCircle(22.6, 13.5, 1.5), PIN_E.mint], ['d', pinCircle(19.6, 19.5, 1.5), PIN_E.mint],
            ['d', pinCircle(26, 34.6, 1.5), PIN_E.mint], ['d', pinCircle(32.5, 35.2, 1.5), PIN_E.mint]
        ]
    },
    {
        id: 'recadd', name: 'Word of Mouth', desc: 'Jot down a book a friend recommended (Slips > From Friends).', metal: 'silver', glint: [10, 17],
        progress: s => [s.recAdded ? 1 : 0, 1],
        art: [
            ['e', 'M6 14H42V38H6Z', PIN_E.pink],
            ['e', 'M6 14L24 28L42 14Z', PIN_E.lav],
            ['d', 'M24 33C21 31 19.6 29.4 19.6 27.7C19.6 26.3 20.7 25.3 21.9 25.3C22.9 25.3 23.6 25.8 24 26.6C24.4 25.8 25.1 25.3 26.1 25.3C27.3 25.3 28.4 26.3 28.4 27.7C28.4 29.4 27 31 24 33Z', PIN_E.hot]
        ]
    },
    {
        id: 'recread', name: 'Good Call', desc: 'Read a book a friend recommended.', metal: 'gold', glint: [11, 14],
        progress: s => [s.recRead ? 1 : 0, 1],
        art: [
            ['e', 'M10 9H38Q42 9 42 13V28Q42 32 38 32H22L13.5 39.5V32H10Q6 32 6 28V13Q6 9 10 9Z', PIN_E.cream],
            ['d', 'M24 27.5C19 24 16.5 21.5 16.5 18.5C16.5 16 18.3 14.3 20.4 14.3C22 14.3 23.3 15.2 24 16.6C24.7 15.2 26 14.3 27.6 14.3C29.7 14.3 31.5 16 31.5 18.5C31.5 21.5 29 24 24 27.5Z', PIN_E.pink]
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
        id: 'genres', name: 'Genre Hopper', desc: 'Read books from 10 different genres.', metal: 'gold', glint: [12, 12],
        progress: s => [Math.min(s.genres, 10), 10],
        art: [
            ['e', pinCircle(24, 24, 17), PIN_E.sky], ['e', pinCircle(24, 24, 12.5), PIN_E.cream],
            ['l', 'M24 8.2v2.4'], ['l', 'M24 37.4v2.4'], ['l', 'M8.2 24h2.4'], ['l', 'M37.4 24h2.4'],
            ['e', 'M24 13L28 24H20Z', PIN_E.hot], ['e', 'M20 24H28L24 35Z', PIN_E.lav], ['m', pinCircle(24, 24, 2)]
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
        id: 'nightowl', name: 'Night Owl', desc: 'Log pages between midnight and 4am.', metal: 'silver', glint: [14, 12],
        progress: s => [s.nightOwl ? 1 : 0, 1],
        art: [
            ['e', 'M22.68 8.02A17 17 0 1 0 38.63 28.52A13 13 0 0 1 22.68 8.02Z', PIN_E.yellow],
            ['e', starPath(36, 9.5, 5.2, 2.3), PIN_E.lav],
            ['d', pinCircle(14.5, 30, 1.5), PIN_E.pink], ['l', 'M9.5 25.5q2.5 2.2 5 0']
        ]
    },
    {
        id: 'dnf', name: 'Life’s Too Short', desc: 'Put down a book you weren’t enjoying (mark it DNF).', metal: 'silver', glint: [33, 10.5],
        progress: s => [s.dnf ? 1 : 0, 1],
        art: [
            ['e', 'M6 43C9 37.5 21 37.5 25 43Z', PIN_E.mint],
            ['m', 'M13.5 7h3v35h-3Z'], ['m', pinCircle(15, 6, 2.6)],
            ['e', 'M17 9C23 6 28 12 35 9V24C28 27 23 21 17 24Z', PIN_E.cream],
            ['d', 'M26 20C23.5 18.3 22.3 17 22.3 15.6C22.3 14.4 23.2 13.6 24.2 13.6C25 13.6 25.6 14 26 14.7C26.4 14 27 13.6 27.8 13.6C28.8 13.6 29.7 14.4 29.7 15.6C29.7 17 28.5 18.3 26 20Z', PIN_E.pink]
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
        id: 'dressed', name: 'Well Dressed Shelf', desc: 'Give 10 books a real cover image.', metal: 'gold', glint: [16, 11],
        progress: s => [Math.min(s.covers, 10), 10],
        art: [
            ['e', 'M11 7H37V41H11Z', PIN_E.sky], ['e', 'M11 7h5v34h-5Z', PIN_E.lav],
            ['e', 'M20 17L27 21.5L20 26Z', PIN_E.hot], ['e', 'M34 17L27 21.5L34 26Z', PIN_E.hot],
            ['m', pinCircle(27, 21.5, 2)],
            ['d', 'M20 32h14v2.6H20Z', PIN_E.cream]
        ]
    },
    {
        id: 'spines', name: 'Spine Collector', desc: 'Add a spine photo to 5 books.', metal: 'silver', glint: [12, 13],
        progress: s => [Math.min(s.spines, 5), 5],
        art: [
            ['e', 'M8 13h7v28H8Z', PIN_E.pink], ['e', 'M15 8h8v33h-8Z', PIN_E.yellow],
            ['e', 'M23 15h6v26h-6Z', PIN_E.mint], ['e', 'M30.5 10.5L37 9L42.5 39L36 40.5Z', PIN_E.lav],
            ['l', 'M8 17h7'], ['l', 'M8 36h7'], ['l', 'M15 12.5h8'], ['l', 'M15 36h8'], ['l', 'M23 19h6'], ['l', 'M23 37h6'],
            ['d', 'M17.5 20h3v10h-3Z', PIN_E.hot]
        ]
    },
    {
        id: 'tagger', name: 'Tagger', desc: 'Use 10 different tags on your books.', metal: 'gold', glint: [19, 15], rotate: -22,
        progress: s => [Math.min(s.tags, 10), 10],
        art: [
            ['e', 'M5 24L16 13H43V35H16Z', PIN_E.mint],
            ['m', pinCircle(13, 24, 2.6) + pinCircle(13, 24, 1.2)],
            ['t', 30, 28, 10, '#tag']
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
        id: 'sticky', name: 'Sticky Fingers', desc: 'Stick up 10 sticky notes (the pile in the corner, or To Buy).', metal: 'silver', glint: [12, 12], rotate: -6,
        progress: s => [Math.min(s.stickies, 10), 10],
        art: [
            ['e', 'M9 9H39V31L31 39H9Z', PIN_E.yellow],
            ['e', 'M31 39V31H39Z', PIN_E.peach],
            ['l', 'M14 17h19'], ['l', 'M14 23h15'], ['l', 'M14 29h11']
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
        id: 'returns', name: 'Return Policy', desc: 'Get 5 lent books back.', metal: 'silver', glint: [12, 12],
        progress: s => [Math.min(s.returns, 5), 5],
        art: [
            ['e', pinCircle(24, 24, 17.5) + pinCircle(24, 24, 12.5), PIN_E.hot, 'evenodd'],
            ['e', pinCircle(24, 24, 12.5), PIN_E.cream],
            ['l', 'M17.5 24.5l4.5 4.5l9 -10'],
            ['d', pinCircle(24, 9, 1.3), PIN_E.cream], ['d', pinCircle(24, 39, 1.3), PIN_E.cream],
            ['d', pinCircle(9, 24, 1.3), PIN_E.cream], ['d', pinCircle(39, 24, 1.3), PIN_E.cream]
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
    }
];

function pinSvg(pin, earned = true) {
    const id = `pin${++pinUid}`;
    const turn = pin.rotate ? ` transform="rotate(${pin.rotate} 24 24)"` : '';
    const enamel = pin.art.filter(p => p[0] === 'e' || p[0] === 'm');
    if (!earned) {
        // not earned yet: just its shape, a flat shadow on the cork
        const shapes = enamel.map(p => `<path d="${p[1]}"${p[3] === 'evenodd' ? ' fill-rule="evenodd"' : ''}/>`).join('');
        return `<svg class="pin-art locked" viewBox="0 0 48 48" aria-hidden="true"><g class="pin-ghost"${turn}>${shapes}</g></svg>`;
    }
    const stops = PIN_METALS[pin.metal].map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('');
    const metal = `url(#${id}a)`, bevel = `url(#${id}b)`;
    const parts = pin.art.map(([kind, a, b, c, d]) => {
        if (kind === 'e') {
            const rule = c === 'evenodd' ? ' fill-rule="evenodd"' : '';
            return `<path d="${a}" style="fill:${b}"${rule}/>` +
                `<path d="${a}" fill="none" stroke="${metal}" stroke-width="1.8" stroke-linejoin="round"/>` +
                `<path d="${a}" fill="none" stroke="${bevel}" stroke-width="0.5" stroke-linejoin="round" opacity="0.65"/>`;
        }
        if (kind === 'd') return `<path d="${a}" style="fill:${b}"/>`;
        if (kind === 'l') return `<path d="${a}" fill="none" stroke="${metal}" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>`;
        if (kind === 'm') return `<path d="${a}" fill="${metal}" stroke="${bevel}" stroke-width="0.6"/>`;
        if (kind === 't') return `<text x="${a}" y="${b}" font-size="${c}" text-anchor="middle" fill="${metal}" stroke="${bevel}" stroke-width="0.25" class="pin-text">${d}</text>`;
        return '';
    }).join('');
    // the enamel's shine: a crisp curved band across the top and one
    // bright streak, cut to the pin's shape
    const clip = enamel.map(p => `<path d="${p[1]}"${turn}${p[3] === 'evenodd' ? ' clip-rule="evenodd"' : ''}/>`).join('');
    const [gx, gy] = pin.glint;
    return `<svg class="pin-art" viewBox="0 0 48 48" aria-hidden="true">
        <defs>
            <linearGradient id="${id}a" gradientUnits="userSpaceOnUse" x1="6" y1="4" x2="42" y2="44">${stops}</linearGradient>
            <linearGradient id="${id}b" gradientUnits="userSpaceOnUse" x1="42" y1="6" x2="6" y2="42">${stops}</linearGradient>
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
function pinStats() {
    const books = visibleBooks();
    const read = books.filter(hasBeenRead);
    const timesRead = b => (b.status === 'Read' ? 1 : 0) + (b.extraReads || []).filter(r => r.finished).length;
    const spans = [];
    books.forEach(b => {
        if (b.status === 'Read') spans.push(daysBetween(b.startedDate, b.finishedDate));
        (b.extraReads || []).forEach(r => spans.push(daysBetween(r.started, r.finished)));
    });
    const log = loadPagesLog();
    const fed = critter ? Math.max(critter.totalFed || 0, ...(critter.past || []).map(p => p.totalFed || 0)) : 0;
    return {
        readCount: read.length,
        fiveStars: books.some(b => normalizeRating(b.rating) >= 5),
        seriesDone: seriesSummary(books).some(s => s.finished),
        reread: books.some(b => timesRead(b) >= 2),
        longest: read.reduce((max, b) => Math.max(max, b.pages || 0), 0),
        speedy: spans.some(d => d !== null && d <= 3),
        goal: appSettings.goal || 0,
        goalDone: booksReadThisYear(),
        critterFed: fed,
        genres: new Set(read.map(b => b.genre).filter(Boolean)).size,
        withNotes: books.filter(b => (b.notes || '').trim()).length,
        pages: pagesOf(finishedReads()),
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
        returns: pinState.counts.returns || 0
    };
}

// the Settings > Shelf extras switches (changing any earns Tinkerer)
const SHELF_EXTRA_SETTINGS = ['cat', 'dust', 'lean', 'sticky', 'critter', 'pins', 'ownedSeal', 'unreadFade'];

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
            pinState = { earned: saved.earned || {}, seen: saved.seen || {}, counts: saved.counts || {}, lentIds: saved.lentIds || [] };
        }
    } catch (e) {}
}

function savePins() {
    try { localStorage.setItem(PINS_KEY, JSON.stringify(pinState)); } catch (e) {}
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

// a book's been lent out (each book counts once toward Matchmaker)
function noteLentForPins(id) {
    if (pinState.lentIds.includes(id)) return;
    pinState.lentIds.push(id);
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
    const fresh = unseenPins().length;
    const badge = document.getElementById('pin-new');
    badge.textContent = fresh ? `+${fresh}` : '';
    badge.classList.toggle('visible', fresh > 0);
    const home = document.getElementById('pin-home');
    const title = `Pin board: ${earnedPins().length} of ${PINS.length} pins` + (fresh ? ` (${fresh} new)` : '');
    home.title = title;
    home.setAttribute('aria-label', title);
    if (justEarned && !prefersReducedMotion() && home.offsetParent) {
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
        setTimeout(() => sparkleFrom(art, 6), at + dur * 0.55);
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
    const layout = scatterPins(board.clientWidth, board.clientHeight, size);
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
