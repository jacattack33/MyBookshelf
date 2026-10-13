// ---------- Reading critter ----------
// A little pet fed with pages read. It gets hungry at your daily pages
// pace (Settings), grows up as it eats, and runs away after a week of
// starving. Each theme has its own critter and home; underneath it's the
// same pet with the same name, age and belly.

const CRITTER_KEY = 'bookShelfCritter';
const CRITTER_FOOD_DAYS = 3;      // a full belly holds this many days of pages
const CRITTER_RUNAWAY_DAYS = 7;   // starving this long and it leaves
const CRITTER_STAGES = [          // by pages ever eaten
    { id: 'baby', at: 1, scale: 0.6 },
    { id: 'kid', at: 150, scale: 0.74 },
    { id: 'teen', at: 600, scale: 0.87 },
    { id: 'adult', at: 1500, scale: 1 }
];
let critter = null;
let critterUid = 0;     // keeps gradient ids unique across the SVG copies
let critterSayTimer = null;

// ----- Critter art -----
// Every critter is drawn standing on (50, 82) of a 100x100 box, adult
// size; each home says where to put it and how big. All the moods' face
// parts are drawn and CSS shows the right ones (see .cr in the styles).

// `sleep` swaps in a critter's own asleep face (eyes and mouth) for the
// plain one
function crFace(x, y, ink, mouth = true, sleep = '') {
    const fill = `style="fill:${ink}"`;
    const line = `fill="none" style="stroke:${ink}" stroke-linecap="round"`;
    const eyes = `<circle cx="${x - 6}" cy="${y}" r="2.4" ${fill}/><circle cx="${x + 6}" cy="${y}" r="2.4" ${fill}/>`;
    const shine = `<circle cx="${x - 5.2}" cy="${y - 0.9}" r="0.8" fill="#fff"/><circle cx="${x + 6.8}" cy="${y - 0.9}" r="0.8" fill="#fff"/>`;
    return `
        <g class="fe fe-open">${eyes}${shine}</g>
        <g class="fe fe-happy" ${line} stroke-width="1.6"><path d="M${x - 8.5} ${y + 1} q2.5 -4 5 0"/><path d="M${x + 3.5} ${y + 1} q2.5 -4 5 0"/></g>
        <g class="fe fe-sleep">${sleep || `<g ${line} stroke-width="1.6"><path d="M${x - 8.5} ${y} q2.5 2.5 5 0"/><path d="M${x + 3.5} ${y} q2.5 2.5 5 0"/></g>`}</g>
        <g class="fe fe-sad">${eyes}<g ${line} stroke-width="1.4"><path d="M${x - 9} ${y - 4} l5 -1.6"/><path d="M${x + 9} ${y - 4} l-5 -1.6"/></g></g>` + (mouth ? `
        <g ${line} stroke-width="1.5">
            <path class="fm fm-smile" d="M${x - 3} ${y + 5} q3 3 6 0"/>
            <path class="fm fm-flat${sleep ? ' fm-awake' : ''}" d="M${x - 2.5} ${y + 6} h5"/>
            <path class="fm fm-frown" d="M${x - 3} ${y + 7.5} q3 -3 6 0"/>
        </g>
        <ellipse class="fm fm-o" cx="${x}" cy="${y + 6}" rx="2" ry="2.4" ${fill}/>` : '');
}

const crCheeks = (x, y, gap, color) =>
    `<ellipse cx="${x - gap}" cy="${y}" rx="3" ry="1.7" fill="${color}" opacity=".45"/><ellipse cx="${x + gap}" cy="${y}" rx="3" ry="1.7" fill="${color}" opacity=".45"/>`;

const crEgg = (shell, spots) => () =>
    `<ellipse cx="50" cy="68" rx="11" ry="14" fill="${shell}" class="cr-ln" stroke-width="1.6"/>
     <circle cx="46" cy="62" r="2.4" fill="${spots}"/><circle cx="54.5" cy="70" r="3" fill="${spots}"/><circle cx="46.5" cy="76" r="1.8" fill="${spots}"/>`;

// pixel art for the Terminal critter: '#' = one square
function crPixels(rows, x0, y0, size, fill) {
    let out = '';
    rows.forEach((row, r) => [...row].forEach((ch, c) => {
        if (ch === '#') out += `<rect x="${x0 + c * size}" y="${y0 + r * size}" width="${size}" height="${size}"/>`;
    }));
    return `<g fill="${fill}" shape-rendering="crispEdges">${out}</g>`;
}

