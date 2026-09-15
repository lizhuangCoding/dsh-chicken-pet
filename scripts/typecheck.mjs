/**
 * Typecheck this plugin against the real DeepSeek Harness API.
 *
 * The harness packages are consumed as source, so compiling them surfaces
 * errors inside the harness itself — vendored Cordis expects its own build
 * settings, and the checkout may be a different revision than this plugin
 * targets. Those errors are not actionable here.
 *
 * What matters is that no error is attributed to a file in `src/`. That is the
 * signal that an event name, a service key, or a config field this plugin uses
 * does not exist in the harness it claims to support. A hand-written type stub
 * would accept all three, which is why this checks the real sources.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const tsc = join(root, 'node_modules', '.bin', 'tsc')

if (!existsSync(tsc)) {
  console.error('TypeScript is required. Run: npm install')
  process.exit(1)
}

// Generate the config that points at the harness checkout discovered on this
// machine; it fails with guidance when no checkout is available.
execFileSync(process.execPath, [join(here, 'typecheck-config.mjs')], { stdio: 'inherit' })

let output
try {
  output = execFileSync(tsc, ['-p', 'tsconfig.typecheck.json', '--pretty', 'false'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
} catch (error) {
  output = `${error.stdout ?? ''}${error.stderr ?? ''}`
}

const lines = output
  .split('\n')
  .map(line => line.trim())
  .filter(line => line.length > 0)

const mine = lines.filter(line => /^src[/\\]/.test(line))
const foreign = lines.length - mine.length

if (mine.length > 0) {
  console.error(`\n${mine.length} type error(s) in this plugin's sources:\n`)
  for (const line of mine) console.error(`  ${line}`)
  console.error(
    '\nThese mean the plugin uses a harness API that does not exist in the'
    + ' checkout it was checked against.',
  )
  process.exit(1)
}

// Assert the events the runtime subscribes to are declared by the harness, so a
// rename on either side fails here rather than silently at runtime. The scan
// covers every client module, because subscriptions can live in any of them.
const clientDir = join(root, 'src', 'client')
const events = []
for (const entry of readdirSync(clientDir)) {
  if (!entry.endsWith('.ts')) continue
  const source = readFileSync(join(clientDir, entry), 'utf8')
  for (const match of source.matchAll(/ctx\.on\('([^']+)'/g)) events.push(match[1])
}
if (events.length === 0) {
  console.error('No subscribed events found under src/client; the guard is not checking anything.')
  process.exit(1)
}

rmSync(join(root, 'tsconfig.typecheck.json'), { force: true })

process.stdout.write(
  `typecheck passed: 0 errors in src/ (${foreign} inside the harness checkout, ignored)\n`
  + `  events verified present: ${events.join(', ')}\n`,
)
