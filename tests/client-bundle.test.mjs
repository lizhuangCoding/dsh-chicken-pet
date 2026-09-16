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
  react: {
    createElement: (type, props, ...children) => ({ type, props, children }),
    // A real useState calls a function initializer; returning undefined here
    // would hide a card that dereferences its snapshot on first render.
    useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}],
    useEffect: () => {},
    useRef: value => ({ current: value }),
  },
  'react/jsx-runtime': { jsx: () => ({}), jsxs: () => ({}), Fragment: {} },
  // The card draws its controls with the shell's own atoms, so the stub has to
  // provide them or every control counts as missing.
  '@deepseek-ai/dsh-client-ui-primitives': {
    Switch: function Switch(props) { return { type: 'Switch', props, children: [] } },
    Button: function Button(props) { return { type: 'Button', props, children: [] } },
    IconChevronDownOutline14: function IconChevronDownOutline14(props) {
      return { type: 'IconChevronDown', props, children: [] }
    },
  },
}

/**
 * Execute the bundle against a stubbed loader and return the registration.
 * @returns the object the bundle passed to `__ModuleLoader__.load`.
 */
/**
 * Build the plugin exports once, for tests that render the card directly.
 * @param registration - the loader registration.
 * @returns the plugin's exported members.
 */
function exportsOf(registration) {
  return registration.factory(specifier => {
    if (specifier in stubModules) return stubModules[specifier]
    throw new Error(`bundle required "${specifier}", which the loader table cannot answer`)
  })
}

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
  assert.deepEqual(
    injected[0][0],
    ['settingsScope'],
    'only the settings scope is awaited; the slot registry is read from the injected context',
  )
  assert.equal(listeners.size, 0, 'no listeners are registered without a document to draw into')
})

test('the card renders with the props the renderer actually passes', () => {
  // The renderer spreads the inject face onto props: the face's `hooks`
  // compartment becomes `use<Name>` hooks and every other member is copied to
  // the top level. Reading `props.inject` yields undefined and crashes the card
  // inside the slot, which the page reports as "slot entry crashed" — the pet
  // still draws, so nothing else looks wrong.
  const registration = loadBundle()
  let captured
  const scope = {
    getSnapshot: () => ({
      status: 'ready',
      value: { enabled: true, liveliness: 0.75, idleMinSec: 4, idleMaxSec: 12, size: 128, corner: 'bottom-right', sound: true, volume: 0.85 },
      base: {},
      user: {},
      revision: 1,
      writable: true,
    }),
    subscribe: () => () => {},
    set: async () => {},
    unset: async () => {},
  }
  const slots = {
    register: (options, component) => { captured = { options, component }; return () => {} },
    inject: (_key, callback) => { callback(); return () => {} },
  }
  const ctx = {
    get: name => (name === 'slots' ? slots : name === 'settingsScope' ? { bind: () => scope } : undefined),
    on: () => () => {},
    effect: fn => fn(),
    inject: (_deps, callback) => callback({
      get: ctx.get, on: ctx.on, effect: ctx.effect, slots,
      settingsScope: { bind: () => scope },
    }),
  }
  registration.factory(specifier => {
    if (specifier in stubModules) return stubModules[specifier]
    throw new Error(`unexpected require: ${specifier}`)
  }).apply(ctx, { enabled: true })

  assert.ok(captured !== undefined, 'the card must register into settings.plugin.item')

  // Exactly the renderer's shape: face members at the top level.
  const props = { ...captured.options.inject() }
  const tree = captured.component(props)
  assert.ok(tree !== null && typeof tree === 'object', 'the card must render an element')
  assert.ok(
    JSON.stringify(tree).includes('小鸡桌宠'),
    'the rendered card must carry its title; an empty or crashed tree means the props contract drifted',
  )
})

test('the card is collapsed until opened, and discloses every control', () => {
  const registration = loadBundle()
  const face = {
    getSnapshot: () => ({
      status: 'ready',
      value: { enabled: true, liveliness: 0.75, idleMinSec: 4, idleMaxSec: 12, size: 128, corner: 'bottom-right', sound: true, volume: 0.85 },
      base: {}, user: {}, revision: 1, writable: true,
    }),
    subscribe: () => () => {},
    set: async () => {},
    reset: async () => {},
  }

  /** Collect every node, following createElement's variadic children. */
  const collect = (node, out = []) => {
    if (node === null || typeof node !== 'object') return out
    out.push(node)
    if (Array.isArray(node.children)) for (const child of node.children) collect(child, out)
    return out
  }
  const count = (nodes, name) => nodes.filter(n => n.type === name || n.type?.name === name).length

  // Collapsed by default: the header renders, the controls do not.
  const collapsed = collect(exportsOf(registration).ChickenPetCard(face))
  assert.equal(count(collapsed, 'Switch'), 0, 'a collapsed card must not render its controls')
  assert.ok(
    JSON.stringify(collapsed).includes('小鸡桌宠'),
    'the header must name the plugin even while collapsed',
  )

  // Opened: every control the groups declare is present.
  const open = collect(exportsOf(registration).ChickenPetCard({ ...face, __open: true }))
  assert.equal(count(open, 'Switch'), 2, 'two toggles')
  assert.equal(open.filter(n => n.props?.type === 'range').length, 2, 'two sliders')
  assert.equal(open.filter(n => n.props?.type === 'number').length, 3, 'three number inputs')
  // Reset, discard, and save. Reset is one card-level action rather than a
  // button per field, which is what the labels would otherwise compete with.
  assert.equal(count(open, 'Button'), 3, 'reset, discard, and save')
  for (const group of ['显示', '活跃度', '声音']) {
    assert.ok(JSON.stringify(open).includes(group), `the ${group} group must render`)
  }
})