function crPixelFace() {
    const r = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`;
    return `<g fill="#0d1f12" shape-rendering="crispEdges">
        <g class="fe fe-open">${r(40, 58, 4, 4)}${r(56, 58, 4, 4)}</g>
        <g class="fe fe-happy">${r(39, 60, 2, 2)}${r(41, 58, 2, 2)}${r(43, 60, 2, 2)}${r(55, 60, 2, 2)}${r(57, 58, 2, 2)}${r(59, 60, 2, 2)}</g>
        <g class="fe fe-sleep">${r(40, 60, 4, 2)}${r(56, 60, 4, 2)}</g>
        <g class="fe fe-sad">${r(40, 59, 4, 3)}${r(56, 59, 4, 3)}${r(42, 56, 2, 2)}${r(56, 56, 2, 2)}</g>
        <g class="fm fm-smile">${r(44, 66, 2, 2)}${r(46, 68, 8, 2)}${r(54, 66, 2, 2)}</g>
        <g class="fm fm-flat">${r(46, 67, 8, 2)}</g>
        <g class="fm fm-frown">${r(46, 66, 8, 2)}${r(44, 68, 2, 2)}${r(54, 68, 2, 2)}</g>
        <g class="fm fm-o">${r(48, 66, 4, 4)}</g>
    </g>`;
}

// the songbird's cage bars, following the dome; a gap in the middle
// where the door's open (so they don't cross its face)
function crCageBars() {
    return [18, 24.4, 30.8, 37.2, 62.8, 69.2, 75.6, 82].map(x => {
        const top = 44 - Math.sqrt(Math.max(0, 32 * 32 - (x - 50) ** 2));
        return `<path d="M${x} 86 V${top.toFixed(1)}"/>`;
    }).join('');
}

const CRITTER_THEMES = {
    candy: {
        kind: 'gummy blob', name: 'Gummy', fit: [50, 86, 0.95], zz: [68, 46],
        egg: crEgg('#ffd1e8', '#ff7ab8'),
        art: () => `
            <g class="cr-teen"><circle cx="37" cy="50" r="5.5" fill="#ff6fae" class="cr-ln" stroke-width="1.5"/><circle cx="63" cy="50" r="5.5" fill="#ff6fae" class="cr-ln" stroke-width="1.5"/></g>
            <path d="M30 82 C27 62 34 46 50 46 C66 46 73 62 70 82 Z" fill="#ff6fae" class="cr-ln" stroke-width="1.5"/>
            <ellipse cx="40" cy="56" rx="5" ry="2.6" fill="#fff" opacity=".55" transform="rotate(-30 40 56)"/>
            <g class="cr-adult">
                <rect x="42" y="49" width="4" height="1.6" rx=".8" fill="#ffe066" transform="rotate(-20 44 50)"/>
                <rect x="49" y="47.5" width="4" height="1.6" rx=".8" fill="#9fdcff" transform="rotate(15 51 48)"/>
                <rect x="56" y="49.5" width="4" height="1.6" rx=".8" fill="#5fe8c4" transform="rotate(-35 58 50)"/>
                <rect x="45" y="52.5" width="4" height="1.6" rx=".8" fill="#fff" transform="rotate(40 47 53)"/>
                <rect x="53" y="52" width="4" height="1.6" rx=".8" fill="#b57bff" transform="rotate(-10 55 53)"/>
            </g>
            ${crCheeks(50, 69, 10, '#ff2e7e')}
            ${crFace(50, 64, '#5a1a3a')}`,
        back: () => `<rect x="14" y="26" width="72" height="66" rx="14" fill="#fff" fill-opacity=".35" class="cr-ln" stroke-width="2"/>`,
        front: () => `
            <circle cx="24" cy="85" r="4.5" fill="#ffe066" class="cr-ln" stroke-width="1"/>
            <circle cx="33" cy="88" r="4" fill="#9fdcff" class="cr-ln" stroke-width="1"/>
            <circle cx="67" cy="88" r="4" fill="#5fe8c4" class="cr-ln" stroke-width="1"/>
            <circle cx="76" cy="85" r="4.5" fill="#b57bff" class="cr-ln" stroke-width="1"/>
            <path d="M22 38 V70" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>
            <rect x="18" y="18" width="64" height="11" rx="4" fill="#ff9ecf" class="cr-ln" stroke-width="2"/>
            <rect x="40" y="12" width="20" height="7" rx="3" fill="#ffd1e8" class="cr-ln" stroke-width="1.5"/>`
    },
    seaglass: {
        kind: 'hermit crab', name: 'Shelly', fit: [50, 85, 0.82], zz: [68, 42],
        egg: crEgg('#e9f6f1', '#8fd8c4'),
        art: () => `
            <g stroke="#e0603f" stroke-width="2" stroke-linecap="round"><path d="M38 78 l-5 5"/><path d="M43 80 l-3 4"/><path d="M62 78 l5 5"/><path d="M57 80 l3 4"/></g>
            <circle cx="50" cy="58" r="16" fill="#f2c48d" class="cr-ln" stroke-width="1.5"/>
            <path d="M50 58 m-3 0 a3 3 0 1 1 6 0 a6 6 0 1 1 -12 0 a9.5 9.5 0 1 1 19 0" fill="none" stroke="#c98f52" stroke-width="1.6"/>
            <g class="cr-adult"><path d="M50 37 l1.8 3.8 4.2 .5 -3.1 2.9 .8 4.1 -3.7 -2 -3.7 2 .8 -4.1 -3.1 -2.9 4.2 -.5z" fill="#ffb35c" class="cr-ln" stroke-width="1"/></g>
            <ellipse cx="50" cy="74" rx="15" ry="9" fill="#ff8a6b" class="cr-ln" stroke-width="1.5"/>
            <circle cx="33" cy="73" r="3.4" fill="#ff6f4f" class="cr-ln" stroke-width="1.2"/><circle cx="67" cy="73" r="3.4" fill="#ff6f4f" class="cr-ln" stroke-width="1.2"/>
            <g class="cr-teen"><path d="M28 72 a5.5 5.5 0 1 1 8 4 l-3 -3z" fill="#ff6f4f" class="cr-ln" stroke-width="1.2"/><path d="M72 72 a5.5 5.5 0 1 0 -8 4 l3 -3z" fill="#ff6f4f" class="cr-ln" stroke-width="1.2"/></g>
            ${crFace(50, 72, '#5a2418')}`,
        back: () => `
            <path d="M41 10 h18 v12 q0 6 10 11 q15 8 15 23 v28 q0 8 -8 8 h-52 q-8 0 -8 -8 v-28 q0 -15 15 -23 q10 -5 10 -11 z" fill="#8fd8c4" fill-opacity=".38" class="cr-ln" stroke-width="2"/>
            <path d="M16.5 80 q33 -7 67 0 v4 q0 8 -8 8 h-51 q-8 0 -8 -8 z" fill="#f1dfb0"/>`,
        front: () => `
            <rect x="40" y="4" width="20" height="9" rx="2" fill="#c99a63" class="cr-ln" stroke-width="1.5"/>
            <path d="M24 52 q2 -8 9 -12" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none" opacity=".7"/>
            <circle cx="26" cy="87" r="2.5" fill="#fff" opacity=".8"/><path d="M70 89 l3 -5 3 5z" fill="#ff9eb0"/>`
    },
    holo: {
        kind: 'alien critter', name: 'Zib', fit: [50, 70, 0.75], zz: [66, 36],
        egg: crEgg('#f3e8ff', '#5fe8c4'),
        art: () => `
            <path d="M44 51 q-3 -7 -7 -9" fill="none" class="cr-ln" stroke-width="1.5"/><path d="M56 51 q3 -7 7 -9" fill="none" class="cr-ln" stroke-width="1.5"/>
            <circle cx="37" cy="42" r="2.6" fill="#ff8ad8" class="cr-ln" stroke-width="1"/><circle cx="63" cy="42" r="2.6" fill="#b57bff" class="cr-ln" stroke-width="1"/>
            <g class="cr-adult"><path d="M50 49 v-10" fill="none" class="cr-ln" stroke-width="1.5"/><circle cx="50" cy="38" r="2.8" fill="#ffe066" class="cr-ln" stroke-width="1"/></g>
            <g class="cr-teen">
                <path d="M34 62 l-8 -6 l9 0z" fill="#7ee8b6" class="cr-ln" stroke-width="1.2" stroke-linejoin="round"/>
                <path d="M66 62 l8 -6 l-9 0z" fill="#7ee8b6" class="cr-ln" stroke-width="1.2" stroke-linejoin="round"/>
            </g>
            <path d="M32 79 C30 58 38 49 50 49 C62 49 70 58 68 79 q-3 5 -6 0 q-3 5 -6 0 q-3 5 -6 0 q-3 5 -6 0 q-3 5 -6 0 q-3 5 -6 0 Z" fill="#9ef0c8" class="cr-ln" stroke-width="1.5" stroke-linejoin="round"/>
            <g fill="#6fd6a8"><circle cx="40" cy="56" r="1.6"/><circle cx="61" cy="55" r="1.2"/><circle cx="63" cy="72" r="1.5"/><circle cx="37" cy="73" r="1.2"/></g>
            <ellipse cx="50" cy="73" rx="8" ry="4.5" fill="#fff" opacity=".45"/>
            ${crCheeks(50, 67, 10, '#ff8ad8')}
            ${crFace(50, 62, '#1f2a4a')}`,
        back: uid => `
            <defs><linearGradient id="${uid}h" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#ffd6f5"/><stop offset=".35" stop-color="#c9f3ff"/><stop offset=".7" stop-color="#e3d4ff"/><stop offset="1" stop-color="#fff3b8"/>
            </linearGradient></defs>
            <path d="M50 4 C76 4 92 38 92 60 C92 84 74 96 50 96 C26 96 8 84 8 60 C8 38 24 4 50 4 Z" fill="url(#${uid}h)" class="cr-ln" stroke-width="2"/>
            <rect x="25" y="24" width="50" height="48" rx="9" fill="#f2fdff" class="cr-ln" stroke-width="1.8"/>`,
        front: () => `
            <circle cx="35" cy="82" r="4" fill="#ff8ad8" class="cr-ln" stroke-width="1.2"/>
            <circle cx="50" cy="86" r="4" fill="#b57bff" class="cr-ln" stroke-width="1.2"/>
            <circle cx="65" cy="82" r="4" fill="#5fe8c4" class="cr-ln" stroke-width="1.2"/>
            <path d="M31 30 h9" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".9"/>`
    },
    library: {
        kind: 'bookworm', name: 'Wormsley', fit: [51, 66, 0.78], zz: [70, 30],
        egg: crEgg('#f3e6c8', '#9ed97a'),
        art: () => `
            <path d="M52 86 C52 74 44 70 46 58" fill="none" class="cr-ln" stroke-width="17" stroke-linecap="round"/>
            <path d="M52 86 C52 74 44 70 46 58" fill="none" stroke="#8fcf6b" stroke-width="14" stroke-linecap="round"/>
            <path d="M44.5 74 q5 -2 9.5 0 M44 66 q4.5 -2 8.5 0" fill="none" stroke="#6aa94a" stroke-width="1.4"/>
            <circle cx="46" cy="52" r="12" fill="#9ed97a" class="cr-ln" stroke-width="1.5"/>
            ${crCheeks(46, 57, 8, '#ff7a8a')}
            ${crFace(46, 52, '#24331a')}
            <g class="cr-teen" fill="none" stroke="#3b2a1e" stroke-width="1.3"><circle cx="40" cy="52" r="4.2"/><circle cx="52" cy="52" r="4.2"/><path d="M44.2 52 h3.6"/></g>
            <g class="cr-adult">
                <path d="M46 44 l-14 -5 14 -5 14 5z" fill="#2b2233"/><path d="M38 40 v3.5 q8 3 16 0 v-3.5" fill="#2b2233"/>
                <path d="M60 39 v7" stroke="#ffd84a" stroke-width="1.4"/><circle cx="60" cy="46.5" r="1.4" fill="#ffd84a"/>
            </g>`,
        back: () => `
            <path d="M24 54 L30 12 H90 L88 54 Z" fill="#8b4a2b" class="cr-ln" stroke-width="2"/>
            <path d="M44 24 h32 M48 30 h24" stroke="#e8c36a" stroke-width="2" stroke-linecap="round"/>
            <path d="M12 64 L24 54 H88 L76 64 Z" fill="#f3e6c8" class="cr-ln" stroke-width="2"/>
            <ellipse cx="50" cy="59" rx="17" ry="3.2" fill="#3b2418"/>`,
        front: () => `
            <rect x="12" y="64" width="64" height="24" fill="#f3e6c8" class="cr-ln" stroke-width="2"/>
            <path d="M14 70 h60 M14 75 h60 M14 80 h60" stroke="#d9c49a" stroke-width="1"/>
            <rect x="10" y="62" width="68" height="4" rx="1.5" fill="#8b4a2b" class="cr-ln" stroke-width="1.5"/>
            <rect x="10" y="86" width="68" height="4" rx="1.5" fill="#8b4a2b" class="cr-ln" stroke-width="1.5"/>
            <path d="M78 64 L88 54 V78 L78 88 Z" fill="#6b3520" class="cr-ln" stroke-width="2"/>`
    },
    deco: {
        kind: 'songbird', name: 'Pip', fit: [50, 79, 0.7], zz: [64, 36],
        egg: crEgg('#fff6dc', '#c9a24a'),
        art: () => `
            <g class="cr-teen"><path d="M60 74 l16 6 -14 3z" fill="#2f8f86" class="cr-ln" stroke-width="1.2"/></g>
            <g class="cr-adult"><path d="M50 45 q-3 -10 4 -15 q-1 8 1 14z M49 45 q-7 -6 -6 -12 q3 6 7 11z" fill="#2f8f86" class="cr-ln" stroke-width="1"/></g>
            <path d="M46 81 l-2 5 M54 81 l2 5" stroke="#ff8a3d" stroke-width="2" stroke-linecap="round"/>
            <path d="M50 44 C61 44 64 54 62 60 C70 66 68 82 50 82 C33 82 31 66 38 60 C36 54 39 44 50 44 Z" fill="#ffd36b" class="cr-ln" stroke-width="1.5"/>
            <path d="M57 64 q11 3 7 14 q-9 -2 -11 -10z" fill="#f2b33d" class="cr-ln" stroke-width="1"/>
            ${crCheeks(50, 59, 8, '#ff7a5a')}
            ${crFace(50, 54, '#2b2233', false)}
            <path d="M47.5 57.5 h5 l-2.5 3.5z" fill="#ff8a3d" class="cr-ln" stroke-width=".8"/>`,
        back: () => `
            <circle cx="50" cy="7" r="4" fill="none" stroke="#c9a24a" stroke-width="2"/>
            <path d="M18 86 V44 A32 32 0 0 1 82 44 V86 Z" fill="#c9a24a" fill-opacity=".12"/>
            <line x1="24" y1="81" x2="76" y2="81" stroke="#8a6a2a" stroke-width="3" stroke-linecap="round"/>`,
        front: () => `
            <g stroke="#c9a24a" stroke-width="1.3" fill="none">${crCageBars()}<path d="M18 86 V44 A32 32 0 0 1 82 44 V86" stroke-width="2"/><path d="M18 50 H82"/></g>
            <rect x="13" y="84" width="74" height="8" rx="2" fill="#c9a24a" class="cr-ln" stroke-width="1.5"/>
            <path d="M44 89.5 l6 -3 6 3" fill="none" stroke="#fff6dc" stroke-width="1.2"/>`
    },
    loft: {
        kind: 'moss sprout', name: 'Moss', fit: [52, 84, 0.78], zz: [70, 38],
        egg: crEgg('#e6dccb', '#7fb069'),
        art: () => `
            <path d="M50 57 V44" stroke="#5f9a4c" stroke-width="2" stroke-linecap="round"/>
            <path d="M50 48 q-10 -9 -15 -3 q6 7 15 3z" fill="#9bd17a" class="cr-ln" stroke-width="1.1"/>
            <path d="M50 48 q10 -9 15 -3 q-6 7 -15 3z" fill="#9bd17a" class="cr-ln" stroke-width="1.1"/>
            <g class="cr-adult">
                <g fill="#ff9eb0"><circle cx="50" cy="38" r="2.4"/><circle cx="53" cy="40.2" r="2.4"/><circle cx="51.8" cy="43.6" r="2.4"/><circle cx="48.2" cy="43.6" r="2.4"/><circle cx="47" cy="40.2" r="2.4"/></g>
                <circle cx="50" cy="41" r="1.8" fill="#ffe066"/>
            </g>
            <g class="cr-teen"><path d="M31 70 q-8 -4 -8 -10 q7 1 9 7z" fill="#9bd17a" class="cr-ln" stroke-width="1.1"/></g>
            <path d="M30 82 C28 62 36 56 50 56 C64 56 72 62 70 82 Z" fill="#7fb069" class="cr-ln" stroke-width="1.5"/>
            <g fill="#5f9a4c"><circle cx="38" cy="64" r="1.3"/><circle cx="63" cy="66" r="1.5"/><circle cx="58" cy="77" r="1.2"/><circle cx="37" cy="76" r="1.4"/></g>
            ${crCheeks(50, 72, 10, '#ff7a8a')}
            ${crFace(50, 67, '#24331a')}`,
        back: () => `
            <rect x="14" y="22" width="72" height="70" rx="12" fill="#dff3e6" fill-opacity=".4" class="cr-ln" stroke-width="2"/>
            <path d="M15 80 Q50 74 85 80 V82 Q85 91 74 91 H26 Q15 91 15 82 Z" fill="#6b4a32"/>
            <path d="M24 80 q-2 -14 -8 -20 M24 80 q2 -12 8 -16 M78 79 q0 -10 4 -14" fill="none" stroke="#5f9a4c" stroke-width="2" stroke-linecap="round"/>`,
        front: () => `
            <g fill="#b8b2a7" class="cr-ln" stroke-width=".8"><ellipse cx="30" cy="87" rx="4" ry="2.5"/><ellipse cx="70" cy="86" rx="3.5" ry="2.2"/><ellipse cx="62" cy="89" rx="2.5" ry="1.6"/></g>
            <path d="M21 34 V64" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>
            <rect x="22" y="14" width="56" height="10" rx="3" fill="#b88a5a" class="cr-ln" stroke-width="2"/>`
    },
    blueprint: {
        kind: 'pup', name: 'Bolt', fit: [50, 84, 0.8], zz: [70, 36],
        egg: () => `
            <ellipse cx="50" cy="68" rx="11" ry="14" fill="none" class="cr-ln" stroke-width="1.4" stroke-dasharray="3 2"/>
            <path d="M37 68 h26 M50 52 v32" fill="none" class="cr-ln" stroke-width=".6"/>`,
        // a sitting pup, line-drawn like a drafted sketch: its head filled
        // with paper so the grid doesn't run through its face, floppy
        // shaded ears, a collar tag and hard hat in the accent
        art: () => `
            <g fill="none" class="cr-ln" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">
                <path d="M63 78 q9 -1 8 -11"/>
                <path d="M41 61 q-5 10 -4 21 h26 q1 -11 -4 -21"/>
                <path d="M45 69 v13 M55 69 v13 M42 82 h6 M52 82 h6"/>
            </g>
            <g class="cr-teen">
                <path d="M42 61.5 q8 3.5 16 0" fill="none" style="stroke:var(--y2k-pink)" stroke-width="2.6" stroke-linecap="round"/>
                <circle cx="50" cy="65.6" r="2.2" class="cr-ln" stroke-width="1" style="fill:var(--y2k-pink)"/>
            </g>
            <g class="cr-ln" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">
                <ellipse cx="50" cy="49" rx="14.5" ry="12.5" style="fill:var(--surface)"/>
                <ellipse cx="50" cy="55" rx="6.5" ry="4.5" stroke="none" style="fill:var(--outline)" opacity=".08"/>
                <path d="M38 40 C31 40 29 51 32 58 C34 61 38 59 39 54 Z" style="fill:var(--surface)"/>
                <path d="M62 40 C69 40 71 51 68 58 C66 61 62 59 61 54 Z" style="fill:var(--surface)"/>
                <path d="M38 40 C31 40 29 51 32 58 C34 61 38 59 39 54 Z M62 40 C69 40 71 51 68 58 C66 61 62 59 61 54 Z" stroke="none" style="fill:var(--outline)" opacity=".18"/>
            </g>
            <g class="cr-adult">
                <path d="M39 39.5 a11 10 0 0 1 22 0 Z" class="cr-ln" stroke-width="1.3" stroke-linejoin="round" style="fill:var(--y2k-pink)"/>
                <path d="M50 29.5 v10" fill="none" class="cr-ln" stroke-width="1"/>
                <rect x="35" y="38.6" width="30" height="2.8" rx="1.4" class="cr-ln" stroke-width="1.3" style="fill:var(--y2k-pink)"/>
            </g>
            ${crCheeks(50, 55, 10.5, '#f07c2a')}
            <ellipse cx="50" cy="52.6" rx="2.2" ry="1.5" style="fill:var(--outline)"/>
            ${crFace(50, 49, 'var(--outline)', true, `
                <g fill="none" style="stroke:var(--outline)" stroke-linecap="round" stroke-width="1.6">
                    <path d="M40.5 48.5 q3.5 3.4 7 0 M52.5 48.5 q3.5 3.4 7 0"/>
                    <path d="M40.5 48.5 l-1.4 .8 M59.5 48.5 l1.4 .8" stroke-width="1.1"/>
                    <path d="M47 54.6 q1.5 1.7 3 0 q1.5 1.7 3 0" stroke-width="1.3"/>
                </g>`)}`,
        back: () => `
            <g fill="none" class="cr-ln">
                <rect x="12" y="14" width="76" height="72" stroke-width="1.4" stroke-dasharray="4 3"/>
                <path d="M12 30 h76 M12 46 h76 M12 62 h76 M12 78 h76 M28 14 v72 M44 14 v72 M60 14 v72 M76 14 v72" stroke-width=".4" opacity=".35"/>
            </g>`,
        front: () => `
            <g fill="none" class="cr-ln" stroke-width=".9"><path d="M12 92 h76 M12 89 v6 M88 89 v6 M93 14 v72 M90 14 h6 M90 86 h6"/></g>
            <text x="50" y="99" text-anchor="middle" font-size="5" font-family="monospace" style="fill:var(--outline)">W 76</text>`
    },
    terminal: {
        kind: 'pixel pet', name: 'Bit', fit: [50, 74, 0.82], zz: [64, 38], zzInk: '#39ff6a',
        egg: () => crPixels(['..##..', '.####.', '######', '##.###', '######', '.####.'], 38, 58, 4, '#39ff6a'),
        art: () => `
            ${crPixels(['...........', '...........', '..#######..', '.#########.', '.#########.', '.#########.', '.#########.', '..#######..', '..##...##..', '..##...##..'], 28, 42, 4, '#39ff6a')}
            <g class="cr-teen">${crPixels(['..#.....#..', '..##...##..'], 28, 42, 4, '#39ff6a')}</g>
            <g class="cr-adult">${crPixels(['...........#', '..........#.', '..........#.'], 28, 58, 4, '#39ff6a')}</g>
            ${crPixelFace()}`,
        back: () => `
            <rect x="8" y="12" width="84" height="80" rx="9" fill="#d8cfb4" stroke="#7a705a" stroke-width="2"/>
            <rect x="15" y="18" width="70" height="60" rx="3" fill="#0d1f12" stroke="#7a705a" stroke-width="1.5"/>`,
        front: () => {
            let lines = '';
            for (let y = 20; y < 78; y += 2.5) lines += `<path d="M16 ${y} h68"/>`;
            return `<g stroke="#000" stroke-width=".6" opacity=".25">${lines}</g>
                <circle cx="80" cy="85" r="2" fill="#39ff6a"/>
                <text x="17" y="88" font-size="6" font-weight="700" font-family="monospace" fill="#7a705a">BOOK-8</text>`;
        }
    },
    typewriter: {
        kind: 'ink drop', name: 'Inky', fit: [48, 86, 0.9], zz: [64, 38],
        egg: crEgg('#e9eef5', '#2b3a67'),
        art: () => `
            <g class="cr-teen"><path d="M50 41 q7 -6 3 -11 q-4 -3 -6 1" fill="none" stroke="#2b3a67" stroke-width="2.2" stroke-linecap="round"/></g>
            <path d="M50 40 C52 48 66 58 66 69 C66 78 59 83 50 83 C41 83 34 78 34 69 C34 58 48 48 50 40 Z" fill="#2b3a67" class="cr-ln" stroke-width="1.5"/>
            <ellipse cx="41" cy="65" rx="2.4" ry="5.5" fill="#fff" opacity=".35" transform="rotate(18 41 65)"/>
            <g class="cr-adult">
                <path d="M42 55 q-9 -17 -23 -25 q4 13 21 26z" fill="#f4eedd" class="cr-ln" stroke-width="1"/>
                <path d="M42 55 l-20 -22" stroke="#b3261e" stroke-width="1"/>
            </g>
            ${crCheeks(50, 74, 9, '#ff8a9a')}
            ${crFace(50, 69, '#f4eedd')}`,
        // an inkwell with a little pool of ink in the bottom
        back: () => `
            <path d="M38 10 h24 v12 q0 4 6 7 q18 8 18 26 v29 q0 8 -8 8 h-56 q-8 0 -8 -8 v-29 q0 -18 18 -26 q6 -3 6 -7 z" fill="#d9e4ec" fill-opacity=".35" class="cr-ln" stroke-width="2"/>
            <path d="M14.5 80 q35 -5 71 0 v4 q0 7.5 -7.5 7.5 h-56 q-7.5 0 -7.5 -7.5 z" fill="#1c2a4a"/>`,
        front: () => `
            <rect x="35" y="7" width="30" height="6" rx="2" fill="#c9c4bb" class="cr-ln" stroke-width="1.5"/>
            <path d="M21 52 q2 -9 9 -14" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none" opacity=".7"/>
            <rect x="65" y="56" width="17" height="12" rx="1.5" fill="#f4eedd" class="cr-ln" stroke-width="1"/>
            <text x="73.5" y="64.5" text-anchor="middle" font-size="6" font-family="'Special Elite', monospace" fill="#b3261e">INK</text>`
    },
    sunset: {
        kind: 'little sun', name: 'Sol', fit: [50, 79, 0.95], zz: [70, 38],
        egg: crEgg('#ffe9b0', '#f7821e'),
        art: () => {
            const ray = a => {
                const p = (r, d) => `${(50 + r * Math.cos((a + d) * Math.PI / 180)).toFixed(1)} ${(66 + r * Math.sin((a + d) * Math.PI / 180)).toFixed(1)}`;
                return `<path d="M${p(16, -9)} L${p(24, 0)} L${p(16, 9)}z"/>`;
            };
            const heart = x => `<path d="M${x} 54.5 l-3.4 -3.4 a1.9 1.9 0 0 1 3.4 -2.4 a1.9 1.9 0 0 1 3.4 2.4 z"/>`;
            return `
            <circle cx="50" cy="66" r="20" fill="#ffd56b" opacity=".35"/>
            <g class="cr-teen cr-ln" fill="#f7821e" stroke-width="1" stroke-linejoin="round">${[-160, -125, -90, -55, -20].map(ray).join('')}</g>
            <circle cx="50" cy="66" r="15" fill="#fcc21b" class="cr-ln" stroke-width="1.5"/>
            <ellipse cx="43" cy="60" rx="4" ry="2.2" fill="#fff" opacity=".5" transform="rotate(-30 43 60)"/>
            <g class="cr-adult cr-ln" fill="#d40848" stroke-width=".8">${heart(45)}${heart(55)}<path d="M48.4 51.6 h3.2" fill="none" stroke="#6a0048" stroke-width="1"/></g>
            ${crCheeks(50, 70, 9, '#f0282a')}
            ${crFace(50, 65, '#6a0048')}`;
        },
        // a round porthole onto the sky at sunset
        back: uid => `
            <defs><linearGradient id="${uid}s" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#3a1a7a"/><stop offset=".35" stop-color="#9c0a55"/><stop offset=".6" stop-color="#f0282a"/><stop offset=".8" stop-color="#f7821e"/><stop offset="1" stop-color="#fcc21b"/>
            </linearGradient></defs>
            <circle cx="50" cy="52" r="40" fill="url(#${uid}s)"/>
            <g fill="#fff3e0"><circle cx="34" cy="24" r=".9"/><circle cx="62" cy="19" r="1.1"/><circle cx="72" cy="30" r=".8"/><circle cx="25" cy="36" r=".7"/></g>`,
        front: uid => `
            <defs><clipPath id="${uid}c"><circle cx="50" cy="52" r="40"/></clipPath></defs>
            <g clip-path="url(#${uid}c)">
                <path d="M8 80 q20 -10 42 -2 q22 8 42 -4 V96 H8z" fill="#d40848"/>
                <path d="M8 88 q26 -8 50 0 q18 5 34 -2 V96 H8z" fill="#9c0a55"/>
            </g>
            <circle cx="50" cy="52" r="40" fill="none" stroke="#f7c35c" stroke-width="4"/>
            <circle cx="50" cy="52" r="42" fill="none" class="cr-ln" stroke-width="1.5"/>
            <circle cx="50" cy="52" r="38" fill="none" class="cr-ln" stroke-width="1"/>`
    }
};

// The plain themes share a plain cat, drawn flat in the colours of
// whichever tint is picked (with Paper's greys as fallbacks, for the
// scrapbook in other themes)
const crP = (name, paper) => `var(--p-${name}, ${paper})`;
const PLAIN_FUR = crP('s2', '#4a4a4a'), PLAIN_PALE = crP('t3', '#d2d2cd'), PLAIN_FACE = crP('surface', '#ffffff');

CRITTER_THEMES.plain = CRITTER_THEMES.plainbold = {
    kind: 'cat', name: 'Dot', fit: [50, 84, 0.8], zz: [67, 50],
    egg: () => `
        <ellipse cx="50" cy="68" rx="11" ry="14" class="cr-ln" stroke-width="1.6" style="fill:${PLAIN_FACE}"/>
        <path d="M39.4 66 h21.2 v4 h-21.2z" style="fill:${PLAIN_PALE}"/>`,
    art: () => `
        <path d="M62 79 q13 1 12 -12 q-.5 -5 -5 -5" fill="none" class="cr-ln" stroke-width="6" stroke-linecap="round"/>
        <path d="M62 79 q13 1 12 -12 q-.5 -5 -5 -5" fill="none" stroke-width="3.6" stroke-linecap="round" style="stroke:${PLAIN_FUR}"/>
        <path d="M36 82 C34 70 38 61 50 61 C62 61 66 70 64 82 Z" class="cr-ln" stroke-width="1.5" style="fill:${PLAIN_FUR}"/>
        <ellipse cx="50" cy="74" rx="7" ry="6.5" style="fill:${PLAIN_PALE}"/>
        <g class="cr-ln" stroke-width="1.2" style="fill:${PLAIN_PALE}"><ellipse cx="44.5" cy="81.5" rx="4" ry="2.4"/><ellipse cx="55.5" cy="81.5" rx="4" ry="2.4"/></g>
        <g class="cr-ln" stroke-width="1.5" stroke-linejoin="round" style="fill:${PLAIN_FUR}"><path d="M38 47 L37 34 L47 41 Z"/><path d="M62 47 L63 34 L53 41 Z"/></g>
        <g style="fill:${PLAIN_PALE}"><path d="M39.5 44 L39.2 38 L44 41.4 Z"/><path d="M60.5 44 L60.8 38 L56 41.4 Z"/></g>
        <ellipse cx="50" cy="51" rx="14" ry="12" class="cr-ln" stroke-width="1.5" style="fill:${PLAIN_FUR}"/>
        <g class="cr-teen">
            <path d="M41.5 61.5 q8.5 3.6 17 0" fill="none" stroke-width="2.4" stroke-linecap="round" style="stroke:${PLAIN_PALE}"/>
            <circle cx="50" cy="65.4" r="2.1" fill="#e3b04b" class="cr-ln" stroke-width="1"/>
        </g>
        <g fill="none" stroke-width=".8" stroke-linecap="round" opacity=".6" style="stroke:${PLAIN_FACE}"><path d="M35 54 h6 M35.5 57.5 l5.5 -1.5 M65 54 h-6 M64.5 57.5 l-5.5 -1.5"/></g>
        <path d="M48.6 54.4 h2.8 l-1.4 1.6z" style="fill:${PLAIN_PALE}"/>
        ${crFace(50, 51, PLAIN_FACE)}
        <g class="cr-adult" fill="none" stroke-width="1.2" style="stroke:${PLAIN_PALE}"><circle cx="44" cy="51" r="4.3"/><circle cx="56" cy="51" r="4.3"/><path d="M48.3 51 h3.4 M39.7 50.5 l-3.5 -1.5 M60.3 50.5 l3.5 -1.5"/></g>`,
    // a plain room: a wall, a floor, a cushion, a picture and a few books
    back: () => `
        <rect x="14" y="16" width="72" height="72" rx="6" class="cr-ln" stroke-width="2" style="fill:${crP('t1', '#ebebe8')}"/>
        <path d="M15 76 h70 v6 q0 5 -5 5 h-60 q-5 0 -5 -5z" style="fill:${crP('t2', '#e1e1dd')}"/>
        <rect x="62" y="24" width="16" height="12" rx="1" class="cr-ln" stroke-width="1.2" style="fill:${PLAIN_FACE}"/>
        <path d="M64 33 l4 -4 3 3 2 -2 3 3" fill="none" stroke-width="1" stroke-linejoin="round" style="stroke:${crP('accent', '#3a3a3a')}"/>
        <ellipse cx="50" cy="84" rx="20" ry="4" class="cr-ln" stroke-width="1.2" style="fill:${PLAIN_PALE}"/>`,
    front: () => `
        <rect x="17" y="80" width="16" height="4.5" rx="1" class="cr-ln" stroke-width="1" style="fill:${crP('g1', '#3c4450')}"/>
        <rect x="19" y="75.5" width="13" height="4.5" rx="1" class="cr-ln" stroke-width="1" style="fill:${crP('g4', '#5e5850')}"/>
        <rect x="18" y="71" width="12" height="4.5" rx="1" class="cr-ln" stroke-width="1" style="fill:${crP('g6', '#6a5a50')}"/>`
};

function currentTheme() {
    return document.documentElement.dataset.theme || 'candy';
}

function critterArt(theme = currentTheme()) {
    return CRITTER_THEMES[theme] || CRITTER_THEMES.candy;
}

// The critter in its home as an SVG string. `empty` draws just the home
// (it ran away).
function critterSvg(theme, { stage = 'baby', mood = 'content', empty = false } = {}) {
    const t = critterArt(theme);
    const uid = 'cr' + (++critterUid);
    const scale = stage === 'egg' ? 1 : (CRITTER_STAGES.find(s => s.id === stage) || CRITTER_STAGES[0]).scale;
    const [fx, fy, fs] = t.fit;
    const body = empty ? '' : `
        <g transform="translate(${fx} ${fy}) scale(${fs}) translate(-50 -82)">
            <g transform="translate(50 82) scale(${scale}) translate(-50 -82)">
                <g class="cr-idle"><g class="cr-egg">${t.egg()}</g><g class="cr-critter">${t.art()}</g></g>
            </g>
        </g>
        <text class="cr-zz" x="${t.zz[0]}" y="${t.zz[1]}" style="fill:${t.zzInk || 'var(--outline)'}">z<tspan dx="1" dy="-4" font-size="7">z</tspan></text>`;
    return `<svg class="cr stage-${stage} mood-${mood}" viewBox="0 0 100 100" aria-hidden="true">${t.back(uid)}${body}${t.front(uid)}</svg>`;
}

// ----- Critter state -----

// pages a day it eats: the pages goal spread over its period
const critterGoal = () => pagesGoalAmount() / PAGES_PERIODS[pagesPeriod()].days;
const critterCap = () => critterGoal() * CRITTER_FOOD_DAYS;

function newCritterEgg(past = []) {
    const now = Date.now();
    return {
        name: '',
        laidAt: now,
        bornAt: null,            // set when it hatches (its first meal)
        totalFed: 0,
        food: 0,                 // pages in its belly right now
        updatedAt: now,          // hunger worked out up to here
        emptySince: null,        // when its belly hit empty
        log: [],                 // recent meals, newest first
        gone: null,              // { at, note, theme } once it's run away
        past                     // the scrapbook: critters before this one
    };
}

function loadCritter() {
    try {
        const saved = JSON.parse(localStorage.getItem(CRITTER_KEY));
        if (saved && typeof saved === 'object') return { ...newCritterEgg(), ...saved };
    } catch (e) {}
    return newCritterEgg();
}

function saveCritter() {
    try { localStorage.setItem(CRITTER_KEY, JSON.stringify(critter)); } catch (e) {}
}

// Work out how hungry it's got since we last looked. Eggs and an empty
// home don't get hungry, and neither does a switched-off critter (its
// hunger clock is held where it was).
function settleCritter(now = Date.now()) {
    const c = critter;
    if (!c) return;
    const elapsed = Math.max(0, now - c.updatedAt);
    if (c.gone || !c.bornAt || !appSettings.critter) {
        if (c.emptySince) c.emptySince += elapsed;
        c.updatedAt = now;
        saveCritter();
        return;
    }
    const goal = critterGoal();
    c.food = Math.min(c.food, critterCap());
    if (c.food > 0) {
        const left = c.food - goal * elapsed / DAY_MS;
        if (left <= 0) {
            c.emptySince = c.updatedAt + c.food / goal * DAY_MS;
            c.food = 0;
        } else {
            c.food = left;
        }
    }
    if (c.food === 0 && !c.emptySince) c.emptySince = now;
    c.updatedAt = now;
    if (c.emptySince && now - c.emptySince >= CRITTER_RUNAWAY_DAYS * DAY_MS) {
        critterRunsAway(c.emptySince + CRITTER_RUNAWAY_DAYS * DAY_MS);
    }
    saveCritter();
}

function critterName(c = critter) {
    return (c.name || '').trim() || critterArt().name;
}

function critterStage(c = critter) {
    if (!c.bornAt) return { id: 'egg', at: 0 };
    let stage = CRITTER_STAGES[0];
    CRITTER_STAGES.forEach(s => { if (c.totalFed >= s.at) stage = s; });
    return stage;
}

function critterMood(c = critter) {
    if (!c.bornAt) return 'content';
    const days = c.food / critterGoal();
    if (days <= 0) return 'starving';
    if (days < 1) return 'hungry';
    const hour = new Date().getHours();
    const night = hour >= 23 || hour < 7;
    // bookworms read late: a feed or a poke keeps it up with you a while
    if (night && !(c.awakeUntil > Date.now())) return 'asleep';
    return days >= 2 ? 'full' : 'content';
}

function keepCritterAwake(ms) {
    critter.awakeUntil = Math.max(critter.awakeUntil || 0, Date.now() + ms);
}

function critterRunsAway(at) {
    const c = critter;
    const theme = currentTheme();
    c.past.unshift({
        name: critterName(c), theme, stage: critterStage(c).id,
        totalFed: c.totalFed, bornAt: c.bornAt, endedAt: at, fate: 'Ran away'
    });
    c.gone = {
        at, theme,
        note: `i went lookin for sumone who reeds to me mor. thank u for the ${c.totalFed.toLocaleString()} pages!! love, ${critterName(c)}`
    };
    c.food = 0;
    c.emptySince = null;
}

function hatchNewEgg() {
    critter = newCritterEgg(critter ? critter.past : []);
    saveCritter();
    renderCritter();
    critterSay('A new egg! Feed it pages to hatch it.');
}

// `readAt`: when the pages were read, for the reading log (the Goals
// window can log an earlier day's); the critter eats them now either way
function feedCritter(pages, readAt) {
    settleCritter();
    const c = critter;
    if (c.gone) return;
    recordPages(pages, readAt);
    const hatching = !c.bornAt;
    const stageBefore = critterStage(c).id;
    // (left unnamed, it goes by each theme's critter name)
    if (hatching) c.bornAt = Date.now();
    c.totalFed += pages;
    c.food = Math.min(critterCap(), c.food + pages);
    if (hatching) c.food = Math.max(c.food, critterGoal()); // a newborn starts with a day's worth
    if (c.food > 0) c.emptySince = null;
    keepCritterAwake(2 * 60 * 60 * 1000);
    c.log.unshift({ at: Date.now(), pages });
    c.log.length = Math.min(c.log.length, 100);
    saveCritter();
    renderCritter();
    // fed from the goals window: nothing to cheer in a closed window
    if (document.getElementById('critter-modal').style.display !== 'flex') return;

    const view = document.getElementById('critter-view');
    const stageNow = critterStage(c);
    if (hatching) {
        confettiFrom(view);
        critterSay(`It hatched! Hi, I'm ${critterName(c)}!`);
    } else if (stageNow.id !== stageBefore) {
        confettiFrom(view);
        critterSay(`${critterName(c)} grew into ${stageNow.id === 'adult' ? 'an adult' : 'a ' + stageNow.id}!`);
    } else {
        const lines = ['Nom nom nom.', 'Tasty pages!', 'Mmm, crunchy words.', 'More please!'];
        critterSay(lines[Math.floor(Math.random() * lines.length)]);
    }
    critterAnimate('eating', 1400);
}

