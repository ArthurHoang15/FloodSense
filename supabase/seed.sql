-- ============================================================
-- FloodSense HCM — Demo Seed Data
-- Run AFTER 001_initial_schema.sql
-- ============================================================
-- Includes:
--   • 15 realistic HCMC flood hotspots (active, various severities)
--   • flood_sources rows for the top 5 events
--   • 6 VETC mock traffic signal segments
--   • 6-hour weather forecast (heavy rain incoming)
--   • 30-day historical flood data for analytics (seeded, not active)
-- ============================================================


-- ┌──────────────────────────────────────────────────────────┐
-- │  A. Active Flood Events (demo — shown on map immediately) │
-- └──────────────────────────────────────────────────────────┘
-- Covers: Bình Thạnh, Gò Vấp, Tân Phú, Phú Nhuận, Bình Tân,
--         Quận 7, Quận 10, Quận 12, Thủ Đức

insert into public.flood_events (
  id, street_name, district, city,
  lat, lng,
  depth_cm, severity, confidence,
  source_count,
  first_detected_at, last_confirmed_at, expires_at,
  is_active, is_simulated
) values

-- ── HEAVY (đỏ) > 30 cm ────────────────────────────────────

(
  'a1000000-0000-0000-0000-000000000001',
  'Nguyễn Hữu Cảnh', 'Bình Thạnh', 'HCMC',
  10.7972, 106.7181, 55, 'heavy', 'high', 3,
  now() - interval '35 min', now() - interval '5 min',
  now() + interval '85 min', true, false
),
(
  'a1000000-0000-0000-0000-000000000002',
  'Đinh Bộ Lĩnh', 'Bình Thạnh', 'HCMC',
  10.8094, 106.7130, 48, 'heavy', 'high', 2,
  now() - interval '50 min', now() - interval '10 min',
  now() + interval '70 min', true, false
),
(
  'a1000000-0000-0000-0000-000000000003',
  'Quang Trung', 'Gò Vấp', 'HCMC',
  10.8380, 106.6680, 42, 'heavy', 'medium', 2,
  now() - interval '25 min', now() - interval '12 min',
  now() + interval '95 min', true, false
),
(
  'a1000000-0000-0000-0000-000000000004',
  'Tân Hương', 'Tân Phú', 'HCMC',
  10.7869, 106.6276, 38, 'heavy', 'medium', 2,
  now() - interval '60 min', now() - interval '20 min',
  now() + interval '60 min', true, false
),

-- ── MODERATE (cam) 15–30 cm ───────────────────────────────

(
  'a1000000-0000-0000-0000-000000000005',
  'Phan Văn Trị', 'Bình Thạnh', 'HCMC',
  10.8097, 106.7041, 27, 'moderate', 'high', 3,
  now() - interval '20 min', now() - interval '8 min',
  now() + interval '100 min', true, false
),
(
  'a1000000-0000-0000-0000-000000000006',
  'Hồ Văn Huê', 'Phú Nhuận', 'HCMC',
  10.8025, 106.6831, 22, 'moderate', 'medium', 1,
  now() - interval '40 min', now() - interval '15 min',
  now() + interval '80 min', true, false
),
(
  'a1000000-0000-0000-0000-000000000007',
  'Kinh Dương Vương', 'Bình Tân', 'HCMC',
  10.7561, 106.6082, 29, 'moderate', 'high', 2,
  now() - interval '45 min', now() - interval '18 min',
  now() + interval '75 min', true, false
),
(
  'a1000000-0000-0000-0000-000000000008',
  'Lê Văn Lương', 'Quận 7', 'HCMC',
  10.7368, 106.7024, 24, 'moderate', 'medium', 2,
  now() - interval '55 min', now() - interval '25 min',
  now() + interval '65 min', true, false
),
(
  'a1000000-0000-0000-0000-000000000009',
  'Nguyễn Văn Quá', 'Quận 12', 'HCMC',
  10.8680, 106.6700, 18, 'moderate', 'low', 1,
  now() - interval '15 min', now() - interval '15 min',
  now() + interval '105 min', true, false
),

-- ── LIGHT (vàng) < 15 cm ──────────────────────────────────

