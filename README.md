# My Bookshelf

A self-contained visual bookshelf app: `index.html` plus a small `assets/` folder (the notepad paper image). Open `index.html` in a browser — no build step, no server, no install. Keep `assets/` next to `index.html`; if you move or copy the app, move the whole folder. It also works hosted on GitHub Pages.

## Data storage

**The short version:** your books save automatically, all the time — there's no save button, you don't have to do anything. Closing the browser, shutting down your computer, whatever — none of that loses anything. Come back anytime and your books are still there. You only ever need the Export/Import buttons if you want to copy your books onto a *different* device or browser (like putting them on a tablet too). Moving or renaming `index.html` (or its folder) can make some browsers treat it as a new site with an empty shelf, so export a backup first; Import brings everything back.

The longer, more technical version:

All data lives **locally in your browser**, not on a server:

- **IndexedDB** (`BookShelfDB`) stores the actual library — titles, authors, cover/spine images, status, ratings, start/finish dates, tags, notes, and when each book entered its current status or was last dusted off (`statusSince` / `dustedAt`, used for the dust effect).
- **localStorage** stores a few small things: your custom genre list, recent colors, which shelves are expanded, your last-used notes font, the last genre picked on a sticky note, your Settings choices, and a few one-time migration flags.

There is no backend and no account — the app makes no network calls of its own (the only external request is loading the Google Fonts used for styling).

What this means in practice:

- Your library is tied to **that specific browser on that specific device**. A copy of the app opened on your tablet has its own separate library from the one on your desktop — nothing syncs automatically between them.
- Clearing site data/cache, switching browsers, or opening the file in a private/incognito window gives you a fresh library, not your existing books.
- **First visit:** on the hosted site, a new visitor starts with an example shelf (`starter-library.json`, a real shelf with notes, dates and ratings left out) so they can see how everything works; they can delete those books or use Settings > Start over. Opened straight from a file, the browser can't load that, so it starts with 3 placeholder books instead.
- **Export Library (Backup)** / **Import Library** (buttons above the shelves) are the only way to move your library between devices, or to back it up. Backups include your Settings too (theme, mode, name, reading goal, fonts, extras), and importing one restores them. Since there's no cloud sync, it's worth exporting a backup periodically if this data matters to you long-term.
- Import **replaces** your current library entirely with whatever's in the file you pick — there's a confirmation prompt since this can't be undone.

## Features

### Organizing your shelves
- Organize by Genre, Reading Status, Author, Series, Tag, or Rating; filter by status, ownership, genre, or tag; search by title/author.
- **Sticky Notes filter:** Show the to-get notes mixed in with your books, Hide them, or show Only them (a shopping list). Remembered between visits.
- Sort by Custom (drag & drop), Author last name, or Rating (high to low).
- Two view modes: **Covers** (front-cover art) and **Spines** (a shelf-accurate spine view — generated leather/gold look by default, or upload a real photo of the spine per book).
- Drag-and-drop manual reordering (in Genre, Reading Status, and Rating views, when Sort is set to Custom) — persists across reloads. Dragging a book onto another shelf moves it there: a new genre, a new status, or a new star rating. In Rating view every star level gets a shelf, even empty ones, so you can always drag a book to re-rate it.
- Long shelves can be expanded into multiple rows with the little round chevron button under them (it flips to collapse) instead of scrolling sideways. Each shelf remembers whether it's expanded.
- Each shelf shows a faint count of its books in the top-right corner.
- **Shelves act like real shelves:**
  - **Pull out to open:** clicking a book slides it out toward you before the edit window opens, and Cancel slides it back. Dragging still reorders like before, because a drag never counts as a click.
  - **Leaning books:** when a shelf has room left over, its last book leans over onto its neighbour. Adding or removing books makes it straighten up or tip over.
  - **Dust:** books that have sat in **Want to Read** for 3+ months gather a little dust, and more after 6 months. Hover over a dusty book (or tap it on a phone) to blow the dust off. That counts as dusting, so it stays clean and slowly builds up again.
  - **Shelf cat:** a little black pixel cat naps on top of a shelf. Hover over it (or tap it) and it wakes up, stretches, and hops over to another shelf.
