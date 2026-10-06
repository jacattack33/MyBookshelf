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
- Clearing site data/cache, switching browsers, or opening the file in a private/incognito window gives you an empty library (or the default 3-book seed set), not your existing books.
- **Export Library (Backup)** / **Import Library** (buttons above the shelves) are the only way to move your library between devices, or to back it up. Since there's no cloud sync, it's worth exporting a backup periodically if this data matters to you long-term.
- Import **replaces** your current library entirely with whatever's in the file you pick — there's a confirmation prompt since this can't be undone.

## Features

### Organizing your shelves
- Organize by Genre, Reading Status, Author, Series, Tag, or Rating; filter by status, ownership, genre, or tag; search by title/author.
- Sort by Custom (drag & drop), Author last name, or Rating (high to low).
- Two view modes: **Covers** (front-cover art) and **Spines** (a shelf-accurate spine view — generated leather/gold look by default, or upload a real photo of the spine per book).
- Drag-and-drop manual reordering (in Genre, Reading Status, and Rating views, when Sort is set to Custom) — persists across reloads. Dragging a book onto another shelf moves it there: a new genre, a new status, or a new star rating. In Rating view every star level gets a shelf, even empty ones, so you can always drag a book to re-rate it.
- Long shelves can be expanded into multiple rows with **Show all** instead of scrolling sideways. Each shelf remembers whether it's expanded.
- Each shelf shows a faint count of its books in the top-right corner.
- **Shelves act like real shelves:**
  - **Pull out to open:** clicking a book slides it out toward you before the edit window opens, and Cancel slides it back. Dragging still reorders like before, because a drag never counts as a click.
  - **Leaning books:** when a shelf has room left over, its last book leans over onto its neighbour. Adding or removing books makes it straighten up or tip over.
  - **Dust:** books that have sat in **Want to Read** for 3+ months gather a little dust, and more after 6 months. Hover over a dusty book (or tap it on a phone) to blow the dust off. That counts as dusting, so it stays clean and slowly builds up again.
  - **Shelf cat:** a little black pixel cat naps on top of a shelf. Hover over it (or tap it) and it wakes up, stretches, and hops over to another shelf.
- **Sticky-note quick add:** the pile of sticky notes in the bottom-left corner. Click it, jot down a title, author and genre, and "Stick it ✓" puts the book straight onto your Want to Read list.
- Series tracking: set "Out of" (total books in a series) to show grayed-out placeholders for volumes you haven't added yet, and dim unread-but-owned books versus ones marked Read.

### Book details
- **Ratings:** 1–5 stars per book (click the current star again to clear it).
- **Reading dates:** Started and Finished dates under Status. A full date, a month and year, or just a year all work, and each has a **today** button. The app catches impossible dates and a finish date before the start date. Dates are saved as `2024`, `2024-03`, or `2024-03-15`, ready for future per-month/per-year charts.
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
  - **Color scheme:** **Candy** (pinks and purples) or **Sea Glass** (blues and greens).
  - **Bookshelf name:** rename the title at the top of the page.
  - **Yearly reading goal:** shows a progress bar under the title, counting books marked Read with a finish date this year.
  - **Handwriting:** the font new notes start in, and the font for library cards (or match each book's notes). Sticky notes are always in Nanum Pen Script.
  - **Start new books as:** Want to Read, Reading, or Read.
  - **Shelf extras:** turn the shelf cat, dust, leaning books, and sticky notes on or off.
  - **Calm mode:** turns off all the animations.
  - **Start over:** delete the whole library (type DELETE to confirm), with an Export button right there to save a backup first. Optionally resets all settings too. The 3 starter books don't come back afterwards.
