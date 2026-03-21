# Forecast Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Feed Open-Meteo rainfall forecast, soil moisture, and river discharge data back into the flood detection pipeline to adjust severity/confidence of detected floods and generate pre-emptive forecast flood events for high-risk districts.

**Architecture:** A new `weatherEnrich.ts` lib fetches from two Open-Meteo endpoints (weather + flood API) and caches results 30 min. A new `floodRisk.ts` lib scores composite risk (0–100) from three factors. The pipeline in `internal.ts` uses the score to upgrade severity/confidence and upsert synthetic `is_forecast: true` FloodEvents. Route check reads forecast floods from the same bbox query and appends Vietnamese forecast warnings.

**Tech Stack:** TypeScript, Express, Supabase (PostgreSQL + RPC), Open-Meteo (free, no key), Vitest + Supertest for tests, React + Zustand on the frontend.

**Branch:** `feat/forecast-enrichment` (already checked out)

**Spec:** `docs/superpowers/specs/2026-03-21-forecast-enrichment-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/002_forecast_events.sql` | Create | DB columns, index, `upsert_forecast_event` RPC |
| `shared/types.ts` | Modify | Add `is_forecast`, `forecast_valid_until`, `'forecast'` source type |
| `mocks/presets/heavy_rain_hcmc.json` | Modify | Add `is_forecast: false` to all 20 records |
| `api/_lib/weatherEnrich.ts` | Create | `fetchEnrichedWeather()` with 30-min cache |
| `api/_lib/__tests__/weatherEnrich.test.ts` | Create | Unit tests for weatherEnrich |
| `api/_lib/floodRisk.ts` | Create | `computeFloodRisk()`, `DISTRICT_RISK_MAP` |
| `api/_lib/__tests__/floodRisk.test.ts` | Create | Unit tests for scoring + district logic |
| `api/_lib/__tests__/supabase.test.ts` | Create | Unit tests for `toFloodEvent` mapper |
| `api/_lib/supabase.ts` | Modify | Add `is_forecast`, `forecast_valid_until` to `toFloodEvent()` |
| `api/_routes/internal.ts` | Modify | Use risk context in pipeline; upsert forecast events |
| `api/_routes/__tests__/internal.test.ts` | Modify | Tests for severity upgrade + forecast event generation |
| `api/_routes/routeCheck.ts` | Modify | Separate forecast floods, append forecast warnings |
| `api/_routes/__tests__/routeCheck.test.ts` | Modify | Tests for forecast warnings |
| `src/hooks/useDashboardController.ts` | Modify | Surface `is_forecast` floods as `kind: 'forecast'` feed items |
| `src/components/home/operations/RoutePlannerPanel.tsx` | Modify | Render forecast warnings in amber section |

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/002_forecast_events.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/002_forecast_events.sql
-- Add forecast columns to flood_events
ALTER TABLE flood_events
  ADD COLUMN IF NOT EXISTS is_forecast boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS forecast_valid_until timestamptz;

-- Extend source type enum
ALTER TYPE flood_source_type ADD VALUE IF NOT EXISTS 'forecast';

-- Unique constraint: one forecast event per district per day
CREATE UNIQUE INDEX IF NOT EXISTS flood_events_forecast_district_day_idx
  ON flood_events (district, DATE(forecast_valid_until))
  WHERE is_forecast = true;

-- New stored procedure: upsert forecast events
-- Uses INSERT ... ON CONFLICT DO NOTHING to preserve expires_at on re-runs.
-- Returns NULL on conflict — callers must NOT insert into flood_sources for forecast events.
CREATE OR REPLACE FUNCTION upsert_forecast_event(
  p_street_name text,
  p_district     text,
  p_city         text,
  p_lat          double precision,
  p_lng          double precision,
  p_severity     text,
  p_confidence   text,
  p_expires_at          timestamptz,
  p_forecast_valid_until timestamptz
) RETURNS uuid AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO flood_events (
    street_name, district, city, lat, lng,
    severity, confidence, is_forecast, is_active, is_simulated,
    first_detected_at, last_confirmed_at, expires_at, forecast_valid_until
  ) VALUES (
    p_street_name, p_district, p_city, p_lat, p_lng,
    p_severity, p_confidence, true, true, false,
    now(), now(), p_expires_at, p_forecast_valid_until
  )
  ON CONFLICT (district, DATE(forecast_valid_until)) WHERE is_forecast = true
  DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;
```

- [ ] **Step 2: Verify the file exists and looks correct**

```bash
cat supabase/migrations/002_forecast_events.sql
```

Expected: file exists, contains `upsert_forecast_event`, `ADD COLUMN IF NOT EXISTS is_forecast`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/002_forecast_events.sql
git commit -m "feat: add forecast_events migration (columns, index, RPC)"
```

---

## Task 2: Shared Types + Mock Data

**Files:**
- Modify: `shared/types.ts`
- Modify: `mocks/presets/heavy_rain_hcmc.json`

- [ ] **Step 1: Update `shared/types.ts` — add `'forecast'` to `FloodSourceType`**

In `shared/types.ts`, replace:
```typescript
export type FloodSourceType =
  | 'news'
  | 'social'
  | 'government'
  | 'vetc_mock'
  | 'user_report'
```
With:
```typescript
export type FloodSourceType =
  | 'news'
  | 'social'
  | 'government'
  | 'vetc_mock'
  | 'user_report'
  | 'forecast'
```

- [ ] **Step 2: Update `shared/types.ts` — add fields to `FloodEvent`**

In `shared/types.ts`, after the `is_simulated: boolean` line in `FloodEvent`, add:
```typescript
  is_forecast: boolean
  forecast_valid_until?: string
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
bun run check
```

Expected: no TypeScript errors. (Note: downstream consumers of `FloodEvent` that spread/construct the type will now need `is_forecast` — fix any errors that appear.)

- [ ] **Step 4: Fix mock data — add `is_forecast: false` to all 20 records**

In `mocks/presets/heavy_rain_hcmc.json`, for every object that has `"is_simulated": true`, add `"is_forecast": false` on the next line. The pattern to add after each `"is_simulated": true` entry is:

