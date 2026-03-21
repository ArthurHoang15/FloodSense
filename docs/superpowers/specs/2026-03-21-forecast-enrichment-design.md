# FloodSense — Forecast & River Data Enrichment Design

**Date:** 2026-03-21
**Status:** Approved
**Goal:** Increase flood prediction accuracy by integrating rainfall forecast, soil saturation, and river discharge data into the detection pipeline and route check system.

---

## 1. Problem Statement

The current pipeline detects floods reactively — it only knows about floods after news articles are published or users submit reports. Weather forecast data (rainfall, river levels, soil saturation) is fetched in a separate endpoint but has no influence on:

- Severity/confidence classification of detected floods
- Pre-emptive flood risk warnings before reports exist
- Route check warnings for future flood risk

This design adds a forecast enrichment layer that feeds weather data back into the flood detection pipeline.

---

## 2. Requirements

### Functional
- **R1:** Adjust `severity` and `confidence` of pipeline-extracted floods based on current weather risk score
- **R2:** Generate synthetic `is_forecast: true` FloodEvents for high-risk districts when rainfall/river data exceeds thresholds
- **R3:** Route check warns users about forecast flood risk zones even with zero confirmed reports
- **R4:** IntelligenceFeed displays forecast flood cards distinctly from confirmed events
- **R5:** Forecast events auto-expire after their forecast window (peakHour + 3h)

### Non-functional
- Weather data fetched once per pipeline run and cached 30 min — no redundant HTTP calls
- No scraping — data sourced entirely from Open-Meteo APIs (free, no key required)
- Forecast zones are district-level (not street-level) — appropriate precision for forecast data

---

## 3. Data Sources

### 3a. Open-Meteo Weather API (existing — expanded)

**Endpoint:** `https://api.open-meteo.com/v1/forecast`
**Location:** HCMC (10.7769, 106.7009)
**New variables added:**
- `hourly`: `soil_moisture_0_to_1cm` (m³/m³)
- `daily`: `precipitation_sum` (mm, next 3 days)

**Existing variables kept:** `temperature_2m`, `rain`, `wind_speed_10m`, `wind_gusts_10m`, `precipitation_probability`, `weather_code`

### 3b. Open-Meteo Flood API (new)

**Endpoint:** `https://flood-api.open-meteo.com/v1/flood`
**Variables:** `daily=river_discharge` (m³/s, next 7 days)
**No API key required.**
**Usage:** Compare current `river_discharge` against 7-day rolling average to detect elevated river levels.

---

## 4. Architecture

```
Pipeline run (every 5 min)
  ├─ fetchEnrichedWeather()            ← new api/_lib/weatherEnrich.ts (weather + flood API)
  │     └─ cached 30 min (module-level, shared with route check)
  ├─ computeFloodRisk(weather)         ← new api/_lib/floodRisk.ts
  │     └─ returns { score, level, peakHour, forecastDistricts[] }
  ├─ [existing] Exa.ai → GPT-4o extraction
  │     └─ enrichFloodSeverity(flood, riskContext)   ← severity/confidence adjustment
  └─ [new] generateForecastEvents(riskContext)       ← upsert_forecast_event() RPC if score ≥ 80

Route check (POST /api/route-check)
  ├─ [existing] active flood intersection
  └─ [new] forecast warning pass (reads is_forecast floods from bbox query)
        └─ appends Vietnamese warning to warnings[]

Frontend
  ├─ IntelligenceFeed: forecast floods rendered with clock icon + "Dự báo —" prefix
  └─ Route result panel: forecast warnings in amber "Cảnh báo dự báo" section
```

---

## 5. Risk Scoring (`api/_lib/floodRisk.ts`)

### Score Formula

| Factor | Variable | Normalisation cap | Weight |
|---|---|---|---|
| Rainfall intensity | Sum of `hourly.rain` (mm/h) for next 6h | 50 mm | 50% |
| Soil saturation | `soil_moisture_0_to_1cm` (m³/m³) | 0.4 m³/m³ | 25% |
| River discharge | `river_discharge[0]` ÷ 7-day rolling avg | ratio 2.0 | 25% |

Each factor = `Math.min(raw / cap, 1.0)`. Composite score = weighted sum × 100.

### Thresholds

