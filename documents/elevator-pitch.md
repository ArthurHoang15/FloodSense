## Inspiration

Every rainy season in Ho Chi Minh City, **8.9 million motorcycles** face the same gamble: *which roads are flooded right now?* Google Maps knows the fastest route — but it has zero idea which streets are underwater. We've both been that rider, stuck knee-deep on Nguyen Huu Canh at 6pm, watching our commute turn into a 2-hour nightmare.

HCMC averages **15–30 flood points per heavy rain**, 3–4 times a week during the 6-month monsoon season. Flood information exists — scattered across Facebook groups, news sites, and government bulletins — but none of it is structured, mapped, or actionable in real time. We built FloodSense to fix that.

## What it does

**FloodSense** is a real-time flood intelligence map for HCMC that fuses multiple signal layers into one actionable dashboard:

- **Live Flood Heatmap** — Color-coded flood zones (red = heavy >30cm, orange = moderate, yellow = light) on a Mapbox-powered map, auto-refreshing every 60 seconds
- **AI Intelligence Pipeline** — Exa.ai neural search scrapes Vietnamese news and social media every 5 minutes; GPT-4o extracts structured flood data (street, district, depth, confidence) from articles
- **Route Flood Check** — Enter origin → destination, and FloodSense highlights which segments of your route intersect active flood zones, with Vietnamese voice warnings
- **Live Camera Monitoring** — Public traffic cameras at known flood hotspots provide visual confirmation of road conditions, feeding flood signals back into the confidence scoring system
- **Proactive Alerts** — Save your daily commute routes; when a new flood is detected on your path, you get a push notification + Vietnamese voice alert *before you leave home*
- **Voice Alerts** — ElevenLabs-powered natural Vietnamese TTS (Southern female / Northern male voice options) for hands-free flood warnings while riding
- **Crowdsource Reports** — Riders can report floods directly; 2+ independent confirmations within 200m auto-promote a report to a verified flood event
- **Weather Pre-warning** — 6-hour rainfall forecast from Open-Meteo + government alerts to predict flood risk before rain even starts

The confidence scoring uses **signal fusion**: weather data raises risk, news/social scraping raises evidence, camera feeds and user reports raise confirmation. No single source is trusted alone.

## How we built it

**Frontend:** React 18 + TypeScript + Vite, styled with TailwindCSS. Mapbox GL JS handles the flood heatmap with custom layers and route overlays. State management via Zustand with persist middleware for offline-friendly saved routes.

**Backend:** Express.js on Node.js, deployed as a single Vercel serverless function. PostgreSQL on Supabase with PostGIS extensions for spatial queries — enabling operations like "find all floods within 200m of this route's bounding box" in \\( O(1) \\) using spatial indexes.

**AI Pipeline:**
$$
\text{Exa.ai (neural search)} \xrightarrow{\text{5 queries}} \text{GPT-4o (extraction)} \xrightarrow{\text{dedup 300m}} \text{Supabase (upsert)} \xrightarrow{\text{notify}} \text{User}
$$

Each flood event has a **2-hour TTL** — if no new source confirms it, it auto-expires. Cross-validation requires \\( \geq 2 \\) independent sources for "High" confidence.

**Camera Layer:** Hybrid approach — real HCMC traffic camera locations at flood hotspots (Nguyen Huu Canh, Dinh Bo Linh, Huynh Tan Phat, etc.) with flood detection status signals that feed into the existing confidence scoring.

**Automation:** n8n orchestrates the background intelligence loop — cron every 5 minutes triggers the Exa→GPT-4o→Supabase pipeline, then checks saved routes for affected users and fires push notifications.

**Key APIs:** Exa.ai (neural search), OpenAI GPT-4o (extraction), ElevenLabs (Vietnamese TTS), Mapbox (maps + directions + geocoding), Open-Meteo (weather), OpenWeather (government alerts), Supabase (database + realtime).

## Challenges we ran into

1. **Vietnamese NLP is hard** — GPT-4o occasionally misparses Vietnamese street names with diacritics. "Dinh Bo Linh" vs "duong DBL" all refer to the same road. We implemented fuzzy street matching with PostgreSQL's `pg_trgm` GIN indexes to handle typo-tolerant deduplication.

2. **Vercel's 12-function limit** — Our Express server initially generated too many serverless function entry points. We had to restructure the entire API into a single `api/index.ts` entry point with internal routing, prefixing helper modules with `_` to exclude them from Vercel's function detection.

3. **Flood deduplication radius** — Too small (100m) and the same flood appears as 3 separate events. Too large (500m) and two genuinely different floods on parallel streets merge into one. We landed on **300m** for news/AI sources and **200m** for crowdsource reports after testing with real HCMC street density.

4. **Demo reliability vs. real data** — The app needs rain to show floods, but hackathon demos don't wait for weather. We built a "Simulate Rain" mode that rolls out 15–20 preset flood points with staggered animation, triggering the full notification + voice alert pipeline — so the demo always works regardless of actual weather.

5. **ElevenLabs latency** — Initial voice generation took 4–5 seconds, breaking the "instant alert" feel. We implemented audio caching in the `alert_history` table — if the same alert text was already generated, serve the cached audio URL instead of calling the API again. Got it down to <1 second for repeated alerts.

## What we learned

- **Signal fusion > single source** — No individual data source (news, social media, weather, cameras) is reliable enough alone. The power is in combining weak signals into strong confidence scores.
- **Mock-first design pays off** — Building every feature with a mock fallback meant we were never blocked by API outages or missing credentials. The VETC integration is mock, the camera detection layer uses simulated status — but the architecture is ready for real data.
- **Spatial databases are underrated** — PostGIS turned "find floods near this route" from an \\( O(n) \\) loop into an indexed spatial query. For a map-heavy app, this was a game-changer.
- **Vietnamese voice UX matters** — Offering both Southern and Northern Vietnamese voices wasn't just a feature checkbox — our test users immediately had a preference, and it made the alerts feel personal rather than robotic.

## Built with

`React` · `TypeScript` · `Express.js` · `Mapbox GL` · `Supabase (PostgreSQL + PostGIS)` · `Exa.ai` · `OpenAI GPT-4o` · `ElevenLabs` · `Open-Meteo` · `Zustand` · `TailwindCSS` · `Vite` · `n8n` · `Vercel`
