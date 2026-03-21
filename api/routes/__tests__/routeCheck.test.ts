import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import type { SupabaseMock } from '../../__tests__/helpers/supabaseMock.js'
import type { FloodStore } from '../../lib/mockData.js'

vi.mock('../../lib/supabase.js', async () => {
  const { makeSupabaseMock } = await import('../../__tests__/helpers/supabaseMock.js')
  const sb = makeSupabaseMock()
  ;(globalThis as Record<string, unknown>).__routeSb = sb
  return { default: sb, toFloodEvent: vi.fn((row: Record<string, unknown>) => row) }
})

// geocode mock — used in live mode
vi.mock('../../lib/geocode.js', () => ({
  geocode: vi.fn().mockResolvedValue({ lat: 10.8032, lng: 106.7078 }),
  mockGeocode: vi.fn((input: string) => {
    const known: Record<string, { lat: number; lng: number }> = {
      'q7': { lat: 10.7366, lng: 106.7222 },
      'tân bình': { lat: 10.8015, lng: 106.6526 },
      'bình thạnh': { lat: 10.8032, lng: 106.7078 },
      'hcmc': { lat: 10.7769, lng: 106.7009 },
    }
    const key = input.trim().toLowerCase()
    return known[key] ?? null
  }),
}))

function getSb(): SupabaseMock {
  return (globalThis as Record<string, unknown>).__routeSb as SupabaseMock
}

function makeFlood(lat: number, lng: number, overrides = {}) {
  return {
    id: 'f-1', street_name: 'Nguyễn Hữu Cảnh', district: 'Bình Thạnh', city: 'HCMC',
    coordinates: { lat, lng }, depth_cm: 40,
    severity: 'heavy' as const, confidence: 'high' as const, sources: [],
    first_detected_at: new Date().toISOString(), last_confirmed_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    is_active: true, is_simulated: false, ...overrides,
  }
}

// ── MOCK MODE ──────────────────────────────────────────────────────────────
describe('POST /route-check — mock mode', () => {
  let app: express.Application
  let emptyStore: FloodStore
  let storeWithFlood: FloodStore

  beforeAll(async () => {
    process.env.DATA_MODE = 'mock'
    vi.resetModules()
    const mod = await import('../../routes/routeCheck.js')

    // store with no floods
    emptyStore = { base: [], simulated: [] }

    // store with a flood right on the Q7→Tân Bình route (midpoint ≈ 10.77, 106.69)
    storeWithFlood = {
      base: [makeFlood(10.7690, 106.6874)],
      simulated: [],
    }

    app = express()
    app.use(express.json())
    app.use('/', mod.default(emptyStore))
  })

  afterAll(() => {
    delete process.env.DATA_MODE
    vi.resetModules()
  })

  it('missing body → 400', async () => {
    const res = await request(app).post('/').send({})
    expect(res.status).toBe(400)
  })

  it('null origin → 400', async () => {
    const res = await request(app).post('/').send({ origin: null, destination: 'tân bình' })
    expect(res.status).toBe(400)
  })

  it('null destination → 400', async () => {
    const res = await request(app).post('/').send({ origin: 'q7', destination: null })
    expect(res.status).toBe(400)
  })

  it('unknown address that geocodes to null → 400', async () => {
    const res = await request(app).post('/').send({ origin: 'xyzzy-unknown', destination: 'tân bình' })
    expect(res.status).toBe(400)
  })

  it('valid string addresses → 200 with route coords', async () => {
    const res = await request(app).post('/').send({ origin: 'q7', destination: 'tân bình' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.route.coords.length).toBeGreaterThan(1)
  })

  it('valid LatLng objects → 200', async () => {
    const res = await request(app).post('/').send({
      origin: { lat: 10.7366, lng: 106.7222 },
      destination: { lat: 10.8015, lng: 106.6526 },
    })
    expect(res.status).toBe(200)
    expect(res.body.floodZones).toBeDefined()
  })

  it('no floods on route → empty floodZones and null alertText', async () => {
    const res = await request(app).post('/').send({ origin: 'q7', destination: 'tân bình' })
    expect(res.body.floodZones).toHaveLength(0)
    expect(res.body.alertText).toBeNull()
  })

  it('flood on route → non-empty floodZones and Vietnamese alertText', async () => {
    // build separate app with a flood store
    process.env.DATA_MODE = 'mock'
    const mod2 = await import('../../routes/routeCheck.js')
    const floodApp = express()
    floodApp.use(express.json())
    floodApp.use('/', mod2.default(storeWithFlood))

    const res = await request(floodApp).post('/').send({ origin: 'q7', destination: 'tân bình' })
    expect(res.status).toBe(200)
    expect(res.body.floodZones.length).toBeGreaterThan(0)
    expect(res.body.alertText).toMatch(/Cảnh báo/)
  })
})

// ── LIVE MODE ──────────────────────────────────────────────────────────────
describe('POST /route-check — live mode', () => {
  let app: express.Application

  beforeAll(async () => {
    process.env.DATA_MODE = 'live'
    vi.resetModules()
    const mod = await import('../../routes/routeCheck.js')
    app = express()
    app.use(express.json())
    app.use('/', mod.default({ base: [], simulated: [] }))
  })

  afterAll(() => {
    delete process.env.DATA_MODE
    vi.resetModules()
  })

  beforeEach(() => getSb().__resetAll())

  it('calls get_floods_in_bbox RPC and returns 200', async () => {
    getSb().rpc.mockResolvedValue({ data: [], error: null })
    const res = await request(app).post('/').send({ origin: 'hcmc', destination: 'bình thạnh' })
    expect(res.status).toBe(200)
    expect(getSb().rpc).toHaveBeenCalledWith('get_floods_in_bbox', expect.objectContaining({
      p_north: expect.any(Number),
      p_south: expect.any(Number),
    }))
  })

  it('Supabase RPC error → 500', async () => {
    getSb().rpc.mockResolvedValue({ data: null, error: new Error('RPC fail') })
    const res = await request(app).post('/').send({ origin: 'hcmc', destination: 'bình thạnh' })
    expect(res.status).toBe(500)
  })
})
