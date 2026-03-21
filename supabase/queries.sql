-- ============================================================
-- FloodSense HCM — Key API Queries Reference
-- Maps to: API routes defined in the PRD (Section 9)
-- ============================================================
-- HOW TO USE:
--   Each query uses concrete example values.
--   In application code, replace example values with $1/$2
--   positional params (pg) or the Supabase JS client's
--   .eq() / .rpc() / .select() filter builders.
-- ============================================================
-- Sections:
--   Q1  GET  /api/floods
--   Q2  GET  /api/floods/:id
--   Q3  POST /api/route-check
--   Q4  POST /api/report-flood
--   Q5  POST/GET/DELETE /api/saved-routes
--   Q6  GET  /api/alerts (alert history)
--   Q7  Internal: run-pipeline (upsert flood + add source)
--   Q8  Internal: check-saved-routes (notify affected users)
--   Q9  Internal: simulate-rain / reset-simulated
--   Q10 Analytics dashboard (F7)
--   Q11 Weather pre-warning (F10)
--   Q12 VETC anomaly signals (F9)
-- ============================================================


-- ──────────────────────────────────────────────────────────
-- Q1  GET /api/floods
--     Params: district ('all' | 'Bình Thạnh' | …)
--             severity ('all' | 'heavy' | 'moderate' | 'light')
--             updated_since_minutes (integer, default 60)
--             limit (integer, default 50)
-- ──────────────────────────────────────────────────────────

-- Step 1: expire stale events (run once per cron tick, not per request)
select public.expire_flood_events();

-- Step 2: fetch active floods
-- Example: all districts, all severities, updated in last 60 min, max 50 rows
select
  fe.id,
  fe.street_name,
  fe.district,
  fe.city,
  fe.lat,
  fe.lng,
  fe.depth_cm,
  fe.severity,
  fe.confidence,
  fe.source_count,
  fe.first_detected_at,
  fe.last_confirmed_at,
  fe.expires_at,
  fe.is_active,
  fe.is_simulated,
  coalesce(
    json_agg(
      json_build_object(
        'url',          fs.url,
        'title',        fs.title,
        'snippet',      fs.snippet,
        'published_at', fs.published_at,
        'source_type',  fs.source_type
      )
    ) filter (where fs.id is not null),
    '[]'::json
  ) as sources
from public.flood_events fe
left join public.flood_sources fs on fs.flood_event_id = fe.id
where
  fe.is_active  = true
  and fe.expires_at > now()
  -- district filter  → replace 'all' with e.g. 'Bình Thạnh' to filter
  and ('all' = 'all' or fe.district = 'all')
  -- severity filter  → replace 'all' with 'heavy', 'moderate', or 'light' to filter; keep 'all' to skip
  and ('all' = 'all' or fe.severity::text = 'all')
  -- updated_since    → replace 60 with desired minutes
  and fe.last_confirmed_at >= now() - interval '60 minutes'
group by fe.id
order by
  case fe.severity
    when 'heavy'    then 1
    when 'moderate' then 2
    when 'light'    then 3
  end,
  fe.last_confirmed_at desc
limit 50;   -- replace with desired limit


-- ──────────────────────────────────────────────────────────
-- Q2  GET /api/floods/:id   — full detail with all sources
-- ──────────────────────────────────────────────────────────

select
  fe.*,
  json_agg(
    json_build_object(
      'id',           fs.id,
      'url',          fs.url,
      'title',        fs.title,
      'snippet',      fs.snippet,
      'published_at', fs.published_at,
      'source_type',  fs.source_type
    )
    order by fs.published_at desc
  ) filter (where fs.id is not null) as sources
from public.flood_events fe
left join public.flood_sources fs on fs.flood_event_id = fe.id
where fe.id = 'a1000000-0000-0000-0000-000000000001'   -- replace with flood UUID
group by fe.id;