// a passing state (eating, wiggle) on every drawing of the critter
function critterAnimate(cls, ms) {
    document.querySelectorAll('#critter-home-art .cr, #critter-view-art .cr').forEach(svg => {
        svg.classList.remove(cls);
        void svg.getBoundingClientRect();
        svg.classList.add(cls);
        setTimeout(() => svg.classList.remove(cls), ms);
    });
}

function critterSay(text) {
    const say = document.getElementById('critter-say');
    say.textContent = text;
    say.classList.add('visible');
    clearTimeout(critterSayTimer);
    critterSayTimer = setTimeout(() => say.classList.remove('visible'), 2600);
}

function petCritter() {
    const c = critter;
    if (c.gone) return;
    if (!c.bornAt) {
        critterAnimate('wiggle', 650);
        critterSay('The egg wobbles.');
        return;
    }
    const mood = critterMood(c);
    if (mood === 'asleep') {
        // a second poke while it's dozing wakes it up for the next hour
        if (c.pokedAt > Date.now() - 60 * 1000) {
            keepCritterAwake(60 * 60 * 1000);
            c.pokedAt = 0;
            saveCritter();
            renderCritter();
            critterSay(['*yawns* Up late reading too?', '*stretches* One more chapter?', "Mm? Oh! I'm awake!"][Math.floor(Math.random() * 3)]);
            critterAnimate('wiggle', 650);
            return;
        }
        c.pokedAt = Date.now();
        saveCritter();
    }
    let lines;
    if (mood === 'asleep') lines = ['zzz…', '*rolls over*', '*sleepy mumble*'];
    else if (mood === 'starving') lines = ['Too hungry to play…', 'Pages… please…'];
    else if (mood === 'hungry') lines = ['Pets are nice. Pages are nicer.', '*tummy rumbles*'];
    else lines = ['Hee hee!', '♥', '*happy wiggle*', 'That tickles!', `${critterName(c)} loves you.`];
    critterSay(lines[Math.floor(Math.random() * lines.length)]);
    if (mood !== 'asleep') {
        critterAnimate('wiggle', 650);
        sparkleFrom(document.getElementById('critter-view'));
    }
}

