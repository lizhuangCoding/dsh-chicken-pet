/**
 * Prove the client bundle is safe inside a combined request.
 *
 * DSH serves every browser plugin in one batch as a single `/plugins/??…`
 * response, so the bundle is concatenated with the shell's own plugins and
 * executed as one script. A syntax error or a throw in any plugin therefore
 * fails registration for every plugin after it — the pet breaking the entire
 * interface rather than just itself. An earlier revision did exactly that by
 * emitting an ES module, and nothing in the normal build or unit tests noticed,
 * because the file is valid in isolation and only wrong in this context.
 *
 * The check concatenates the real bundle ahead of a few shipped plugins and
 * asserts that all of them register.
 */

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Locate a shipped plugin's client bundle next to the running `dsh`.
 * @param name - package name under the `@deepseek-ai` scope.
 * @returns the bundle path, or undefined when this machine has no such install.
 */
function shippedBundle(name) {
  const candidates = [
    join(root, 'node_modules', '@deepseek-ai', name, 'lib', 'client.js'),
    join(
      process.env.DSH_INSTALL_ROOT ?? '',
      'node_modules/@deepseek-ai',
      name,
      'lib/client.js',
    ),
  ]
  return candidates.find(existsSync)
}

test('the bundle does not break the plugins batched after it', () => {
  const mine = readFileSync(join(root, 'lib', 'client.js'), 'utf8')
  const others = ['dsh-client-locale', 'dsh-client-ui-theme']
    .map(name => ({ name, path: shippedBundle(name) }))
    .filter(entry => entry.path !== undefined)

  if (others.length === 0) {
    // Without a DSH install to borrow plugins from, fall back to a minimal
    // stand-in that registers the same way a shipped bundle does. The point of
    // the test is what happens after this file, not what the file contains.
    others.push({
      name: 'stand-in-follower',
      source: 'window.__ModuleLoader__.load({ id: "stand-in-follower", factory: () => ({}) });',
    })
  }

  const registrations = []
  const globalScope = { __ModuleLoader__: { load: registration => registrations.push(registration) } }
  globalScope.window = globalScope

  const combo = [mine, ...others.map(entry => entry.source ?? readFileSync(entry.path, 'utf8'))].join('\n;\n')

  // Any throw here is the whole-interface failure this test exists to prevent.
  new Function('window', combo)(globalScope)

  assert.equal(
    registrations.length,
    1 + others.length,
    `expected every plugin in the batch to register, got: ${registrations.map(r => r.id).join(', ') || '(none)'}`,
  )
  assert.equal(registrations[0].id, 'dsh-chicken-pet', 'the pet must register first, as it is first in the batch')
})
