# Changelog

All notable changes to EchoRecall are documented here.

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
