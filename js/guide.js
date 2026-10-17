// ---------- Guidebook ----------
// A big pop-up guide to everything the shelf can do, a chapter at a
// time, with screenshots (assets/guide/, made by dev/guide-shots.py).
// Opened from Settings, and from the welcome window on a first visit.
//
// Each chapter: title, lead (a line or two), shots, tips and an
// optional psst (a sticky-note aside). A shot with stickers on it goes
// with numbered tips (steps: true), so tip 1 is sticker 1. "{pins}" in
// any text becomes the number of pins.

const GUIDE_PAGE_KEY = 'bookShelfGuidePage';

const GUIDE = [
    {
        id: 'welcome', title: 'Welcome to your shelf',
        lead: "Here's the whole place at a glance. Everything is clickable, so poke around: nothing you click here can break it.",
        shots: [{ src: 'shelf', alt: 'The whole bookshelf page, with numbered stickers', caption: 'The whole shelf. The numbers match the list below.' }],
        steps: true,
        tips: [
            '<b>Your shelf\'s name.</b> Call it whatever you like in Settings &rarr; Your shelf.',
            '<b>The control panel.</b> Search, organize, filter and sort your books. See <i>Arranging your shelves</i>.',
            '<b>Backup, Slips and Settings.</b> Export a copy of your shelf, see what\'s lent out, or change how things look.',
            '<b>Your shelves.</b> Click any book and it slides out toward you and opens. Drag one to move it.',
            '<b>The corner crew:</b> your reading critter, the pin board, the goals card and the stats ledger, stacked on top of each other.',
            '<b>The sticky-note pile.</b> The quickest way to jot down a book you want to read.'
        ],
        psst: 'The pictures in this guide are in the Candy theme. Yours might be wearing a different outfit, but everything is in the same place.'
    },
    {
        id: 'saving', title: 'Where your books live',
        lead: 'No account, no password, nothing online. Your whole shelf is saved right here, in <b>this browser on this device</b>.',
        shots: [{ src: 'backup', alt: 'The How Backups Work window', caption: 'Settings &rarr; Backups &rarr; <b>How backups work</b> has the whole story.' }],
        tips: [
            '<b>Export Library (Backup)</b> downloads one file with everything in it: every book, cover, note and date, your settings, your critter and your pins.',
            'Keep that file somewhere safe, like a cloud drive, or email it to yourself.',
            '<b>Import Library</b> brings a backup back. It <b>replaces</b> the shelf that\'s here, so export first if you\'re not sure.',
            '<b>New phone or computer?</b> Export on the old one, import on the new one. That\'s the only way across.',
            'A different browser or a private window starts with its own empty shelf. Clearing your browser\'s site data wipes this one.',
            'Now and then a little note reminds you to back up, and the Export button glows. Turn that off in Settings &rarr; Backups.'
        ],
        warn: 'Back up now and then! If your browser forgets its data, a backup file is the only way to get your shelf back.'
    },
    {
        id: 'adding', title: 'Adding books',
        lead: 'Three ways in: the full form, a quick sticky note, or a photo of a whole shelf at once.',
        shots: [
            { src: 'add', alt: 'The Add a New Book window', caption: '<b>+ Add New Book</b>: the full form, with a live preview of the book on the left.' },
            { src: 'sticky', alt: 'A sticky note being filled in', caption: 'The sticky-note pile: title, author, genre, <b>Stick it &#10003;</b>.', small: true }
        ],
        tips: [
            '<b>The full form:</b> click <b>+ Add New Book</b>. Only a title, an author and a genre are needed; the rest can wait.',
            '<b>A cover:</b> <b>Choose Cover</b> for a picture on your computer, or paste a picture (or a link to one) into the box under it. You get to crop it.',
            '<b>No picture?</b> Pick a colour, a shape (paperback, hardcover, square&hellip;) and a width. The preview changes as you go.',
            '<b>The sticky-note pile</b> (bottom left) is for books you want to get: it goes on the shelf as a yellow sticky note in pencil.',
            '<b>Got a whole bookcase?</b> In the Spine card, <b>Whole shelf</b> takes one photo of a row (or a stack) of books and cuts out a spine for each one. Straight on, in good light, works best.',
            '<b>Settings &rarr; New books</b> picks the status new books start in: Want to Read, Reading or Read.'
        ],
        psst: 'Not sure of the genre? Genre is what a book is <i>about</i>. Things like Young Adult, Graphic Novel or Audiobook are tags.'
    },
    {
        id: 'secrets', title: 'Secret spots in the edit window',
        lead: 'The book in the preview isn\'t just a picture. Click it, poke it, open it.',
        shots: [
            { src: 'card', alt: 'The library card sliding out of the book', caption: 'Click the preview book: the cover swings open and its library card slides out.' },
            { src: 'notes', alt: 'Two notes peeking out from behind a book', caption: 'Notes peek out from behind the book.', small: true },
            { src: 'notepad', alt: 'The notepad, open', caption: 'The notepad, in your pick of handwriting.', small: true }
        ],
        tips: [
            '<b>The library card</b> has the book\'s details written in by hand, a stamp for its status and, at the bottom, <b>How I got it</b> ("Thrifted at the church sale").',
            '<b>Click a line on the card</b> to write a date on it. The empty lines are for <b>re-reads</b>: every line is another time you read it.',
            '<b>Notes:</b> <b>&#9998; Add Notes</b> opens a notepad. Choose one of six handwritings, or a typewriter.',
            '<b>Two notes!</b> In the notepad, <b>&#65291; A pink note</b> starts a second one, for keeping two kinds of thing apart (thoughts and quotes, say). You can have the pink one without the first.',
            'Each note pokes a corner out from behind the book (stickers 1 and 2). Hover to lift it, click to pull it out.',
            '<b>Cover &#10022; Spine</b> (sticker 3) flips the preview to show how the book stands on the shelf in Spines view.',
            '<b>Little things:</b> stars sparkle, marking a book Read pops confetti, and a "reading &#9825;" sticker appears while you\'re reading it.'
        ]
    },
    {
        id: 'dates', title: 'Dates, without the fuss',
        lead: 'Don\'t remember exactly when you read something? Neither does anyone. Put in what you know.',
        shots: [{ src: 'dates', alt: 'The Started and Finished dates', caption: 'Just a month and a year is fine.', small: true }],
        steps: true,
        tips: [
            '<b>today</b> fills in today\'s date. Marking a book Read <i>doesn\'t</i> fill it in for you, in case you finished it ages ago.',
            '<b>A full date, a month and a year, or just a year</b> all work. Or leave it blank.',
            'On the library card, write dates almost any way: <span class="guide-chip">today</span> <span class="guide-chip">2024</span> <span class="guide-chip">3/2024</span> <span class="guide-chip">Mar 15, 2024</span> <span class="guide-chip">15 March 2024</span>',
            'It catches impossible dates, and a finish before the start, with a little shake.',
            'Re-reads on the card count as another book finished in Reading Stats and toward your yearly goal.'
        ]
    },
    {
        id: 'arrange', title: 'Arranging your shelves',
        lead: 'Sort your books into shelves any way you like, then show only the ones you want.',
        shots: [
            { src: 'organize', alt: 'The control panel with numbered stickers', caption: 'The control panel.' },
            { src: 'covers', alt: 'A shelf in Covers view', caption: '<b>Covers</b> view&hellip;', half: true },
            { src: 'spines', alt: 'The same shelf in Spines view', caption: '&hellip;and the same shelf in <b>Spines</b> view.', half: true }
        ],
        steps: true,
        tips: [
            '<b>Organize by</b> makes a shelf for each genre, reading status, author, series, tag or star rating.',
            '<b>Covers / Spines</b> shows the books face out, or spine out like a real bookcase. Books without a spine photo get a gilt leather spine.',
            '<b>Sort: Custom</b> lets you drag books into any order. Drag one onto a different shelf to change its genre, status or rating.',
            '<b>Sticky Notes</b> mixes your sticky notes in with your books, hides them, or shows only them.',
            '<b>Filter</b> by status, owned, spine photo, fiction, tag or genre, or just search by title or author. <b>Spine Photo: No Photo Yet</b> lists the books still waiting for a spine photo.',
            '<b>Long shelf?</b> The little round arrow under it opens it out into more rows. Each shelf remembers.',
            '<b>Series:</b> fill in <b># in series</b> and <b>Out of</b> and the Series shelf shows grey stand-ins for the books you haven\'t got yet.'
        ],
        psst: 'Books that sit in Want to Read for months gather dust. Hover over a dusty book to blow it off.'
    },
    {
        id: 'stickies', title: 'Sticky notes and To Buy',
        lead: 'A sticky note is a book you want but don\'t have yet. Together they make your shopping list.',
        shots: [{ src: 'stickyshelf', alt: 'Sticky notes on a shelf', caption: 'Sticky notes on the shelf, written in pencil.' }],
        tips: [
            'Click a sticky note to open it and edit it like any other book.',
            '<b>It turns into a real book</b> when you tick <b>I Own This Book</b>, or give it a cover, a spine photo, a colour, a width or a shape. It takes off and the book poofs into its spot.',
            'Now and then a note comes unstuck and falls to the bottom of its shelf. Click it to stick it back up (or stop them falling in Settings &rarr; Shelf extras).',
            '<b>Slips &rarr; To Buy</b> is a shop receipt of all your sticky notes. Tick one when you buy it and it becomes a book you own.'
        ]
    },
    {
        id: 'lending', title: 'Lending and recommendations',
        lead: 'Keep track of who has your books, and who told you to read what.',
        shots: [
            { src: 'lent', alt: 'A lent book on the shelf, with a tag', caption: 'A lent book leaves an outline and a gift tag in its spot.' },
            { src: 'slips', alt: 'The Slips window', caption: 'The <b>Slips</b> window: lent out, from friends, and to buy.' }
        ],
        tips: [
            '<b>Lending:</b> on a book you own, type a name in <b>Lent to</b> and save. Hover the tag on the shelf to see how long it\'s been gone.',
            'When it comes home, press <b>it\'s back &#10003;</b> (in the edit window or on the Lent Out slip).',
            'Gone over a month? It gets a red <b>OVERDUE</b> stamp, and its empty spot starts gathering dust.',
            '<b>From Friends:</b> jot down recs as people give them to you. <b>&#65291; shelf</b> puts one on your shelf, all filled in.',
            '<b>Recommended by</b> (in the edit window) shows the book on the From Friends slip, with your stars once you\'ve read it.',
            'Names you\'ve used before are offered as you type.'
        ]
    },
    {
        id: 'goals', title: 'Reading goals',
        lead: 'A yearly books goal, and a pages goal for each day, week or month. Click the goals card in the corner.',
        shots: [{ src: 'goals', alt: 'The Reading Goals window', caption: 'The Reading Goals window.', small: true }],
        tips: [
            '<b>Books this year</b> counts books marked Read with a finish date this year. Set it to 0 to turn it off.',
            '<b>Pages</b> can be per day, per week or per month. Weeks start on Monday.',
            '<b>Log</b> pages you\'ve read. Pick an earlier day if you forgot to log them then.',
            'Feeding your critter logs pages too, so you only ever enter them once.',
            '<b>Logged pages by mistake?</b> Every entry under Recent pages has an &times; to take it back.',
            '<b>Last 7 days</b> shows how each day went against your pace.'
        ]
    },
    {
        id: 'critter', title: 'Your reading critter',
        lead: 'A little pet you keep alive by reading. Click it to open its care window.',
        shots: [
            { src: 'critter', alt: 'The Reading Critter window', caption: 'Meet Gumdrop, a kid gummy blob.', small: true },
            { src: 'corner', alt: 'The corner stack', caption: 'It lives in the corner, on top of the goals card.', small: true }
        ],
        tips: [
            '<b>Feed it</b> the pages you read (or tap +10, +25, +50). Its first meal hatches the egg.',
            '<b>It grows up</b> as it eats: baby, kid (150 pages), teen (600) and adult (1,500), with confetti each time.',
            'Its belly holds <b>3 days</b> of food at your pages goal\'s pace, and slowly empties, even while the page is closed.',
            'Hungry? You\'ll see a <b>!</b> bubble. Empty: <b>!!</b>.',
            'It sleeps from 11pm to 7am, unless you\'re up reading too.',
            '<b>Starve it for a week and it runs away</b>, leaving a note on the sticky-note pile. Hatch a new egg; the old one goes in the Scrapbook.',
            'Click its name to rename it. Every theme has its own critter: a hermit crab, a bookworm, a little alien, an ink drop&hellip;'
        ],
        psst: 'Feeding works on the honour system. The critter trusts you. Don\'t let it down.'
    },
    {
        id: 'pins', title: 'Pins',
        lead: 'Enamel pins you earn by reading and using your shelf. There are {pins} to collect.',
        shots: [{ src: 'pins', alt: 'The big pin board', caption: 'The big pin board. Pins still to earn are shadows on the cork.' }],
        tips: [
            'Click the little <b>pin board</b> in the corner to see them all. Hover a pin (or a shadow) to see what it\'s for, or how close you are.',
            'New pins get pushed into the board one by one the next time you open it. A <b>+2</b> badge says how many are waiting.',
            'The pin board hangs in Candy, Sea Glass, Loft, Blueprint and Sunset. Pins are earned in every theme.',
            '<b>Books you already had:</b> tick <b>Don\'t count toward pins</b> on a book (under Shelf Info) so only new reading earns them. It still counts in your stats and goals.',
            '<b>Typing in an old library?</b> Switch off <b>New books count toward pins</b> in Settings &rarr; Shelf extras while you do, or use <b>Don\'t count every book on my shelf now</b>.',
            '<b>Restart pins</b> (Settings &rarr; Start over) clears the board to begin again.'
        ],
        psst: 'Some pins are sneaky. Try logging pages on a Friday evening. Or at teatime. Or at 2am.'
    },
    {
        id: 'stats', title: 'Reading stats',
        lead: 'Click the little ledger book in the corner for your reading in numbers.',
        shots: [{ src: 'stats', alt: 'The Reading Stats window', caption: 'Reading Stats.', small: true }],
        tips: [
            'How many books you have, by status, owned and lent out, plus your average rating and pages read.',
            '<b>Books finished by month</b>, for any year. Hover a column to see which books, or switch to a table.',
            'Your series, and how far through each one you are.',
            'Re-reads count again, and books finished with only a year are counted separately.'
        ]
    },
    {
        id: 'yours', title: 'Make it yours',
        lead: 'Twelve themes, each with its own critter, pin colours and way of saying goodbye to a deleted book.',
        themes: [['candy', 'Candy'], ['seaglass', 'Sea Glass'], ['holo', 'Holo'], ['deco', 'Deco'], ['loft', 'Loft'],
            ['blueprint', 'Blueprint'], ['terminal', 'Terminal'], ['typewriter', 'Typewriter'], ['sunset', 'Sunset'], ['dark', 'Candy, dark']],
        tips: [
            '<b>Theme and Mode</b> are at the top of Settings. Every theme comes in Light and Dark, or can match your device.',
            'Plain and Plain Bold come in six colours. Typewriter can have its machine on, or not.',
            '<b>Shelf extras:</b> a napping shelf cat, dust, leaning books, book counts, the sticky-note pile, the critter, the pin board, gold seals on books you own&hellip; switch any of them off.',
            '<b>Handwriting:</b> pick the font new notes start in, and the one the library card is written in.',
            '<b>Custom genres:</b> add your own, and move books between them.',
            '<b>Calm mode</b> turns off the bouncing, wiggling and sparkles. Or just turn off the confetti, or the goodbye animations.'
        ],
        psst: 'Deleting a book is never boring: it might get shredded, burned like a match, flung off the screen or dropped through a trapdoor. Each theme has its own too.'
    },
    {
        id: 'phone', title: 'On your phone',
        lead: 'It all works on a phone, folded up a little to fit.',
        shots: [
            { src: 'phone', alt: 'The phone layout with filters open', caption: '<b>Filters &amp; sorting</b>, opened.', small: true },
            { src: 'phoneshelf', alt: 'Shelves on a phone', caption: 'The round button (1) opens the corner crew.', small: true }
        ],
        tips: [
            'Search stays at the top; everything else is under <b>Filters &amp; sorting</b>. It shows a count like "&bull; 2" when filters are on.',
            'The round button in the bottom corner brings out the sticky notes, stats, goals and critter.',
            'Tap a dusty book to blow the dust off, and tap the cat to wake it.',
            'Remember: your phone has its own shelf. Use Export and Import to move books between devices.'
        ]
    },
    {
        id: 'oops', title: 'Oops! Fixing things',
        lead: 'Don\'t panic. Most things can be put back.',
        tips: [
            '<b>Logged the wrong pages?</b> The &times; next to them under Recent pages (goals) or Recent meals (critter) takes them back.',
            '<b>Changed a book by mistake?</b> Press <b>Cancel</b> instead of saving and nothing changes. (Notes on a book you already have save when you close the notepad.)',
            '<b>Deleted a book?</b> There\'s no undo, but importing your latest backup brings it back.',
            '<b>Sticky note fell off?</b> Click it to stick it back up.',
            '<b>Want to start fresh?</b> Settings &rarr; Start over can remove the example shelf, restart your pins, or delete everything (back up first!). <b>All books</b> there lists every book with a tick box, to delete just the ones you pick; <b>Tick example shelf books</b> picks out the example ones, even from a backup.',
            '<b>Something looks out of date?</b> Refresh the page to get the newest version.'
        ],
        psst: 'That\'s everything! You can come back to this guide any time from Settings. Happy reading &#9825;'
    }
];

