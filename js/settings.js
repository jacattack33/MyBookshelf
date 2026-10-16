const DB_NAME = 'BookShelfDB';
const STORE_NAME = 'books';
const CUSTOM_GENRES_KEY = 'bookShelfCustomGenres';
const RECENT_COLORS_KEY = 'bookShelfRecentColors';
const EXPANDED_SHELVES_KEY = 'bookShelfExpandedShelves';
let expandedShelves = new Set();
let recentColors = [];
const SPINE_GAMMA_FIX_KEY = 'bookShelfSpineGammaFixApplied';
const ADD_GENRE_VALUE = '__add_new_genre__';
// Genres are what a book is about. Audience (Children's, Middle Grade,
// Young Adult) and format (graphic novels, short stories, poetry) are
// separate things libraries label on top of genre, so here they're
// suggested tags instead - see SUGGESTED_TAGS.
const FICTION_GENRES = [
    "Action", "Adventure", "Classic Literature", "Contemporary Fiction", "Crime",
    "Dystopian", "Fairy Tales & Retellings", "Fantasy", "Gothic",
    "Historical Fiction", "Horror", "Humor", "Literary Fiction", "Magical Realism", "Mystery",
    "Mythology & Folklore", "Paranormal", "Romance", "Satire", "Sci-Fi",
    "Speculative Fiction", "Thriller", "War Fiction", "Western", "Women's Fiction"
];
const NONFICTION_GENRES = [
    "Art", "Biography", "Business", "Cooking", "Crafts & Hobbies",
    "Economics", "Education", "Fashion & Beauty", "Film & TV", "Health & Wellness",
    "History", "Home & Garden", "Humor (Non-Fiction)", "Journalism & Current Affairs",
    "Language & Writing", "Law", "Mathematics", "Medicine", "Memoir", "Music",
    "Nature & Environment", "Parenting", "Personal Finance", "Pets & Animals", "Philosophy",
    "Politics", "Psychology", "Religion & Spirituality", "Science", "Self-Help",
    "Sociology", "Sports", "Technology", "Travel", "True Crime"
];

// Old genres that became tags: genre name -> the tag it turns into.
const GENRES_NOW_TAGS = {
    "Children's": "Children's",
    "Middle Grade": "Middle Grade",
    "Young Adult": "Young Adult",
    "Graphic Novel & Comics": "Graphic Novel",
    "Short Stories": "Short Stories",
    "Poetry": "Poetry",
    "Drama": "Drama",
    "Essays": "Essays",
    "Reference": "Reference",
    "Critical Thinking": "Critical Thinking"
};

// Where a book lands when its old genre goes away. Fiction-ish ones are
// refiled by author (FICTION_BY_AUTHOR) first, falling back to these.
const RETIRED_GENRE_HOMES = {
    "Fiction": "Contemporary Fiction",
    "Children's": "Contemporary Fiction",
    "Middle Grade": "Contemporary Fiction",
    "Young Adult": "Contemporary Fiction",
    "Graphic Novel & Comics": "Contemporary Fiction",
    "Short Stories": "Literary Fiction",
    "Poetry": "Literary Fiction",
    "Drama": "Literary Fiction",
    "Essays": "Language & Writing",
    "Reference": "Education",
    "Critical Thinking": "Philosophy"
};
const FICTION_BY_AUTHOR = {
    "lemony snicket": "Mystery",
    "stephenie meyer": "Paranormal",
    "ellen hopkins": "Contemporary Fiction",
    "neal shusterman": "Dystopian"
};

// Always offered in the tag dropdown, even before any book uses them.
const SUGGESTED_TAGS = ["Children's", "Middle Grade", "Young Adult", "New Adult",
    "Graphic Novel", "Short Stories", "Poetry", "Audiobook", "Series"];
const GENRES = [...FICTION_GENRES, ...NONFICTION_GENRES];
const STATUSES = ["Want to Read", "Reading", "Read", "DNF"];
const STATUS_TAG_CLASS = {
    "Want to Read": "tag-status-want",
    "Reading": "tag-status-reading",
    "Read": "tag-status-read",
    "DNF": "tag-status-dnf"
};
const NO_SERIES_LABEL = "No Series";
const NO_TAGS_LABEL = "No Tags";
const NO_AUTHOR_LABEL = "Unknown Author";
const RATING_LABELS = ["Unrated", "★", "★★", "★★★", "★★★★", "★★★★★"];
let db = null;
let library = [];

