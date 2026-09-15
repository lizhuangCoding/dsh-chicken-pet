/**
 * Render the documentation preview images.
 *
 * These images are referenced by the README, so regenerating the sprites
 * without regenerating them would leave the documentation showing stale art.
 */

import { previewRows } from './preview.mjs'

const jobs = [
  ['docs/spritesheet-preview.png', [], 1],
  ['docs/rows-idle.png', ['idle', 'sleep', 'look', 'peck', 'ruffle'], 2],
  ['docs/rows-work.png', ['work', 'think', 'wait', 'sad', 'startle'], 2],
  ['docs/rows-ball.png', ['dribble', 'spin-ball', 'shoot', 'celebrate', 'jump'], 2],
  ['docs/rows-walk.png', ['walk-right', 'walk-left', 'pace', 'wave', 'flap'], 2],
]

for (const [out, names, scale] of jobs) {
  const size = previewRows(out, names, scale)
  process.stdout.write(`  ${out.padEnd(34)} ${size}\n`)
}