```json
    "is_simulated": true,
    "is_forecast": false
```

Do this for all 20 records.

- [ ] **Step 5: Verify TypeScript still compiles**

```bash
bun run check
```

- [ ] **Step 6: Commit**

```bash
git add shared/types.ts mocks/presets/heavy_rain_hcmc.json
git commit -m "feat: add is_forecast and forecast_valid_until to FloodEvent type"
```

---

## Task 3: `weatherEnrich.ts` — enriched weather + river data

**Files:**
- Create: `api/_lib/weatherEnrich.ts`
- Create: `api/_lib/__tests__/weatherEnrich.test.ts`

- [ ] **Step 1: Write the failing test**

Create `api/_lib/__tests__/weatherEnrich.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Intercept global fetch before importing the module under test
const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

// Import after stubbing fetch
const { fetchEnrichedWeather, clearWeatherCache } = await import('../weatherEnrich.js')

const METEO_RESPONSE = {
  current: { time: '2026-03-21T09:00', temperature_2m: 28, rain: 2, wind_speed_10m: 15, wind_gusts_10m: 25, weather_code: 61 },
  hourly: {
    time: ['2026-03-21T09:00', '2026-03-21T10:00', '2026-03-21T11:00',
           '2026-03-21T12:00', '2026-03-21T13:00', '2026-03-21T14:00'],
    precipitation_probability: [60, 70, 80, 75, 65, 55],
    rain: [3, 8, 12, 9, 6, 4],
    wind_gusts_10m: [20, 28, 35, 30, 22, 18],
    soil_moisture_0_to_1cm: [0.2, 0.22, 0.25, 0.27, 0.28, 0.26],
  },
}

const FLOOD_RESPONSE = {
  daily: {
    time: ['2026-03-21', '2026-03-22', '2026-03-23', '2026-03-24', '2026-03-25', '2026-03-26', '2026-03-27'],
    river_discharge: [120, 130, 125, 118, 122, 115, 110],
  },
}

function makeOkResponse(body: unknown) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(body),
  })
}

describe('fetchEnrichedWeather', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    clearWeatherCache()
  })

  it('calls Open-Meteo weather API and flood API', async () => {
    fetchMock
      .mockResolvedValueOnce(makeOkResponse(METEO_RESPONSE))
      .mockResolvedValueOnce(makeOkResponse(FLOOD_RESPONSE))

    await fetchEnrichedWeather()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [weatherUrl, floodUrl] = fetchMock.mock.calls.map((c: unknown[]) => String(c[0]))
    expect(weatherUrl).toContain('api.open-meteo.com')
    expect(weatherUrl).toContain('soil_moisture_0_to_1cm')
    expect(floodUrl).toContain('flood-api.open-meteo.com')
    expect(floodUrl).toContain('river_discharge')
  })

  it('returns enriched weather shape', async () => {
    fetchMock
      .mockResolvedValueOnce(makeOkResponse(METEO_RESPONSE))
      .mockResolvedValueOnce(makeOkResponse(FLOOD_RESPONSE))

    const result = await fetchEnrichedWeather()

    expect(result).toMatchObject({
      hourly: expect.arrayContaining([
        expect.objectContaining({ rain_mm: expect.any(Number), soil_moisture: expect.any(Number) }),
      ]),
      riverDischarge: expect.arrayContaining([expect.any(Number)]),
      riverDischargeAvg: expect.any(Number),
    })
  })

  it('returns cached result on second call within 30 min', async () => {
    fetchMock
      .mockResolvedValueOnce(makeOkResponse(METEO_RESPONSE))
      .mockResolvedValueOnce(makeOkResponse(FLOOD_RESPONSE))

    await fetchEnrichedWeather()
    await fetchEnrichedWeather()

    expect(fetchMock).toHaveBeenCalledTimes(2) // not 4
  })

  it('returns null when weather API fails', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 })

    const result = await fetchEnrichedWeather()
    expect(result).toBeNull()
  })

  it('still returns result when flood API fails (river data gracefully absent)', async () => {
    fetchMock
      .mockResolvedValueOnce(makeOkResponse(METEO_RESPONSE))
      .mockRejectedValueOnce(new Error('flood API down'))

    const result = await fetchEnrichedWeather()
    expect(result).not.toBeNull()
    expect(result?.riverDischarge).toEqual([])
    expect(result?.riverDischargeAvg).toBe(0)
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
bun run test -- api/_lib/__tests__/weatherEnrich.test.ts
```

Expected: FAIL — `Cannot find module '../weatherEnrich.js'`

- [ ] **Step 3: Implement `api/_lib/weatherEnrich.ts`**

```typescript
// api/_lib/weatherEnrich.ts
const HCMC_LAT = 10.7769
const HCMC_LNG = 106.7009

const WEATHER_URL =
  `https://api.open-meteo.com/v1/forecast?latitude=${HCMC_LAT}&longitude=${HCMC_LNG}` +
  `&current=temperature_2m,rain,wind_speed_10m,wind_gusts_10m,weather_code` +
  `&hourly=precipitation_probability,rain,wind_gusts_10m,soil_moisture_0_to_1cm` +
  `&forecast_days=1&timezone=UTC`

const FLOOD_API_URL =
  `https://flood-api.open-meteo.com/v1/flood?latitude=${HCMC_LAT}&longitude=${HCMC_LNG}` +
  `&daily=river_discharge&forecast_days=7`

const CACHE_TTL_MS = 30 * 60 * 1000

export interface EnrichedHourly {
  time: string
  precipitation_probability: number
  rain_mm: number
  wind_gusts_kmh: number
  soil_moisture: number
}

export interface EnrichedWeather {
  current: {
    time: string
    temperature_c: number
    rain_mm: number
    wind_speed_kmh: number
    wind_gusts_kmh: number
    weather_code: number
  }
  hourly: EnrichedHourly[]          // next 6h
  riverDischarge: number[]          // 7-day values (m³/s)
  riverDischargeAvg: number         // 7-day rolling average
}

