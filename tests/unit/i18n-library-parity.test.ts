import { describe, it, expect } from 'vitest'
import en from '../../i18n/locales/en.json'
import hu from '../../i18n/locales/hu.json'

// 006 · SC-008 / FR-025 — a FOCUSED guard for the redesigned Library surface. The
// general i18n-parity test asserts whole-tree en⇄hu structural parity; this one locks
// the specific `library.*` namespaces this feature introduces/extends so a 006 control
// can never ship with a label missing from one locale (or dropped from both). Every new
// `t('library.*')` key the redesign added MUST resolve in en AND hu.

type Tree = { [key: string]: string | Tree }

/** Every dotted key path under a tree (intermediate + leaf nodes), sorted. */
function keyPaths(tree: Tree, prefix = ''): string[] {
  const paths: string[] = []
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key
    paths.push(path)
    if (value && typeof value === 'object') paths.push(...keyPaths(value, path))
  }
  return paths.sort()
}

/** True when `path` (dotted) resolves to a defined node in `tree`. */
function hasPath(tree: Tree, path: string): boolean {
  let node: string | Tree | undefined = tree
  for (const key of path.split('.')) {
    if (node && typeof node === 'object' && key in node) node = node[key]
    else return false
  }
  return node !== undefined
}

const enLibrary = (en as unknown as { library: Tree }).library
const huLibrary = (hu as unknown as { library: Tree }).library

// Namespaces the 006 redesign owns (filter bar, file-table columns + dialogs, bulk ops,
// the tag-editor inspector + its fields dialog, the waveform footer, and the status bar).
const LIBRARY_006_NAMESPACES = [
  'filters',
  'columns',
  'columnsDialog',
  'bulkActions',
  'bulkTagEdit',
  'inspector',
  'inspectorFields',
  'waveform',
  'status',
  'toggleInspector',
  'selectAll',
  'selectRow',
] as const

// The US6 status-bar leaf keys (codec/encoding values are data, not translated — T054).
const STATUS_KEYS = ['saved', 'unsaved', 'files', 'selection', 'noSelection'] as const

describe('i18n library parity (en ⇄ hu)', () => {
  it('library subtree has identical key structure in both locales', () => {
    expect(keyPaths(enLibrary)).toEqual(keyPaths(huLibrary))
  })

  it('declares every 006 library namespace in both locales', () => {
    for (const ns of LIBRARY_006_NAMESPACES) {
      expect(hasPath(enLibrary, ns), `en missing library.${ns}`).toBe(true)
      expect(hasPath(huLibrary, ns), `hu missing library.${ns}`).toBe(true)
    }
  })

  it('declares every US6 status-bar key in both locales', () => {
    for (const key of STATUS_KEYS) {
      expect(hasPath(enLibrary, `status.${key}`), `en missing library.status.${key}`).toBe(true)
      expect(hasPath(huLibrary, `status.${key}`), `hu missing library.status.${key}`).toBe(true)
    }
  })
})