-- ──────────────────────────────────────────────────────────
-- Q3  POST /api/route-check
--     Find all active floods inside a route bounding box.
-- ──────────────────────────────────────────────────────────

-- Option A: stored function (recommended in production)
-- Example bbox: Q7 → Tân Bình commute
select * from public.get_floods_in_bbox(
  10.8200,   -- north  (replace with route bbox)
  10.7200,   -- south
  106.7200,  -- east
  106.6300   -- west
);

-- Option B: inline bounding box query (same result, easier to debug)
select
  id, street_name, district,
  lat, lng, depth_cm, severity, confidence,
  first_detected_at, last_confirmed_at, expires_at
from public.flood_events
where
  is_active  = true
  and expires_at > now()
  and lat between 10.7200 and 10.8200   -- bbox_south, bbox_north
  and lng between 106.6300 and 106.7200  -- bbox_west,  bbox_east
order by severity desc, last_confirmed_at desc;

-- Option C: PostGIS point-radius query (200 m around a single coordinate)
-- Useful for checking if a specific waypoint is in a flood zone
select
  id, street_name, district,
  lat, lng, depth_cm, severity, confidence,
  round(st_distance(location, st_point(106.7181, 10.7972)::geography)::numeric, 0) as distance_m
from public.flood_events
where
  is_active  = true
  and expires_at > now()
  and st_dwithin(
    location,
    st_point(106.7181, 10.7972)::geography,   -- (lng, lat) of waypoint
    200                                         -- radius metres
  )
order by distance_m asc;


-- ──────────────────────────────────────────────────────────
-- Q4  POST /api/report-flood   — crowdsource flood report
-- ──────────────────────────────────────────────────────────

-- 4a. Insert new user report
-- Replace values with actual request body fields
insert into public.user_reports (
  user_id, anonymous_id,
  lat, lng, severity, note
) values (
  null,                        -- user_id (null if anonymous)
  'anon-session-abc123',       -- anonymous_id from localStorage
  10.7972,                     -- lat
  106.7181,                    -- lng
  'heavy',                     -- severity: heavy | moderate | light
  'Ngập sâu khoảng 50cm, xe máy không qua được'  -- optional note
)
returning id;


-- 4b. Find nearby pending reports and increment confirm_count
-- Run this after 4a; replace '...' with the id returned above
with new_report as (
  select id, location
  from public.user_reports
  where id = '00000000-0000-0000-0000-000000000000'::uuid   -- replace with id returned by step 4a
),
nearby as (
  select r.id
  from public.user_reports r
  cross join new_report n
  where
    r.status     = 'pending'
    and r.id     != n.id
    and r.created_at >= now() - interval '2 hours'
    and st_dwithin(r.location, n.location, 200)   -- 200 m radius
  limit 1
)
update public.user_reports
set confirm_count = confirm_count + 1
where id in (select id from nearby)
returning id, confirm_count;


-- 4c. Promote to flood_event when confirm_count reaches 2
-- Call upsert_flood_event() with reverse-geocoded street/district
select public.upsert_flood_event(
  p_street_name  => 'Nguyễn Hữu Cảnh',    -- from reverse geocode
  p_district     => 'Bình Thạnh',
  p_lat          => 10.7972,
  p_lng          => 106.7181,
  p_depth_cm     => null,                  -- unknown from user report
  p_severity     => 'heavy',
  p_confidence   => 'low',                 -- user reports start low
  p_is_simulated => false
);


-- ──────────────────────────────────────────────────────────
-- Q5  Saved Routes CRUD
-- ──────────────────────────────────────────────────────────

-- 5a. GET — list routes for a session (max 3 per PRD F5)
select
  id, name,
  origin_lat, origin_lng, origin_address,
  destination_lat, destination_lng, destination_address,
  route_polyline,
  bbox_north, bbox_south, bbox_east, bbox_west,
  notify_enabled, created_at