function addCritterPages(n) {
    const input = document.getElementById('critter-pages');
    input.value = (parseInt(input.value) || 0) + n;
}

function submitCritterFeed() {
    const input = document.getElementById('critter-pages');
    const pages = Math.min(2000, parseInt(input.value) || 0);
    if (pages < 1) {
        critterSay('How many pages did you read?');
        return;
    }
    input.value = '';
    feedCritter(pages);
}

function renameCritter(value) {
    critter.name = value.slice(0, 20);
    saveCritter();
    updateCritterWidget();
}

// An unnamed critter shows its theme name as the box's placeholder,
// which can't be selected or backspaced; clicking in swaps in the real
// text, all selected, so it reads (and edits) like a name.
function startRenameCritter(input) {
    if (!input.value && critter.bornAt) input.value = critterName();
    input.select();
}

// left untouched (or emptied): back to the theme's name
function endRenameCritter(input) {
    if (!critter.name.trim()) {
        critter.name = '';
        saveCritter();
        input.value = '';
    }
}

// The run-away note, written letter by letter in a wobbly kid's hand.
// The wobble comes from the note's own text, so it looks the same every
// time it's opened.
const GONE_NOTE_PAW = `<svg class="paw" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
    <ellipse cx="12" cy="16" rx="5.2" ry="4.4"/>
    <ellipse cx="5" cy="10" rx="2.1" ry="2.7" transform="rotate(-20 5 10)"/>
    <ellipse cx="9.3" cy="5.6" rx="2.1" ry="2.8" transform="rotate(-8 9.3 5.6)"/>
    <ellipse cx="14.7" cy="5.6" rx="2.1" ry="2.8" transform="rotate(8 14.7 5.6)"/>
    <ellipse cx="19" cy="10" rx="2.1" ry="2.7" transform="rotate(20 19 10)"/>
</svg>`;

