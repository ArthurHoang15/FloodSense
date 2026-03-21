import { describe, it, expect, vi, beforeAll } from 'vitest'
import express from 'express'
import request from 'supertest'

const searchAddressSuggestionsMock = vi.fn()

vi.mock('../../_lib/geocode.js', () => ({
  geocode: vi.fn(),
  mockGeocode: vi.fn(),
  searchAddressSuggestions: searchAddressSuggestionsMock,
}))

describe('GET /locations/search', () => {
  let app: express.Application

  beforeAll(async () => {
    const mod = await import('../../_routes/locations.js')
    app = express()
    app.use('/', mod.default())
  })

  it('returns empty suggestions for short query', async () => {
    const res = await request(app).get('/search?q=ab')
    expect(res.status).toBe(200)
    expect(searchAddressSuggestionsMock).not.toHaveBeenCalled()
    expect(res.body.suggestions).toEqual([])
  })

  it('returns mapped suggestions for valid query', async () => {
    searchAddressSuggestionsMock.mockResolvedValueOnce([
      {
        id: 'poi.123',
        label: 'Nguyen Hue, District 1, Ho Chi Minh City',
        coordinates: { lat: 10.7741, lng: 106.7039 },
      },
    ])

    const res = await request(app).get('/search?q=nguyen%20hue')
    expect(res.status).toBe(200)
    expect(searchAddressSuggestionsMock).toHaveBeenCalledWith('nguyen hue')
    expect(res.body.suggestions).toHaveLength(1)
  })
})