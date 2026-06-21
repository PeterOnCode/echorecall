# Quickstart: Nuxt UI Component Migration

A validation/run guide for the migration. It proves the feature end-to-end: the app looks
consistent, adapts to dark mode, and behaves identically — verified by the automated suite
(per the clarification, SC-002/SC-004 are gated by tests, not a manual pass). For control
mappings see [data-model.md](./data-model.md); for stable APIs/selectors see
[contracts/ui-contracts.md](./contracts/ui-contracts.md).

## Prerequisites

- Node **22.22.2** (pinned via mise). The bash shell defaults to a newer Node, so prefix
  install/test/build commands with `mise exec node@22.22.2 --`.
- pnpm. After the `@internationalized/date` dependency is added:
  ```bash
  mise exec node@22.22.2 -- pnpm install
  ```

## Run the app (visual sanity)

```bash
mise exec node@22.22.2 -- pnpm dev      # http://localhost:3000
```
Walk the three tabs in both themes (toggle the header color-mode switch):
- **Generate**: voice/model/format selects, speed stepper, text area, Add, Upload, queue-item
  editor (incl. metadata languages/custom text/url).
- **Library**: search, voice/format filters, **date-range picker**, sortable columns,
  pagination, replay/download/edit row actions, **bulk-clean** dialog.
- **Settings**: default-tag fields (save/clear), appearance/language, OpenAI key.
- **Delete confirm** overlay (from the library item editor) — confirm it renders correctly in
  **dark mode** (this is the previously-broken white-panel case).

Expected: every control is a design-system component, adapts to light/dark, and every action
produces the same result as before.

## Automated gate (authoritative)

```bash
mise exec node@22.22.2 -- pnpm test                              # unit + integration (core/server unaffected — must stay green)
mise exec node@22.22.2 -- pnpm test:component                    # @nuxt/test-utils component specs (the migration's main gate)
mise exec node@22.22.2 -- pnpm typecheck                         # strict TS incl. date-picker mapping
mise exec node@22.22.2 -- pnpm lint
```

Targeted component specs while iterating:
```bash
mise exec node@22.22.2 -- pnpm test:component LibraryTable
mise exec node@22.22.2 -- pnpm test:component BulkCleanDialog
mise exec node@22.22.2 -- pnpm test:component LibraryItemEditor
mise exec node@22.22.2 -- pnpm test:component QueueItemEditor
mise exec node@22.22.2 -- pnpm test:component MetadataFields
mise exec node@22.22.2 -- pnpm test:component DefaultTags
```

## Acceptance scenarios → evidence

| Spec criterion | How it's proven (automated) |
|---|---|
| SC-001 (no raw controls remain) | Inventory in data-model.md migrated; grep for raw interactive tags on in-scope files returns only justified exceptions. |
| SC-002 (dark mode) | Component tests render migrated overlays with `useColorMode` mocked `dark`; assert no bespoke `.backdrop`/`.dialog` hardcoded panel; renders without error. |
| SC-003 (no functional regression) | Full `pnpm test` + `pnpm test:component` green; rewritten specs assert identical outcomes (search/sort/filter/paginate/edit/delete/bulk-clean/save). |
| SC-004 (keyboard/focus) | UModal-overlay tests assert focus-trap, Escape→cancel, focus-return; date-range emits identical inclusive ISO bounds. |
| SC-005 (no perf regression) | No new network/interaction path; design-system components already in use elsewhere. |

## Definition of done

- [ ] All in-scope components migrated per [data-model.md](./data-model.md); `LibraryList.vue` removed.
- [ ] `@internationalized/date` added as a direct dependency; `pnpm install` clean.
- [ ] `pnpm test`, `pnpm test:component`, `pnpm typecheck`, `pnpm lint` all green.
- [ ] New overlay focus/theme tests present and passing (SC-002, SC-004).
- [ ] Every `data-test` hook in [contracts/ui-contracts.md](./contracts/ui-contracts.md) preserved or its test updated in-PR.
- [ ] Manual smoke of all three tabs in light + dark confirms visual consistency.
