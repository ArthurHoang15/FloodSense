import express, { type Request, type Response } from 'express'
import supabase from '../_lib/supabase.js'

const VOICE_IDS: Record<string, string> = {
  female_south: process.env.ELEVENLABS_VOICE_FEMALE_ID ?? '',
  male_north: process.env.ELEVENLABS_VOICE_MALE_ID ?? '',
}

export default function createVoiceRoutes(): express.Router {
  const router = express.Router()

  // ── POST /api/voice/generate ──────────────────────────────────────────────
  router.post('/generate', async (req: Request, res: Response) => {
    const { text, variant = 'female_south' } = req.body as { text?: string; variant?: string }

    if (!text) {
      res.status(400).json({ success: false, error: 'text required' })
      return
    }

    const apiKey = process.env.ELEVENLABS_API_KEY
    if (!apiKey) {
      res.status(503).json({ success: false, error: 'ElevenLabs not configured' })
      return
    }

    const voiceId = VOICE_IDS[variant] ?? VOICE_IDS['female_south']
    if (!voiceId) {
      res.status(503).json({ success: false, error: 'Voice ID not configured' })
      return
    }

    try {
      // Check cache: look for a matching alert_history row with audio_url
      const { data: cached } = await supabase
        .from('alert_history')
        .select('audio_url')
        .eq('message', text)
        .not('audio_url', 'is', null)
        .limit(1)
        .single()

      if (cached?.audio_url) {
        // Proxy the cached audio URL
        const audioRes = await fetch(cached.audio_url as string)
        if (audioRes.ok) {
          res.setHeader('Content-Type', 'audio/mpeg')
          res.setHeader('X-Cache', 'HIT')
          const buffer = await audioRes.arrayBuffer()
          res.send(Buffer.from(buffer))
          return
        }
      }
    } catch {
      // cache miss — continue to ElevenLabs
    }

    try {
      const elevenRes = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: { stability: 0.5, similarity_boost: 0.75 },
          }),
        },
      )

      if (!elevenRes.ok) {
        const errText = await elevenRes.text()
        console.error('[voice] ElevenLabs error:', errText)
        res.status(502).json({ success: false, error: 'ElevenLabs request failed' })
        return
      }

      const buffer = await elevenRes.arrayBuffer()
      res.setHeader('Content-Type', 'audio/mpeg')
      res.setHeader('X-Cache', 'MISS')
      res.send(Buffer.from(buffer))
    } catch (err) {
      console.error('[voice] error:', err)
      res.status(500).json({ success: false, error: 'Voice generation failed' })
    }
  })

  return router
}