function renderGoneNote(box, text) {
    box.innerHTML = '';
    if (!text) return;
    let seed = 0;
    for (const ch of text) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const rand = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
    };
    text.split(' ').forEach((word, i) => {
        if (i) box.append(' ');
        const w = document.createElement('span');
        w.className = 'word';
        [...word].forEach(ch => {
            const s = document.createElement('span');
            s.className = 'ch';
            s.textContent = ch;
            s.style.setProperty('--r', ((rand() - 0.5) * 26).toFixed(1) + 'deg');
            s.style.setProperty('--y', ((rand() - 0.5) * 7).toFixed(1) + 'px');
            s.style.setProperty('--s', (0.85 + rand() * 0.35).toFixed(2));
            w.appendChild(s);
        });
        box.appendChild(w);
    });
    box.insertAdjacentHTML('beforeend', GONE_NOTE_PAW);
}

// ----- Critter rendering -----

const CRITTER_MOOD_TEXT = {
    full: 'All full.',
    content: 'Content.',
    hungry: 'Getting hungry…',
    asleep: 'Fast asleep.'
};

function critterMoodText(c = critter) {
    if (!c.bornAt) return 'Something’s wiggling inside. Feed it pages to hatch it.';
    const mood = critterMood(c);
    if (mood === 'starving') {
        const daysLeft = Math.max(1, Math.ceil(CRITTER_RUNAWAY_DAYS - (Date.now() - c.emptySince) / DAY_MS));
        return `Starving! It might run away in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`;
    }
    return CRITTER_MOOD_TEXT[mood];
}

