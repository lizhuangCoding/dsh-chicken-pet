/**
 * Guard the plugin's activation declarations.
 *
 * A Cordis row activates only when every name in `inject` is available. When
 * one never appears the entry stays `pending` forever and the boot audit
 * reports it as "did not activate", which fails Web startup — the pet does not
 * merely fail to draw, the whole interface refuses to load.
 *
 * This was shipped once. `inject` was written as `{ optional: [...] }`, which
 * Cordis reads as a MAP of service name to intercept config: the plugin asked
 * for a service literally named `optional` and waited for it forever. Every
 * unit test still passed, because the bundle loaded and exported a valid
 * plugin; only a real boot failed.
 *
 * So the checks here are about what the plugin will do at load time, not about
 * what its module exports.
 */

import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Read the client entry's source.
 * @returns the module text.
 */
function clientSource() {
  return readFileSync(join(root, 'src', 'client', 'index.ts'), 'utf8')
}

test('the client half declares no required service', () => {
  const source = clientSource()
  const match = /export const inject = ([^\n]+)/.exec(source)
  assert.ok(match !== null, 'the client half must declare its inject list explicitly')

  const declaration = match[1].trim()
  assert.equal(
    declaration,
    '[]',
    'the pet draws without any service, so a required dependency would only risk leaving the '
    + `row pending forever and failing Web startup. Found: ${declaration}`,
  )
})

test('no module declares inject as an object', () => {
  // `{ optional: [...] }` is the specific mistake; any object form is suspect
  // because Cordis reads it as service names, not as modifiers.
  const clientDir = join(root, 'src', 'client')
  for (const entry of readdirSync(clientDir)) {
    if (!entry.endsWith('.ts')) continue
    const source = readFileSync(join(clientDir, entry), 'utf8')
    const match = /export const inject = (\{[^\n]*\})/.exec(source)
    assert.equal(
      match,
      null,
      `${entry} declares inject as an object (${match?.[1]}). Cordis reads that as a service `
      + 'name to intercept config, so the plugin waits for a service that does not exist.',
    )
  }
})

test('optional services are requested at runtime instead', () => {
  const source = clientSource()
  assert.ok(
    /ctx\.inject\(\[[^\]]*'slots'/.test(source),
    'the settings card must reach for the slot registry through ctx.inject, which waits for the '
    + 'service without holding up the pet itself',
  )
  assert.ok(
    /ctx\.inject\(\[[^\]]*'settingsScope'/.test(source),
    'the settings card must reach for the settings scope through ctx.inject',
  )
})

test('the host half requires only the web server', () => {
  const source = readFileSync(join(root, 'src', 'host', 'index.ts'), 'utf8')
  const match = /export const inject = (\[[^\]]*\])/.exec(source)
  assert.ok(match !== null, 'the host half must declare its inject list')
  const names = match[1].slice(1, -1).split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean)
  assert.deepEqual(
    names,
    ['webServer'],
    'the host half serves the sprite route and needs nothing else; an extra required service '
    + 'would leave the row pending on a deployment that does not mount it',
  )
})

test('the settings namespace is optional on the host too', () => {
  const source = readFileSync(join(root, 'src', 'host', 'index.ts'), 'utf8')
  // The namespace is installed through `ctx.inject(['settings'], ...)` so a
  // deployment with no settings provider still starts and serves the sprite.
  assert.ok(
    /ctx\.inject\(\['settings'\]/.test(source),
    'the settings namespace must be installed through ctx.inject, not declared as a requirement',
  )
  const declaration = /export const inject = (\[[^\]]*\])/.exec(source)?.[1] ?? ''
  assert.ok(
    !declaration.includes('settings'),
    'declaring `settings` as required would leave the pet pending where no settings provider is mounted',
  )
})

test('the card registers through slots.inject, not by calling register eagerly', () => {
  const source = readFileSync(join(root, 'src', 'client', 'card.ts'), 'utf8')
  assert.ok(
    /slots\.inject\('settings\.plugin\.item'/.test(source),
    'the card must register through slots.inject so it runs for each lifetime of the slot\'s '
    + 'declaring owner. Registering eagerly loses the race when this plugin activates before the '
    + 'settings page, and the card is then dropped with no error.',
  )
  assert.ok(
    !/ctx\.effect\(\(\) => slots\.register\(/.test(source),
    'a direct slots.register call at activation time is the eager form this guard exists to prevent',
  )
})

test('the client declares no inject hint that pins a package name', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  const inject = pkg.dsh.client.inject
  assert.equal(
    inject,
    undefined,
    'dsh.client.inject names package rows that must materialize first. A wrong or unnecessary '
    + 'name silently keeps the browser half from loading, which is how the settings card went '
    + 'missing while the host half kept working.',
  )
})
