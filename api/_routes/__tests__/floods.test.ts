import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import type { SupabaseMock } from '../../__tests__/helpers/supabaseMock.js'
import type { FloodStore } from '../../_lib/mockData.js'

// ── Supabase mock (hoisted) ────────────────────────────────────────────────
vi.mock('../../_lib/supabase.js', async () => {
  const { makeSupabaseMock } = await import('../../__tests__/helpers/supabaseMock.js')
  const sb = makeSupabaseMock()
  ;(globalThis as Record<string, unknown>).__floodsSb = sb
  return { default: sb, toFloodEvent: vi.fn((row: Record<string, unknown>) => row) }
})

function getSb(): SupabaseMock {
  return (globalThis as Record<string, unknown>).__floodsSb as SupabaseMock
}

function makeFlood(overrides = {}) {
  return {
    id: 'f-1', street_name: 'Nguyễn Hữu Cảnh', district: 'Bình Thạnh', city: 'HCMC',
    coordinates: { lat: 10.8032, lng: 106.7078 }, depth_cm: 40,
    severity: 'heavy' as const, confidence: 'high' as const, sources: [],
    first_detected_at: new Date().toISOString(), last_confirmed_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    is_active: true, is_simulated: false, ...overrides,
  }
}

// ── LIVE MODE ──────────────────────────────────────────────────────────────
describe('GET /floods — live mode', () => {
  let app: express.Application
  let createFloodRoutes: (store: FloodStore) => express.Router
  const store: FloodStore = { base: [], simulated: [] }

  beforeAll(async () => {
    process.env.DATA_MODE = 'live'
    vi.resetModules()
    const mod = await import('../../_routes/floods.js')
    createFloodRoutes = mod.default
    app = express()
    app.use(express.json())
    app.use('/', createFloodRoutes(store))
  })

  afterAll(() => {
    delete process.env.DATA_MODE
    vi.resetModules()
  })

  beforeEach(() => {
    getSb().__resetAll()
  })

  it('returns 200 with mapped flood events', async () => {
    getSb().__setTableResult('flood_events', { data: [makeFlood()], error: null })
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.floods)).toBe(true)
    expect(res.body.floods).toHaveLength(1)
  })

  it('calls expire_flood_events RPC before querying', async () => {
    getSb().__setTableResult('flood_events', { data: [], error: null })
    await request(app).get('/')
    expect(getSb().rpc).toHaveBeenCalledWith('expire_flood_events')
  })

  it('returns empty array when Supabase returns no data', async () => {
    getSb().__setTableResult('flood_events', { data: [], error: null })
    const res = await request(app).get('/')
    expect(res.body.floods).toHaveLength(0)
  })

  it('?severity=heavy applies eq filter', async () => {
    getSb().__setTableResult('flood_events', { data: [], error: null })
    await request(app).get('/?severity=heavy')
    const fromCall = getSb().from.mock.calls[0]
    expect(fromCall?.[0]).toBe('flood_events')
  })

  it('?severity=all skips severity filter', async () => {
    getSb().__setTableResult('flood_events', { data: [], error: null })
    const res = await request(app).get('/?severity=all')
    expect(res.status).toBe(200)
  })

  it('returns 500 on Supabase error', async () => {
    getSb().__setTableResult('flood_events', { data: null, error: new Error('DB error') })
    const res = await request(app).get('/')
    expect(res.status).toBe(500)
    expect(res.body.success).toBe(false)
  })

  it('response includes now timestamp', async () => {
    getSb().__setTableResult('flood_events', { data: [], error: null })
    const res = await request(app).get('/')
    expect(res.body.now).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

// ── MOCK MODE ──────────────────────────────────────────────────────────────
describe('GET /floods — mock mode', () => {
  let app: express.Application

  beforeAll(async () => {
    process.env.DATA_MODE = 'mock'
    vi.resetModules()
    const mod = await import('../../_routes/floods.js')
    const now = new Date(Date.now() + 3_600_000).toISOString()
    const store: FloodStore = {
      base: [
        makeFlood({ id: 'f-1', district: 'Bình Thạnh', severity: 'heavy', expires_at: now }),
        makeFlood({ id: 'f-2', district: 'Gò Vấp', severity: 'light', expires_at: now }),
      ],
      simulated: [],
    }
    app = express()
    app.use(express.json())
    app.use('/', mod.default(store))
  })

  afterAll(() => {
    delete process.env.DATA_MODE
    vi.resetModules()
  })

  it('returns 200 with in-memory floods', async () => {
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.body.floods).toHaveLength(2)
  })

  it('?district=bình thạnh filters by district', async () => {
    const res = await request(app).get('/?district=bình thạnh')
    expect(res.status).toBe(200)
    expect(res.body.floods.every((f: { district: string }) => f.district === 'Bình Thạnh')).toBe(true)
  })

  it('?severity=heavy filters by severity', async () => {
    const res = await request(app).get('/?severity=heavy')
    expect(res.body.floods.every((f: { severity: string }) => f.severity === 'heavy')).toBe(true)
  })

  it('empty store returns empty array', async () => {
    process.env.DATA_MODE = 'mock'
    const mod2 = await import('../../_routes/floods.js')
    const emptyApp = express()
    emptyApp.use(express.json())
    emptyApp.use('/', mod2.default({ base: [], simulated: [] }))
    const res = await request(emptyApp).get('/')
    expect(res.body.floods).toHaveLength(0)
  })
})
