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
    /** Serve the spritesheet route. Turn off to run the pet with a cached sheet only. */
    serveAssets: boolean;
    /** Poll interval for the agent-state fallback, in milliseconds. */
    pollMs: number;
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
