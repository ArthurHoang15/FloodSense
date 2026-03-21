-- ============================================================
-- FloodSense HCM — Supabase Database Schema
-- Migration: 001_initial_schema
-- ============================================================
-- Tables:
--   users                — extends Supabase auth.users
--   flood_events         — core flood event records
--   flood_sources        — news/social/gov sources per event
--   saved_routes         — user commute routes to monitor
--   alert_history        — flood alert delivery log
--   pipeline_runs        — n8n Exa+GPT-4o execution log
--   vetc_traffic_signals — mock VETC anomaly signals (demo)
--   weather_forecasts    — Open-Meteo rain forecasts
--   user_reports         — crowdsourced flood reports
-- ============================================================


-- ┌──────────────────────────┐
-- │  1. Extensions            │
-- └──────────────────────────┘

create extension if not exists "uuid-ossp";
create extension if not exists "postgis";       -- spatial queries (flood zones, route intersection)
create extension if not exists "pg_trgm";       -- fuzzy text search on street names


-- ┌──────────────────────────┐
-- │  2. Enum Types            │
-- └──────────────────────────┘

create type severity_level as enum ('heavy', 'moderate', 'light');
-- heavy   = > 30 cm  → red heatmap
-- moderate = 15–30 cm → orange
-- light   = < 15 cm  → yellow

create type confidence_level as enum ('high', 'medium', 'low');
-- high   = ≥ 2 independent sources confirmed
-- medium = 1 source or unverified report
-- low    = single social post / uncertain data

create type flood_source_type as enum (
  'news',         -- vnexpress, tuoitre, thanhnien, etc.
  'social',       -- facebook group, zalo, twitter
  'government',   -- imhen, hcmc dpc official
  'vetc_mock',    -- anomaly from mock VETC traffic signal
  'user_report'   -- crowdsourced from app users
);

create type pipeline_run_status as enum ('running', 'success', 'failed');

create type report_status as enum ('pending', 'confirmed', 'rejected');


-- ┌──────────────────────────┐
-- │  3. Tables                │
-- └──────────────────────────┘

-- ─────────────────────────────────────────
-- 3.1  users
-- ─────────────────────────────────────────
-- Lightweight profile extending Supabase auth.users.
-- Anonymous sessions identified by anonymous_id (localStorage fingerprint).

