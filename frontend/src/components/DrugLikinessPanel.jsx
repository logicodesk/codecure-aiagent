import { motion } from 'framer-motion'
import { CheckCircle2, XCircle, FlaskConical } from 'lucide-react'

const RULES = [
  { key: 'mw',   label: 'Mol. Weight', unit: 'Da', limit: '< 500',  pass: v => v < 500 },
  { key: 'logp', label: 'LogP',        unit: '',   limit: '< 5',    pass: v => v < 5   },
  { key: 'hbd',  label: 'H-Bond Donors', unit: '', limit: '≤ 5',   pass: v => v <= 5  },
  { key: 'hba',  label: 'H-Bond Acceptors', unit:'', limit: '≤ 10', pass: v => v <= 10 },
]

export default function DrugLikinessPanel({ features }) {
  if (!features) return null

  const vals = {
    mw:   features.MolWeight ?? features.MolWt ?? 0,
    logp: features.LogP ?? 0,
    hbd:  features.HBD  ?? 0,
    hba:  features.HBA  ?? 0,
  }

  const passes = RULES.filter(r => r.pass(vals[r.key])).length
  const allPass = passes === 4

  const scoreColor = allPass ? '#4ade80' : passes >= 3 ? '#facc15' : '#f87171'
  const scoreBg    = allPass
    ? 'rgba(34,197,94,0.1)'
    : passes >= 3
    ? 'rgba(250,204,21,0.1)'
    : 'rgba(239,68,68,0.1)'
  const scoreBorder = allPass
    ? 'rgba(34,197,94,0.2)'
    : passes >= 3
    ? 'rgba(250,204,21,0.2)'
    : 'rgba(239,68,68,0.2)'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="glass p-5 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg" style={{ background: 'rgba(56,189,248,0.1)' }}>
            <FlaskConical size={13} style={{ color: '#38bdf8' }} />
          </div>
          <span className="text-sm font-semibold" style={{ color: '#7dd3fc' }}>
            Lipinski Rule of 5
          </span>
        </div>
        <span className="text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ background: scoreBg, color: scoreColor, border: `1px solid ${scoreBorder}` }}>
          {passes}/4 passed
        </span>
      </div>

      {/* Score bar */}
      <div className="h-1.5 rounded-full overflow-hidden"
           style={{ background: 'rgba(255,255,255,0.06)' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(passes / 4) * 100}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, #0ea5e9, ${scoreColor})` }}
        />
      </div>

      {/* Rules grid */}
      <div className="grid grid-cols-2 gap-2">
        {RULES.map((rule, i) => {
          const val = vals[rule.key]
          const ok  = rule.pass(val)
          return (
            <motion.div
              key={rule.key}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25 + i * 0.06 }}
              className="flex items-center gap-2 rounded-xl px-3 py-2.5"
              style={{
                background: ok ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
                border: ok ? '1px solid rgba(34,197,94,0.15)' : '1px solid rgba(239,68,68,0.15)',
              }}
            >
              {ok
                ? <CheckCircle2 size={13} style={{ color: '#4ade80', flexShrink: 0 }} />
                : <XCircle      size={13} style={{ color: '#f87171', flexShrink: 0 }} />
              }
              <div className="min-w-0">
                <p className="text-[10px] truncate" style={{ color: 'rgba(100,116,139,0.8)' }}>
                  {rule.label}
                </p>
                <p className="text-xs font-bold" style={{ color: ok ? '#4ade80' : '#f87171' }}>
                  {typeof val === 'number' ? val.toFixed(val % 1 === 0 ? 0 : 2) : val}
                  {rule.unit && <span className="font-normal text-[10px] ml-0.5">{rule.unit}</span>}
                  <span className="text-[9px] font-normal ml-1"
                        style={{ color: 'rgba(100,116,139,0.6)' }}>
                    ({rule.limit})
                  </span>
                </p>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Summary */}
      <p className="text-xs text-center font-medium"
         style={{ color: scoreColor }}>
        {allPass
          ? '✓ Drug-like — good oral bioavailability predicted'
          : passes >= 3
          ? '⚠ Mostly drug-like — minor violations present'
          : '✗ Poor drug-likeness — multiple Ro5 violations'}
      </p>
    </motion.div>
  )
}
