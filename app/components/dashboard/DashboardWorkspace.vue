<script setup lang="ts">
// Shared resizable two-pane workspace for the Generate and Library surfaces
// (FR-001). Built on @nuxt/ui's dashboard primitives: `UDashboardGroup` owns the
// split-size persistence (keyed by `storageKey`, stored locally — FR-002), the
// left `UDashboardPanel` is resizable (the list), and the right panel (the detail)
// flexes to fill. When nothing is selected the caller sets `detailEmpty` and the
// `#empty` slot is shown instead of `#detail` (FR-003). The optional `#footer`
// slot hosts the Library waveform player (US6).
//
// `detailCollapsed` (FR-021) drops the entire detail pane — `#detail`/`#footer`
// and the resize handle — and lets the list pane take the full width, so the
// Library show/hide-inspector control gives the table all the room. The list panel
// stays `resizable` so its persisted split ratio is untouched and restored verbatim
// once the pane returns (we only swap its width class while collapsed). The panel
// theme's resize `size` variant sets `w-full lg:w-(--width)`, so plain `w-full` is
// NOT enough — the `lg:`-prefixed rule out-specifies it at `lg+` (where this view
// lives) and the table stays at the split width. We must override `lg:w-full` too.
//
// Those primitives are authored as a full-viewport *app shell* — `UDashboardGroup`
// is `fixed inset-0`, each `UDashboardPanel` is `min-h-svh`, and the resize handle
// is `hidden` below `lg`. Embedded here as a page section that would overlay the
// whole viewport and hide the handle on small screens. We override exactly those
// three theme classes so the workspace sits in normal page flow at a contained
// height, the panes fill that height, and the divider is visible/draggable at every
// breakpoint. The resize math itself is parent-relative (see @nuxt/ui
// `useResizable`), so it works unchanged once the layout is in flow.
withDefaults(
  defineProps<{
    /** Stable key under which the split size is persisted across sessions. */
    storageKey: string
    /** Initial list-pane size as a percentage of the workspace width. */
    defaultRatio?: number
    /** When true, the detail pane shows the `#empty` slot instead of `#detail`. */
    detailEmpty?: boolean
    /** When true, the detail pane is removed entirely and the list pane fills the width (FR-021). */
    detailCollapsed?: boolean
  }>(),
  { defaultRatio: 40, detailEmpty: false, detailCollapsed: false },
)
</script>

<template>
  <UDashboardGroup
    storage="local"
    :storage-key="storageKey"
    data-test="dashboard-workspace"
    class="relative inset-auto flex h-[70vh] min-h-[24rem] w-full overflow-hidden rounded-lg border border-default"
  >
    <UDashboardPanel
      id="list"
      resizable
      :default-size="defaultRatio"
      :min-size="20"
      :max-size="80"
      data-test="dashboard-list-pane"
      :ui="{ root: detailCollapsed ? 'min-h-0 w-full lg:w-full' : 'min-h-0 w-(--width)' }"
    >
      <slot name="list" />

      <!-- Providing the slot (even rendering nothing while collapsed) suppresses the
           panel's default handle, so the divider disappears with the detail pane. -->
      <template #resize-handle="{ onMouseDown, onTouchStart, onDoubleClick }">
        <UDashboardResizeHandle
          v-if="!detailCollapsed"
          data-test="dashboard-resize-handle"
          :aria-controls="`${storageKey}-panel-list`"
          class="block w-1 bg-accented transition-colors hover:bg-primary"
          @mousedown="onMouseDown"
          @touchstart="onTouchStart"
          @dblclick="onDoubleClick"
        />
      </template>
    </UDashboardPanel>

    <UDashboardPanel v-if="!detailCollapsed" id="detail" data-test="dashboard-detail-pane" :ui="{ root: 'min-h-0' }">
      <!-- The detail content scrolls within the pane so the optional `#footer` (the
           Library waveform player, US6) stays pinned at the bottom and visible even
           when the editor is taller than the pane. Without this the panel root is a
           plain flex column with no overflow, so a tall editor pushes the footer past
           the group's `overflow-hidden` boundary and it is clipped out of view. -->
      <div class="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div v-if="detailEmpty" data-test="dashboard-detail-empty">
          <slot name="empty" />
        </div>
        <slot v-else name="detail" />
      </div>

      <div v-if="$slots.footer" class="shrink-0 p-3 pt-0">
        <slot name="footer" />
      </div>
    </UDashboardPanel>
  </UDashboardGroup>
</template>