// ---------- App settings (the Settings window) ----------
const SETTINGS_KEY = 'bookShelfSettings';
const DEFAULT_SETTINGS = {
    name: 'My Bookshelf',
    goal: 0,                    // yearly reading goal; 0 = off
    libraryCard: false,         // you have a local library card (earns Card Carrier)
    defaultStatus: 'Want to Read',
    cat: true, dust: true, lean: true, sticky: true,
    noteFalls: true,            // to-get sticky notes now and then fall off the shelf
    shelfCounts: true,          // the number of books in the corner of each shelf
    critter: true,              // the reading critter in the corner
    pins: true,                 // the pin board (achievements) under the stats ledger; Candy only for now
    pinAlerts: true,            // the pin board wiggles, sparkles and shows a +N badge for new pins
    pinNewBooks: true,          // new books count toward pins (off while typing in books you already had)
    ownedSeal: 'series',        // gold seal on owned books: 'off', 'series' (Series shelf only) or 'all'
    unreadFade: 'series',       // fade books not marked Read: 'off', 'series' or 'all'
    pagesGoal: 20,              // pages per pagesPeriod; also how fast the critter gets hungry
    pagesPeriod: 'day',         // day, week or month
    noteFont: null,             // font new notes start in (null = last one used)
    cardFont: null,             // library card handwriting (null = the book's notes font)
    backupReminders: true,      // nudge to export now and then
    typewriterMachine: 'off',   // Typewriter: the panel comes out of the machine: 'off', 'roller' or 'full' (adds the typing scale)
    celebrations: true,         // sparkles, confetti and the preview wiggle
    goodbyes: true,             // deleted books and notes leave in a little scene (and a got note poofs into a book)
    calm: false,                // no animations
    debug: false                // the debug panel on the right edge
};
let appSettings = { ...DEFAULT_SETTINGS };
let editingId = null;
let customGenres = [];
let secretHeartClicks = [];
const SECRET_HEART_WINDOW_MS = 1500;
let clearSpineImageFlag = false;
let pendingCoverCrop = null;
let pendingSpineCrop = null;
let cropContext = null;
let cropNaturalWidth = 0;
let cropNaturalHeight = 0;
let cropBoxState = { x: 0, y: 0, w: 0, h: 0 };
let cropDrag = null;
const CROP_MIN_SIZE = 24;

// ---------- Genres (built-in + user-added) ----------

function loadCustomGenres() {
    try {
        customGenres = JSON.parse(localStorage.getItem(CUSTOM_GENRES_KEY)) || [];
    } catch (e) {
        customGenres = [];
    }
    // a custom genre that's now built in (e.g. "Humor") shouldn't show
    // twice, and a retired one (e.g. "Fiction") shouldn't come back
    const skip = [...GENRES, ...Object.keys(RETIRED_GENRE_HOMES)].map(g => g.toLowerCase());
    customGenres = customGenres.filter(g => !skip.includes(g.toLowerCase()));
}

// ---------- Theme (Candy / Sea Glass / Holo / Library / Deco / Loft / Blueprint / Terminal / Typewriter / Sunset / Plain / Plain Bold) ----------
const THEME_KEY = 'bookShelfTheme';
const THEMES = ['candy', 'seaglass', 'holo', 'library', 'deco', 'loft', 'blueprint', 'terminal', 'typewriter', 'sunset', 'plain', 'plainbold'];

function setTheme(theme) {
    if (!THEMES.includes(theme)) theme = 'candy';
    const switchedToTypewriter = theme === 'typewriter' && document.documentElement.dataset.theme !== 'typewriter';
    if (theme !== 'candy') {
        document.documentElement.dataset.theme = theme;
    } else {
        delete document.documentElement.dataset.theme;
    }
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
    document.querySelectorAll('[data-theme-choice]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.themeChoice === theme);
    });
    applyTint();
    renderCritter(); // each theme has its own critter and home
    checkPins(); // trying another theme earns one
    if (switchedToTypewriter) typeInTitle();
    else if (theme !== 'typewriter') delete document.documentElement.dataset.typing;
}

