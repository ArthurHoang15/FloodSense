import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import type { SupabaseMock } from '../../__tests__/helpers/supabaseMock.js'
import type { FloodStore } from '../../_lib/mockData.js'

vi.mock('../../_lib/supabase.js', async () => {
  const { makeSupabaseMock } = await import('../../__tests__/helpers/supabaseMock.js')
  const sb = makeSupabaseMock()
  ;(globalThis as Record<string, unknown>).__internalSb = sb
  return { default: sb, toFloodEvent: vi.fn((row: Record<string, unknown>) => row) }
})

vi.mock('../../_lib/exa.js', () => ({
  searchFloodNews: vi.fn().mockResolvedValue([]),
}))

vi.mock('../../_lib/openai.js', () => ({
  extractFloodData: vi.fn().mockResolvedValue([]),
}))

vi.mock('../../_lib/geocode.js', () => ({
  geocode: vi.fn().mockResolvedValue({ lat: 10.77, lng: 106.7 }),
  mockGeocode: vi.fn().mockReturnValue({ lat: 10.77, lng: 106.7 }),
}))

vi.mock('../../_lib/weatherEnrich.js', () => ({
  fetchEnrichedWeather: vi.fn().mockResolvedValue(null),
  clearWeatherCache: vi.fn(),
}))

vi.mock('../../_lib/floodRisk.js', () => ({
  computeFloodRisk: vi.fn().mockReturnValue({
    score: 0, level: 'low', peakHour: new Date().toISOString(), forecastDistricts: [],
  }),
}))

function getSb(): SupabaseMock {
  return (globalThis as Record<string, unknown>).__internalSb as SupabaseMock
}

const SECRET = 'test-internal-secret'
const CORRECT_HEADER = { 'x-internal-secret': SECRET }
const WRONG_HEADER = { 'x-internal-secret': 'wrong-secret' }

