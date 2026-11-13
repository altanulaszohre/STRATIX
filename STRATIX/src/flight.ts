export const HEIGHT = 540
export const STEP = 1 / 120
export type Balloon = { x: number; y: number; radius: number; passed: boolean }
export const clamp = (v: number, low: number, high: number) => Math.max(low, Math.min(high, v))

export class Flight {
  width: number
  y = HEIGHT * 0.48
  velocity = 0
  elapsed = 0
  distance = 0
  passed = 0
  ended = false
  obstacles: Balloon[] = []
  private untilSpawn = 0
  private corridor = HEIGHT / 2
  private nextTop = true
  private random: () => number
  constructor(width: number, random = Math.random) { this.width = width; this.random = random }
  get x() { return this.width * 0.23 }
  get size() { return clamp(this.width * 0.115, 54, 100) }
  get speed() { return 140 + Math.min(77, this.elapsed * 0.9) }
  get score() { return Math.floor(this.elapsed) + this.passed * 10 }

  resize(width: number) {
    const offset = (width - this.width) * 0.23
    this.obstacles.forEach(b => b.x += offset)
    this.width = width
  }

  flap() { if (!this.ended) this.velocity = -190 }

  private spawn() {
    // Consecutive safe lanes only move a short vertical distance.
    this.corridor = clamp(this.corridor + (this.random() - 0.5) * 100, 185, 355)
    const gap = 210 - Math.min(50, this.elapsed * 0.6)
    const radius = 30 + this.random() * 13
    const y = this.nextTop ? this.corridor - gap / 2 - radius * 1.62 : this.corridor + gap / 2 + radius
    this.obstacles.push({ x: this.width + radius, y, radius, passed: false })
    this.nextTop = this.random() < 0.7 ? !this.nextTop : this.nextTop
    this.untilSpawn = this.speed * (2.45 + this.random() * 0.4)
  }

  hits(balloon: Balloon) {
    const r = balloon.radius
    // Test two inset fuselage volumes against the envelope and the basket.
    return [-0.19, 0.17].some(along => {
      const dx = this.x + along * this.size - balloon.x
      const dy = this.y - balloon.y
      return (dx / (r * 0.9 + this.size * 0.14)) ** 2 + (dy / (r + this.size * 0.075)) ** 2 < 1 ||
        (Math.abs(dx) < r * 0.19 + this.size * 0.11 && Math.abs(dy - r * 1.47) < r * 0.16 + this.size * 0.06)
    })
  }

  step(dt = STEP) {
    if (this.ended) return
    this.elapsed += dt
    this.velocity = Math.min(290, this.velocity + 330 * dt)
    this.y += this.velocity * dt
    if (this.y < this.size * 0.13) { this.y = this.size * 0.13; this.velocity = Math.max(this.velocity, 0) }
    this.ended = this.y > HEIGHT - this.size * 0.12
    this.distance += this.speed * dt
    this.untilSpawn -= this.speed * dt
    if (this.untilSpawn <= 0) this.spawn()
    for (const b of this.obstacles) {
      b.x -= this.speed * dt
      if (this.hits(b)) this.ended = true
      if (!this.ended && !b.passed && b.x + b.radius < this.x - this.size / 2) {
        b.passed = true; this.passed++
      }
    }
    this.obstacles = this.obstacles.filter(b => b.x > -b.radius * 2)
  }
}

export class FixedClock {
  private remainder = 0
  reset() { this.remainder = 0 }
  advance(seconds: number, run: () => void) {
    this.remainder += Math.min(0.1, seconds)
    while (this.remainder + 1e-10 >= STEP) { run(); this.remainder -= STEP }
  }
}
