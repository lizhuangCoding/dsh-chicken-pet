/**
 * The host half of the pet: serving the sprite asset, publishing settings, and
 * watching agent state.
 *
 * A browser plugin cannot read files from a package directory, so the sprite
 * sheet needs an HTTP route. This half owns that route and nothing else — all
 * drawing and interaction live in the client half.
 *
 * Settings are owned here rather than in the browser half because only the
 * host row is composed from the profile patch. Registering them as a settings
 * namespace is what puts the pet's card on the Web settings page: the page
 * dispatches one card per namespace the host serves, so a card appears without
 * any change to the DSH installation.
 *
 * Agent activity is observed two ways on purpose. Events are the accurate
 * source and arrive immediately; polling is the fallback, because an event can
 * be dispatched on a bus a given deployment does not forward to plugin
 * listeners. Either source can drive the pet; neither is trusted alone.
 */

import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
// Type-only: carries the declaration merge that puts `webServer` on `Context`,
// and the settings provider's `installSection` face.
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-settings'

/** Stable Cordis plugin name. */
export const name = 'chicken-pet-host'

/** Services this half needs before it can serve the sheet. */
export const inject = ['webServer']

/**
 * Settings namespace the pet's card is keyed by.
 *
 * The host registers this name and the browser half registers a card under the
 * same key; the settings page pairs the two by that name alone.
 */
export const SETTINGS_NAMESPACE = 'chicken-pet'

/** Host-half configuration, and the schema the settings card edits. */
export interface Config {
  /** Serve the spritesheet route. */
  serveAssets: boolean
  /** Poll interval for the agent-state fallback, in milliseconds. */
  pollMs: number
  /** Whether the pet is shown at all. */
  enabled: boolean
  /** Resting corner before the user drags it. */
  corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  /** Horizontal margin from the corner, in CSS pixels. */
  marginX: number
  /** Vertical margin from the corner, in CSS pixels. */
  marginY: number
  /** Rendered width in CSS pixels; height follows the cell aspect ratio. */
  size: number
  /** Play a short chirp when the agent answers. */
  sound: boolean
  /** Chirp volume, 0 to 1. */
  volume: number
  /** Shortest gap between idle behaviour rolls, in seconds. */
  idleMinSec: number
  /** Longest gap between idle behaviour rolls, in seconds. */
  idleMaxSec: number
  /** How often the chicken does something rather than standing still, 0 to 1. */
  liveliness: number
}

export const Config: z<Config> = z.object({
  // Deployment wiring, not user preferences: these stay out of the card.
  serveAssets: z.boolean().default(true),
  pollMs: z.number().step(1).min(200).max(10000).default(700),

  // User-editable settings, surfaced by the card on the settings page.
  enabled: z.boolean().default(true),
  corner: z.union([
    z.const('top-left'),
    z.const('top-right'),
    z.const('bottom-left'),
    z.const('bottom-right'),
  ]).default('bottom-right'),
  marginX: z.number().min(0).max(2000).default(24),
  marginY: z.number().min(0).max(2000).default(24),
  size: z.number().step(1).min(48).max(512).default(128),
  sound: z.boolean().default(true),
  volume: z.number().min(0).max(1).default(0.85),
  idleMinSec: z.number().min(1).max(600).default(4),
  idleMaxSec: z.number().min(1).max(600).default(12),
  liveliness: z.number().min(0).max(1).default(0.75),
})

/**
 * Read the packaged spritesheet and its content hash.
 *
 * The sheet is located from this module's own URL, which is the only anchor
 * that survives being installed under a different package manager layout. The
 * path depends on where the compiled file sits, and the package exposes the
 * host half at both `lib/host/index.js` (source emit) and `lib/index.js` (the
 * published re-export), so the search walks upward instead of assuming a depth.
 *
 * The hash is returned to the client so a reload after a plugin upgrade cannot
 * serve a stale cached sheet.
 * @returns the PNG bytes, the hash, and the pixel dimensions.
 * @throws when the sheet is missing from the installed package.
 */
