import type { VoiceVariant } from '@/stores/settingsStore'

const ELEVENLABS_ENABLED = import.meta.env.VITE_ELEVENLABS_ENABLED === 'true'

function pickVoice(variant: VoiceVariant): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices()
  const vi = voices.filter((v) => (v.lang || '').toLowerCase().startsWith('vi'))
  const pool = vi.length > 0 ? vi : voices

  if (variant === 'female_south') {
    const v = pool.find((x) => /female|nu|nữ/i.test(x.name))
    return v ?? pool[0] ?? null
  }

  const v = pool.find((x) => /male|nam/i.test(x.name))
  return v ?? pool[0] ?? null
}

function browserSpeak(text: string, variant: VoiceVariant) {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'vi-VN'
  const v = pickVoice(variant)
  if (v) utterance.voice = v
  utterance.rate = 1
  utterance.pitch = variant === 'female_south' ? 1.05 : 0.95
  utterance.volume = 1
  window.speechSynthesis.speak(utterance)
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

export async function speak(text: string, variant: VoiceVariant) {
  if (ELEVENLABS_ENABLED) {
    const ok = await elevenLabsSpeak(text, variant)
    if (ok) return
  }
  browserSpeak(text, variant)
}
