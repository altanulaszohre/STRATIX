export type Point = { x: number; y: number }
export const connections = [[0,1,2,3,4],[0,5,6,7,8],[5,9,10,11,12],[9,13,14,15,16],[13,17,18,19,20],[17,0]]
export const LOST_MS = 1200

export class Gesture {
  points: Point[] = []
  lastSeen = -Infinity
  private armed = false
  private candidateSince = -1
  private metric: number | undefined
  private lastFlap = -Infinity

  update(raw: Point[], time: number, aspect = 4/3) {
    if (raw.length !== 21 || raw.some(p => !Number.isFinite(p.x + p.y))) {
      this.points = []
      this.candidateSince = -1
      return false
    }
    if (time - this.lastSeen > 280) {
      this.armed = false; this.metric = undefined; this.points = []; this.candidateSince = -1
    }
    this.lastSeen = time
    this.points = raw.map((p,i) => {
      const old = this.points[i]
      return old ? {x: old.x + 0.72*(p.x-old.x), y: old.y + 0.72*(p.y-old.y)} : {x:p.x,y:p.y}
    })
    const tip = raw[12], base = raw[9], wrist = raw[0]
    const ax = (base.x - wrist.x) * aspect, ay = base.y - wrist.y
    // Project the fingertip onto the palm axis to tolerate camera tilt and hand size.
    const value = ((tip.x-base.x)*aspect*ax + (tip.y-base.y)*ay) / Math.max(0.0001, ax*ax + ay*ay)
    this.metric = this.metric === undefined ? value : this.metric + 0.76*(value-this.metric)
    const qualifying = this.armed ? this.metric < 0.1 : this.metric > 0.55
    if (!qualifying) { this.candidateSince = -1; return false }
    if (this.candidateSince < 0) this.candidateSince = time
    if (time - this.candidateSince < 35) return false
    this.candidateSince = -1
    this.armed = !this.armed
    if (!this.armed && time - this.lastFlap >= 170) { this.lastFlap = time; return true }
    return false
  }

  lost(now: number) { return now - this.lastSeen >= LOST_MS }
}
