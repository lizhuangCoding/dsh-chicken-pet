/**
 * The host half of the pet: serving the sprite asset and watching agent state.
 *
 * A browser plugin cannot read files from a package directory, so the sprite
 * sheet needs an HTTP route. This half owns that route and nothing else — all
 * drawing and interaction live in the client half.
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
/** Host-half configuration. */
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
/**
 * Register the spritesheet route and expose sheet metadata as a service.
 *
 * @param ctx - registrant context carrying the web server and agent registry.
 * @param config - host-half configuration.
 * @returns nothing.
 */
export declare function apply(ctx: Context, config: Config): void;
