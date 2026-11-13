import {test} from 'node:test'
import assert from 'node:assert/strict'
import {Flight,FixedClock,STEP} from '../src/flight.ts'
import {Gesture} from '../src/gesture.ts'

test('fixed steps produce identical flight at 30, 60 and 144 Hz',()=>{
  function sample(hz){
    const f=new Flight(940,()=>.5),clock=new FixedClock()
    f.flap()
    for(let i=0;i<hz;i++)clock.advance(1/hz,()=>f.step())
    return [f.y,f.velocity,f.distance,f.score]
  }
  assert.deepEqual(sample(30),sample(144));assert.deepEqual(sample(60),sample(144))
})
test('lift, gravity, ceiling, ground and terminal state',()=>{
  const f=new Flight(500);f.flap();const y=f.y;f.step();assert.ok(f.y<y)
  f.y=0;f.step();assert.ok(f.y>0 && f.velocity>=0)
  while(!f.ended)f.step()
  const end=f.elapsed;f.step();assert.equal(f.elapsed,end)
})
test('envelope and basket collide, sky between them stays clear',()=>{
  const f=new Flight(800),b={x:f.x,y:f.y,radius:40,passed:false}
  assert.ok(f.hits(b));f.y+=59;assert.ok(f.hits(b));f.y+=30;assert.ok(!f.hits(b))
})
test('balloon bonus is awarded once and score includes elapsed flight',()=>{
  const f=new Flight(800);f.step();f.obstacles=[{x:f.x-100,y:50,radius:30,passed:false}]
  for(let i=0;i<120;i++)f.step();assert.equal(f.score,11);assert.equal(f.passed,1)
})
test('resize preserves time-to-contact, restart clears the run',()=>{
  const f=new Flight(500);f.step();const distance=f.obstacles[0].x-f.x
  f.resize(1200);assert.equal(f.obstacles[0].x-f.x,distance)
  const fresh=new Flight(1200);assert.equal(fresh.score,0);assert.equal(fresh.elapsed,0)
})
test('generated routes retain a reachable central lane',()=>{
  for(const width of [300,650,1400]){
    const f=new Flight(width,()=>.5)
    for(let i=0;i<19000;i++){if(f.y>288 && f.velocity>0)f.flap();f.step(STEP)}
    assert.ok(!f.ended);assert.ok(f.passed>45)
  }
})
const hand=(bend,scale=1)=>{
  const pts=Array.from({length:21},()=>({x:.4,y:.5}))
  pts[0]={x:.5,y:.8};pts[9]={x:.5,y:.8-.2*scale};pts[12]={x:.5,y:.8-(bend?.17:.42)*scale}
  return pts
}
test('one lift per curl across palm scales; held shapes never repeat',()=>{
  for(const size of [.35,.7,1.2]){
    const g=new Gesture();let t=0,count=0
    for(const bend of [true,false,true,false,true]){
      for(let i=0;i<12;i++){count+=Number(g.update(hand(bend,size),t));t+=45}
    }
    assert.equal(count,2)
  }
})
test('brief noise, tracking gaps and invalid input cannot issue a lift',()=>{
  const g=new Gesture()
  for(let t=0;t<240;t+=40)g.update(hand(false),t)
  assert.ok(!g.update(hand(true),240));assert.ok(!g.update([],280))
  assert.ok(!g.lost(700));assert.ok(g.lost(1441))
  for(let t=1500;t<1900;t+=40)assert.ok(!g.update(hand(true),t))
  assert.ok(!g.update([{x:NaN,y:0}],2000));assert.equal(g.points.length,0)
})
