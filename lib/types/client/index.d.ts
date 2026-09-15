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
import z from '@deepseek-ai/schemastery';
/** Stable Cordis plugin name. */
export declare const name = "chicken-pet";
/** The pet needs no Cordis service; it reacts to agent events when they arrive. */
export declare const inject: never[];
/** Client-half configuration; every deployment-varying choice lives here. */
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
    /** Shortest gap between idle behaviour rolls, in milliseconds. */
    idleMinSec: number;
    /** Longest gap between idle behaviour rolls, in milliseconds. */
    idleMaxSec: number;
    /** How often the chicken does something rather than standing still, 0 to 1. */
    liveliness: number;
}
export declare const Config: z<Config>;
/**
 * Mount the pet.
 * @param ctx - registrant context.
 * @param config - client-half configuration.
 * @returns nothing.
 */
export declare function apply(ctx: Context, config: Config): void;
