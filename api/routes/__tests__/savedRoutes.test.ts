import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import type { SupabaseMock } from '../../__tests__/helpers/supabaseMock.js'

vi.mock('../../lib/supabase.js', async () => {
  const { makeSupabaseMock } = await import('../../__tests__/helpers/supabaseMock.js')
  const sb = makeSupabaseMock()
  ;(globalThis as Record<string, unknown>).__savedSb = sb
  return { default: sb, toFloodEvent: vi.fn((row: Record<string, unknown>) => row) }
})

function getSb(): SupabaseMock {
  return (globalThis as Record<string, unknown>).__savedSb as SupabaseMock
}

const ANON_ID = 'test-anon-id-123'

const ROUTE_ROW = {
  id: 'route-1', name: 'Home → Work',
  origin_lat: 10.73, origin_lng: 106.72, origin_address: 'Q7',
  destination_lat: 10.80, destination_lng: 106.65, destination_address: 'Tân Bình',
  route_polyline: JSON.stringify([{ lat: 10.73, lng: 106.72 }]),
  bbox_north: 10.80, bbox_south: 10.73, bbox_east: 106.72, bbox_west: 106.65,
  notify_enabled: true, created_at: new Date().toISOString(),
}

const VALID_BODY = {
  name: 'Home → Work',
  origin: { lat: 10.73, lng: 106.72, address: 'Q7' },
  destination: { lat: 10.80, lng: 106.65, address: 'Tân Bình' },
  route_polyline: JSON.stringify([{ lat: 10.73, lng: 106.72 }]),
  bounding_box: { north: 10.80, south: 10.73, east: 106.72, west: 106.65 },
  notify_enabled: true,
}

let app: express.Application

beforeAll(async () => {
  const { default: createSavedRoutesRoutes } = await import('../../routes/savedRoutes.js')
  app = express()
  app.use(express.json())
  app.use('/', createSavedRoutesRoutes())
})

beforeEach(() => getSb().__resetAll())

// ── GET / ──────────────────────────────────────────────────────────────────
describe('GET /saved-routes', () => {
  it('no x-anonymous-id → 200 with empty routes', async () => {
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true, routes: [] })
  })

  it('with anonymous-id → returns Supabase rows', async () => {
    getSb().__setTableResult('saved_routes', { data: [ROUTE_ROW], error: null })
    const res = await request(app).get('/').set('x-anonymous-id', ANON_ID)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.routes).toHaveLength(1)
  })

  it('Supabase error → 500', async () => {
    getSb().__setTableResult('saved_routes', { data: null, error: new Error('DB down') })
    const res = await request(app).get('/').set('x-anonymous-id', ANON_ID)
    expect(res.status).toBe(500)
    expect(res.body.success).toBe(false)
  })
})

// ── POST / ────────────────────────────────────────────────────────────────
describe('POST /saved-routes', () => {
  it('no x-anonymous-id → 400', async () => {
    const res = await request(app).post('/').send(VALID_BODY)
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('valid body + anonymous-id → 201 with route', async () => {
    getSb().__setTableResult('saved_routes', { data: ROUTE_ROW, error: null })
    const res = await request(app)
      .post('/')
      .set('x-anonymous-id', ANON_ID)
      .send(VALID_BODY)
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.route).toBeDefined()
  })

  it('Supabase insert error → 500', async () => {
    getSb().__setTableResult('saved_routes', { data: null, error: new Error('insert fail') })
    const res = await request(app)
      .post('/')
      .set('x-anonymous-id', ANON_ID)
      .send(VALID_BODY)
    expect(res.status).toBe(500)
  })
})

// ── PATCH /:id ────────────────────────────────────────────────────────────
describe('PATCH /saved-routes/:id', () => {
  it('body missing notify_enabled → 400', async () => {
    const res = await request(app).patch('/route-1').send({})
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('valid notify_enabled → 200', async () => {
    getSb().__setTableResult('saved_routes', { data: null, error: null })
    const res = await request(app)
      .patch('/route-1')
      .set('x-anonymous-id', ANON_ID)
      .send({ notify_enabled: false })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('Supabase error → 500', async () => {
    getSb().__setTableResult('saved_routes', { data: null, error: new Error('update fail') })
    const res = await request(app)
      .patch('/route-1')
      .set('x-anonymous-id', ANON_ID)
      .send({ notify_enabled: true })
    expect(res.status).toBe(500)
  })

  it('notify_enabled = true (boolean, not string) accepted', async () => {
    getSb().__setTableResult('saved_routes', { data: null, error: null })
    const res = await request(app)
      .patch('/route-1')
      .set('x-anonymous-id', ANON_ID)
      .send({ notify_enabled: true })
    expect(res.status).toBe(200)
  })
})

// ── DELETE /:id ───────────────────────────────────────────────────────────
describe('DELETE /saved-routes/:id', () => {
  it('valid delete → 200', async () => {
    getSb().__setTableResult('saved_routes', { data: null, error: null })
    const res = await request(app)
      .delete('/route-1')
      .set('x-anonymous-id', ANON_ID)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('no anonymous-id → still 200 (deletes with empty owner id)', async () => {
    getSb().__setTableResult('saved_routes', { data: null, error: null })
    const res = await request(app).delete('/route-1')
    expect(res.status).toBe(200)
  })

  it('Supabase error → 500', async () => {
    getSb().__setTableResult('saved_routes', { data: null, error: new Error('delete fail') })
    const res = await request(app).delete('/route-1').set('x-anonymous-id', ANON_ID)
    expect(res.status).toBe(500)
  })
})
