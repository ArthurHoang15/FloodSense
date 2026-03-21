import fs from 'fs'
import path from 'path'
import type { FloodEvent } from '../../shared/types.js'

export type FloodStore = {
  base: FloodEvent[]
  simulated: FloodEvent[]
}

function readJsonFile<T>(relativePath: string): T {
  const abs = path.join(process.cwd(), relativePath)
  const raw = fs.readFileSync(abs, 'utf8')
  return JSON.parse(raw) as T
}

export function loadPresetFloods(): FloodEvent[] {
  return readJsonFile<FloodEvent[]>('mocks/presets/heavy_rain_hcmc.json')
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function isEventActive(e: FloodEvent, now = new Date()): boolean {
  if (!e.is_active) return false
  const exp = new Date(e.expires_at).getTime()
  return Number.isFinite(exp) ? exp > now.getTime() : true
}

export function getFloods(store: FloodStore): FloodEvent[] {
  const now = new Date()
  const base = store.base.filter((e) => isEventActive(e, now))
  const sim = store.simulated.filter((e) => isEventActive(e, now))
  return [...sim, ...base].sort((a, b) =>
    new Date(b.last_confirmed_at).getTime() - new Date(a.last_confirmed_at).getTime(),
  )
}

export function setSimulated(store: FloodStore, enabled: boolean): FloodEvent[] {
  if (!enabled) {
    store.simulated = []
    return []
  }
  const floods = loadPresetFloods()
  store.simulated = floods
  return floods
}
