import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../../_lib/supabase.js', async () => {
  const { makeSupabaseMock } = await import('../../__tests__/helpers/supabaseMock.js')
  const sb = makeSupabaseMock()
  ;(globalThis as Record<string, unknown>).__voiceSb = sb
  return { default: sb, toFloodEvent: vi.fn((row: Record<string, unknown>) => row) }
})

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

describe('POST /voice/generate - ElevenLabs configured', () => {
  let app: express.Application

  beforeAll(async () => {
    process.env.ELEVENLABS_API_KEY = 'test-api-key'
    process.env.ELEVENLABS_VOICE_FEMALE_ID = 'voice-female-id'
    process.env.ELEVENLABS_VOICE_MALE_ID = 'voice-male-id'
    vi.resetModules()
    const { default: createVoiceRoutes } = await import('../../_routes/voice.js')
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
    vi.unstubAllGlobals()
  })

  it('missing text -> 400', async () => {
    const res = await request(app).post('/generate').send({})
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('ElevenLabs returns non-OK -> 502', async () => {
    vi.stubGlobal('fetch', stubFetch(false))
    const res = await request(app).post('/generate').send({ text: 'test alert', variant: 'female_south' })
    expect(res.status).toBe(502)
  })

  it('ElevenLabs success -> 200, audio/mpeg, X-Cache: MISS', async () => {
    vi.stubGlobal('fetch', stubFetch(true))
    const res = await request(app).post('/generate').send({ text: 'test alert', variant: 'female_south' })
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/audio\/mpeg/)
    expect(res.headers['x-cache']).toBe('MISS')
  })

  it('default variant is female_south when not specified', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(MOCK_AUDIO),
      text: () => Promise.resolve(''),
    })
    vi.stubGlobal('fetch', fetchSpy)

    const res = await request(app).post('/generate').send({ text: 'no variant' })

    expect(res.status).toBe(200)
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.elevenlabs.io/v1/text-to-speech/voice-female-id',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('male_north uses the male ElevenLabs voice id', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(MOCK_AUDIO),
      text: () => Promise.resolve(''),
    })
    vi.stubGlobal('fetch', fetchSpy)

    const res = await request(app).post('/generate').send({ text: 'male voice check', variant: 'male_north' })

    expect(res.status).toBe(200)
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.elevenlabs.io/v1/text-to-speech/voice-male-id',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})

describe('POST /voice/generate - no ELEVENLABS_API_KEY', () => {
  let app: express.Application

  beforeAll(async () => {
    delete process.env.ELEVENLABS_API_KEY
    process.env.ELEVENLABS_VOICE_FEMALE_ID = 'voice-female-id'
    vi.resetModules()
    const { default: createVoiceRoutes } = await import('../../_routes/voice.js')
    app = express()
    app.use(express.json())
    app.use('/', createVoiceRoutes())
  })

  afterAll(() => vi.resetModules())

  it('text provided but no API key -> 503', async () => {
    const res = await request(app).post('/generate').send({ text: 'test' })
    expect(res.status).toBe(503)
    expect(res.body.success).toBe(false)
  })
})

describe('POST /voice/generate - API key set but no voice IDs', () => {
  let app: express.Application

  beforeAll(async () => {
    process.env.ELEVENLABS_API_KEY = 'test-key'
    delete process.env.ELEVENLABS_VOICE_FEMALE_ID
    delete process.env.ELEVENLABS_VOICE_MALE_ID
    vi.resetModules()
    const { default: createVoiceRoutes } = await import('../../_routes/voice.js')
    app = express()
    app.use(express.json())
    app.use('/', createVoiceRoutes())
  })

  afterAll(() => {
    delete process.env.ELEVENLABS_API_KEY
    vi.resetModules()
  })

  it('API key present but no voice IDs -> 503', async () => {
    const res = await request(app).post('/generate').send({ text: 'test' })
    expect(res.status).toBe(503)
  })
})
