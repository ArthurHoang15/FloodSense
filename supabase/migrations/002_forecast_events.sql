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
