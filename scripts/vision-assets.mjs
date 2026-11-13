import { cp, mkdir, readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const model = await readFile('public/vision/hand_landmarker.task')
if (createHash('sha256').update(model).digest('hex') !== 'fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1') {
  throw new Error('The bundled hand model failed its SHA-256 check.')
}
const dest = 'public/vision/runtime'
await mkdir(dest, { recursive: true })
await cp('node_modules/@mediapipe/tasks-vision/wasm', dest, { recursive: true })
await cp('node_modules/@mediapipe/tasks-vision/vision_bundle.cjs', dest + '/vision.js')
