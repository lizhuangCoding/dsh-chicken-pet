/**
 * Build the pet spritesheet and its metadata.
 *
 * Output layout follows the Codex pet contract: 8 columns by N rows, each cell
 * `CELL_W` x `CELL_H`, unused cells fully transparent. The accompanying JSON
 * carries the frame counts and per-frame durations so the runtime never
 * hardcodes timing.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Canvas, encodePNG } from './png.mjs'
import { CELL_H, CELL_W } from './chicken.mjs'
import { ROWS, renderRow } from './animations.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const COLS = 8

const sheetW = CELL_W * COLS
const sheetH = CELL_H * ROWS.length
const sheet = new Canvas(sheetW, sheetH)

const meta = { cell: { w: CELL_W, h: CELL_H }, cols: COLS, rows: [] }

ROWS.forEach((row, rowIndex) => {
  const frames = renderRow(row)
  frames.forEach((frame, col) => {
    sheet.drawCanvas(frame, col * CELL_W, rowIndex * CELL_H)
  })
  meta.rows.push({ index: rowIndex, name: row.name, count: row.count, frames: row.frames })
  process.stdout.write(`  row ${String(rowIndex).padStart(2)}  ${row.name.padEnd(12)} ${row.count} frames\n`)
})

mkdirSync(join(root, 'assets'), { recursive: true })
const png = encodePNG(sheet)
writeFileSync(join(root, 'assets', 'spritesheet.png'), png)
writeFileSync(join(root, 'assets', 'spritesheet.json'), JSON.stringify(meta, null, 2) + '\n')

const kb = (png.length / 1024).toFixed(1)
console.log(`\nspritesheet.png  ${sheetW}x${sheetH}  ${kb} KB  (${ROWS.length} rows x ${COLS} cols)`)
console.log('spritesheet.json written')