test('the card uses the shell icon rather than a drawn svg', () => {
  const registration = loadBundle()
  const face = {
    getSnapshot: () => ({
      status: 'ready',
      value: { enabled: true, liveliness: 0.75, idleMinSec: 4, idleMaxSec: 12, size: 128, corner: 'bottom-right', sound: true, volume: 0.85 },
      base: {}, user: {}, revision: 1, writable: true,
    }),
    subscribe: () => () => {}, set: async () => {}, reset: async () => {},
  }
  const exports = exportsOf(registration)
  const tree = exports.ChickenPetCard(face)

  const collect = (node, out = []) => {
    if (node === null || typeof node !== 'object') return out
    out.push(node)
    if (Array.isArray(node.children)) for (const child of node.children) collect(child, out)
    return out
  }
  const nodes = collect(tree)

  // The header renders a local `Chevron` wrapper, so the element tree stops at
  // that component; render it to see what it actually produces.
  const chevrons = nodes.filter(n => typeof n.type === 'function' && n.type.name === 'Chevron')
  assert.equal(chevrons.length, 1, 'the header must render the disclosure control')
  const rendered = collect(chevrons[0].type(chevrons[0].props ?? {}))

  assert.equal(
    rendered.filter(n => n.type?.name === 'IconChevronDownOutline14').length,
    1,
    'the disclosure control must use the shell chevron icon',
  )
  // A hand-written `<svg>` has no width/height attributes, so flex stretches it
  // to fill the header — the card renders as one giant arrow.
  assert.equal(
    rendered.filter(n => n.type === 'svg').length,
    0,
    'the card must not draw its own svg; the shell icon carries its own size',
  )
})

test('the card geometry matches the shipped card', () => {
  // The card sits in a list of shipped cards, so a few pixels of extra padding
  // or a larger radius makes it read as a different component. These values are
  // copied from the section's own stylesheet; changing one here without changing
  // the original is what this asserts against.
  const source = readFileSync(join(root, 'src', 'client', 'card-styles.ts'), 'utf8')
  const rule = selector => {
    const at = source.indexOf(selector)
    assert.notEqual(at, -1, `${selector} must exist`)
    return source.slice(at, source.indexOf('}', at))
  }
  const expect = (block, declaration) => {
    assert.ok(block.includes(declaration), `expected ${declaration} in:\n${block}`)
  }

  const card = rule('.cdpc {')
  expect(card, 'border: 0.5px solid var(--dsw-alias-border-l4)')
  expect(card, 'border-radius: 16px')
  expect(card, 'background: var(--dsw-alias-bg-layer-3)')

  const head = rule('.cdpc-head {')
  expect(head, 'gap: 12px')
  expect(head, 'padding: 14px 16px')

  const headtext = rule('.cdpc-headtext {')
  expect(headtext, 'flex: 1')
  expect(headtext, 'min-width: 0')
  expect(headtext, 'flex-direction: column')
  expect(headtext, 'gap: 4px')

  const name = rule('.cdpc-name {')
  expect(name, 'font-size: 15px')
  expect(name, 'font-weight: 600')
  expect(name, 'line-height: 1.4')

  const desc = rule('.cdpc-desc {')
  expect(desc, 'font-size: 13px')
  expect(desc, 'line-height: 1.5')
  expect(desc, 'color: var(--dsw-alias-label-tertiary)')

  const chevron = rule('.cdpc-chevron {')
  expect(chevron, 'flex: none')
})

test('the card has one reset for the whole panel, not one per field', () => {
  const source = readFileSync(join(root, 'src', 'client', 'card-styles.ts'), 'utf8')
  assert.ok(
    !source.includes('.cdpc-reset'),
    'a per-field reset style means the per-field buttons came back; defaults are restored '
    + 'for the whole card from its footer',
  )
  const card = readFileSync(join(root, 'src', 'client', 'card.ts'), 'utf8')
  assert.equal(
    (card.match(/恢复默认/g) ?? []).length,
    1,
    'exactly one restore control belongs on the card',
  )
})