let cache: { result: EnrichedWeather; fetchedAt: number } | null = null

/** Exposed for tests only. */
export function clearWeatherCache() {
  cache = null
}

export async function fetchEnrichedWeather(): Promise<EnrichedWeather | null> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.result
  }

  // Fetch weather
  let meteoRes: Response
  try {
    meteoRes = await fetch(WEATHER_URL)
    if (!meteoRes.ok) throw new Error(`Open-Meteo ${meteoRes.status}`)
  } catch (err) {
    console.warn('[weatherEnrich] weather fetch failed:', err)
    return null
  }

  const meteo = (await meteoRes.json()) as {
    current: {
      time: string
      temperature_2m: number
      rain: number
      wind_speed_10m: number
      wind_gusts_10m: number
      weather_code: number
    }
    hourly: {
      time: string[]
      precipitation_probability: number[]
      rain: number[]
      wind_gusts_10m: number[]
      soil_moisture_0_to_1cm: number[]
    }
  }

  // Fetch river discharge (best-effort — failure is non-fatal)
  let riverDischarge: number[] = []
  try {
    const floodRes = await fetch(FLOOD_API_URL)
    if (floodRes.ok) {
      const floodData = (await floodRes.json()) as {
        daily: { river_discharge: number[] }
      }
      riverDischarge = floodData.daily.river_discharge ?? []
    }
  } catch {
    // non-fatal: proceed without river data
  }

  const now = new Date()
  const sixHoursLater = new Date(now.getTime() + 6 * 60 * 60 * 1000)

  const hourly: EnrichedHourly[] = meteo.hourly.time
    .map((t, i) => ({
      time: t,
      precipitation_probability: meteo.hourly.precipitation_probability[i] ?? 0,
      rain_mm: meteo.hourly.rain[i] ?? 0,
      wind_gusts_kmh: meteo.hourly.wind_gusts_10m[i] ?? 0,
      soil_moisture: meteo.hourly.soil_moisture_0_to_1cm[i] ?? 0,
    }))
    .filter((h) => {
      const d = new Date(h.time + 'Z')
      return d >= now && d <= sixHoursLater
    })

  const riverDischargeAvg =
    riverDischarge.length > 0
      ? riverDischarge.reduce((a, b) => a + b, 0) / riverDischarge.length
      : 0

  const result: EnrichedWeather = {
    current: {
      time: meteo.current.time,
      temperature_c: meteo.current.temperature_2m ?? 0,
      rain_mm: meteo.current.rain ?? 0,
      wind_speed_kmh: meteo.current.wind_speed_10m ?? 0,
      wind_gusts_kmh: meteo.current.wind_gusts_10m ?? 0,
      weather_code: meteo.current.weather_code ?? 0,
    },
    hourly,
    riverDischarge,
    riverDischargeAvg,
  }

  cache = { result, fetchedAt: Date.now() }
  return result
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
bun run test -- api/_lib/__tests__/weatherEnrich.test.ts
```

Expected: all 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add api/_lib/weatherEnrich.ts api/_lib/__tests__/weatherEnrich.test.ts
git commit -m "feat: add weatherEnrich lib with Open-Meteo weather + flood API fetch"
```

---

## Task 4: `floodRisk.ts` — risk scoring

**Files:**
- Create: `api/_lib/floodRisk.ts`
- Create: `api/_lib/__tests__/floodRisk.test.ts`

- [ ] **Step 1: Write the failing test**

Create `api/_lib/__tests__/floodRisk.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { computeFloodRisk, DISTRICT_RISK_MAP } from '../floodRisk.js'
import type { EnrichedWeather } from '../weatherEnrich.js'

function makeWeather(overrides: Partial<{
  hourlyRain: number[]
  soilMoisture: number[]
  riverDischarge: number[]
  riverDischargeAvg: number
}>): EnrichedWeather {
  const hourlyRain = overrides.hourlyRain ?? [0, 0, 0, 0, 0, 0]
  const soilMoisture = overrides.soilMoisture ?? [0, 0, 0, 0, 0, 0]
  const riverDischarge = overrides.riverDischarge ?? [100, 100, 100, 100, 100, 100, 100]
  const riverDischargeAvg = overrides.riverDischargeAvg ?? 100

  return {
    current: { time: '', temperature_c: 28, rain_mm: 0, wind_speed_kmh: 0, wind_gusts_kmh: 0, weather_code: 0 },
    hourly: hourlyRain.map((rain_mm, i) => ({
      time: `2026-03-21T0${9 + i}:00`,
      precipitation_probability: 50,
      rain_mm,
      wind_gusts_kmh: 20,
      soil_moisture: soilMoisture[i] ?? 0,
    })),
    riverDischarge,
    riverDischargeAvg,
  }
}

describe('computeFloodRisk', () => {
  it('zero weather data → score 0, level low', () => {
    const result = computeFloodRisk(makeWeather({}))
    expect(result.score).toBe(0)
    expect(result.level).toBe('low')
    expect(result.forecastDistricts).toHaveLength(0)
  })

  it('max rainfall (50mm over 6h) → rainfall factor = 1.0 → score contribution = 50', () => {
    const result = computeFloodRisk(makeWeather({ hourlyRain: [10, 10, 10, 10, 10, 0] }))
    // rainfall factor: 50/50 = 1.0, weight 0.5 → contribution = 50
    // soil = 0, river = avg so ratio=1/1=1 → factor = min(1/2, 1) = 0.5 → contribution = 12.5
    // score ≈ 62
    expect(result.score).toBeGreaterThan(55)
    expect(result.score).toBeLessThan(70)
    expect(result.level).toBe('high')
  })

  it('all factors maxed → score 100, level critical', () => {
    const result = computeFloodRisk(makeWeather({
      hourlyRain: [10, 10, 10, 10, 10, 10],         // 60mm → capped at 50 → factor 1.0
      soilMoisture: [0.4, 0.4, 0.4, 0.4, 0.4, 0.4], // factor 1.0
      riverDischarge: [200, 200, 200, 200, 200, 200, 200],
      riverDischargeAvg: 100,                         // ratio 2.0 → factor 1.0
    }))
    expect(result.score).toBe(100)
    expect(result.level).toBe('critical')
  })

  it('score ≥ 80 → forecastDistricts has up to 3 entries', () => {
    const result = computeFloodRisk(makeWeather({
      hourlyRain: [10, 10, 10, 10, 10, 10],
      soilMoisture: [0.4, 0.4, 0.4, 0.4, 0.4, 0.4],
      riverDischarge: [200, 200, 200, 200, 200, 200, 200],
      riverDischargeAvg: 100,
    }))
    expect(result.forecastDistricts.length).toBeGreaterThan(0)
    expect(result.forecastDistricts.length).toBeLessThanOrEqual(3)
  })

  it('score < 80 → forecastDistricts is empty', () => {
    const result = computeFloodRisk(makeWeather({ hourlyRain: [5, 5, 0, 0, 0, 0] }))
    expect(result.forecastDistricts).toHaveLength(0)
  })

  it('peakHour is the ISO timestamp of the hour with highest rain_mm', () => {
    const result = computeFloodRisk(makeWeather({
      hourlyRain: [2, 12, 5, 3, 1, 0],
    }))
    // peak is index 1: 2026-03-21T10:00
    expect(result.peakHour).toContain('T10:00')
  })

  it('DISTRICT_RISK_MAP has 6 districts with lat/lng/multiplier', () => {
    const entries = Object.values(DISTRICT_RISK_MAP)
    expect(entries).toHaveLength(6)
    for (const d of entries) {
      expect(d).toMatchObject({
        lat: expect.any(Number),
        lng: expect.any(Number),
        multiplier: expect.any(Number),
      })
    }
  })

  it('districtScore > 90 → severity heavy, otherwise moderate', () => {
    const result = computeFloodRisk(makeWeather({
      hourlyRain: [10, 10, 10, 10, 10, 10],
      soilMoisture: [0.4, 0.4, 0.4, 0.4, 0.4, 0.4],
      riverDischarge: [200, 200, 200, 200, 200, 200, 200],
      riverDischargeAvg: 100,
    }))
    for (const d of result.forecastDistricts) {
      expect(['moderate', 'heavy']).toContain(d.severity)
    }
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
bun run test -- api/_lib/__tests__/floodRisk.test.ts
```