| Score | Level | Action |
|---|---|---|
| 0–39 | `low` | No changes |
| 40–59 | `moderate` | No severity upgrades, no forecast events |
| 60–79 | `high` | Severity upgrades on extracted floods |
| 80–100 | `critical` | Severity upgrades + generate forecast events |

### Flood-Prone District Multipliers & Centroids

Defined in `api/_lib/floodRisk.ts` as a static `DISTRICT_RISK_MAP` object:

| District | Lat | Lng | Multiplier | Reason |
|---|---|---|---|---|
| Quận Bình Thạnh | 10.8124 | 106.7143 | 1.3 | Low elevation, riverside |
| Quận 8 | 10.7230 | 106.6285 | 1.3 | Canal network, low elevation |
| Quận 6 | 10.7462 | 106.6340 | 1.2 | Flood-prone drainage area |
| Quận 7 | 10.7320 | 106.7210 | 1.2 | Riverside, Nhà Bè tributary |
| Quận 12 | 10.8680 | 106.6570 | 1.1 | North HCMC, Vàm Thuật river |
| Thủ Đức | 10.8544 | 106.7715 | 1.1 | Đồng Nai river proximity |

`computeFloodRisk()` output includes:
- `score` (0–100), `level` (`low`|`moderate`|`high`|`critical`)
- `peakHour`: ISO8601 timestamp of the hour in the next 6h window with the highest `hourly.rain` value
- `forecastDistricts[]`: top-3 districts sorted by `districtScore = compositeScore × multiplier`, included only when `score ≥ 80`

---

## 6. Pipeline Enrichment (`api/_routes/internal.ts`)

### Severity Upgrade Rules

Applied after GPT-4o / rule-based extraction, before Supabase upsert:

```
if riskScore ≥ 60:
  light → moderate
if riskScore ≥ 80:
  moderate → heavy

if riskScore ≥ 60 AND confidence == 'low':
  confidence → 'medium'
```

### Forecast Event Generation

Triggered when `riskScore ≥ 80` (consistent with Section 5 threshold table). For each district in `forecastDistricts` (sorted by adjusted score, top 3):

```typescript
{
  street_name: 'Khu vực ' + district,
  district,
  city: 'Thành phố Hồ Chí Minh',
  coordinates: DISTRICT_CENTROIDS[district],
  depth_cm: null,
  severity: districtScore > 90 ? 'heavy' : 'moderate',  // districtScore = compositeScore × multiplier, capped at 100
  confidence: 'medium',
  is_forecast: true,
  forecast_valid_until: peakHour + 3h,
  expires_at: peakHour + 3h,
  // sources: not persisted — flood_sources table is not written for forecast events.
  // The FloodEvent.sources array will be [] when read back via toFloodEvent().
  // This is intentional: Section 8 specifies no source URL link in the UI for forecast cards.
}
```

