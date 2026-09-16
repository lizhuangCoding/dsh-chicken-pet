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
import type { Context } from '@deepseek-ai/cordis';
import { type Config } from './config.ts';
/** Stable Cordis plugin name. */
export declare const name = "chicken-pet";
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
export declare const inject: never[];
export { defaultConfig } from './config.ts';
export type { Config } from './config.ts';
/**
 * Mount the pet and register its settings card.
 * @param ctx - registrant context.
 * @param config - fallback configuration for a host-less mount.
 * @returns nothing.
 */
export declare function apply(ctx: Context, config?: Partial<Config>): void;