// Typewriter: the title types itself in, a letter at a time in a
// typist's uneven rhythm. Each letter is its own span, hidden until its
// key is struck (so a letter is never shown half-cut), and the name goes
// back to plain text once it's all typed. (The page opening in
// Typewriter calls this once the bookshelf name is set; until then the
// head script keeps the name hidden with data-typing, so it doesn't
// flash up first.)
let titleTypingTimer = null;

function typeInTitle() {
    const root = document.documentElement;
    const el = document.getElementById('shelf-name');
    const done = () => delete root.dataset.typing;
    if (root.dataset.theme !== 'typewriter' || prefersReducedMotion() || !el.firstChild) return done();
    // picked in Settings: the window covers the title, so it types once
    // the window closes (closeSettings), hidden till then
    if (document.getElementById('settings-modal').style.display === 'flex') {
        root.dataset.typing = 'after-settings';
        return;
    }
    clearTimeout(titleTypingTimer);
    const name = el.textContent;
    el.textContent = '';
    let t = 250;
    [...name].forEach(ch => {
        const letter = document.createElement('span');
        letter.textContent = ch;
        t += 70 + Math.random() * 80 + (ch === ' ' ? 90 : 0);
        // hidden until t, then shown when the animation ends
        letter.animate([{ visibility: 'hidden' }, { visibility: 'hidden' }], { duration: t });
        el.appendChild(letter);
    });
    titleTypingTimer = setTimeout(() => {
        // (unless it's been renamed meanwhile)
        if (el.firstElementChild && el.textContent === name) el.textContent = name;
    }, t + 50);
    done();
}

// The two plain themes come in six colours (Settings shows the choice
// only while one of them is on). Kept separately from the theme, so
// switching away and back keeps your colour.
const TINT_KEY = 'bookShelfTint';
const TINTS = ['paper', 'slate', 'sage', 'clay', 'lilac', 'navy'];
const PLAIN_THEMES = ['plain', 'plainbold'];

function currentTint() {
    try {
        const tint = localStorage.getItem(TINT_KEY);
        return TINTS.includes(tint) ? tint : 'paper';
    } catch (e) { return 'paper'; }
}

function applyTint() {
    const root = document.documentElement;
    const tint = currentTint();
    if (PLAIN_THEMES.includes(root.dataset.theme)) root.dataset.tint = tint;
    else delete root.dataset.tint;
    document.querySelectorAll('[data-tint-choice]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tintChoice === tint);
    });
}

function setTint(tint) {
    if (!TINTS.includes(tint)) tint = 'paper';
    try { localStorage.setItem(TINT_KEY, tint); } catch (e) {}
    applyTint();
}

// ---------- Custom genres (Settings) ----------
// Only books you can see are counted and moved - books hidden by the
// heart keep their genre (it comes back as a custom genre if they're
// shown again), so nothing here hints that hidden books exist.

function renderCustomGenreSettings() {
    const list = document.getElementById('custom-genre-list');
    hideGenreMove();
    list.innerHTML = '';
    const sorted = [...customGenres].sort((a, b) => a.localeCompare(b));
    if (sorted.length === 0) {
        list.innerHTML = `<span class="field-hint">You haven't added any custom genres. Pick "Add new genre" in a book's Genre list to make one.</span>`;
        return;
    }
    sorted.forEach(genre => {
        const chip = document.createElement('span');
        chip.className = 'custom-genre-chip';
        chip.textContent = genre;
        const x = document.createElement('button');
        x.type = 'button';
        x.className = 'x-btn';
        x.setAttribute('aria-label', `Remove ${genre}`);
        x.innerHTML = '&times;';
        x.addEventListener('click', () => startRemoveCustomGenre(genre));
        chip.appendChild(x);
        list.appendChild(chip);
    });
}

function hideGenreMove() {
    const box = document.getElementById('genre-move');
    box.classList.remove('visible');
    box.innerHTML = '';
}