Expected: FAIL — `Cannot find module '../floodRisk.js'`

- [ ] **Step 3: Implement `api/_lib/floodRisk.ts`**

```typescript
// api/_lib/floodRisk.ts
import type { EnrichedWeather } from './weatherEnrich.js'
import type { Severity } from '../../shared/types.js'

export interface DistrictRiskEntry {
  lat: number
  lng: number
  multiplier: number
  name: string
}

export const DISTRICT_RISK_MAP: Record<string, DistrictRiskEntry> = {
  'Quận Bình Thạnh': { lat: 10.8124, lng: 106.7143, multiplier: 1.3, name: 'Quận Bình Thạnh' },
  'Quận 8':          { lat: 10.7230, lng: 106.6285, multiplier: 1.3, name: 'Quận 8' },
  'Quận 6':          { lat: 10.7462, lng: 106.6340, multiplier: 1.2, name: 'Quận 6' },
  'Quận 7':          { lat: 10.7320, lng: 106.7210, multiplier: 1.2, name: 'Quận 7' },
  'Quận 12':         { lat: 10.8680, lng: 106.6570, multiplier: 1.1, name: 'Quận 12' },
  'Thủ Đức':         { lat: 10.8544, lng: 106.7715, multiplier: 1.1, name: 'Thủ Đức' },
}

export interface ForecastDistrict {
  district: string
  lat: number
  lng: number
  severity: Severity
  districtScore: number
}

export interface FloodRiskResult {
  score: number                      // 0–100
  level: 'low' | 'moderate' | 'high' | 'critical'
  peakHour: string                   // ISO8601 of hour with highest rain_mm
  forecastDistricts: ForecastDistrict[]
}

export function computeFloodRisk(weather: EnrichedWeather): FloodRiskResult {
  const { hourly, riverDischarge, riverDischargeAvg } = weather

  // ── Factor 1: Rainfall — sum of hourly.rain_mm for next 6h, cap 50mm ──
  const rainfallSum = hourly.reduce((sum, h) => sum + h.rain_mm, 0)
  const rainfallFactor = Math.min(rainfallSum / 50, 1.0)

  // ── Factor 2: Soil moisture — average of current hourly values, cap 0.4 ──
  const avgSoilMoisture =
    hourly.length > 0
      ? hourly.reduce((sum, h) => sum + h.soil_moisture, 0) / hourly.length
      : 0
  const soilFactor = Math.min(avgSoilMoisture / 0.4, 1.0)

  // ── Factor 3: River discharge — current / 7-day avg, ratio cap 2.0 ──
  const currentRiver = riverDischarge[0] ?? 0
  const riverRatio = riverDischargeAvg > 0 ? currentRiver / riverDischargeAvg : 0
  const riverFactor = Math.min(riverRatio / 2.0, 1.0)

  // ── Composite score ──
  const compositeScore = Math.round((rainfallFactor * 0.5 + soilFactor * 0.25 + riverFactor * 0.25) * 100)

  // ── Level ──
  let level: FloodRiskResult['level']
  if (compositeScore >= 80) level = 'critical'
  else if (compositeScore >= 60) level = 'high'
  else if (compositeScore >= 40) level = 'moderate'
  else level = 'low'

  // ── Peak hour: ISO timestamp of the hour with highest rain_mm ──
  const peakEntry = [...hourly].sort((a, b) => b.rain_mm - a.rain_mm)[0]
  const peakHour = peakEntry ? peakEntry.time + 'Z' : new Date().toISOString()

  // ── Forecast districts (only when critical) ──
  const forecastDistricts: ForecastDistrict[] = []
  if (compositeScore >= 80) {
    const ranked = Object.entries(DISTRICT_RISK_MAP)
      .map(([key, entry]) => {
        const districtScore = Math.min(compositeScore * entry.multiplier, 100)
        const severity: Severity = districtScore > 90 ? 'heavy' : 'moderate'
        return { district: key, lat: entry.lat, lng: entry.lng, severity, districtScore }
      })
      .sort((a, b) => b.districtScore - a.districtScore)
      .slice(0, 3)
    forecastDistricts.push(...ranked)
  }

  return { score: compositeScore, level, peakHour, forecastDistricts }
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
bun run test -- api/_lib/__tests__/floodRisk.test.ts
```

