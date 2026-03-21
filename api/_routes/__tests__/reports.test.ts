import { beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import createFloodRoutes from '../../_routes/floods.js'
import createReportRoutes from '../../_routes/reports.js'
import type { FloodStore } from '../../_lib/mockData.js'

vi.mock('../../_lib/supabase.js', () => ({
  default: null,
}))

vi.mock('../../_lib/geocode.js', () => ({
  geocode: vi.fn(async (input: string) => {
    if (input.toLowerCase().includes('nguyen huu canh')) {
      return { lat: 10.7869, lng: 106.7218 }
    }
    return { lat: 10.7769, lng: 106.7009 }
  }),
}))

let app: express.Application
let store: FloodStore

beforeEach(() => {
  store = { base: [], simulated: [] }
  app = express()
  app.use(express.json())
  app.use('/report-flood', createReportRoutes(store))
  app.use('/floods', createFloodRoutes(store))
})

describe('POST /report-flood', () => {
  it('rejects invalid payloads', async () => {
    const res = await request(app).post('/report-flood').send({ severity: 'heavy' })
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('accepts a location text report and surfaces it as a flood signal', async () => {
    const createRes = await request(app)
      .post('/report-flood')
      .set('x-anonymous-id', 'anon-123')
      .send({
        locationText: 'Nguyen Huu Canh, Binh Thanh',
        severity: 'heavy',
        note: 'Ngap sau, xe may di rat cham',
      })

    expect(createRes.status).toBe(201)
    expect(createRes.body.success).toBe(true)
    expect(createRes.body.report.confirm_count).toBe(1)

    const floodsRes = await request(app).get('/floods')
    expect(floodsRes.status).toBe(200)
    expect(floodsRes.body.floods).toHaveLength(1)
    expect(floodsRes.body.floods[0]).toMatchObject({
      street_name: 'Nguyen Huu Canh',
      severity: 'heavy',
      confidence: 'low',
    })
    expect(floodsRes.body.floods[0].sources[0].source_type).toBe('user_report')
  })

  it('confirms a nearby repeat report in memory', async () => {
    await request(app)
      .post('/report-flood')
      .set('x-anonymous-id', 'anon-1')
      .send({ locationText: 'Nguyen Huu Canh, Binh Thanh', severity: 'moderate' })

    const secondRes = await request(app)
      .post('/report-flood')
      .set('x-anonymous-id', 'anon-2')
      .send({ locationText: 'Nguyen Huu Canh, Binh Thanh', severity: 'heavy' })

    expect(secondRes.status).toBe(201)
    expect(secondRes.body.report.confirm_count).toBe(2)
    expect(secondRes.body.report.status).toBe('confirmed')

    const floodsRes = await request(app).get('/floods')
    expect(floodsRes.body.floods[0].confidence).toBe('high')
  })
})

describe('GET /report-flood', () => {
  it('lists recent in-memory reports', async () => {
    await request(app)
      .post('/report-flood')
      .send({ locationText: 'Nguyen Huu Canh, Binh Thanh', severity: 'light' })

    const res = await request(app).get('/report-flood')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.reports).toHaveLength(1)
  })
})