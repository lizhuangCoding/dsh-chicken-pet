/**
 * The original pixel chicken's anatomy, drawn procedurally.
 *
 * Every frame is composed from the same parametric body so animation stays
 * consistent: a pose is a set of numeric knobs (head bob, wing angle, leg
 * lift, lean, squash) rather than a separately drawn sprite. The chicken is an
 * original design — a round cream-white body, a red comb and wattle, an orange
 * beak, and an orange basketball it can hold, dribble, or shoot.
 *
 * Geometry is expressed in a 192x208 cell with the feet resting near y=190.
 * The body is deliberately large relative to the cell so the pet stays legible
 * at the 96 px size the runtime actually renders.
 */

import { Canvas } from './png.mjs'

/** Cell size used by every animation row of the spritesheet. */
export const CELL_W = 192
export const CELL_H = 208

/** The chicken's palette. */
export const PALETTE = {
  body: [252, 246, 230],
  bodyShade: [228, 214, 186],
  bodyLight: [255, 253, 246],
  comb: [228, 62, 62],
  combShade: [188, 42, 46],
  beak: [246, 166, 42],
  beakShade: [214, 130, 24],
  leg: [238, 152, 48],
  legShade: [200, 118, 28],
  eye: [38, 32, 30],
  eyeWhite: [255, 255, 255],
  outline: [74, 58, 46],
  ball: [226, 110, 46],
  ballLight: [246, 154, 82],
  ballLine: [120, 52, 22],
  shadow: [40, 32, 28, 52],
}

/**
 * Clamp a number into a range.
 * @param {number} v - candidate value.
 * @param {number} lo - lower bound.
 * @param {number} hi - upper bound.
 * @returns {number} the clamped value.
 */
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)

/**
 * Linear interpolation.
 * @param {number} a - value at t=0.
 * @param {number} b - value at t=1.
 * @param {number} t - blend factor.
 * @returns {number} the interpolated value.
 */
const lerp = (a, b, t) => a + (b - a) * t

/**
 * A pose is the complete set of knobs that describe one frame.
 * @typedef {object} Pose
 * @property {number} [bob] - vertical body offset in pixels.
 * @property {number} [lean] - horizontal body offset in pixels.
 * @property {number} [headTilt] - head rotation in degrees.
 * @property {number} [headBob] - head-only vertical offset.
 * @property {number} [wingL] - left wing angle in degrees (0 = folded).
 * @property {number} [wingR] - right wing angle in degrees.
 * @property {number} [legLift] - left leg lift in pixels.
 * @property {number} [legLiftR] - right leg lift in pixels.
 * @property {number} [squash] - vertical scale, 1 = neutral.
 * @property {number} [stretch] - horizontal scale, 1 = neutral.
 * @property {number} [eye] - 0 open, 1 closed, 0.5 half.
 * @property {number} [mouth] - 0 closed, 1 open (cheeping).
 * @property {number} [ballX] - ball X offset from its rest position.
 * @property {number} [ballY] - ball Y offset from its rest position.
 * @property {boolean} [ball] - whether the basketball is drawn.
 * @property {number} [ballSpin] - ball rotation in degrees.
 * @property {number} [ballScale] - ball scale multiplier.
 * @property {number} [tilt] - whole-body rotation in degrees.
 * @property {number} [shadow] - ground shadow scale, 1 = neutral.
 * @property {number} [blush] - blush opacity 0-1.
 * @property {number} [tailLift] - tail feather raise in pixels.
 */

/** Body centre column. */
const BODY_CX = CELL_W / 2
/** Body centre row: high enough to leave room for the legs below. */
const BODY_CY = 134
/** Body radii. */
const BODY_RX = 46
const BODY_RY = 44
/** Head centre, relative to the body centre. */
const HEAD_DX = 0
const HEAD_DY = -46
const HEAD_R = 29
/** Ground line where the feet rest. */
const GROUND = 192

/**
 * Draw the chicken in one pose onto a fresh cell.
 * @param {Pose} [pose] - the pose to draw; omitted properties use neutral values.
 * @returns {Canvas} a `CELL_W` x `CELL_H` canvas holding the chicken.
 */
