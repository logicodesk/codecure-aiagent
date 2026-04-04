import { motion, AnimatePresence } from 'framer-motion'
import { User, Bot, Trash2, Clock, Sparkles } from 'lucide-react'

const SUGGESTED_PROMPTS = [
  { label: 'Explain toxicity', icon: '🧠', query: 'Explain why this compound is toxic' },
  { label: 'Compare drugs', icon: '⚖️', query: 'Compare toxicity of aspirin vs ibuprofen' },
  { label: 'Why toxic?', icon: '🔬', query: 'What structural features cause toxicity?' },
  { label: 'Safe alternatives', icon: '✅', query: 'Suggest safer structural modifications' },
]

function HistoryItem({ item, index }) {
  const { smiles, result, timestamp, drugName } = item
  const time = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const pct  = Math.round(result.probability * 100)
  const displayLabel = drugName || smiles

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ delay: index * 0.04 }}
      className="space-y-1.5"
    >
      {/* User bubble */}
      <div className="flex items-start gap-2 justify-end">
        <div className="max-w-[82%] rounded-2xl rounded-tr-sm px-3 py-2"
             style={{
               background: 'rgba(14,165,233,0.1)',
               border: '1px solid rgba(14,165,233,0.2)',
             }}>
          <p className="text-[11px] font-mono break-all"
             style={{ color: '#7dd3fc' }}>{displayLabel}</p>
          <p className="text-[9px] mt-0.5 text-right flex items-center justify-end gap-1"
             style={{ color: 'rgba(100,116,139,0.6)' }}>
            <Clock size={8} /> {time}
          </p>
        </div>
        <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
             style={{ background: 'rgba(14,165,233,0.15)' }}>
          <User size={10} style={{ color: '#38bdf8' }} />
        </div>
      </div>

      {/* AI bubble */}
      <div className="flex items-start gap-2">
        <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
             style={{ background: 'rgba(139,92,246,0.15)' }}>
          <Bot size={10} style={{ color: '#a78bfa' }} />
        </div>
        <div className="max-w-[82%] rounded-2xl rounded-tl-sm px-3 py-2"
             style={{
               background: 'rgba(255,255,255,0.04)',
               border: '1px solid rgba(255,255,255,0.07)',
             }}>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold"
                  style={{ color: result.toxic ? '#f87171' : '#4ade80' }}>
              {result.toxic ? '⚠ TOXIC' : '✓ NON-TOXIC'}
            </span>
            <span className="text-[10px]" style={{ color: 'rgba(100,116,139,0.7)' }}>
              {pct}%
            </span>
          </div>
          <p className="text-[10px] mt-0.5 line-clamp-2"
             style={{ color: 'rgba(100,116,139,0.7)' }}>
            {result.insight}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

export default function ChatHistory({ history, onClear, onPromptSelect }) {
  const showSuggestions = history.length === 0

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="glass p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <span className="section-label">
          {showSuggestions ? 'Suggested Prompts' : `History (${history.length})`}
        </span>
        {history.length > 0 && (
          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={onClear}
            className="flex items-center gap-1 text-[11px] transition-colors"
            style={{ color: 'rgba(100,116,139,0.7)' }}
            onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(100,116,139,0.7)'}
          >
            <Trash2 size={10} /> Clear
          </motion.button>
        )}
      </div>

      {/* Suggested prompts (shown when history is empty) */}
      {showSuggestions && (
        <div className="grid grid-cols-2 gap-1.5">
          {SUGGESTED_PROMPTS.map((p, i) => (
            <motion.button
              key={p.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onPromptSelect?.(p.query)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-all"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(14,165,233,0.06)'
                e.currentTarget.style.borderColor = 'rgba(14,165,233,0.2)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'
              }}
            >
              <span className="text-sm">{p.icon}</span>
              <span className="text-[10px] font-medium leading-tight" style={{ color: 'rgba(148,163,184,0.8)' }}>
                {p.label}
              </span>
            </motion.button>
          ))}
        </div>
      )}

      {/* History items */}
      {history.length > 0 && (
        <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
          <AnimatePresence>
            {[...history].reverse().map((item, i) => (
              <HistoryItem key={item.id} item={item} index={i} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  )
}
