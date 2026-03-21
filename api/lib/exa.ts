import Exa from 'exa-js'

let _exa: Exa | null = null
function getExa(): Exa {
  if (!_exa) _exa = new Exa(process.env.EXA_API_KEY!)
  return _exa
}

// ── 5 query templates from PRD F2 ─────────────────────────────────────────
const QUERIES = [
  'ngập đường HCMC hôm nay site:vnexpress.net OR site:tuoitre.vn',
  '"ngập nước" "quận" "TP.HCM"',
  '"kẹt xe" "ngập" "Hồ Chí Minh"',
  'flooded road Ho Chi Minh City',
  'ngập đường Bình Thạnh OR Gò Vấp OR Tân Bình hôm nay',
]

export interface ExaArticle {
  url: string
  title: string
  text: string
  publishedDate: string | null
}

export async function searchFloodNews(hoursAgo = 3): Promise<ExaArticle[]> {
  if (!process.env.EXA_API_KEY) {
    console.warn('[exa] EXA_API_KEY not set — skipping search')
    return []
  }

  const exa = getExa()
  const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString()

  const results = await Promise.allSettled(
    QUERIES.map((q) =>
      exa.searchAndContents(q, {
        type: 'neural',
        numResults: 10,
        contents: { text: { maxCharacters: 1500 } },
        startPublishedDate: since,
        excludeDomains: ['youtube.com', 'tiktok.com', 'facebook.com'],
      }),
    ),
  )

  // Merge and deduplicate by URL
  const seen = new Set<string>()
  const articles: ExaArticle[] = []

  for (const r of results) {
    if (r.status === 'rejected') {
      console.warn('[exa] query failed:', r.reason)
      continue
    }
    for (const item of r.value.results ?? []) {
      if (!item.url || seen.has(item.url)) continue
      seen.add(item.url)
      articles.push({
        url: item.url,
        title: item.title ?? '',
        text: (item as unknown as { text?: string }).text ?? '',
        publishedDate: (item as unknown as { publishedDate?: string }).publishedDate ?? null,
      })
    }
  }

  return articles
}
