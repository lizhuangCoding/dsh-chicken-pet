/**
 * The pet's card on the Web settings page.
 *
 * The page dispatches one card per settings namespace the host serves, keyed by
 * that namespace, so registering here is what puts the pet's options in the
 * interface instead of leaving users to edit `cordis.patch.yml` by hand.
 *
 * The card renders with `React.createElement` rather than JSX so the build
 * needs no JSX transform: this package is built by its own scripts, and adding
 * a compiler for one component would be more machinery than the component is
 * worth. The element tree is identical either way.
 *
 * A card must ship its own chrome, staging, and revision fencing; the settings
 * section deliberately exposes no shared field components to outside packages.
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
/** The shape of the live settings section the card reads. */
interface ScopeSnapshot {
    status: 'loading' | 'ready' | 'unavailable';
    value: Partial<Config> | undefined;
    base: unknown;
    user: unknown;
    revision: number | undefined;
    writable: boolean;
}
/** The settings scope the card edits, as this plugin uses it. */
interface SettingsScope {
    getSnapshot(): ScopeSnapshot;
    subscribe(listener: () => void): () => void;
    set(field: string, value: unknown): Promise<void>;
    unset(field: string): Promise<void>;
}
/** Props the renderer passes to the card component. */
interface CardProps {
    /** Form actions and the current snapshot, injected at registration. */
    inject: CardFace;
}
/** What the card's registration injects into the component. */
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
 * @param props - the injected face.
 * @returns the card's element tree.
 */
export declare function ChickenPetCard(props: CardProps): import("react").DetailedReactHTMLElement<{
    className: string;
}, HTMLElement>;
/**
 * Register the card with the settings page.
 *
 * @param ctx - client registrant context.
 * @param scope - the bound scope for this plugin's settings namespace.
 * @returns nothing.
 */
export declare function installCard(ctx: Context, scope: SettingsScope): void;
export {};
