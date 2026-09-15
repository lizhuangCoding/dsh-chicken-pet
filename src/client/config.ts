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
  enabled: boolean
  /** Resting corner before the user drags it. */
  corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  /** Horizontal margin from the corner, in CSS pixels. */
  marginX: number
  /** Vertical margin from the corner, in CSS pixels. */
  marginY: number
  /** Rendered width in CSS pixels; height follows the cell aspect ratio. */
  size: number
  /** Play a short chirp when the agent answers. */
  sound: boolean
  /** Chirp volume, 0 to 1. */
  volume: number
  /** Shortest gap between idle behaviour rolls, in seconds. */
  idleMinSec: number
  /** Longest gap between idle behaviour rolls, in seconds. */
  idleMaxSec: number
  /** How often the chicken does something rather than standing still, 0 to 1. */
  liveliness: number
}

/** The appearance and behaviour fields the pet reads. */
export type PetSettings = Config

/**
 * Defaults used when no host half supplies settings.
 *
 * These are plain values rather than a schema: the host validates user config
 * with schemastery, and this half only needs a fallback for a host-less mount.
 * @returns a complete configuration with every field defaulted.
 */
export function defaultConfig(): Config {
  return {
    enabled: true,
    corner: 'bottom-right',
    marginX: 24,
    marginY: 24,
    size: 128,
    sound: true,
    volume: 0.85,
    idleMinSec: 4,
    idleMaxSec: 12,
    liveliness: 0.75,
  }
}

/** Stylesheet installed once per plugin activation. */
export const STYLES = `
.cdp-root {
  position: fixed;
  z-index: 40;
  pointer-events: none;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
}
.cdp-sprite {
  position: relative;
  pointer-events: auto;
  cursor: grab;
  background-repeat: no-repeat;
  image-rendering: pixelated;
  filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.18));
  transition: transform 120ms ease-out;
}
.cdp-sprite:active { cursor: grabbing; }
.cdp-root[data-dragging='true'] .cdp-sprite { transform: scale(1.04); }
.cdp-bubble {
  position: absolute;
  left: 50%;
  bottom: 100%;
  transform: translateX(-50%);
  margin-bottom: 6px;
  padding: 5px 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.97);
  color: #2b2520;
  border: 1px solid rgba(74, 58, 46, 0.14);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.13);
  font: 500 12px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 160ms ease-out;
}
.cdp-bubble[data-visible='true'] { opacity: 1; }
.cdp-bubble::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: rgba(255, 255, 255, 0.97);
}
@media (prefers-color-scheme: dark) {
  .cdp-bubble {
    background: rgba(38, 34, 30, 0.97);
    color: #f4efe6;
    border-color: rgba(255, 255, 255, 0.12);
  }
  .cdp-bubble::after { border-top-color: rgba(38, 34, 30, 0.97); }
}
@media (prefers-reduced-motion: reduce) {
  .cdp-sprite { transition: none; }
}
`
