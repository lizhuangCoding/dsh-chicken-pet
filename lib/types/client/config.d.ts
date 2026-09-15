/**
 * The pet's configuration type, defaults, and shared stylesheet.
 *
 * Settings are owned by the host half and reach this side over its service.
 * This module only carries the type, the fallback defaults for a host-less
 * mount, and the styles the pet and its settings card share.
 *
 * `@deepseek-ai/schemastery` must NOT be imported here. The shell resolves only
 * its platform modules, so a value import of anything else throws while the
 * bundle loads — and because DSH serves a batch of plugins as one response,
 * that failure unregisters every plugin in the batch.
 */
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
/** The appearance and behaviour fields the pet reads. */
export type PetSettings = Config;
/**
 * Defaults used when no host half supplies settings.
 *
 * These are plain values rather than a schema: the host validates user config
 * with schemastery, and this half only needs a fallback for a host-less mount.
 * @returns a complete configuration with every field defaulted.
 */
export declare function defaultConfig(): Config;
/** Stylesheet installed once per plugin activation. */
export declare const STYLES = "\n.cdp-root {\n  position: fixed;\n  z-index: 40;\n  pointer-events: none;\n  user-select: none;\n  -webkit-user-select: none;\n  touch-action: none;\n}\n.cdp-sprite {\n  position: relative;\n  pointer-events: auto;\n  cursor: grab;\n  background-repeat: no-repeat;\n  image-rendering: pixelated;\n  filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.18));\n  transition: transform 120ms ease-out;\n}\n.cdp-sprite:active { cursor: grabbing; }\n.cdp-root[data-dragging='true'] .cdp-sprite { transform: scale(1.04); }\n.cdp-bubble {\n  position: absolute;\n  left: 50%;\n  bottom: 100%;\n  transform: translateX(-50%);\n  margin-bottom: 6px;\n  padding: 5px 10px;\n  border-radius: 12px;\n  background: rgba(255, 255, 255, 0.97);\n  color: #2b2520;\n  border: 1px solid rgba(74, 58, 46, 0.14);\n  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.13);\n  font: 500 12px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;\n  white-space: nowrap;\n  pointer-events: none;\n  opacity: 0;\n  transition: opacity 160ms ease-out;\n}\n.cdp-bubble[data-visible='true'] { opacity: 1; }\n.cdp-bubble::after {\n  content: '';\n  position: absolute;\n  top: 100%;\n  left: 50%;\n  transform: translateX(-50%);\n  border: 6px solid transparent;\n  border-top-color: rgba(255, 255, 255, 0.97);\n}\n@media (prefers-color-scheme: dark) {\n  .cdp-bubble {\n    background: rgba(38, 34, 30, 0.97);\n    color: #f4efe6;\n    border-color: rgba(255, 255, 255, 0.12);\n  }\n  .cdp-bubble::after { border-top-color: rgba(38, 34, 30, 0.97); }\n}\n@media (prefers-reduced-motion: reduce) {\n  .cdp-sprite { transition: none; }\n}\n";
