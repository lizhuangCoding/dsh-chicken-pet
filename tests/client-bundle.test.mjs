/**
 * Verify the built client bundle registers with DSH's loader and exports a
 * usable plugin.
 *
 * This runs the artifact the way the browser does — as a plain script that
 * calls `window.__ModuleLoader__.load` — and then invokes the factory with a
 * `require` that behaves like the loader module table. It is the check that
 * would have caught the ES-module bundle earlier: a SyntaxError here is a
 * whole-interface failure in a real deployment, because DSH serves plugin
 * bundles as a single combined request.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** React stand-ins good enough for module evaluation; the pet never calls them. */
const stubModules = {
  react: { createElement: () => ({}), useState: () => [undefined, () => {}], useEffect: () => {} },
  'react/jsx-runtime': { jsx: () => ({}), jsxs: () => ({}), Fragment: {} },
}

/**
 * Execute the bundle against a stubbed loader and return the registration.
 * @returns the object the bundle passed to `__ModuleLoader__.load`.
 */
function loadBundle() {
  const registrations = []
  const globalScope = {
    __ModuleLoader__: { load: registration => registrations.push(registration) },
    document: undefined,
    window: undefined,
  }
  globalScope.window = globalScope

  const source = readFileSync(join(root, 'lib', 'client.js'), 'utf8')
  // The bundle is a plain script: `new Function` is how a script tag runs it.
  // `window` is resolved from the global scope the stub installs.
  const run = new Function('window', 'document', source)
  run(globalScope, undefined)

  assert.equal(registrations.length, 1, 'the bundle must register exactly one plugin')
  return registrations[0]
}

test('the client bundle is a script, not an ES module', () => {
  const source = readFileSync(join(root, 'lib', 'client.js'), 'utf8')
  assert.ok(
    !/^\s*(?:import|export)\s/m.test(source),
    'the bundle contains ES module syntax, which is a SyntaxError when the shell executes it as a script',
  )
  assert.ok(
    source.includes('window.__ModuleLoader__.load('),
    'the bundle must register itself on the loader table',
  )
})

test('the client bundle registers under the package name', () => {
  const registration = loadBundle()
  assert.equal(registration.id, 'dsh-chicken-pet')
  assert.equal(typeof registration.factory, 'function')
})

test('the factory resolves through the injected require, not globals', () => {
  const registration = loadBundle()
  const requested = []
  const exports = registration.factory((specifier) => {
    requested.push(specifier)
    if (specifier in stubModules) return stubModules[specifier]
    throw new Error(`bundle required "${specifier}", which the loader table cannot answer`)
  })
  assert.equal(typeof exports, 'object')
  assert.equal(exports.name, 'chicken-pet', 'the plugin name must survive bundling')
  assert.equal(typeof exports.apply, 'function', 'the plugin must export apply')
  // `inject` is an object with optional entries: the pet draws without any
  // service, and the settings card registers only when the settings page is
  // present, so every dependency is optional.
  assert.equal(typeof exports.inject, 'object', 'the plugin must export an inject declaration')
  assert.ok(Array.isArray(exports.inject.optional), 'optional services are declared in inject.optional')
  assert.ok(
    exports.inject.optional.includes('slots'),
    'the settings card needs the slot registry when it is available',
  )
  assert.equal(
    exports.Config,
    undefined,
    'the browser half must not export a schemastery schema: the shell cannot resolve schemastery, so requiring it fails the whole bundle batch',
  )
  assert.equal(typeof exports.defaultConfig, 'function', 'the plugin must export its fallback defaults')
})

test('the bundled plugin applies against a stub context without throwing', () => {
  const registration = loadBundle()
  const exports = registration.factory(specifier => {
    if (specifier in stubModules) return stubModules[specifier]
    throw new Error(`unexpected require: ${specifier}`)
  })

  const config = exports.defaultConfig()
  assert.equal(config.enabled, true)
  assert.ok(config.size > 0)

  // A host-less mount has no DOM, so `apply` must return before touching it.
  const listeners = new Map()
  const ctx = {
    get: () => undefined,
    on: (event, handler) => { listeners.set(event, handler); return () => listeners.delete(event) },
    effect: fn => fn(),
  }
  exports.apply(ctx, config)
  assert.equal(listeners.size, 0, 'no listeners are registered without a document to draw into')
})
