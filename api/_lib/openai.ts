import OpenAI from 'openai'
import type { ExaArticle } from './exa.js'

// ── Types ────────────────────────────────────────────────────────────────
export interface ExtractedFlood {
  street_name: string
  district: string
  depth_cm: number | null
  severity: 'heavy' | 'moderate' | 'light'
  confidence: 'high' | 'medium' | 'low'
  source_url: string
  source_title: string
  source_snippet: string
  published_at: string
}

// ── GPT-4o system prompt (from PRD F2) ───────────────────────────────────
const SYSTEM_PROMPT = `Bạn là hệ thống extract thông tin ngập đường tại HCMC.
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
      "confidence": "high/medium/low",
      "reason": "lý do xác định mức confidence"
    }
  ]
}

Nếu không có thông tin ngập cụ thể, trả về: {"found": false, "floods": []}
Ưu tiên: thông tin phải có tên đường/địa điểm cụ thể. Bỏ qua thông tin chung chung.`

// ── Known HCMC districts for rule-based fallback ──────────────────────────
const DISTRICTS = [
  'Bình Thạnh', 'Gò Vấp', 'Tân Phú', 'Phú Nhuận', 'Bình Tân',
  'Tân Bình', 'Quận 7', 'Quận 10', 'Quận 12', 'Thủ Đức',
  'Quận 1', 'Quận 2', 'Quận 3', 'Quận 4', 'Quận 5',
  'Quận 6', 'Quận 8', 'Quận 9', 'Quận 11',
  'Bình Chánh', 'Nhà Bè', 'Hóc Môn', 'Củ Chi', 'Cần Giờ',
]

const FLOOD_KEYWORDS = ['ngập', 'flood', 'nước dâng', 'ngập nước', 'ngập lụt', 'chết máy', 'kẹt nước']

function ruleBasedExtract(article: ExaArticle): ExtractedFlood[] {
  const text = `${article.title} ${article.text}`.toLowerCase()

  // Must contain a flood keyword
  if (!FLOOD_KEYWORDS.some((kw) => text.includes(kw.toLowerCase()))) return []

  // Find district mentions
  const foundDistricts = DISTRICTS.filter((d) => text.includes(d.toLowerCase()))
  if (foundDistricts.length === 0) return []

  // Try to find depth
  const depthMatch = text.match(/(\d+)\s*cm/)
  const depth = depthMatch ? parseInt(depthMatch[1], 10) : null

  // Infer severity
  let severity: 'heavy' | 'moderate' | 'light' = 'moderate'
  if (depth != null) {
    severity = depth > 30 ? 'heavy' : depth >= 15 ? 'moderate' : 'light'
  } else if (/nặng|nghiêm trọng|chết máy|heavy/i.test(text)) {
    severity = 'heavy'
  } else if (/nhẹ|light/i.test(text)) {
    severity = 'light'
  }

  // Best-effort street extraction — grab words before/after 'đường' or 'phố'
  const streetMatch = text.match(/đường\s+([^\s,.\n]+(?:\s+[^\s,.\n]+){0,3})/)
  const street_name = streetMatch
    ? streetMatch[1].replace(/\b\w/g, (c) => c.toUpperCase())
    : foundDistricts[0]

  return [{
    street_name,
    district: foundDistricts[0],
    depth_cm: depth,
    severity,
    confidence: 'low',   // rule-based is always low confidence
    source_url: article.url,
    source_title: article.title,
    source_snippet: article.text.slice(0, 300),
    published_at: article.publishedDate ?? new Date().toISOString(),
  }]
}

// ── GPT-4o extraction ─────────────────────────────────────────────────────
let _openai: OpenAI | null = null
function getOpenAI(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _openai
}

async function gptExtract(article: ExaArticle): Promise<ExtractedFlood[]> {
  const client = getOpenAI()
  if (!client) return ruleBasedExtract(article)

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Title: ${article.title}\n\n${article.text.slice(0, 2000)}` },
      ],
    })

    const raw = JSON.parse(completion.choices[0]?.message?.content ?? '{"found":false,"floods":[]}')
    if (!raw.found || !Array.isArray(raw.floods)) return []

    return raw.floods
      .filter((f: { street_name?: string; district?: string }) => f.street_name && f.district)
      .map((f: { street_name: string; district: string; depth_cm: number | null; severity: 'heavy' | 'moderate' | 'light'; confidence: 'high' | 'medium' | 'low' }) => ({
        street_name: f.street_name,
        district: f.district,
        depth_cm: f.depth_cm ?? null,
        severity: f.severity ?? 'moderate',
        confidence: f.confidence ?? 'medium',
        source_url: article.url,
        source_title: article.title,
        source_snippet: article.text.slice(0, 300),
        published_at: article.publishedDate ?? new Date().toISOString(),
      }))
  } catch (err) {
    console.warn('[openai] extraction failed, falling back to rule-based:', err)
    return ruleBasedExtract(article)
  }
}

// ── Public API ────────────────────────────────────────────────────────────
export async function extractFloodData(article: ExaArticle): Promise<ExtractedFlood[]> {
  return gptExtract(article)
}