function loadSheet(): { bytes: Buffer; hash: string; width: number; height: number } {
  const candidates = [
    new URL('../../assets/spritesheet.png', import.meta.url),
    new URL('../assets/spritesheet.png', import.meta.url),
  ]
  for (const url of candidates) {
    if (!existsSync(fileURLToPath(url))) continue
    const bytes = readFileSync(fileURLToPath(url))
    const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 16)
    // PNG IHDR: width and height are big-endian uint32 at byte offsets 16 and 20.
    const width = bytes.readUInt32BE(16)
    const height = bytes.readUInt32BE(20)
    return { bytes, hash, width, height }
  }
  throw new Error(
    'chicken-pet: assets/spritesheet.png is missing from the installed package; '
    + 'reinstall the plugin or run `npm run build`.',
  )
}

/** The appearance and behaviour values the browser half reads. */
export interface PetSettings {
  enabled: boolean
  corner: Config['corner']
  marginX: number
  marginY: number
  size: number
  sound: boolean
  volume: number
  idleMinSec: number
  idleMaxSec: number
  liveliness: number
}

/**
 * Project the plugin config onto the fields the browser half consumes.
 * @param config - the currently authoritative configuration.
 * @returns the pet's appearance and behaviour settings.
 */
function petSettings(config: Config): PetSettings {
  return {
    enabled: config.enabled,
    corner: config.corner,
    marginX: config.marginX,
    marginY: config.marginY,
    size: config.size,
    sound: config.sound,
    volume: config.volume,
    idleMinSec: config.idleMinSec,
    idleMaxSec: config.idleMaxSec,
    liveliness: config.liveliness,
  }
}

/**
 * Register the spritesheet route and publish sheet metadata plus settings.
 *
 * @param ctx - registrant context carrying the web server.
 * @param config - host-half configuration.
 * @returns nothing.
 */
export function apply(ctx: Context, config: Config): void {
  const sheet = loadSheet()
  const routePath = '/chicken-pet/spritesheet.png'

  if (config.serveAssets) {
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact',
      path: routePath,
      handler: (req, res) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          res.writeHead(405, { Allow: 'GET, HEAD' })
          res.end()
          return
        }
        res.writeHead(200, {
          'Content-Type': 'image/png',
          'Content-Length': String(sheet.bytes.length),
          // The URL carries the content hash, so the sheet is immutable.
          'Cache-Control': 'public, max-age=31536000, immutable',
        })
        if (req.method === 'HEAD') res.end()
        else res.end(sheet.bytes)
      },
    }))
  }

  // The authoritative configuration: the settings scope while one is attached,
  // the composition entry otherwise. The pet reads this instead of the raw
  // `config` so a settings change reaches the browser without a restart.
  let source = (): Config => config

  // Subscribers to appearance changes, so a saved card updates the pet live.
  const listeners = new Set<(settings: PetSettings) => void>()

  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.installSection(settingsCtx, SETTINGS_NAMESPACE, Config, config, {
      setSource: (current) => {
        source = current as () => Config
      },
      onChange: () => {
        const next = petSettings(source())
        for (const listener of listeners) listener(next)
      },
      validate: (value) => {
        // A window read backwards would make the pet's scheduler spin: the
        // engine expects a non-negative span. Refuse the write instead.
        if (value.idleMaxSec < value.idleMinSec) {
          throw new Error('最长间隔必须大于等于最短间隔')
        }
      },
    })
  })

  /**
   * Observe appearance changes.
   * @param listener - called with the new settings after each change.
   * @returns the disposer removing this listener.
   */
  const onSettings = (listener: (settings: PetSettings) => void): (() => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }
  ctx.effect(() => () => listeners.clear())

  ctx.provide('chickenPetSheet', {
    /** URL the browser loads the sheet from. */
    url: routePath,
    /** Content hash used as a cache key. */
    hash: sheet.hash,
    /** Sheet width in pixels. */
    width: sheet.width,
    /** Sheet height in pixels. */
    height: sheet.height,
    /** Columns in the sheet. */
    cols: 8,
    /** Rows in the sheet. */
    rows: sheet.height / 208,
    /** Pixel width of one cell. */
    cellWidth: 192,
    /** Pixel height of one cell. */
    cellHeight: 208,
    /**
     * Current appearance and behaviour settings.
     *
     * These arrive here rather than as browser config because only the host row
     * is composed from the profile patch; the browser half is discovered from
     * the `dsh.client` declaration and receives no row config of its own.
     */
    get pets(): PetSettings {
      return petSettings(source())
    },
    /** Subscribe to appearance changes; used to update the pet live. */
    onSettings,
  })
}
