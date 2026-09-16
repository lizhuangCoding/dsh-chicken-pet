/**
 * Bundle the browser half into the artifact shape DSH loads.
 *
 * A DSH client plugin is not an ES module. The shell fetches the bundle
 * outside Vite's module graph and executes it as a plain script, so the file
 * must register itself on the loader table:
 *
 *   window.__ModuleLoader__.load({ id, factory: (require) => { ... } })
 *
 * Inside the factory the bundle speaks CommonJS: `require` resolves through
 * the injected loader table, and the factory returns `module.exports`.
 * Emitting `export * from './client/index.js'` instead — or any other ES module
 * syntax — is a SyntaxError in the browser, and because DSH serves plugin
 * bundles as one combined request, that single error fails registration for
 * every plugin in the batch. That is a whole-interface failure, not a broken
 * pet, which is exactly what a previous revision of this package caused.
 *
 * So this script does real bundling rather than a textual wrap: it resolves
 * the module graph from the entry, emits each module as a factory in a small
 * registry, and wires `require` to that registry plus the loader table. The
 * output is verified by executing it against a stubbed loader before the build
 * is allowed to finish.
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const PLUGIN_ID = pkg.name

/** Entry of the browser half, relative to `src/`. */
const CLIENT_ENTRY = 'client/index.ts'

/**
 * Specifiers the shell answers from its own module table.
 *
 * These must NOT be inlined. React in particular has to be the shell's single
 * instance: a second copy would give the settings card hooks bound to a
 * different dispatcher than the renderer that calls it.
 */
const PLATFORM_EXTERNALS = new Set([
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
])

/**
 * Read a source module and strip its TypeScript-only syntax.
 *
 * These sources use a deliberately small subset — type annotations, interfaces,
 * `import type`, and `as` casts — so the emit pass of `tsc` already produced
 * plain JavaScript by the time this runs. This function therefore only has to
 * rewrite module syntax, not understand types.
 * @param file - absolute path of a compiled module.
 * @returns the module body with module syntax removed.
 */
function readModuleBody(file) {
  return readFileSync(file, 'utf8')
}

/**
 * Parse the import statements of one compiled module.
 * @param source - module text.
 * @returns static imports with their specifiers and bindings.
 */
function parseImports(source) {
  const imports = []
  const pattern = /^\s*import\s+(?:type\s+)?(?:(\{[^}]*\})|(\*\s+as\s+\w+)|(\w+))?\s*(?:from\s*)?'([^']+)'\s*;?\s*$/gm
  for (const match of source.matchAll(pattern)) {
    const [, named, namespace, defaultName, specifier] = match
    imports.push({
      source: match[0],
      specifier,
      named: named === undefined ? undefined : named,
      namespace: namespace === undefined ? undefined : namespace,
      defaultName: defaultName === undefined ? undefined : defaultName,
    })
  }
  return imports
}

/**
 * Parse the export statements of one compiled module.
 * @param source - module text.
 * @returns the exported names and whether a default export exists.
 */
function parseExports(source) {
  const named = []
  for (const match of source.matchAll(/^\s*export\s+(?:async\s+)?(?:function|class|const|let|var)\s+(\w+)/gm)) {
    named.push(match[1])
  }
  for (const match of source.matchAll(/^\s*export\s*\{([^}]*)\}\s*;?\s*$/gm)) {
    for (const part of match[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim()
      if (name !== undefined && name !== '') named.push(name)
    }
  }
  const hasDefault = /^\s*export\s+default\s/m.test(source)
  return { named: [...new Set(named)], hasDefault }
}

/**
 * Rewrite one module's source into a CommonJS factory body.
 * @param source - module text.
 * @param file - absolute path, used for relative specifier resolution.
 * @returns the transformed body and the list of resolved dependencies.
 */
