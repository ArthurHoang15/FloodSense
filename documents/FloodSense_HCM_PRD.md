# FloodSense HCM — Product Requirements Document
> **Version:** 1.0 — LotusHack 2026  
> **Track:** Social & Mobility (Tasco)  
> **Team size:** 2 người  
> **Thời gian build:** 36 giờ  
> **Cập nhật lần cuối:** 21/03/2026

---

## Mục lục

1. [Tổng quan sản phẩm](#1-tổng-quan-sản-phẩm)
2. [Vấn đề & Cơ hội](#2-vấn-đề--cơ-hội)
3. [Mục tiêu & Thành công](#3-mục-tiêu--thành-công)
4. [Người dùng mục tiêu](#4-người-dùng-mục-tiêu)
5. [Tính năng sản phẩm](#5-tính-năng-sản-phẩm)
6. [Kiến trúc hệ thống](#6-kiến-trúc-hệ-thống)
7. [Tech Stack & Sponsor APIs](#7-tech-stack--sponsor-apis)
8. [Data Schema](#8-data-schema)
9. [API Endpoints](#9-api-endpoints)
10. [Lộ trình 36 giờ](#10-lộ-trình-36-giờ)
11. [Demo Strategy](#11-demo-strategy)
12. [Prize Strategy](#12-prize-strategy)
13. [Rủi ro & Mitigation](#13-rủi-ro--mitigation)
14. [Business Case & Post-Hackathon](#14-business-case--post-hackathon)

---

## 1. Tổng quan sản phẩm

**FloodSense HCM** là nền tảng bản đồ ngập thông minh realtime dành riêng cho HCMC, sử dụng AI để thu thập, xác minh và cảnh báo thông tin ngập đường từ mạng xã hội, báo điện tử, weather APIs realtime và các tín hiệu mobility/camera/crowdsource. Phiên bản hiện tại vẫn giữ **tín hiệu VETC mô phỏng (mock)** để minh hoạ do chưa có quyền truy cập dữ liệu Tasco/VETC thật.

### Tagline
> *"Google Maps dẫn bạn vào đường ngập. FloodSense thì không."*

### Pitch 1 câu cho giám khảo
> *"8.9 triệu xe máy HCMC không có cách nào biết đường nào đang ngập trước khi lao vào — FloodSense giải quyết điều đó bằng AI scraping realtime và voice alert hands-free."*

### Pitch angle cho Tasco
> *"4 triệu thẻ VETC đang di chuyển trên đường mỗi ngày. Khi lưu lượng một đoạn đột ngột giảm mạnh — đó là flood signal sớm nhất, trước cả báo chí. FloodSense biến hạ tầng Tasco thành mạng lưới cảm biến ngập toàn quốc."*

---

## 2. Vấn đề & Cơ hội

### Pain Point chính

| Vấn đề | Quy mô |
|--------|--------|
| HCMC có 15–30 điểm ngập mỗi trận mưa lớn | Trung bình 3–4 trận/tuần mùa mưa |
| Người dùng chỉ biết đường ngập khi đã lao vào | 8.9 triệu xe máy bị ảnh hưởng |
| Google Maps / Waze không có data ngập hyperlocal | Không app nào giải quyết |
| Thông tin ngập trên mạng xã hội không được tổng hợp | Nằm rải rác, không có structured data |
| Mùa mưa kéo dài 6 tháng/năm (tháng 5–11) | 180 ngày/năm có nguy cơ ngập |

### Tại sao bây giờ

- Metro tuyến 1 HCMC vừa khai trương — người dân đang thay đổi hành vi di chuyển
- Tasco/VETC đang cần tăng DAU cho ecosystem
- Exa.ai neural search lần đầu tiên cho phép scrape semantic từ UGC một cách có ý nghĩa
- ElevenLabs voice API đủ trưởng thành để làm hands-free UX cho xe máy

### Khoảng trống cạnh tranh

```
Google Maps      → Biết đường ngắn nhất, KHÔNG biết đường ngập
Waze             → Crowdsource tốt, KHÔNG phổ biến ở VN, không có tiếng Việt
App Metro HCMC   → Chỉ lịch tàu, không có last-mile flood info
Báo điện tử      → Có tin ngập nhưng không structured, không map
```

---

## 3. Mục tiêu & Thành công

### Mục tiêu hackathon (36 giờ)

- [ ] Deploy được app hoạt động tại URL public
- [ ] Bản đồ ngập HCMC cập nhật từ Exa.ai pipeline thật
- [ ] Weather signal realtime: current + hourly + government alert feed hoạt động
- [ ] ElevenLabs voice alert tiếng Việt hoạt động
- [ ] n8n automation gửi push notification khi tuyến quen bị ngập
- [ ] Demo "Simulate Rain" button hoạt động mượt cho pitching
- [ ] Tín hiệu VETC mô phỏng (mock) có story rõ ràng (demo không tích hợp dữ liệu Tasco/VETC thật)

### Metrics thành công cho demo

| Metric | Target |
|--------|--------|
| Thời gian từ "mưa xuống" đến alert xuất hiện trên map | < 5 phút |
| Số điểm ngập trên demo map | ≥ 15 điểm |
| Latency voice alert | < 3 giây |
| Lighthouse Performance score | > 75 |
| Thời gian load ban đầu | < 3 giây |

---

## 4. Người dùng mục tiêu

### Primary User — "Minh, 28 tuổi, nhân viên văn phòng Q7"

- Đi xe máy từ Q7 → Tân Bình mỗi ngày
- Mùa mưa thường bị kẹt tại Nguyễn Hữu Cảnh, Đinh Bộ Lĩnh
- Dùng Google Maps nhưng hay bị dẫn vào đường ngập
- Muốn biết trước khi rời nhà, không phải khi đã kẹt giữa đường
- **Job-to-be-done:** "Tôi muốn đến công ty đúng giờ dù trời mưa"

### Secondary User — "Lan, 35 tuổi, phụ huynh Q.Bình Thạnh"

- Đón con tan học lúc 17h — giờ cao điểm + mùa mưa
- Lo lắng đường về ngập, muốn biết trước để đi sớm hơn
- Dùng smartphone thành thạo, đã quen dùng Zalo/Facebook
- **Job-to-be-done:** "Tôi muốn đón con an toàn mà không cần đoán mò"

### Institutional User (cho Tasco pitch) — Fleet Manager / Logistics

- Quản lý đội xe giao hàng 20–50 xe
- Cần route planning tránh ngập cho toàn đội
- Sẵn sàng trả tiền cho B2B API data
- **Job-to-be-done:** "Tôi cần đảm bảo đơn hàng được giao đúng giờ dù mưa"

---

## 5. Tính năng sản phẩm

### 5.1 Core Features (Bắt buộc hoàn thành trong 36h)

#### F1 — Live Flood Heatmap 🗺
**Mô tả:** Bản đồ HCMC với lớp overlay heatmap hiển thị các điểm ngập đang hoạt động.

**Behavior:**
- Điểm ngập được xếp loại theo màu: Đỏ = nặng (>30cm), Cam = vừa (15–30cm), Vàng = nhẹ (<15cm)
- Mỗi marker có popup: tên đường, quận, độ sâu ước tính, thời điểm cập nhật, nguồn tin, confidence score
- Flood zone tự động fade sau 2 giờ không được confirm thêm
- Mapbox GL JS với custom layer, không dùng default pins
- Auto-refresh: map cập nhật flood data mỗi 5 phút không cần reload trang

**Acceptance criteria:**
- [ ] Render được ít nhất 15 điểm ngập trên map
- [ ] Màu sắc hiển thị đúng theo severity
- [ ] Popup hiện đầy đủ thông tin khi click marker
- [ ] Map không lag trên mobile Chrome

---

#### F2 — Flood Intelligence Pipeline (Exa.ai + GPT-4o) 🔍
**Mô tả:** Pipeline tự động scrape và parse thông tin ngập từ internet.

**Behavior:**
- Exa.ai chạy 5 query templates mỗi 5 phút:
  1. `"ngập đường HCMC" site:vnexpress.net OR site:tuoitre.vn`
  2. `"ngập nước" "quận" "TP.HCM" -site:youtube.com`
  3. `"kẹt xe" "ngập" "Hồ Chí Minh"` (semantic search)
  4. `"flooded road Ho Chi Minh City"`
  5. Custom query theo quận đang có mưa (nếu có weather API)
- GPT-4o parse từng article → extract structured data
- Cross-check: cùng địa điểm được ≥2 nguồn độc lập confirm → High confidence
- Filter: chỉ lấy bài trong 3 giờ gần nhất, loại bỏ bài tái bản

**GPT-4o System Prompt:**
```
Bạn là hệ thống extract thông tin ngập đường tại HCMC.
Từ đoạn văn bản được cung cấp, hãy extract thông tin ngập đường nếu có.

Trả về JSON theo format sau (KHÔNG có markdown, KHÔNG có giải thích):
{
  "found": true/false,
  "floods": [
    {
      "street_name": "tên đường cụ thể",
      "district": "tên quận/huyện",
      "depth_cm": số (ước tính nếu không nêu rõ, null nếu không biết),
      "severity": "heavy/moderate/light",
      "time_mentioned": "giờ đề cập nếu có, null nếu không",
      "confidence": "high/medium/low",
      "reason": "lý do xác định mức confidence"
    }
  ]
}

Nếu không có thông tin ngập cụ thể, trả về: {"found": false, "floods": []}
Ưu tiên: thông tin phải có tên đường/địa điểm cụ thể. Bỏ qua thông tin chung chung.
```

**Acceptance criteria:**
- [ ] Pipeline chạy tự động mỗi 5 phút qua n8n
- [ ] Ít nhất 3/5 query templates trả về kết quả có ý nghĩa
- [ ] GPT-4o parse được ≥70% bài báo tiếng Việt chính xác
- [ ] Không có false positive rõ ràng (tin từ năm ngoái, tin không phải HCMC)

---

#### F3 — Voice Alert tiếng Việt (ElevenLabs) 🔊
**Mô tả:** Hệ thống phát cảnh báo bằng giọng nói tự nhiên tiếng Việt.

**Behavior:**
- Khi user đang xem route và phát hiện flood zone mới trên tuyến → autoplay audio
- Template voice alert:
  - `"Cảnh báo — phát hiện ngập mới tại {tên đường}, {quận}. Độ sâu ước tính {X} cm. {Gợi ý đường thay thế nếu có}."`
  - `"Tuyến đường của bạn đang đi qua {số} điểm ngập. Khuyến nghị {action}."`
- User có thể chọn: giọng Nữ Miền Nam (default) / Nam Miền Bắc
- Toggle on/off voice alerts
- Replay button cho alert vừa phát
- Không autoplay nếu user đang tab inactive

**ElevenLabs API config:**
```javascript
const VOICE_CONFIG = {
  female_south: "voice_id_female_vn",   // giọng nữ miền Nam
  male_north:   "voice_id_male_vn",     // giọng nam miền Bắc
  model: "eleven_multilingual_v2",
  stability: 0.75,
  similarity_boost: 0.8,
  style: 0.3,
  use_speaker_boost: true
}
```

**Acceptance criteria:**
- [ ] Audio phát trong < 3 giây sau khi flood mới được detect
- [ ] Giọng đọc tự nhiên, không bị ngắt quãng
- [ ] Toggle on/off hoạt động đúng
- [ ] Không crash nếu ElevenLabs API bị rate limit (fallback: browser TTS)

---

#### F4 — Route Flood Check 🛣
**Mô tả:** User nhập điểm đi/đến → hệ thống check xem route có đi qua flood zone không.

**Behavior:**
- Input: địa chỉ hoặc click trên map
- Mapbox Directions API tính route
- Overlay flood zones lên route, highlight đoạn ngập bằng màu đỏ
- Warning banner nếu route đi qua ≥1 flood zone
- Suggest: "Đi đường vòng tránh X điểm ngập, thêm ~Y phút"
- Không force re-route — chỉ warn và suggest, user tự quyết định

**Acceptance criteria:**
- [ ] Route vẽ được trên map với Mapbox Directions
- [ ] Flood intersection được tính đúng theo tọa độ
- [ ] Warning hiển thị rõ ràng khi route nguy hiểm
- [ ] Alternate route suggestion hiển thị khi có

---

#### F5 — Saved Routes + Proactive Alerts (n8n) 🔔
**Mô tả:** User lưu tuyến thường đi, hệ thống tự động alert khi tuyến bị ngập.

**Behavior:**
- User lưu tối đa 3 tuyến (nhà → văn phòng, trường học, v.v.)
- n8n cron job chạy mỗi 5 phút: check flood zones mới vs saved routes
- Nếu overlap → push web notification ngay lập tức
- Notification content: "⚠️ Tuyến [Tên] của bạn có ngập mới tại [đường]. Xem chi tiết →"
- Gợi ý thêm: "Xuất phát sớm hơn 15–20 phút hoặc đi đường vòng"
- Alert history: xem lại 10 alert gần nhất

**n8n Workflow:**
```
[Cron: mỗi 5 phút]
  → GET /api/floods?updated_since=5min
  → Nếu có flood mới:
      → Loop qua tất cả saved routes
      → Check intersection (bounding box + polygon)
      → Nếu overlap → POST /api/notify/{user_id}
      → Ghi log vào DB
```

**Acceptance criteria:**
- [ ] Lưu/xóa tuyến được
- [ ] n8n workflow chạy ổn định không bị timeout
- [ ] Web push notification hiển thị trên mobile Chrome
- [ ] Alert đến trong < 6 phút sau khi flood được detect

---

### 5.2 Enhanced Features (Nếu còn thời gian — giờ 18–26)

#### F6 — Simulate Rain Demo Mode 🌧
**Quan trọng cho pitching — KHÔNG phải nice-to-have**

**Behavior:**
- Nút "Mô phỏng trận mưa lớn" trên UI (chỉ visible trong demo mode)
- Khi click: inject 15–20 flood points preset vào HCMC map trong vòng 30 giây
- Trigger voice alert tự động
- Trigger n8n notification cho demo account
- Animation: flood points appear dần dần (không phải tất cả cùng lúc)
- Reset button: xóa toàn bộ simulated data

**Mục đích:** Demo pitch không phụ thuộc vào việc trời có mưa thật hay không.

---

#### F7 — Flood Analytics Dashboard 📊

**Behavior:**
- Top 5 điểm đen tuần này (most flooded streets)
- Biểu đồ: số điểm ngập theo giờ trong ngày (peak hours)
- Flood history timeline: mỗi trận mưa là 1 event với số điểm ngập
- Heatmap tích lũy: điểm nào hay ngập nhất trong 30 ngày qua
- Counter realtime: "Hôm nay đã phát hiện X điểm ngập, tiết kiệm ~Y phút cho Z người dùng"

---

#### F8 — Crowdsource Report 📍

**Behavior:**
- Nút "Báo ngập tại đây" trên map
- User click → chọn severity → optional note → submit
- Submitted report: confidence = "user-reported", cần 2+ confirms để lên High
- Gamification nhẹ: badge "Người báo ngập tích cực" sau 10 reports

**MVP implementation plan:**
- Phase 1: `POST /api/report-flood` nhận `locationText | lat/lng`, `severity`, `note`
- Phase 1: nếu chưa có Supabase local, route vẫn hoạt động bằng in-memory fallback để demo không bị block
- Phase 1: báo cáo mới phải được phản ánh vào intelligence surfaces và local flood feed ngay sau khi submit
- Phase 2: thêm upload ảnh + moderation + duplicate detection tốt hơn
- Phase 3: merge report với camera/radar/weather signals để tăng confidence tự động

**Acceptance criteria:**
- [ ] User gửi được báo cáo ngập từ UI intelligence/map
- [ ] API chấp nhận cả `locationText` lẫn `lat/lng`
- [ ] Local/dev mode không phụ thuộc Supabase vẫn submit được
- [ ] Báo cáo lặp gần cùng vị trí được tăng `confirm_count`

---

#### F9 — VETC Anomaly Signal (Mock) 🛤

**Behavior:**
- Demo/hackathon: không dùng dữ liệu Tasco/VETC thật.
- Dùng mock traffic-flow theo đoạn đường (segment) + baseline theo giờ.
- Nếu lưu lượng giảm >40% so với baseline → raise "potential flood signal".
- Combine với Exa/news/social/user report để tăng confidence score (tier cao nhất khi tín hiệu đủ mạnh).

---

#### F10 — Weather Pre-warning ⛈

**Behavior:**
- Tích hợp Open-Meteo API để lấy `current`, `hourly`, `wind gusts`, `rain intensity`
- Nếu có `OPENWEATHER_API_KEY`, ingest thêm government weather alerts qua OpenWeather One Call
- Nếu forecast >70% hoặc rain intensity/gust vượt ngưỡng → pre-warn user trước khi route-check
- Banner và intelligence copy phải được generate từ data thật, không hard-code danh sách điểm ngập
- Weather signal được lưu vào `weather_forecasts` để phục vụ analytics và risk scoring

**Signal tiers:**
1. `Forecast signal`: Open-Meteo current/hourly rain, gusts, weather code
2. `Official alert signal`: OpenWeather / CAP-compatible government alerts (nếu có key/feed)
3. `Ground truth signal`: flood events từ news/social/camera/user report/VETC partner data

**Acceptance criteria:**
- [ ] `/api/weather/forecast` trả về current weather + hourly forecast thật
- [ ] Hỗ trợ government alerts nếu có provider key
- [ ] Không còn hard-code alert copy kiểu giờ cố định / street cố định
- [ ] Frontend intelligence banner cập nhật từ payload realtime

---

#### F11 — Real-time Flood Signal Fusion 🛰

**Behavior:**
- Hệ thống không phụ thuộc một nguồn duy nhất; phải hợp nhất nhiều `signal` để quyết định flood confidence.
- Thứ tự ưu tiên nguồn thật sau hackathon:
  1. Weather APIs realtime (`Open-Meteo`, `Tomorrow.io`, `OpenWeather`)
  2. Radar / precipitation map overlays (`RainViewer` hoặc provider thương mại tương đương)
  3. Camera giao thông / RTSP snapshots để detect ngập bằng CV
  4. User reports, báo điện tử, social extraction
  5. Partner mobility data (Tasco/VETC) khi có quyền truy cập
- Mỗi signal được chấm điểm theo loại nguồn, độ mới và mức độ tương quan địa lý trước khi nâng confidence của `FloodEvent`.

**Post-hackathon implementation notes:**
- Camera không phải API weather; cần ingestion pipeline riêng: `RTSP/ONVIF -> frame capture -> CV inference -> flood signal`
- Radio/loa/phát thanh có thể dùng như nguồn phụ: `audio stream -> speech-to-text -> event extraction`
- Không dùng RainViewer cho production thương mại nếu chưa xác minh lại licensing.

**Execution plan:**
1. Weather + crawl layer
  - Open-Meteo/OpenWeather cho pre-warning
  - Exa/news/social crawl cho textual evidence
2. Crowd-report layer
  - User report từ web/app để tạo ground-truth cục bộ nhanh nhất
  - Duplicate detection trong bán kính 200m, cửa sổ 2 giờ
3. Camera pilot layer
  - Chọn 2–5 camera hotspot hợp pháp, snapshot 15–30 giây/lần
  - Rule-based / CV inference để sinh `camera_signal`
4. Radio/audio layer
  - Ingest audio bulletin, speech-to-text, extract location/severity
5. Signal fusion
  - Weather tăng risk
  - Crawl/news/social tăng evidence
  - Camera/user reports tăng confirmation

---

### 5.3 Không làm (Out of Scope cho 36h)

- Turn-by-turn navigation (Google Maps đã làm tốt hơn)
- Offline mode hoàn chỉnh
- Native mobile app (iOS/Android)
- User authentication phức tạp (chỉ cần anonymous ID hoặc email đơn giản)
- Payment integration
- Multi-city (chỉ HCMC cho hackathon)
- Backend admin dashboard

---

## 6. Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────────────┐
│                    DATA SOURCES (External)                   │
│ Facebook Groups │ VnExpress/Tuổi Trẻ │ Open-Meteo │ OpenWeather Alerts │ VETC (mock) │
└──────────┬──────────────┬─────────────────┬────────────────-┘
           │              │                 │
           ▼              ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│                INGESTION LAYER                               │
│ Exa.ai Neural Search │ Weather Providers │ Future Camera Ingest │
└─────────────────────┬───────────────────────────────────────┘
                      │  raw articles + snippets
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                AI PROCESSING LAYER                           │
│  GPT-4o Extract & Verify  →  Structured FloodEvent JSON     │
│  Signal Fusion / Scoring  →  Weather + Alerts + Flood Event │
└─────────────────────┬───────────────────────────────────────┘
                      │  { street, district, depth, confidence }
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                BACKEND (Next.js API Routes)                  │
│ /api/floods /api/weather/forecast /api/route-check /api/notify │
│  Supabase DB  ←──→  Redis Cache (5min TTL)                   │
└──────┬──────────────────────────────────────────────────────┘
       │  flood zones JSON + audio URLs
       ▼
┌─────────────────────────────────────────────────────────────┐
│                FRONTEND (Next.js + Mapbox GL)                │
│  Flood Heatmap │ Route Check │ Voice Alert │ Saved Routes    │
└──────┬──────────────────────────────────────────────────────┘
       │                              ▲
       ▼                              │
┌─────────────┐              ┌────────────────┐
│    USER     │              │  ElevenLabs    │
│  (mobile    │              │  TTS API       │
│   browser)  │              │  (voice alert) │
└─────────────┘              └────────────────┘

Background loop (mỗi 5 phút, không cần user):
n8n → Exa.ai + Weather APIs → GPT-4o / signal fusion → DB → Map update

On-demand (khi user request):
User input route → Check flood DB → ElevenLabs alert → Display
```

### Data Flow Chi Tiết

**Vòng 1 — Background Intelligence (tự động):**
1. n8n cron trigger mỗi 5 phút
2. Gọi Exa.ai với 5 query templates
3. Exa trả về list articles với snippets
4. Batch gửi lên GPT-4o để parse
5. GPT-4o trả về structured flood events
6. Deduplicate + merge với existing data trong DB
7. Update confidence scores
8. Expire flood events cũ hơn 2 giờ
9. Notify users có saved routes bị ảnh hưởng

**Vòng 2 — On-Demand (khi user tương tác):**
1. User nhập điểm A → B
2. Fetch route từ Mapbox Directions API
3. Query DB: flood zones trong bounding box của route
4. Calculate intersection: route polyline vs flood zone polygons
5. Generate warning text
6. Gọi ElevenLabs để generate audio (cache nếu text giống nhau)
7. Return: route + flood overlays + audio URL
8. Frontend render heatmap + play audio

---

## 7. Tech Stack & Sponsor APIs

### Frontend

| Technology | Version | Mục đích |
|------------|---------|----------|
| Next.js | 14.x (App Router) | Framework chính |
| React | 18.x | UI components |
| Mapbox GL JS | 3.x | Bản đồ + heatmap |
| Tailwind CSS | 3.x | Styling |
| Trae IDE | Latest | Development accelerator |

### Backend

| Technology | Version | Mục đích |
|------------|---------|----------|
| Next.js API Routes | 14.x | Backend endpoints |
| Supabase | Latest | PostgreSQL DB + realtime |
| Redis (Upstash) | Latest | Cache flood data 5min TTL |

### Sponsor APIs

#### Exa.ai — Hero API
```javascript
// Cách dùng trong FloodSense
const exa = new Exa(process.env.EXA_API_KEY);

const results = await exa.searchAndContents(
  'ngập đường HCMC hôm nay',
  {
    type: 'neural',           // semantic search, không phải keyword
    numResults: 10,
    contents: {
      text: { maxCharacters: 1000 }
    },
    startPublishedDate: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    excludeDomains: ['youtube.com', 'tiktok.com']
  }
);
```
**Lý do dùng:** Neural search hiểu "đường Nguyễn Hữu Cảnh bị ngập 50cm" và "kẹt cứng vì nước dâng tại Đinh Bộ Lĩnh" là cùng loại thông tin — keyword search thông thường không làm được.

---

#### ElevenLabs — Voice Alert
```javascript
// Generate flood alert audio
const response = await fetch(
  `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
  {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: alertText,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.75,
        similarity_boost: 0.8,
        style: 0.3,
        use_speaker_boost: true
      }
    })
  }
);
const audioBlob = await response.blob();
```

---

#### OpenAI GPT-4o — Intelligence Engine
```javascript
const completion = await openai.chat.completions.create({
  model: 'gpt-4o',
  temperature: 0.1,    // low temp cho extraction tasks
  response_format: { type: 'json_object' },
  messages: [
    { role: 'system', content: FLOOD_EXTRACTION_SYSTEM_PROMPT },
    { role: 'user', content: articleText }
  ]
});
```

---

#### n8n — Automation Backbone

**Workflow 1: Flood Data Refresh (chạy mỗi 5 phút)**
```
Cron Trigger (*/5 * * * *)
  → HTTP Request: POST /api/internal/run-pipeline
  → IF response.newFloods > 0:
      → HTTP Request: POST /api/internal/check-saved-routes
      → IF affectedUsers > 0:
          → Loop: Send push notification per user
  → Log result to Supabase
```

**Workflow 2: Morning Flood Briefing (7:00 sáng mỗi ngày)**
```
Cron Trigger (0 7 * * *)
  → GET /api/floods?hours=12
  → IF floods > 0:
      → Generate ElevenLabs summary audio
      → Push notification to all subscribed users
```

---

#### Tasco / VETC (Mock)
```javascript
// Demo/hackathon: không dùng dữ liệu Tasco/VETC thật.
// Lấy mock traffic flow từ file seed và chạy anomaly detection.

const traffic = await getMockTrafficFlow(segmentId);
// traffic: { current_volume, baseline_volume_by_hour }

const baseline = traffic.baseline_volume_by_hour[new Date().getHours()];
const dropRatio = baseline > 0 ? (baseline - traffic.current_volume) / baseline : 0;

const signal = dropRatio > 0.4 ? 'potential_flood' : 'normal';
const anomaly_score = Math.min(1, Math.max(0, (dropRatio - 0.1) / 0.6));
```

---

#### Open-Meteo + OpenWeather — Realtime Weather & Alerts
```javascript
// Current + hourly precipitation/gusts from Open-Meteo
const meteo = await fetch(
  `https://api.open-meteo.com/v1/forecast?latitude=10.7769&longitude=106.7009` +
  `&current=temperature_2m,rain,wind_speed_10m,wind_gusts_10m,weather_code` +
  `&hourly=precipitation_probability,rain,wind_gusts_10m&forecast_days=1&timezone=UTC`
).then((r) => r.json())

// Optional government alerts from OpenWeather One Call 3.0
const officialAlerts = process.env.OPENWEATHER_API_KEY
  ? await fetch(
      `https://api.openweathermap.org/data/3.0/onecall?lat=10.7769&lon=106.7009` +
      `&exclude=minutely,hourly,daily&units=metric&appid=${process.env.OPENWEATHER_API_KEY}`
    ).then((r) => r.json())
  : { alerts: [] }
```

**Lý do dùng:**
- Open-Meteo: nguồn nhẹ, nhanh, tốt cho pre-warning và realtime weather core
- OpenWeather: bổ sung government-issued alerts khi provider hỗ trợ
- Cả hai chỉ là `weather signal`, chưa phải `ground-truth flood confirmation`

---

#### Mapbox GL JS
```javascript
// Flood Heatmap Layer
map.addLayer({
  id: 'flood-heat',
  type: 'heatmap',
  source: 'flood-points',
  paint: {
    'heatmap-weight': ['interpolate', ['linear'], ['get', 'depth_cm'],
      0, 0,   15, 0.3,   30, 0.7,   60, 1.0
    ],
    'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'],
      0,   'rgba(0,0,255,0)',
      0.3, 'rgba(255,255,0,0.7)',
      0.6, 'rgba(255,165,0,0.8)',
      1.0, 'rgba(255,0,0,0.9)'
    ],
    'heatmap-radius': 40,
    'heatmap-opacity': 0.8
  }
});
```

---

## 8. Data Schema

### FloodEvent
```typescript
interface FloodEvent {
  id: string;                          // UUID
  street_name: string;                 // "Nguyễn Hữu Cảnh"
  district: string;                    // "Bình Thạnh"
  city: string;                        // "HCMC"
  coordinates: {
    lat: number;                       // 10.7769
    lng: number;                       // 106.7009
  };
  depth_cm: number | null;             // null nếu không xác định
  severity: 'heavy' | 'moderate' | 'light';
  confidence: 'high' | 'medium' | 'low';
  sources: FloodSource[];
  first_detected_at: Date;
  last_confirmed_at: Date;
  expires_at: Date;                    // first_detected + 2h
  is_active: boolean;
  is_simulated: boolean;               // true nếu demo mode
}

interface FloodSource {
  url: string;
  title: string;
  snippet: string;
  published_at: Date;
  source_type: 'news' | 'social' | 'government' | 'vetc_mock' | 'user_report';
}

interface WeatherSignal {
  id: string;
  provider: 'open-meteo' | 'openweather' | 'tomorrow-io';
  signal_type: 'forecast' | 'official_alert' | 'radar';
  area_label: string;
  probability: number | null;
  rain_mm: number | null;
  wind_gust_kmh: number | null;
  weather_code: number | null;
  starts_at: Date | null;
  ends_at: Date | null;
  severity: 'low' | 'medium' | 'high';
  raw_payload: unknown;
}
```

### SavedRoute
```typescript
interface SavedRoute {
  id: string;
  user_id: string;
  name: string;                        // "Nhà → Công ty"
  origin: { lat: number; lng: number; address: string };
  destination: { lat: number; lng: number; address: string };
  route_polyline: string;              // encoded polyline
  bounding_box: {
    north: number; south: number;
    east: number; west: number;
  };
  notify_enabled: boolean;
  created_at: Date;
}
```

### AlertHistory
```typescript
interface AlertHistory {
  id: string;
  user_id: string;
  route_id: string;
  flood_event_id: string;
  message: string;
  audio_url: string | null;
  sent_at: Date;
  read_at: Date | null;
}
```

---

## 9. API Endpoints

### Public Endpoints

```
GET  /api/floods
     Query: ?district=all&severity=all&limit=50
     Response: FloodEvent[]
     Cache: Redis 5 min

GET  /api/weather/forecast
  Response: { current, hourly, alert, governmentAlerts, source }

GET  /api/floods/:id
     Response: FloodEvent với full sources

POST /api/route-check
     Body: { origin, destination }
     Response: { route, floodZones, warnings, audioAlertUrl }

POST /api/report-flood
     Body: { lat, lng, severity, note }
     Response: { success, eventId }
```

### Internal Endpoints (chỉ n8n gọi)

```
POST /api/internal/run-pipeline
     Trigger: Exa.ai fetch → GPT-4o parse → DB update
     Auth: INTERNAL_SECRET header

POST /api/internal/check-saved-routes
     Trigger: Sau khi có flood mới, check và notify
     Auth: INTERNAL_SECRET header

POST /api/internal/simulate-rain
     Body: { preset: 'heavy_rain_hcmc' }
     Dev/demo only
```

---

## 10. Lộ trình 36 giờ

### Phân công vai trò

| | Dev A | Dev B |
|---|---|---|
| **Strength** | Frontend + Map | Backend + AI Pipeline |
| **Owner** | UI/UX, Mapbox, Audio player | Exa.ai, GPT-4o, n8n, DB |
| **Shared** | Supabase setup, Deploy, Pitch prep | |

---

### Giờ 0–3: Foundation — "Bản đồ phải có điểm đỏ"

**Nguyên tắc:** Không đụng vào AI pipeline cho đến khi map đã chạy được với mock data.

**Dev A:**
- [ ] `npx create-next-app floodsense --typescript --tailwind`
- [ ] Install Mapbox GL JS: `npm install mapbox-gl @types/mapbox-gl`
- [ ] Tạo component `<FloodMap />` với Mapbox base map HCMC
- [ ] Hardcode 15 điểm ngập thật HCMC vào `mock-floods.json`
- [ ] Render heatmap layer từ mock data
- [ ] Center map: HCMC (10.7769, 106.7009), zoom 12

**Dev B:**
- [ ] Setup Supabase project, tạo tables (FloodEvent, SavedRoute, AlertHistory)
- [ ] Chạy pipeline với mock Exa response (không phụ thuộc key)
- [ ] Evaluate quality: Exa có trả về kết quả đủ tốt không?
- [ ] Setup n8n cloud account (n8n.io free tier)
- [ ] Tạo `.env.local` với tất cả API keys

**⭐ Checkpoint giờ 3:** Mở `localhost:3000` thấy bản đồ HCMC với ≥10 điểm ngập màu sắc đúng.

---

### Giờ 3–10: AI Pipeline — "Dữ liệu thật vào bản đồ"

**Dev A:**
- [ ] Flood marker popup: click → xem chi tiết (tên đường, quận, severity, thời gian, nguồn)
- [ ] Flood zone polygon: vẽ circle radius 200m xung quanh điểm ngập
- [ ] Legend: chú giải màu sắc góc dưới phải
- [ ] Search bar: nhập địa chỉ → map pan đến (Mapbox Geocoding API)
- [ ] Auto-refresh: `setInterval` gọi `/api/floods` mỗi 5 phút, update markers

**Dev B:**
- [ ] `src/lib/exa.ts`: wrapper function `searchFloodNews(query, hoursAgo)`
- [ ] `src/lib/openai.ts`: function `extractFloodData(articleText)` với system prompt đầy đủ
- [ ] `src/lib/geocode.ts`: convert "tên đường + quận" → tọa độ (Mapbox Geocoding)
- [ ] `src/app/api/internal/run-pipeline/route.ts`: full pipeline endpoint
- [ ] Test pipeline end-to-end: chạy → xem output JSON
- [ ] Fix prompt nếu GPT-4o trả về sai format

**⭐ Checkpoint giờ 10:** Gọi `/api/internal/run-pipeline` → bản đồ cập nhật với dữ liệu từ internet (dù chỉ 2–3 điểm thật).

---

### Giờ 10–18: Voice + Alerts — "App biết nói chuyện"

**Dev A:**
- [ ] Route input UI: 2 input fields (điểm đi, điểm đến) + nút "Kiểm tra ngập"
- [ ] Mapbox Directions: vẽ route lên map
- [ ] Flood intersection: highlight đoạn route đi qua flood zone bằng màu đỏ/cam
- [ ] Warning banner: "⚠️ Route của bạn đi qua X điểm ngập"
- [ ] Audio player component: `<FloodAlert audioUrl={url} />` với autoplay + replay
- [ ] Voice toggle: switch on/off + chọn giọng

**Dev B:**
- [ ] `src/app/api/route-check/route.ts`: nhận route → trả về flood warnings + audio URL
- [ ] ElevenLabs integration: `generateFloodAlert(text, voiceId)` → base64 audio
- [ ] Cache audio: nếu cùng text đã generate → trả về cached URL (Supabase storage)
- [ ] n8n Workflow 1: Cron 5min → POST /api/internal/run-pipeline → check saved routes
- [ ] Saved route API: POST/GET/DELETE `/api/saved-routes`
- [ ] Web Push setup: VAPID keys, service worker cơ bản

**⭐ Checkpoint giờ 18:** 🎯 Core product hoàn chỉnh:
- Nhập Q7 → Tân Bình → thấy flood zones trên route
- Nghe voice alert tiếng Việt tự động
- Lưu tuyến thường đi → nhận notification khi ngập

---

### Giờ 18–26: Polish + Demo Features

**Dev A:**
- [ ] **Simulate Rain button** (QUAN TRỌNG): inject 20 flood points preset, animation 30s
- [ ] Mobile responsive: test trên Chrome DevTools iPhone 12
- [ ] Loading states: skeleton loaders cho map + spinner khi check route
- [ ] Error states: "Không tìm thấy thông tin ngập" / "Lỗi kết nối"
- [ ] PWA manifest + service worker cơ bản (installable trên Android)
- [ ] Analytics mini-dashboard: top 5 điểm đen, flood count hôm nay

**Dev B:**
- [ ] VETC anomaly signal (mock) có story rõ ràng
- [ ] Weather pre-warning: Open-Meteo current/hourly + optional OpenWeather alerts
- [ ] Crowdsource report: nút "Báo ngập tại đây" → form đơn giản
- [ ] Performance: Redis cache cho `/api/floods`, optimize Mapbox layer rendering
- [ ] Seed historical data: 30 ngày ngập điểm đen HCMC (mock nhưng realistic)

**⭐ Checkpoint giờ 26:** Demo mode chạy mượt. Nhấn "Simulate Rain" → map sáng lên, voice phát, notification đến trong < 30 giây.

---

### Giờ 26–34: Deploy + Pitch Prep

**Dev A + Dev B:**
- [ ] Deploy lên Vercel: `vercel --prod`
- [ ] Test trên domain thật (mobile + desktop)
- [ ] Performance audit: Lighthouse score > 75
- [ ] Fix critical bugs từ testing
- [ ] Preload demo account với data đẹp
- [ ] Quay video demo backup 90 giây (phòng mạng hackathon chậm)

**Pitch materials:**
- [ ] Slide deck 5 trang: Problem → Solution → Demo → Tasco synergy → Ask
- [ ] Impact numbers: 8.9M xe máy, 6 tháng mùa mưa, 15-30 điểm ngập/ngày
- [ ] Tasco pitch: "4M VETC tags = 4M flood sensors miễn phí"
- [ ] Post lên X/LinkedIn tag Tasco (requirement cho một số bounties)

---

### Giờ 34–36: Buffer + Final Check

- [ ] Demo walkthrough cuối: đảm bảo không có bug trong happy path
- [ ] Submit hackathon form
- [ ] Tập pitch: 2 phút demo live + 1 phút Q&A prep

---

## 11. Demo Strategy

### Happy Path cho pitch (2 phút)

```
1. [0:00] Mở app trên điện thoại — bản đồ HCMC hiện ra
2. [0:10] "Đây là bản đồ ngập realtime HCMC lúc này"
           → Show các điểm ngập đang active với màu sắc
3. [0:25] "Tôi lưu tuyến thường đi của mình — Q7 đến Tân Bình"
           → Nhập route → highlight đoạn ngập đỏ
           → Voice alert tự động phát tiếng Việt
4. [0:50] "Nhưng điều thú vị hơn — FloodSense chủ động cảnh báo trước"
           → Nhấn "Simulate Rain" button
           → 20 điểm ngập xuất hiện dần trong 30 giây
           → Phone notification pop up
           → Voice alert phát
5. [1:20] "Data từ đâu? Exa.ai scrape báo điện tử và mạng xã hội 
           mỗi 5 phút — không cần sensor vật lý"
6. [1:35] "Và đây là điều chúng tôi muốn làm cùng Tasco..."
           → Show Tasco anomaly signal concept
```

### Câu trả lời chuẩn bị sẵn cho Q&A

**Q: "Khác gì Google Maps?"**
> "Google Maps biết đường ngắn nhất. FloodSense biết đường nào đang ngập ngay lúc này — và chủ động báo bạn trước khi bạn ra khỏi nhà."

**Q: "Data có accurate không?"**
> "Chúng tôi dùng cross-validation: phải có ≥2 nguồn độc lập confirm mới là High confidence. Tin giả thường chỉ có 1 nguồn. Ngoài ra, flood event tự expire sau 2 giờ nếu không được confirm thêm."

**Q: "Scale như thế nào?"**
> "Architecture hiện tại handle được toàn bộ HCMC với chi phí ~$50/tháng. Mở rộng ra Hà Nội, Đà Nẵng chỉ cần thêm query templates cho từng thành phố — không cần thay đổi infrastructure."

**Q: "Tasco fit ở đâu?"**
> "VETC có 4 triệu thẻ đang di chuyển mỗi ngày. Khi lưu lượng một đoạn cao tốc giảm đột ngột 40% — đó là dấu hiệu ngập sớm nhất, trước cả báo chí. Chúng tôi muốn dùng anomaly detection từ data của Tasco như một signal tier cao nhất trong confidence scoring."

---

## 12. Prize Strategy

### Target Prizes

| Prize | Khả năng | Lý do |
|-------|----------|-------|
| Social & Mobility Track (Tasco) — $500K đầu tư | Cao | Giải quyết đúng KPI MAU→DAU của Tasco, pitch angle rõ ràng |
| Exa.ai Bounty — $500 credits | Rất cao | Exa là HERO feature, dùng neural search đúng mục đích nhất |
| ElevenLabs Bounty — 3 tháng Pro | Cao | Voice alert hands-free là use case độc đáo, không team nào nghĩ tới |
| Trae Bounty — $500 credits | Cao | Toàn bộ codebase build bằng Trae |
| Top 10 Finalist — 5–10M VND | Trung bình-cao | Sản phẩm có demo trực quan, pain point rõ ràng |
| FastTrack Accelerator | Trung bình | Nếu top 3, auto-qualify |

### Prize Stacking Note
FloodSense tích hợp tự nhiên cả 4 sponsor bounties (Exa, ElevenLabs, Trae, n8n) mà không cần "bolt-on" — mỗi API là một phần không thể thiếu của product. Đây là lợi thế lớn khi giám khảo sponsor evaluate.

---

## 13. Rủi ro & Mitigation

| Rủi ro | Xác suất | Impact | Mitigation |
|--------|----------|--------|------------|
| Exa.ai trả về ít/xấu data khi không mưa | Cao | Cao | **Simulate Rain button** + weather/radar signals để không phụ thuộc một nguồn |
| GPT-4o parse sai format JSON | Trung bình | Trung bình | Validation layer + retry với temperature=0, thêm few-shot examples vào prompt |
| ElevenLabs rate limit trong demo | Thấp | Cao | Pre-generate và cache audio cho 10 alert templates phổ biến nhất |
| Mapbox GL lag trên mobile cũ | Trung bình | Trung bình | Giảm số layers, lazy load markers, dùng cluster cho >50 points |
| Chưa có sandbox/quyền truy cập dữ liệu Tasco/VETC | Cao | Thấp | Mock data với story rõ ràng — pitch concept thay vì live integration |
| Weather provider không có government alerts cho VN | Trung bình | Trung bình | Treat official alerts as optional tier; vẫn dùng Open-Meteo + social/news/camera signals |
| Radar/provider free tier bị giới hạn license | Trung bình | Trung bình | Chỉ dùng cho demo/dev hoặc chuyển sang provider thương mại trước production |
| n8n workflow bị timeout | Thấp | Trung bình | Set timeout 30s, retry logic, fallback manual trigger |
| Supabase free tier quota | Thấp | Thấp | Rate limit API calls, aggressive caching với Redis |
| Không đủ thời gian làm PWA | Trung bình | Thấp | Demo trên mobile browser là đủ — PWA là nice-to-have |

---

## 14. Business Case & Post-Hackathon

### Market Size

- **TAM:** 8.9 triệu xe máy tại HCMC × 6 tháng mùa mưa × tần suất ngập
- **SAM:** ~2 triệu người commute hàng ngày bị ảnh hưởng bởi ngập
- **SOM năm 1:** 50,000 MAU tại HCMC (0.55% SAM)

### Revenue Model

**B2C — Freemium:**
- Free: bản đồ ngập cơ bản, 1 saved route
- Premium 29K VND/tháng: 3 saved routes + voice alerts + push notifications + timelapse

**B2B — Data API:**
- Báo điện tử embed widget: 2–5M VND/tháng
- Logistics (Grab, Lalamove, GHTK): flood data API per query
- Bảo hiểm xe: historical flood data per inquiry
- Ứng dụng giao đồ ăn (ShopeeFood, BeFood): rider route optimization

**Partnership với Tasco:**
- White-label FloodSense intelligence layer vào ecosystem VETC
- Revenue share từ premium features
- Joint data: VETC anomaly data → tăng accuracy → tăng giá trị cho cả hai

### 6-Month Roadmap (Post-Hackathon)

**Tháng 1–2:** Launch beta HCMC, onboard 5,000 users, validate retention, thêm weather/radar stack thật
**Tháng 3–4:** Thêm camera pilot 2–3 điểm nóng ngập và user report verification flow; tích hợp dữ liệu Tasco/VETC khi có sandbox/quyền truy cập
**Tháng 5–6:** Mở rộng Hà Nội, Đà Nẵng, ra mắt B2B risk API, đàm phán Series A với GenAI Fund

### Competitive Moat (sau 6 tháng)

Khi FloodSense có đủ historical data và user reports, sẽ có **data flywheel:**
```
Nhiều users → Nhiều reports → Data tốt hơn → Map accurate hơn → 
Nhiều users tin tưởng → Nhiều users → ...
```

Đây là moat mà Google Maps không thể copy nhanh vì cần local community trust.

---

## Appendix: Environment Variables

```bash
# .env.local

# Map
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1Ijo...

# AI & Search
OPENAI_API_KEY=sk-...
EXA_API_KEY=<YOUR_KEY>
OPENWEATHER_API_KEY=<OPTIONAL_FOR_GOV_ALERTS>
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_FEMALE_ID=...
ELEVENLABS_VOICE_MALE_ID=...

# Database
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...
SUPABASE_SERVICE_ROLE_KEY=eyJh...

# Cache
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# External

# Tasco
# Demo/hackathon: không dùng dữ liệu Tasco/VETC thật (mock data thay thế)

# Internal
INTERNAL_PIPELINE_SECRET=floodsense-secret-2026
NEXT_PUBLIC_APP_URL=https://floodsense.vercel.app

# Push Notifications
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
```

---

## Appendix: Mock Flood Data (Seed cho Demo)

```json
[
  { "street": "Nguyễn Hữu Cảnh", "district": "Bình Thạnh", "lat": 10.7889, "lng": 106.7211, "depth_cm": 45, "severity": "heavy" },
  { "street": "Đinh Bộ Lĩnh", "district": "Bình Thạnh", "lat": 10.8012, "lng": 106.7189, "depth_cm": 30, "severity": "moderate" },
  { "street": "Quang Trung", "district": "Gò Vấp", "lat": 10.8356, "lng": 106.6722, "depth_cm": 25, "severity": "moderate" },
  { "street": "Hồ Học Lãm", "district": "Bình Tân", "lat": 10.7512, "lng": 106.6089, "depth_cm": 50, "severity": "heavy" },
  { "street": "An Dương Vương", "district": "Quận 5", "lat": 10.7523, "lng": 106.6589, "depth_cm": 20, "severity": "light" },
  { "street": "Kinh Dương Vương", "district": "Bình Tân", "lat": 10.7445, "lng": 106.6234, "depth_cm": 35, "severity": "moderate" },
  { "street": "Phan Anh", "district": "Tân Phú", "lat": 10.7812, "lng": 106.6345, "depth_cm": 40, "severity": "heavy" },
  { "street": "Lê Văn Lương", "district": "Nhà Bè", "lat": 10.6934, "lng": 106.6978, "depth_cm": 15, "severity": "light" },
  { "street": "Nguyễn Văn Linh", "district": "Quận 7", "lat": 10.7234, "lng": 106.7123, "depth_cm": 20, "severity": "light" },
  { "street": "Lê Đức Thọ", "district": "Gò Vấp", "lat": 10.8234, "lng": 106.6678, "depth_cm": 30, "severity": "moderate" }
]
```

---

## Appendix: Mock Traffic Flow (Seed cho Demo)

```json
{
  "segments": [
    {
      "id": "HCM-SEG-001",
      "name": "Nguyễn Hữu Cảnh (Bình Thạnh)",
      "center": { "lat": 10.7889, "lng": 106.7211 },
      "current_volume": 120,
      "baseline_volume_by_hour": {
        "7": 520,
        "8": 610,
        "9": 430,
        "16": 680,
        "17": 820,
        "18": 700
      }
    }
  ]
}
```

---

*FloodSense HCM — LotusHack 2026 | Built with Exa.ai × ElevenLabs × OpenAI × Tasco × n8n × Trae*
