/**
 * The animation library: named rows of posed frames.
 *
 * Each row is 8 cells wide at most, matching the Codex spritesheet contract so
 * pet packs built for that format stay interchangeable. A row is defined as a
 * function of frame index, which keeps looping animations cheap to author and
 * makes the motion read as continuous rather than as a set of stills.
 */

import { drawChicken, mixPose } from './chicken.mjs'

/**
 * An animation row: a name, a frame count, per-frame durations, and a pose
 * function evaluated for each frame index.
 * @typedef {object} Row
 * @property {string} name - stable row identifier.
 * @property {number} count - number of frames actually used (1-8).
 * @property {number[]} frames - per-frame duration in milliseconds.
 * @property {(i: number, n: number) => object} pose - pose for frame `i` of `n`.
 */

/** Neutral standing pose used as the base for most rows. */
const STAND = { bob: 0, eye: 0, wingL: 0, wingR: 0 }

/**
 * Build a breathing idle: a slow rise and fall with an occasional blink.
 * @param {number} i - frame index.
 * @param {number} n - frame count.
 * @returns {object} the pose for this frame.
 */
const idlePose = (i, n) => {
  const t = i / n
  return {
    ...STAND,
    bob: Math.sin(t * Math.PI * 2) * 2.5,
    squash: 1 + Math.sin(t * Math.PI * 2) * 0.02,
    headBob: Math.sin(t * Math.PI * 2 + 0.6) * 1.5,
    // blink on the last frame of the loop
    eye: i === n - 1 ? 1 : 0,
  }
}

/**
 * Walking: legs alternate, the body bobs, and the tail sways.
 * @param {number} i - frame index.
 * @param {number} n - frame count.
 * @returns {object} the pose for this frame.
 */
const walkPose = (i, n) => {
  const t = (i / n) * Math.PI * 2
  return {
    ...STAND,
    legLift: Math.max(0, Math.sin(t)) * 12,
    legLiftR: Math.max(0, Math.sin(t + Math.PI)) * 12,
    bob: Math.abs(Math.sin(t)) * -3,
    lean: Math.sin(t * 2) * 1.5,
    wingL: 12,
    wingR: 12,
  }
}

/**
 * Cheerful wing flap, both wings raised and beating.
 * @param {number} i - frame count.
 * @param {number} n - frame count.
 * @returns {object} the pose for this frame.
 */
const flapPose = (i, n) => {
  const t = (i / n) * Math.PI * 2
  return {
    ...STAND,
    wingL: -20 + Math.sin(t) * 26,
    wingR: -20 + Math.sin(t) * 26,
    bob: Math.sin(t) * 4,
    eye: 0,
  }
}

/**
 * Dribbling: one wing pats a bouncing ball beside the body.
 * @param {number} i - frame index.
 * @param {number} n - frame count.
 * @returns {object} the pose for this frame.
 */
const dribblePose = (i, n) => {
  const t = (i / n) * Math.PI * 2
  const bounce = Math.abs(Math.sin(t))
  return {
    ...STAND,
    ball: true,
    ballX: 4,
    ballY: -bounce * 44 + 30,
    ballScale: 1 + (1 - bounce) * 0.08,
    wingR: 26 + bounce * 12,
    bob: bounce * -2,
  }
}

/**
 * Spinning the ball on a raised wing tip.
 * @param {number} i - frame index.
 * @param {number} n - frame count.
 * @returns {object} the pose for this frame.
 */
const spinPose = (i, n) => {
  const t = (i / n) * Math.PI * 2
  return {
    ...STAND,
    ball: true,
    ballX: 8,
    ballY: -68,
    ballSpin: (i / n) * 360,
    wingR: -52,
    headTilt: Math.sin(t) * 5,
    bob: Math.sin(t) * 2,
    blush: 0.5,
  }
}

/**
 * Jumping: a crouch, a launch, airborne, and a landing squash.
 * @param {number} i - frame index.
 * @param {number} n - frame count.
 * @returns {object} the pose for this frame.
 */
const jumpPose = (i, n) => {
  const arc = [-2, 6, 20, 32, 26, 12, -6, 0][i % 8]
  const crouch = [-6, -4, 0, 0, 0, 0, 3, 0][i % 8]
  return {
    ...STAND,
    bob: -arc + crouch,
    squash: 1 + crouch * 0.03,
    stretch: 1 - crouch * 0.02,
    legLift: arc > 4 ? 8 : 0,
    legLiftR: arc > 4 ? 6 : 0,
    wingL: -30 - arc * 0.8,
    wingR: -30 - arc * 0.8,
    shadow: Math.max(0.45, 1 - arc * 0.015),
    eye: 0,
    mouth: arc > 20 ? 1 : 0,
    ball: i >= 2 && i <= 5,
    ballY: -arc - 34,
    ballX: 10,
    ballScale: 0.85,
  }
}