from public.saved_routes
where
  user_id      = '00000000-0000-0000-0000-000000000000'::uuid   -- replace with actual user UUID
  or anonymous_id = 'anon-session-abc123'                        -- replace with localStorage anonymous_id
order by created_at asc
limit 3;


-- 5b. POST — save a new route
insert into public.saved_routes (
  user_id, anonymous_id,
  name,
  origin_lat,       origin_lng,       origin_address,
  destination_lat,  destination_lng,  destination_address,
  route_polyline,
  bbox_north, bbox_south, bbox_east, bbox_west,
  notify_enabled
) values (
  null,                       -- user_id (null if anonymous)
  'anon-session-abc123',      -- anonymous_id
  'Nhà → Công ty',            -- display name
  10.7368,  106.7024,  '123 Lê Văn Lương, Q.7',   -- origin
  10.7990,  106.6530,  '45 Trường Chinh, Tân Bình', -- destination
  'encoded_polyline_string',  -- Mapbox encoded polyline
  10.8100,  10.7200,  106.7200,  106.6300,          -- bbox N/S/E/W
  true
)
returning id;


-- 5c. PATCH — toggle notifications on a route
update public.saved_routes
set notify_enabled = false        -- true or false
where
  id        = '00000000-0000-0000-0000-000000000000'::uuid   -- replace with route UUID
  and (user_id = '00000000-0000-0000-0000-000000000000'::uuid or anonymous_id = 'anon-session-abc123');


-- 5d. DELETE — remove a saved route
delete from public.saved_routes
where
  id        = '00000000-0000-0000-0000-000000000000'::uuid   -- replace with route UUID
  and (user_id = '00000000-0000-0000-0000-000000000000'::uuid or anonymous_id = 'anon-session-abc123');


-- ──────────────────────────────────────────────────────────
-- Q6  GET /api/alerts   — last 10 alerts for a session
-- ──────────────────────────────────────────────────────────

-- Fetch alert history with joined route + flood info
select
  ah.id,
  ah.message,
  ah.audio_url,
  ah.sent_at,
  ah.read_at,
  sr.name          as route_name,
  fe.street_name   as flood_street,
  fe.district      as flood_district,
  fe.severity      as flood_severity
from public.alert_history ah
left join public.saved_routes sr on sr.id = ah.route_id
left join public.flood_events  fe on fe.id = ah.flood_event_id
where
  ah.user_id      = '00000000-0000-0000-0000-000000000000'::uuid   -- replace with actual user UUID
  or ah.anonymous_id = 'anon-session-abc123'
order by ah.sent_at desc
limit 10;


-- Mark a batch of alerts as read (pass array of UUIDs)
update public.alert_history
set read_at = now()
where
  id = any(array[
    'a1000000-0000-0000-0000-000000000001'::uuid,   -- replace with actual alert UUIDs
    'a1000000-0000-0000-0000-000000000002'::uuid
  ])
  and (user_id = '00000000-0000-0000-0000-000000000000'::uuid or anonymous_id = 'anon-session-abc123')
  and read_at is null;


-- ──────────────────────────────────────────────────────────
-- Q7  Internal: POST /api/internal/run-pipeline
--     Called by n8n after Exa.ai + GPT-4o processing.
--     Repeat steps 7a–7b for each extracted flood event.
-- ──────────────────────────────────────────────────────────

-- 7a + 7b combined: upsert flood event then insert its source in one atomic statement.
-- The CTE captures the UUID returned by upsert_flood_event() and pipes it directly
-- into the INSERT — no placeholder UUID needed.
with upserted as (
  select public.upsert_flood_event(
    p_street_name  => 'Nguyễn Hữu Cảnh',
    p_district     => 'Bình Thạnh',
    p_lat          => 10.7972,
    p_lng          => 106.7181,
    p_depth_cm     => 55,
    p_severity     => 'heavy',
    p_confidence   => 'high',
    p_is_simulated => false
  ) as flood_id
)
insert into public.flood_sources (flood_event_id, url, title, snippet, published_at, source_type)
select
  flood_id,
  'https://tuoitre.vn/nguyen-huu-canh-ngap-20260321.htm',
  'Đường Nguyễn Hữu Cảnh ngập nặng sau mưa chiều nay',
  'Tuyến đường Nguyễn Hữu Cảnh ngập sâu khoảng 50–60 cm, nhiều xe máy chết máy.',
  now() - interval '10 minutes',
  'news'::flood_source_type
