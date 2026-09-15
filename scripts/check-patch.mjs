/**
 * Guard the bundle patch against the mistake that shipped a plugin whose host
 * half never loaded.
 *
 * The patch row must name the BARE package so the host half loads as an
 * ordinary Cordis plugin. The browser half is discovered separately through
 * `dsh.client` in package.json. Naming a subpath such as `<pkg>/client` in the
 * row loads browser code into the host process instead: the sprite route never
 * registers, every asset request 404s, and nothing in the build or the unit
 * tests notices, because both halves are individually valid modules.
 *
 * The check also asserts the row's config keys against the host half's own
 * schema, since a client-half option placed on this row is silently ignored.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const patch = readFileSync(join(root, pkg.dsh.bundle.patch), 'utf8')

const failures = []

// Strip comments so an explanatory line cannot satisfy or break the parse.
const body = patch
  .split('\n')
  .filter(line => !line.trimStart().startsWith('#'))
  .join('\n')

const rowIds = [...body.matchAll(/^\s*-\s*id:\s*(\S+)\s*$/gm)].map(m => m[1])
if (rowIds.length === 0) failures.push('the patch inserts no rows')

const names = [...body.matchAll(/^\s*name:\s*'?([^'\s]+)'?\s*$/gm)].map(m => m[1])
if (names.length === 0) failures.push('the patch declares no plugin name')

for (const name of names) {
  const expected = pkg.name
  if (name !== expected) {
    failures.push(
      `plugin name is "${name}" but must be the bare package name "${expected}".\n`
      + '    A subpath such as "<pkg>/client" loads the browser half into the host\n'
      + '    process, so the sprite route never registers; the browser half is\n'
      + '    discovered through the dsh.client declaration instead.',
    )
  }
}

if (pkg.dsh.client?.platform !== 'web') {
  failures.push('dsh.client.platform must be "web" for the Web app to load the browser half')
}
if (pkg.dsh.client?.platform === 'web' && pkg.exports?.['./client'] === undefined) {
  failures.push('dsh.client is declared but package.json exports no "./client" entry')
}

// Config keys on the row go to the HOST half only. Reject a key the host
// schema does not declare, which is how a client-only option would be lost.
const declared = new Set(
  [...readFileSync(join(root, 'src/host/index.ts'), 'utf8').matchAll(/^\s{2}(\w+):\s*z\./gm)]
    .map(m => m[1]),
)
const configBlock = body.slice(body.indexOf('config:'))
for (const [, key] of configBlock.matchAll(/^\s{8}(\w+):/gm)) {
  if (!declared.has(key)) {
    failures.push(
      `the row sets config.${key}, which the host half does not declare.\n`
      + `    Host config keys are: ${[...declared].join(', ')}\n`
      + '    Client-half options belong in a settings surface, not this row.',
    )
  }
}

if (failures.length > 0) {
  console.error('bundle patch check failed:\n')
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}

process.stdout.write(
  `bundle patch ok: row "${rowIds[0]}" -> "${names[0]}", host config keys validated\n`,
)