export function drawChicken(pose = {}) {
  const p = {
    bob: 0,
    lean: 0,
    headTilt: 0,
    headBob: 0,
    wingL: 0,
    wingR: 0,
    legLift: 0,
    legLiftR: 0,
    squash: 1,
    stretch: 1,
    eye: 0,
    mouth: 0,
    ballX: 0,
    ballY: 0,
    ball: false,
    ballSpin: 0,
    ballScale: 1,
    tilt: 0,
    shadow: 1,
    blush: 0,
    tailLift: 0,
    ...pose,
  }

  const shadowCanvas = new Canvas(CELL_W, CELL_H)
  shadowCanvas.ellipse(BODY_CX, GROUND + 2, 52 * p.shadow, 8 * p.shadow, PALETTE.shadow)

  const body = new Canvas(CELL_W, CELL_H)
  const cx = BODY_CX + p.lean
  const cy = BODY_CY + p.bob

  drawLegs(body, cx, cy, p)
  drawTail(body, cx, cy, p)
  drawBody(body, cx, cy, p)
  drawWings(body, cx, cy, p)
  drawHead(body, cx, cy, p)
  if (p.ball) drawBall(body, cx, cy, p)

  const canvas = new Canvas(CELL_W, CELL_H)
  canvas.drawCanvas(shadowCanvas, 0, 0)
  if (p.tilt !== 0) {
    rotateInto(canvas, body, BODY_CX, cy - 30, (p.tilt * Math.PI) / 180)
  } else {
    canvas.drawCanvas(body, 0, 0)
  }
  return canvas
}

/**
 * Composite a canvas onto another rotated about a pivot.
 * @param {Canvas} dst - destination canvas.
 * @param {Canvas} src - source canvas.
 * @param {number} px - pivot column.
 * @param {number} py - pivot row.
 * @param {number} angle - rotation in radians.
 * @returns {void}
 */
function rotateInto(dst, src, px, py, angle) {
  const cos = Math.cos(-angle)
  const sin = Math.sin(-angle)
  for (let y = 0; y < dst.height; y++) {
    for (let x = 0; x < dst.width; x++) {
      const dx = x - px
      const dy = y - py
      const px4 = src.get(Math.round(px + dx * cos - dy * sin), Math.round(py + dx * sin + dy * cos))
      if (px4[3] === 0) continue
      dst.blend(x, y, px4)
    }
  }
}

/**
 * Draw both legs with their feet planted on the ground line.
 * @param {Canvas} c - target canvas.
 * @param {number} cx - body centre column.
 * @param {number} cy - body centre row.
 * @param {Pose} p - resolved pose.
 * @returns {void}
 */
function drawLegs(c, cx, cy, p) {
  const hip = cy + BODY_RY - 8
  const foot = GROUND - 6
  const draw1 = (x, lift) => {
    const fy = foot - lift
    c.line(x, hip, x, fy, 7, PALETTE.leg)
    c.line(x, hip, x, fy - 2, 3, PALETTE.legShade)
    // Three forward toes plus one back toe.
    c.line(x, fy, x - 11, fy + 3, 5, PALETTE.leg)
    c.line(x, fy, x + 2, fy + 5, 5, PALETTE.leg)
    c.line(x, fy, x + 11, fy + 2, 5, PALETTE.leg)
    c.line(x, fy + 2, x - 9, fy + 6, 4, PALETTE.legShade)
  }
  draw1(cx - 13, p.legLift)
  draw1(cx + 13, p.legLiftR)
}

/**
 * Draw the tail as a small upturned fan tucked behind the body.
 *
 * The feathers sit close to the body silhouette: a wide fan reads as a second
 * body at this size, and anything reaching further left collides with the wing.
 * @param {Canvas} c - target canvas.
 * @param {number} cx - body centre column.
 * @param {number} cy - body centre row.
 * @param {Pose} p - resolved pose.
 * @returns {void}
 */
function drawTail(c, cx, cy, p) {
  const baseX = cx - BODY_RX + 6
  const baseY = cy - 20 - p.tailLift
  const sway = p.lean * 0.25
  const feathers = [
    [-16, -18],
    [-24, -4],
    [-18, 10],
  ]
  for (const [dx, dy] of feathers) {
    c.ellipse(baseX + dx + sway, baseY + dy, 15, 9, PALETTE.bodyShade, {
      outline: PALETTE.outline,
      outlineWidth: 1.8,
    })
  }
}