Expected: all 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add api/_lib/floodRisk.ts api/_lib/__tests__/floodRisk.test.ts
git commit -m "feat: add floodRisk lib with computeFloodRisk scoring and DISTRICT_RISK_MAP"
```

---

## Task 5: Update `supabase.ts` mapper

**Files:**
- Create: `api/_lib/__tests__/supabase.test.ts`
- Modify: `api/_lib/supabase.ts`

- [ ] **Step 1: Write the failing test**

Create `api/_lib/__tests__/supabase.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test — verify it fails**

```bash
bun run test -- api/_lib/__tests__/supabase.test.ts
```

Expected: FAIL — `result.is_forecast` is `undefined`

- [ ] **Step 3: Update `toFloodEvent()` in `api/_lib/supabase.ts`**

In the `return { ... }` block of `toFloodEvent`, after the `is_simulated` line add:
```typescript
    is_forecast: Boolean(row.is_forecast ?? false),
    forecast_valid_until: row.forecast_valid_until != null ? String(row.forecast_valid_until) : undefined,
```

- [ ] **Step 4: Run test — verify it passes**

```bash
bun run test -- api/_lib/__tests__/supabase.test.ts
```

Expected: all 5 tests PASS

- [ ] **Step 5: Run full test suite to catch regressions**

```bash
bun run test
```

Expected: all existing tests PASS

- [ ] **Step 6: Commit**

```bash
git add api/_lib/supabase.ts api/_lib/__tests__/supabase.test.ts
git commit -m "feat: update toFloodEvent mapper to include is_forecast and forecast_valid_until"
```

---

## Task 6: Pipeline Enrichment (`internal.ts`)

**Files:**
- Modify: `api/_routes/internal.ts`
- Modify: `api/_routes/__tests__/internal.test.ts`

- [ ] **Step 1: Add tests for pipeline enrichment to `internal.test.ts`**

Read the existing `api/_routes/__tests__/internal.test.ts` to find the end of the file, then add a new describe block. The existing file mocks `exa.js`, `openai.js`, `geocode.js`, and `supabase.js`. Append after the last describe block:

```typescript
// ── PIPELINE ENRICHMENT (run-pipeline with weather risk) ─────────────────
describe('POST /api/internal/run-pipeline — forecast enrichment', () => {
  let app: express.Application

  // Mock weatherEnrich and floodRisk before importing the route
  vi.mock('../../_lib/weatherEnrich.js', () => ({
    fetchEnrichedWeather: vi.fn(),
    clearWeatherCache: vi.fn(),
  }))

  vi.mock('../../_lib/floodRisk.js', () => ({
    computeFloodRisk: vi.fn(),
  }))

  const { fetchEnrichedWeather } = await import('../../_lib/weatherEnrich.js')
  const { computeFloodRisk } = await import('../../_lib/floodRisk.js')

  beforeAll(async () => {
    process.env.DATA_MODE = 'live'
    process.env.INTERNAL_SECRET = SECRET
    vi.resetModules()
    const { default: createInternalRoutes } = await import('../../_routes/internal.js')
    app = express()
    app.use(express.json())
    app.use('/', createInternalRoutes({ base: [], simulated: [] }))
  })

  afterAll(() => {
    delete process.env.DATA_MODE
    delete process.env.INTERNAL_SECRET
  })

  beforeEach(() => {
    getSb().__resetAll()
    vi.mocked(fetchEnrichedWeather).mockResolvedValue(null)
    vi.mocked(computeFloodRisk).mockReturnValue({
      score: 0, level: 'low', peakHour: new Date().toISOString(), forecastDistricts: [],
    })
    getSb().rpc.mockResolvedValue({ data: 'mock-run-id', error: null })
    getSb().from().insert().select().single.mockResolvedValue({ data: { id: 'run-1' }, error: null })
    getSb().from().insert.mockResolvedValue({ data: null, error: null })
  })

  it('severity upgraded light→moderate when riskScore ≥ 60', async () => {
    const { extractFloodData } = await import('../../_lib/openai.js')
    vi.mocked(extractFloodData).mockResolvedValueOnce([{
      street_name: 'Đường Test', district: 'Quận 1',
      depth_cm: 10, severity: 'light', confidence: 'high',
      source_url: 'http://test.com', source_title: 'Test', source_snippet: 'test', published_at: new Date().toISOString(),
    }])
    const { searchFloodNews } = await import('../../_lib/exa.js')
    vi.mocked(searchFloodNews).mockResolvedValueOnce([{ url: 'http://test.com', title: 'Test', text: 'test', publishedDate: new Date().toISOString() }])

    vi.mocked(fetchEnrichedWeather).mockResolvedValue({
      current: { time: '', temperature_c: 28, rain_mm: 5, wind_speed_kmh: 20, wind_gusts_kmh: 30, weather_code: 61 },
      hourly: Array(6).fill({ time: '', precipitation_probability: 70, rain_mm: 5, wind_gusts_kmh: 25, soil_moisture: 0.2 }),
      riverDischarge: [100, 100, 100, 100, 100, 100, 100],
      riverDischargeAvg: 100,
    })
    vi.mocked(computeFloodRisk).mockReturnValue({
      score: 65, level: 'high', peakHour: new Date().toISOString(), forecastDistricts: [],
    })

    getSb().rpc.mockResolvedValue({ data: 'flood-id-1', error: null })

    const res = await request(app)
      .post('/run-pipeline')
      .set(CORRECT_HEADER)

    expect(res.status).toBe(200)
    // Verify upsert_flood_event was called with severity 'moderate' (upgraded from 'light')
    expect(getSb().rpc).toHaveBeenCalledWith('upsert_flood_event', expect.objectContaining({
      p_severity: 'moderate',
    }))
  })

  it('forecast events upserted via upsert_forecast_event when riskScore ≥ 80', async () => {
    const { searchFloodNews } = await import('../../_lib/exa.js')
    vi.mocked(searchFloodNews).mockResolvedValueOnce([])

    vi.mocked(fetchEnrichedWeather).mockResolvedValue({
      current: { time: '', temperature_c: 28, rain_mm: 10, wind_speed_kmh: 25, wind_gusts_kmh: 40, weather_code: 61 },
      hourly: Array(6).fill({ time: '', precipitation_probability: 90, rain_mm: 10, wind_gusts_kmh: 40, soil_moisture: 0.35 }),
      riverDischarge: [200, 200, 200, 200, 200, 200, 200],
      riverDischargeAvg: 100,
    })
    vi.mocked(computeFloodRisk).mockReturnValue({
      score: 85,
      level: 'critical',
      peakHour: new Date(Date.now() + 2 * 3600_000).toISOString(),
      forecastDistricts: [
        { district: 'Quận Bình Thạnh', lat: 10.8124, lng: 106.7143, severity: 'heavy', districtScore: 95 },
        { district: 'Quận 8', lat: 10.7230, lng: 106.6285, severity: 'moderate', districtScore: 88 },
      ],
    })

    getSb().rpc.mockResolvedValue({ data: null, error: null })

    const res = await request(app)
      .post('/run-pipeline')
      .set(CORRECT_HEADER)

    expect(res.status).toBe(200)
    // Verify upsert_forecast_event was called for each district with correct args
    expect(getSb().rpc).toHaveBeenCalledWith('upsert_forecast_event', expect.objectContaining({
      p_district: 'Quận Bình Thạnh',
      p_severity: 'heavy',
      p_forecast_valid_until: expect.any(String),
    }))
  })
})
```

