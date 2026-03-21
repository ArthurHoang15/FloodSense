import { createClient } from '@supabase/supabase-js'
import type { FloodEvent, FloodSource } from '../../shared/types.js'

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    )
  : null

export default supabase

// ─── Row mapper ────────────────────────────────────────────────────────────
// Supabase stores lat/lng as separate columns; FloodEvent uses coordinates:{lat,lng}
export function toFloodEvent(row: Record<string, unknown>): FloodEvent {
  const sources: FloodSource[] = ((row.flood_sources as Record<string, unknown>[] | null) ?? []).map(
    (s) => ({
      url: String(s.url ?? ''),
      title: String(s.title ?? ''),
      snippet: String(s.snippet ?? ''),
      published_at: String(s.published_at ?? new Date().toISOString()),
      source_type: s.source_type as FloodSource['source_type'],
    }),
  )

  return {
    id: String(row.id),
    street_name: String(row.street_name),
    district: String(row.district),
    city: String(row.city ?? 'HCMC'),
    coordinates: { lat: Number(row.lat), lng: Number(row.lng) },
    depth_cm: row.depth_cm != null ? Number(row.depth_cm) : null,
    severity: row.severity as FloodEvent['severity'],
    confidence: row.confidence as FloodEvent['confidence'],
    sources,
    first_detected_at: String(row.first_detected_at),
    last_confirmed_at: String(row.last_confirmed_at),
    expires_at: String(row.expires_at),
    is_active: Boolean(row.is_active),
    is_simulated: Boolean(row.is_simulated),
    is_forecast: Boolean(row.is_forecast ?? false),
    forecast_valid_until: row.forecast_valid_until != null ? String(row.forecast_valid_until) : undefined,
  }
}