- **Reading stats:** click the little ledger book in the bottom-left corner for your total number of books, counts by status, owned books, average rating, and a chart of books finished each month (pick any year; hover a column to see the titles, or switch to a table). Books you finished with only a year set are counted separately.
- **Sticky notes (books you want to get):**
  - **Quick add:** click the pile of sticky notes in the bottom-left corner, jot down a title, author and genre, and "Stick it ✓" puts the book straight onto your Want to Read list. The pile crumples the note and tosses it onto the shelf.
  - **On the shelf:** the book shows up as a yellow sticky note written in pencil (Nanum Pen Script), stuck on at a slightly crooked angle; some have a curled-up corner. Click it to open and edit it like any book.
  - **Falling off:** now and then a note comes unstuck and falls to the bottom of its shelf. Click it to stick it back up.
  - **Turning into a real book:** a sticky note becomes a regular book when you save it with any of these:
    - Owned ticked
    - a cover image added
    - a spine image added
    - a new cover color
    - a new width
    - a new cover shape (ratio preset)

    The sticky note takes off (one of the ways below) and the real book poofs into its spot in a little cloud with sparkles. Editing only the title, author, genre, status, rating, tags, dates or notes keeps it a sticky note. A note that became a book only because Owned was ticked turns back into a sticky note if you untick Owned. Once you've restyled it, it stays a book.
  - **Deleting one:** the note leaves in style, one of four ways at random:
    - crumpled into a pointy paper ball and thrown off the screen
    - folded into a paper airplane that swoops away
    - crumpled and dropped: it bounces on the bottom edge, sits a moment, then fades or rolls away
    - set on fire, smouldering away from the bottom up like a cigarette, with a glowing ember edge, wisps of smoke and falling ash

    It heads off a random side of the screen each time. The books next to it wait until it's gone, then slide over to fill the gap.
  - **Filter:** use the Sticky Notes buttons (Show / Hide / Only) to mix them in with your books, hide them, or show just them (a shopping list).
  - **Settings:** Settings can hide the sticky-note pile. With Calm mode (or your device's reduced-motion setting) on, notes simply appear and disappear without the animations.
- Series tracking: set "Out of" (total books in a series) to show grayed-out placeholders for volumes you haven't added yet, and dim unread-but-owned books versus ones marked Read.

- **On phones:** Search stays at the top and everything else folds into a **Filters & sorting** button (it shows a count like "• 2" when filters are on); button groups wrap neatly onto new lines. Books are drawn a bit smaller so more fit per row, and the edit window shows a compact preview row at the top.

### Book details
- **Ratings:** 1–5 stars per book (click the current star again to clear it).
- **Reading dates:** Started and Finished dates under Status. A full date, a month and year, or just a year all work, and each has a **today** button. The app catches impossible dates and a finish date before the start date. Dates are saved as `2024`, `2024-03`, or `2024-03-15`, ready for future per-month/per-year charts.
- **Genre vs. tags:** a book's genre is what it's about (Fantasy, Mystery, History…). Audience and format are tags instead, the way libraries label them: Children's, Middle Grade, Young Adult, New Adult, Graphic Novel, Short Stories, Poetry, Audiobook and Series are always suggested in the tag dropdown.
- **Tags:** pick from a dropdown of tags you've already used, or type a new one and press Enter. Tags show as removable badges that slowly drift through pastel colors.
- **Notes:** write about a book on a torn-paper notepad, in your choice of six handwriting fonts (Caveat, Indie Flower, Homemade Apple, Nanum Pen Script, Shadows Into Light, Gloria Hallelujah). Notes and font are saved per book; notes on an existing book save as soon as you close the notepad.
- Image cropping on upload for covers and spine photos.

### Little delights in the edit window
- Clicking a star sparkles (every star sparkles for 5 stars).
- Marking a book **Read** pops confetti and fills in today as the Finished date, if it's empty.
- The preview book wiggles when you change its status or give it a new cover.
- A "reading ♡" sticker appears on the preview while a book's status is Reading.
- If a book has notes, a corner of notepad paper peeks out behind the preview. Hover and it slides up a little; click it and it pulls out and unfolds into the notepad. Closing the notepad tucks it back behind the book.
- New tags bounce in and removed ones shrink away; new books get a random cute example title and author as placeholders.
- Hover over the preview book and its cover lifts a little; click it and the cover swings wide open, and its library checkout card slides out of a library pocket with the title, author, and start/finish dates handwritten in your notes font, plus a stamp for its status. Click to slide it back in.
- All animations turn off if your device is set to reduce motion.

### Other
- **Settings** (button next to Export/Import). Everything here is remembered:
  - **Theme:** eight to pick from, each with a light and a dark version:
    - **Candy:** pinks and purples.
    - **Sea Glass:** blues and greens.
    - **Holo:** Y2K liquid silver. A sleek space-age font (Orbitron) for the headings, chrome shelves, and a holographic rainbow shine on the title bars, panel edges and shelf tags (slowly shimmering unless Calm mode is on). Its pick-one buttons (filters, sorting, status) are glossy capsule pills, and its action buttons (add, save, cancel, notes, delete, backup) are cut-corner sci-fi panels.
    - **Library:** a gentleman's study. Cream linen, oxblood leather title bars with stitching, bottle-green accents, fully wooden walnut bookcase shelves (a solid walnut back, dark uprights, grained ledges), engraved brass nameplates, brass Cinzel lettering, and stitched leather buttons. After dark it turns dark academia: near-black charcoal, aged parchment text, oxblood leather, deep royal blue accents, antique brass and ebony shelves.
    - **Deco:** midnight Art Deco. Gold sunburst rays, double gold borders with stepped corners, black-lacquer shelves with a gold pinstripe, navy plaques with gold Limelight lettering, and sharp uppercase buttons. After dark it's a gold-on-navy speakeasy.
    - **Loft:** an industrial loft. Concrete, blackened-steel edges, brushed-steel title bars with rivets, solid blackened-steel shelf planks, flat blackened-steel shelf signs with a copper edge bar, bold Oswald lettering, and flat industrial-key buttons. After dark it's lit by warm Edison bulbs.
    - **Blueprint:** an artsy drafting table. Blueprint grid paper with compass circles and construction lines sketched across it, hand lettering (Architects Daughter), hand-lettered grid-paper shelf labels with an orange edge, clean cobalt shelf beams, orange registration marks, and neat condensed buttons with pops of signal orange on add and save. After dark it's a classic deep-blue blueprint with white lines.
    - **Terminal:** a classic retro computer. The whole page sits inside a beige monitor (rounded screen corners, a power light and a little badge), with VT323 terminal lettering, scanlines, a `C:\>` prompt with a blinking block cursor, a `READY.` prompt, inverse-video shelf names and pressed buttons, double-line shelves, and box-drawing lines like a system-info readout (`┌──── DETAILS ────` section boxes in the edit and Settings windows, and `├─` tree branches on the main panel's labels). After dark the screen is a glowing green phosphor CRT, everything in shades of green; by day it's a paper-white screen with dark phosphor text.
    - In Library, Deco, Loft, Blueprint and Terminal the recent-colour swatches in the edit window are wax seals, diamonds or paint chips instead of hearts.
  - **Mode:** Light, Dark, or Match device (follows your computer or phone's setting). Works with every theme; the notepad, library card and sticky notes stay paper-colored.
  - **Bookshelf name:** rename the title at the top of the page.
  - **Yearly reading goal:** shows a progress bar in the Reading Stats window, counting books marked Read with a finish date this year.
  - **Handwriting:** the font new notes start in, and the font for library cards (or match each book's notes). Sticky notes are always in Nanum Pen Script.
  - **Custom genres:** see the genres you've added and remove any with its ×. If books still use it, you pick a genre to move them to first.
  - **Start new books as:** Want to Read, Reading, or Read.
  - **Shelf extras:** turn the shelf cat, dust, leaning books, and the sticky-note pile on or off.
  - **Calm mode:** turns off all the animations.
  - **Start over:** delete the whole library (type DELETE to confirm), with an Export button right there to save a backup first. Optionally resets all settings too. The 3 starter books don't come back afterwards.

## Tests

Browser tests live in `tests/` and run in headless Chrome: `python tests/run.py` (needs Node.js 20+ and Google Chrome). See `tests/README.md`.