(
  'a1000000-0000-0000-0000-000000000010',
  'Lê Quang Định', 'Bình Thạnh', 'HCMC',
  10.8152, 106.7010, 12, 'light', 'medium', 1,
  now() - interval '55 min', now() - interval '30 min',
  now() + interval '65 min', true, false
),
(
  'a1000000-0000-0000-0000-000000000011',
  'Ba Tháng Hai', 'Quận 10', 'HCMC',
  10.7730, 106.6820, 10, 'light', 'low', 1,
  now() - interval '70 min', now() - interval '40 min',
  now() + interval '50 min', true, false
),
(
  'a1000000-0000-0000-0000-000000000012',
  'Trần Xuân Soạn', 'Quận 7', 'HCMC',
  10.7255, 106.7051, 9, 'light', 'medium', 1,
  now() - interval '65 min', now() - interval '35 min',
  now() + interval '55 min', true, false
),
(
  'a1000000-0000-0000-0000-000000000013',
  'Tô Ngọc Vân', 'Thủ Đức', 'HCMC',
  10.8452, 106.7290, 13, 'light', 'low', 1,
  now() - interval '80 min', now() - interval '45 min',
  now() + interval '40 min', true, false
),
(
  'a1000000-0000-0000-0000-000000000014',
  'Nguyễn Oanh', 'Gò Vấp', 'HCMC',
  10.8263, 106.6780, 9, 'light', 'medium', 1,
  now() - interval '90 min', now() - interval '50 min',
  now() + interval '30 min', true, false
),
(
  'a1000000-0000-0000-0000-000000000015',
  'Kha Vạn Cân', 'Thủ Đức', 'HCMC',
  10.8503, 106.7530, 11, 'light', 'low', 1,
  now() - interval '85 min', now() - interval '55 min',
  now() + interval '35 min', true, false
);


-- ┌──────────────────────────────────────────────────────────┐
-- │  B. Flood Sources (for top 5 highest-confidence events)   │
-- └──────────────────────────────────────────────────────────┘

-- Nguyễn Hữu Cảnh (event 001) — 3 sources → high confidence
insert into public.flood_sources (flood_event_id, url, title, snippet, published_at, source_type) values
(
  'a1000000-0000-0000-0000-000000000001',
  'https://tuoitre.vn/nguyen-huu-canh-ngap-nang-20260321.htm',
  'Đường Nguyễn Hữu Cảnh ngập nặng sau mưa chiều nay',
  'Tuyến đường Nguyễn Hữu Cảnh (quận Bình Thạnh) ngập sâu khoảng 50–60 cm, nhiều xe máy và ô tô chết máy giữa đường, giao thông ùn ứ kéo dài hơn 1 km.',
  now() - interval '30 min', 'news'
),
(
  'a1000000-0000-0000-0000-000000000001',
  'https://vnexpress.net/nguyen-huu-canh-ngap-20260321.htm',
  'TPHCM: Ngập nặng trên đường Nguyễn Hữu Cảnh',
  'Ghi nhận lúc 15h30, nước ngập trên đường Nguyễn Hữu Cảnh đoạn gần cầu Văn Thánh đến khoảng 50 cm. Một số xe tải nhỏ vẫn cố nhích qua nhưng nhiều xe máy phải dắt bộ.',
  now() - interval '28 min', 'news'
),
(
  'a1000000-0000-0000-0000-000000000001',
  'https://facebook.com/groups/nguoi-sai-gon/posts/123456',
  'Group Người Sài Gòn — báo ngập Nguyễn Hữu Cảnh',
  'Anh em chú ý đường Nguyễn Hữu Cảnh ngập cực nặng lúc này! Nước lên đến yên xe rồi, tránh sang Xô Viết Nghệ Tĩnh hoặc Đinh Tiên Hoàng đi.',
  now() - interval '22 min', 'social'
);

-- Đinh Bộ Lĩnh (event 002) — 2 sources
insert into public.flood_sources (flood_event_id, url, title, snippet, published_at, source_type) values
(
  'a1000000-0000-0000-0000-000000000002',
  'https://tuoitre.vn/dinh-bo-linh-ngap-20260321.htm',
  'Đinh Bộ Lĩnh ngập cục bộ, giao thông hỗn loạn',
  'Đường Đinh Bộ Lĩnh đoạn từ chợ Bà Chiểu đến Phan Văn Trị ngập khoảng 40–50 cm sau trận mưa lớn kéo dài 45 phút.',
  now() - interval '45 min', 'news'
),
(
  'a1000000-0000-0000-0000-000000000002',
  'https://vnexpress.net/dinh-bo-linh-ket-xe-20260321.htm',
  'Kẹt xe nghiêm trọng tại Đinh Bộ Lĩnh do ngập nước',
  'Lượng xe ùn ứ kéo dài từ ngã tư Đinh Bộ Lĩnh - Nơ Trang Long ra đến tận cầu Bình Lợi. Lực lượng CSGT đã có mặt phân luồng.',
  now() - interval '38 min', 'news'
);

