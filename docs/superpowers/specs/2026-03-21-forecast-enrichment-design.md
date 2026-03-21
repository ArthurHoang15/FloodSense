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
  ├─ fetchEnrichedWeather()          ← expanded Open-Meteo fetch (weather + flood API)
  │     └─ cached 30 min (module-level)
  ├─ computeFloodRisk(weather)       ← new floodRisk.ts
  │     └─ returns { score, level, peakHour, forecastDistricts[] }
  ├─ [existing] Exa.ai → GPT-4o extraction
  │     └─ enrichFloodSeverity(flood, riskContext)   ← severity/confidence adjustment
  └─ [new] generateForecastEvents(riskContext)       ← synthetic FloodEvents if score ≥ 70

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

| Factor | Variable | Weight |
|---|---|---|
| Rainfall intensity | `precipitation_sum` next 6h (mm) | 50% |
| Soil saturation | `soil_moisture_0_to_1cm` (m³/m³) | 25% |
| River discharge | current vs 7-day avg (ratio) | 25% |

Each factor normalized 0–1 (clamped). Composite score = weighted sum × 100.

### Thresholds

| Score | Level | Action |
|---|---|---|
| 0–39 | `low` | No changes |
| 40–59 | `moderate` | No severity upgrades, no forecast events |
| 60–79 | `high` | Severity upgrades on extracted floods |
| 80–100 | `critical` | Severity upgrades + generate forecast events |

### Flood-Prone District Multipliers

Static lookup for HCMC districts with historical flood risk weighting:

| District | Multiplier | Reason |
|---|---|---|
| Quận Bình Thạnh | 1.3 | Low elevation, riverside |
| Quận 8 | 1.3 | Canal network, low elevation |
| Quận 6 | 1.2 | Flood-prone drainage area |
| Quận 7 | 1.2 | Riverside, Nhà Bè tributary |
| Quận 12 | 1.1 | North HCMC, Vàm Thuật river |
| Thủ Đức | 1.1 | Đồng Nai river proximity |

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

Triggered when `riskScore ≥ 70`. For each district in `forecastDistricts` (sorted by adjusted score, top 3):

```typescript
{
  street_name: 'Khu vực ' + district,
  district,
  city: 'Thành phố Hồ Chí Minh',
  coordinates: DISTRICT_CENTROIDS[district],
  depth_cm: null,
  severity: derivedFromDistrictScore,   // moderate or heavy
  confidence: 'medium',
  is_forecast: true,
  forecast_valid_until: peakHour + 3h,
  expires_at: peakHour + 3h,
  sources: [{ source_type: 'forecast', title: 'Open-Meteo Flood API', ... }]
}
```

Upserted with conflict key `(district, is_forecast, DATE(forecast_valid_until))` — one forecast event per district per day.

---

## 7. Route Check Enhancement (`api/_routes/routeCheck.ts`)

After the existing flood intersection check:

1. The bbox query already returns `is_forecast: true` floods (same table, no extra query)
2. Separate them from confirmed floods
3. For each forecast flood whose district intersects the route bbox:

```
"Khu vực [Quận X] có nguy cơ ngập trong [N] giờ tới — dự báo mưa [Y]mm, mực nước sông cao"
```

4. Append to `warnings[]` — does **not** trigger alternative route calculation

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

---

## 10. Database Migration

```sql
-- Migration: add forecast columns to flood_events
ALTER TABLE flood_events
  ADD COLUMN is_forecast boolean NOT NULL DEFAULT false,
  ADD COLUMN forecast_valid_until timestamptz;

-- Unique constraint: one forecast event per district per day
CREATE UNIQUE INDEX flood_events_forecast_district_day_idx
  ON flood_events (district, DATE(forecast_valid_until))
  WHERE is_forecast = true;
```

---

## 11. Files Changed

| File | Type | Description |
|---|---|---|
| `shared/types.ts` | Modified | Add `is_forecast`, `forecast_valid_until`, `'forecast'` source type |
| `api/_lib/weather.ts` | Modified | Expand Open-Meteo fetch + new Flood API fetch |
| `api/_lib/floodRisk.ts` | **New** | `computeFloodRisk()` scoring function + district lookup |
| `api/_routes/internal.ts` | Modified | Use risk context in pipeline |
| `api/_routes/routeCheck.ts` | Modified | Forecast warning pass |
| `src/components/home/...` | Modified | Forecast card styling in IntelligenceFeed + route warnings |
| `supabase/migrations/` | **New** | Add `is_forecast`, `forecast_valid_until` columns |

---

## 12. Out of Scope

- NCHMF (nchmf.gov.vn) scraping — OpenWeatherMap alerts cover this
- Map layer overlay for forecast zones — feed cards + route warnings sufficient for demo
- Street-level forecast precision — district-level is appropriate for predictive data
- River discharge per sub-basin — single HCMC-wide measurement from Open-Meteo Flood API
