import './style.css'
import { Flight, FixedClock } from './flight'
import { FlightCamera } from './camera'
import { Gesture, connections, type Point } from './gesture'
import { Scene, artReady } from './scene'
import { icon } from './icons'
import { FlightAudio } from './audio'
import { getRecords, getSettings, save, type Mode } from './storage'

const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!
const app = $('#app'), stage = $('#stage'), overlay = $('#overlay'), world = $<HTMLCanvasElement>('#world')
const tracker = $('#tracking'), skeleton = $<HTMLCanvasElement>('#tracking canvas')
const scene = new Scene(world), audio = new FlightAudio(), clock = new FixedClock()
const settings = getSettings()
let records = getRecords()
let flight = new Flight(1000), gesture = new Gesture(), camera: FlightCamera | undefined
type State = 'home'|'loading'|'ready'|'flying'|'paused'|'crash'|'over'|'fallback'
type Panel = 'none'|'help'|'scores'|'settings'|'pause'|'ready'|'loading'|'over'|'fallback'
let state: State = 'home', panel: Panel = 'none', sessionMode: Mode = settings.mode
let notice = '', readyModel = false, crashAt = 0, lastFrame = performance.now(), dirty = true
let prepared = false, artError = false
let focusBefore: HTMLElement | null = null

const button = (action:string,label:string,glyph:string,style='secondary') =>
  `<button class="${style}" data-act="${action}">${icon(glyph)}${label}</button>`
const format = (value:number) => value.toLocaleString('en-US')
const best = () => records[0]?.score || 0
const modes = (mode:Mode) => (['camera','manual'] as const).map(m =>
  `<button data-act="mode-${m}" class="${mode===m?'active':''}" aria-pressed="${mode===m}">${icon(m==='camera'?'hand':'keyboard')}${m==='camera'?'Hand AI':'Manual'}</button>`).join('')
function preferenceUI() {
  app.classList.toggle('reduced',settings.reduced)
  $('#record-value').textContent = format(best())
  document.querySelectorAll<HTMLButtonElement>('[data-act=mute]').forEach(el=>{
    el.innerHTML = icon(settings.muted?'mute':'sound',18)
    el.setAttribute('aria-label',settings.muted?'Unmute audio':'Mute audio')
    el.title = el.getAttribute('aria-label')!
  })
  audio.ambient(state==='flying' && settings.music && !settings.muted && !document.hidden)
}
document.querySelectorAll('[data-act=full]').forEach(el=>el.innerHTML=icon('full',18))
$('.route-icon').innerHTML = icon('pin',16)
$('.medal').innerHTML = icon('trophy',17)
for (const [act,glyph,label] of [['play','play','Play'],['help','book','How to Play'],['scores','trophy','High Score'],['settings','settings','Settings']]) {
  $('.hero-actions [data-act='+act+']').innerHTML = icon(glyph,18)+'<span>'+label+'</span>'+icon('chevron',14)
}
$('.hud [data-act=pause]').innerHTML = icon('pause',18)
preferenceUI()
artReady.then(()=>{prepared=true;dirty=true}).catch(()=>{artError=true})

function layout() {
  const active = state !== 'home'
  app.classList.toggle('playing',active)
  $('#hangar').hidden=active; world.hidden=!active; $('.hud').hidden=!active
  tracker.hidden=!active || sessionMode!=='camera' || !readyModel || state==='over' || state==='crash'
  if (active) { scene.resize(); flight.resize(scene.width); dirty=true }
  $('#score').textContent=format(flight.score); $('#best').textContent=format(best())
  $('.hud [data-act=pause]').hidden=state!=='flying'
  preferenceUI()
}

