/**
 * Smoke tests for the built package.
 *
 * These run against `lib/`, not `src/`, so they catch the failure modes that
 * only appear after publishing: a module that still imports a `.ts` specifier,
 * a package that omits a runtime file, or a sprite path that is wrong in the
 * installed layout. `npm test` builds first, then runs this.
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('every emitted module is valid JavaScript', () => {
  const files = execFileSync('find', [join(root, 'lib'), '-name', '*.js'], { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(Boolean)
  assert.ok(files.length >= 5, `expected the built modules, found ${files.length}`)
  for (const file of files) {
    execFileSync(process.execPath, ['--check', file])
  }
})

test('no emitted module keeps a .ts import specifier', () => {
  const files = execFileSync('find', [join(root, 'lib'), '-name', '*.js'], { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(Boolean)
  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    assert.ok(
      !/from\s+'\.[^']*\.ts'/.test(source),
      `${file} imports a .ts specifier, which does not exist after publishing`,
    )
  }
})

test('the package ships every runtime file it advertises', () => {
  for (const rel of [
    'lib/index.js',
    'lib/client.js',
    'lib/host/index.js',
    'lib/client/index.js',
    'lib/client/brain.js',
    'lib/client/sheet.js',
    'assets/spritesheet.png',
    'cordis.patch.yml',
  ]) {
    assert.ok(existsSync(join(root, rel)), `${rel} is missing`)
  }
})

test('the sprite sheet is a valid PNG with the declared geometry', () => {
  const bytes = readFileSync(join(root, 'assets', 'spritesheet.png'))
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'not a PNG')
  const width = bytes.readUInt32BE(16)
  const height = bytes.readUInt32BE(20)
  assert.equal(width, 1536, 'expected 8 columns of 192px')
  assert.equal(height % 208, 0, 'height must be a whole number of 208px rows')
  assert.ok(height / 208 >= 20, 'expected at least the 20 documented rows')
})

test('the spritesheet.json row order matches the runtime table', async () => {
  const meta = JSON.parse(readFileSync(join(root, 'assets', 'spritesheet.json'), 'utf8'))
  const sheet = readFileSync(join(root, 'src', 'client', 'sheet.ts'), 'utf8')
  const names = [...sheet.matchAll(/name: '([^']+)'/g)].map(m => m[1])
  const counts = [...sheet.matchAll(/count: (\d+)/g)].map(m => Number(m[1]))
  assert.deepEqual(
    meta.rows.map(r => r.name),
    names,
    'row order drifted between the generator and the runtime table',
  )
  assert.deepEqual(
    meta.rows.map(r => r.count),
    counts,
    'frame counts drifted between the generator and the runtime table',
  )
})

test('the host half registers its route and serves the sheet', async () => {
  const host = await import(join(root, 'lib', 'index.js'))
  assert.equal(host.name, 'chicken-pet-host')
  assert.deepEqual(host.inject, ['webServer'])

  const routes = []
  let provided
  const ctx = {
    effect: fn => fn(),
    webServer: { register: route => { routes.push(route); return () => {} } },
    provide: (name, value) => { provided = { name, value } },
    // The settings namespace registers through `inject`; a deployment without a
    // settings provider never runs the callback, which is why this is optional.
    inject: () => {},
  }
  host.apply(ctx, host.Config({}))

  assert.equal(routes.length, 1)
  assert.equal(routes[0].path, '/chicken-pet/spritesheet.png')

  let status
  let headers
  let body
  routes[0].handler({ method: 'GET' }, {
    writeHead: (s, h) => { status = s; headers = h },
    end: b => { body = b },
  })
  assert.equal(status, 200)
  assert.equal(headers['Content-Type'], 'image/png')
  assert.equal(body.length, readFileSync(join(root, 'assets', 'spritesheet.png')).length)
  assert.equal(provided.value.cols, 8)
  assert.equal(provided.value.cellWidth, 192)

  let headBody
  routes[0].handler({ method: 'HEAD' }, { writeHead: () => {}, end: b => { headBody = b } })
  assert.equal(headBody, undefined, 'HEAD must not carry a body')

  let postStatus
  routes[0].handler({ method: 'POST' }, { writeHead: s => { postStatus = s }, end: () => {} })
  assert.equal(postStatus, 405)
})

test('the autonomy engine runs without a DOM and varies its behaviour', async () => {
  const { ChickenBrain } = await import(join(root, 'lib', 'client', 'brain.js'))
  let now = 0
  let id = 0
  const timers = new Map()
  const clock = {
    now: () => now,
    setTimeout(fn, ms) {
      const key = ++id
      timers.set(key, { at: now + ms, fn })
      return () => timers.delete(key)
    },
  }
  const advance = ms => {
    const target = now + ms
    for (;;) {
      let pick = -1
      let earliest = Infinity
      for (const [key, timer] of timers) {
        if (timer.at <= target && timer.at < earliest) { earliest = timer.at; pick = key }
      }
      if (pick < 0) break
      const timer = timers.get(pick)
      timers.delete(pick)
      now = timer.at
      timer.fn()
    }
    now = target
  }

  let seed = 42
  const random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
  const brain = new ChickenBrain(
    { idleMinMs: 1500, idleMaxMs: 4000, liveliness: 0.9, celebrateMs: 2000, reactMs: 1000 },
    clock,
    random,
  )
  const seen = new Set()
  brain.subscribe(snapshot => seen.add(snapshot.animation))
  advance(60000)

  assert.ok(seen.size >= 3, `expected varied idle behaviour, saw only ${[...seen].join(', ')}`)
  assert.ok(seen.has('idle'), 'the chicken should still stand still sometimes')

  // Agent work must take over, and a clean finish must celebrate.
  brain.dispatch({ kind: 'agent-working' })
  assert.equal(brain.snapshot().animation, 'work')
  brain.dispatch({ kind: 'turn-finished' })
  assert.equal(brain.snapshot().animation, 'celebrate')
  advance(2500)
  assert.equal(brain.snapshot().mode, 'idle', 'a one-shot must release back to idle')

  // Rapid answers must collapse to a single reaction.
  let barks = 0
  const quiet = new ChickenBrain(
    { idleMinMs: 1000, idleMaxMs: 3000, liveliness: 0, celebrateMs: 2000, reactMs: 600 },
    clock,
    random,
  )
  quiet.subscribe(s => { if (s.text === '咕咕！') barks++ })
  quiet.dispatch({ kind: 'answer-finished' })
  advance(200)
  quiet.dispatch({ kind: 'answer-finished' })
  advance(200)
  assert.equal(barks, 1, 'a multi-step turn must not chirp on every step')

  brain.dispose()
  quiet.dispose()
})

test('higher liveliness means less standing still', async () => {
  const { ChickenBrain } = await import(join(root, 'lib', 'client', 'brain.js'))
  const share = liveliness => {
    let now = 0
    let id = 0
    const timers = new Map()
    const clock = {
      now: () => now,
      setTimeout(fn, ms) { const key = ++id; timers.set(key, { at: now + ms, fn }); return () => timers.delete(key) },
    }
    const advance = ms => {
      const target = now + ms
      for (;;) {
        let pick = -1
        let earliest = Infinity
        for (const [key, timer] of timers) {
          if (timer.at <= target && timer.at < earliest) { earliest = timer.at; pick = key }
        }
        if (pick < 0) break
        const timer = timers.get(pick)
        timers.delete(pick)
        now = timer.at
        timer.fn()
      }
      now = target
    }
    let seed = 7
    const random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
    const brain = new ChickenBrain(
      { idleMinMs: 1500, idleMaxMs: 3000, liveliness, celebrateMs: 1000, reactMs: 500 },
      clock,
      random,
    )
    let total = 0
    let idle = 0
    brain.subscribe(s => { total++; if (s.animation === 'idle') idle++ })
    advance(120000)
    brain.dispose()
    return idle / total
  }

  const low = share(0.1)
  const high = share(0.95)
  assert.ok(
    low > high,
    `liveliness should reduce idle time, got ${low.toFixed(2)} at 0.1 and ${high.toFixed(2)} at 0.95`,
  )
})