// Each chapter's badge in the chapter list and by its title: a little
// enamel pin drawn like the ones on the pin board (pinSvg in pins.js),
// in the theme's enamel colours.
const GUIDE_PINS = (() => {
    const E = PIN_ENAMEL;
    return {
        // a shelf of books, one leaning
        // the guidebook itself: an open book with a ribbon (Settings, and
        // the welcome window's Show me around)
        book: { metal: 'gold', glint: [10, 14], rotate: -8, art: [
            ['e', 'M24 13C19 9.5 11.5 9.5 6 11.5V36C11.5 34 19 34 24 37.5Z', E.cream],
            ['e', 'M24 13C29 9.5 36.5 9.5 42 11.5V36C36.5 34 29 34 24 37.5Z', E.cream],
            ['e', 'M6 36C11.5 34 19 34 24 37.5C29 34 36.5 34 42 36V39.5C36.5 37.5 29 37.5 24 41C19 37.5 11.5 37.5 6 39.5Z', E.hot, null, 1.4],
            ['e', 'M30 10.6V25l2.6-2.3L35.2 25V10.3Z', E.lav, null, 1.2],
            ['l', 'M9.5 17c3.8-1 7.5-1 11 0'], ['l', 'M9.5 22c3.8-1 7.5-1 11 0'], ['l', 'M9.5 27c3.8-1 7.5-1 11 0'],
            ['e', pinHeart(32, 30.5, 3), E.pink, null, 1]
        ] },
        welcome: { metal: 'gold', glint: [12, 13], art: [
            ['e', 'M9 13h7v23h-7Z', E.hot],
            ['e', 'M17 10h6.5v26H17Z', E.sky],
            ['e', 'M24.5 15h6v21h-6Z', E.yellow],
            ['e', 'M31.6 16.4l5.4-1.5 5.6 19.6-5.4 1.5Z', E.mint],
            ['e', 'M6 36h36v4.5H6Z', E.lav],
            ['l', 'M10.5 18h4'], ['l', 'M10.5 31h4'], ['l', 'M18.5 15h3.5'], ['l', 'M26 20h3']
        ] },
        // a floppy disk
        saving: { metal: 'silver', glint: [12, 12], rotate: -8, art: [
            ['e', 'M11 8H33L40 15V37Q40 40 37 40H11Q8 40 8 37V11Q8 8 11 8Z', E.lav],
            ['e', 'M15 8H31V18H15Z', E.cream, null, 1.4],
            ['d', 'M25.5 10.5h3v5.5h-3Z', E.ink],
            ['e', 'M13 25H35V40H13Z', E.cream, null, 1.4],
            ['l', 'M17 30H31'], ['l', 'M17 35H27']
        ] },
        // a book with a plus
        adding: { metal: 'gold', glint: [14, 13], rotate: -6, art: [
            ['e', 'M13 8H34Q37 8 37 11V36H16Q13 36 13 33Z', E.peach],
            ['e', 'M16 36H37V40H16Q13 40 13 38Q13 36 16 36Z', E.cream, null, 1.4],
            ['l', 'M18 14H31'], ['l', 'M18 18.5H27'],
            ['e', pinCircle(34, 32, 7.5), E.mint],
            ['l', 'M34 28v8M30 32h8', 1.8]
        ] },
        // a magnifying glass
        secrets: { metal: 'silver', glint: [15, 15], art: [
            ['e', 'M28.4 31.6l3.2-3.2 8.6 8.6a2.3 2.3 0 0 1-3.2 3.2Z', E.hot],
            ['e', pinCircle(21, 21, 11), E.sky],
            ['d', 'M15 19a6.5 6.5 0 0 1 5.5-5.5', E.cream]
        ] },
        // a calendar page
        dates: { metal: 'gold', glint: [12, 18], rotate: 5, art: [
            ['e', 'M11 12H37Q40 12 40 15V37Q40 40 37 40H11Q8 40 8 37V15Q8 12 11 12Z', E.cream],
            ['e', 'M11 12H37Q40 12 40 15V20H8V15Q8 12 11 12Z', E.hot, null, 1.4],
            ['m', 'M15 8h2.6v7H15Z'], ['m', 'M30.4 8h2.6v7h-2.6Z'],
            ['t', 24, 35.5, 13, '15']
        ] },
        // a stack of books
        arrange: { metal: 'gold', glint: [13, 15], art: [
            ['e', 'M7 32H39V38H7Z', E.teal],
            ['e', 'M10 25H37V31H10Z', E.pink],
            ['e', 'M8 18H34V24H8Z', E.yellow],
            ['e', 'M12.4 11.8l20-3.2 1 5.9-20 3.2Z', E.lav],
            ['l', 'M33 32v6'], ['l', 'M14 25v6'], ['l', 'M29 18v6']
        ] },
        // a sticky note with its corner curling up
        stickies: { metal: 'silver', glint: [13, 13], rotate: -7, art: [
            ['e', 'M10 10H38V30L30 38H10Z', E.yellow],
            ['e', 'M38 30L30 38Q29 31 38 30Z', E.peach, null, 1.4],
            ['l', 'M15 17H33'], ['l', 'M15 22.5H33'], ['l', 'M15 28H27']
        ] },
        // a gift tag on a string
        lending: { metal: 'gold', glint: [14, 18], rotate: -12, art: [
            ['l', 'M33 24C37 19 39 14 43 10', 1.2],
            ['e', 'M8 17H28L37 24L28 31H8Z' + pinCircle(31, 24, 2), E.cream, 'evenodd'],
            ['e', pinHeart(18, 24, 4.6), E.hot, null, 1.2]
        ] },
        // a target with an arrow in the middle
        goals: { metal: 'silver', glint: [14, 14], art: [
            ['e', pinCircle(22, 26, 14), E.hot],
            ['e', pinCircle(22, 26, 9.5), E.cream, null, 1.4],
            ['e', pinCircle(22, 26, 4.8), E.hot, null, 1.4],
            ['l', 'M22 26L38 10', 1.6],
            ['m', 'M36 7l2 3 3 2-4 1-2-2Z']
        ] },
        // a speckled egg, cracking
        critter: { metal: 'gold', glint: [18, 14], rotate: 8, art: [
            ['e', 'M24 7C31.5 7 37 18.5 37 26.5A13 13 0 0 1 11 26.5C11 18.5 16.5 7 24 7Z', E.cream],
            ['d', pinCircle(18, 22, 2), E.pink], ['d', pinCircle(29, 17, 1.6), E.lav],
            ['d', pinCircle(30, 31, 2.2), E.mint], ['d', pinCircle(20, 33, 1.4), E.sky],
            ['l', 'M12.5 24L17 21L20 25L24 21L27.5 25L31 21.5L35.5 24', 1.2]
        ] },
        // a push pin
        pins: { metal: 'silver', glint: [18, 12], rotate: 18, art: [
            ['l', 'M24 28V43', 1.8],
            ['e', 'M16 8H32L29.5 13V20L35 26H13L18.5 20V13Z', E.hot],
            ['d', 'M20.5 12h2v7h-2Z', E.pink]
        ] },
        // a bar chart
        stats: { metal: 'gold', glint: [31, 11], art: [
            ['e', 'M9 27H16V38H9Z', E.mint],
            ['e', 'M19 19H26V38H19Z', E.sky],
            ['e', 'M29 12H36V38H29Z', E.hot],
            ['l', 'M6 39.5H41', 1.6],
            ['e', starPath(14, 15, 4.5, 2), E.yellow, null, 1.2]
        ] },
        // a paint palette
        yours: { metal: 'gold', glint: [14, 12], rotate: -10, art: [
            ['e', 'M24 8C14 8 7 15 7 24C7 33 14 40 22 40C25 40 25.5 38 24.5 36C23.5 34 24.5 32 27.5 32H31.5C36.5 32 41 29 41 23.5C41 14.5 34 8 24 8Z' + pinCircle(32.5, 23, 2.8), E.cream, 'evenodd'],
            ['d', pinCircle(15, 21, 3), E.hot], ['d', pinCircle(22, 14.5, 3), E.yellow],
            ['d', pinCircle(31, 15, 3), E.sky], ['d', pinCircle(15.5, 30.5, 3), E.mint]
        ] },
        // a phone with a little shelf on the screen
        phone: { metal: 'silver', glint: [16, 11], rotate: 10, art: [
            ['e', 'M16 6H32Q35 6 35 9V39Q35 42 32 42H16Q13 42 13 39V9Q13 6 16 6Z', E.lav],
            ['e', 'M16 11H32V35H16Z', E.sky, null, 1.2],
            ['d', 'M18 22h3v7h-3Z', E.hot], ['d', 'M22 20h3v9h-3Z', E.yellow], ['d', 'M26 23h3v6h-3Z', E.mint],
            ['d', 'M17.5 29h13v1.4h-13Z', E.cream],
            ['d', pinCircle(24, 38.5, 1.4), E.cream]
        ] },
        // a sticking plaster
        oops: { metal: 'gold', glint: [14, 20], rotate: -35, art: [
            ['e', 'M11 19H37A5 5 0 0 1 37 29H11A5 5 0 0 1 11 19Z', E.peach],
            ['e', 'M18 19H30V29H18Z', E.cream, null, 1.2],
            ['d', pinCircle(21.5, 22, 0.9), E.peach], ['d', pinCircle(26.5, 22, 0.9), E.peach],
            ['d', pinCircle(21.5, 26, 0.9), E.peach], ['d', pinCircle(26.5, 26, 0.9), E.peach],
            ['d', pinCircle(24, 24, 0.9), E.peach]
        ] }
    };
})();

