# SchedSlate

A dark-mode visual schedule maker for time-blocking your week, day or month. Click a cell, block out the
time, pick a colour and an icon — everything is saved in your browser. No account, no backend, no build step.

![SchedSlate](SchedSlate%20Favicon.png)

---

## Quick start

The whole app is static. Either open `index.html` directly in a browser, or serve the folder:

```bash
# any static server works
python3 -m http.server 8000
# → http://localhost:8000
```

Deploying to GitHub Pages only requires publishing the repository root.

---

## What you can do

### Time-block grid
- A full **24-hour timeline in 30-minute slots** (`00:00` → `23:30`), with subtle grid lines for every
  half hour and a brighter line on the hour.
- **Click any empty cell** to create a block at that day and start time, or **drag vertically** to size a
  block in one gesture; a live ghost shows the exact time range while dragging.
- Blocks span as many consecutive slots as their duration requires, layering **side by side** when
  schedules overlap.
- A red **now marker** runs through today's column.
- The schedule title is **inline-editable** — click it to rename your slate (*"Fall Semester"*,
  *"Work Week"*, *"Family Routine"*).
- Click an existing block to edit it, or delete it with undo.

### Creating and customising blocks
Open the modal from either entry point — a grid cell or the **Add** button in the toolbar:

| Field | Details |
| --- | --- |
| Title | Required, used for the card and the accessible label |
| Repeat on | Multi-select weekday chips (Mon–Sun); one block can cover several days |
| Start / End | 30-minute steps, rendered in your chosen 12 h or 24 h clock, plus quick-duration chips |
| Colour | 9 curated dark-mode accents with the hex value shown |
| Icon | 30 Lucide icons (study, work, workout, meal, meeting, personal …) |
| Note | Optional short note, shown on taller cards |

### Views and settings
The **Settings** drawer (gear icon) re-renders the schedule instantly:

- **Clock type** — 12 h or 24 h across the timeline axis, cards and the modal.
- **Schedule view** — Daily, Weekly or Monthly.
- **Show weekend** — 5-day vs. 7-day grids (and weekend columns in the month view).
- **Start of the week** — Monday or Sunday.
- **Time increment** — ruler density of 15, 30 or 60 minutes. Blocks always snap to 30-minute slots.
- **Minimize schedule height** — compact rows for a denser overview.
- **Min schedule height (hours)** — how many hours are visible before the grid scrolls.
- **Language** — English or Deutsch, applied to every label, date and time.
- **Reset schedule** — clears all blocks and restores defaults.

### Monthly view
A calendar for the selected month, with the weekday's blocks as coloured chips (up to three per day,
with a “+n more” marker), month navigation, today highlighting and weekend filtering.

### Persistence
State is written to `localStorage` under the key `schedslate.state.v1` (debounced, flushed on page
hide), restored and sanitised on load, and kept in sync between open tabs. Malformed or outdated data
is repaired rather than crashing the app.

---

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `N` | New event |
| `1` / `2` / `3` | Daily / Weekly / Monthly view |
| `Enter` | Save the title while renaming, or submit the modal |
| `Esc` | Close the modal or drawer |

---

## Project structure

```
index.html               semantic shell: toolbar, title, grid mount, layers
assets/styles.css        design tokens, dark theme, grid, modal, drawer, responsive rules
assets/fonts/            Inter variable (latin subset), self-hosted
assets/js/icons.js       Lucide icon geometry + inline SVG helper
assets/js/utils.js       time/colour math, escaping, event bus
assets/js/i18n.js        en + de dictionaries, date/time formatting
assets/js/store.js       state, validation, localStorage, sample data
assets/js/grid.js        daily/weekly timeline + monthly calendar rendering and gestures
assets/js/modals.js      task modal, settings drawer, toasts
assets/js/app.js         bootstrap, toolbar, title editing, shortcuts
licenses/                ISC (Lucide) and OFL (Inter) license texts
```

No frameworks, no bundler, no runtime network calls: every asset is local, so the app works offline and
loads instantly.

---

## Accessibility & responsiveness

- Works from 320 px phones to wide desktops; the week grid scrolls horizontally with a sticky time
  gutter and sticky day headers.
- Blocks are real `<button>` elements, the title is an ARIA textbox, modals trap focus, restore it on
  close and close on `Esc` or backdrop click.
- Visible focus rings, labelled icon-only buttons, live-region toasts, `prefers-reduced-motion` support
  and a skip link.
- `color-scheme: dark` plus native `<select>` controls keep form UI consistent in dark mode.

---

## Credits

- Icons: [Lucide](https://lucide.dev) (ISC) — see `licenses/Lucide-ISC.txt`.
- Typeface: [Inter](https://rsms.me/inter/) (SIL OFL 1.1) — see `licenses/Inter-OFL.txt`.
- Built with plain HTML, CSS and JavaScript.
