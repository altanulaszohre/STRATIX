export class FlightAudio {
  private context?: AudioContext
  private pad?: { osc: OscillatorNode[]; gain: GainNode }
  unlock() {
    try {
      this.context ??= new AudioContext()
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {})
    } catch { /* Audio is optional on restricted browsers. */ }
  }
  effect(kind: 'flap'|'score'|'crash', enabled: boolean) {
    const ctx = this.context
    if (!enabled || !ctx) return
    const [start,end,duration] = {flap:[145,230,0.12],score:[520,780,0.18],crash:[130,36,0.43]}[kind]
    const at = ctx.currentTime, osc = ctx.createOscillator(), gain = ctx.createGain()
    osc.type = kind === 'crash' ? 'triangle' : 'sine'
    osc.frequency.setValueAtTime(start,at); osc.frequency.exponentialRampToValueAtTime(end,at+duration)
    gain.gain.setValueAtTime(0.001,at); gain.gain.exponentialRampToValueAtTime(0.09,at+0.018)
    gain.gain.exponentialRampToValueAtTime(0.001,at+duration)
    osc.connect(gain).connect(ctx.destination); osc.start(); osc.stop(at+duration)
    osc.onended = () => { osc.disconnect(); gain.disconnect() }
  }
  ambient(active: boolean) {
    const ctx = this.context
    if (!ctx || Boolean(this.pad) === active) return
    if (active) {
      const gain = ctx.createGain(); gain.gain.value = 0
      gain.gain.linearRampToValueAtTime(0.023,ctx.currentTime+1); gain.connect(ctx.destination)
      const osc = [110,164.81,220.4,277.18].map(hz => {
        const voice = ctx.createOscillator(); voice.frequency.value = hz
        voice.connect(gain); voice.start(); return voice
      })
      this.pad = {osc,gain}
    } else if (this.pad) {
      const {osc,gain} = this.pad
      gain.gain.cancelScheduledValues(ctx.currentTime); gain.gain.setTargetAtTime(0,ctx.currentTime,0.05)
      osc.forEach(voice => { voice.stop(ctx.currentTime + 0.3); voice.onended = () => voice.disconnect() })
      window.setTimeout(() => gain.disconnect(),400); this.pad = undefined
    }
  }
}