/**
 * Draw the main body shell.
 * @param {Canvas} c - target canvas.
 * @param {number} cx - body centre column.
 * @param {number} cy - body centre row.
 * @param {Pose} p - resolved pose.
 * @returns {void}
 */
function drawBody(c, cx, cy, p) {
  const rx = BODY_RX * p.stretch
  const ry = BODY_RY * p.squash
  c.ellipse(cx, cy, rx, ry, PALETTE.body, { outline: PALETTE.outline, outlineWidth: 2.2 })
  // Upper-left highlight and lower belly shade give the body volume.
  c.ellipse(cx - rx * 0.3, cy - ry * 0.42, rx * 0.44, ry * 0.34, PALETTE.bodyLight)
  c.ellipse(cx + rx * 0.1, cy + ry * 0.5, rx * 0.66, ry * 0.34, PALETTE.bodyShade)
}

/**
 * Draw the head, comb, beak, eyes, and wattle.
 * @param {Canvas} c - target canvas.
 * @param {number} cx - body centre column.
 * @param {number} cy - body centre row.
 * @param {Pose} p - resolved pose.
 * @returns {void}
 */
function drawHead(c, cx, cy, p) {
  const hx = cx + HEAD_DX + Math.sin((p.headTilt * Math.PI) / 180) * 14
  const hy = cy + HEAD_DY + p.headBob
  const r = HEAD_R

  // Comb: three bumps sitting on the crown.
  const combY = hy - r + 6
  for (let i = -1; i <= 1; i++) {
    const bumpR = i === 0 ? 9 : 7.5
    c.ellipse(hx + i * 10, combY - (i === 0 ? 7 : 3), bumpR, i === 0 ? 10 : 8, PALETTE.comb, {
      outline: PALETTE.outline,
      outlineWidth: 1.6,
    })
  }

  c.ellipse(hx, hy, r, r * 1.03, PALETTE.body, { outline: PALETTE.outline, outlineWidth: 2.2 })
  c.ellipse(hx - r * 0.3, hy - r * 0.35, r * 0.4, r * 0.3, PALETTE.bodyLight)

  const eyeY = hy - 3
  for (const sx of [-1, 1]) {
    const ex = hx + sx * 11
    if (p.eye >= 1) {
      // Closed: a happy downward arc reads better than a flat line.
      for (let k = -5; k <= 5; k++) {
        c.set(ex + k, eyeY + Math.round(Math.abs(k) * 0.45), PALETTE.eye)
        c.set(ex + k, eyeY + Math.round(Math.abs(k) * 0.45) + 1, PALETTE.eye)
      }
    } else if (p.eye > 0) {
      const open = 1 - p.eye
      c.ellipse(ex, eyeY, 5.5, 5.5 * open + 1.2, PALETTE.eye)
    } else {
      c.ellipse(ex, eyeY, 6, 6.5, PALETTE.eyeWhite, {
        outline: PALETTE.outline,
        outlineWidth: 1.4,
      })
      c.ellipse(ex + 0.8, eyeY + 0.4, 3.8, 4.6, PALETTE.eye)
      c.ellipse(ex + 2.2, eyeY - 1.8, 1.6, 1.8, PALETTE.eyeWhite)
    }
  }

  // Beak: a small upper wedge and a lower mandible that opens with `mouth`.
  const beakY = hy + 9
  const open = p.mouth * 8
  c.polygon(
    [
      [hx - 6, beakY - 4],
      [hx + 14, beakY - 1],
      [hx - 6, beakY + 1],
    ],
    PALETTE.beak,
  )
  c.polygon(
    [
      [hx - 6, beakY + 1 + open * 0.5],
      [hx + 11, beakY + 1 + open],
      [hx - 6, beakY + 4 + open],
    ],
    PALETTE.beakShade,
  )
  for (let x = -6; x <= 14; x++) {
    c.set(hx + x, beakY - 4 + Math.round((x + 6) * 0.15), PALETTE.outline)
  }

  // Wattle, tucked under the beak rather than covering it.
  c.ellipse(hx + 3, beakY + 12, 5.5, 7.5, PALETTE.comb, {
    outline: PALETTE.outline,
    outlineWidth: 1.6,
  })

  if (p.blush > 0) {
    const a = Math.round(150 * clamp(p.blush, 0, 1))
    c.ellipse(hx - 17, hy + 4, 8, 5, [246, 150, 150, a])
    c.ellipse(hx + 19, hy + 4, 8, 5, [246, 150, 150, a])
  }
}

