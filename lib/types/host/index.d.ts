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
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
/** Stable Cordis plugin name. */
export declare const name = "chicken-pet-host";
/** Services this half needs before it can serve the sheet. */
export declare const inject: string[];
/**
 * Settings namespace the pet's card is keyed by.
 *
 * The host registers this name and the browser half registers a card under the
 * same key; the settings page pairs the two by that name alone.
 */
export declare const SETTINGS_NAMESPACE = "chicken-pet";
/** Host-half configuration, and the schema the settings card edits. */
export interface Config {
    /** Serve the spritesheet route. */
    serveAssets: boolean;
    /** Poll interval for the agent-state fallback, in milliseconds. */
    pollMs: number;
    /** Whether the pet is shown at all. */
    enabled: boolean;
    /** Resting corner before the user drags it. */
    corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    /** Horizontal margin from the corner, in CSS pixels. */
    marginX: number;
    /** Vertical margin from the corner, in CSS pixels. */
    marginY: number;
    /** Rendered width in CSS pixels; height follows the cell aspect ratio. */
    size: number;
    /** Play a short chirp when the agent answers. */
    sound: boolean;
    /** Chirp volume, 0 to 1. */
    volume: number;
    /** Shortest gap between idle behaviour rolls, in seconds. */
    idleMinSec: number;
    /** Longest gap between idle behaviour rolls, in seconds. */
    idleMaxSec: number;
    /** How often the chicken does something rather than standing still, 0 to 1. */
    liveliness: number;
}
export declare const Config: z<Config>;
/** The appearance and behaviour values the browser half reads. */
export interface PetSettings {
    enabled: boolean;
    corner: Config['corner'];
    marginX: number;
    marginY: number;
    size: number;
    sound: boolean;
    volume: number;
    idleMinSec: number;
    idleMaxSec: number;
    liveliness: number;
}
/**
 * Register the spritesheet route and publish sheet metadata plus settings.
 *
 * @param ctx - registrant context carrying the web server.
 * @param config - host-half configuration.
 * @returns nothing.
 */
export declare function apply(ctx: Context, config: Config): void;