const guidePinSvg = id => pinSvg(GUIDE_PINS[id]);

// the guidebook's pin on the ways in
document.querySelectorAll('.guide-book-pin').forEach(el => { el.innerHTML = guidePinSvg('book'); });

let guidePage = 0;

function openGuide(page) {
    if (typeof page === 'string') page = GUIDE.findIndex(c => c.id === page);
    if (!Number.isInteger(page) || page < 0) {
        try { page = Number(localStorage.getItem(GUIDE_PAGE_KEY)) || 0; } catch (e) { page = 0; }
    }
    renderGuideToc();
    // shown first, so the chapter list can scroll to the open chapter
    document.getElementById('guide-modal').style.display = 'flex';
    showGuidePage(Math.min(page, GUIDE.length - 1));
}

function closeGuide() {
    closeGuideZoom();
    document.getElementById('guide-modal').style.display = 'none';
}

const guideOpen = () => document.getElementById('guide-modal').style.display === 'flex';

const guideText = html => html.replace(/\{pins\}/g, typeof PINS !== 'undefined' ? PINS.length : 'dozens of');

function renderGuideToc() {
    const toc = document.getElementById('guide-toc');
    toc.innerHTML = '';
    GUIDE.forEach((c, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'guide-toc-btn';
        btn.dataset.guidePage = i;
        btn.innerHTML = `<span class="guide-toc-icon" aria-hidden="true">${guidePinSvg(c.id)}</span><span>${c.title}</span>`;
        btn.addEventListener('click', () => showGuidePage(i));
        toc.appendChild(btn);
    });
}

