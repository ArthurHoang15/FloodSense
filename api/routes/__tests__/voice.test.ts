import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import type { SupabaseMock } from '../../__tests__/helpers/supabaseMock.js'

vi.mock('../../lib/supabase.js', async () => {
  const { makeSupabaseMock } = await import('../../__tests__/helpers/supabaseMock.js')
  const sb = makeSupabaseMock()
  ;(globalThis as Record<string, unknown>).__voiceSb = sb
  return { default: sb, toFloodEvent: vi.fn((row: Record<string, unknown>) => row) }
})

function getSb(): SupabaseMock {
  return (globalThis as Record<string, unknown>).__voiceSb as SupabaseMock
}

const MOCK_AUDIO = new Uint8Array([0xff, 0xfb, 0x90, 0x04]).buffer

function stubFetch(ok: boolean, body: BodyInit | null = null) {
  return vi.fn().mockResolvedValue({
    ok,
    arrayBuffer: () => Promise.resolve(MOCK_AUDIO),
    text: () => Promise.resolve('ElevenLabs error'),
    blob: () => Promise.resolve(new Blob([new Uint8Array(MOCK_AUDIO)])),
    ...(body !== null ? { body } : {}),
  })
}

// ── With API key + voice IDs configured ──────────────────────────────────
describe('POST /voice/generate — ElevenLabs configured', () => {
  let app: express.Application

  beforeAll(async () => {
    process.env.ELEVENLABS_API_KEY = 'test-api-key'
    process.env.ELEVENLABS_VOICE_FEMALE_ID = 'voice-female-id'
    process.env.ELEVENLABS_VOICE_MALE_ID = 'voice-male-id'
    vi.resetModules()
    const { default: createVoiceRoutes } = await import('../../routes/voice.js')
    app = express()
    app.use(express.json())
    app.use('/', createVoiceRoutes())
  })

  afterAll(() => {
    delete process.env.ELEVENLABS_API_KEY
    delete process.env.ELEVENLABS_VOICE_FEMALE_ID
    delete process.env.ELEVENLABS_VOICE_MALE_ID
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  beforeEach(() => {
    getSb().__resetAll()
    vi.unstubAllGlobals()
  })

  it('missing text → 400', async () => {
    const res = await request(app).post('/generate').send({})
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('ElevenLabs returns non-OK → 502', async () => {
    // no cache hit
    getSb().__setTableResult('alert_history', { data: null, error: null })
    vi.stubGlobal('fetch', stubFetch(false))
    const res = await request(app).post('/generate').send({ text: 'test alert', variant: 'female_south' })
    expect(res.status).toBe(502)
  })

  it('cache miss, ElevenLabs success → 200, audio/mpeg, X-Cache: MISS', async () => {
    // no cache hit from Supabase
    getSb().__setTableResult('alert_history', { data: null, error: null })
    vi.stubGlobal('fetch', stubFetch(true))
    const res = await request(app).post('/generate').send({ text: 'test alert', variant: 'female_south' })
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/audio\/mpeg/)
    expect(res.headers['x-cache']).toBe('MISS')
  })

  it('cache hit from alert_history → 200, X-Cache: HIT', async () => {
    // Supabase returns a cached audio_url
    getSb().__setTableResult('alert_history', {
      data: { audio_url: 'https://cache.example.com/audio.mp3' },
      error: null,
    })
    // fetch used for the cached audio URL
    vi.stubGlobal('fetch', stubFetch(true))
    const res = await request(app).post('/generate').send({ text: 'cached alert' })
    expect(res.status).toBe(200)
    expect(res.headers['x-cache']).toBe('HIT')
  })

  it('default variant is female_south when not specified', async () => {
    getSb().__setTableResult('alert_history', { data: null, error: null })
    vi.stubGlobal('fetch', stubFetch(true))
    const res = await request(app).post('/generate').send({ text: 'no variant' })
    expect(res.status).toBe(200)
  })
})

// ── No API key ────────────────────────────────────────────────────────────
describe('POST /voice/generate — no ELEVENLABS_API_KEY', () => {
  let app: express.Application

  beforeAll(async () => {
    delete process.env.ELEVENLABS_API_KEY
    process.env.ELEVENLABS_VOICE_FEMALE_ID = 'voice-female-id'
    vi.resetModules()
    const { default: createVoiceRoutes } = await import('../../routes/voice.js')
    app = express()
    app.use(express.json())
    app.use('/', createVoiceRoutes())
  })

  afterAll(() => vi.resetModules())

  it('text provided but no API key → 503', async () => {
    const res = await request(app).post('/generate').send({ text: 'test' })
    expect(res.status).toBe(503)
    expect(res.body.success).toBe(false)
  })
})

// ── No voice ID ───────────────────────────────────────────────────────────
describe('POST /voice/generate — API key set but no voice IDs', () => {
  let app: express.Application

  beforeAll(async () => {
    process.env.ELEVENLABS_API_KEY = 'test-key'
    delete process.env.ELEVENLABS_VOICE_FEMALE_ID
    delete process.env.ELEVENLABS_VOICE_MALE_ID
    vi.resetModules()
    const { default: createVoiceRoutes } = await import('../../routes/voice.js')
    app = express()
    app.use(express.json())
    app.use('/', createVoiceRoutes())
  })

  afterAll(() => {
    delete process.env.ELEVENLABS_API_KEY
    vi.resetModules()
  })

  it('API key present but no voice IDs → 503', async () => {
    const res = await request(app).post('/generate').send({ text: 'test' })
    expect(res.status).toBe(503)
  })
})
