// Runs against the production output under a repository-style subpath.
import { chromium } from 'playwright-core'
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import assert from 'node:assert/strict'

const root=resolve('dist'), prefix='/stratix/'
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.wasm':'application/wasm','.woff2':'font/woff2','.webmanifest':'application/manifest+json'}
const server=createServer(async(req,res)=>{
  const resource=new URL(req.url,'http://localhost').pathname
  const file=resolve(root,resource.slice(prefix.length)||'index.html')
  if(!resource.startsWith(prefix)||!file.startsWith(root+sep)){res.writeHead(404).end();return}
  try{const data=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'}).end(data)}
  catch{res.writeHead(404).end()}
})
await new Promise((ok,fail)=>server.once('error',fail).listen(0,'127.0.0.1',ok))
const base='http://127.0.0.1:'+server.address().port+prefix
let browser
try{
  browser=await chromium.launch({channel:process.env.CHROME_PATH?undefined:'chrome',executablePath:process.env.CHROME_PATH,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'],headless:true})
  const page=await browser.newPage({viewport:{width:1440,height:900}})
  const errors=[],bad=[],external=[]
  page.on('pageerror',e=>errors.push(e.message))
  page.on('response',r=>{if(r.status()>=400)bad.push(r.url())})
  page.on('request',r=>{if(!r.url().startsWith(base) && r.url().startsWith('http'))external.push(r.url())})
  await page.addInitScript(()=>{
    window.cameraCalls=0
    navigator.mediaDevices.getUserMedia=async()=>{window.cameraCalls++;throw new DOMException('Denied','NotAllowedError')}
  })
  const btn=(name)=>page.getByRole('button',{name,exact:true})
  const dialog=page.getByRole('dialog')
  const title=name=>dialog.getByRole('heading',{name,exact:true}).waitFor()
  await page.goto(base);await page.evaluate(()=>document.fonts.ready);await page.locator('.hero-aircraft img').evaluate(img=>img.decode())
  assert.equal(await page.evaluate(()=>window.cameraCalls),0)
  const out=process.env.SCREENSHOT_DIR||'test-results'
  await mkdir(out,{recursive:true})
  await page.screenshot({path:out+'/flight-deck.png'})
  await btn('How to Play').click();await title('How to Play');await btn('Got it').click()
  await btn('Settings').click();await title('Settings')
  await page.getByRole('switch',{name:'Reduce motion'}).click();await btn('Done').click()
  await btn('Play').click();await title('Camera unavailable');assert.match(await dialog.innerText(),/permission was denied/)
  await btn('Fly manually').click();await title('Ready for takeoff');await btn('Take off').click()
  await page.keyboard.press('Escape');await title('Flight paused')
  const fillsViewport=()=>page.locator('#stage').evaluate(el=>{
    const r=el.getBoundingClientRect()
    return r.left===0 && r.top===0 && Math.abs(r.width-innerWidth)<1 && Math.abs(r.height-innerHeight)<1
  })
  assert.ok(await fillsViewport())
  const score=await page.locator('#score').innerText()
  await page.waitForTimeout(1150);assert.equal(await page.locator('#score').innerText(),score)
  await dialog.getByRole('button',{name:'Settings'}).click();await btn('Done').click();await title('Flight paused')
  await btn('Resume').click();await page.keyboard.press('ArrowUp')
  // Run a real manual flight long enough for the first balloon to enter the frame.
  await page.waitForTimeout(1340);await page.keyboard.press('Space');await page.waitForTimeout(700)
  await page.locator('#stage').screenshot({path:out+'/flight.png'})
  await title('Game Over');assert.ok(Number(await page.locator('#record-value').textContent())>=2)
  await btn('Fly again').click();await title('Ready for takeoff')
  await btn('Main menu').click();await btn('High Score').click();await title('High Score');assert.equal(await page.locator('tbody tr').count(),1)
  await page.reload();assert.ok(Number(await page.locator('#record-value').textContent())>=2)
  for(const width of [320,390,768,1024]){
    await page.setViewportSize({width,height:844})
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),JSON.stringify(await page.evaluate(()=>[innerWidth,...Array.from(document.querySelectorAll('body *')).filter(e=>e.getBoundingClientRect().right>innerWidth+1 && !e.closest('.stage')).map(e=>[e.tagName,e.className,Math.round(e.getBoundingClientRect().right)])])))
    assert.ok(await fillsViewport())
    if(width===390)await page.screenshot({path:out+'/mobile.png'})
  }
  // Use a synthetic camera track. An optional official fixture also exercises positive inference.
  const fixture = process.env.HAND_FIXTURE ? (await readFile(process.env.HAND_FIXTURE)).toString('base64') : ''
  await page.evaluate(async fixture=>{
    const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480
    const g=canvas.getContext('2d');const img=new Image()
    if(fixture){img.src='data:image/jpeg;base64,'+fixture;await img.decode()}
    window.blank=false
    const paint=()=>{g.fillStyle='#777';g.fillRect(0,0,640,480);if(fixture&&!window.blank){const s=Math.min(640/img.width,480/img.height);g.drawImage(img,(640-img.width*s)/2,(480-img.height*s)/2,img.width*s,img.height*s)}}
    paint();const id=setInterval(paint,50)
    navigator.mediaDevices.getUserMedia=async()=>{window.testStream=canvas.captureStream(20);return window.testStream}
    window.endPaint=()=>clearInterval(id)
  },fixture)
  await btn('Play').click();await title('Ready for takeoff')
  await page.getByText(fixture?'Tracking Active':'Hand Not Detected',{exact:true}).waitFor()
  assert.equal(await page.locator('video').count(),0)
  if(fixture){
    await page.keyboard.press('Space')
    await page.evaluate(()=>window.blank=true)
    await title('Flight paused');assert.match(await dialog.innerText(),/tracking was lost/)
    await btn('Use manual controls').click()
    assert.ok(await page.evaluate(()=>window.testStream.getTracks().every(t=>t.readyState==='ended')))
    await page.keyboard.press('Escape');await title('Flight paused')
  }
  await btn('Main menu').click()
  assert.ok(await page.evaluate(()=>window.testStream.getTracks().every(t=>t.readyState==='ended')))
  await page.evaluate(()=>window.endPaint())
  assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);assert.deepEqual(external,[])
  console.log('Chrome passed: production subpath, screens, fallback, pause/resume, retry, persistence, responsive widths, local model worker and camera cleanup.'+(fixture?' Positive hand inference and hand-loss pause passed.':''))
  if(process.env.FLIGHT_FRAMES){
    const dir=process.env.FLIGHT_FRAMES
    await mkdir(dir,{recursive:true})
    await page.setViewportSize({width:1200,height:675})
    await btn('Settings').click()
    await dialog.getByRole('button',{name:'Manual'}).click()
    if(await page.getByRole('switch',{name:'Reduce motion'}).getAttribute('aria-checked')==='true'){
      await page.getByRole('switch',{name:'Reduce motion'}).click()
    }
    await btn('Done').click()
    // Keep the documentation route repeatable while using the normal spawn and physics code.
    await page.evaluate(()=>{Math.random=()=>0.5})
    await btn('Play').click();await title('Ready for takeoff')
    // Advance the real render loop at a fixed capture rate; fly using normal keyboard events.
    await page.clock.install()
    await page.clock.pauseAt(new Date(Date.now()+1500))
    await btn('Take off').dispatchEvent('click')
    let lastLift=0
    for(let frame=0;frame<165;frame++){
      const seconds=Number(await page.locator('#score').innerText())
      if([1,2,4,5,6,7,8].includes(seconds) && seconds>lastLift){await page.keyboard.press('Space');lastLift=seconds}
      await page.clock.runFor(80)
      assert.ok(!await dialog.isVisible(),'Demo flight ended early, frame '+frame)
      const image=await page.screenshot({path:dir+'/'+String(frame).padStart(3,'0')+'.png'})
      if(frame===50)await (await import('node:fs/promises')).writeFile(out+'/flight.png',image)
      if(Number(await page.locator('#score').innerText())>=10 && frame>1)break
    }
    assert.ok(Number(await page.locator('#score').innerText())>=10,'Demo must pass a balloon')
    console.log('Captured a real balloon pass and a full-size flight still.')
  }
}finally{await browser?.close();await new Promise(ok=>server.close(ok))}
