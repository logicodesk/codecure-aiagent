import { useState, useRef, useEffect, useCallback, useReducer } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic, MicOff, Volume2, VolumeX, Square, Sparkles,
  Bot, User, ChevronDown, Globe, Settings2, RotateCcw, Send,
} from 'lucide-react'
import {
  SpeechRecognizer, speak, stopSpeaking, isSpeechSupported,
  isTTSSupported, LANGUAGES,
} from '../lib/SpeechHandler'
import { processVoiceQuery } from '../lib/AIExplanation'
import { correctDrugName } from '../lib/smilesResolver'

// ── Status labels ─────────────────────────────────────────────
const STATUS_META = {
  idle:       { label: 'Ready',       color: 'rgba(100,116,139,0.7)',  dot: '#64748b' },
  listening:  { label: 'Listening…',  color: '#38bdf8',                dot: '#38bdf8' },
  processing: { label: 'Processing…', color: '#a78bfa',                dot: '#a78bfa' },
  fetching:   { label: 'Fetching…',   color: '#fbbf24',                dot: '#fbbf24' },
  predicting: { label: 'Predicting…', color: '#fb923c',                dot: '#fb923c' },
  speaking:   { label: 'Speaking…',   color: '#4ade80',                dot: '#4ade80' },
  error:      { label: 'Error',       color: '#f87171',                dot: '#f87171' },
}

// ── Waveform bars ─────────────────────────────────────────────
function Waveform({ active, color = '#38bdf8', bars = 12 }) {
  const heights = [0.3, 0.6, 0.9, 0.7, 1, 0.5, 0.8, 0.4, 0.9, 0.6, 0.7, 0.3]
  return (
    <div className="flex items-center gap-[3px]" style={{ height: 32 }}>
      {Array.from({ length: bars }).map((_, i) => (
        <motion.div
          key={i}
          className="rounded-full"
          style={{ width: 3, background: color, originY: 0.5 }}
          animate={active
            ? { scaleY: [heights[i % heights.length], 1, heights[(i + 3) % heights.length], 0.4, heights[i % heights.length]] }
            : { scaleY: 0.15 }
          }
          transition={active
            ? { duration: 0.7 + i * 0.05, repeat: Infinity, delay: i * 0.06, ease: 'easeInOut' }
            : { duration: 0.3 }
          }
          initial={{ scaleY: 0.15, height: 28 }}
        />
      ))}
    </div>
  )
}

// ── Pulse ring ────────────────────────────────────────────────
function PulseRing({ active, color = 'rgba(56,189,248,0.4)' }) {
  if (!active) return null
  return (
    <>
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="absolute inset-0 rounded-full pointer-events-none"
          animate={{ scale: [1, 1.8 + i * 0.4], opacity: [0.5, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.4, ease: 'easeOut' }}
          style={{ border: `1.5px solid ${color}` }}
        />
      ))}
    </>
  )
}

