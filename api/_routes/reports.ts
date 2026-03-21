import { randomUUID } from 'crypto'
import express, { type Request, type Response } from 'express'
import { haversineMeters } from '../_lib/geo.js'
import { geocode } from '../_lib/geocode.js'
import type { FloodStore } from '../_lib/mockData.js'
import supabase from '../_lib/supabase.js'
import type { FloodEvent, FloodSource, ReportFloodRequest, Severity, UserReport } from '../../shared/types.js'

const CONFIRM_RADIUS_METERS = 200
const REPORT_TTL_MS = 2 * 60 * 60 * 1000

const DISTRICT_NAMES = [
  'Bình Thạnh', 'Gò Vấp', 'Tân Phú', 'Phú Nhuận', 'Bình Tân',
  'Tân Bình', 'Quận 7', 'Quận 10', 'Quận 12', 'Thủ Đức',
  'Quận 1', 'Quận 2', 'Quận 3', 'Quận 4', 'Quận 5',
  'Quận 6', 'Quận 8', 'Quận 9', 'Quận 11',
  'Bình Chánh', 'Nhà Bè', 'Hóc Môn', 'Củ Chi', 'Cần Giờ',
]

type InMemoryReport = UserReport

function getAnonId(req: Request): string | null {
  return (req.headers['x-anonymous-id'] as string) || null
}

function isSeverity(value: unknown): value is Severity {
  return value === 'heavy' || value === 'moderate' || value === 'light'
}

function severityDepth(severity: Severity): number {
  if (severity === 'heavy') return 45
  if (severity === 'moderate') return 25
  return 10
}

function severityRank(severity: Severity): number {
  if (severity === 'heavy') return 3
  if (severity === 'moderate') return 2
  return 1
}

function inferDistrict(locationText?: string | null): string {
  if (!locationText) return 'HCMC'
  const lower = locationText.toLowerCase()
  const match = DISTRICT_NAMES.find((district) => lower.includes(district.toLowerCase()))
  return match ?? 'HCMC'
}

function inferStreetName(locationText?: string | null): string {
  if (!locationText) return 'User-reported hotspot'
  return locationText.split(',')[0]?.trim() || 'User-reported hotspot'
}

function reportSource(report: UserReport): FloodSource {
  return {
    url: `user-report://${report.id}`,
    title: report.location_text ?? 'Crowdsourced flood report',
    snippet: report.note ?? 'Flood report submitted from FloodSense client.',
    published_at: report.created_at,
    source_type: 'user_report',
  }
}

function toFloodEvent(report: UserReport, existing: FloodEvent | null): FloodEvent {
  const source = reportSource(report)
  const now = report.created_at
  const nextSeverity = existing && severityRank(existing.severity) > severityRank(report.severity)
    ? existing.severity
    : report.severity
  const nextSources = existing
    ? [...existing.sources, source]
    : [source]

  return {
    id: existing?.id ?? `user-report-${report.id}`,
    street_name: inferStreetName(report.location_text),
    district: inferDistrict(report.location_text),
    city: 'HCMC',
    coordinates: report.coordinates,
    depth_cm: Math.max(existing?.depth_cm ?? 0, severityDepth(report.severity)),
    severity: nextSeverity,
    confidence: report.confirm_count >= 2 ? 'high' : 'low',
    sources: nextSources,
    first_detected_at: existing?.first_detected_at ?? now,
    last_confirmed_at: now,
    expires_at: new Date(new Date(now).getTime() + REPORT_TTL_MS).toISOString(),
    is_active: true,
    is_simulated: false,
  }
}

function upsertStoreFlood(store: FloodStore, report: UserReport) {
  const existingIndex = store.base.findIndex((event) =>
    haversineMeters(event.coordinates, report.coordinates) <= CONFIRM_RADIUS_METERS,
  )

  if (existingIndex >= 0) {
    store.base[existingIndex] = toFloodEvent(report, store.base[existingIndex])
    return store.base[existingIndex]
  }

  const next = toFloodEvent(report, null)
  store.base.unshift(next)
  return next
}

async function resolveCoordinates(body: ReportFloodRequest): Promise<{ lat: number; lng: number } | null> {
  const lat = typeof body.lat === 'number' ? body.lat : Number(body.lat)
  const lng = typeof body.lng === 'number' ? body.lng : Number(body.lng)

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng }
  }

  if (!body.locationText?.trim()) {
    return null
  }

  return geocode(body.locationText.trim())
}