/**
 * A shooting celebration: the ball arcs away and the chicken cheers.
 * @param {number} i - frame index.
 * @param {number} n - frame count.
 * @returns {object} the pose for this frame.
 */
const shootPose = (i, n) => {
  if (i < 3) {
    // wind up and release
    return {
      ...STAND,
      bob: i * 3,
      wingL: -40 - i * 12,
      wingR: -40 - i * 12,
      ball: true,
      ballX: 10,
      ballY: -56 - i * 10,
      ballScale: 0.9,
      mouth: 1,
    }
  }
  const t = (i - 3) / Math.max(1, n - 3)
  return {
    ...STAND,
    bob: -Math.sin(t * Math.PI) * 12,
    wingL: -70,
    wingR: -70,
    ball: true,
    ballX: 40 + t * 120,
    ballY: -120 - Math.sin(t * Math.PI) * 40 + t * 60,
    ballScale: 0.9 - t * 0.5,
    ballSpin: t * 540,
    mouth: 1,
    blush: 1,
    shadow: 0.7,
  }
}

/**
 * Sleepy: eyes closed, head drooping, a slow deep breath.
 * @param {number} i - frame index.
 * @param {number} n - frame count.
 * @returns {object} the pose for this frame.
 */
const sleepPose = (i, n) => {
  const t = (i / n) * Math.PI * 2
  return {
    ...STAND,
    eye: 1,
    headBob: 6 + Math.sin(t) * 2,
    headTilt: 8,
    bob: 3 + Math.sin(t) * 1.5,
    squash: 1.03,
  }
}

/**
 * Startled: a sharp recoil with wide eyes and raised wings.
 * @param {number} i - frame index.
 * @param {number} n - frame count.
 * @returns {object} the pose for this frame.
 */
const startlePose = (i, n) => {
  const shake = [0, -5, 5, -4, 4, -2, 1, 0][i % 8]
  return {
    ...STAND,
    lean: shake,
    bob: -6,
    wingL: -60,
    wingR: -60,
    mouth: 1,
    tilt: shake * 0.6,
    stretch: 1.06,
    squash: 0.96,
  }
}

/**
 * Dejected: drooping head, wings down, a small sigh.
 * @param {number} i - frame index.
 * @param {number} n - frame count.
 * @returns {object} the pose for this frame.
 */
const sadPose = (i, n) => {
  const t = (i / n) * Math.PI * 2
  return {
    ...STAND,
    eye: 0.55,
    headBob: 7 + Math.sin(t) * 1.5,
    bob: 3,
    squash: 1.02,
    wingL: 8,
    wingR: 8,
  }
}

/**
 * Waiting expectantly: leaning forward, head turning side to side.
 * @param {number} i - frame index.
 * @param {number} n - frame count.
 * @returns {object} the pose for this frame.
 */
const waitPose = (i, n) => {
  const t = (i / n) * Math.PI * 2
  return {
    ...STAND,
    headTilt: Math.sin(t) * 16,
    lean: 3,
    bob: Math.sin(t * 2) * 2,
    eye: 0,
    blush: 0.4,
  }
}

/**
 * Greeting wave with the right wing, left wing held out.
 * @param {number} i - frame index.
 * @param {number} n - frame count.
 * @returns {object} the pose for this frame.
 */
const wavePose = (i, n) => {
  const t = (i / n) * Math.PI * 2
  return {
    ...STAND,
    wingR: -78 + Math.sin(t * 2) * 18,
    wingL: 10,
    headTilt: Math.sin(t) * 6,
    bob: Math.sin(t * 2) * 2,
    mouth: 0.5,
    blush: 0.6,
  }
}

/**
 * Pacing left and right on the spot.
 * @param {number} i - frame index.
 * @param {number} n - frame count.
 * @returns {object} the pose for this frame.
 */
const pacePose = (i, n) => {
  const t = (i / n) * Math.PI * 2
  return {
    ...STAND,
    lean: Math.sin(t) * 10,
    legLift: Math.max(0, Math.sin(t * 2)) * 8,
    legLiftR: Math.max(0, Math.sin(t * 2 + Math.PI)) * 8,
    headTilt: Math.sin(t) * 10,
    bob: Math.abs(Math.sin(t * 2)) * -2,
  }
}

/**
 * Shaking the whole body out, like ruffling feathers.
 * @param {number} i - frame index.
 * @param {number} n - frame count.
 * @returns {object} the pose for this frame.
 */
const rufflePose = (i, n) => {
  const shake = Math.sin((i / n) * Math.PI * 8) * 6
  return {
    ...STAND,
    lean: shake,
    tilt: shake * 1.4,
    stretch: 1 + Math.abs(shake) * 0.012,
    wingL: -18 + shake,
    wingR: -18 - shake,
    eye: 0.5,
  }
}

/**
 * Looking around: the head sweeps left, then right.
 * @param {number} i - frame index.
 * @param {number} n - frame count.
 * @returns {object} the pose for this frame.
 */
