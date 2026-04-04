import { motion } from 'framer-motion'
import { Dna, Info } from 'lucide-react'

const MODALITY_CFG = {
  PROTAC:         { color: '#a78bfa', bg: 'rgba(139,92,246,0.1)', icon: '🔗', label: 'PROTAC' },
  Lipid_NP:       { color: '#38bdf8', bg: 'rgba(14,165,233,0.1)', icon: '💉', label: 'Lipid NP' },
  Macrocycle:     { color: '#fb923c', bg: 'rgba(249,115,22,0.1)', icon: '⭕', label: 'Macrocycle' },
  Peptide:        { color: '#4ade80', bg: 'rgba(34,197,94,0.1)',  icon: '🧬', label: 'Peptide' },
  Small_Molecule: { color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', icon: '⚗', label: 'Small Molecule' },
  Unknown:        { color: '#64748b', bg: 'rgba(100,116,139,0.08)', icon: '❓', label: 'Unknown' },
}

export default function NovelModalityPanel({ novelModality }) {
  if (!novelModality?.modality) return null

  const { modality, confidence, description, cold_start_note, special_considerations } = novelModality
  const cfg = MODALITY_CFG[modality] ?? MODALITY_CFG.Unknown
  const isNovel = modality !== 'Small_Molecule'
  const confPct = Math.round((confidence ?? 0.9) * 100)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 }}
      className="glass p-4 space-y-3"
      style={isNovel ? { border: `1px solid ${cfg.color}33` } : {}}
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-1.5 rounded-lg" style={{ background: cfg.bg }}>
          <Dna size={13} style={{ color: cfg.color }} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold" style={{ color: cfg.color }}>
              {cfg.icon} {cfg.label}
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-mono"
                  style={{ background: cfg.bg, color: cfg.color }}>
              {confPct}% confidence
            </span>
            {isNovel && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                    style={{ background: 'rgba(251,146,60,0.1)', color: '#fb923c',
                             border: '1px solid rgba(251,146,60,0.2)' }}>
                Novel Modality
              </span>
            )}
          </div>
          <p className="text-[10px] mt-0.5" style={{ color: 'rgba(148,163,184,0.7)' }}>
            {description}
          </p>
        </div>
      </div>

      {/* Cold-start note */}
      {cold_start_note && (
        <div className="rounded-xl p-2.5 text-[10px] leading-relaxed flex items-start gap-2"
             style={{ background: isNovel ? 'rgba(251,146,60,0.06)' : 'rgba(255,255,255,0.03)',
                      border: isNovel ? '1px solid rgba(251,146,60,0.15)' : '1px solid rgba(255,255,255,0.05)',
                      color: 'rgba(148,163,184,0.75)' }}>
          <Info size={10} style={{ color: isNovel ? '#fb923c' : '#64748b', flexShrink: 0, marginTop: 1 }} />
          {cold_start_note}
        </div>
      )}

      {/* Special considerations */}
      {special_considerations?.length > 0 && (
        <div className="space-y-1">
          <p className="section-label">Special Considerations</p>
          {special_considerations.map((c, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-start gap-1.5 text-[10px]"
              style={{ color: 'rgba(148,163,184,0.7)' }}
            >
              <span style={{ color: cfg.color, flexShrink: 0 }}>•</span>
              {c}
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
