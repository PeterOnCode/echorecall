<script setup lang="ts">
// Shared resizable two-pane workspace for the Generate and Library surfaces
// (FR-001). Built on @nuxt/ui's dashboard primitives: `UDashboardGroup` owns the
// split-size persistence (keyed by `storageKey`, stored locally — FR-002), the
// left `UDashboardPanel` is resizable (the list), and the right panel (the detail)
// flexes to fill. When nothing is selected the caller sets `detailEmpty` and the
// `#empty` slot is shown instead of `#detail` (FR-003). The optional `#footer`
// slot hosts the Library waveform player (US6).
withDefaults(
  defineProps<{
    /** Stable key under which the split size is persisted across sessions. */
    storageKey: string
    /** Initial list-pane size as a percentage of the workspace width. */
    defaultRatio?: number
    /** When true, the detail pane shows the `#empty` slot instead of `#detail`. */
    detailEmpty?: boolean
  }>(),
  { defaultRatio: 40, detailEmpty: false },
)
</script>

<template>
  <UDashboardGroup
    storage="local"
    :storage-key="storageKey"
    data-test="dashboard-workspace"
    class="flex min-h-[60vh] w-full"
  >
    <UDashboardPanel
      id="list"
      resizable
      :default-size="defaultRatio"
      :min-size="20"
      :max-size="80"
      data-test="dashboard-list-pane"
    >
      <slot name="list" />

      <template #resize-handle="{ onMouseDown, onTouchStart, onDoubleClick }">
        <UDashboardResizeHandle
          data-test="dashboard-resize-handle"
          :aria-controls="`${storageKey}-panel-list`"
          @mousedown="onMouseDown"
          @touchstart="onTouchStart"
          @dblclick="onDoubleClick"
        />
      </template>
    </UDashboardPanel>

    <UDashboardPanel id="detail" data-test="dashboard-detail-pane">
      <div v-if="detailEmpty" data-test="dashboard-detail-empty">
        <slot name="empty" />
      </div>
      <slot v-else name="detail" />

      <slot name="footer" />
    </UDashboardPanel>
  </UDashboardGroup>
</template>