function startRemoveCustomGenre(genre) {
    const using = visibleBooks().filter(b => (b.genre || '').toLowerCase() === genre.toLowerCase());
    if (using.length === 0) {
        removeCustomGenre(genre, null);
        return;
    }
    // books still use it: ask where to move them first
    const box = document.getElementById('genre-move');
    box.innerHTML = '';
    const msg = document.createElement('div');
    msg.textContent = `${using.length} book${using.length === 1 ? ' uses' : 's use'} "${genre}". Move ${using.length === 1 ? 'it' : 'them'} to:`;
    const select = document.createElement('select');
    getAllGenres().filter(g => g.toLowerCase() !== genre.toLowerCase()).forEach(g => select.add(new Option(g, g)));
    const buttons = document.createElement('div');
    buttons.className = 'genre-move-buttons';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'secondary';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', hideGenreMove);
    const go = document.createElement('button');
    go.type = 'button';
    go.className = 'danger';
    go.textContent = 'Move & remove';
    go.addEventListener('click', () => removeCustomGenre(genre, select.value));
    buttons.append(cancel, go);
    box.append(msg, select, buttons);
    box.classList.add('visible');
}

async function removeCustomGenre(genre, moveTo) {
    if (moveTo) {
        const moved = visibleBooks().filter(b => (b.genre || '').toLowerCase() === genre.toLowerCase());
        moved.forEach(b => { b.genre = moveTo; });
        await dbBulkPut(moved);
    }
    customGenres = customGenres.filter(g => g.toLowerCase() !== genre.toLowerCase());
    saveCustomGenres();
    populateGenreSelects();
    renderBookshelf();
    renderCustomGenreSettings();
}

// ---------- Delete library (Settings > Start over) ----------
const STARTED_FRESH_KEY = 'bookShelfStartedFresh'; // don't re-add the 3 starter books

function showDeleteLibraryConfirm() {
    const box = document.getElementById('delete-confirm');
    box.classList.add('visible');
    document.getElementById('delete-confirm-input').value = '';
    document.getElementById('delete-reset-settings').checked = false;
    updateDeleteConfirm();
    document.getElementById('delete-confirm-input').focus();
}

function hideDeleteLibraryConfirm() {
    document.getElementById('delete-confirm').classList.remove('visible');
}

function updateDeleteConfirm() {
    const typed = document.getElementById('delete-confirm-input').value.trim();
    document.getElementById('delete-confirm-btn').disabled = typed !== 'DELETE';
}

async function deleteLibrary() {
    if (document.getElementById('delete-confirm-input').value.trim() !== 'DELETE') return;
    const resetSettings = document.getElementById('delete-reset-settings').checked;

    await dbClear();
    library = [];
    customGenres = [];
    saveCustomGenres();
    expandedShelves = new Set();
    saveExpandedShelves();
    try { localStorage.setItem(STARTED_FRESH_KEY, '1'); } catch (e) {}

    if (resetSettings) {
        // everything else this app keeps in localStorage, except the
        // marker above that stops the starter books coming back
        try {
            Object.keys(localStorage)
                .filter(k => k.startsWith('bookShelf') && k !== STARTED_FRESH_KEY)
                .forEach(k => localStorage.removeItem(k));
        } catch (e) {}
        location.reload();
        return;
    }

    hideDeleteLibraryConfirm();
    closeSettings();
    populateGenreSelects();
    populateAuthorOptions();
    populateSeriesOptions();
    populateFilterTagSelect();
    renderBookshelf();
}

// ---------- Example shelf (Settings > Start over, and a first-visit offer) ----------
// Someone opening a copy of this app gets its example shelf (somebody else's
// books) and the pins those books earn. Remember which books came with it,
// so they can be cleared out later without touching any added since.
const STARTER_IDS_KEY = 'bookShelfStarterIds';
let freshStartPreview = false; // shown from the debug panel: remove nothing

function rememberStarterBooks(books) {
    try { localStorage.setItem(STARTER_IDS_KEY, JSON.stringify(books.map(b => b.id))); } catch (e) {}
}

function starterBooksLeft() {
    let ids = [];
    try { ids = JSON.parse(localStorage.getItem(STARTER_IDS_KEY)) || []; } catch (e) {}
    return library.filter(b => ids.includes(b.id));
}

