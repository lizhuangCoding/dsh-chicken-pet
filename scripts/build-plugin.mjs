/**
 * Build the shipped `lib/` artifacts with the real TypeScript compiler.
 *
 * A DSH bundle package is imported by the profile launcher under plain Node, so
 * the published files must be JavaScript with `.js` specifiers on relative
 * imports and no type-only syntax left behind. Compiling with `tsc` is the only
 * correct way to guarantee that: a hand-written stripper silently mis-handles
 * return type annotations, `as` casts, and parameter properties, and the
 * resulting module fails at import time inside the user's profile.
 *
 * Typechecking and emit are separate on purpose. `tsconfig.json` maps the
 * harness packages at the local checkout so the plugin is checked against the
 * real API, which is what `npm run typecheck` uses. This script compiles for
 * publication, where those imports are external and not installed, so the emit
 * pass runs with `--noCheck`.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync, writeFileSync, mkdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const tsc = join(root, 'node_modules', '.bin', 'tsc')

if (!existsSync(tsc)) {
  console.error('TypeScript is required to build. Run: npm install')
  process.exit(1)
}

rmSync(join(root, 'lib'), { recursive: true, force: true })

/**
 * Run one tsc invocation.
 * @param args - compiler arguments.
 * @returns nothing; a non-zero exit aborts the build.
 */
function runTsc(args) {
  try {
    execFileSync(tsc, args, { cwd: root, stdio: 'inherit' })
  } catch {
    console.error('\ntsc failed; the package was not built.')
    process.exit(1)
  }
}

/** Shared flags for both compilation passes. */
const COMMON = [
  '--target', 'ES2022',
  '--module', 'ESNext',
  '--moduleResolution', 'bundler',
  '--lib', 'ES2022,DOM,DOM.Iterable',
  '--strict', 'true',
  '--skipLibCheck', 'true',
  '--verbatimModuleSyntax', 'true',
  '--rootDir', 'src',
]

const ENTRIES = [
  'src/index.ts',
  'src/host/index.ts',
  'src/client/index.ts',
  'src/client/brain.ts',
  'src/client/sheet.ts',
]

// Runtime JavaScript. `--noCheck` skips resolving the harness packages, which
// are external at publish time; `npm run typecheck` is what proves correctness.
runTsc([
  ...COMMON,
  '--noCheck',
  '--declaration', 'false',
  '--sourceMap', 'false',
  '--outDir', 'lib',
  ...ENTRIES,
])

// The package advertises `lib/client.js` and `lib/index.js`, but tsc emits
// `lib/client/index.js` and `lib/host/index.js` for directory entries.
if (existsSync(join(root, 'lib', 'client', 'index.js'))) {
  writeFileSync(join(root, 'lib', 'client.js'), "export * from './client/index.js'\n")
}
if (existsSync(join(root, 'lib', 'host', 'index.js'))) {
  writeFileSync(join(root, 'lib', 'index.js'), "export * from './host/index.js'\n")
}

// Declaration pass, emitted separately so the runtime pass needs no d.ts work.
runTsc([
  ...COMMON,
  '--noCheck',
  '--declaration', 'true',
  '--emitDeclarationOnly', 'true',
  '--outDir', 'lib/types',
  ...ENTRIES,
])
if (existsSync(join(root, 'lib', 'types', 'client', 'index.d.ts'))) {
  writeFileSync(
    join(root, 'lib', 'types', 'client.d.ts'),
    readFileSync(join(root, 'lib', 'types', 'client', 'index.d.ts')),
  )
}

const manifest = {}
for (const rel of [
  'lib/index.js',
  'lib/client.js',
  'lib/host/index.js',
  'lib/client/index.js',
  'lib/client/brain.js',
  'lib/client/sheet.js',
]) {
  const abs = join(root, rel)
  if (existsSync(abs)) manifest[rel] = statSync(abs).size
}
mkdirSync(join(root, 'lib'), { recursive: true })
writeFileSync(join(root, 'lib', 'build-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)

const summary = Object.entries(manifest)
  .map(([rel, size]) => `${rel} (${(size / 1024).toFixed(1)} KB)`)
  .join(', ')
process.stdout.write(`built: ${summary}\n`)
