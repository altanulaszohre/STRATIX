// Classic worker: the pinned MediaPipe WASM loader uses importScripts.
self.exports = {}
let detector
self.onmessage = async ({ data }) => {
  try {
    if (data.kind === 'init') {
      importScripts('./runtime/vision.js')
      const { FilesetResolver, HandLandmarker } = self.exports
      const root = new URL('./', self.location.href)
      const files = await FilesetResolver.forVisionTasks(new URL('runtime', root).href)
      detector = await HandLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: new URL('hand_landmarker.task', root).href, delegate: 'CPU' },
        runningMode: 'VIDEO', numHands: 1, minTrackingConfidence: 0.55
      })
      self.postMessage({ kind: 'ready' })
    } else {
      const result = detector.detectForVideo(data.frame, data.time)
      self.postMessage({ kind: 'hand', points: result.landmarks[0] || [], time: data.time })
    }
  } catch {
    self.postMessage({ kind: 'error' })
  } finally {
    data.frame?.close()
  }
}
