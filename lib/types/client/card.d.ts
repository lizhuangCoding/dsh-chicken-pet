/**
 * The pet's card on the Web settings page.
 *
 * The page dispatches one card per settings namespace the host serves, keyed by
 * that namespace, so registering here is what puts the pet's options in the
 * interface instead of leaving users to edit `cordis.patch.yml` by hand.
 *
 * The card follows the same shape as the ones DSH ships: a header that names
 * the plugin and discloses its controls in place, a chevron that turns over
 * when open, a pending marker that survives collapsing, and a footer with
 * discard and save. Edits are staged locally and written on save rather than
 * committed on every keystroke, so a slider drag is one write instead of fifty.
 *
 * Two constraints come from the browser shell rather than from taste:
 *
 * - Only its platform modules resolve, so this card may require `react` and
 *   `@deepseek-ai/dsh-client-ui-primitives` and nothing else. `clsx` is not on
 *   that list; class names are composed with plain string joins.
 * - The inject face is spread onto props, not nested under `inject`. The face's
 *   `hooks` compartment becomes `use<Name>` and every other member lands at the
 *   top level, which is why a shipped card writes `props.save`.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { Config } from './config.ts';
/**
 * Settings namespace this card edits.
 *
 * Spelled here rather than imported from the host half: a client package must
 * not depend on a host package. The page pairs the two by this name alone.
 */
export declare const SETTINGS_NAMESPACE = "chicken-pet";
/** The shape of the live settings section. */
export interface ScopeSnapshot {
    status: 'loading' | 'ready' | 'unavailable';
    value: Partial<Config> | undefined;
    base: unknown;
    user: unknown;
    revision: number | undefined;
    writable: boolean;
}
/** What the card's registration injects, spread onto props by the renderer. */
export interface CardFace {
    /** Live scope snapshot. */
    getSnapshot(): ScopeSnapshot;
    /** Subscribe to snapshot changes. */
    subscribe(listener: () => void): () => void;
    /** Persist one field. */
    set(field: string, value: unknown): Promise<void>;
    /** Clear one field back to the composition layer. */
    reset(field: string): Promise<void>;
}
/**
 * Render the pet's settings card.
 * @param props - the injected face, spread onto props by the renderer.
 * @returns the card element.
 */
export declare function ChickenPetCard(props: CardFace & {
    __open?: boolean;
}): import("react").DetailedReactHTMLElement<{
    className: string;
}, HTMLElement> | null;
/**
 * Register the card with the settings page.
 *
 * @param ctx - client registrant context.
 * @param scope - the bound scope for this plugin's settings namespace.
 * @returns nothing.
 */
export declare function installCard(ctx: Context, scope: {
    getSnapshot(): ScopeSnapshot;
    subscribe(listener: () => void): () => void;
    set(field: string, value: unknown): Promise<void>;
    unset(field: string): Promise<void>;
}): void;