/**
 * Draw both wings. A negative angle raises a wing; the shoulder stays fixed.
 *
 * The shoulder sits on the body edge and slightly forward, so a folded wing
 * lies along the body instead of sticking out sideways.
 * @param {Canvas} c - target canvas.
 * @param {number} cx - body centre column.
 * @param {number} cy - body centre row.
 * @param {Pose} p - resolved pose.
 * @returns {void}
 */
function drawWings(c, cx, cy, p) {
  const shoulderY = cy - 4
  drawWing(c, cx - BODY_RX + 8, shoulderY, -1, p.wingL)
  drawWing(c, cx + BODY_RX - 8, shoulderY, 1, p.wingR)
}

/**
 * Draw one wing as a tapered teardrop rotated about its shoulder joint.
 * @param {Canvas} c - target canvas.
 * @param {number} sx - shoulder column.
 * @param {number} sy - shoulder row.
 * @param {number} dir - -1 for the left wing, 1 for the right.
 * @param {number} angle - rotation in degrees; negative raises the wing.
 * @returns {void}
 */
function drawWing(c, sx, sy, dir, angle) {
  // Folded wings hang down and slightly back; the offset biases them inboard
  // so their outline merges with the body rather than floating beside it.
  const rad = ((angle + 62) * Math.PI) / 180
  const len = 30
  const tipX = sx + dir * Math.cos(rad) * len * 0.55
  const tipY = sy + Math.sin(rad) * len
  const mx = (sx + tipX) / 2
  const my = (sy + tipY) / 2
  const rx = 13 + Math.abs(Math.cos(rad)) * 4
  const ry = Math.max(15, len * 0.58)
  c.ellipse(mx, my, rx, ry, PALETTE.body, {
    outline: PALETTE.outline,
    outlineWidth: 2,
  })
  c.ellipse(mx, my + ry * 0.3, rx * 0.62, ry * 0.42, PALETTE.bodyShade)
}

/**
 * Draw the basketball with spinning seams.
 * @param {Canvas} c - target canvas.
 * @param {number} cx - body centre column.
 * @param {number} cy - body centre row.
 * @param {Pose} p - resolved pose.
 * @returns {void}
 */
function drawBall(c, cx, cy, p) {
  const bx = cx + 46 + p.ballX
  const by = cy + 20 + p.ballY
  const r = 15 * p.ballScale

  c.ellipse(bx, by, r, r, PALETTE.ball, { outline: PALETTE.outline, outlineWidth: 2 })
  c.ellipse(bx - r * 0.32, by - r * 0.38, r * 0.34, r * 0.28, PALETTE.ballLight)

  const spin = (p.ballSpin * Math.PI) / 180
  // Seam through the poles, rotated by the spin.
  c.line(
    bx - Math.sin(spin) * r * 0.92,
    by - Math.cos(spin) * r * 0.92,
    bx + Math.sin(spin) * r * 0.92,
    by + Math.cos(spin) * r * 0.92,
    2,
    PALETTE.ballLine,
  )
  // Equator seam drawn as an ellipse squashed by the spin angle.
  const steps = 20
  let prev = null
  for (let i = 0; i <= steps; i++) {
    const a = Math.PI * (i / steps)
    const px = bx - Math.cos(a) * r * 0.92 * (0.35 + 0.65 * Math.abs(Math.sin(spin)))
    const py = by + Math.sin(a) * r * 0.5
    if (prev) c.line(prev[0], prev[1], px, py, 2, PALETTE.ballLine)
    prev = [px, py]
  }
}

/**
 * Blend two poses, used to build smooth in-between frames.
 * @param {Pose} a - pose at t=0.
 * @param {Pose} b - pose at t=1.
 * @param {number} t - blend factor.
 * @returns {Pose} the interpolated pose.
 */
export function mixPose(a, b, t) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  const out = {}
  for (const k of keys) {
    const av = a[k]
    const bv = b[k]
    if (typeof av === 'number' && typeof bv === 'number') out[k] = lerp(av, bv, t)
    else out[k] = t < 0.5 ? av : bv
  }
  return out
}
