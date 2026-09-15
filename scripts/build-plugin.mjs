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

/**
 * Rewrite relative `.ts` specifiers in emitted JavaScript to `.js`.
 *
 * Sources import each other with explicit `.ts` extensions, which is the
 * convention the DSH repository uses and what `allowImportingTsExtensions`
 * permits. TypeScript 5.6 keeps those specifiers in the output, so without this
 * pass the published module imports `./brain.ts`, which does not exist next to
 * the compiled file and fails at import time inside the user's profile.
 * @param file - absolute path of the emitted module.
 * @returns the number of specifiers rewritten.
 */
function rewriteSpecifiers(file) {
  const before = readFileSync(file, 'utf8')
  const after = before.replace(/(\bfrom\s+')(\.[^']*)\.ts(')/g, '$1$2.js$3')
  if (after === before) return 0
  writeFileSync(file, after)
  return 1
}

let rewritten = 0
for (const rel of ['lib/index.js', 'lib/host/index.js', 'lib/client/index.js', 'lib/client/brain.js', 'lib/client/sheet.js']) {
  const abs = join(root, rel)
  if (existsSync(abs)) rewritten += rewriteSpecifiers(abs)
}
if (rewritten > 0) process.stdout.write(`rewrote .ts specifiers in ${rewritten} emitted module(s)\n`)

// The package advertises `lib/index.js`, but tsc emits `lib/host/index.js`
// for a directory entry.
if (existsSync(join(root, 'lib', 'host', 'index.js'))) {
  writeFileSync(join(root, 'lib', 'index.js'), "export * from './host/index.js'\n")
}

// lib/client.js is NOT a re-export. DSH executes the browser bundle as a plain
// script, so it must be the bundled __ModuleLoader__ factory that
// scripts/bundle-client.mjs emits. A re-export here is an ES module, which is a
// SyntaxError in the browser and fails registration for every plugin in the
// batch DSH serves.
execFileSync(process.execPath, [join(here, 'bundle-client.mjs')], { stdio: 'inherit' })

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

// A published module that still names a `.ts` specifier imports a file that
// does not exist beside it and fails only once a user installs the plugin.
for (const rel of Object.keys(manifest)) {
  if (rel === 'lib/client.js') continue // bundled artifact: no relative imports
  const stray = readFileSync(join(root, rel), 'utf8').match(/from\s+'\.[^']*\.ts'/g)
  if (stray !== null) {
    console.error(`${rel}: emitted module still imports ${stray.join(', ')}`)
    process.exit(1)
  }
}
// Every relative import in the emitted tree must resolve to a file that shipped.
for (const rel of Object.keys(manifest)) {
  if (rel === 'lib/client.js') continue // bundled artifact: no relative imports
  const dir = dirname(join(root, rel))
  for (const spec of readFileSync(join(root, rel), 'utf8').matchAll(/from\s+'(\.[^']*)'/g)) {
    const target = join(dir, spec[1])
    if (!existsSync(target)) {
      console.error(`${rel}: import "${spec[1]}" does not resolve to an emitted file`)
      process.exit(1)
    }
  }
}

mkdirSync(join(root, 'lib'), { recursive: true })
writeFileSync(join(root, 'lib', 'build-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)

const summary = Object.entries(manifest)
  .map(([rel, size]) => `${rel} (${(size / 1024).toFixed(1)} KB)`)
  .join(', ')
process.stdout.write(`built: ${summary}\n`)
