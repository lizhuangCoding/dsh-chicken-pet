/**
 * Spritesheet geometry and frame timing.
 *
 * The sheet is addressed entirely by index: row order is contractual, so rows
 * are appended, never reordered. Timing is baked here rather than read from the
 * JSON at runtime because the browser bundle cannot fetch a file from the
 * package directory without a host route; the JSON stays as the authoring
 * source of truth and this table is checked against it by the build.
 */

import type { AnimationName } from './brain.ts'

/** One cell's pixel size in the spritesheet. */
export const CELL = { w: 192, h: 208 } as const

/** Columns in the spritesheet. */
export const COLS = 8

/**
 * Per-row frame count and durations, indexed by row.
 *
 * Row order matches `scripts/animations.mjs`; `scripts/build-plugin.mjs`
 * regenerates this table from the sprite build so the two cannot drift.
 */
export const ROWS: ReadonlyArray<{
  readonly name: AnimationName
  readonly count: number
  readonly frames: readonly number[]
}> = [
  { name: 'idle', count: 6, frames: [280, 110, 110, 140, 140, 320] },
  { name: 'walk-right', count: 8, frames: [110, 110, 110, 110, 110, 110, 110, 200] },
  { name: 'walk-left', count: 8, frames: [110, 110, 110, 110, 110, 110, 110, 200] },
  { name: 'wave', count: 6, frames: [140, 140, 140, 140, 140, 260] },
  { name: 'jump', count: 8, frames: [110, 110, 130, 150, 150, 130, 110, 200] },
  { name: 'dribble', count: 6, frames: [110, 110, 110, 110, 110, 200] },
  { name: 'spin-ball', count: 6, frames: [140, 140, 140, 140, 140, 240] },
  { name: 'shoot', count: 8, frames: [130, 130, 130, 130, 150, 150, 170, 240] },
  { name: 'sleep', count: 6, frames: [420, 320, 320, 420, 320, 420] },
  { name: 'startle', count: 6, frames: [90, 90, 90, 90, 110, 200] },
  { name: 'sad', count: 6, frames: [200, 200, 200, 200, 200, 320] },
  { name: 'wait', count: 6, frames: [200, 180, 180, 180, 180, 300] },
  { name: 'flap', count: 6, frames: [120, 120, 120, 120, 120, 200] },
  { name: 'pace', count: 8, frames: [140, 140, 140, 140, 140, 140, 140, 200] },
  { name: 'ruffle', count: 6, frames: [90, 90, 90, 90, 90, 180] },
  { name: 'look', count: 6, frames: [260, 200, 200, 200, 200, 300] },
  { name: 'peck', count: 6, frames: [150, 120, 180, 150, 120, 220] },
  { name: 'think', count: 6, frames: [240, 200, 200, 200, 200, 320] },
  { name: 'work', count: 6, frames: [110, 110, 110, 110, 110, 200] },
  { name: 'celebrate', count: 8, frames: [110, 110, 110, 110, 110, 110, 140, 220] },
]

/**
 * Look up a row index by animation name.
 * @param name - animation row name.
 * @returns the row index, or 0 when the name is unknown.
 */
export function rowIndex(name: AnimationName): number {
  const index = ROWS.findIndex(row => row.name === name)
  return index < 0 ? 0 : index
}