function showPanel(next:Panel,title='',body='',wide=false,close=true) {
  if (panel==='none' && next!=='none') focusBefore = document.activeElement as HTMLElement
  panel=next
  overlay.dataset.screen=next
  stage.dataset.panel=next
  overlay.classList.toggle('camera-ready',next==='ready' && sessionMode==='camera')
  overlay.hidden=next==='none'
  if (overlay.hidden) {
    overlay.replaceChildren()
    if (focusBefore?.isConnected && focusBefore.getClientRects().length) focusBefore.focus({preventScroll:true})
    focusBefore=null; return
  }
  overlay.innerHTML=`<section role="dialog" aria-modal="true" aria-labelledby="dialog-title" class="dialog ${wide?'wide':''}"><div class="modal-title"><h2 id="dialog-title" tabindex="-1">${title}</h2>${close?`<button class="square" aria-label="Back" data-act="back">${icon('close',16)}</button>`:''}</div>${body}</section>`
  $('#dialog-title').focus({preventScroll:true})
}
function stopCamera() {
  camera?.stop();camera=undefined;readyModel=false;gesture=new Gesture();drawHand([])
}
function home() {
  stopCamera();state='home';notice='';showPanel('none');layout()
}
function start(mode=settings.mode) {
  stopCamera();notice='';sessionMode=mode;state=mode==='camera'?'loading':'ready'
  flight=new Flight(scene.width);clock.reset()
  layout()
  if (artError) { state='fallback';showPanel('fallback','Artwork unavailable','<p>Reload this page to retry loading the flight artwork.</p>'+buttons(button('home','Main menu','home')),false,false);return }
  if (mode==='manual') { ready();return }
  showPanel('loading','Starting hand tracking','<p>Allow camera access to fly with one hand. Camera frames stay on your device.</p>'+buttons(button('manual','Use manual controls','keyboard'),button('home','Main menu','home')),false,false)
  camera=new FlightCamera((points,time,aspect)=>{
    const pulse=gesture.update(points,time,aspect)
    drawHand(gesture.points,aspect)
    if (pulse && (state==='flying' || state==='ready' && panel==='ready') && !document.hidden) lift()
  },()=>{readyModel=true;ready()},why=>{
    stopCamera();notice=why;state='fallback';layout()
    showPanel('fallback','Camera unavailable',`<p>${why} Continue this flight with Space, ↑ or a tap.</p>`+buttons(button('manual','Fly manually','keyboard','primary'),button('retry','Try camera again','retry'),button('home','Main menu','home')),false,false)
  })
  void camera.start()
}
function buttons(...html:string[]) { return '<div class="menu-buttons">'+html.join('')+'</div>' }
function ready() {
  state='ready';layout()
  const cameraMode=sessionMode==='camera'
  const text=cameraMode?'Open your hand, then curl your middle finger to take off. Straighten it between lifts.':'Press Space, ↑ or tap to take off. Repeat to climb, then coast between lifts.'
  showPanel('ready','Ready for takeoff',`<p>${text}</p>`+buttons(cameraMode?button('manual','Use manual controls','keyboard')+button('home','Main menu','home'):button('lift','Take off','play','primary')+button('home','Main menu','home')),false,false)
}
function lift() {
  if (!prepared || document.hidden) return
  if (state==='ready' && panel==='ready') {
    showPanel('none');state='flying';clock.reset();lastFrame=performance.now();layout()
  }
  if (state!=='flying') return
  flight.flap();audio.effect('flap',settings.sfx&&!settings.muted)
}
function pause(reason='') {
  if (state!=='flying') return
  state='paused';notice=reason;clock.reset();layout();pausePanel()
}
function pausePanel() {
  showPanel('pause','Flight paused',(notice?`<p>${notice}</p>`:'')+buttons(button('resume','Resume','play','primary')+button('retry','Restart','retry')+button('settings','Settings','settings')+button('home','Main menu','home')+(sessionMode==='camera'?button('manual','Use manual controls','keyboard'):'')),false,false)
}
function resume() {
  if (state!=='paused') return
  if (sessionMode==='camera' && !camera) { stopCamera();sessionMode='manual' }
  if (sessionMode==='camera' && gesture.lost(performance.now())) {
    notice='Show your hand to the camera, then resume. You can also switch to manual controls.';pausePanel();return
  }
  notice='';showPanel('none');state='flying';lastFrame=performance.now();clock.reset();layout()
}
function end() {
  state='crash';crashAt=performance.now();stopCamera()
  records.push({score:flight.score,seconds:Math.floor(flight.elapsed),balloons:flight.passed,date:Date.now()})
  records.sort((a,b)=>b.score-a.score || b.date-a.date);records=records.slice(0,5);save('scores',records)
  audio.effect('crash',settings.sfx&&!settings.muted);layout()
}
function over() {
  state='over'
  showPanel('over','Game Over',`<div class="score-pair"><span>Flight score<b>${format(flight.score)}</b></span><span>Personal best<b>${format(best())}</b></span></div>`+buttons(button('retry','Fly again','retry','primary')+button('home','Main menu','home')),false,false)
}
function settingsPanel() {
  const toggle=(key:'sfx'|'music'|'reduced',label:string)=>`<div class="setting-row"><span>${label}</span><button class="toggle" data-act="toggle-${key}" role="switch" aria-label="${label}" aria-checked="${settings[key]}"><i></i></button></div>`
  showPanel('settings','Settings','<div class="settings">'+toggle('sfx','Sound effects')+toggle('music','Ambient music')+toggle('reduced','Reduce motion')+
    `<div class="setting-row"><span>${state==='home'?'Flight control':'Next flight control'}</span><div class="segmented">${modes(settings.mode)}</div></div><div class="setting-row"><span>Display</span><button class="text-btn" data-act="full">${icon('full',14)} Fullscreen</button></div></div>`+buttons(button('back','Done','check','primary')))
}
function help() {
  showPanel('help','How to Play','<div class="guide">'+[
    ['hand','Open your hand','Face your palm toward the camera with your fingers extended.'],
    ['glide','Curl to climb','Bend your middle finger once for lift. Straighten it to rearm.'],
    ['mountain','Clear the balloons','Coast between lifts. Earn 1 point per second and 10 per balloon.']
  ].map(([i,h,p])=>`<div>${icon(i)}<h3>${h}</h3><p>${p}</p></div>`).join('')+'</div><div class="keys"><kbd>Space</kbd> / <kbd>↑</kbd> / tap to climb · <kbd>Esc</kbd> to pause</div>'+buttons(button('back','Got it','check','primary')),true)
}
function scores() {
  const table=records.length?`<table class="scores"><thead><tr><th>Rank</th><th>Flight</th><th>Points</th></tr></thead><tbody>${records.map((r,i)=>`<tr><td>${i+1}</td><td>${new Date(r.date).toLocaleDateString()} · ${r.seconds}s</td><td>${format(r.score)}</td></tr>`).join('')}</tbody></table>`:'<p>Your first completed flight will appear here.</p>'
  showPanel('scores','High Score',table+buttons(button('back','Back','arrow')))
}
function back() {
  if (state==='paused') pausePanel()
  else if (state==='over') over()
  else if (state==='ready') ready()
  else if (state==='home') showPanel('none')
}
function drawHand(points:Point[],aspect=4/3) {
  const c=skeleton.getContext('2d')!
  c.clearRect(0,0,300,188)
  tracker.classList.toggle('active',points.length===21)
  $('#tracking span span').textContent=points.length?'Tracking Active':'Hand Not Detected'
  if (!points.length) return
  const xs=points.map(p=>(1-p.x)*aspect), ys=points.map(p=>p.y)
  const minX=Math.min(...xs), minY=Math.min(...ys), w=Math.max(...xs)-minX,h=Math.max(...ys)-minY
  const scale=Math.min(252/Math.max(.08,w),155/Math.max(.08,h))
  const xy=points.map((_,i)=>[(xs[i]-minX-w/2)*scale+150,(ys[i]-minY-h/2)*scale+94])
  c.strokeStyle='#94cbe5';c.lineWidth=2.6;c.lineJoin='round'
  for (const chain of connections) {
    c.beginPath();chain.forEach((k,i)=>{const [x,y]=xy[k];if(i===0)c.moveTo(x,y);else c.lineTo(x,y)});c.stroke()
  }
  c.fillStyle='#d9f1ff'
  for(const [x,y] of xy){c.beginPath();c.arc(x,y,3.4,0,Math.PI*2);c.fill()}
}
async function full() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
    else if (app.requestFullscreen) await app.requestFullscreen()
    else throw Error()
  } catch {
    const el=document.querySelector<HTMLElement>('[data-act=full]:focus') || $('[data-act=full]')
    const original=el.innerHTML;el.textContent='Fullscreen unavailable';window.setTimeout(()=>el.innerHTML=original,2200)
  }
}
document.addEventListener('click',event=>{
  const el=(event.target as Element).closest<HTMLButtonElement>('button[data-act]')
  if (!el) return
  const act=el.dataset.act!;audio.unlock()
  if (act==='mute') { settings.muted=!settings.muted;save('settings',settings);preferenceUI();return }
  if (act==='full') {void full();return}
  if (act==='home') {home();return}
  if (act==='play') {start();return}
  if (act==='retry') {start(panel==='fallback'?'camera':sessionMode);return}
  if (act==='manual') {
    stopCamera();sessionMode='manual'
    if (state==='paused') resume();else ready()
    return
  }
  if (act==='lift') {lift();return}
  if (act==='pause') {pause();return}
  if (act==='resume') {resume();return}
  if (act==='back') {back();return}
  if (act.startsWith('mode-')) {
    settings.mode=act==='mode-manual'?'manual':'camera';save('settings',settings);preferenceUI()
    if (panel==='settings') {settingsPanel();overlay.querySelector<HTMLButtonElement>('[data-act="'+act+'"]')?.focus()}
    return
  }
  if (act.startsWith('toggle-')) {
    const key=act.slice(7) as 'music'|'sfx'|'reduced';settings[key]=!settings[key];save('settings',settings)
    preferenceUI();el.setAttribute('aria-checked',String(settings[key]));return
  }
  if (state==='loading' || state==='fallback' || state==='crash') return
  if (state==='flying') pause()
  if(act==='settings')settingsPanel()
  if(act==='help')help()
  if(act==='scores')scores()
})
world.addEventListener('pointerdown',e=>{if(e.button===0){e.preventDefault();lift()}})
document.addEventListener('keydown',e=>{
  if (e.key==='Tab' && panel!=='none') {
    const items=Array.from(overlay.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
    if (!items.length)return
    if(e.shiftKey && (document.activeElement===items[0] || !items.includes(document.activeElement as HTMLButtonElement))){e.preventDefault();items.at(-1)!.focus()}
    else if(!e.shiftKey && document.activeElement===items.at(-1)){e.preventDefault();items[0].focus()}
    return
  }
  if(e.repeat)return
  if(e.key==='Escape'){
    if(state==='flying')pause()
    else if(panel==='pause')resume()
    else if(['help','settings','scores'].includes(panel))back()
    return
  }
  if((e.code==='Space'||e.key==='ArrowUp') && (state==='flying'||state==='ready'&&panel==='ready')){
    if(e.code==='Space' && (e.target as Element).closest('button') && state!=='flying')return
    e.preventDefault();lift()
  }
})
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause('Flight paused while this tab was in the background.')})
window.addEventListener('pagehide',home)
new ResizeObserver(()=>{if (state!=='home'){scene.resize();flight.resize(scene.width);dirty=true}}).observe(stage)

function frame(now:number) {
  const delta=(now-lastFrame)/1000;lastFrame=now
  if(state==='flying'){
    if(sessionMode==='camera'&&gesture.lost(now)) pause('Hand tracking was lost. Show your hand again or continue with manual controls.')
    else {
      const previous=flight.passed, score=flight.score
      clock.advance(delta,()=>flight.step())
      if(previous!==flight.passed)audio.effect('score',settings.sfx&&!settings.muted)
      if(score!==flight.score)$('#score').textContent=format(flight.score)
      if(flight.ended)end()
    }
  }
  if(state!=='home' && prepared && (dirty || state==='flying' || state==='crash')){
    scene.draw(flight,settings.reduced,state==='crash'?(now-crashAt)/1000:-1);dirty=false
  }
  if(state==='crash' && now-crashAt>(settings.reduced?40:470))over()
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
