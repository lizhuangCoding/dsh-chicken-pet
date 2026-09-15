/**
 * Spritesheet geometry and frame timing.
 *
 * The sheet is addressed entirely by index: row order is contractual, so rows
 * are appended, never reordered. Timing is baked here rather than read from the
 * JSON at runtime because the browser bundle cannot fetch a file from the
 * package directory without a host route; the JSON stays as the authoring
 * source of truth and this table is checked against it by the build.
 */
import type { AnimationName } from './brain.ts';
/** One cell's pixel size in the spritesheet. */
export declare const CELL: {
    readonly w: 192;
    readonly h: 208;
};
/** Columns in the spritesheet. */
export declare const COLS = 8;
/**
 * Per-row frame count and durations, indexed by row.
 *
 * Row order matches `scripts/animations.mjs`; `scripts/build-plugin.mjs`
 * regenerates this table from the sprite build so the two cannot drift.
 */
export declare const ROWS: ReadonlyArray<{
    readonly name: AnimationName;
    readonly count: number;
    readonly frames: readonly number[];
}>;
/**
 * Look up a row index by animation name.
 * @param name - animation row name.
 * @returns the row index, or 0 when the name is unknown.
 */
export declare function rowIndex(name: AnimationName): number;