export default function createReportRoutes(store: FloodStore): express.Router {
  const router = express.Router()
  const reports: InMemoryReport[] = []

  router.get('/', async (req: Request, res: Response) => {
    const limit = Math.max(1, Math.min(20, Number(req.query.limit ?? 10)))

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('user_reports')
          .select('id, anonymous_id, lat, lng, severity, note, status, confirm_count, flood_event_id, created_at')
          .order('created_at', { ascending: false })
          .limit(limit)
        if (error) throw error

        const normalized = (data ?? []).map((row) => ({
          id: String((row as Record<string, unknown>).id),
          anonymous_id: ((row as Record<string, unknown>).anonymous_id as string | null) ?? null,
          coordinates: {
            lat: Number((row as Record<string, unknown>).lat),
            lng: Number((row as Record<string, unknown>).lng),
          },
          severity: (row as Record<string, unknown>).severity as Severity,
          note: ((row as Record<string, unknown>).note as string | null) ?? null,
          location_text: null,
          status: (row as Record<string, unknown>).status as UserReport['status'],
          confirm_count: Number((row as Record<string, unknown>).confirm_count ?? 1),
          flood_event_id: ((row as Record<string, unknown>).flood_event_id as string | null) ?? null,
          created_at: String((row as Record<string, unknown>).created_at),
        }))

        res.status(200).json({ success: true, reports: normalized })
        return
      } catch (error) {
        console.error('[report-flood GET] error:', error)
        res.status(500).json({ success: false, error: 'Failed to load reports' })
        return
      }
    }

    res.status(200).json({ success: true, reports: reports.slice(0, limit) })
  })

  router.post('/', async (req: Request, res: Response) => {
    const body = req.body as ReportFloodRequest
    if (!isSeverity(body?.severity)) {
      res.status(400).json({ success: false, error: 'severity must be heavy, moderate, or light' })
      return
    }

    const coordinates = await resolveCoordinates(body)
    if (!coordinates) {
      res.status(400).json({ success: false, error: 'Valid lat/lng or locationText is required' })
      return
    }

    const anonId = getAnonId(req)
    const createdAt = new Date().toISOString()

    if (supabase) {
      try {
        const insertPayload = {
          anonymous_id: anonId,
          lat: coordinates.lat,
          lng: coordinates.lng,
          severity: body.severity,
          note: body.note?.trim() || null,
        }

        const { data, error } = await supabase
          .from('user_reports')
          .insert(insertPayload)
          .select('id, anonymous_id, lat, lng, severity, note, status, confirm_count, flood_event_id, created_at')
          .single()
        if (error) throw error

        const streetName = inferStreetName(body.locationText)
        const district = inferDistrict(body.locationText)
        void Promise.resolve(
          supabase.rpc('upsert_flood_event', {
            p_street_name: streetName,
            p_district: district,
            p_lat: coordinates.lat,
            p_lng: coordinates.lng,
            p_depth_cm: severityDepth(body.severity),
            p_severity: body.severity,
            p_confidence: 'low',
            p_is_simulated: false,
          }),
        ).catch((rpcError) => console.warn('[report-flood POST] promotion failed:', rpcError))

        res.status(201).json({
          success: true,
          report: {
            id: String((data as Record<string, unknown>).id),
            anonymous_id: ((data as Record<string, unknown>).anonymous_id as string | null) ?? null,
            coordinates,
            severity: body.severity,
            note: body.note?.trim() || null,
            location_text: body.locationText?.trim() || null,
            status: (data as Record<string, unknown>).status as UserReport['status'],
            confirm_count: Number((data as Record<string, unknown>).confirm_count ?? 1),
            flood_event_id: ((data as Record<string, unknown>).flood_event_id as string | null) ?? null,
            created_at: String((data as Record<string, unknown>).created_at ?? createdAt),
          },
        })
        return
      } catch (error) {
        console.error('[report-flood POST] error:', error)
        res.status(500).json({ success: false, error: 'Failed to submit report' })
        return
      }
    }

    const nearby = reports.find((report) => {
      const reportAge = Date.now() - new Date(report.created_at).getTime()
      return reportAge <= REPORT_TTL_MS && haversineMeters(report.coordinates, coordinates) <= CONFIRM_RADIUS_METERS
    })

    if (nearby) {
      nearby.confirm_count += 1
      nearby.status = nearby.confirm_count >= 2 ? 'confirmed' : 'pending'
      nearby.note = body.note?.trim() || nearby.note
      nearby.severity = severityRank(body.severity) > severityRank(nearby.severity) ? body.severity : nearby.severity
      nearby.location_text = body.locationText?.trim() || nearby.location_text
      nearby.created_at = createdAt
      const floodEvent = upsertStoreFlood(store, nearby)
      nearby.flood_event_id = floodEvent.id
      res.status(201).json({ success: true, report: nearby })
      return
    }

    const report: UserReport = {
      id: randomUUID(),
      anonymous_id: anonId,
      coordinates,
      severity: body.severity,
      note: body.note?.trim() || null,
      location_text: body.locationText?.trim() || null,
      status: 'pending',
      confirm_count: 1,
      flood_event_id: null,
      created_at: createdAt,
    }

    const floodEvent = upsertStoreFlood(store, report)
    report.flood_event_id = floodEvent.id
    reports.unshift(report)

    res.status(201).json({ success: true, report })
  })

  return router
}