from upserted
returning flood_event_id;


-- 7c. Log the completed pipeline run
insert into public.pipeline_runs (
  queries_run, articles_fetched,
  new_floods_found, updated_floods,
  users_notified, status
) values (
  5,   -- number of Exa.ai query templates run
  23,  -- total articles returned
  2,   -- net-new flood_events inserted
  3,   -- existing events re-confirmed
  8,   -- push notifications sent
  'success'
)
returning id;


-- ──────────────────────────────────────────────────────────
-- Q8  Internal: POST /api/internal/check-saved-routes
--     Find saved routes overlapping a new flood event,
--     then create alert_history rows for notification.
-- ──────────────────────────────────────────────────────────

-- 8a. Find all saved routes whose bbox contains the new flood
select * from public.get_affected_routes(
  'a1000000-0000-0000-0000-000000000001'   -- flood_event id
);
-- Returns: route_id, user_id, anonymous_id, route_name, notify_enabled


-- 8b. Insert alert row for one affected route
-- (n8n loops this per row returned by 8a)
insert into public.alert_history (
  user_id, anonymous_id,
  route_id, flood_event_id,
  message, audio_url
)
select
  sr.user_id,
  sr.anonymous_id,
  sr.id,
  fe.id,
  '⚠️ Tuyến ' || sr.name
    || ' có ngập mới tại ' || fe.street_name || ', ' || fe.district
    || '. Độ sâu ước tính ' || coalesce(fe.depth_cm::text, '?') || ' cm.',
  null   -- audio_url: set after ElevenLabs TTS call; update later
from public.saved_routes sr
join public.flood_events  fe on fe.id = 'a1000000-0000-0000-0000-000000000001'
where sr.id = '00000000-0000-0000-0000-000000000000'::uuid;   -- replace with route UUID from step 8a


-- 8c. Update audio_url after ElevenLabs generates the clip
update public.alert_history
set audio_url = 'https://your-bucket.supabase.co/storage/v1/object/public/audio/alert-abc.mp3'
where
  flood_event_id = 'a1000000-0000-0000-0000-000000000001'
  and audio_url is null
  and sent_at >= now() - interval '2 minutes';


-- 8d. Fetch completed alerts for push notification dispatch
select
  ah.id,
  ah.message,
  ah.audio_url,
  u.id as user_id
from public.alert_history ah
left join public.users u on u.id = ah.user_id
where
  ah.flood_event_id = 'a1000000-0000-0000-0000-000000000001'
  and ah.sent_at    >= now() - interval '2 minutes'
  and u.notification_enabled = true;


-- ──────────────────────────────────────────────────────────
-- Q9  Internal: simulate-rain / reset-simulated
-- ──────────────────────────────────────────────────────────

-- 9a. After inserting simulated events via upsert_flood_event(is_simulated=true),
--     activate them with a short 30-min TTL for the demo
update public.flood_events
set
  is_active  = true,
  expires_at = now() + interval '30 minutes',
  updated_at = now()
where
  is_simulated = true
  and is_active = false;


-- 9b. Reset: delete all simulated data (called by /api/internal/reset-simulated)
select public.clear_simulated_floods();
-- Returns: number of rows deleted


-- ──────────────────────────────────────────────────────────
-- Q10  Analytics Dashboard (F7)
-- ──────────────────────────────────────────────────────────

