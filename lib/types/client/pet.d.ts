/**
 * The floating pet: a pixel chicken that reacts to the agent and to the person
 * using it.
 *
 * Presentation is plain DOM rather than a React component. The pet is a fixed
 * overlay that owns no layout slot, so keeping it outside React means it mounts
 * in any surface that loads the plugin and never re-renders with the chat. Only
 * the sprite itself accepts pointer events, so it does not block the interface
 * behind it.
 *
 * The sprite is a CSS background positioned by row and column, which keeps the
 * animation loop to one style write per frame.
 */
import type { Context } from '@deepseek-ai/cordis';
import { type Config, type PetSettings } from './config.ts';
/** Shape of the host-provided sheet metadata service. */
export interface SheetInfo {
    url: string;
    hash: string;
    cols: number;
    cellWidth: number;
    cellHeight: number;
    /** Current appearance and behaviour settings, read live. */
    pets?: Partial<Config>;
    /** Subscribe to appearance changes. */
    onSettings?: (listener: (settings: PetSettings) => void) => () => void;
}
/**
 * Apply appearance settings the user changed while the pet is on screen.
 *
 * Size, corner, margins, sound, and the autonomy tuning all take effect
 * immediately, so saving the settings card updates the pet without a reload.
 * @param next - the newly effective settings.
 * @returns nothing.
 */
export interface PetHandle {
    /** Re-apply settings after a change; `enabled` toggles visibility. */
    update(settings: Config): void;
}
/**
 * Mount the pet.
 *
 * Settings come from the host half's service rather than this half's own
 * config: only the host row is composed from the profile patch, so a value
 * placed on that row reaches the browser through here. A host-less mount uses
 * the supplied fallback.
 * @param ctx - registrant context.
 * @param service - the host half's sheet and settings service, when present.
 * @param config - fallback configuration for a host-less mount.
 * @returns a handle for applying later settings changes, or undefined when no DOM is available.
 */
export declare function mountPet(ctx: Context, service: SheetInfo | undefined, config: Config): PetHandle | undefined;
