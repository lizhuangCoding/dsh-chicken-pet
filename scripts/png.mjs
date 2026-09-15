/**
 * Minimal dependency-free PNG encoder and software rasterizer.
 *
 * The pet spritesheet is pixel art generated per pixel, so a full imaging
 * library would only add weight. This module writes RGBA8 PNGs directly
 * (zlib ships with Node) and provides the drawing primitives the sprite
 * generator needs.
 */

import { deflateSync } from 'node:zlib'

/** CRC-32 lookup table for PNG chunk checksums. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

/**
 * Compute the CRC-32 checksum of a buffer.
 * @param {Buffer} buf - bytes to checksum.
 * @returns {number} the unsigned CRC-32 value.
 */
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/**
 * Wrap a payload in one PNG chunk.
 * @param {string} type - four-character chunk type.
 * @param {Buffer} data - chunk payload.
 * @returns {Buffer} the complete chunk including length and CRC.
 */
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}

/** A mutable RGBA pixel canvas. */
export class Canvas {
  /**
   * @param {number} width - canvas width in pixels.
   * @param {number} height - canvas height in pixels.
   */
  constructor(width, height) {
    this.width = width
    this.height = height
    /** Row-major RGBA bytes; fully transparent on construction. */
    this.data = Buffer.alloc(width * height * 4, 0)
  }

  /**
   * Read one pixel.
   * @param {number} x - column index.
   * @param {number} y - row index.
   * @returns {number[]} `[r, g, b, a]`, transparent when out of bounds.
   */
  get(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return [0, 0, 0, 0]
    const i = (y * this.width + x) * 4
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]]
  }

  /**
   * Write one pixel, replacing the existing value.
   * @param {number} x - column index.
   * @param {number} y - row index.
   * @param {number[]} rgba - channel values, each 0-255; alpha defaults to 255.
   * @returns {void}
   */
  set(x, y, rgba) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return
    const i = (y * this.width + x) * 4
    this.data[i] = rgba[0]
    this.data[i + 1] = rgba[1]
    this.data[i + 2] = rgba[2]
    this.data[i + 3] = rgba[3] === undefined ? 255 : rgba[3]
  }

  /**
   * Composite one pixel over the existing value with source-over alpha.
   * @param {number} x - column index.
   * @param {number} y - row index.
   * @param {number[]} rgba - source channels; alpha 0-255.
   * @returns {void}
   */
  blend(x, y, rgba) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return
    const srcA = rgba[3] === undefined ? 255 : rgba[3]
    if (srcA === 0) return
    if (srcA === 255) return this.set(x, y, rgba)
    const i = (y * this.width + x) * 4
    const dstA = this.data[i + 3] / 255
    const outA = srcA / 255 + dstA * (1 - srcA / 255)
    const srcF = srcA / 255
    for (let c = 0; c < 3; c++) {
      this.data[i + c] = Math.round(
        (rgba[c] * srcF + this.data[i + c] * dstA * (1 - srcF)) / outA,
      )
    }
    this.data[i + 3] = Math.round(outA * 255)
  }

  /**
   * Fill an axis-aligned rectangle.
   * @param {number} x - left column.
   * @param {number} y - top row.
   * @param {number} w - width in pixels.
   * @param {number} h - height in pixels.
   * @param {number[]} rgba - fill colour.
   * @returns {void}
   */
  rect(x, y, w, h, rgba) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.blend(x + i, y + j, rgba)
  }

  /**
   * Fill an ellipse, optionally with an outline ring.
   * @param {number} cx - centre column.
   * @param {number} cy - centre row.
   * @param {number} rx - horizontal radius.
   * @param {number} ry - vertical radius.
   * @param {number[]} rgba - fill colour.
   * @param {object} [opts] - `squash` scales the lower half; `outline` draws a ring.
   * @returns {void}
   */
  ellipse(cx, cy, rx, ry, rgba, opts = {}) {
    const squash = opts.squash === undefined ? 1 : opts.squash
    const x0 = Math.floor(cx - rx - 2)
    const x1 = Math.ceil(cx + rx + 2)
    const y0 = Math.floor(cy - ry - 2)
    const y1 = Math.ceil(cy + ry + 2)
    const inside = (x, y) => {
      const dx = (x + 0.5 - cx) / rx
      const ryEff = y + 0.5 > cy ? ry * squash : ry
      const dy = (y + 0.5 - cy) / ryEff
      return dx * dx + dy * dy
    }
    if (opts.outline) {
      const w = opts.outlineWidth === undefined ? 2 : opts.outlineWidth
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const d = inside(x, y)
          if (d > 1 && d <= 1 + w * 0.35) this.blend(x, y, opts.outline)
        }
      }
    }
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (inside(x, y) <= 1) this.blend(x, y, rgba)
      }
    }
  }

  /**
   * Draw a straight line with round caps.
   * @param {number} x0 - start column.
   * @param {number} y0 - start row.
   * @param {number} x1 - end column.
   * @param {number} y1 - end row.
   * @param {number} thickness - stroke width in pixels.
   * @param {number[]} rgba - stroke colour.
   * @returns {void}
   */
  line(x0, y0, x1, y1, thickness, rgba) {
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2))
    const r = thickness / 2
    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      const x = x0 + (x1 - x0) * t
      const y = y0 + (y1 - y0) * t
      for (let j = Math.floor(y - r); j <= Math.ceil(y + r); j++) {
        for (let i = Math.floor(x - r); i <= Math.ceil(x + r); i++) {
          if (Math.hypot(i + 0.5 - x, j + 0.5 - y) <= r) this.blend(i, j, rgba)
        }
      }
    }
  }

  /**
   * Fill a convex polygon with the even-odd scanline rule.
   * @param {number[][]} points - vertices as `[x, y]` pairs.
   * @param {number[]} rgba - fill colour.
   * @returns {void}
   */
  polygon(points, rgba) {
    let minY = Infinity
    let maxY = -Infinity
    for (const [, y] of points) {
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const crossings = []
      for (let i = 0; i < points.length; i++) {
        const [ax, ay] = points[i]
        const [bx, by] = points[(i + 1) % points.length]
        if (ay === by) continue
        const yc = y + 0.5
        if ((yc >= ay && yc < by) || (yc >= by && yc < ay)) {
          crossings.push(ax + ((yc - ay) / (by - ay)) * (bx - ax))
        }
      }
      crossings.sort((a, b) => a - b)
      for (let i = 0; i + 1 < crossings.length; i += 2) {
        for (let x = Math.ceil(crossings[i] - 0.5); x <= Math.floor(crossings[i + 1] - 0.5); x++) {
          this.blend(x, y, rgba)
        }
      }
    }
  }

  /**
   * Copy another canvas onto this one at an offset.
   * @param {Canvas} src - source canvas.
   * @param {number} dx - destination left column.
   * @param {number} dy - destination top row.
   * @returns {void}
   */
  drawCanvas(src, dx, dy) {
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        this.blend(dx + x, dy + y, src.get(x, y))
      }
    }
  }
}

/**
 * Encode a canvas as an RGBA8 PNG.
 * @param {Canvas} canvas - the canvas to encode.
 * @returns {Buffer} the complete PNG file bytes.
 */
export function encodePNG(canvas) {
  const { width, height, data } = canvas
  const stride = width * 4 + 1
  const raw = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0 // filter type None
    data.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