-- 10a. Top 10 most-flooded streets — last 7 days
select * from public.get_flood_analytics(7);
-- Returns: street_name, district, flood_count, avg_depth_cm, last_flood_at


-- 10b. Flood count by hour of day (peak-hours bar chart)
select
  extract(hour from first_detected_at at time zone 'Asia/Ho_Chi_Minh')::int as hour_of_day,
  count(*) as flood_count
from public.flood_events
where
  is_simulated      = false
  and first_detected_at >= now() - interval '30 days'
group by hour_of_day
order by hour_of_day;


-- 10c. Daily flood count for timeline chart (last 30 days)
select
  (date_trunc('day', first_detected_at at time zone 'Asia/Ho_Chi_Minh'))::date as flood_date,
  count(*)                                                      as flood_count,
  count(*) filter (where severity = 'heavy')                    as heavy_count,
  count(*) filter (where severity = 'moderate')                 as moderate_count,
  count(*) filter (where severity = 'light')                    as light_count
from public.flood_events
where
  is_simulated      = false
  and first_detected_at >= now() - interval '30 days'
group by flood_date
order by flood_date desc;


-- 10d. Live counters widget — today's stats
select
  count(*)                                                   as total_today,
  count(*) filter (where severity = 'heavy')                 as heavy_today,
  count(*) filter (where is_active = true)                   as currently_active,
  count(distinct district)                                   as districts_affected
from public.flood_events
where
  is_simulated      = false
  and first_detected_at >= (current_date at time zone 'Asia/Ho_Chi_Minh');


-- ──────────────────────────────────────────────────────────
-- Q11  Weather Pre-warning (F10)
--      Banner: "Dự báo mưa lớn lúc 16:00 — điểm thường ngập: …"
-- ──────────────────────────────────────────────────────────

-- 11a. Check if heavy rain forecast in the next 2 hours
select
  forecast_at,
  rain_probability,
  rain_intensity,
  rain_mm_per_hour
from public.weather_forecasts
where
  forecast_at between now() and now() + interval '2 hours'
  and rain_probability >= 0.70
order by forecast_at asc
limit 1;


-- 11b. Chronic flood hotspots to populate the warning banner
-- Streets that flooded ≥ 2 times in the last 30 days
select
  street_name,
  district,
  count(*)                              as historical_floods,
  round(avg(depth_cm)::numeric, 0)      as typical_depth_cm
from public.flood_events
where
  is_simulated      = false
  and first_detected_at >= now() - interval '30 days'
group by street_name, district
having count(*) >= 2
order by historical_floods desc, typical_depth_cm desc
limit 5;


-- ──────────────────────────────────────────────────────────
-- Q12  VETC Anomaly Signals (F9 — mock data)
-- ──────────────────────────────────────────────────────────

-- 12a. Active potential_flood signals (fresh within 15 min)
select
  segment_id,
  segment_name,
  lat, lng,
  current_volume,
  baseline_volume,
  drop_ratio,
  signal_type,
  anomaly_score,
  recorded_at
from public.vetc_traffic_signals
where
  signal_type  = 'potential_flood'
  and recorded_at >= now() - interval '15 minutes'
order by anomaly_score desc;


-- 12b. VETC signal correlated with nearby confirmed flood event
-- Shows the "anomaly → flood confirmation" story for the Tasco pitch
select
  v.segment_name,
  v.lat,
  v.lng,
  v.drop_ratio,
  v.anomaly_score,
  v.signal_type,
  fe.id            as matched_flood_id,
  fe.street_name   as confirmed_flood_street,
  fe.severity,
  fe.confidence,
  round(st_distance(v.location, fe.location)::numeric, 0) as distance_m
from public.vetc_traffic_signals v
left join public.flood_events fe on
  fe.is_active = true
  and st_dwithin(v.location, fe.location, 500)   -- within 500 m
where
  v.signal_type  = 'potential_flood'
  and v.recorded_at >= now() - interval '15 minutes'
order by v.anomaly_score desc;