function guideShot(s) {
    const fig = document.createElement('figure');
    fig.className = 'guide-shot' + (s.small ? ' small' : '') + (s.half ? ' half' : '');
    fig.innerHTML = `<button type="button" class="guide-shot-frame" title="Click to see it bigger"><img src="assets/guide/${s.src}.webp" alt="${s.alt}" loading="lazy"></button>` +
        (s.caption ? `<figcaption>${s.caption}</figcaption>` : '');
    fig.querySelector('button').addEventListener('click', () => openGuideZoom(`assets/guide/${s.src}.webp`, s.alt));
    return fig;
}

function showGuidePage(i) {
    guidePage = i;
    try { localStorage.setItem(GUIDE_PAGE_KEY, String(i)); } catch (e) {}
    const c = GUIDE[i];
    const page = document.getElementById('guide-page');
    page.innerHTML = '';

    const head = document.createElement('div');
    head.className = 'guide-head';
    head.innerHTML = `<div class="guide-kicker">Chapter ${i + 1} of ${GUIDE.length}</div>` +
        `<h2 class="guide-title"><span class="guide-title-icon" aria-hidden="true">${guidePinSvg(c.id)}</span>${c.title}</h2>` +
        `<p class="guide-lead">${guideText(c.lead)}</p>`;
    page.appendChild(head);

    if (c.shots) {
        const shots = document.createElement('div');
        shots.className = 'guide-shots';
        c.shots.forEach(s => shots.appendChild(guideShot(s)));
        page.appendChild(shots);
    }
    if (c.themes) {
        const grid = document.createElement('div');
        grid.className = 'guide-themes';
        c.themes.forEach(([src, name]) => grid.appendChild(guideShot({ src: 'theme-' + src, alt: `The ${name} theme`, caption: name })));
        page.appendChild(grid);
    }
    if (c.warn) {
        const warn = document.createElement('div');
        warn.className = 'guide-warn';
        warn.innerHTML = guideText(c.warn);
        page.appendChild(warn);
    }
    const list = document.createElement(c.steps ? 'ol' : 'ul');
    list.className = 'guide-tips' + (c.steps ? ' steps' : '');
    c.tips.forEach(t => {
        const li = document.createElement('li');
        li.innerHTML = guideText(t);
        list.appendChild(li);
    });
    page.appendChild(list);
    if (c.psst) {
        const psst = document.createElement('aside');
        psst.className = 'guide-psst';
        psst.innerHTML = `<span class="guide-psst-label">Psst!</span> ${guideText(c.psst)}`;
        page.appendChild(psst);
    }
    page.scrollTop = 0;

    document.querySelectorAll('.guide-toc-btn').forEach(b => {
        const on = Number(b.dataset.guidePage) === i;
        b.classList.toggle('active', on);
        if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
        if (on) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    const back = document.getElementById('guide-back');
    const next = document.getElementById('guide-next');
    back.disabled = i === 0;
    next.textContent = i === GUIDE.length - 1 ? 'Done! Happy reading ♡' : `Next: ${GUIDE[i + 1].title} →`;
    document.getElementById('guide-count').textContent = `${i + 1} / ${GUIDE.length}`;
}

function guideStep(dir) {
    const i = guidePage + dir;
    if (i >= GUIDE.length) { closeGuide(); return; }
    if (i >= 0) showGuidePage(i);
}

// a screenshot, big, over the guide; click anywhere (or Esc) to put it back
function openGuideZoom(src, alt) {
    const zoom = document.getElementById('guide-zoom');
    zoom.querySelector('img').src = src;
    zoom.querySelector('img').alt = alt;
    zoom.hidden = false;
}

function closeGuideZoom() {
    document.getElementById('guide-zoom').hidden = true;
}

document.addEventListener('keydown', e => {
    if (!guideOpen() || (e.target.closest && e.target.closest('input, textarea, select'))) return;
    const zoomed = !document.getElementById('guide-zoom').hidden;
    if (e.key === 'Escape') { e.preventDefault(); zoomed ? closeGuideZoom() : closeGuide(); }
    else if (zoomed) return;
    else if (e.key === 'ArrowRight') { e.preventDefault(); guideStep(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); guideStep(-1); }
});
