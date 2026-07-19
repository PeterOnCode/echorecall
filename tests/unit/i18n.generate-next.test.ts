import { describe, it, expect } from 'vitest'
import en from '../../i18n/locales/en.json'
import hu from '../../i18n/locales/hu.json'

// 007 · Polish (T045 / FR-022, SC-007): a feature-scoped parity guard for the Generate
// redesign. The repo-wide i18n-parity test already asserts en ⇄ hu structural equality
// across the whole tree; this one narrows onto the namespaces THIS feature introduced —
// the `generateNext.*` editor/progress/cost strings, the per-field reset label, and the
// `settings.generationDefaults.*` section — so a dropped or one-sided 007 key fails here
// with a feature-specific message even if the rest of the tree stays balanced.

type Tree = { [key: string]: string | Tree }

/** Every dotted key path in a locale subtree (intermediate + leaf nodes), sorted. */
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

const enTree = en as unknown as Tree
const huTree = hu as unknown as Tree

/** Namespaces introduced by feature 007 (across its user stories). */
const NEW_NAMESPACES = [
  'generateNext.intro',
  'generateNext.script',
  'generateNext.settings.reset',
  'generateNext.actionBar',
  'generateNext.queue',
  'generateNext.upload',
  'generateNext.progress',
  'generateNext.progress.confirm',
  'generateNext.progress.summary',
  'generateNext.cost',
  'settings.generationDefaults',
] as const

function subtree(tree: Tree, path: string): Tree {
  return path.split('.').reduce<Tree>((node, key) => node[key] as Tree, tree)
}

describe('i18n parity — Generate redesign (007)', () => {
  it('has every 007 namespace in both locales', () => {
    for (const ns of NEW_NAMESPACES) {
      expect(hasPath(enTree, ns), `en missing namespace: ${ns}`).toBe(true)
      expect(hasPath(huTree, ns), `hu missing namespace: ${ns}`).toBe(true)
    }
  })

  it('generateNext.* keys are identical in en and hu', () => {
    expect(keyPaths(subtree(enTree, 'generateNext'))).toEqual(keyPaths(subtree(huTree, 'generateNext')))
  })

  it('settings.generationDefaults.* keys are identical in en and hu', () => {
    expect(keyPaths(subtree(enTree, 'settings.generationDefaults'))).toEqual(
      keyPaths(subtree(huTree, 'settings.generationDefaults')),
    )
  })

  it('every 007 string is a non-empty value in both locales', () => {
    for (const ns of ['generateNext.progress', 'generateNext.cost']) {
      for (const path of keyPaths(subtree(enTree, ns), ns)) {
        const enVal = subtreeValue(enTree, path)
        const huVal = subtreeValue(huTree, path)
        if (typeof enVal === 'string') {
          expect(enVal.length, `en empty: ${path}`).toBeGreaterThan(0)
          expect((huVal as string).length, `hu empty: ${path}`).toBeGreaterThan(0)
        }
      }
    }
  })
})

/** Resolve a dotted path to its value (string leaf or subtree). */
function subtreeValue(tree: Tree, path: string): string | Tree {
  return path.split('.').reduce<string | Tree>((node, key) => (node as Tree)[key]!, tree)
}
