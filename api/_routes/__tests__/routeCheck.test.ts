import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import type { SupabaseMock } from '../../__tests__/helpers/supabaseMock.js'
import type { FloodStore } from '../../_lib/mockData.js'

const getDrivingRouteMock = vi.fn()
const getRouteAlternativesMock = vi.fn()

vi.mock('../../_lib/weatherEnrich.js', () => ({
  fetchEnrichedWeather: vi.fn().mockResolvedValue(null),
  clearWeatherCache: vi.fn(),
}))

vi.mock('../../_lib/directions.js', () => ({
  getDrivingRoute: getDrivingRouteMock,
  getRouteAlternatives: getRouteAlternativesMock,
}))

vi.mock('../../_lib/supabase.js', async () => {
  const { makeSupabaseMock } = await import('../../__tests__/helpers/supabaseMock.js')
  const sb = makeSupabaseMock()
  ;(globalThis as Record<string, unknown>).__routeSb = sb
  return { default: sb, toFloodEvent: vi.fn((row: Record<string, unknown>) => row) }
})

// geocode mock — used in live mode
vi.mock('../../_lib/geocode.js', () => ({
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
    is_active: true, is_simulated: false, is_forecast: false, ...overrides,
  }
}

// ── MOCK MODE ──────────────────────────────────────────────────────────────
describe('POST /route-check — mock mode', () => {
  let app: express.Application
  let emptyStore: FloodStore
  let storeWithFlood: FloodStore

  beforeAll(async () => {
    process.env.DATA_MODE = 'mock'
    getDrivingRouteMock.mockResolvedValue(null)
    const mod = await import('../../_routes/routeCheck.js')

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
    getDrivingRouteMock.mockReset()
  })

  beforeEach(() => {
    getDrivingRouteMock.mockResolvedValue(null)
    getRouteAlternativesMock.mockResolvedValue(null)
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
    const mod2 = await import('../../_routes/routeCheck.js')
    const floodApp = express()
    floodApp.use(express.json())
    floodApp.use('/', mod2.default(storeWithFlood))

    const res = await request(floodApp).post('/').send({ origin: 'q7', destination: 'tân bình' })
    expect(res.status).toBe(200)
    expect(res.body.floodZones.length).toBeGreaterThan(0)
    expect(res.body.alertText).toMatch(/Cảnh báo/)
  })

  it('uses mapbox directions geometry when available', async () => {
    getDrivingRouteMock.mockResolvedValueOnce([
      { lat: 10.7366, lng: 106.7222 },
      { lat: 10.742, lng: 106.71 },
      { lat: 10.759, lng: 106.689 },
      { lat: 10.781, lng: 106.668 },
      { lat: 10.8015, lng: 106.6526 },
    ])

    const res = await request(app).post('/').send({ origin: 'q7', destination: 'tân bình' })

    expect(res.status).toBe(200)
    expect(res.body.route.coords).toEqual([
      { lat: 10.7366, lng: 106.7222 },
      { lat: 10.742, lng: 106.71 },
      { lat: 10.759, lng: 106.689 },
      { lat: 10.781, lng: 106.668 },
      { lat: 10.8015, lng: 106.6526 },
    ])
  })
})

// ── LIVE MODE ──────────────────────────────────────────────────────────────
describe('POST /route-check — live mode', () => {
  let app: express.Application

  beforeAll(async () => {
    process.env.DATA_MODE = 'live'
    getDrivingRouteMock.mockResolvedValue(null)
    const mod = await import('../../_routes/routeCheck.js')
    app = express()
    app.use(express.json())
    app.use('/', mod.default({ base: [], simulated: [] }))
  })

  afterAll(() => {
    delete process.env.DATA_MODE
    getDrivingRouteMock.mockReset()
  })

  beforeEach(() => {
    getSb().__resetAll()
    getDrivingRouteMock.mockResolvedValue(null)
    getRouteAlternativesMock.mockResolvedValue(null)
  })

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

// ── FORECAST WARNINGS ─────────────────────────────────────────────────────
describe('POST /route-check — forecast flood warnings', () => {
  let forecastApp: express.Application
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fetchEnrichedWeather: any

  function makeForecastFlood(district: string) {
    return {
      id: 'forecast-1',
      street_name: `Khu vực ${district}`,
      district,
      city: 'Thành phố Hồ Chí Minh',
      // Place near midpoint of hcmc→bình thạnh route so it intersects
      coordinates: { lat: 10.7900, lng: 106.7044 },
      depth_cm: null,
      severity: 'moderate' as const,
      confidence: 'medium' as const,
      sources: [],
      first_detected_at: new Date().toISOString(),
      last_confirmed_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 3 * 3600_000).toISOString(),
      is_active: true,
      is_simulated: false,
      is_forecast: true,
      forecast_valid_until: new Date(Date.now() + 3 * 3600_000).toISOString(),
    }
  }

  beforeAll(async () => {
    process.env.DATA_MODE = 'live'
    getDrivingRouteMock.mockResolvedValue(null)
    getRouteAlternativesMock.mockResolvedValue(null)
    const mod = await import('../../_routes/routeCheck.js')
    fetchEnrichedWeather = (await import('../../_lib/weatherEnrich.js')).fetchEnrichedWeather
    forecastApp = express()
    forecastApp.use(express.json())
    forecastApp.use('/', mod.default({ base: [], simulated: [] }))
  })

  afterAll(() => { delete process.env.DATA_MODE })

  beforeEach(() => {
    getSb().__resetAll()
    getDrivingRouteMock.mockResolvedValue(null)
    getRouteAlternativesMock.mockResolvedValue(null)
    fetchEnrichedWeather.mockResolvedValue(null)
  })

  // Use LatLng objects to avoid geocode mock returning same point for both addresses
  const ORIGIN = { lat: 10.7769, lng: 106.7009 }      // HCMC
  const DESTINATION = { lat: 10.8032, lng: 106.7078 }  // Bình Thạnh

  it('forecast flood in bbox → forecast warning in warnings[] but not in floodZones', async () => {
    const forecastFlood = makeForecastFlood('Quận Bình Thạnh')
    getSb().rpc.mockResolvedValue({ data: [forecastFlood], error: null })

    const res = await request(forecastApp).post('/').send({ origin: ORIGIN, destination: DESTINATION })

    expect(res.status).toBe(200)
    expect(res.body.floodZones.filter((f: { is_forecast?: boolean }) => f.is_forecast)).toHaveLength(0)
    const hasWarning = res.body.warnings.some((w: string) => w.includes('nguy cơ ngập'))
    expect(hasWarning).toBe(true)
  })

  it('forecast warning includes rainfall mm when weather available', async () => {
    const forecastFlood = makeForecastFlood('Quận Bình Thạnh')
    getSb().rpc.mockResolvedValue({ data: [forecastFlood], error: null })
    fetchEnrichedWeather.mockResolvedValue({
      current: { time: '', temperature_c: 28, rain_mm: 5, wind_speed_kmh: 20, wind_gusts_kmh: 30, weather_code: 61 },
      hourly: [
        { time: '', precipitation_probability: 70, rain_mm: 8, wind_gusts_kmh: 25, soil_moisture: 0.2 },
        { time: '', precipitation_probability: 80, rain_mm: 12, wind_gusts_kmh: 30, soil_moisture: 0.25 },
      ],
      riverDischarge: [100, 100, 100, 100, 100, 100, 100],
      riverDischargeAvg: 100,
    })

    const res = await request(forecastApp).post('/').send({ origin: ORIGIN, destination: DESTINATION })

    expect(res.status).toBe(200)
    const forecastWarning = res.body.warnings.find((w: string) => w.includes('nguy cơ ngập'))
    expect(forecastWarning).toMatch(/mm/)
  })

  it('forecast warning falls back to generic string when weather unavailable', async () => {
    const forecastFlood = makeForecastFlood('Quận Bình Thạnh')
    getSb().rpc.mockResolvedValue({ data: [forecastFlood], error: null })
    fetchEnrichedWeather.mockResolvedValue(null)

    const res = await request(forecastApp).post('/').send({ origin: ORIGIN, destination: DESTINATION })

    const forecastWarning = res.body.warnings.find((w: string) => w.includes('nguy cơ ngập'))
    expect(forecastWarning).toMatch(/dự báo thời tiết/)
    expect(forecastWarning).not.toMatch(/mm/)
  })
})
