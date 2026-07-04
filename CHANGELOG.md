# Changelog

All notable changes to EchoRecall are documented here.

## v0.6.0 — July 4, 2026

The Library, reimagined. The Library tab is now a desktop-style waveform
tag-editor — a sortable, multi-select file table on the left, a full tag editor
on the right, a filter bar across the top, and a waveform player and status bar
along the bottom. Organize and retag your whole library without leaving the
screen.

### ✨ New Features

- **Sortable, selectable file table**: Sort recordings by any column — filename,
  title, artist, album, year, track, or genre — and select them with checkboxes
  or by clicking a row. A Configure Columns dialog lets you show, hide, and
  reorder columns (filename always stays visible).
- **Library filter bar**: Narrow the entire library at once with a search-all box
  plus filters for audio format, recording-date range, genre, and language.
- **Full tag editor**: The inspector now edits the complete tag set — title,
  artist, album, comment, date, track number, genre, language, name, and more —
  with a Configure Visible Fields dialog to keep only the fields you use. Source
  text and Encoded-By are shown for reference (read-only).
- **Edits held safely until you save**: Your in-progress tag changes are kept per
  recording, so you can switch between files and come back without losing
  anything — nothing is written until you press Save.
- **Bulk tag edit & delete**: Apply a tag change — or a delete — to many selected
  recordings in a single action.
- **Status bar**: A new footer shows save state, how many files are loaded, your
  current selection, and encoding details (codec, bitrate, UTF-8).
- **Voice preview**: A preview link on the Generate screen lets you hear a sample
  of each voice before you choose one.

### 🔧 Improvements

- **Step through your whole library**: Previous/Next in the tag editor now moves
  across every recording — even spanning pages of results — so you can retag in
  sequence without returning to the table.
- **Reliable saves**: Saving tags renames and retags the file in one atomic step
  and reloads it, so the editor always matches the file on disk.
- **Show or hide the inspector**: Collapse the tag editor to give the file table
  the full width, and bring it back whenever you need it.

---

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
