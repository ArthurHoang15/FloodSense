const ANON_ID_KEY = 'floodsense_anon_id'

function getAnonId(): string {
  let id = localStorage.getItem(ANON_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(ANON_ID_KEY, id)
  }
  return id
}

function baseHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-anonymous-id': getAnonId(),
    ...extra,
  }
}

export async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: baseHeaders() })
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return (await res.json()) as T
}

export async function apiPost<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: baseHeaders(),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return (await res.json()) as T
}

export async function apiPostInternal<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: baseHeaders({ 'x-internal-secret': import.meta.env.VITE_INTERNAL_SECRET ?? '' }),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return (await res.json()) as T
}

export async function apiPatch<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: baseHeaders(),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return (await res.json()) as T
}

export async function apiDelete<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    method: 'DELETE',
    headers: baseHeaders(),
  })
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return (await res.json()) as T
}