function refreshStarterSetting() {
    document.getElementById('starter-remove').hidden = starterBooksLeft().length === 0;
}

function offerFreshStart() {
    if (starterBooksLeft().length === 0) return;
    document.getElementById('fresh-start-modal').style.display = 'flex';
}

function closeFreshStart() {
    document.getElementById('fresh-start-modal').style.display = 'none';
    freshStartPreview = false;
}

async function removeStarterShelf() {
    if (freshStartPreview) return closeFreshStart();
    const gone = starterBooksLeft();
    await Promise.all(gone.map(b => dbDelete(b.id)));
    library = library.filter(b => !gone.includes(b));
    try {
        localStorage.removeItem(STARTER_IDS_KEY);
        localStorage.setItem(STARTED_FRESH_KEY, '1'); // an empty shelf stays empty
    } catch (e) {}
    resetPins();

    closeFreshStart();
    closeSettings();
    populateGenreSelects();
    populateAuthorOptions();
    populateSeriesOptions();
    populateFilterTagSelect();
    renderBookshelf();
}

function openSettings() {
    hideDeleteLibraryConfirm();
    refreshStarterSetting();
    renderCustomGenreSettings();
    document.getElementById('setting-name').value = appSettings.name === DEFAULT_SETTINGS.name ? '' : appSettings.name;
    renderSettingsFontButtons();
    refreshSettingsButtons();
    document.getElementById('setting-last-backup').textContent = lastBackupText();
    document.getElementById('settings-modal').style.display = 'flex';
}

function loadSettings() {
    try {
        appSettings = { ...DEFAULT_SETTINGS, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}) };
        // the seal used to be an on/off switch for the Series shelf
        if ('seriesSeal' in appSettings) {
            appSettings.ownedSeal = appSettings.seriesSeal ? 'series' : 'off';
            delete appSettings.seriesSeal;
        }
    } catch (e) {
        appSettings = { ...DEFAULT_SETTINGS };
    }
    applySettings(false);
}

function setSetting(key, value) {
    // the critter's hunger so far runs at the old pace (or not at all while it was off)
    if (['critter', 'pagesGoal', 'pagesPeriod'].includes(key)) settleCritter();
    appSettings[key] = value;
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(appSettings)); } catch (e) {}
    if (SHELF_EXTRA_SETTINGS.includes(key)) awardPin('tinker'); // (even switched back)
    refreshSettingsButtons();
    // the name and goals are typed into, so don't redraw every shelf per keystroke
    applySettings(!['name', 'goal', 'defaultStatus', 'noteFont', 'cardFont', 'critter', 'pagesGoal', 'pagesPeriod', 'debug', 'backupReminders', 'typewriterMachine', 'pins', 'pinAlerts', 'pinNewBooks', 'celebrations', 'goodbyes'].includes(key));
    if (key === 'backupReminders' && !value) hideBackupReminder();
    if (key === 'noteFalls' && !value) stickAllNotesBackUp();
    if (key === 'pinAlerts') renderPinWidget();
    if (key === 'libraryCard') checkPins();
    if (key === 'goal') updateReadingGoal();
    if (['goal', 'pagesGoal', 'pagesPeriod', 'critter'].includes(key)) updateGoals();
    if (key === 'pagesGoal' || key === 'pagesPeriod') renderCritter();
}

function toggleSetting(key) {
    setSetting(key, !appSettings[key]);
}

// Font buttons for the Handwriting settings, each in its own font.
function renderSettingsFontButtons() {
    const build = (containerId, key, includeMatch) => {
        const box = document.getElementById(containerId);
        if (box.childElementCount) return;
        const options = includeMatch ? [{ name: null, label: 'Match notes' }] : [];
        NOTE_FONTS.forEach(f => options.push({ name: f.name, label: f.name, size: f.size, stack: noteFontStack(f) }));
        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'toggle-btn';
            btn.dataset.fontSetting = key;
            btn.dataset.fontName = opt.name || '';
            btn.textContent = opt.label;
            if (opt.name) {
                btn.style.fontFamily = opt.stack;
                // same per-font scale the notepad uses, so the buttons
                // all look about the same size
                btn.style.fontSize = (opt.size * 3.2).toFixed(1) + 'px';
            }
            btn.addEventListener('click', () => setSetting(key, opt.name));
            box.appendChild(btn);
        });
    };
    build('setting-note-fonts', 'noteFont', false);
    build('setting-card-fonts', 'cardFont', true);
}

