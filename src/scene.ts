import { Flight, HEIGHT, clamp } from './flight'

export const art = (file: string) => new URL('art/' + file, document.baseURI).href
const load = (name: string) => {
  const img = new Image()
  img.src = art(name)
  return img
}
const landscape = load('alpine.webp'), aircraft = load('kestrel.webp'), balloon = load('balloon.svg')
export const artReady = Promise.all([landscape, aircraft, balloon].map(img => img.decode()))

function cloudLayer(seed: number) {
  const tile = document.createElement('canvas')
  tile.width = 512; tile.height = 140
  const ctx = tile.getContext('2d')!
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
  for (let i=0; i<90; i++) {
    const x = 68 + rand()*376, w = 10 + rand()*55, y = 66 + Math.sin(x/72)*14 + rand()*33
    ctx.save(); ctx.translate(x,y); ctx.scale(1,0.48)
    const g = ctx.createRadialGradient(0,0,1,0,0,w)
    g.addColorStop(0,'rgba(238,214,196,.13)'); g.addColorStop(1,'rgba(205,210,221,0)')
    ctx.fillStyle=g; ctx.fillRect(-w,-w,w*2,w*2); ctx.restore()
  }
  return tile
}

export class Scene {
  width = 1000
  private ctx: CanvasRenderingContext2D
  private clouds = [cloudLayer(18),cloudLayer(43)]
  private ratio = 1
  private tilt = 0
  private lastFrame = 0
  constructor(private canvas: HTMLCanvasElement) { this.ctx = canvas.getContext('2d')! }
  resize() {
    const rect = this.canvas.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const dpr = Math.min(devicePixelRatio, 2)
    this.canvas.width = Math.round(rect.width*dpr); this.canvas.height=Math.round(rect.height*dpr)
    this.ratio = this.canvas.height/HEIGHT; this.width = this.canvas.width/this.ratio
  }
  draw(f: Flight, reduce: boolean, crashAge = -1) {
    const c=this.ctx, width=this.width
    c.setTransform(this.ratio,0,0,this.ratio,0,0)
    c.fillStyle='#29425e'; c.fillRect(0,0,width,HEIGHT)
    if (landscape.naturalWidth) {
      const w = Math.max(width,HEIGHT*landscape.naturalWidth/landscape.naturalHeight)
      const h = w*landscape.naturalHeight/landscape.naturalWidth
      const drift = reduce ? 0 : (f.distance*0.085) % (2*w)
      for (let i=0;i<3;i++) {
        c.save(); c.translate(i*w-drift+(i%2?w:0),(HEIGHT-h)/2)
        c.scale(i%2?-1:1,1); c.drawImage(landscape,0,0,w+0.5,h); c.restore()
      }
    }
    this.clouds.forEach((tile,i) => {
      const span = 640+i*130, offset=reduce?0:(f.distance*(0.22+i*.34))%span
      for (let x=-span-offset+i*150;x<width;x+=span) c.drawImage(tile,x, i?420:130,span*.85,i?120:85)
    })
    for (const b of f.obstacles) {
      if (balloon.naturalWidth) c.drawImage(balloon,b.x-b.radius,b.y-b.radius,b.radius*2,b.radius*2.8)
    }
    const dt = Math.max(0,f.elapsed - this.lastFrame)
    if (f.elapsed < this.lastFrame || f.elapsed === 0) this.tilt=0
    this.lastFrame = f.elapsed
    this.tilt += (clamp(f.velocity/820,-0.24,0.32)-this.tilt)*(1-Math.exp(-10*dt))
    c.save(); c.translate(f.x,f.y); c.rotate(this.tilt)
    const s=f.size
    if (!reduce && f.elapsed>0) {
      const g=c.createLinearGradient(-s*1.2,0,-s*.3,0)
      g.addColorStop(0,'rgba(255,225,184,0)');g.addColorStop(1,'rgba(255,220,184,.46)')
      c.fillStyle=g; c.beginPath();c.moveTo(-s*1.4,s*.035);c.lineTo(-s*.3,-s*.02);c.lineTo(-s*.3,s*.03);c.fill()
    }
    if (aircraft.naturalWidth) c.drawImage(aircraft,-s/2,-s/3,s,s*2/3)
    c.strokeStyle='rgba(255,239,212,.7)';c.lineWidth=1.3;c.beginPath()
    c.ellipse(s*.288,-s*.052,s*.026,s*(reduce?.14:.075+.11*Math.abs(Math.cos(f.elapsed*49))),-.11,0,Math.PI*2);c.stroke();c.restore()
    if (!reduce && crashAge>=0 && crashAge<0.5) {
      c.save();c.globalAlpha=1-crashAge*2;c.strokeStyle='#ffba76';c.lineWidth=2
      for(let i=0;i<10;i++){const a=i*Math.PI/5,r=crashAge*(45+i*6)
        c.beginPath();c.moveTo(f.x+Math.cos(a)*r,f.y+Math.sin(a)*r);c.lineTo(f.x+Math.cos(a)*(r+5),f.y+Math.sin(a)*(r+5));c.stroke()}
      c.restore()
    }
  }
}