// Counted in calendar days, not 24-hour stretches: hatched at 11pm, it
// was born yesterday by the next morning.
function critterAge(c = critter) {
    const midnight = ms => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d; };
    const born = midnight(c.bornAt), today = midnight(Date.now());
    const days = Math.round((today - born) / DAY_MS); // round: DST days aren't 24h
    if (days < 1) return 'born today';
    if (days === 1) return 'born yesterday';
    return `${days} days old`;
}

const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);
const shortDate = ms => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

function updateCritterWidget() {
    const c = critter;
    const alert = document.getElementById('critter-alert');
    const home = document.getElementById('critter-home');
    let badge = '';
    let title;
    if (c.gone) {
        badge = '✉';
        title = 'Your critter left a note';
    } else if (!c.bornAt) {
        title = 'An egg — feed it pages to hatch it';
    } else {
        const mood = critterMood(c);
        if (mood === 'hungry') badge = '!';
        if (mood === 'starving') badge = '!!';
        title = `${critterName(c)}: ${critterMoodText(c)}`;
    }
    alert.textContent = badge;
    alert.classList.toggle('visible', !!badge);
    home.title = title;
    home.setAttribute('aria-label', title);
}

function renderCritter() {
    if (!critter) return;
    const c = critter;
    const theme = currentTheme();
    const opts = { stage: critterStage(c).id, mood: critterMood(c), empty: !!c.gone };
    document.getElementById('critter-home-art').innerHTML = critterSvg(theme, opts);
    updateCritterWidget();
    if (document.getElementById('critter-modal').style.display === 'flex') {
        document.getElementById('critter-view-art').innerHTML = critterSvg(theme, opts);
        renderCritterModal();
    }
}

