# Phase 1 Data Model: Nuxt UI Component Migration

This feature introduces **no data entities, fields, or persisted state** — `src/core/`, the
SQLite schema, and all server routes are untouched. The analogous "model" for a
presentation-only migration is the **control inventory**: every raw HTML control in scope, its
target `@nuxt/ui` component, the binding/behavior that MUST be preserved, and its `data-test`
hook. This is the authoritative checklist the migration and its tests are verified against.

Legend: **v-model** = two-way binding preserved · **emit** = event preserved · **dt** =
`data-test` hook preserved · **kbd** = keyboard behavior preserved.

---

## P1 — Generate surface

### `generate/GenerateForm.vue`
| Current | Target | Preserve |
|---|---|---|
| `<select>` voice | `USelectMenu` (items from `voices`) | v-model `voiceId`; dt `voice` |
| `<select>` model | `USelectMenu` (items from `MODELS`) | v-model `model`; dt `model` |
| `<select>` format | `USelectMenu` (items from `FORMATS`, label = `ext.toUpperCase()`) | v-model `format`; dt `format` |
| `<input type=number>` speed | `UInputNumber` | v-model.number `speed`; `min 0.25 / max 4 / step 0.05`; dt `speed` |
| `<textarea>` add-text | `UTextarea` | v-model `text`; dt `add-text`; **kbd** `@keydown.ctrl.enter`→`onAdd` |
| label groups | `UFormField` | i18n labels unchanged |
| `UButton` add-item | (unchanged) | emit `add`; dt `add-item` |

### `generate/MetadataFields.vue`
| Current | Target | Preserve |
|---|---|---|
| 6× scalar `<input type=text>` (title/artist/album/genre/recordedAt/track) | `UInput` | per-field v-model that drops key when blank; dt `meta-title/artist/album/genre/recordedAt/track` |
| `<textarea>` comment | `UTextarea` | v-model `comment`; dt `meta-comment` |
| language chip `<span>` + `×<button>` | `UBadge` + `UButton` | dt `meta-language-chip` / `meta-language-remove`; `removeLanguage(i)` |
| language `<input>` + Add | `UInput` + `UButton` | dt `meta-language-input` / `meta-language-add`; **kbd** Enter→`addLanguage` |
| customText desc/value `<input>` + Add | `UInput` ×2 + `UButton` | dt `meta-text-desc/value/add`; Enter→`addText`; list dt `meta-text-entry` + remove `meta-text-remove` |
| customUrl desc/value `<input type=url>` + Add | `UInput` ×2 + `UButton` | dt `meta-url-desc/value/add`; Enter→`addUrl`; list dt `meta-url-entry` + remove `meta-url-remove` |
| `<fieldset>/<legend>` | keep (semantic group) or `UCard` w/ header | grouping label preserved (structural, no interactive control) |

### `generate/QueueItemEditor.vue`
| Current | Target | Preserve |
|---|---|---|
| `<textarea>` draft text | `UTextarea` | v-model `draftText`; dt `edit-text`; **kbd** `@input`→clear error, **`@blur`→commitText** (commit-on-blur is load-bearing for the validate-and-restore flow) |
| text error `<span>` | (unchanged) | dt `edit-text-error` |
| `<select>` voice/model/format | `USelectMenu` ×3 | v-model computed emitting `update`; dt `edit-voice/model/format` |
| `<textarea>` instructions | `UTextarea` | v-model.lazy `instructions`; dt `edit-instructions`; note dt `edit-instructions-note` |
| skip warning `<p>` | (unchanged) | dt `edit-skip-warning` |
| `<MetadataFields>` | (migrated above) | v-model `metadata` |

### `generate/UploadDropzone.vue`
| Current | Target | Preserve |
|---|---|---|
| `<input type=file>` | `UFileUpload` (click-to-select preserved) | `.txt`/`text/plain` accept; `MAX_UPLOAD_BYTES` guard; read `file.text()`; emit `uploaded`; reset to allow re-select; never upload; dt `upload-input`; error dt `upload-error`, summary dt `upload-summary`/`summary-added/blank/rejected` |

### `generate/QueueList.vue`
No raw interactive control (already `UButton`-based). Verify only; update selectors if a child swap requires.

---

## P2 — Library surface

### `library/LibraryTable.vue` (FR-010)
| Current | Target | Preserve |
|---|---|---|
| `<table>/<thead>/<tbody>` | `UTable` (`:data`/`:columns`, cell/header slots) | 5 columns: name, voice, format, created, actions |
| sort `<button>` ×4 | `UButton` in column `#…-header` slot | `toggleSort(col)`; ▲/▼ indicator; dt `sort-title/voice/format/createdAt`; server-driven (`query.sort/order`, `page:1`) |
| inline player `<tr>` | `#expanded` region, mode `player` | renders `AudioPlayer`; toggle via dt `replay`; `markUnavailable` on error |
| inline editor `<tr>` | `#expanded` region, mode `editor` | renders `LibraryItemEditor`; toggle via dt `edit-item`; `editingId` v-model |
| row actions (replay/download/edit) | `UButton` (already) | dt `replay/download/edit-item`; download `?download=1`, disabled when unavailable |
| unavailable indicator | (unchanged markup) | dt `row-unavailable`; replay disabled |
| pagination prev/next/status | `UPagination` or keep `UButton` | dt `page-prev/page-next/page-status`; disable at bounds; `goToPage` clamping |
| empty/no-results `<p>` | (unchanged) | dt `library-empty` |
| bulk-clean trigger + `<BulkCleanDialog>` | `UButton` (already) + migrated dialog | dt `open-bulk-clean`; emits `bulk-clean` |

