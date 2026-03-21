import { describe, it, expect, vi } from 'vitest'

// Mock createClient so supabase.ts doesn't require real env vars
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({})),
}))

const { toFloodEvent } = await import('../supabase.js')

function baseRow(): Record<string, unknown> {
  return {
    id: 'abc-123',
    street_name: 'Nguyễn Hữu Cảnh',
    district: 'Bình Thạnh',
    city: 'HCMC',
    lat: 10.7889,
    lng: 106.7211,
    depth_cm: 45,
    severity: 'heavy',
    confidence: 'high',
    flood_sources: [],
    first_detected_at: '2026-03-21T09:12:00Z',
    last_confirmed_at: '2026-03-21T09:20:00Z',
    expires_at: '2026-03-21T11:12:00Z',
    is_active: true,
    is_simulated: false,
    is_forecast: false,
    forecast_valid_until: null,
  }
}

describe('toFloodEvent', () => {
  it('maps is_forecast: false correctly', () => {
    const result = toFloodEvent(baseRow())
    expect(result.is_forecast).toBe(false)
  })

  it('maps is_forecast: true correctly', () => {
    const result = toFloodEvent({ ...baseRow(), is_forecast: true })
    expect(result.is_forecast).toBe(true)
  })

  it('maps null is_forecast to false (pre-migration rows)', () => {
    const result = toFloodEvent({ ...baseRow(), is_forecast: null })
    expect(result.is_forecast).toBe(false)
  })

  it('maps forecast_valid_until ISO string', () => {
    const ts = '2026-03-21T15:00:00Z'
    const result = toFloodEvent({ ...baseRow(), is_forecast: true, forecast_valid_until: ts })
    expect(result.forecast_valid_until).toBe(ts)
  })

  it('maps null forecast_valid_until to undefined', () => {
    const result = toFloodEvent(baseRow())
    expect(result.forecast_valid_until).toBeUndefined()
  })
})
