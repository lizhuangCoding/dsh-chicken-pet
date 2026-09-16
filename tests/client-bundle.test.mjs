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
  // `inject` must be an EMPTY array. Cordis gates activation on every declared
  // name, and an entry whose service never appears stays pending forever and
  // fails Web startup. The pet draws without any service, so it declares none
  // and reaches for the optional ones through `ctx.inject` at runtime. An
  // object here (`{ optional: [...] }`) is read as a service NAME, not a
  // modifier, which is the mistake that broke a real boot.
  assert.ok(Array.isArray(exports.inject), 'inject must be an array of required service names')
  assert.deepEqual(
    exports.inject,
    [],
    'the pet requires no service; a required dependency only risks leaving the row pending',
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
  const injected = []
  const ctx = {
    get: () => undefined,
    on: (event, handler) => { listeners.set(event, handler); return () => listeners.delete(event) },
    effect: fn => fn(),
    // The optional dependencies are requested this way; a stub that omitted it
    // would hide a crash on startup.
    inject: (deps, callback) => { injected.push([deps, callback]) },
  }
  exports.apply(ctx, config)
  assert.equal(injected.length, 1, 'the settings card registers through ctx.inject')
  assert.deepEqual(injected[0][0], ['slots', 'settingsScope'])
  assert.equal(listeners.size, 0, 'no listeners are registered without a document to draw into')
})
