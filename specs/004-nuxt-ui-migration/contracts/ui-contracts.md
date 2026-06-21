# UI Contracts: Nuxt UI Component Migration

This feature exposes **no network or core API contract** (no `src/core/` or `server/`
changes). For a UI application the contract is the **component public API** that consumers
(parent components, the `@nuxt/test-utils` suite) depend on, plus the **`data-test` selector
ledger** that is the regression gate. Both MUST remain stable across the migration (FR-002,
FR-006). Anything not listed here is internal and may change freely.

---

## 1. Component public APIs (MUST be unchanged)

The migration changes a component's *internals/markup*, never its props/emits/v-model. Each
signature below is the stable contract.

| Component | Props (in) | v-model | Emits (out) |
|---|---|---|---|
| `ConfirmDialog` | `open`, `title?`, `message?`, `confirmLabel?`, `cancelLabel?` | — | `confirm`, `cancel` |
| `BulkCleanDialog` | `open` | — | `confirm(filter: BulkCleanFilter)`, `cancel` |
| `GenerateForm` | `voices: Voice[]` | `voiceId`, `model`, `format`, `speed` | `add(text: string)` |
| `MetadataFields` | — | `modelValue: Metadata` | (none — v-model only) |
| `QueueItemEditor` | `item: QueueItem`, `voices: Voice[]` | — | `update(patch: ItemPatch)` |
| `UploadDropzone` | `summary?`, `maxBytes?` | — | `uploaded(content: string)` |
| `QueueList` | (unchanged) | (unchanged) | (unchanged) |
| `LibraryTable` | `items: LibraryItem[]`, `total: number` | `query: LibraryQuery`, `editingId: string \| null` | `save(item, patch)`, `delete(id)`, `bulk-clean(filter)` |
| `LibrarySearchBar` | — | `query: LibraryQuery` | (none — v-model only) |
| `LibraryItemEditor` | `item: LibraryItem` | — | `save({filename, metadata})`, `delete(id)`, `cancel` |
| `DefaultTagsSettings` | — | (uses `useDefaultTags()` composable) | (none) |

**Behavioral clauses that are part of the contract:**

- `LibraryTable` sort is **server-driven**: a sort header updates `query` to
  `{ sort, order, page: 1 }`; it MUST NOT sort client-side.
- `LibrarySearchBar`/`BulkCleanDialog` date selections MUST produce **inclusive local-day**
  ISO bounds (`from`→`T00:00:00`, `to`→`T23:59:59.999`) — identical to today (FR-011).
- `BulkCleanDialog` confirm is disabled until at least one filter is set; filters re-seed on
  each open.
- `QueueItemEditor` text commits on **blur** (validate-and-restore); an invalid edit shows the
  error and restores the previous value without emitting.
- `UploadDropzone` never uploads the file; it reads client-side, enforces `maxBytes`, and
  resets so the same file can be re-selected.
- Confirm/overlay components MUST trap focus while open, dismiss on Escape, and return focus to
  the trigger on close (now provided by `UModal`).

---

## 2. `data-test` selector ledger (MUST be preserved, or consuming test updated in-PR)

Grouped by surface. These are the hooks the suite asserts; preserving them keeps the
regression gate valid (FR-006).

**Generate — form/metadata/queue/upload**
```
voice, model, format, speed, add-text, add-item
meta-title, meta-artist, meta-album, meta-genre, meta-recordedAt, meta-track, meta-comment
meta-language-input, meta-language-add, meta-language-chip, meta-language-remove
meta-text-desc, meta-text-value, meta-text-add, meta-text-entry, meta-text-remove
meta-url-desc, meta-url-value, meta-url-add, meta-url-entry, meta-url-remove
queue-item-editor, edit-text, edit-text-error, edit-voice, edit-model, edit-format,
edit-instructions, edit-instructions-note, edit-skip-warning
upload-input, upload-error, upload-summary, summary-added, summary-blank, summary-rejected
```

**Library — table/search/editor/bulk**
```
library-search, filter-voice, filter-format, filter-range
library-empty, library-row, sort-title, sort-voice, sort-format, sort-createdAt
replay, download, edit-item, row-unavailable
page-status, page-prev, page-next
open-bulk-clean, bulk-clean-dialog, bulk-voice, bulk-range, bulk-cancel, bulk-confirm
library-item-editor, edit-filename, filename-ext, save-item, cancel-edit, delete-item
```

**Shared overlay / Settings**
```
confirm-dialog, confirm-cancel, confirm-ok
default-status, default-artist, default-album, default-genre, default-comment,
default-languages, default-save, default-clear, default-error
```

> Note: when a `data-test` must move onto a design-system wrapper (e.g. the date-picker
> trigger replaces the native date input), the hook stays on the *user-operable*
> element and the consuming test is updated in the same change. No hook is silently dropped.
>
> The date filters migrate to a **single range `UCalendar`**, so the former
> `filter-from`/`filter-to` and `bulk-from`/`bulk-to` pairs are intentionally **collapsed** to
> one `filter-range`/`bulk-range` hook each; the existing `bulk-from`/`bulk-to` test selectors
> are updated in the same change (FR-006). The emitted `query.from`/`query.to` values are
> unchanged.

---

## 3. Out of contract (free to change)

Internal markup, scoped styles, the bespoke `ConfirmDialog`/`BulkCleanDialog` focus-trap and
`<style>` blocks (deleted), the per-row expansion mechanism in `LibraryTable`, and Tailwind
utility classes. `LibraryList.vue` is removed entirely (no consumer).