create table public.users (
  id                   uuid        primary key references auth.users(id) on delete cascade,
  email                text,
  anonymous_id         text        unique,            -- localStorage fingerprint for anon sessions
  notification_enabled boolean     not null default true,
  voice_preference     text        not null default 'female_south'
                                   check (voice_preference in ('female_south', 'male_north')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on table  public.users                        is 'User profiles extending Supabase auth';
comment on column public.users.anonymous_id           is 'Fingerprint stored in localStorage for unauthenticated sessions';
comment on column public.users.voice_preference       is 'female_south = giọng nữ miền Nam, male_north = giọng nam miền Bắc';


-- ─────────────────────────────────────────
-- 3.2  flood_events
-- ─────────────────────────────────────────
-- Central table. Each row is one flood point.
-- Deduplication: upsert_flood_event() merges events within 300 m on same street.

create table public.flood_events (
  id                 uuid              primary key default gen_random_uuid(),
  street_name        text              not null,
  district           text              not null,
  city               text              not null default 'HCMC',
  lat                double precision  not null,
  lng                double precision  not null,
  location           geography(Point, 4326),       -- populated by trigger; used for spatial queries
  depth_cm           integer           check (depth_cm is null or depth_cm >= 0),
  severity           severity_level    not null,
  confidence         confidence_level  not null,
  source_count       integer           not null default 1,  -- denormalized; incremented on each new source
  first_detected_at  timestamptz       not null default now(),
  last_confirmed_at  timestamptz       not null default now(),
  expires_at         timestamptz       not null,             -- = first_detected_at + 2h (set by trigger)
  is_active          boolean           not null default true,
  is_simulated       boolean           not null default false,
  created_at         timestamptz       not null default now(),
  updated_at         timestamptz       not null default now()
);

comment on table  public.flood_events                  is 'Core flood event records for HCMC';
comment on column public.flood_events.location         is 'PostGIS geography point auto-populated from lat/lng';
comment on column public.flood_events.source_count     is 'Number of independent sources; ≥2 = high confidence';
comment on column public.flood_events.expires_at       is 'Auto-set to first_detected_at + 2h; event deactivates after this';
comment on column public.flood_events.is_simulated     is 'true only for Simulate Rain demo data; never persisted long-term';


-- ─────────────────────────────────────────
-- 3.3  flood_sources
-- ─────────────────────────────────────────
-- One-to-many: each flood_event can have multiple independent sources.
-- Used to build confidence scores and populate popup cards.

create table public.flood_sources (
  id              uuid              primary key default gen_random_uuid(),
  flood_event_id  uuid              not null references public.flood_events(id) on delete cascade,
  url             text              not null,
  title           text,
  snippet         text,             -- ≤ 500 chars, extracted by GPT-4o or Exa.ai
  published_at    timestamptz,
  source_type     flood_source_type not null,
  created_at      timestamptz       not null default now()
);

comment on table  public.flood_sources             is 'News/social/gov sources backing each flood event';
comment on column public.flood_sources.snippet     is 'Relevant excerpt extracted by Exa.ai or GPT-4o (≤500 chars)';


-- ─────────────────────────────────────────
-- 3.4  saved_routes
-- ─────────────────────────────────────────
-- User-saved commute routes. Bounding box used for fast flood intersection.
-- Either user_id (authenticated) or anonymous_id (localStorage) must be set.

create table public.saved_routes (
  id                  uuid              primary key default gen_random_uuid(),
  user_id             uuid              references public.users(id) on delete cascade,
  anonymous_id        text,                         -- for unauthenticated sessions
  name                text              not null,   -- e.g. "Nhà → Công ty"
  origin_lat          double precision  not null,
  origin_lng          double precision  not null,
  origin_address      text,
  destination_lat     double precision  not null,
  destination_lng     double precision  not null,
  destination_address text,
  route_polyline      text,                         -- Mapbox encoded polyline string
  bbox_north          double precision  not null,
  bbox_south          double precision  not null,
  bbox_east           double precision  not null,
  bbox_west           double precision  not null,
  notify_enabled      boolean           not null default true,
  created_at          timestamptz       not null default now(),

  constraint chk_saved_routes_owner check (
    user_id is not null or anonymous_id is not null
  )
);

comment on table  public.saved_routes               is 'User commute routes monitored for floods';
comment on column public.saved_routes.route_polyline is 'Mapbox-encoded polyline; decoded on frontend for rendering';
comment on column public.saved_routes.bbox_north     is 'Bounding box used for fast O(1) flood intersection without PostGIS';


-- ─────────────────────────────────────────
-- 3.5  alert_history
-- ─────────────────────────────────────────
-- Records every push notification / voice alert sent.
-- read_at set by client when user opens the notification.

create table public.alert_history (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        references public.users(id) on delete set null,
  anonymous_id    text,
  route_id        uuid        references public.saved_routes(id) on delete set null,
  flood_event_id  uuid        references public.flood_events(id) on delete set null,
  message         text        not null,
  audio_url       text,                     -- Supabase Storage URL for cached ElevenLabs audio
  sent_at         timestamptz not null default now(),
  read_at         timestamptz
);

comment on table  public.alert_history           is 'History of flood alerts delivered to users';
comment on column public.alert_history.audio_url is 'Cached ElevenLabs TTS in Supabase Storage; reused if same alert text';


-- ─────────────────────────────────────────
-- 3.6  pipeline_runs
-- ─────────────────────────────────────────
-- Execution log for the n8n → Exa.ai → GPT-4o background pipeline.
-- Used for monitoring, debugging, and the analytics dashboard.

create table public.pipeline_runs (
  id                uuid                primary key default gen_random_uuid(),
  started_at        timestamptz         not null default now(),
  completed_at      timestamptz,
  queries_run       integer             not null default 0,   -- number of Exa.ai query templates run
  articles_fetched  integer             not null default 0,   -- total articles returned by Exa.ai
  new_floods_found  integer             not null default 0,   -- net-new flood events inserted
  updated_floods    integer             not null default 0,   -- existing events updated (re-confirmed)
  users_notified    integer             not null default 0,   -- push notifications sent this run
  status            pipeline_run_status not null default 'running',
  error_message     text
);

comment on table public.pipeline_runs is 'n8n Exa.ai+GPT-4o pipeline execution audit log';


-- ─────────────────────────────────────────
-- 3.7  vetc_traffic_signals
-- ─────────────────────────────────────────
-- Mock VETC traffic volume anomaly detector.
-- Demo/hackathon only — no real Tasco/VETC data.
-- drop_ratio > 0.4 → potential_flood signal.

create table public.vetc_traffic_signals (
  id               uuid              primary key default gen_random_uuid(),
  segment_id       text              not null,         -- e.g. "VETC-BT-NHC-001"
  segment_name     text              not null,         -- human-readable road segment
  lat              double precision  not null,
  lng              double precision  not null,
  location         geography(Point, 4326),             -- populated by trigger
  current_volume   integer           not null default 0,
  baseline_volume  integer           not null default 0,
  drop_ratio       double precision  not null default 0
                   check (drop_ratio >= 0 and drop_ratio <= 1),
  signal_type      text              not null default 'normal'
                   check (signal_type in ('normal', 'potential_flood')),
  anomaly_score    double precision  not null default 0
                   check (anomaly_score >= 0 and anomaly_score <= 1),
  recorded_at      timestamptz       not null default now()
);

comment on table  public.vetc_traffic_signals              is 'Mock VETC traffic anomaly signals (demo, not real Tasco data)';
comment on column public.vetc_traffic_signals.drop_ratio   is '(baseline - current) / baseline; > 0.4 triggers potential_flood';
comment on column public.vetc_traffic_signals.anomaly_score is 'Normalised 0–1 score: min(1, max(0, (drop_ratio - 0.1) / 0.6))';


-- ─────────────────────────────────────────
-- 3.8  weather_forecasts
-- ─────────────────────────────────────────
-- Hourly rain forecast from Open-Meteo (free API).
-- Used for pre-warnings: "Dự báo mưa lớn lúc 16:00 — các điểm thường ngập: ..."

create table public.weather_forecasts (
  id                uuid        primary key default gen_random_uuid(),
  forecast_at       timestamptz not null,
  rain_probability  real        not null check (rain_probability >= 0 and rain_probability <= 1),
  rain_mm_per_hour  real,
  rain_intensity    text        not null default 'none'
                    check (rain_intensity in ('none', 'light', 'moderate', 'heavy')),
  temperature_c     real,
  source            text        not null default 'open-meteo',
  created_at        timestamptz not null default now()
);

comment on table  public.weather_forecasts                  is 'Hourly rain forecast from Open-Meteo for pre-flood warnings';
comment on column public.weather_forecasts.forecast_at      is 'The hour this forecast applies to (UTC)';
comment on column public.weather_forecasts.rain_probability is '0.0–1.0; ≥ 0.70 triggers pre-warning banner';


-- ─────────────────────────────────────────
-- 3.9  user_reports
-- ─────────────────────────────────────────
-- Crowdsourced flood reports from app users (F8).
-- pending → 2+ confirms → confirmed → merged into flood_events.

create table public.user_reports (
  id              uuid              primary key default gen_random_uuid(),
  user_id         uuid              references public.users(id) on delete set null,
  anonymous_id    text,
  lat             double precision  not null,
  lng             double precision  not null,
  location        geography(Point, 4326),           -- populated by trigger
  severity        severity_level    not null,
  note            text,                             -- optional free-text from reporter
  status          report_status     not null default 'pending',
  flood_event_id  uuid              references public.flood_events(id) on delete set null,
  confirm_count   integer           not null default 1,
  created_at      timestamptz       not null default now()
);

comment on table  public.user_reports               is 'Crowdsourced flood reports; confirmed reports merge into flood_events';
comment on column public.user_reports.confirm_count is 'Incremented when another user reports same location; ≥2 → confirmed';
comment on column public.user_reports.flood_event_id is 'Set when report is promoted to an official flood_event';


-- ┌──────────────────────────┐
-- │  4. Indexes               │
-- └──────────────────────────┘

-- flood_events — most queried table (GET /api/floods, route-check, expiry)
create index idx_flood_events_active        on public.flood_events (is_active)       where is_active = true;
create index idx_flood_events_district      on public.flood_events (district);
create index idx_flood_events_severity      on public.flood_events (severity);
create index idx_flood_events_expires_at    on public.flood_events (expires_at);
create index idx_flood_events_last_confirmed on public.flood_events (last_confirmed_at desc);
create index idx_flood_events_location      on public.flood_events using gist (location);
create index idx_flood_events_lat_lng       on public.flood_events (lat, lng);     -- bounding box queries without PostGIS
create index idx_flood_events_street_trgm   on public.flood_events using gin (street_name gin_trgm_ops);
create index idx_flood_events_simulated     on public.flood_events (is_simulated)  where is_simulated = true;

-- flood_sources
create index idx_flood_sources_event  on public.flood_sources (flood_event_id);
create index idx_flood_sources_type   on public.flood_sources (source_type);

-- saved_routes
create index idx_saved_routes_user      on public.saved_routes (user_id)       where user_id is not null;
create index idx_saved_routes_anonymous on public.saved_routes (anonymous_id)  where anonymous_id is not null;
create index idx_saved_routes_notify    on public.saved_routes (notify_enabled) where notify_enabled = true;

-- alert_history
create index idx_alert_history_user   on public.alert_history (user_id, sent_at desc);
create index idx_alert_history_unread on public.alert_history (user_id, sent_at desc) where read_at is null;
create index idx_alert_history_anon   on public.alert_history (anonymous_id, sent_at desc) where anonymous_id is not null;

-- pipeline_runs
create index idx_pipeline_runs_started on public.pipeline_runs (started_at desc);
create index idx_pipeline_runs_status  on public.pipeline_runs (status);

-- vetc_traffic_signals
create index idx_vetc_segment   on public.vetc_traffic_signals (segment_id);
create index idx_vetc_recorded  on public.vetc_traffic_signals (recorded_at desc);
create index idx_vetc_signal    on public.vetc_traffic_signals (signal_type) where signal_type = 'potential_flood';
create index idx_vetc_location  on public.vetc_traffic_signals using gist (location);

-- weather_forecasts
create index idx_weather_forecast_at on public.weather_forecasts (forecast_at desc);

-- user_reports
create index idx_user_reports_status   on public.user_reports (status);
create index idx_user_reports_location on public.user_reports using gist (location);
create index idx_user_reports_created  on public.user_reports (created_at desc);


-- ┌───────────────────────────────────────┐
-- │  5. Functions & Triggers               │
-- └───────────────────────────────────────┘

-- ─────────────────────────────────────────
-- 5.1  Auto-populate geography column
-- Shared trigger function: works for flood_events, vetc_traffic_signals, user_reports
-- ─────────────────────────────────────────
create or replace function public.fn_set_geography_point()
returns trigger
language plpgsql
as $$
begin
  new.location := st_point(new.lng, new.lat)::geography;
  return new;
end;
$$;

create trigger trg_flood_events_location
  before insert or update of lat, lng on public.flood_events
  for each row execute function public.fn_set_geography_point();

create trigger trg_vetc_signals_location
  before insert or update of lat, lng on public.vetc_traffic_signals
  for each row execute function public.fn_set_geography_point();

create trigger trg_user_reports_location
  before insert or update of lat, lng on public.user_reports
  for each row execute function public.fn_set_geography_point();


-- ─────────────────────────────────────────
-- 5.2  Auto-set expires_at and updated_at on flood_events
-- ─────────────────────────────────────────
create or replace function public.fn_flood_event_defaults()
returns trigger
language plpgsql
as $$
begin
  -- On INSERT: auto-set expires_at if caller didn't provide it
  if tg_op = 'INSERT' and new.expires_at is null then
    new.expires_at := new.first_detected_at + interval '2 hours';
  end if;
  -- Always bump updated_at
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_flood_events_defaults
  before insert or update on public.flood_events
  for each row execute function public.fn_flood_event_defaults();


-- ─────────────────────────────────────────
-- 5.3  Auto updated_at on users
-- ─────────────────────────────────────────
create or replace function public.fn_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_users_updated_at
  before update on public.users
  for each row execute function public.fn_set_updated_at();


-- ─────────────────────────────────────────
-- 5.4  expire_flood_events()
-- Called by n8n cron (e.g. every 5 minutes) to deactivate stale events.
-- Returns number of rows deactivated.
-- ─────────────────────────────────────────
create or replace function public.expire_flood_events()
returns integer
language plpgsql
security definer
as $$
declare
  rows_updated integer;
begin
  update public.flood_events
  set
    is_active  = false,
    updated_at = now()
  where
    is_active     = true
    and is_simulated = false       -- never auto-expire simulated demo data
    and expires_at   < now();

  get diagnostics rows_updated = row_count;
  return rows_updated;
end;
$$;

comment on function public.expire_flood_events is
  'Deactivate flood events past expires_at. Called by n8n every 5 min via POST /api/internal/run-pipeline.';


-- ─────────────────────────────────────────
-- 5.5  upsert_flood_event()
-- Core deduplication logic for the Exa.ai + GPT-4o pipeline.
-- If an active event exists on the same street within 300 m → update it.
-- Otherwise → insert a new event.
-- Returns the UUID of the inserted/updated row.
-- ─────────────────────────────────────────
create or replace function public.upsert_flood_event(
  p_street_name   text,
  p_district      text,
  p_lat           double precision,
  p_lng           double precision,
  p_depth_cm      integer          default null,
  p_severity      severity_level   default 'moderate',
  p_confidence    confidence_level default 'low',
  p_is_simulated  boolean          default false
)
returns uuid
language plpgsql
security definer
as $$
declare
  existing_id uuid;
  result_id   uuid;
begin
  -- Look for an active event within 300 m on the same street/district
  select id into existing_id
  from public.flood_events
  where
    is_active = true
    and district  = p_district
    and lower(street_name) = lower(p_street_name)
    and st_distance(
      location,
      st_point(p_lng, p_lat)::geography
    ) < 300
  order by last_confirmed_at desc
  limit 1;

  if existing_id is not null then
    -- Re-confirm: extend expiry, update depth/severity if new data is stronger
    update public.flood_events set
      depth_cm          = coalesce(p_depth_cm, depth_cm),
      severity          = case
                            when p_severity   = 'heavy'    then 'heavy'::severity_level
                            when severity     = 'heavy'    then 'heavy'::severity_level
                            when p_severity   = 'moderate' then 'moderate'::severity_level
                            else severity
                          end,
      confidence        = case
                            when p_confidence = 'high'   then 'high'::confidence_level
                            when confidence   = 'high'   then 'high'::confidence_level
                            when p_confidence = 'medium' then 'medium'::confidence_level
                            else confidence
                          end,
      source_count      = source_count + 1,
      last_confirmed_at = now(),
      expires_at        = now() + interval '2 hours',
      updated_at        = now()
    where id = existing_id;

    return existing_id;

  else
    -- Brand-new flood point
    insert into public.flood_events (
      street_name, district, city,
      lat, lng,
      depth_cm, severity, confidence,
      source_count,
      first_detected_at, last_confirmed_at, expires_at,
      is_active, is_simulated
    ) values (
      p_street_name, p_district, 'HCMC',
      p_lat, p_lng,
      p_depth_cm, p_severity, p_confidence,
      1,
      now(), now(), now() + interval '2 hours',
      true, p_is_simulated
    )
    returning id into result_id;

    return result_id;
  end if;
end;
$$;

comment on function public.upsert_flood_event is
  'Insert or update a flood event with 300 m deduplication radius. Used by the n8n pipeline endpoint.';


-- ─────────────────────────────────────────
-- 5.6  get_floods_in_bbox()
-- Route-check: return all active floods inside a bounding box.
-- Used by POST /api/route-check.
-- ─────────────────────────────────────────
create or replace function public.get_floods_in_bbox(
  p_north double precision,
  p_south double precision,
  p_east  double precision,
  p_west  double precision
)
returns setof public.flood_events
language sql
stable
security definer
as $$
  select *
  from public.flood_events
  where
    is_active   = true
    and expires_at  > now()
    and lat between p_south and p_north
    and lng between p_west  and p_east
  order by severity desc, last_confirmed_at desc;
$$;

comment on function public.get_floods_in_bbox is
  'Return active flood events inside a route bounding box. Called by /api/route-check.';


-- ─────────────────────────────────────────
-- 5.7  get_affected_routes()
-- After inserting a new flood event, find which saved routes overlap it.
-- Used by n8n to decide who to notify.
-- ─────────────────────────────────────────
create or replace function public.get_affected_routes(p_flood_id uuid)
returns table (
  route_id       uuid,
  user_id        uuid,
  anonymous_id   text,
  route_name     text,
  notify_enabled boolean
)
language sql
stable
security definer
as $$
  select
    sr.id,
    sr.user_id,
    sr.anonymous_id,
    sr.name,
    sr.notify_enabled
  from public.saved_routes sr
  join public.flood_events  fe on fe.id = p_flood_id
  where
    sr.notify_enabled = true
    and fe.lat between sr.bbox_south and sr.bbox_north
    and fe.lng between sr.bbox_west  and sr.bbox_east;
$$;

comment on function public.get_affected_routes is
  'Find saved routes whose bounding box contains a new flood event. Used by n8n notification workflow.';


-- ─────────────────────────────────────────
-- 5.8  get_flood_analytics()
-- Analytics dashboard: top flooded streets + hourly distribution.
-- Used by F7 dashboard.
-- ─────────────────────────────────────────
create or replace function public.get_flood_analytics(p_days integer default 7)
returns table (
  street_name    text,
  district       text,
  flood_count    bigint,
  avg_depth_cm   numeric,
  last_flood_at  timestamptz
)
language sql
stable
security definer
as $$
  select
    street_name,
    district,
    count(*)                                          as flood_count,
    round(avg(depth_cm)::numeric, 1)                  as avg_depth_cm,
    max(first_detected_at)                            as last_flood_at
  from public.flood_events
  where
    is_simulated = false
    and first_detected_at >= now() - (p_days || ' days')::interval
  group by street_name, district
  order by flood_count desc, last_flood_at desc
  limit 10;
$$;

comment on function public.get_flood_analytics is
  'Top flooded streets for the analytics dashboard (F7). Default: last 7 days.';


-- ─────────────────────────────────────────
-- 5.9  clear_simulated_floods()
-- Resets demo data. Called by POST /api/internal/reset-simulated.
-- ─────────────────────────────────────────
create or replace function public.clear_simulated_floods()
returns integer
language plpgsql
security definer
as $$
declare
  rows_deleted integer;
begin
  delete from public.flood_events where is_simulated = true;
  get diagnostics rows_deleted = row_count;
  return rows_deleted;
end;
$$;

comment on function public.clear_simulated_floods is
  'Delete all simulated flood events. Called by /api/internal/reset-simulated.';


-- ┌──────────────────────────────────┐
-- │  6. Row Level Security (RLS)      │
-- └──────────────────────────────────┘

alter table public.users                enable row level security;
alter table public.flood_events         enable row level security;
alter table public.flood_sources        enable row level security;
alter table public.saved_routes         enable row level security;
alter table public.alert_history        enable row level security;
alter table public.pipeline_runs        enable row level security;
alter table public.vetc_traffic_signals enable row level security;
alter table public.weather_forecasts    enable row level security;
alter table public.user_reports         enable row level security;


-- flood_events: publicly readable; only service_role can write
create policy "flood_events_public_read"
  on public.flood_events for select using (true);

create policy "flood_events_service_insert"
  on public.flood_events for insert
  with check (auth.role() = 'service_role');

create policy "flood_events_service_update"
  on public.flood_events for update
  using (auth.role() = 'service_role');

create policy "flood_events_service_delete"
  on public.flood_events for delete
  using (auth.role() = 'service_role');


-- flood_sources: publicly readable; only service_role can write
create policy "flood_sources_public_read"
  on public.flood_sources for select using (true);

create policy "flood_sources_service_write"
  on public.flood_sources for insert
  with check (auth.role() = 'service_role');


-- users: read/update own profile only
create policy "users_select_own"
  on public.users for select
  using (auth.uid() = id);

create policy "users_insert_own"
  on public.users for insert
  with check (auth.uid() = id);

create policy "users_update_own"
  on public.users for update
  using (auth.uid() = id);


-- saved_routes: user owns their routes
-- Anonymous users identified by app.anonymous_id session variable
create policy "saved_routes_select_own"
  on public.saved_routes for select
  using (
    auth.uid() = user_id
    or anonymous_id = current_setting('app.anonymous_id', true)
  );

create policy "saved_routes_insert_own"
  on public.saved_routes for insert
  with check (
    auth.uid() = user_id
    or anonymous_id is not null
  );

create policy "saved_routes_update_own"
  on public.saved_routes for update
  using (
    auth.uid() = user_id
    or anonymous_id = current_setting('app.anonymous_id', true)
  );

create policy "saved_routes_delete_own"
  on public.saved_routes for delete
  using (
    auth.uid() = user_id
    or anonymous_id = current_setting('app.anonymous_id', true)
  );


-- alert_history: user reads own alerts; only mark as read (no delete)
create policy "alert_history_select_own"
  on public.alert_history for select
  using (
    auth.uid() = user_id
    or anonymous_id = current_setting('app.anonymous_id', true)
  );

create policy "alert_history_mark_read"
  on public.alert_history for update
  using (
    auth.uid() = user_id
    or anonymous_id = current_setting('app.anonymous_id', true)
  )
  with check (read_at is not null);  -- only allowed mutation: setting read_at

create policy "alert_history_service_insert"
  on public.alert_history for insert
  with check (auth.role() = 'service_role');


-- pipeline_runs: service_role only
create policy "pipeline_runs_service_only"
  on public.pipeline_runs for all
  using (auth.role() = 'service_role');


-- vetc_traffic_signals: publicly readable
create policy "vetc_public_read"
  on public.vetc_traffic_signals for select using (true);

create policy "vetc_service_write"
  on public.vetc_traffic_signals for insert
  with check (auth.role() = 'service_role');


-- weather_forecasts: publicly readable
create policy "weather_public_read"
  on public.weather_forecasts for select using (true);

create policy "weather_service_write"
  on public.weather_forecasts for insert
  with check (auth.role() = 'service_role');


-- user_reports: publicly readable; anyone (including anon) can insert
create policy "user_reports_public_read"
  on public.user_reports for select using (true);

create policy "user_reports_anyone_insert"
  on public.user_reports for insert
  with check (true);

create policy "user_reports_service_update"
  on public.user_reports for update
  using (auth.role() = 'service_role');