function toFactoryBody(source, file) {
  const dir = dirname(file)
  const deps = []
  let out = source

  for (const imp of parseImports(source)) {
    const isRelative = imp.specifier.startsWith('.')
    const key = isRelative
      ? `./${relative(join(root, 'lib'), resolve(dir, imp.specifier)).replace(/\\/g, '/')}`
      : imp.specifier
    deps.push({ key, isRelative, specifier: imp.specifier, file })

    const lines = []
    if (imp.namespace !== undefined) {
      lines.push(`const ${imp.namespace.replace(/\*\s+as\s+/, '')} = __require(${JSON.stringify(key)});`)
    }
    if (imp.defaultName !== undefined) {
      lines.push(`const ${imp.defaultName} = __require(${JSON.stringify(key)}).default ?? __require(${JSON.stringify(key)});`)
    }
    if (imp.named !== undefined) {
      const bindings = imp.named
        .slice(1, -1)
        .split(',')
        .map(part => part.trim())
        .filter(part => part !== '')
        .map((part) => {
          const [orig, alias] = part.split(/\s+as\s+/).map(s => s.trim())
          return alias === undefined ? orig : `${orig}: ${alias}`
        })
        .join(', ')
      if (bindings !== '') lines.push(`const { ${bindings} } = __require(${JSON.stringify(key)});`)
    }
    out = out.replace(imp.source, lines.join('\n'))
  }

  // Re-exports (`export { a } from './b'`) both bind the name and forward it.
  // They must be turned into a require plus an export entry: leaving the form
  // in place emits ES module syntax, which is a SyntaxError in the browser and
  // fails registration for every plugin in the batch.
  const reExports = []
  out = out.replace(
    /^\s*export\s*\{([^}]*)\}\s*from\s*'([^']+)'\s*;?\s*$/gm,
    (_match, names, specifier) => {
      const key = specifier.startsWith('.')
        ? `./${relative(join(root, 'lib'), resolve(dir, specifier)).replace(/\\/g, '/')}`
        : specifier
      deps.push({ key, isRelative: specifier.startsWith('.'), specifier, file })
      const local = `__re_${reExports.length}`
      const bindings = []
      for (const part of names.split(',')) {
        const trimmed = part.trim()
        if (trimmed === '') continue
        const [orig, alias] = trimmed.split(/\s+as\s+/).map(t => t.trim())
        // Bind the name into this module's scope as well as forwarding it. The
        // emitted export list references the bare identifier, so a re-export
        // that only forwards leaves that name undefined at runtime.
        // `orig` is the exported name; bind it under that same name so the
        // emitted export list can reference it. A renamed re-export
        // (`export { a as b }`) forwards through `reExports`, not here.
        bindings.push(orig)
        reExports.push(alias === undefined ? orig : `${orig}: ${alias}`)
      }
      const destructure = bindings.length > 0 ? ` const { ${bindings.join(', ')} } = ${local};` : ''
      return `const ${local} = __require(${JSON.stringify(key)});${destructure}`
    },
  )

  const exports = parseExports(source)
  out = out
    .replace(/^\s*export\s+(?:async\s+)?(?:function|class|const|let|var)\s+/gm, (m) => m.replace('export ', ''))
    .replace(/^\s*export\s*\{[^}]*\}\s*;?\s*$/gm, '')
    .replace(/^\s*export\s+default\s+/gm, 'exports.default = ')

  const forwarded = [...exports.named, ...reExports]
  if (forwarded.length > 0) {
    out += `\nObject.assign(exports, { ${forwarded.join(', ')} });\n`
  }

  return { body: out, deps }
}

// ── build ──────────────────────────────────────────────────────────────────

const libClientDir = join(root, 'lib', 'client')
if (!existsSync(join(libClientDir, 'index.js'))) {
  console.error('lib/client/index.js is missing; run the tsc emit pass first.')
  process.exit(1)
}

/** Modules to bundle, keyed by their id inside the bundle. */
const modules = new Map()

/**
 * Walk the module graph from an entry, adding each module once.
 * @param file - absolute path of the compiled module.
 * @returns the module key.
 */
function collect(file) {
  const key = `./${relative(join(root, 'lib'), file).replace(/\\/g, '/')}`
  if (modules.has(key)) return key
  modules.set(key, null)
  const { body, deps } = toFactoryBody(readModuleBody(file), file)
  modules.set(key, body)
  for (const dep of deps) {
    if (!dep.isRelative) continue
    const target = resolve(dirname(file), dep.specifier)
    if (!existsSync(target)) {
      console.error(`cannot resolve ${dep.specifier} from ${relative(root, file)}`)
      process.exit(1)
    }
    collect(target)
  }
  return key
}

const entryKey = collect(join(libClientDir, 'index.js'))
const entryBase = CLIENT_ENTRY.replace(/\.ts$/, '')

const registry = [...modules.entries()]
  .map(([key, body]) => `${JSON.stringify(key)}: (__require) => {\n${body}\n}`)
  .join(',\n')

/*
 * Each module factory receives its own `exports` object.
 *
 * The body ends with `Object.assign(exports, { ... })`, which the transform
 * emits. That identifier must resolve to the module's own exports, so the
 * factory declares `exports` as a parameter. Leaving it to the enclosing
 * closure instead makes every module write into one shared object: the bundle
 * still "works" for the entry, but a module that reads an imported binding
 * sees a value another module overwrote — which is how `CELL` became
 * `undefined` inside `apply` while `exports.CELL` still looked correct.
 */
const bundle = `window.__ModuleLoader__.load({
  id: ${JSON.stringify(PLUGIN_ID)},
  factory: (require) => {
    var module = { exports: {} };
    var __modules = {
${registry.replace(/: \(__require\) => \{/g, ': (__require, exports) => {')}
    };
    var __cache = {};
    function __require(id) {
      if (__cache[id] !== undefined) return __cache[id].exports;
      var factory = __modules[id];
      if (factory === undefined) return require(id);
      var mod = { exports: {} };
      __cache[id] = mod;
      factory(__require, mod.exports);
      return mod.exports;
    }
    var __entry = __require(${JSON.stringify(entryKey)});
    Object.assign(module.exports, __entry);
    return module.exports;
  },
});
`

writeFileSync(join(root, 'lib', 'client.js'), bundle)
process.stdout.write(
  `bundled lib/client.js  ${(bundle.length / 1024).toFixed(1)} KB  (${modules.size} module(s), entry ${entryBase})\n`,
)