function refreshSettingsButtons() {
    document.querySelectorAll('[data-font-setting]').forEach(btn => {
        const key = btn.dataset.fontSetting;
        // with no note font chosen yet, show the one new notes would use
        const current = key === 'noteFont' ? getLastNoteFont() : (appSettings.cardFont || '');
        btn.classList.toggle('active', btn.dataset.fontName === current);
    });
    document.querySelectorAll('[data-setting-switch]').forEach(btn => {
        btn.classList.toggle('active', !!appSettings[btn.dataset.settingSwitch]);
    });
    document.querySelectorAll('[data-default-status]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.defaultStatus === appSettings.defaultStatus);
    });
    document.querySelectorAll('[data-setting-choice]').forEach(btn => {
        btn.classList.toggle('active', appSettings[btn.dataset.settingChoice] === btn.dataset.choice);
    });
    document.querySelectorAll('[data-pages-period]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.pagesPeriod === appSettings.pagesPeriod);
    });
    document.getElementById('setting-library-card').checked = !!appSettings.libraryCard;
}

// Push the settings onto the page; `rerender` redraws the shelves (for
// the cat, dust and leaning switches).
function applySettings(rerender) {
    const name = (appSettings.name || '').trim() || DEFAULT_SETTINGS.name;
    document.getElementById('shelf-name').textContent = name;
    document.title = name;
    document.documentElement.dataset.machine = appSettings.typewriterMachine; // (only Typewriter shows it)
    if (appSettings.calm) {
        document.documentElement.dataset.calm = '';
    } else {
        delete document.documentElement.dataset.calm;
    }
    document.getElementById('sticky-pile').style.display = appSettings.sticky ? '' : 'none';
    document.getElementById('critter-home').style.display = appSettings.critter ? '' : 'none';
    document.body.classList.toggle('pins-on', !!appSettings.pins); // (the stack above it makes room, see pins.css)
    document.getElementById('debug-panel').style.display = appSettings.debug ? '' : 'none';
    applyStickyFont();
    if (rerender) renderBookshelf();
}

// Sticky notes are always written in Nanum Pen Script, scaled so it
// comes out about as big as the note's layout was sized for (Caveat).
function applyStickyFont() {
    const font = getNoteFont('Nanum Pen Script');
    const pile = document.getElementById('sticky-pile');
    pile.style.setProperty('--sticky-font', `'${font.name}'`);
    pile.style.setProperty('--sticky-scale', (font.size / getNoteFont('Caveat').size).toFixed(3));
}

function closeSettings() {
    document.getElementById('settings-modal').style.display = 'none';
    if (document.documentElement.dataset.typing === 'after-settings') typeInTitle();
}

// ---------- Light / dark mode ----------
const MODE_KEY = 'bookShelfMode';
const darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function currentMode() {
    try { return localStorage.getItem(MODE_KEY) || 'light'; } catch (e) { return 'light'; }
}

function applyMode(mode) {
    const dark = mode === 'dark' || (mode === 'auto' && darkQuery && darkQuery.matches);
    if (dark) {
        document.documentElement.dataset.mode = 'dark';
    } else {
        delete document.documentElement.dataset.mode;
    }
    document.querySelectorAll('[data-mode-choice]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.modeChoice === mode);
    });
    // redraw the cat in the right fur colour (black in light, white in dark)
    if (typeof catState !== 'undefined' && catState.frame) setCatFrame(catState.frame);
}

function setMode(mode) {
    try { localStorage.setItem(MODE_KEY, mode); } catch (e) {}
    applyMode(mode);
}

// "Match device" follows the system setting live
if (darkQuery && darkQuery.addEventListener) {
    darkQuery.addEventListener('change', () => { if (currentMode() === 'auto') applyMode('auto'); });
}

function initThemeToggle() {
    applyMode(currentMode());
    setTheme(document.documentElement.dataset.theme || 'candy');
}
