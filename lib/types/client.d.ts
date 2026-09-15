/**
 * The browser half of the pet: a floating pixel chicken that reacts to the
 * agent and to the person using it.
 *
 * Presentation is plain DOM rather than a slot-registered React component, so
 * the pet mounts identically in any surface that loads the plugin and owns no
 * layout slot. The chicken lives in a fixed-position, pointer-transparent host
 * element; only the sprite itself accepts pointer events, so it never blocks
 * the chat behind it.
 *
 * The sprite is a CSS background positioned by row and column, which keeps the
 * animation loop to one style write per frame.
 */
import type { Context } from '@deepseek-ai/cordis';
/** Stable Cordis plugin name. */
export declare const name = "chicken-pet";
/** The pet needs no Cordis service; it reacts to agent events when they arrive. */
export declare const inject: never[];
/** Client-half configuration, as supplied by the host half over its service. */
export interface Config {
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
/**
 * Defaults used when no host half supplies settings.
 *
 * These are plain values rather than a schema: the host validates user config
 * with schemastery, and this half only needs a fallback for a host-less mount.
 * Keeping the validator on the host is also what keeps `schemastery` out of the
 * browser bundle, which the shell cannot resolve.
 * @returns a complete configuration with every field defaulted.
 */
export declare function defaultConfig(): Config;
/**
 * Mount the pet.
 *
 * Settings come from the host half's service rather than this half's own
 * config: only the host row is composed from the profile patch, so a value
 * placed on that row reaches the browser through here. The local `Config`
 * remains as the fallback for a browser-half-only mount.
 * @param ctx - registrant context.
 * @param config - fallback configuration for a host-less mount.
 * @returns nothing.
 */
export declare function apply(ctx: Context, config?: Partial<Config>): void;