-- Phan Văn Trị (event 005) — 3 sources → high confidence
insert into public.flood_sources (flood_event_id, url, title, snippet, published_at, source_type) values
(
  'a1000000-0000-0000-0000-000000000005',
  'https://tuoitre.vn/phan-van-tri-ngap-20260321.htm',
  'Phan Văn Trị - Bình Thạnh ngập sau mưa',
  'Đường Phan Văn Trị đoạn từ Đinh Tiên Hoàng về phía ngã tư Bình Triệu ngập khoảng 25–30 cm, nhiều phương tiện lưu thông khó khăn.',
  now() - interval '18 min', 'news'
),
(
  'a1000000-0000-0000-0000-000000000005',
  'https://zalo.me/g/nhombinhchanh123',
  'Zalo nhóm Bình Thạnh thông báo ngập Phan Văn Trị',
  'Cảnh báo: Phan Văn Trị ngập ~25cm, đoạn gần Vincom Gò Vấp. Nên đi đường Ung Văn Khiêm thay thế.',
  now() - interval '15 min', 'social'
),
(
  'a1000000-0000-0000-0000-000000000005',
  'https://imhen.gov.vn/canh-bao-ngap/binh-thanh-20260321',
  'IMHEN: Cảnh báo ngập cục bộ quận Bình Thạnh',
  'Cục khí tượng thủy văn thông báo nguy cơ ngập cục bộ tại các tuyến đường thấp trũng quận Bình Thạnh, mức ngập dự báo 20–35 cm.',
  now() - interval '60 min', 'government'
);

-- VETC signal for Nguyễn Hữu Cảnh → adds source to event 001
insert into public.flood_sources (flood_event_id, url, title, snippet, published_at, source_type) values
(
  'a1000000-0000-0000-0000-000000000001',
  'vetc://segment/VETC-BT-NHC-001',
  'VETC Signal: Nguyễn Hữu Cảnh traffic drop 70%',
  'Lưu lượng VETC đoạn Nguyễn Hữu Cảnh giảm 70% so với baseline giờ 15h–16h. Anomaly score: 1.0 → tín hiệu ngập mạnh.',
  now() - interval '25 min', 'vetc_mock'
);


-- ┌──────────────────────────────────────────────────────────┐
-- │  C. VETC Traffic Signals (mock segments)                  │
-- └──────────────────────────────────────────────────────────┘

insert into public.vetc_traffic_signals (
  segment_id, segment_name,
  lat, lng,
  current_volume, baseline_volume,
  drop_ratio, signal_type, anomaly_score,
  recorded_at
) values
-- Strongly flooded segments (potential_flood)
('VETC-BT-NHC-001', 'Nguyễn Hữu Cảnh (Bình Thạnh)',  10.7972, 106.7181, 120, 400, 0.70, 'potential_flood', 1.00, now()),
('VETC-TP-TH-001',  'Tân Hương (Tân Phú)',             10.7869, 106.6276, 100, 400, 0.75, 'potential_flood', 1.00, now()),
('VETC-BT-DBL-001', 'Đinh Bộ Lĩnh (Bình Thạnh)',       10.8094, 106.7130, 180, 400, 0.55, 'potential_flood', 0.75, now()),
('VETC-BT-XVN-001', 'Xô Viết Nghệ Tĩnh (Bình Thạnh)', 10.8050, 106.7100, 196, 400, 0.51, 'potential_flood', 0.68, now()),
('VETC-GV-QT-001',  'Quang Trung (Gò Vấp)',            10.8380, 106.6680, 220, 400, 0.45, 'potential_flood', 0.58, now()),
-- Normal segments (baseline reference)
('VETC-Q1-NTH-001', 'Nguyễn Thị Minh Khai (Q.1)',      10.7800, 106.6960, 380, 400, 0.05, 'normal',          0.00, now()),
('VETC-Q3-CMT8-001','Cách Mạng Tháng 8 (Q.3)',          10.7765, 106.6850, 360, 400, 0.10, 'normal',          0.00, now()),
('VETC-Q1-NHT-001', 'Nguyễn Huệ (Q.1)',                 10.7736, 106.7030, 395, 400, 0.01, 'normal',          0.00, now()),
('VETC-Q5-HVT-001', 'Hùng Vương (Q.5)',                 10.7522, 106.6741, 370, 400, 0.07, 'normal',          0.00, now());


-- ┌──────────────────────────────────────────────────────────┐
-- │  D. Weather Forecast — Heavy rain incoming               │
-- └──────────────────────────────────────────────────────────┘
-- Simulates an Open-Meteo response for the next 6 hours

insert into public.weather_forecasts (forecast_at, rain_probability, rain_mm_per_hour, rain_intensity, temperature_c, source) values
(now() + interval  '1 hour', 0.82, 12.5, 'heavy',    28.4, 'open-meteo'),
(now() + interval  '2 hour', 0.90, 18.0, 'heavy',    27.1, 'open-meteo'),
(now() + interval  '3 hour', 0.85, 14.2, 'heavy',    27.5, 'open-meteo'),
(now() + interval  '4 hour', 0.60,  6.5, 'moderate', 28.0, 'open-meteo'),
(now() + interval  '5 hour', 0.35,  2.0, 'light',    29.2, 'open-meteo'),
(now() + interval  '6 hour', 0.20,  0.5, 'light',    30.0, 'open-meteo');


