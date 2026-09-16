/**
 * The browser half of the pet.
 *
 * Two contributions live here. The pet itself is a fixed overlay that mounts as
 * soon as the plugin loads. The settings card registers into the Web settings
 * page under the namespace the host half serves, so users change the pet's
 * behaviour from the interface rather than by editing YAML.
 *
 * Both are optional at runtime: a deployment without the settings services
 * still gets the pet, and a browser half mounted without the host half falls
 * back to its own defaults.
 */

import type { Context } from '@deepseek-ai/cordis'
import { defaultConfig, type Config } from './config.ts'
import { installCard, SETTINGS_NAMESPACE } from './card.ts'
import { mountPet, type SheetInfo } from './pet.ts'

/** Stable Cordis plugin name. */
export const name = 'chicken-pet'

/**
 * Services this half needs before it activates.
 *
 * Deliberately empty. Cordis gates activation on every declared name: a row
 * whose service never appears stays `pending` forever, and the boot audit then
 * reports an entry that did not activate, which fails Web startup. The pet
 * needs no service to draw, so it declares none and reaches for the optional
 * ones at runtime instead.
 *
 * `{ optional: [...] }` is NOT how to express this. Cordis reads `inject` as a
 * map of service name to intercept config, so that object asks for a service
 * literally named `optional` and the plugin waits forever.
 */
export const inject = []

export { defaultConfig }
// Exported for the package's own tests: rendering the card in isolation is the
// only way to catch a props-contract drift without a browser.
export { ChickenPetCard } from './card.ts'
export type { Config } from './config.ts'

/**
 * Mount the pet and register its settings card.
 * @param ctx - registrant context.
 * @param config - fallback configuration for a host-less mount.
 * @returns nothing.
 */
export function apply(ctx: Context, config?: Partial<Config>): void {
  // The sheet URL and the saved settings both arrive from the browser side's own
  // view of the host. This half runs in the page, so `ctx.get` cannot reach a
  // service the host process provides; the service name is kept only as the
  // same-process fallback a test harness mounts.
  const service = ctx.get('chickenPetSheet') as SheetInfo | undefined
  const pet = mountPet(ctx, service, { ...defaultConfig(), ...config })

  ctx.inject(['settingsScope'], (ready) => {
    const scope = (ready as unknown as {
      settingsScope?: {
        bind(spec: { namespace: string }): {
          getSnapshot(): { status: string; value?: Partial<Config> }
          subscribe(listener: () => void): () => void
          set(field: string, value: unknown): Promise<void>
          unset(field: string): Promise<void>
        }
      }
    } | undefined)?.settingsScope
    // A missing binding is not an error worth throwing over: the pet still
    // draws, and throwing here would take down the whole plugin.
    if (scope === undefined) {
      console.warn('[chicken-pet] settingsScope is unavailable; the settings card is skipped')
      return
    }

    const bound = scope.bind({ namespace: SETTINGS_NAMESPACE })

    // Saved settings reach the pet through the same scope the card writes, so a
    // change applies live. Reading the host half's own service would deliver
    // nothing: that service lives in the other process.
    const applySaved = (): void => {
      const snapshot = bound.getSnapshot()
      if (snapshot.status !== 'ready' || snapshot.value === undefined) return
      pet?.update({ ...defaultConfig(), ...config, ...snapshot.value })
    }
    applySaved()
    ready.effect(() => bound.subscribe(applySaved))

    installCard(ready, bound as never)
  })
}
