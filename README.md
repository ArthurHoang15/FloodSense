# FloodSense (HCMC) — Mock-first Demo

FloodSense is a mock-first demo app for **HCMC flood awareness**:
- Mapbox map + heatmap (flood points)
- Route check warnings
- “Simulate Rain” preset (animated)
- Voice alerts (browser TTS)
- Saved routes + notification alerts (polling in demo mode)

This repo intentionally **does not integrate Tasco/VETC live data**.

## Requirements

- Bun
- A Mapbox token for the map: set `VITE_MAPBOX_TOKEN`

## Run

```bash
bun install
bun run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`

## Environment

Copy `.env.example` to `.env` and fill what you need.

Minimum for map:
- `VITE_MAPBOX_TOKEN`

Recommended for realistic route geometry in `/api/route-check`:
- `MAPBOX_TOKEN`

Recommended for real address search in route inputs and the map search dock:
- `MAPBOX_TOKEN`

## Mock data

- `mocks/presets/heavy_rain_hcmc.json`: Simulate Rain preset
- `mocks/vetc/traffic_flow.seed.json`: mock traffic-flow + baseline
- `mocks/geo/hcmc_segments.geojson`: sample segments GeoJSON
- `mocks/exa/searchAndContents.sample.json`: sample Exa-like response
