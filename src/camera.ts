import type { Point } from './gesture'

export class FlightCamera {
  private stream?: MediaStream
  private worker?: Worker
  private video = document.createElement('video')
  private timer = 0
  private deadline = 0
  private stopped = false
  private lastFrame = -1
  private busy = false

  constructor(private onPoints: (points: Point[], at: number, aspect: number) => void,
    private onReady: () => void, private onFailure: (reason: string) => void) {}

  private fail(message: string) {
    if (this.stopped) return
    this.stop()
    this.onFailure(message)
  }

  async start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.fail('Camera control needs HTTPS or localhost and an available camera.'); return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio:false, video:{
        facingMode:'user', width:{ideal:640}, height:{ideal:480}, frameRate:{ideal:24,max:30}
      } })
      if (this.stopped) { stream.getTracks().forEach(track => track.stop()); return }
      this.stream = stream
      stream.getVideoTracks()[0].onended = () => this.fail('The camera disconnected.')
      this.video.muted = true; this.video.playsInline = true
      this.video.srcObject = stream
      await this.video.play()
      if (this.stopped) return
      const worker = this.worker = new Worker(new URL('vision/tracker.js', document.baseURI))
      worker.onerror = () => this.fail('Hand tracking could not start on this browser.')
      worker.onmessage = ({data}) => {
        if (this.stopped) return
        window.clearTimeout(this.deadline)
        if (data.kind === 'error') { this.fail('The hand model could not process the camera image.'); return }
        if (data.kind === 'ready') this.onReady()
        else this.onPoints(data.points, data.time, this.video.videoWidth / this.video.videoHeight)
        this.busy = false
        this.schedule()
      }
      this.deadline = window.setTimeout(() => this.fail('The hand model took too long to load.'), 25000)
      worker.postMessage({kind:'init'})
    } catch (error) {
      const name = (error as Error).name
      this.fail(name === 'NotAllowedError' ? 'Camera permission was denied.' :
        name === 'NotFoundError' ? 'No camera was found.' : 'The camera is unavailable or in use.')
    }
  }

  private schedule() {
    if (!this.stopped) this.timer = window.setTimeout(() => void this.capture(), 40)
  }

  private async capture() {
    if (this.stopped || this.busy) return
    const video = this.video
    if (video.readyState < 2 || video.currentTime === this.lastFrame || document.hidden) { this.schedule(); return }
    this.lastFrame = video.currentTime
    this.busy = true
    try {
      const frame = await createImageBitmap(video)
      if (this.stopped) { frame.close(); return }
      this.worker!.postMessage({kind:'frame', frame, time:performance.now()}, [frame])
      this.deadline = window.setTimeout(() => this.fail('Hand tracking stopped responding.'), 5000)
    } catch { this.fail('This browser could not read the camera frame.') }
  }

  stop() {
    this.stopped = true
    window.clearTimeout(this.timer); window.clearTimeout(this.deadline)
    this.worker?.terminate()
    this.stream?.getTracks().forEach(track => { track.onended = null; track.stop() })
    this.video.pause(); this.video.srcObject = null
  }
}
