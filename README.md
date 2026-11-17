# SchedSlate

A dark-mode weekly schedule maker for time-blocking. Click a cell, block out the time, pick a colour —
everything is saved in your browser. No account, no backend, no build step.

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

### Weekly time-block grid
- A full **24-hour timeline in 30-minute slots** (`00:00` → `23:30`), with solid 1px rules for every
  half hour and a slightly stronger rule on the hour.
- **Click any empty cell** to create a block at that day and start time, or **drag vertically** to size a
  block in one gesture; a live ghost shows the exact time range while dragging.
- Blocks span as many consecutive slots as their duration requires and lay **side by side** when
  schedules overlap.
- A recurring block can use **different hours on each weekday** while staying one event.
- A red **now marker** runs through today's column, and today's day header is highlighted.
- The schedule title is **inline-editable** — click it to rename your slate (*"Fall Semester"*,
  *"Work Week"*, *"Family Routine"*).
- Click an existing block to edit it, or delete it with undo.

### Creating and customising blocks
Open the modal from either entry point — a grid cell or the **Add** button in the toolbar:

| Field | Details |
| --- | --- |
| Title | Required, used for the card and the accessible label |
| Repeat on | Multi-select weekday chips (Mon–Sun); one event can cover several days |
| Times per day | A separate start and end time for every selected day, in 30-minute steps |
| Quick durations | Apply 30 min / 1 h / 1½ h / 2 h to all selected days at once |
| Colour | 9 curated dark-mode accents with the hex value shown |
| Note | Optional short note, shown on taller cards |

### Recurring events with per-day hours

Selecting more than one day does **not** force a single shared slot. Each selected day gets its own
start and end time, so one recurring event can cover *Monday 07:30–10:30* and *Saturday 07:30–09:30*
while remaining a single entry in your schedule.

- A newly selected day is **pre-filled** with the hours of the first selected day (09:00–10:00 when it
  is the only one), so adding days is quick and each one can then be adjusted.
- Changing one day's start keeps that day's duration and shifts its end; other days are untouched.
- Days are validated individually: every occurrence needs an end time after its start (the end picker
  only offers values from start + 30 minutes, and submission re-checks it).
- Each occurrence is rendered at its own time and size, but all occurrences share one event id, so
  editing or deleting any card updates the whole recurrence.

Blocks are identified by colour alone — there is no icon picker.

### Settings
The **Settings** drawer (gear icon) re-renders the schedule instantly:

- **Clock type** — 12 h or 24 h across the timeline axis, cards and the modal.
- **Show weekend** — 5-day vs. 7-day grids.
- **Start of the week** — Monday or Sunday.
- **Time increment** — ruler density of 15, 30 or 60 minutes. Blocks always snap to 30-minute slots.
- **Minimize schedule height** — compact rows for a denser overview.
- **Min schedule height (hours)** — how many hours are visible before the grid scrolls.
- **Language** — English or Deutsch, applied to every label and time.
- **Reset schedule** — clears all blocks and restores defaults.

### Persistence and data model
An event stores one slot per weekday:

```js
{
  id: 'ev_…', title: 'Deep work', note: '', color: '#7c8cff',
  times: {
    1: { start: 450, duration: 180 },  // Monday   07:30–10:30
    6: { start: 450, duration: 120 }   // Saturday 07:30–09:30
  }
}
```

`start` is minutes from midnight and `duration` is in 30-minute steps.

State is written to `localStorage` under the key `schedslate.state.v1` (debounced, flushed on page
hide), restored and sanitised on load, and kept in sync between open tabs. Malformed or outdated data
is repaired rather than crashing the app, and events saved by earlier versions
(`{ days: [1, 6], start: 450, duration: 180 }`) are migrated by stamping the shared slot onto every
selected day.

---

## Design rules

- **Dark mode first:** deep slate surfaces, off-white typography, low-contrast hairlines.
- **Pure colours only:** every fill, border and shadow uses a flat single colour — no gradients
  anywhere in the stylesheet or in generated markup. Grid rules are real 1px elements rather than
  gradient hacks, and there are no blur filters.
- **Task colours** are applied as flat translucent tints of the chosen accent, so text stays readable.

---

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `N` | New event |
| `Enter` | Save the title while renaming, or submit the modal |
| `Esc` | Close the modal or drawer |

---

## Project structure

```
index.html               semantic shell: toolbar, title, grid mount, layers
assets/styles.css        design tokens, dark theme, grid, modal, drawer, responsive rules
assets/fonts/            Inter variable (latin subset), self-hosted
assets/js/icons.js       the 12 interface icons (Lucide geometry + inline SVG helper)
assets/js/utils.js       time/colour math, escaping, event bus
assets/js/i18n.js        en + de dictionaries, date/time formatting
assets/js/store.js       state, validation, localStorage, sample data
assets/js/grid.js        weekly timeline rendering and pointer gestures
assets/js/modals.js      task modal, settings drawer, toasts
assets/js/app.js         bootstrap, toolbar, title editing, shortcuts
licenses/                ISC (Lucide) and OFL (Inter) license texts
```

No frameworks, no bundler, no runtime network calls: every asset is local, so the app works offline and
loads instantly.

---

## Accessibility & responsiveness

- Works from 320 px phones to wide desktops; the grid scrolls horizontally with a sticky time gutter and
  sticky day headers.
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
