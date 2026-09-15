/**
 * Preview helpers: render generated frames for inspection.
 *
 * Frames are transparent by design, so previews composite them over a
 * checkerboard; the cell grid stays visible to catch layout regressions.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { Canvas, encodePNG } from './png.mjs'
import { CELL_H, CELL_W } from './chicken.mjs'
import { ROWS, renderRow } from './animations.mjs'

/**
 * Fill a canvas with a transparency checkerboard.
 * @param {Canvas} c - canvas to fill.
 * @param {number} [size] - checker square size in pixels.
 * @returns {void}
 */
export function checker(c, size = 16) {
  const light = [250, 250, 250]
  const dark = [226, 226, 226]
  for (let y = 0; y < c.height; y += size) {
    for (let x = 0; x < c.width; x += size) {
      const on = ((x / size) | 0) + ((y / size) | 0)
      c.rect(x, y, size, size, on % 2 === 0 ? light : dark)
    }
  }
}

/**
 * Blit a frame onto a canvas at an integer scale.
 * @param {Canvas} dst - destination canvas.
 * @param {Canvas} src - frame canvas.
 * @param {number} dx - destination left column.
 * @param {number} dy - destination top row.
 * @param {number} scale - integer magnification.
 * @returns {void}
 */
export function blit(dst, src, dx, dy, scale) {
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const px = src.get(x, y)
      if (px[3] === 0) continue
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) dst.set(dx + x * scale + sx, dy + y * scale + sy, px)
      }
    }
  }
}

/**
 * Render selected rows into one preview image.
 * @param {string} outPath - file to write.
 * @param {string[]} names - row names to include; empty means every row.
 * @param {number} [scale] - integer magnification.
 * @returns {string} the rendered dimensions and byte size.
 */
export function previewRows(outPath, names, scale = 2) {
  const gap = 10
  const picked = ROWS.filter(r => names.length === 0 || names.includes(r.name))
  const width = CELL_W * 8 * scale
  const height = (CELL_H * scale + gap) * picked.length
  const canvas = new Canvas(width, height)
  canvas.rect(0, 0, width, height, [245, 242, 236])
  picked.forEach((row, ri) => {
    renderRow(row).forEach((frame, ci) => {
      blit(canvas, frame, ci * CELL_W * scale, ri * (CELL_H * scale + gap), scale)
    })
  })
  mkdirSync(outPath.slice(0, outPath.lastIndexOf('/')), { recursive: true })
  const buf = encodePNG(canvas)
  writeFileSync(outPath, buf)
  return `${width}x${height} ${(buf.length / 1024).toFixed(0)}KB`
}

/**
 * Render one frame as a magnified close-up over a checkerboard.
 * @param {string} outPath - file to write.
 * @param {string} rowName - row to sample.
 * @param {number} frameIndex - frame within the row.
 * @param {number} [scale] - integer magnification.
 * @returns {string} the rendered dimensions.
 */
export function previewFrame(outPath, rowName, frameIndex, scale = 4) {
  const row = ROWS.find(r => r.name === rowName)
  if (!row) throw new Error(`unknown row: ${rowName}`)
  const frame = renderRow(row)[frameIndex % row.count]
  const canvas = new Canvas(CELL_W * scale, CELL_H * scale)
  checker(canvas, 16)
  blit(canvas, frame, 0, 0, scale)
  mkdirSync(outPath.slice(0, outPath.lastIndexOf('/')), { recursive: true })
  writeFileSync(outPath, encodePNG(canvas))
  return `${CELL_W * scale}x${CELL_H * scale}`
}
