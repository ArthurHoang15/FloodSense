import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import type { SupabaseMock } from '../../__tests__/helpers/supabaseMock.js'

vi.mock('../../lib/supabase.js', async () => {
  const { makeSupabaseMock } = await import('../../__tests__/helpers/supabaseMock.js')
  const sb = makeSupabaseMock()
  ;(globalThis as Record<string, unknown>).__weatherSb = sb
  return { default: sb, toFloodEvent: vi.fn((row: Record<string, unknown>) => row) }
})

function getSb(): SupabaseMock {
  return (globalThis as Record<string, unknown>).__weatherSb as SupabaseMock
}

// Frozen to 08:00 UTC on 2026-03-21
const FROZEN_NOW = new Date('2026-03-21T08:00:00Z')

function makeMeteoResponse(probs: number[], rains: number[]) {
  const times = probs.map((_, i) => {
    const d = new Date(FROZEN_NOW.getTime() + i * 3_600_000)
    return d.toISOString().slice(0, 16).replace('T', 'T') // "2026-03-21T08:00"
  })
  return {
    hourly: { time: times, precipitation_probability: probs, rain: rains },
  }
}

let app: express.Application

beforeAll(async () => {
  const { default: createWeatherRoutes } = await import('../../routes/weather.js')
  app = express()
  app.use(express.json())
  app.use('/', createWeatherRoutes())
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(FROZEN_NOW)
  getSb().__resetAll()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

// ── Successful forecast ────────────────────────────────────────────────────
describe('GET /weather/forecast — Open-Meteo success', () => {
  it('returns 200 with hourly array', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeMeteoResponse([40, 50, 60], [1.0, 2.0, 3.0])),
    }))
    const res = await request(app).get('/forecast')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.hourly)).toBe(true)
    expect(res.body.hourly.length).toBe(3)
  })

  it('hourly items contain precipitation_probability and rain_mm', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeMeteoResponse([60, 30], [2.0, 0.5])),
    }))
    const res = await request(app).get('/forecast')
    expect(res.body.hourly[0]).toMatchObject({
      precipitation_probability: 60,
      rain_mm: 2.0,
    })
  })

  it('max probability >= 70 → alert object with ⛈ message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeMeteoResponse([80, 60, 40], [5.0, 2.0, 0.5])),
    }))
    const res = await request(app).get('/forecast')
    expect(res.body.alert).not.toBeNull()
    expect(res.body.alert.probability).toBe(80)
    expect(res.body.alert.message).toContain('⛈')
  })

  it('all probabilities < 70 → alert is null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeMeteoResponse([50, 60, 65], [1.0, 2.0, 3.0])),
    }))
    const res = await request(app).get('/forecast')
    expect(res.body.alert).toBeNull()
  })

  it('exactly 70% → alert triggered', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeMeteoResponse([70], [2.0])),
    }))
    const res = await request(app).get('/forecast')
    expect(res.body.alert).not.toBeNull()
    expect(res.body.alert.probability).toBe(70)
  })

  it('filters out hours beyond 6h from now', async () => {
    // 9 hours of data — only first 6 (+current) should appear
    const probs = Array(9).fill(0).map((_, i) => i * 5)
    const rains = Array(9).fill(0.1)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeMeteoResponse(probs, rains)),
    }))
    const res = await request(app).get('/forecast')
    // hours within 0–6h from FROZEN_NOW: indices 0..6 (inclusive) = 7 max
    expect(res.body.hourly.length).toBeLessThanOrEqual(7)
  })

  it('Supabase upsert is called for weather_forecasts (fire-and-forget)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeMeteoResponse([50], [1.0])),
    }))
    await request(app).get('/forecast')
    // flush microtask queue so the fire-and-forget upsert runs
    await Promise.resolve()
    expect(getSb().from).toHaveBeenCalledWith('weather_forecasts')
  })
})

// ── Error paths ───────────────────────────────────────────────────────────
describe('GET /weather/forecast — errors', () => {
  it('Open-Meteo non-OK → 500', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))
    const res = await request(app).get('/forecast')
    expect(res.status).toBe(500)
    expect(res.body.success).toBe(false)
  })

  it('fetch throws → 500', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
    const res = await request(app).get('/forecast')
    expect(res.status).toBe(500)
  })
})
