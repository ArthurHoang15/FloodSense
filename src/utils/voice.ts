import type { VoiceVariant } from '@/stores/settingsStore'
import type { RouteCheckResponse } from '../../shared/types'

const ELEVENLABS_ENABLED = import.meta.env.VITE_ELEVENLABS_ENABLED === 'true'

function getVoices() {
  if (!('speechSynthesis' in window)) return [] as SpeechSynthesisVoice[]
  return window.speechSynthesis.getVoices()
}

async function ensureVoicesLoaded() {
  if (!('speechSynthesis' in window)) return [] as SpeechSynthesisVoice[]
  const existing = getVoices()
  if (existing.length > 0) return existing

  return await new Promise<SpeechSynthesisVoice[]>((resolve) => {
    const timeout = window.setTimeout(() => {
      window.speechSynthesis.onvoiceschanged = null
      resolve(getVoices())
    }, 1200)

    window.speechSynthesis.onvoiceschanged = () => {
      window.clearTimeout(timeout)
      window.speechSynthesis.onvoiceschanged = null
      resolve(getVoices())
    }
  })
}

function pickVoice(voices: SpeechSynthesisVoice[], variant: VoiceVariant): SpeechSynthesisVoice | null {
  const en = voices.filter((voice) => (voice.lang || '').toLowerCase().startsWith('en'))
  const pool = en.length > 0 ? en : voices

  if (variant === 'female_south') {
    const voice = pool.find((item) => /female|zira|aria|samantha|victoria/i.test(item.name))
    return voice ?? pool[0] ?? null
  }

  const voice = pool.find((item) => /male|david|mark|guy/i.test(item.name))
  return voice ?? pool[0] ?? null
}

async function browserSpeak(text: string, variant: VoiceVariant) {
  if (!('speechSynthesis' in window)) return false
  const voices = await ensureVoicesLoaded()
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'en-US'
  const voice = pickVoice(voices, variant)
  if (voice) utterance.voice = voice
  utterance.rate = 1
  utterance.pitch = variant === 'female_south' ? 1.05 : 0.95
  utterance.volume = 1
  window.speechSynthesis.speak(utterance)
  return true
}

async function elevenLabsSpeak(text: string, variant: VoiceVariant): Promise<boolean> {
  try {
    const res = await fetch('/api/voice/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, variant }),
    })
    if (!res.ok) return false
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    audio.onended = () => URL.revokeObjectURL(url)
    await audio.play()
    return true
  } catch {
    return false
  }
}

function hasForecastAlert(response: RouteCheckResponse) {
  const hasWarning = response.warnings.some((warning) => warning.startsWith('Forecast:') || warning.startsWith('Expected flood risk'))
  return hasWarning || (response.forecast?.riskLevel !== undefined && response.forecast.riskLevel !== 'low')
}

export function buildRouteVoiceMessage(response: RouteCheckResponse) {
  const routeSummary =
    response.floodZones.length > 0
      ? `Route check complete. ${response.floodZones.length} flood zone intersection${response.floodZones.length > 1 ? 's' : ''} detected.`
      : 'Route check complete. No active flood intersections detected.'

  const forecastSummary = response.forecast?.summary?.trim()
  const forecastStatus = hasForecastAlert(response) ? 'Forecast alert active.' : 'No forecast alerts.'

  return forecastSummary ? `${routeSummary} ${forecastStatus} ${forecastSummary}` : `${routeSummary} ${forecastStatus}`
}

export async function speak(text: string, variant: VoiceVariant) {
  if (ELEVENLABS_ENABLED) {
    const ok = await elevenLabsSpeak(text, variant)
    if (ok) return
  }
  await browserSpeak(text, variant)
}
