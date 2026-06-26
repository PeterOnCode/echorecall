import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import DashboardWorkspace from '~/components/dashboard/DashboardWorkspace.vue'

// Foundational shared shell for the 005 redesign (FR-001/002/003): a resizable
// two-pane workspace (list | detail) reused by Generate and Library. Real
// drag-resize and cross-session persistence need layout + pointer events that
// happy-dom can't provide, so here we assert the WIRING — both panes render their
// slots, the resize handle is present and keyed to `storageKey` (so @nuxt/ui's
// dashboard storage persists the split, FR-002), and the empty state shows when
// nothing is selected (FR-003). End-to-end persistence is covered in quickstart.md.

describe('DashboardWorkspace', () => {
  it('renders the list and detail slots in a two-pane shell with a resize handle', async () => {
    const wrapper = await mountSuspended(DashboardWorkspace, {
      props: { storageKey: 'test-ws' },
      slots: { list: () => 'LIST CONTENT', detail: () => 'DETAIL CONTENT' },
    })

    expect(wrapper.find('[data-test="dashboard-workspace"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="dashboard-list-pane"]').text()).toContain('LIST CONTENT')
    expect(wrapper.find('[data-test="dashboard-detail-pane"]').text()).toContain('DETAIL CONTENT')

    const handle = wrapper.find('[data-test="dashboard-resize-handle"]')
    expect(handle.exists()).toBe(true)
    // The split is keyed to storageKey so @nuxt/ui's dashboard storage persists it (FR-002).
    expect(handle.attributes('aria-controls')).toContain('test-ws')
  })

  it('sits in normal page flow, not as a fixed full-viewport overlay', async () => {
    // Regression: @nuxt/ui's dashboard primitives are a full-screen app shell
    // (`fixed inset-0` group, `min-h-svh` panels, `hidden` handle below lg). Embedded
    // as a page section those must be overridden so the workspace occupies its slot
    // instead of covering the header/toolbar/page (and the divider stays usable).
    const wrapper = await mountSuspended(DashboardWorkspace, {
      props: { storageKey: 'test-ws' },
      slots: { list: () => 'LIST', detail: () => 'DETAIL' },
    })

    const group = wrapper.find('[data-test="dashboard-workspace"]').classes()
    expect(group).not.toContain('fixed')
    expect(group).not.toContain('inset-0')
    expect(group).toContain('relative')

    // The list pane must not force full viewport height.
    expect(wrapper.find('[data-test="dashboard-list-pane"]').classes()).not.toContain('min-h-svh')

    // The divider must be visible (not display:none) at all breakpoints.
    expect(wrapper.find('[data-test="dashboard-resize-handle"]').classes()).not.toContain('hidden')
  })

  it('exposes the resize divider as a separator wired to the list pane (FR-020)', async () => {
    // Keyboard/AT operability for the divider (FR-020): @nuxt/ui's resize handle
    // carries role="separator" and points at the pane it resizes via aria-controls,
    // so assistive tech announces it as an adjustable boundary rather than a bare div.
    const wrapper = await mountSuspended(DashboardWorkspace, {
      props: { storageKey: 'a11y-ws' },
      slots: { list: () => 'LIST', detail: () => 'DETAIL' },
    })

    const handle = wrapper.find('[data-test="dashboard-resize-handle"]')
    expect(handle.attributes('role')).toBe('separator')
    expect(handle.attributes('aria-controls')).toContain('a11y-ws')
  })

  it('collapses the detail pane and gives the list pane full width when detailCollapsed (FR-021)', async () => {
    // The Library show/hide-inspector control sets detailCollapsed: the detail pane and
    // resize handle are removed and the list pane fills the width. The panel theme's size
    // variant carries `lg:w-(--width)`, so the list pane MUST override `lg:w-full` (a plain
    // `w-full` loses to the `lg:`-prefixed rule at the breakpoint this surface renders at).
    const wrapper = await mountSuspended(DashboardWorkspace, {
      props: { storageKey: 'test-ws', detailCollapsed: true },
      slots: { list: () => 'LIST CONTENT', detail: () => 'SHOULD NOT SHOW' },
    })

    expect(wrapper.find('[data-test="dashboard-list-pane"]').text()).toContain('LIST CONTENT')
    expect(wrapper.find('[data-test="dashboard-detail-pane"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="dashboard-resize-handle"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('SHOULD NOT SHOW')

    const listClasses = wrapper.find('[data-test="dashboard-list-pane"]').classes()
    expect(listClasses).toContain('lg:w-full')
    expect(listClasses).not.toContain('lg:w-(--width)')
  })

  it('shows the empty state in the detail pane when detailEmpty is set', async () => {
    const wrapper = await mountSuspended(DashboardWorkspace, {
      props: { storageKey: 'test-ws', detailEmpty: true },
      slots: {
        list: () => 'LIST',
        detail: () => 'SHOULD NOT SHOW',
        empty: () => 'NOTHING SELECTED',
      },
    })

    expect(wrapper.find('[data-test="dashboard-detail-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="dashboard-detail-pane"]').text()).toContain('NOTHING SELECTED')
    expect(wrapper.text()).not.toContain('SHOULD NOT SHOW')
  })
})