-- ┌──────────────────────────────────────────────────────────┐
-- │  E. 30-day Historical Flood Data (analytics seeding)     │
-- │     is_active = false, is_simulated = false              │
-- │     Used by F7 analytics dashboard + historical heatmap  │
-- └──────────────────────────────────────────────────────────┘
-- Known chronic flood points in HCMC — seeded as past events

insert into public.flood_events (
  street_name, district, city,
  lat, lng,
  depth_cm, severity, confidence,
  source_count,
  first_detected_at, last_confirmed_at, expires_at,
  is_active, is_simulated
)
select
  e.street_name, e.district, 'HCMC',
  e.lat, e.lng,
  e.depth_cm, e.severity::severity_level, 'medium'::confidence_level,
  2,
  (now() - (g.day_offset || ' days')::interval - (floor(random()*12) || ' hours')::interval),
  (now() - (g.day_offset || ' days')::interval - (floor(random()*6)  || ' hours')::interval),
  (now() - (g.day_offset || ' days')::interval + interval '2 hours'),
  false,  -- is_active
  false   -- is_simulated
from (
  values
  -- Chronic flood hotspots (each row = 1 distinct location)
  ('Nguyễn Hữu Cảnh',   'Bình Thạnh', 10.7972, 106.7181, 50, 'heavy'),
  ('Đinh Bộ Lĩnh',      'Bình Thạnh', 10.8094, 106.7130, 45, 'heavy'),
  ('Quang Trung',        'Gò Vấp',     10.8380, 106.6680, 40, 'heavy'),
  ('Tân Hương',          'Tân Phú',    10.7869, 106.6276, 38, 'heavy'),
  ('Kinh Dương Vương',   'Bình Tân',   10.7561, 106.6082, 30, 'moderate'),
  ('Phan Văn Trị',       'Bình Thạnh', 10.8097, 106.7041, 25, 'moderate'),
  ('Hồ Văn Huê',         'Phú Nhuận',  10.8025, 106.6831, 20, 'moderate'),
  ('Lê Văn Lương',       'Quận 7',     10.7368, 106.7024, 22, 'moderate'),
  ('Ba Tháng Hai',       'Quận 10',    10.7730, 106.6820, 15, 'moderate'),
  ('Nguyễn Văn Quá',     'Quận 12',    10.8680, 106.6700, 18, 'moderate'),
  ('Lê Quang Định',      'Bình Thạnh', 10.8152, 106.7010, 12, 'light'),
  ('Trần Xuân Soạn',     'Quận 7',     10.7255, 106.7051,  9, 'light'),
  ('Tô Ngọc Vân',        'Thủ Đức',    10.8452, 106.7290, 13, 'light'),
  ('Nguyễn Oanh',        'Gò Vấp',     10.8263, 106.6780,  9, 'light'),
  ('Kha Vạn Cân',        'Thủ Đức',    10.8503, 106.7530, 11, 'light'),
  ('Xô Viết Nghệ Tĩnh',  'Bình Thạnh', 10.8050, 106.7100, 35, 'heavy'),
  ('Ung Văn Khiêm',      'Bình Thạnh', 10.8160, 106.7060, 20, 'moderate'),
  ('Bạch Đằng',          'Tân Bình',   10.7950, 106.6570, 28, 'moderate'),
  ('Trường Chinh',       'Tân Bình',   10.7990, 106.6530, 22, 'moderate'),
  ('Lũy Bán Bích',       'Tân Phú',    10.7780, 106.6350, 18, 'moderate')
) as e(street_name, district, lat, lng, depth_cm, severity)
cross join (
  -- Generate ~3 rain events per location over 30 days
  select * from generate_series(2, 28, 8) as day_offset
) as g(day_offset);


-- ┌──────────────────────────────────────────────────────────┐
-- │  F. Preset simulation floods (for "Simulate Rain" demo)  │
-- │     is_simulated = true, is_active = false initially     │
-- │     Activated by POST /api/internal/simulate-rain        │
-- └──────────────────────────────────────────────────────────┘
-- These are NOT active on load — the simulate-rain endpoint sets is_active = true
-- and sets expires_at = now() + 30 min for demo effect

-- (No rows inserted here — they are injected dynamically from mocks/presets/heavy_rain_hcmc.json
--  by the existing /api/internal/simulate-rain endpoint.
--  When migrating to Supabase, that endpoint calls upsert_flood_event() with is_simulated=true.)