// ── Chat message bubble ───────────────────────────────────────
function ChatBubble({ msg, index, onSpeak, ttsOk }) {
  const isUser = msg.role === 'user'
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.03, ease: [0.23, 1, 0.32, 1] }}
      className={`flex items-start gap-2 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      {/* Avatar */}
      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
           style={{ background: isUser ? 'rgba(14,165,233,0.15)' : 'rgba(139,92,246,0.15)' }}>
        {isUser
          ? <User size={11} style={{ color: '#38bdf8' }} />
          : <Bot  size={11} style={{ color: '#a78bfa' }} />
        }
      </div>

      {/* Bubble */}
      <div className="max-w-[82%] space-y-1">
        <div
          className="rounded-2xl px-3 py-2.5 text-[12px] leading-relaxed"
          style={isUser ? {
            background: 'rgba(14,165,233,0.1)',
            border: '1px solid rgba(14,165,233,0.2)',
            color: '#7dd3fc',
            borderTopRightRadius: 4,
          } : {
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#e2e8f0',
            borderTopLeftRadius: 4,
          }}
        >
          {msg.text}
        </div>

        {/* Read Aloud Button for AI */}
        {!isUser && ttsOk && (
          <button
            onClick={() => onSpeak(msg.text)}
            className="p-2 rounded-xl transition-all opacity-60 hover:opacity-100 hover:bg-white/10 hover:shadow-lg hover:shadow-sky-500/10"
            title="Read aloud"
            style={{ color: '#a78bfa', background: 'rgba(167,139,250,0.05)', border: '1px solid rgba(167,139,250,0.1)' }}
          >
            <Volume2 size={15} />
          </button>
        )}

        {/* Result badge */}
        {msg.result && (
          <div className="space-y-1.5">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 px-2 py-1 rounded-lg w-fit"
              style={{
                background: msg.result.toxic ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)',
                border: `1px solid ${msg.result.toxic ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`,
              }}
            >
              <span className="text-[11px] font-bold"
                    style={{ color: msg.result.toxic ? '#f87171' : '#4ade80' }}>
                {msg.result.toxic ? '⚠ TOXIC' : '✓ NON-TOXIC'}
              </span>
              <span className="text-[10px]" style={{ color: 'rgba(100,116,139,0.8)' }}>
                {Math.round(msg.result.probability * 100)}%
              </span>
              {msg.result.features?.mw && (
                <span className="text-[9px] font-mono" style={{ color: 'rgba(100,116,139,0.6)' }}>
                  MW {msg.result.features.mw} Da
                </span>
              )}
            </motion.div>

            {/* Source links */}
            {msg.sources?.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {msg.sources.map((s, i) => (
                  <a
                    key={i}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-white/5 bg-white/5 hover:bg-white/10 transition-colors no-underline"
                  >
                    <span className="text-[9px]">{s.icon}</span>
                    <span className="text-[9px] font-medium text-slate-400 hover:text-sky-400">{s.label}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Key terms highlight */}
        {msg.highlights?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {msg.highlights.map((h, i) => (
              <span key={i} className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                    style={{ background: 'rgba(139,92,246,0.1)', color: '#c4b5fd',
                             border: '1px solid rgba(139,92,246,0.15)' }}>
                {h}
              </span>
            ))}
          </div>
        )}

        <p className="text-[9px]" style={{ color: 'rgba(71,85,105,0.6)' }}>
          {new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </motion.div>
  )
}

// ── Language selector ─────────────────────────────────────────
function LangSelector({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const current = LANGUAGES.find(l => l.code === value) || LANGUAGES[0]
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: 'rgba(148,163,184,0.9)',
        }}
      >
        <Globe size={11} />
        <span>{current.flag} {current.label}</span>
        <ChevronDown size={10} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-1 right-0 z-50 rounded-xl p-1.5 min-w-[140px]"
            style={{
              background: 'rgba(8,12,20,0.98)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
            }}
          >
            {LANGUAGES.map(l => (
              <button
                key={l.code}
                onClick={() => { onChange(l.code); setOpen(false) }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] transition-all text-left"
                style={{
                  background: l.code === value ? 'rgba(14,165,233,0.1)' : 'transparent',
                  color: l.code === value ? '#38bdf8' : 'rgba(148,163,184,0.8)',
                }}
                onMouseEnter={e => { if (l.code !== value) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                onMouseLeave={e => { if (l.code !== value) e.currentTarget.style.background = 'transparent' }}
              >
                <span>{l.flag}</span>
                <span>{l.label}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── TTS settings ──────────────────────────────────────────────
function TTSSettings({ settings, onChange }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="p-1.5 rounded-lg transition-all"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                 color: 'rgba(100,116,139,0.7)' }}
        title="Voice settings"
      >
        <Settings2 size={12} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-1 right-0 z-50 rounded-xl p-3 space-y-3 w-48"
            style={{
              background: 'rgba(8,12,20,0.98)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
            }}
          >
            {[
              { key: 'rate',  label: 'Speed',  min: 0.5, max: 2,   step: 0.1 },
              { key: 'pitch', label: 'Pitch',  min: 0.5, max: 2,   step: 0.1 },
              { key: 'volume', label: 'Volume', min: 0,   max: 1,   step: 0.1 },
            ].map(({ key, label, min, max, step }) => (
              <div key={key} className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-[10px]" style={{ color: 'rgba(100,116,139,0.8)' }}>{label}</span>
                  <span className="text-[10px] font-mono" style={{ color: '#38bdf8' }}>
                    {settings[key].toFixed(1)}
                  </span>
                </div>
                <input
                  type="range" min={min} max={max} step={step}
                  value={settings[key]}
                  onChange={e => onChange({ ...settings, [key]: parseFloat(e.target.value) })}
                  className="w-full h-1 rounded-full appearance-none cursor-pointer"
                  style={{ accentColor: '#38bdf8' }}
                />
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Chat reducer ──────────────────────────────────────────────
function chatReducer(state, action) {
  switch (action.type) {
    case 'ADD':    return [action.msg, ...state].slice(0, 50)
    case 'CLEAR':  return []
    default:       return state
  }
}

// ── Main VoiceAssistant component ─────────────────────────────
export default function VoiceAssistant({ onResult, dark = true }) {
  const [status,   setStatus]   = useState('idle')
  const [lang,     setLang]     = useState('en-US')
  const [muted,    setMuted]    = useState(false)
  const [ttsOpts,  setTtsOpts]  = useState({ rate: 1.0, pitch: 1.05, volume: 0.9 })
  const [messages, dispatch]    = useReducer(chatReducer, [])
  const [transcript, setTranscript] = useState('')
  const [textInput, setTextInput] = useState('')

  const recognizerRef = useRef(null)
  const chatEndRef    = useRef(null)
  const isListening   = status === 'listening'
  const isBusy        = ['processing', 'fetching', 'predicting', 'speaking'].includes(status)

  const meta = STATUS_META[status] || STATUS_META.idle

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Rebuild recognizer when lang changes
  useEffect(() => {
    recognizerRef.current?.abort()
    if (!isSpeechSupported()) return
    recognizerRef.current = new SpeechRecognizer({
      lang,
      onStart: () => setStatus('listening'),
      onEnd:   () => setStatus(s => s === 'listening' ? 'idle' : s),
      onError: (err) => {
        setStatus('error')
        dispatch({ type: 'ADD', msg: {
          role: 'ai', text: `Voice error: ${err}. Please try again.`,
          ts: Date.now(),
        }})
        setTimeout(() => setStatus('idle'), 2000)
      },
      onResult: (alts) => handleTranscript(alts),
    })
    return () => recognizerRef.current?.abort()
  }, [lang]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleTranscript = useCallback(async (alts) => {
    // Pick best alternative
    let best = alts[0]
    for (const alt of alts) {
      const lower = alt.toLowerCase().trim()
      if (/aspirin|ibuprofen|caffeine|paracetamol|morphine|metformin/i.test(lower)) {
        best = alt; break
      }
    }

    const corrected = correctDrugName(best)
    setTranscript(corrected)
    setStatus('processing')

    // Add user message
    dispatch({ type: 'ADD', msg: { role: 'user', text: corrected, ts: Date.now() } })

    try {
      const { explanation, result, drugName, intent } = await processVoiceQuery(corrected, {
        lang,
        onStatus: (s) => setStatus(s),
      })

      // Extract sources from report if available
      const sources = []
      if (result?.compound_info?.cid) {
        sources.push({ label: 'PubChem', url: `https://pubchem.ncbi.nlm.nih.gov/compound/${result.compound_info.cid}`, icon: '🔬' })
      }
      if (result?.compound_info?.sourceUrl) {
        sources.push({ label: 'Research Source', url: result.compound_info.sourceUrl, icon: '🔗' })
      }

      // Build highlight terms
      const highlights = []
      if (result?.probability != null) highlights.push(`${Math.round(result.probability * 100)}% probability`)
      if (result?.features?.LogP != null) highlights.push(`LogP ${result.features.LogP.toFixed(2)}`)
      if (result?.drug_likeness?.lipinski_pass != null)
        highlights.push(result.drug_likeness.lipinski_pass ? 'Lipinski ✓' : 'Lipinski ✗')

      dispatch({ type: 'ADD', msg: {
        role: 'ai',
        text: explanation,
        result: result || null,
        sources,
        highlights,
        ts: Date.now(),
      }})

      // Pass result up to App
      if (result) onResult?.(result, drugName)

      // Speak the response
      if (!muted && isTTSSupported()) {
        setStatus('speaking')
        speak(explanation, {
          lang,
          ...ttsOpts,
          onEnd:   () => setStatus('idle'),
          onError: () => setStatus('idle'),
        })
      } else {
        setStatus('idle')
      }
    } catch (err) {
      const errMsg = `Sorry, I couldn't process that. ${err?.message || 'Please try again.'}`
      dispatch({ type: 'ADD', msg: { role: 'ai', text: errMsg, ts: Date.now() } })
      setStatus('error')
      if (!muted) speak(errMsg, { lang, ...ttsOpts })
      setTimeout(() => setStatus('idle'), 2500)
    }
  }, [lang, muted, ttsOpts, onResult])

  const toggleListen = useCallback(() => {
    if (isBusy) return
    if (isListening) {
      recognizerRef.current?.stop()
      setStatus('idle')
    } else {
      stopSpeaking()
      setStatus('idle')
      setTimeout(() => recognizerRef.current?.start(), 80)
    }
  }, [isListening, isBusy])

  const toggleMute = useCallback(() => {
    setMuted(m => {
      if (!m) stopSpeaking()
      return !m
    })
  }, [])

  const clearChat = useCallback(() => {
    dispatch({ type: 'CLEAR' })
    setTranscript('')
    setStatus('idle')
    stopSpeaking()
  }, [])

  const speechOk = isSpeechSupported()
  const ttsOk    = isTTSSupported()

  // Mic button color
  const micColor = isListening ? '#38bdf8' : isBusy ? '#a78bfa' : 'rgba(100,116,139,0.7)'
  const micBg    = isListening
    ? 'rgba(56,189,248,0.15)'
    : isBusy
    ? 'rgba(139,92,246,0.1)'
    : 'rgba(255,255,255,0.05)'

  return (
    <div className="glass p-5 space-y-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg" style={{ background: 'rgba(139,92,246,0.12)' }}>
            <Sparkles size={13} style={{ color: '#a78bfa' }} />
          </div>
          <div>
            <span className="text-sm font-semibold" style={{ color: '#c4b5fd' }}>
              Voice Assistant
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <motion.div
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: meta.dot }}
                animate={isListening ? { scale: [1, 1.4, 1], opacity: [1, 0.6, 1] } : {}}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
              <span className="text-[10px] font-medium" style={{ color: meta.color }}>
                {meta.label}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <LangSelector value={lang} onChange={setLang} />
          {ttsOk && <TTSSettings settings={ttsOpts} onChange={setTtsOpts} />}
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="p-1.5 rounded-lg transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                       color: 'rgba(100,116,139,0.6)' }}
              title="Clear conversation"
            >
              <RotateCcw size={12} />
            </button>
          )}
        </div>
      </div>

      {/* ── Mic button + waveform ── */}
      <div className="flex flex-col items-center gap-4 py-2">
        {/* Waveform */}
        <div className="h-8 flex items-center">
          <Waveform
            active={isListening || status === 'speaking'}
            color={status === 'speaking' ? '#4ade80' : '#38bdf8'}
          />
        </div>

        {/* Mic button */}
        <div className="relative flex items-center justify-center">
          <PulseRing active={isListening} />

          <motion.button
            onClick={toggleListen}
            disabled={!speechOk || isBusy}
            whileHover={!isBusy ? { scale: 1.06 } : {}}
            whileTap={!isBusy ? { scale: 0.94 } : {}}
            className="relative w-16 h-16 rounded-full flex items-center justify-center
                       transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: micBg,
              border: `2px solid ${isListening ? 'rgba(56,189,248,0.5)' : isBusy ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.1)'}`,
              boxShadow: isListening
                ? '0 0 24px rgba(56,189,248,0.3), 0 0 48px rgba(56,189,248,0.1)'
                : isBusy
                ? '0 0 16px rgba(139,92,246,0.2)'
                : 'none',
            }}
            aria-label={isListening ? 'Stop listening' : 'Start voice assistant'}
          >
            {!speechOk
              ? <MicOff size={22} style={{ color: 'rgba(100,116,139,0.5)' }} />
              : isListening
              ? <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 0.6, repeat: Infinity }}>
                  <Square size={18} style={{ color: '#38bdf8' }} />
                </motion.div>
              : <Mic size={22} style={{ color: micColor }} />
            }
          </motion.button>
        </div>

        {/* Status hint */}
        <p className="text-[11px] text-center" style={{ color: meta.color }}>
          {isListening
            ? 'Listening… speak naturally'
            : isBusy
            ? meta.label
            : speechOk
            ? 'Click mic and speak a drug name'
            : 'Voice not supported in this browser'
          }
        </p>

        {/* Transcript preview */}
        <AnimatePresence>
          {transcript && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="px-3 py-1.5 rounded-full text-[11px] font-medium"
              style={{
                background: 'rgba(14,165,233,0.08)',
                border: '1px solid rgba(14,165,233,0.15)',
                color: '#7dd3fc',
              }}
            >
              "{transcript}"
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Example prompts ── */}
      {messages.length === 0 && (
        <div className="space-y-2">
          <p className="section-label">Try saying…</p>
          <div className="flex flex-wrap gap-1.5">
            {[
              'Is aspirin safe?',
              'Explain toxicity of ibuprofen',
              'Predict caffeine toxicity',
              'Is nitrobenzene dangerous?',
            ].map(ex => (
              <button
                key={ex}
                onClick={() => handleTranscript([ex])}
                disabled={isBusy}
                className="text-[10px] px-2.5 py-1 rounded-full transition-all disabled:opacity-40"
                style={{
                  background: 'rgba(139,92,246,0.08)',
                  border: '1px solid rgba(139,92,246,0.15)',
                  color: '#c4b5fd',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.15)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.08)' }}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Chat history ── */}
      <AnimatePresence>
        {messages.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-3 max-h-72 overflow-y-auto pr-1"
            style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 12 }}
          >
            {[...messages].reverse().map((msg, i) => (
              <ChatBubble
                key={msg.ts}
                msg={msg}
                index={i}
                ttsOk={ttsOk}
                onSpeak={(txt) => speak(txt, { lang, ...ttsOpts })}
              />
            ))}
            <div ref={chatEndRef} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Text Chat Input ── */}
      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl"
             style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <input
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !isBusy && textInput.trim() && (handleTranscript([textInput]), setTextInput(''))}
            placeholder="Message ToxScout AI..."
            className="flex-1 text-[14px] bg-transparent outline-none py-1"
            style={{ color: '#f1f5f9', caretColor: '#a78bfa' }}
            disabled={isBusy}
          />
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          disabled={isBusy || !textInput.trim()}
          onClick={() => { handleTranscript([textInput]); setTextInput('') }}
          className="p-2.5 rounded-xl disabled:opacity-40"
          style={{ background: 'rgba(139,92,246,0.25)', border: '1px solid rgba(139,92,246,0.4)',
                   color: '#a78bfa' }}
        >
          <Send size={16} />
        </motion.button>
      </div>

      {/* ── TTS mute toggle ── */}
      {ttsOk && (
        <div className="flex items-center justify-between pt-1"
             style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <span className="text-[10px]" style={{ color: 'rgba(71,85,105,0.7)' }}>
            Voice output
          </span>
          <button
            onClick={toggleMute}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] transition-all"
            style={{
              background: muted ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)',
              border: `1px solid ${muted ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`,
              color: muted ? '#f87171' : '#4ade80',
            }}
          >
            {muted ? <VolumeX size={11} /> : <Volume2 size={11} />}
            {muted ? 'Muted' : 'On'}
          </button>
        </div>
      )}
    </div>
  )
}
