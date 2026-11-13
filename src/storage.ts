export type Mode = 'camera' | 'manual'
export type Settings = { mode: Mode; sfx: boolean; music: boolean; reduced: boolean; muted: boolean }
export type Result = {score:number; seconds:number; balloons:number; date:number}
function read(key: string) {
  try { return JSON.parse(localStorage.getItem('stratix.'+key) ?? 'null') } catch { return null }
}
export function save(key: string, value: unknown) {
  try { localStorage.setItem('stratix.'+key, JSON.stringify(value)) } catch { /* Private browsing and quota limits. */ }
}
export function getSettings(): Settings {
  const obj = read('settings')
  const flag = (key: string, fallback: boolean) => typeof obj?.[key] === 'boolean' ? obj[key] : fallback
  return {mode:obj?.mode==='manual'?'manual':'camera',sfx:flag('sfx',true), music:flag('music',true),
    muted:flag('muted',false),reduced:flag('reduced',matchMedia('(prefers-reduced-motion: reduce)').matches)}
}
export function getRecords(): Result[] {
  const list = read('scores')
  return Array.isArray(list) ? list.filter(r => r && ['score','seconds','balloons','date'].every(k=>Number.isFinite(r[k]) && r[k]>=0)).sort((a,b)=>b.score-a.score).slice(0,5) : []
}