function renderCritterModal() {
    const c = critter;
    const show = (id, on) => { document.getElementById(id).style.display = on ? '' : 'none'; };
    const gone = !!c.gone;
    const hatched = !!c.bornAt && !gone;
    show('critter-alive', !gone);
    show('critter-care', hatched);
    show('critter-feed', !gone);
    show('critter-chips', !gone);
    show('critter-tiles', hatched);
    show('critter-meals', !gone);
    show('critter-gone-note', gone);
    show('critter-hatch', gone);

    const nameInput = document.getElementById('critter-name');
    nameInput.placeholder = c.bornAt ? critterArt().name : 'Name your egg';
    if (document.activeElement !== nameInput) nameInput.value = c.name || '';

    const art = critterArt();
    document.getElementById('critter-sub').textContent = c.bornAt
        ? `${capitalize(critterStage(c).id)} ${art.kind} · ${critterAge(c)}`
        : `A ${art.kind} egg`;
    document.getElementById('critter-mood').textContent = gone ? 'The home is empty.' : critterMoodText(c);
    renderGoneNote(document.getElementById('critter-gone-note'), gone ? c.gone.note : '');

    if (hatched) {
        const days = c.food / critterGoal();
        document.getElementById('critter-meter-text').textContent =
            `${days.toFixed(1)} of ${CRITTER_FOOD_DAYS} days of food (${pagesGoalText()})`;
        setBarFill(document.getElementById('critter-meter-fill'), c.food / critterCap() * 100);

        const next = CRITTER_STAGES.find(s => s.at > c.totalFed);
        const tiles = [
            ['Pages eaten', c.totalFed.toLocaleString()],
            ['Next stage', next ? `${(next.at - c.totalFed).toLocaleString()} pages` : 'All grown']
        ];
        const box = document.getElementById('critter-tiles');
        box.innerHTML = '';
        tiles.forEach(([label, value]) => {
            const tile = document.createElement('div');
            tile.className = 'stats-tile';
            const l = document.createElement('div');
            l.className = 'stats-tile-label';
            l.textContent = label;
            const v = document.createElement('div');
            v.className = 'stats-tile-value';
            v.style.fontSize = '17px';
            v.textContent = value;
            tile.append(l, v);
            box.appendChild(tile);
        });
    }

    const list = document.getElementById('critter-meal-list');
    list.innerHTML = '';
    c.log.slice(0, 8).forEach(meal => {
        const li = document.createElement('li');
        const what = document.createElement('span');
        what.textContent = `${meal.pages} page${meal.pages === 1 ? '' : 's'}`;
        const when = document.createElement('span');
        when.textContent = shortDate(meal.at);
        li.append(what, when);
        list.appendChild(li);
    });
    if (!c.log.length) {
        const li = document.createElement('li');
        li.className = 'critter-empty';
        li.textContent = 'No meals yet. Pages taste like the book you started reading most recently.';
        list.appendChild(li);
    }

    renderCritterScrapbook();
}