- [ ] **Step 2: Run new tests — verify they fail**

```bash
bun run test -- api/_routes/__tests__/internal.test.ts
```

Expected: new tests FAIL (imports don't exist yet)

- [ ] **Step 3: Update `api/_routes/internal.ts`**

Add imports at the top (after existing imports):
```typescript
import { fetchEnrichedWeather } from '../_lib/weatherEnrich.js'
import { computeFloodRisk } from '../_lib/floodRisk.js'
```

In the `run-pipeline` handler, after `const startedAt = new Date()`:
```typescript
    // ── Fetch weather risk context once (cached 30 min) ──────────────────
    const enrichedWeather = await fetchEnrichedWeather()
    const riskContext = enrichedWeather ? computeFloodRisk(enrichedWeather) : null
    const riskScore = riskContext?.score ?? 0
```

In the inner loop where floods are extracted, replace:
```typescript
          const { data: floodId } = await supabase.rpc('upsert_flood_event', {
            p_street_name: f.street_name,
            p_district: f.district,
            p_lat: coords.lat,
            p_lng: coords.lng,
            p_depth_cm: f.depth_cm,
            p_severity: f.severity,
            p_confidence: f.confidence,
            p_is_simulated: false,
          })
```
With:
```typescript
          // ── Severity/confidence enrichment ───────────────────────────
          let severity = f.severity
          let confidence = f.confidence
          if (riskScore >= 80 && severity === 'moderate') severity = 'heavy'
          else if (riskScore >= 60 && severity === 'light') severity = 'moderate'
          if (riskScore >= 60 && confidence === 'low') confidence = 'medium'

          const { data: floodId } = await supabase.rpc('upsert_flood_event', {
            p_street_name: f.street_name,
            p_district: f.district,
            p_lat: coords.lat,
            p_lng: coords.lng,
            p_depth_cm: f.depth_cm,
            p_severity: severity,
            p_confidence: confidence,
            p_is_simulated: false,
          })
```

After the article processing loop ends (before updating the pipeline run log), add:
```typescript
      // ── Generate forecast events for high-risk districts ─────────────
      if (riskContext && riskScore >= 80 && riskContext.forecastDistricts.length > 0) {
        const peakHourDate = new Date(riskContext.peakHour)
        const expiresAt = new Date(peakHourDate.getTime() + 3 * 60 * 60 * 1000).toISOString()

        for (const d of riskContext.forecastDistricts) {
          await supabase.rpc('upsert_forecast_event', {
            p_street_name: `Khu vực ${d.district}`,
            p_district: d.district,
            p_city: 'Thành phố Hồ Chí Minh',
            p_lat: d.lat,
            p_lng: d.lng,
            p_severity: d.severity,
            p_confidence: 'medium',
            p_expires_at: expiresAt,
            p_forecast_valid_until: expiresAt,
          })
        }
      }
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
bun run test -- api/_routes/__tests__/internal.test.ts
```

Expected: all tests PASS (including new ones)

- [ ] **Step 5: Run full suite**

```bash
bun run test
```

Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add api/_routes/internal.ts api/_routes/__tests__/internal.test.ts
git commit -m "feat: enrich pipeline with weather risk — severity upgrade + forecast event generation"
```

---

## Task 7: Route Check Forecast Warnings

**Files:**
- Modify: `api/_routes/routeCheck.ts`
- Modify: `api/_routes/__tests__/routeCheck.test.ts`

- [ ] **Step 1: Add tests to `routeCheck.test.ts`**

Append a new describe block to the existing test file. At the top of the file, add the weatherEnrich mock alongside existing mocks:

```typescript
vi.mock('../../_lib/weatherEnrich.js', () => ({
  fetchEnrichedWeather: vi.fn().mockResolvedValue(null),
  clearWeatherCache: vi.fn(),
}))
```

Then append at the end of the file:

```typescript
// ── FORECAST WARNINGS ───────────────────────────────────────────────────
describe('POST /route-check — forecast flood warnings', () => {
  let app: express.Application

  const { fetchEnrichedWeather } = await import('../../_lib/weatherEnrich.js')

  function makeForecastFlood(district: string) {
    return {
      id: 'forecast-1',
      street_name: `Khu vực ${district}`,
      district,
      city: 'Thành phố Hồ Chí Minh',
      coordinates: { lat: 10.8124, lng: 106.7143 },
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
    const mod = await import('../../_routes/routeCheck.js')
    app = express()
    app.use(express.json())
    app.use('/', mod.default({ base: [], simulated: [] }))
  })

  afterAll(() => { delete process.env.DATA_MODE })

  beforeEach(() => {
    getSb().__resetAll()
    getDrivingRouteMock.mockResolvedValue(null)
    vi.mocked(fetchEnrichedWeather).mockResolvedValue(null)
  })

  it('forecast flood in bbox → forecast warning in warnings[] but not in floodZones', async () => {
    const forecastFlood = makeForecastFlood('Quận Bình Thạnh')
    getSb().rpc.mockResolvedValue({ data: [forecastFlood], error: null })

    const res = await request(app).post('/').send({ origin: 'hcmc', destination: 'bình thạnh' })

    expect(res.status).toBe(200)
    // forecast floods should NOT be in floodZones (confirmed only)
    expect(res.body.floodZones.filter((f: { is_forecast?: boolean }) => f.is_forecast)).toHaveLength(0)
    // but a forecast warning should appear
    const hasWarning = res.body.warnings.some((w: string) => w.includes('nguy cơ ngập'))
    expect(hasWarning).toBe(true)
  })

  it('forecast warning includes rainfall mm when weather available', async () => {
    const forecastFlood = makeForecastFlood('Quận Bình Thạnh')
    getSb().rpc.mockResolvedValue({ data: [forecastFlood], error: null })
    vi.mocked(fetchEnrichedWeather).mockResolvedValue({
      current: { time: '', temperature_c: 28, rain_mm: 5, wind_speed_kmh: 20, wind_gusts_kmh: 30, weather_code: 61 },
      hourly: [{ time: '', precipitation_probability: 70, rain_mm: 8, wind_gusts_kmh: 25, soil_moisture: 0.2 },
               { time: '', precipitation_probability: 80, rain_mm: 12, wind_gusts_kmh: 30, soil_moisture: 0.25 }],
      riverDischarge: [100, 100, 100, 100, 100, 100, 100],
      riverDischargeAvg: 100,
    })

    const res = await request(app).post('/').send({ origin: 'hcmc', destination: 'bình thạnh' })

    expect(res.status).toBe(200)
    const forecastWarning = res.body.warnings.find((w: string) => w.includes('nguy cơ ngập'))
    expect(forecastWarning).toMatch(/mm/)
  })

  it('forecast warning falls back to generic string when weather unavailable', async () => {
    const forecastFlood = makeForecastFlood('Quận Bình Thạnh')
    getSb().rpc.mockResolvedValue({ data: [forecastFlood], error: null })
    vi.mocked(fetchEnrichedWeather).mockResolvedValue(null)

    const res = await request(app).post('/').send({ origin: 'hcmc', destination: 'bình thạnh' })

    const forecastWarning = res.body.warnings.find((w: string) => w.includes('nguy cơ ngập'))
    expect(forecastWarning).toMatch(/dự báo thời tiết/)
    expect(forecastWarning).not.toMatch(/mm/)
  })
})
```

- [ ] **Step 2: Run new tests — verify they fail**

```bash
bun run test -- api/_routes/__tests__/routeCheck.test.ts
```

Expected: new describe block tests FAIL

- [ ] **Step 3: Update `api/_routes/routeCheck.ts`**

Add import at the top:
```typescript
import { fetchEnrichedWeather } from '../_lib/weatherEnrich.js'
```

In the POST handler, after the line `const affected = countFloodIntersections(coords, floods)`:

```typescript
      // ── Separate forecast floods from confirmed floods ─────────────────
      const confirmedFloods = floods.filter((f) => !f.is_forecast)
      const forecastFloods = floods.filter((f) => f.is_forecast)
      const affected = countFloodIntersections(coords, confirmedFloods)
```

(Remove the original `const affected = countFloodIntersections(coords, floods)` line.)

After the `alternativeRoute` block and before building the payload, add:

```typescript
      // ── Forecast warnings ──────────────────────────────────────────────
      const forecastAffected = countFloodIntersections(coords, forecastFloods)
      if (forecastAffected.length > 0) {
        let precipitation_sum_6h: number | null = null
        try {
          const enriched = await fetchEnrichedWeather()
          if (enriched) {
            precipitation_sum_6h = enriched.hourly.reduce((sum, h) => sum + h.rain_mm, 0)
          }
        } catch {
          // non-fatal
        }

        for (const f of forecastAffected) {
          const hoursAway = f.forecast_valid_until
            ? Math.max(1, Math.round((new Date(f.forecast_valid_until).getTime() - Date.now()) / 3_600_000))
            : 1
          const warning =
            precipitation_sum_6h != null
              ? `Khu vực ${f.district} có nguy cơ ngập trong ${hoursAway} giờ tới — dự báo mưa ${Math.round(precipitation_sum_6h)}mm`
              : `Khu vực ${f.district} có nguy cơ ngập trong ${hoursAway} giờ tới theo dự báo thời tiết`
          warnings.push(warning)
        }
      }
```

The payload keeps `floodZones: affected` unchanged — `affected` already holds only confirmed-flood intersections since it is computed from `confirmedFloods`:
```typescript
      const payload: RouteCheckResponse = {
        route: { coords, bounding_box },
        alternativeRoute,
        floodZones: affected,   // only confirmed floods (forecast floods excluded above)
        warnings,
        alertText,
      }
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
bun run test -- api/_routes/__tests__/routeCheck.test.ts
```

Expected: all tests PASS

- [ ] **Step 5: Run full suite**

```bash
bun run test
```

Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add api/_routes/routeCheck.ts api/_routes/__tests__/routeCheck.test.ts
git commit -m "feat: add forecast flood warnings to route check"
```

---

## Task 8: Frontend — IntelligenceFeed + Route Warnings

**Files:**
- Modify: `src/hooks/useDashboardController.ts`
- Modify: `src/components/home/operations/RoutePlannerPanel.tsx`

No unit tests for React components in this project. Verify via TypeScript check and manual review.

- [ ] **Step 1: Update `useDashboardController.ts` — surface forecast floods as `kind: 'forecast'` feed items**

Read `src/hooks/useDashboardController.ts`. In the `buildFeedItems()` function (around line 63), the current logic builds flood items from all floods (max 3). Update it to:

1. Separate `is_forecast: true` floods from confirmed floods
2. Build confirmed flood items (max 2) with `kind: 'flood'`
3. Build forecast flood items (max 1) with `kind: 'forecast'`
4. Append the weather forecast item if present

The updated `buildFeedItems` function:

```typescript
function buildFeedItems(
  floods: FloodEvent[],
  weatherAlert: WeatherAlert | null,
): FeedItem[] {
  const items: FeedItem[] = []

  // Confirmed floods (max 2)
  const confirmedFloods = floods.filter((f) => !f.is_forecast)
  const forecastFloods = floods.filter((f) => f.is_forecast)

  const prioritized = [...confirmedFloods].sort((a, b) => {
    const sev = { heavy: 3, moderate: 2, light: 1 } as const
    return sev[b.severity] - sev[a.severity]
  })

  for (const f of prioritized.slice(0, 2)) {
    items.push({
      id: f.id,
      time: f.last_confirmed_at,
      tone: f.severity === 'heavy' ? 'critical' : f.severity === 'moderate' ? 'warning' : 'info',
      headline: `${f.street_name} — ${f.district}`,
      body: `Mức độ: ${f.severity}${f.depth_cm ? ` · ${f.depth_cm}cm` : ''}`,
      severity: f.severity,
      kind: 'flood',
    })
  }

  // Forecast flood (max 1 — highest risk district)
  if (forecastFloods.length > 0) {
    const top = forecastFloods[0]
    items.push({
      id: `forecast-${top.id}`,
      time: top.forecast_valid_until ?? top.expires_at,
      tone: 'warning',
      headline: `Dự báo — ${top.district}`,
      body: `Nguy cơ ngập · Mức độ dự báo: ${top.severity}`,
      severity: top.severity,
      kind: 'forecast',
    })
  }

  // Weather forecast alert
  if (weatherAlert) {
    items.push({
      id: 'weather-alert',
      time: weatherAlert.time,
      tone: weatherAlert.severity === 'high' ? 'critical' : 'warning',
      headline: 'Dự báo thời tiết',
      body: weatherAlert.message,
      severity: weatherAlert.severity === 'high' ? 'heavy' : weatherAlert.severity === 'medium' ? 'moderate' : 'light',
      kind: 'forecast',
    })
  }

  return items.slice(0, 4)
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
bun run check
```

Expected: no errors

- [ ] **Step 3: Update `RoutePlannerPanel.tsx` — add forecast warnings section**

Read `src/components/home/operations/RoutePlannerPanel.tsx`. Find the section that renders `data?.warnings` (around lines 195-201). After the existing warnings list, add a new section that separates forecast warnings (those containing "nguy cơ ngập") from regular warnings and renders them with amber styling:

Locate the current warnings block that looks like:
```tsx
{data?.warnings && data.warnings.length > 0 && (
  <div ...>
    {data.warnings.map((w, i) => (
      <p key={i} ...>{w}</p>
    ))}
  </div>
)}
```

Replace it with two sections — one for confirmed flood warnings (all non-forecast), one for forecast warnings:

```tsx
{/* Confirmed flood warnings */}
{data?.warnings && data.warnings.filter(w => !w.includes('nguy cơ ngập')).length > 0 && (
  <div className="...existing classes...">
    {data.warnings
      .filter(w => !w.includes('nguy cơ ngập'))
      .map((w, i) => <p key={i} className="...existing...">⚠️ {w}</p>)
    }
  </div>
)}

{/* Forecast warnings */}
{data?.warnings && data.warnings.filter(w => w.includes('nguy cơ ngập')).length > 0 && (
  <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
    <p className="mb-1 text-xs font-semibold text-amber-400">Cảnh báo dự báo</p>
    {data.warnings
      .filter(w => w.includes('nguy cơ ngập'))
      .map((w, i) => <p key={i} className="text-xs text-amber-300/90">🌧 {w}</p>)
    }
  </div>
)}
```

> Note: Match the exact className patterns used in the rest of the file. The above is a guide — adapt to match the surrounding component's Tailwind classes.

- [ ] **Step 4: Verify TypeScript**

```bash
bun run check
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useDashboardController.ts src/components/home/operations/RoutePlannerPanel.tsx
git commit -m "feat: surface forecast floods in IntelligenceFeed and route warning panel"
```

---

## Task 9: Final Verification

- [ ] **Step 1: Run the full test suite**

```bash
bun run test
```

Expected: all tests PASS, no regressions

- [ ] **Step 2: TypeScript check**

```bash
bun run check
```

Expected: zero errors

- [ ] **Step 3: Lint**

```bash
bun run lint
```

Expected: no lint errors

- [ ] **Step 4: Commit (if any lint fixes were needed)**

```bash
git add -A
git commit -m "chore: lint fixes"
```

- [ ] **Step 5: Review git log for this branch**

```bash
git log main..HEAD --oneline
```

Expected: ~8 commits, all feature-prefixed

---

## Implementation Notes

- **`is_forecast` type is `boolean` (required)** — all code paths that construct a `FloodEvent` object must include `is_forecast: false` explicitly
- **`upsert_forecast_event` returns `null` on conflict** — do NOT attempt to insert into `flood_sources` after calling it
- **`expires_at` must always be a concrete timestamp** — never pass `null` to `upsert_forecast_event`; always compute `peakHour + 3h` before calling
- **Cache is module-level** — `clearWeatherCache()` is exported for tests only; production code never calls it
- **Forecast floods appear in `get_floods_in_bbox` automatically** — the existing RPC returns all active floods; route check separates them client-side by `is_forecast`