const lookPose = (i, n) => {
  const t = i / n
  const sweep = Math.sin(t * Math.PI * 2)
  return {
    ...STAND,
    headTilt: sweep * 24,
    lean: sweep * 2,
    bob: Math.sin(t * Math.PI * 4) * 1.2,
  }
}

/**
 * Pecking at the ground, three quick dips.
 * @param {number} i - frame index.
 * @param {number} n - frame count.
 * @returns {object} the pose for this frame.
 */
const peckPose = (i, n) => {
  const dip = i < 3 ? [0, 12, 4][i] : i < 6 ? [0, 12, 4][i - 3] : 0
  return {
    ...STAND,
    headBob: dip,
    bob: dip * 0.25,
    squash: 1 + dip * 0.004,
  }
}

/**
 * Every animation row, in spritesheet order.
 *
 * The order is contractual: the browser addresses a row by index, so rows are
 * only ever appended, never reordered or removed.
 * @type {Row[]}
 */
export const ROWS = [
  { name: 'idle', count: 6, frames: [280, 110, 110, 140, 140, 320], pose: idlePose },
  { name: 'walk-right', count: 8, frames: [110, 110, 110, 110, 110, 110, 110, 200], pose: walkPose },
  { name: 'walk-left', count: 8, frames: [110, 110, 110, 110, 110, 110, 110, 200], pose: (i, n) => walkPose(n - 1 - i, n) },
  { name: 'wave', count: 6, frames: [140, 140, 140, 140, 140, 260], pose: wavePose },
  { name: 'jump', count: 8, frames: [110, 110, 130, 150, 150, 130, 110, 200], pose: jumpPose },
  { name: 'dribble', count: 6, frames: [110, 110, 110, 110, 110, 200], pose: dribblePose },
  { name: 'spin-ball', count: 6, frames: [140, 140, 140, 140, 140, 240], pose: spinPose },
  { name: 'shoot', count: 8, frames: [130, 130, 130, 150, 150, 170, 190, 240], pose: shootPose },
  { name: 'sleep', count: 6, frames: [420, 320, 320, 420, 320, 420], pose: sleepPose },
  { name: 'startle', count: 6, frames: [90, 90, 90, 90, 110, 200], pose: startlePose },
  { name: 'sad', count: 6, frames: [200, 200, 200, 200, 200, 320], pose: sadPose },
  { name: 'wait', count: 6, frames: [200, 180, 180, 180, 180, 300], pose: waitPose },
  { name: 'flap', count: 6, frames: [120, 120, 120, 120, 120, 200], pose: flapPose },
  { name: 'pace', count: 8, frames: [140, 140, 140, 140, 140, 140, 140, 200], pose: pacePose },
  { name: 'ruffle', count: 6, frames: [90, 90, 90, 90, 90, 180], pose: rufflePose },
  { name: 'look', count: 6, frames: [260, 200, 200, 200, 200, 300], pose: lookPose },
  { name: 'peck', count: 6, frames: [150, 120, 180, 150, 120, 220], pose: peckPose },
  { name: 'think', count: 6, frames: [240, 200, 200, 200, 200, 320], pose: (i, n) => {
    const t = (i / n) * Math.PI * 2
    return {
      ...STAND,
      headTilt: 14 + Math.sin(t) * 6,
      bob: Math.sin(t) * 1.5,
      eye: i % 3 === 2 ? 0.6 : 0,
      wingR: -30,
      wingL: 6,
    }
  } },
  { name: 'work', count: 6, frames: [110, 110, 110, 110, 110, 200], pose: (i, n) => {
    const t = (i / n) * Math.PI * 4
    return {
      ...STAND,
      bob: Math.abs(Math.sin(t)) * -3,
      headBob: 3,
      wingL: 16 + Math.sin(t) * 14,
      wingR: 16 + Math.sin(t + 1) * 14,
      eye: 0,
      blush: 0.3,
    }
  } },
  { name: 'celebrate', count: 8, frames: [110, 110, 110, 110, 110, 110, 140, 220], pose: (i, n) => {
    const arc = [0, 10, 24, 34, 30, 18, 6, 0][i % 8]
    return {
      ...STAND,
      bob: -arc,
      wingL: -80,
      wingR: -80,
      mouth: 1,
      eye: 0,
      blush: 1,
      shadow: Math.max(0.5, 1 - arc * 0.014),
      tilt: Math.sin((i / n) * Math.PI * 4) * 5,
    }
  } },
]

/**
 * Render one row of the spritesheet into a cell grid.
 * @param {Row} row - the row to render.
 * @returns {import('./png.mjs').Canvas[]} one canvas per frame, `count` long.
 */
export function renderRow(row) {
  const out = []
  for (let i = 0; i < row.count; i++) {
    out.push(drawChicken(row.pose(i, row.count)))
  }
  return out
}

export { mixPose }