Upserted via a **new `upsert_forecast_event()` stored procedure** (not `upsert_flood_event()`) with conflict key `(district, DATE(forecast_valid_until))` WHERE `is_forecast = true`. This procedure:
- Inserts on conflict-do-nothing (preserves original `expires_at` on re-runs — does NOT reset to `now() + 2h`)
- Returns `NULL` on conflict (no row returned) — this is intentional; callers must NOT insert into `flood_sources` for forecast events (source data is embedded in the event's `sources` field, not a separate table row)

One forecast event per district per day.

**Expiry:** `expire_flood_events()` is intentionally left unchanged. Forecast events have `is_simulated = false` so they are correctly cleaned up by the existing expiry mechanism when `expires_at < now()`. No modification to `expire_flood_events()` is needed.

---

## 7. Route Check Enhancement (`api/_routes/routeCheck.ts`)

After the existing flood intersection check:

1. The bbox query already returns `is_forecast: true` floods (same table, no extra query)
2. Separate them from confirmed floods
3. Call `fetchEnrichedWeather()` (uses the 30-min cache — no extra HTTP call if pipeline already ran). Extract `precipitation_sum_6h` (sum of `hourly.rain` next 6h). If the call fails or cache is cold, `precipitation_sum_6h = null`.

4. For each forecast flood whose district intersects the route bbox, append to `warnings[]`:
   - If `precipitation_sum_6h != null`: `"Khu vực [Quận X] có nguy cơ ngập trong [N] giờ tới — dự báo mưa [Y]mm"`
   - If `precipitation_sum_6h == null`: `"Khu vực [Quận X] có nguy cơ ngập trong [N] giờ tới theo dự báo thời tiết"`

   `[N]` = hours until `forecast_valid_until`, rounded to nearest integer (minimum 1).

5. Does **not** trigger alternative route calculation.

---

## 8. Frontend Changes

### IntelligenceFeed

Forecast cards (`is_forecast: true`) rendered with:
- Clock icon instead of water drop
- `"Dự báo —"` prefix on title
- Secondary/muted text style (e.g. `text-amber-400` instead of `text-red-400`)
- No source URL link (source is forecast model, not news article)

### Route Check Result Panel

If `warnings[]` contains forecast warnings:
- Render in separate collapsible `"Cảnh báo dự báo"` section
- Amber color scheme (vs red for confirmed floods)
- Distinct icon (weather/clock)

---

## 9. Type Changes (`shared/types.ts`)

```typescript
// Added to FloodEvent
is_forecast: boolean           // true = predictive event, not yet confirmed
forecast_valid_until?: string  // ISO8601 — auto-expiry of forecast window

// Added to FloodSourceType
type FloodSourceType = 'news' | 'social' | 'government' | 'vetc_mock' | 'user_report' | 'forecast'
```

**`toFloodEvent()` mapper** (`api/_lib/supabase.ts`) must add:
```typescript
is_forecast: Boolean(row.is_forecast ?? false),
forecast_valid_until: row.forecast_valid_until != null ? String(row.forecast_valid_until) : undefined,
```

---

## 10. Database Migration

```sql
-- Migration: add forecast columns to flood_events
ALTER TABLE flood_events
  ADD COLUMN is_forecast boolean NOT NULL DEFAULT false,
  ADD COLUMN forecast_valid_until timestamptz;

-- Extend source type enum
ALTER TYPE flood_source_type ADD VALUE IF NOT EXISTS 'forecast';

-- Unique constraint: one forecast event per district per day
CREATE UNIQUE INDEX flood_events_forecast_district_day_idx
  ON flood_events (district, DATE(forecast_valid_until))
  WHERE is_forecast = true;

-- New stored procedure: upsert forecast events (conflict = same district + same day)
-- Uses INSERT ... ON CONFLICT DO NOTHING to preserve expires_at on re-runs
CREATE OR REPLACE FUNCTION upsert_forecast_event(
  p_street_name text, p_district text, p_city text,
  p_lat double precision, p_lng double precision,
  p_severity text, p_confidence text,
  p_expires_at timestamptz, p_forecast_valid_until timestamptz
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

---

## 11. Files Changed

| File | Type | Description |
|---|---|---|
| `shared/types.ts` | Modified | Add `is_forecast`, `forecast_valid_until`, `'forecast'` source type |
| `api/_lib/weatherEnrich.ts` | **New** | `fetchEnrichedWeather()` — calls Open-Meteo weather + flood APIs, 30-min cache |
| `api/_lib/floodRisk.ts` | **New** | `computeFloodRisk()` scoring function + district centroid lookup |
| `api/_lib/supabase.ts` | Modified | Update `toFloodEvent()` mapper to read `is_forecast`, `forecast_valid_until` |
| `api/_routes/internal.ts` | Modified | Use risk context in pipeline; call `upsert_forecast_event` RPC |
| `api/_routes/routeCheck.ts` | Modified | Separate forecast floods from confirmed; append forecast warnings |
| `src/components/home/...` | Modified | Forecast card styling in IntelligenceFeed + route warnings |
| `supabase/migrations/002_forecast_events.sql` | **New** | Add columns, unique index, `upsert_forecast_event()` RPC |
| `mocks/presets/heavy_rain_hcmc.json` | Modified | Add `is_forecast: false` to all 20 mock records |

---

## 12. Out of Scope

- NCHMF (nchmf.gov.vn) scraping — OpenWeatherMap alerts cover this
- Map layer overlay for forecast zones — feed cards + route warnings sufficient for demo
- Street-level forecast precision — district-level is appropriate for predictive data
- River discharge per sub-basin — single HCMC-wide measurement from Open-Meteo Flood API
