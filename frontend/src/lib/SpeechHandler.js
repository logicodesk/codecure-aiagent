// ── SpeechHandler.js — Web Speech API wrapper ─────────────────
// Handles both STT (recognition) and TTS (synthesis)

const SR = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition || null)
  : null

export const LANGUAGES = [
  { code: 'en-US', label: 'English',  flag: '🇺🇸' },
  { code: 'hi-IN', label: 'Hindi',    flag: '🇮🇳' },
  { code: 'es-ES', label: 'Spanish',  flag: '🇪🇸' },
  { code: 'fr-FR', label: 'French',   flag: '🇫🇷' },
  { code: 'de-DE', label: 'German',   flag: '🇩🇪' },
  { code: 'zh-CN', label: 'Chinese',  flag: '🇨🇳' },
  { code: 'ja-JP', label: 'Japanese', flag: '🇯🇵' },
  { code: 'pt-BR', label: 'Portuguese', flag: '🇧🇷' },
]

export const isSpeechSupported = () => Boolean(SR)
export const isTTSSupported    = () =>
  typeof window !== 'undefined' && Boolean(window.speechSynthesis)

// ── Speech Recognition ────────────────────────────────────────
export class SpeechRecognizer {
  constructor({ lang = 'en-US', onResult, onError, onStart, onEnd } = {}) {
    if (!SR) throw new Error('SpeechRecognition not supported')
    this._r = new SR()
    this._r.lang = lang
    this._r.continuous = false
    this._r.interimResults = false
    this._r.maxAlternatives = 3

    this._r.onstart  = () => onStart?.()
    this._r.onend    = () => onEnd?.()
    this._r.onerror  = (e) => {
      if (e.error !== 'no-speech') onError?.(e.error)
      else onEnd?.()
    }
    this._r.onresult = (e) => {
      const alts = Array.from(e.results[0]).map(a => a.transcript.trim())
      onResult?.(alts)
    }
  }

  setLang(lang) { this._r.lang = lang }

  start() {
    try { this._r.start() } catch (_) {}
  }

  stop() {
    try { this._r.stop() } catch (_) {}
  }

  abort() {
    try { this._r.abort() } catch (_) {}
  }
}

// ── Text-to-Speech ────────────────────────────────────────────
let _currentUtterance = null

export function speak(text, { lang = 'en-US', rate = 1.0, pitch = 1.0, volume = 0.9,
                               onStart, onEnd, onError } = {}) {
  if (!isTTSSupported()) return
  stopSpeaking()

  const utt = new SpeechSynthesisUtterance(text)
  utt.lang   = lang
  utt.rate   = rate
  utt.pitch  = pitch
  utt.volume = volume

  utt.onstart = () => onStart?.()
  utt.onend   = () => { _currentUtterance = null; onEnd?.() }
  utt.onerror = (e) => { _currentUtterance = null; onError?.(e) }

  // Pick a natural voice for the language if available
  const voices = window.speechSynthesis.getVoices()
  const match  = voices.find(v => v.lang.replace('_', '-') === lang && !v.localService)
             || voices.find(v => v.lang.startsWith(lang.split('-')[0]) && !v.localService)
             || voices.find(v => v.lang.startsWith(lang.split('-')[0]))

  if (match) utt.voice = match

  _currentUtterance = utt
  window.speechSynthesis.speak(utt)
}

export function stopSpeaking() {
  if (isTTSSupported()) window.speechSynthesis.cancel()
  _currentUtterance = null
}

export function isSpeaking() {
  return isTTSSupported() && window.speechSynthesis.speaking
}