### `library/LibrarySearchBar.vue`
| Current | Target | Preserve |
|---|---|---|
| `<input type=search>` q | `UInput` (type search) | v-model `q` (trim→undefined); reset `page:1`; dt `library-search` |
| `<select>` voice | `USelectMenu` (+ "all" item) | v-model `voiceId`; dt `filter-voice` |
| `<select>` format | `USelectMenu` (+ "all" item) | v-model `format`; dt `filter-format` |
| 2×`<input type=date>` from/to | single range date picker (D3) | one range selection → `from` ISO local-day **start** (`T00:00:00`) + `to` **end** (`T23:59:59.999`); range enforces start≤end (replaces `:min`/`:max`); clear resets both; dt `filter-range` (collapses former `filter-from`/`filter-to`) |

### `library/LibraryItemEditor.vue`
| Current | Target | Preserve |
|---|---|---|
| filename `<input type=text>` | `UInput` (ext in trailing slot) | v-model `filenameBase`; dt `edit-filename`; read-only ext dt `filename-ext` |
| `<MetadataFields>` | (migrated) | v-model `metadata` (deep-cloned draft) |
| `UButton` save/cancel/delete | (unchanged) | dt `save-item/cancel-edit/delete-item`; emits `save/cancel/delete` |
| `<ConfirmDialog>` delete confirm | migrated → `UModal` | confirm→`confirmDelete`, cancel→close |

---

## P3 — Overlays & Settings

### `ConfirmDialog.vue` → `UModal` (FR-003/004/008)
| Current | Target | Preserve |
|---|---|---|
| `<div class=backdrop><div class=dialog role=dialog>` + scoped `<style>` (#fff) | `UModal` (`v-model:open`) | props `title/message/confirmLabel/cancelLabel`; emits `confirm/cancel`; **delete** scoped styles + manual focus-trap/keydown |
| cancel/confirm `<button>` | `UButton` (neutral / error) | dt `confirm-cancel` / `confirm-ok`; root dt `confirm-dialog` |
| (provided by UModal) | focus trap, Escape→cancel, backdrop click→cancel, focus-return | SC-004 behaviors now library-provided |

### `library/BulkCleanDialog.vue` → `UModal`
| Current | Target | Preserve |
|---|---|---|
| bespoke modal + scoped `<style>` | `UModal` (`v-model:open` from `open` prop) | root dt `bulk-clean-dialog`; re-seed filters on open |
| `<select>` voice | `USelectMenu` (+ any-voice item) | v-model `voiceId`; dt `bulk-voice` |
| 2×`<input type=date>` from/to | single range date picker (D3) | one range selection → inclusive local-day ISO bounds; dt `bulk-range` (collapses former `bulk-from`/`bulk-to`) |
| need-filter `<p>` + buttons | `UButton` cancel/confirm | dt `bulk-cancel`/`bulk-confirm`; confirm disabled until `hasFilter`; emits `confirm(filter)`/`cancel` |

### `settings/DefaultTagsSettings.vue`
| Current | Target | Preserve |
|---|---|---|
| 5× `<input>` (artist/album/genre/comment/languages) | `UInput` in `UFormField` | v-model `values.*`; `:disabled="loading||saving"`; dt `default-artist/album/genre/comment/languages`; languages hint/placeholder |
| status / error `<p>` | (unchanged) | dt `default-status` / `default-error` |
| `UButton` save/clear | (unchanged) | dt `default-save`/`default-clear`; `:loading`, `:disabled` rules |

### `settings/OpenAiKeySettings.vue`
No raw interactive control (already `UInput`/`UButton`). Verify only.

---

## Removals

| File | Reason |
|---|---|
| `app/components/LibraryList.vue` | Dead component — unreferenced by any page/component (superseded by `LibraryTable`). Remove per YAGNI (Principle V). |
| `tests/component/LibraryList.test.ts` | Removed with the component. |

---

## Cross-cutting invariants (apply to every row above)

1. **No functional regression** (FR-002): v-model shapes, emits, validation, enable/disable
   conditions, and local interactions identical — except the date-picker interaction (FR-011).
2. **`data-test` parity** (FR-006): every hook above is preserved on the migrated control, or
   its consuming test is updated in the same change.
3. **Theme** (FR-003): no hardcoded colors; all controls adapt to light/dark via the design
   system.
4. **i18n** (FR-005): all visible text continues to resolve from `en.json`/`hu.json`.