function renderCritterScrapbook() {
    const box = document.getElementById('critter-scrapbook');
    box.innerHTML = '';
    if (!critter.past.length) {
        const empty = document.createElement('div');
        empty.className = 'critter-empty';
        empty.textContent = 'No past critters yet.';
        box.appendChild(empty);
        return;
    }
    critter.past.forEach(p => {
        const row = document.createElement('div');
        row.className = 'critter-past';
        const pic = document.createElement('div');
        pic.className = 'critter-past-pic';
        pic.innerHTML = critterSvg(p.theme, { stage: p.stage, mood: 'content' });
        const info = document.createElement('div');
        const name = document.createElement('div');
        name.className = 'critter-past-name';
        name.textContent = p.name;
        const kind = document.createElement('div');
        kind.textContent = `${capitalize(p.stage)} ${critterArt(p.theme).kind} · ${p.totalFed.toLocaleString()} pages eaten`;
        const dates = document.createElement('div');
        dates.textContent = `${p.bornAt ? shortDate(p.bornAt) : '?'} – ${shortDate(p.endedAt)} · ${p.fate}`;
        info.append(name, kind, dates);
        row.append(pic, info);
        box.appendChild(row);
    });
}

function toggleCritterScrapbook() {
    const box = document.getElementById('critter-scrapbook');
    const showing = box.classList.toggle('visible');
    document.getElementById('critter-scrap-toggle').textContent = showing ? 'Hide scrapbook' : 'Scrapbook';
}

function openCritter() {
    settleCritter();
    document.getElementById('critter-scrapbook').classList.remove('visible');
    document.getElementById('critter-scrap-toggle').textContent = 'Scrapbook';
    document.getElementById('critter-say').classList.remove('visible');
    document.getElementById('critter-modal').style.display = 'flex';
    renderCritter();
}

function closeCritter() {
    document.getElementById('critter-modal').style.display = 'none';
}

function initCritter() {
    critter = loadCritter();
    settleCritter();
    renderCritter();
    // hunger keeps ticking while the page is open
    // (and the goals card rolls over to a new day, week or month)
    setInterval(() => { settleCritter(); renderCritter(); updateGoals(); }, 5 * 60 * 1000);
}
