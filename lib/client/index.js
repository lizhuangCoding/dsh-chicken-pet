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
import { defaultConfig } from './config.js';
import { installCard, SETTINGS_NAMESPACE } from './card.js';
import { mountPet } from './pet.js';
/** Stable Cordis plugin name. */
export const name = 'chicken-pet';
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
export const inject = [];
export { defaultConfig } from './config.js';
/**
 * Mount the pet and register its settings card.
 * @param ctx - registrant context.
 * @param config - fallback configuration for a host-less mount.
 * @returns nothing.
 */
export function apply(ctx, config) {
    const service = ctx.get('chickenPetSheet');
    mountPet(ctx, service, { ...defaultConfig(), ...config });
    // The card needs the slot registry and the settings scope together. Asking
    // for both through `ctx.inject` waits until they exist without holding up the
    // pet itself, which is why these dependencies are declared here rather than on
    // the plugin.
    // Mirrors the shape a shipped settings card uses: wait on the settings scope
    // alone, then read the slot registry from the injected context inside the
    // callback. Asking for `slots` in this dependency list as well would gate the
    // callback on a second service for no benefit, and a callback that never runs
    // reports nothing.
    ctx.inject(['settingsScope'], (ready) => {
        const scope = ready?.settingsScope;
        // A missing binding is not an error worth throwing over: the pet still
        // draws, and throwing here would take down the whole plugin.
        if (scope === undefined) {
            console.warn('[chicken-pet] settingsScope is unavailable; the settings card is skipped');
            return;
        }
        console.info('[chicken-pet] registering the settings card');
        installCard(ready, scope.bind({ namespace: SETTINGS_NAMESPACE }));
    });
}
