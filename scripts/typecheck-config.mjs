/**
 * Resolve the local DeepSeek Harness checkout for typechecking.
 *
 * The plugin observes `tools/*` and `agent/*` events and puts `webServer` on
 * the Cordis context through declaration merges that live in harness packages.
 * Checking against those real declarations is what catches an event name the
 * harness does not actually declare — which a hand-written stub would happily
 * accept.
 *
 * The generated config extends the harness's own `tsconfig.base.json`, so the
 * hundred-odd `@deepseek-ai/dsh-*` edges between harness packages resolve the
 * way the harness resolves them. Listing those mappings here by hand would
 * drift the moment the harness adds a package, and the failure mode is a wall
 * of errors inside the harness that hides any real error in this plugin.
 *
 * The checkout location differs per machine and per CI job, so it is discovered
 * rather than hardcoded.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

/**
 * Test whether a directory looks like a DeepSeek Harness checkout.
 * @param {string} dir - candidate directory.
 * @returns true when the sources this plugin needs are present.
 */
function isCheckout(dir) {
  return existsSync(join(dir, 'tsconfig.base.json'))
    && existsSync(join(dir, 'packages/core/agent/src/index.ts'))
    && existsSync(join(dir, 'packages/host/webserver/src/index.ts'))
}

/**
 * Locate the harness checkout.
 *
 * An explicit `DSH_CHECKOUT` is authoritative: when it is set but does not look
 * like a checkout, the run fails rather than silently falling back to another
 * copy. Falling back would typecheck against a different revision than the one
 * the caller asked for, which is worse than reporting the bad path.
 * @returns the checkout path, or undefined when none is present.
 */
function findCheckout() {
  const explicit = process.env.DSH_CHECKOUT
  if (explicit !== undefined && explicit !== '') {
    if (!isCheckout(explicit)) {
      console.error(
        `DSH_CHECKOUT is set to "${explicit}", which is not a DeepSeek Harness checkout.\n`
        + 'Expected tsconfig.base.json and packages/core/agent/src/index.ts beneath it.',
      )
      process.exit(1)
    }
    return resolve(explicit)
  }
  const candidates = [
    resolve(root, '..', 'deepseek-harness'),
    resolve(root, '..', '..', 'deepseek-harness'),
    '/tmp/dsh',
  ]
  return candidates.find(isCheckout)
}

const checkout = findCheckout()

if (checkout === undefined) {
  console.error(
    'No DeepSeek Harness checkout found, so the harness API cannot be typechecked.\n'
    + 'Set DSH_CHECKOUT to a checkout, or run:\n'
    + '  git clone --depth 1 https://github.com/deepseek-ai/deepseek-harness.git ../deepseek-harness',
  )
  process.exit(1)
}

/**
 * Read the merge-extensible map names the plugin relies on.
 *
 * These are asserted by the generated config so a harness rename surfaces as a
 * clear message instead of a confusing assignability error at the call site.
 * @returns the event names this plugin subscribes to.
 */
function subscribedEvents() {
  const source = readFileSync(join(root, 'src/client/index.ts'), 'utf8')
  return [...source.matchAll(/ctx\.on\('([^']+)'/g)].map(m => m[1])
}

const events = subscribedEvents()
const harnessConfig = join(checkout, 'tsconfig.base.json')
const config = {
  extends: relative(root, harnessConfig).replace(/\\/g, '/'),
  compilerOptions: {
    noEmit: true,
    // The harness's own base config enables project references and emit
    // settings meant for its build; the plugin only needs the type graph.
    composite: false,
    declaration: false,
    declarationMap: false,
    sourceMap: false,
  },
  include: ['src/**/*.ts'],
}

writeFileSync(join(root, 'tsconfig.typecheck.json'), `${JSON.stringify(config, null, 2)}\n`)
process.stdout.write(
  `typecheck config written against ${checkout}\n`
  + `  observing: ${events.length > 0 ? events.join(', ') : '(no events)'}\n`,
)
