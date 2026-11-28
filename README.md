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
| Theme inspiration | Four curated dark-mode card themes, previewed before you save |
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

Blocks are styled by theme alone — there is no colour picker and no icon picker.

### Theme inspirations

Instead of picking a raw colour, each event wears one of four curated dark-mode themes. The selector
shows a miniature card preview (surface, accent bar and title tone) plus the palette dots, and the
chosen theme is applied to every occurrence on the grid.

| Theme | Surface | Accent | Title / body |
| --- | --- | --- | --- |
| **Kamen Rider OOO** | `#1F1216` deep crimson-charcoal | tri-colour bar: `#EF4444` · `#F59E0B` · `#10B981` | `#FDE68A` gold title, `#F8FAFC` body |
| **Wednesday** | `#09090B` obsidian | monochrome silver `#E4E4E7` / `#71717A` | `#FFFFFF` title, `#D4D4D8` body |
| **Gengar** | `#24113A` shadow purple | neon violet `#A855F7` with crimson `#F43F5E` tip | `#F3E8FF` title, `#E9D5FF` body |
| **Mobile Legends** | `#111C3D` midnight blue | gold `#EAB308` with cyan `#38BDF8` | `#FACC15` title, `#F0F9FF` body |

Mobile Legends is the default for new events. All four themes keep title, time and note text at high
contrast on their surfaces, and the accent stripe is built from solid colour segments — no gradients.

### Save as PNG

The **Save** button in the toolbar renders the schedule to a PNG and downloads it straight to your
device — PNG is the only export format.

- Only the schedule is captured. The image is rendered from a dedicated `#export-root` container that
  holds the schedule header (date line, title, plain-text block/hour summary) and the timetable grid,
  and nothing else: no top bar, no Add / Settings / Save buttons, no stat pills, no modals, toasts or
  page margins. A `filter` callback drops anything chrome-related a second time.
- Capturing happens on an off-screen stage (`position: fixed; left: -9999px`), so the page never
  flickers while the image is built. The stage is removed as soon as the download fires, on success
  and on failure alike.
- The exported timeline is cropped to the hours that actually hold events: the earliest start and the
  latest end across the visible days, plus one 30-minute slot of breathing room above and below
  (clamped to the day). Rows outside that window are dropped, the body height shrinks, and every card
  and timestamp is re-based so events stay exactly on their real start/end. A completely empty slate
  exports a daytime **07:00 – 15:00** window instead of all 24 hours. The header prints the window
  (e.g. *06:30 – 21:00 · 17 blocks · 20.5 h planned*). The live app is untouched — it always keeps the
  full 00:00 – 23:30 grid.
- The cloned grid is unclamped (`height: auto`, `max-height: none`, `overflow: visible`) and its sticky
  headers flattened, so nothing is cut off by the scroll viewport.
- The canvas is a fixed **1280 px** desktop layout with **32 px** outer padding on a flat `#0F172A`
  slate background, so exports from a phone or a narrow window look the same as from a wide monitor,
  and the cropped height keeps the image within a widescreen-friendly aspect ratio.
- An `is-exporting` class on the canvas hides live markers (the "now" line), hover states, focus rings
  and scrollbars during the capture.
- Rendering is done with `html-to-image` at **2× pixel ratio**, so 30-minute rules, timestamps, Lucide
  icons and every **Theme Inspiration** card style stay crisp when zoomed or printed.
- The file is named after your schedule title: *My Schedule* → `my-schedule.png`, with `schedule.png`
  as the fallback for empty or non-latin titles.
- While the image renders the button shows a spinner and *Rendering…*; a toast confirms
  *Schedule saved as PNG* (or reports a failure without breaking the app).

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
  id: 'ev_…', title: 'Deep work', note: '', theme: 'mobile-legends',
  times: {
    1: { start: 450, duration: 180 },  // Monday   07:30–10:30
    6: { start: 450, duration: 120 }   // Saturday 07:30–09:30
  }
}
```

`start` is minutes from midnight and `duration` is in 30-minute steps. `theme` is one of
`kamen-rider-ooo`, `wednesday`, `gengar` or `mobile-legends`.

State is written to `localStorage` under the key `schedslate.state.v1` (debounced, flushed on page
hide), restored and sanitised on load, and kept in sync between open tabs. Malformed or outdated data
is repaired rather than crashing the app. Events saved by earlier versions are migrated: a shared
`{ days, start, duration }` slot is stamped onto every selected day, and an old flat `color` is mapped
to the closest inspiration theme (violet/rose → Gengar, amber/orange/lime → Kamen Rider OOO, slate →
Wednesday, blue/teal → Mobile Legends). Unknown or missing themes fall back to Mobile Legends.

---

## Design rules

- **Dark mode first:** deep slate surfaces, off-white typography, low-contrast hairlines.
- **Pure colours only:** every fill, border and shadow uses a flat single colour — no gradients
  anywhere in the stylesheet or in generated markup. Grid rules are real 1px elements rather than
  gradient hacks, and there are no blur filters.
- **Themes** render as flat opaque card surfaces with a solid tri-colour accent stripe and dedicated
  title/body/secondary text tones, so every card stays readable.

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
assets/js/icons.js       the 14 interface icons (Lucide geometry + inline SVG helper)
assets/js/utils.js       time/colour math, escaping, event bus
assets/js/i18n.js        en + de dictionaries, date/time formatting
assets/js/store.js       state, validation, localStorage, sample data
assets/js/grid.js        weekly timeline rendering and pointer gestures
assets/js/modals.js      task modal, settings drawer, toasts
assets/js/export.js      isolated #export-root build, PNG capture and download
assets/js/app.js         bootstrap, toolbar, title editing, shortcuts
assets/vendor/           html-to-image 1.11.13 (MIT) for the PNG capture
licenses/                ISC (Lucide), OFL (Inter) and MIT (html-to-image) texts
```

No frameworks, no bundler, no runtime network calls: every asset — including the html-to-image bundle
used for PNG export — is local, so the app works offline and loads instantly.

---

## Accessibility & responsiveness

- Works from 320 px phones to wide desktops; the grid scrolls horizontally with a sticky time gutter and
  sticky day headers.
- Blocks are real `<button>` elements, the title is an ARIA textbox, modals trap focus, restore it on
  close and close on `Esc` or backdrop click.
- Visible focus rings, labelled icon-only buttons, live-region toasts, `prefers-reduced-motion` support
  and a skip link.
- The Save button is labelled *Save as PNG* for screen readers, exposes `aria-busy` while the image
  renders, and its spinner animation is disabled for reduced-motion users.
- `color-scheme: dark` plus native `<select>` controls keep form UI consistent in dark mode.

---

## Credits

- Icons: [Lucide](https://lucide.dev) (ISC) — see `licenses/Lucide-ISC.txt`.
- Typeface: [Inter](https://rsms.me/inter/) (SIL OFL 1.1) — see `licenses/Inter-OFL.txt`.
- Built with plain HTML, CSS and JavaScript.
