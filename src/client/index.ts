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
 * Services this half uses when present.
 *
 * None are required: the pet draws with or without them, and the card simply
 * does not register when the settings page is absent. Declaring them optional
 * keeps the plugin usable in a minimal composition.
 */
export const inject = { optional: ['slots', 'settingsScope'] }

export { defaultConfig } from './config.ts'
export type { Config } from './config.ts'

/**
 * Mount the pet and register its settings card.
 * @param ctx - registrant context.
 * @param config - fallback configuration for a host-less mount.
 * @returns nothing.
 */
export function apply(ctx: Context, config?: Partial<Config>): void {
  const service = ctx.get('chickenPetSheet') as SheetInfo | undefined

  mountPet(ctx, service, { ...defaultConfig(), ...config })

  // The scope is provided by the settings domain; without it there is no card
  // to register and no way to write a change.
  const settingsScope = ctx.get('settingsScope') as {
    bind(spec: { namespace: string }): unknown
  } | undefined
  if (settingsScope !== undefined) {
    installCard(ctx, settingsScope.bind({ namespace: SETTINGS_NAMESPACE }) as never)
  }
}