// ── MOCK MODE (simulate-rain, reset-simulated) ────────────────────────────
describe('internal routes — mock mode (DATA_MODE=mock)', () => {
  let app: express.Application
  const store: FloodStore = { base: [], simulated: [] }

  beforeAll(async () => {
    process.env.DATA_MODE = 'mock'
    process.env.INTERNAL_SECRET = SECRET
    vi.resetModules()
    const { default: createInternalRoutes } = await import('../../_routes/internal.js')
    app = express()
    app.use(express.json())
    app.use('/', createInternalRoutes(store))
  })

  afterAll(() => {
    delete process.env.DATA_MODE
    delete process.env.INTERNAL_SECRET
    vi.resetModules()
  })

  beforeEach(() => {
    store.base = []
    store.simulated = []
    getSb().__resetAll()
  })

  // simulate-rain
  it('POST /simulate-rain: wrong secret → 401', async () => {
    const res = await request(app).post('/simulate-rain').set(WRONG_HEADER).send({ preset: 'heavy_rain_hcmc' })
    expect(res.status).toBe(401)
  })

  it('POST /simulate-rain: correct secret, unknown preset → 400', async () => {
    const res = await request(app).post('/simulate-rain').set(CORRECT_HEADER).send({ preset: 'unknown_preset' })
    expect(res.status).toBe(400)
  })

  it('POST /simulate-rain: correct secret, heavy_rain_hcmc, enable=true → 200 with floods', async () => {
    const res = await request(app).post('/simulate-rain').set(CORRECT_HEADER).send({
      preset: 'heavy_rain_hcmc',
      enable: true,
    })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.enabled).toBe(true)
    expect(res.body.count).toBeGreaterThan(0)
    expect(Array.isArray(res.body.floods)).toBe(true)
  })

  it('POST /simulate-rain: enable=false → 200, count 0, empty floods', async () => {
    const res = await request(app).post('/simulate-rain').set(CORRECT_HEADER).send({
      preset: 'heavy_rain_hcmc',
      enable: false,
    })
    expect(res.status).toBe(200)
    expect(res.body.enabled).toBe(false)
    expect(res.body.count).toBe(0)
    expect(res.body.floods).toHaveLength(0)
  })

  it('POST /simulate-rain: defaults enable to true when omitted', async () => {
    const res = await request(app).post('/simulate-rain').set(CORRECT_HEADER).send({ preset: 'heavy_rain_hcmc' })
    expect(res.status).toBe(200)
    expect(res.body.enabled).toBe(true)
  })

  // reset-simulated
  it('POST /reset-simulated: wrong secret → 401', async () => {
    const res = await request(app).post('/reset-simulated').set(WRONG_HEADER)
    expect(res.status).toBe(401)
  })

  it('POST /reset-simulated: correct secret → 200', async () => {
    const res = await request(app).post('/reset-simulated').set(CORRECT_HEADER)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})

// ── No INTERNAL_SECRET (open dev mode) ────────────────────────────────────
describe('simulate-rain — no INTERNAL_SECRET configured', () => {
  let app: express.Application
  const store: FloodStore = { base: [], simulated: [] }

  beforeAll(async () => {
    delete process.env.INTERNAL_SECRET
    process.env.DATA_MODE = 'mock'
    vi.resetModules()
    const { default: createInternalRoutes } = await import('../../_routes/internal.js')
    app = express()
    app.use(express.json())
    app.use('/', createInternalRoutes(store))
  })

  afterAll(() => {
    delete process.env.DATA_MODE
    vi.resetModules()
  })

  it('no x-internal-secret header → 200 (open when no secret configured)', async () => {
    const res = await request(app).post('/simulate-rain').send({ preset: 'heavy_rain_hcmc' })
    expect(res.status).toBe(200)
  })
})

// ── LIVE MODE (run-pipeline, check-saved-routes) ──────────────────────────
describe('internal routes — live mode', () => {
  let app: express.Application
  const store: FloodStore = { base: [], simulated: [] }

  beforeAll(async () => {
    process.env.DATA_MODE = 'live'
    process.env.INTERNAL_SECRET = SECRET
    process.env.EXA_API_KEY = 'test-exa-key'
    vi.resetModules()
    const { default: createInternalRoutes } = await import('../../_routes/internal.js')
    app = express()
    app.use(express.json())
    app.use('/', createInternalRoutes(store))
  })

  afterAll(() => {
    delete process.env.DATA_MODE
    delete process.env.INTERNAL_SECRET
    delete process.env.EXA_API_KEY
    vi.resetModules()
  })

  beforeEach(() => getSb().__resetAll())

  // run-pipeline
  it('POST /run-pipeline: wrong secret → 401', async () => {
    const res = await request(app).post('/run-pipeline').set(WRONG_HEADER)
    expect(res.status).toBe(401)
  })

  it('POST /run-pipeline: correct secret, searchFloodNews returns [] → 200, 0 articles', async () => {
    // pipeline_runs insert and update
    getSb().__setTableResult('pipeline_runs', {
      data: { id: 'run-1' },
      error: null,
    })
    const res = await request(app).post('/run-pipeline').set(CORRECT_HEADER)
    expect(res.status).toBe(200)
    expect(res.body.articles_fetched).toBe(0)
    expect(res.body.new_floods).toBe(0)
  })

  it('POST /run-pipeline: pipeline_runs insert called with status running', async () => {
    getSb().__setTableResult('pipeline_runs', { data: { id: 'run-2' }, error: null })
    await request(app).post('/run-pipeline').set(CORRECT_HEADER)
    expect(getSb().from).toHaveBeenCalledWith('pipeline_runs')
  })

  // check-saved-routes
  it('POST /check-saved-routes: wrong secret → 401', async () => {
    const res = await request(app).post('/check-saved-routes').set(WRONG_HEADER).send({ flood_id: 'f-1' })
    expect(res.status).toBe(401)
  })

  it('POST /check-saved-routes: missing flood_id → 400', async () => {
    const res = await request(app).post('/check-saved-routes').set(CORRECT_HEADER).send({})
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('POST /check-saved-routes: no affected routes → notified: 0', async () => {
    getSb().rpc.mockResolvedValue({ data: [], error: null })
    const res = await request(app).post('/check-saved-routes').set(CORRECT_HEADER).send({ flood_id: 'f-1' })
    expect(res.status).toBe(200)
    expect(res.body.notified).toBe(0)
  })

  it('POST /check-saved-routes: affected routes → inserts alert_history, notified: 1', async () => {
    getSb().rpc.mockResolvedValue({
      data: [{ user_id: null, anonymous_id: 'anon-123', id: 'route-1', name: 'Home → Work' }],
      error: null,
    })
    getSb().__setTableResult('flood_events', {
      data: { street_name: 'Nguyễn Hữu Cảnh', district: 'Bình Thạnh', depth_cm: 45 },
      error: null,
    })
    getSb().__setTableResult('alert_history', { data: null, error: null })
    const res = await request(app).post('/check-saved-routes').set(CORRECT_HEADER).send({ flood_id: 'f-1' })
    expect(res.status).toBe(200)
    expect(res.body.notified).toBe(1)
    expect(getSb().from).toHaveBeenCalledWith('alert_history')
  })

  it('POST /check-saved-routes: RPC error → 500', async () => {
    getSb().rpc.mockResolvedValue({ data: null, error: new Error('RPC fail') })
    const res = await request(app).post('/check-saved-routes').set(CORRECT_HEADER).send({ flood_id: 'f-1' })
    expect(res.status).toBe(500)
  })
})

// ── PIPELINE ENRICHMENT ───────────────────────────────────────────────────
describe('POST /run-pipeline — forecast enrichment', () => {
  let enrichApp: express.Application
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fetchEnrichedWeather: any, computeFloodRisk: any, extractFloodData: any, searchFloodNews: any

  beforeAll(async () => {
    process.env.DATA_MODE = 'live'
    process.env.INTERNAL_SECRET = SECRET
    const { default: createInternalRoutes } = await import('../../_routes/internal.js')
    // Import AFTER internal.js so we get the same cached mock instances it uses
    fetchEnrichedWeather = (await import('../../_lib/weatherEnrich.js')).fetchEnrichedWeather
    computeFloodRisk = (await import('../../_lib/floodRisk.js')).computeFloodRisk
    extractFloodData = (await import('../../_lib/openai.js')).extractFloodData
    searchFloodNews = (await import('../../_lib/exa.js')).searchFloodNews
    enrichApp = express()
    enrichApp.use(express.json())
    enrichApp.use('/', createInternalRoutes({ base: [], simulated: [] }))
  })

  afterAll(() => {
    delete process.env.DATA_MODE
    delete process.env.INTERNAL_SECRET
  })

  beforeEach(() => {
    getSb().__resetAll()
    fetchEnrichedWeather.mockResolvedValue(null)
    computeFloodRisk.mockReturnValue({
      score: 0, level: 'low', peakHour: new Date().toISOString(), forecastDistricts: [],
    })
    searchFloodNews.mockResolvedValue([])
    extractFloodData.mockResolvedValue([])
    // pipeline_runs insert
    getSb().from().insert().select().single.mockResolvedValue({ data: { id: 'run-1' }, error: null })
    getSb().from().update().eq.mockResolvedValue({ data: null, error: null })
  })

  it('severity upgraded light→moderate when riskScore ≥ 60', async () => {
    searchFloodNews.mockResolvedValueOnce([
      { url: 'http://t.com', title: 'T', text: 'test', publishedDate: new Date().toISOString() },
    ])
    extractFloodData.mockResolvedValueOnce([{
      street_name: 'Đường Test', district: 'Quận 1', depth_cm: 10,
      severity: 'light', confidence: 'high',
      source_url: 'http://t.com', source_title: 'T', source_snippet: 't',
      published_at: new Date().toISOString(),
    }])
    fetchEnrichedWeather.mockResolvedValue({
      current: { time: '', temperature_c: 28, rain_mm: 5, wind_speed_kmh: 20, wind_gusts_kmh: 30, weather_code: 61 },
      hourly: Array(6).fill({ time: '', precipitation_probability: 70, rain_mm: 5, wind_gusts_kmh: 25, soil_moisture: 0.2 }),
      riverDischarge: [100, 100, 100, 100, 100, 100, 100],
      riverDischargeAvg: 100,
    })
    computeFloodRisk.mockReturnValue({
      score: 65, level: 'high', peakHour: new Date().toISOString(), forecastDistricts: [],
    })
    getSb().rpc.mockResolvedValue({ data: 'flood-id-1', error: null })
    getSb().from().insert.mockResolvedValue({ data: null, error: null })

    const res = await request(enrichApp).post('/run-pipeline').set(CORRECT_HEADER)

    expect(res.status).toBe(200)
    expect(getSb().rpc).toHaveBeenCalledWith('upsert_flood_event', expect.objectContaining({
      p_severity: 'moderate',
    }))
  })

  it('forecast events upserted via upsert_forecast_event when riskScore ≥ 80', async () => {
    const peakTime = new Date(Date.now() + 2 * 3600_000).toISOString()
    fetchEnrichedWeather.mockResolvedValue({
      current: { time: '', temperature_c: 28, rain_mm: 10, wind_speed_kmh: 25, wind_gusts_kmh: 40, weather_code: 61 },
      hourly: Array(6).fill({ time: '', precipitation_probability: 90, rain_mm: 10, wind_gusts_kmh: 40, soil_moisture: 0.35 }),
      riverDischarge: [200, 200, 200, 200, 200, 200, 200],
      riverDischargeAvg: 100,
    })
    computeFloodRisk.mockReturnValue({
      score: 85,
      level: 'critical',
      peakHour: peakTime,
      forecastDistricts: [
        { district: 'Quận Bình Thạnh', lat: 10.8124, lng: 106.7143, severity: 'heavy', districtScore: 95 },
        { district: 'Quận 8', lat: 10.7230, lng: 106.6285, severity: 'moderate', districtScore: 88 },
      ],
    })
    getSb().rpc.mockResolvedValue({ data: null, error: null })

    const res = await request(enrichApp).post('/run-pipeline').set(CORRECT_HEADER)

    expect(res.status).toBe(200)
    expect(getSb().rpc).toHaveBeenCalledWith('upsert_forecast_event', expect.objectContaining({
      p_district: 'Quận Bình Thạnh',
      p_severity: 'heavy',
      p_forecast_valid_until: expect.any(String),
    }))
  })
})
