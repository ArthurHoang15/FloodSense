import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import type { SupabaseMock } from '../../__tests__/helpers/supabaseMock.js'

vi.mock('../../_lib/supabase.js', async () => {
  const { makeSupabaseMock } = await import('../../__tests__/helpers/supabaseMock.js')
  const sb = makeSupabaseMock()
  ;(globalThis as Record<string, unknown>).__routeHistorySb = sb
  return { default: sb, toFloodEvent: vi.fn((row: Record<string, unknown>) => row) }
})

function getSb(): SupabaseMock {
  return (globalThis as Record<string, unknown>).__routeHistorySb as SupabaseMock
}

const ANON_ID = 'route-history-anon'

let app: express.Application

beforeAll(async () => {
  const { default: createRouteHistoryRoutes } = await import('../../_routes/routeHistory.js')
  app = express()
  app.use(express.json())
  app.use('/', createRouteHistoryRoutes())
})

beforeEach(() => getSb().__resetAll())

describe('GET /route-history', () => {
  it('no x-anonymous-id -> 200 with empty history', async () => {
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true, history: [] })
  })

  it('returns mapped history rows', async () => {
    getSb().__setTableResult('route_check_history', {
      data: [
        {
          id: 'h-1',
          checked_at: new Date().toISOString(),
          origin_label: 'A',
          destination_label: 'B',
          risk_level: 'medium',
          confirmed_flood_count: 1,
          forecast_flood_count: 2,
          has_alternative_route: true,
          result_json: {
            route: { coords: [], bounding_box: { north: 0, south: 0, east: 0, west: 0 } },
            floodZones: [],
            warnings: [],
            alertText: null,
            forecast: null,
          },
        },
      ],
      error: null,
    })

    const res = await request(app).get('/').set('x-anonymous-id', ANON_ID)

    expect(res.status).toBe(200)
    expect(res.body.history).toHaveLength(1)
    expect(res.body.history[0].origin_label).toBe('A')
  })
})

describe('POST /route-history/bulk', () => {
  it('no x-anonymous-id -> 400', async () => {
    const res = await request(app).post('/bulk').send({ entries: [] })
    expect(res.status).toBe(400)
  })

  it('valid entries -> 200', async () => {
    getSb().__setTableResult('route_check_history', { data: null, error: null })
    const res = await request(app)
      .post('/bulk')
      .set('x-anonymous-id', ANON_ID)
      .send({
        entries: [
          {
            id: 'h-1',
            checked_at: new Date().toISOString(),
            origin_label: 'A',
            destination_label: 'B',
            risk_level: 'low',
            confirmed_flood_count: 0,
            forecast_flood_count: 1,
            has_alternative_route: false,
            result: {
              route: { coords: [], bounding_box: { north: 0, south: 0, east: 0, west: 0 } },
              floodZones: [],
              warnings: [],
              alertText: null,
              forecast: null,
            },
          },
        ],
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(getSb().from).toHaveBeenCalledWith('route_check_history')
  })
})
