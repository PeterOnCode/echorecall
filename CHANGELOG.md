# Changelog

All notable changes to EchoRecall are documented here.

## v0.5.0 — June 24, 2026

The dashboard redesign. Generate and Library now share a single resizable
two-pane workspace built for speed: curate a queue and edit details side by
side, drive everything from one toolbar, and review recordings on a real
waveform player.

### ✨ New Features

- **Resizable two-pane workspace**: Generate and Library now show your list on
  one side and the selected item's editor on the other — no screen switching.
  Drag the divider to set the split, and it's remembered the next time you visit.
- **Centralized action toolbar**: Upload, previous/next, generate, save queue,
  open queue, and settings now live in one header toolbar. Previous/next step
  through the queue so you can edit every item without going back to the list.
- **Queue search & filters**: Find items fast in a long queue — search by
  filename or text, and filter by voice, format, album, recording date, and
  language. Clear the filters to restore the full list.
- **Multi-select and bulk delete**: A new checkbox column lets you select many
  queue items and delete them in a single confirmed action. A source column shows
  where each item came from — its uploaded filename, or "Text Entered."
- **Add text without a file**: Type a snippet straight into the Generate surface
  to add it to the queue as a "Text Entered" item, with no file to prepare or
  upload.
- **Recording-date picker**: New items default their recording date to tomorrow,
  changeable any time with a calendar picker.
- **Save & open your queue**: Export your current queue to a local file and
  re-open it later — your queue, managed by you, with nothing stored on a server.
- **Waveform review player**: The Library now shows the selected recording as a
  waveform you can play, zoom into, and mark loop regions on for focused
  listening. (Regions are a playback aid only — your audio is never altered.)

### 🔧 Improvements

- **Smarter Generate**: Generate now runs on your checked items, or the whole
  queue when nothing is checked. Successfully generated items leave the queue
  automatically (failures stay so you can retry them), and you can still download
  the whole batch you just generated as a single archive.
- **Library workspace parity**: The Library gains the same two-pane layout, with
  an audio-tags panel and previous/next navigation so you can edit tags across
  recordings without returning to the table.
- **Generation defaults bar**: Set a default voice, model, format, and speed once
  and every new queue item inherits them — each item stays individually editable.
- **Customizable columns**: Choose which queue columns are visible from a small
  settings dialog; your choice is remembered across sessions.
- **Settings in a modal**: Settings now open as a dialog over your current screen
  from the toolbar, keeping your place — the standalone Settings tab has been
  removed.

---

## v0.3.0 — June 22, 2026

A polish-focused release: a refreshed, consistent interface across the whole app
plus the ability to set your default audio-tag values right in Settings.

### ✨ New Features

- **Default tag values in Settings**: Set your preferred defaults for audio tags
  (artist, album, and more) once in the Settings tab, and every new generation
  starts pre-filled — no more retyping the same values each time.

### 🔧 Improvements

- **Refreshed interface**: The Generate, Library, and Settings screens now share a
  cleaner, more consistent look and feel, with unified inputs, dropdowns, dialogs,
  and the library table.
- **New date-range filter in the Library**: Filter your recordings by date using a
  calendar popover instead of typing dates by hand — pick a start and end date
  visually.
- **Instant language switching**: Dropdown and picker labels now update immediately
  when you change the app language.

### 🐛 Fixes

- **Dark mode dialogs**: Confirmation and bulk-clean dialogs no longer flash a
  hardcoded white background in dark mode.
- **Screen reader support**: Confirmation dialog messages are now properly announced
  to assistive technologies.
- **Keyboard navigation**: The hidden file-upload control on the Generate screen no
  longer interrupts the keyboard tab order.

---

## v0.2.0 — June 20, 2026

Studio enhancements: batch generation with multi-format audio export
(MP3, WAV, FLAC, Opus, AAC, PCM), audio tagging, an improved library with
server-side search/sort/filter/pagination, and an in-app OpenAI key.
