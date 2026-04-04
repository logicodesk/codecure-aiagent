import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FlaskConical, Atom, Scale, ShieldAlert, ShieldCheck,
  BookOpen, GraduationCap, ChevronDown, ChevronUp, Microscope,
} from 'lucide-react'

const FG_DEFS = [
  { id: 'nitro',       label: 'Nitro (–NO₂)',             pattern: /\[N\+\]\(=O\)\[O\-\]|N\(=O\)=O/,  risk: 'high',     color: '#ef4444' },
  { id: 'arom_amine',  label: 'Aromatic amine (Ar–NH₂)',  pattern: /c[NH2]|cN(?![HO]?C=O)/,            risk: 'high',     color: '#ef4444' },
  { id: 'aldehyde',    label: 'Aldehyde (–CHO)',           pattern: /O=C[^(ONC]|cC=O/,                 risk: 'moderate', color: '#f97316' },
  { id: 'epoxide',     label: 'Epoxide ring',              pattern: /C1OC1/,                            risk: 'high',     color: '#ef4444' },
  { id: 'azo',         label: 'Azo (–N=N–)',              pattern: /N=N/,                              risk: 'high',     color: '#ef4444' },
  { id: 'thiol',       label: 'Thiol (–SH)',               pattern: /\[SH\]/,                           risk: 'moderate', color: '#f97316' },
  { id: 'quinone',     label: 'Quinone scaffold',          pattern: /C1=CC\(=O\)C=CC1=O/,              risk: 'high',     color: '#ef4444' },
  { id: 'michael',     label: 'Michael acceptor',          pattern: /C=CC=O|C=CC#N/,                   risk: 'moderate', color: '#f97316' },
  { id: 'beta_lactam', label: 'Beta-Lactam ring',          pattern: /C1CNC1=O|C1CC\(=O\)N1/,           risk: 'low',      color: '#eab308' },
  { id: 'coumarin',    label: 'Coumarin scaffold',         pattern: /c1ccc2c\(c1\)OC\(=O\)C=C2/,       risk: 'moderate', color: '#f97316' },
  { id: 'phenol',      label: 'Phenol (Ar–OH)',            pattern: /c1ccc\(O\)cc1|c1cc\(O\)ccc1/,     risk: 'low',      color: '#eab308' },
  { id: 'amide',       label: 'Amide (–CONH–)',            pattern: /NC=O|C\(=O\)N/,                   risk: 'low',      color: '#eab308' },
  { id: 'ester',       label: 'Ester / Prodrug (–COO–)',   pattern: /C\(=O\)O[^H]/,                    risk: 'low',      color: '#eab308' },
  { id: 'carboxyl',    label: 'Carboxylic acid (–COOH)',   pattern: /C\(=O\)O(?!C)/,                   risk: 'low',      color: '#22c55e' },
  { id: 'halide_arom', label: 'Aromatic halide (Ar–X)',    pattern: /c[FClBrI]/,                       risk: 'moderate', color: '#f97316' },
  { id: 'halide_ali',  label: 'Aliphatic halide (C–X)',    pattern: /C[FClBrI](?!c)/,                 risk: 'moderate', color: '#f97316' },
  { id: 'alcohol',     label: 'Alcohol (–OH)',             pattern: /[CH]O(?!C=O)/,                    risk: 'low',      color: '#22c55e' },
  { id: 'ketone',      label: 'Ketone (C=O)',              pattern: /CC\(=O\)C/,                       risk: 'low',      color: '#22c55e' },
  { id: 'sulfone',     label: 'Sulfone / Sulfoxide',       pattern: /S\(=O\)/,                         risk: 'moderate', color: '#f97316' },
]

const DRUG_DB = [
  { smiles: 'CC(=O)Oc1ccccc1C(=O)O',               name: 'Aspirin',        cls: 'NSAID' },
  { smiles: 'CN1C=NC2=C1C(=O)N(C(=O)N2C)C',        name: 'Caffeine',       cls: 'Xanthine stimulant' },
  { smiles: 'CC(C)Cc1ccc(cc1)C(C)C(=O)O',           name: 'Ibuprofen',      cls: 'NSAID' },
  { smiles: 'CC(=O)Nc1ccc(O)cc1',                   name: 'Paracetamol',    cls: 'Analgesic' },
  { smiles: 'c1ccc(cc1)N',                           name: 'Aniline',        cls: 'Aromatic amine' },
  { smiles: 'c1ccc([N+](=O)[O-])cc1',               name: 'Nitrobenzene',   cls: 'Nitroaromatic' },
  { smiles: 'O=Cc1ccccc1',                           name: 'Benzaldehyde',   cls: 'Aromatic aldehyde' },
  { smiles: 'CC12CCC3C(C1CCC2O)CCC4=CC(=O)CCC34C',  name: 'Testosterone',   cls: 'Steroid' },
  { smiles: 'Clc1ccc(cc1Cl)c1cc(Cl)ccc1Cl',         name: 'PCB-47',         cls: 'Persistent pollutant' },
  { smiles: 'ClCCl',                                 name: 'Dichloromethane',cls: 'Halogenated solvent' },
  { smiles: 'CC1(C)SC2C(NC(=O)Cc3ccccc3)C(=O)N2C1C(=O)O', name: 'Penicillin G', cls: 'Beta-Lactam antibiotic' },
  { smiles: 'CN(C)C(=N)NC(=N)N',                    name: 'Metformin',      cls: 'Biguanide' },
]

const RISK_SEV = {
  high:     { bg: 'rgba(239,68,68,0.07)',  border: 'rgba(239,68,68,0.2)',  text: '#f87171' },
  moderate: { bg: 'rgba(249,115,22,0.07)', border: 'rgba(249,115,22,0.2)', text: '#fb923c' },
  low:      { bg: 'rgba(34,197,94,0.07)',  border: 'rgba(34,197,94,0.2)',  text: '#4ade80' },
}

function analyseSMILES(smiles) {
  if (!smiles) return null
  const s = smiles.trim()
  const groups = FG_DEFS.filter(fg => fg.pattern.test(s))

  const aromaticAtoms = (s.match(/[cnos]/g) || []).length
  const ringDigits    = s.match(/[1-9]/g) || []
  const totalRings    = Math.round(ringDigits.length / 2)
  const aromaticRings = aromaticAtoms > 4 ? Math.max(1, Math.round(aromaticAtoms / 6)) : 0
  const aliphRings    = Math.max(0, totalRings - aromaticRings)

  const clCount = (s.match(/Cl/g) || []).length
  const brCount = (s.match(/Br/g) || []).length
  const fCount  = (s.match(/F(?!e)/g) || []).length
  const nCount  = (s.match(/N/g) || []).length
  const oCount  = (s.match(/O/g) || []).length
  const sCount  = (s.match(/S(?!i)/g) || []).length
  const heavyAtoms = Math.max((s.replace(/[^A-Za-z]/g, '').match(/[A-Z][a-z]?/g) || []).length, 4)

  const mw = Math.round(heavyAtoms * 12 + clCount * 23.5 + brCount * 68 + fCount * 7 + nCount * 2 + oCount * 4 + sCount * 20)
  const logP = +(1.0 + clCount * 0.60 + brCount * 0.80 + fCount * 0.14 + aromaticRings * 1.1 - oCount * 0.55 - nCount * 0.35 - (groups.some(g => g.id === 'carboxyl') ? 1.2 : 0) - (groups.some(g => g.id === 'amide') ? 0.5 : 0)).toFixed(2)
  const hbd = Math.min((s.match(/\[NH\]|\[NH2\]|OH/g) || []).length + (groups.some(g => g.id === 'carboxyl') ? 1 : 0), 10)
  const hba = Math.min(oCount + nCount, 15)
  const tpsa = Math.round(oCount * 9.2 + nCount * 12.0 + sCount * 25.3)
  const rotBonds = Math.max(0, Math.round(heavyAtoms / 5) - totalRings)
  const lipinskiViol = (mw > 500 ? 1 : 0) + (+logP > 5 ? 1 : 0) + (hbd > 5 ? 1 : 0) + (hba > 10 ? 1 : 0)

  const exactMatch = DRUG_DB.find(d => d.smiles === s)
  function simScore(a, b) {
    let score = 0
    for (let len = 8; len >= 5; len--)
      for (let i = 0; i <= a.length - len; i++)
        if (b.includes(a.slice(i, i + len))) score += len
    return score / Math.max(a.length, b.length)
  }
  const similar = exactMatch ? [] : DRUG_DB.map(d => ({ ...d, score: simScore(s, d.smiles) })).filter(d => d.score > 0.22).sort((a, b) => b.score - a.score).slice(0, 2)

  let riskScore = 0
  const riskReasons = []
  groups.filter(g => g.risk === 'high').forEach(a => { riskScore += 3; riskReasons.push({ text: `${a.label} — reactive metabolite / genotoxicity risk`, sev: 'high' }) })
  groups.filter(g => g.risk === 'moderate').forEach(a => { riskScore += 1.5; riskReasons.push({ text: `${a.label} — moderate toxicity concern`, sev: 'moderate' }) })
  if (+logP > 5)           { riskScore += 2; riskReasons.push({ text: `High LogP (${logP}) — bioaccumulation in lipid-rich tissues`, sev: 'high' }) }
  else if (+logP > 3)        riskReasons.push({ text: `Moderate LogP (${logP}) — good membrane permeability`, sev: 'low' })
  if (mw > 500)            { riskScore += 1; riskReasons.push({ text: `High MW (${mw} Da) — Lipinski violation, reduced oral absorption`, sev: 'moderate' }) }
  if (aromaticRings >= 3)  { riskScore += 2; riskReasons.push({ text: `${aromaticRings} aromatic rings — CYP-mediated epoxidation / arene oxide risk`, sev: 'high' }) }
  if (clCount + brCount >= 3) { riskScore += 2; riskReasons.push({ text: `${clCount + brCount} halogens — environmental persistence and bioaccumulation`, sev: 'high' }) }
  if (tpsa < 40 && +logP > 3) riskReasons.push({ text: `Low TPSA (${tpsa} A2) + high LogP — elevated CNS penetration`, sev: 'moderate' })

  const riskLevel = riskScore >= 6 ? 'High' : riskScore >= 3 ? 'Moderate' : 'Low'
  const riskColor = riskLevel === 'High' ? '#ef4444' : riskLevel === 'Moderate' ? '#f97316' : '#22c55e'

  const studentLines = []
  if (aromaticRings > 0) studentLines.push(`This molecule has ${aromaticRings} aromatic ring${aromaticRings > 1 ? 's' : ''} — flat, stable benzene-like structures common in drugs and dyes.`)
  if (groups.some(g => g.id === 'amide'))      studentLines.push(`It contains an amide bond (–CO–NH–), the same bond that links amino acids together in proteins.`)
  if (groups.some(g => g.id === 'ester'))      studentLines.push(`The ester group (–COO–) is often found in prodrugs — molecules activated inside the body by enzymes.`)
  if (groups.some(g => g.id === 'nitro'))      studentLines.push(`The nitro group (–NO2) is a red flag: the body can convert it into reactive chemicals that damage DNA.`)
  if (groups.some(g => g.id === 'arom_amine')) studentLines.push(`Aromatic amines (–NH2 on a ring) are known carcinogens — they form DNA adducts after metabolic activation by CYP1A2.`)
  if (+logP > 4) studentLines.push(`With a high LogP (${logP}), this molecule is very fat-soluble — it can accumulate in fatty tissues including the brain.`)
  if (lipinskiViol === 0) studentLines.push(`It passes all 4 Lipinski rules — good predicted oral bioavailability if taken as a pill.`)
  else studentLines.push(`It breaks ${lipinskiViol} Lipinski rule${lipinskiViol > 1 ? 's' : ''}, which may reduce oral absorption.`)
  if (studentLines.length < 2) studentLines.push(`No major structural red flags detected — a relatively clean molecular profile for drug development.`)

  return { groups, aromaticRings, aliphRings, totalRings, heavyAtoms, mw, logP: +logP, hbd, hba, tpsa, rotBonds, lipinskiViol, riskLevel, riskColor, riskScore: Math.round(riskScore), riskReasons: riskReasons.slice(0, 6), exactMatch, similar, studentLines }
}

function Section({ icon: Icon, iconColor, iconBg, title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.015)' }}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2.5 px-4 py-3 text-left"
        style={{ background: open ? 'rgba(255,255,255,0.025)' : 'transparent' }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.035)'}
        onMouseLeave={e => e.currentTarget.style.background = open ? 'rgba(255,255,255,0.025)' : 'transparent'}>
        <div className="p-1.5 rounded-lg flex-shrink-0" style={{ background: iconBg }}>
          <Icon size={12} style={{ color: iconColor }} />
        </div>
        <span className="text-[12px] font-semibold flex-1" style={{ color: '#e2e8f0' }}>{title}</span>
        {open ? <ChevronUp size={11} style={{ color: 'rgba(100,116,139,0.45)' }} /> : <ChevronDown size={11} style={{ color: 'rgba(100,116,139,0.45)' }} />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }} className="overflow-hidden">
            <div className="px-4 pb-4 pt-2 space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function PropRow({ label, value, note, flag }) {
  const s = RISK_SEV[flag] || {}
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: flag ? s.bg : 'rgba(255,255,255,0.025)', border: `1px solid ${flag ? s.border : 'rgba(255,255,255,0.05)'}` }}>
      <p className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: 'rgba(100,116,139,0.6)' }}>{label}</p>
      <p className="text-[12px] font-bold font-mono" style={{ color: flag ? s.text : '#cbd5e1' }}>{value}</p>
      {note && <p className="text-[10px] mt-0.5 leading-snug" style={{ color: 'rgba(148,163,184,0.65)' }}>{note}</p>}
    </div>
  )
}

export default function MoleculeAnalysis({ smiles, result }) {
  const data = useMemo(() => analyseSMILES(smiles), [smiles])
  if (!data || !smiles) return null

  const { groups, aromaticRings, aliphRings, totalRings, heavyAtoms, mw, logP, hbd, hba, tpsa, rotBonds, lipinskiViol, riskLevel, riskColor, riskScore, riskReasons, exactMatch, similar, studentLines } = data

  const feat = result?.features || {}
  const dispMW   = feat.MolWeight ?? mw
  const dispLogP = feat.LogP      ?? logP
  const dispTPSA = feat.TPSA      ?? tpsa
  const dispHBD  = feat.HBD       ?? hbd
  const dispHBA  = feat.HBA       ?? hba
  const dispRot  = feat.RotBonds  ?? rotBonds
  const dispQED  = feat.QED != null ? feat.QED.toFixed(3) : null

  const lipPass   = lipinskiViol === 0
  const riskEmoji = riskLevel === 'High' ? '🔴' : riskLevel === 'Moderate' ? '🟠' : '🟢'

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
      className="glass p-5 space-y-3" style={{ border: '1px solid rgba(56,189,248,0.1)' }}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg" style={{ background: 'rgba(56,189,248,0.1)' }}>
            <Microscope size={13} style={{ color: '#38bdf8' }} />
          </div>
          <div>
            <span className="text-sm font-bold" style={{ color: '#e2e8f0' }}>Molecule Analysis</span>
            <p className="text-[10px]" style={{ color: 'rgba(100,116,139,0.6)' }}>Pharmaceutical Research · SMILES Interpretation</p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full"
          style={{ background: `${riskColor}18`, border: `1px solid ${riskColor}33`, color: riskColor }}>
          {riskEmoji} {riskLevel} Risk
        </span>
      </div>

      {/* 1. Structural Insights */}
      <Section icon={Atom} iconColor="#a78bfa" iconBg="rgba(139,92,246,0.1)" title="1. Structural Insights">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {aromaticRings > 0 && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', color: '#a78bfa' }}>{aromaticRings} aromatic ring{aromaticRings > 1 ? 's' : ''}</span>}
            {aliphRings > 0    && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(14,165,233,0.08)',  border: '1px solid rgba(14,165,233,0.2)',  color: '#38bdf8' }}>{aliphRings} aliphatic ring{aliphRings > 1 ? 's' : ''}</span>}
            {totalRings === 0  && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.15)', color: '#94a3b8' }}>Acyclic (no rings)</span>}
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.12)', color: '#94a3b8' }}>{heavyAtoms} heavy atoms</span>
          </div>
          {groups.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(100,116,139,0.55)' }}>Functional Groups ({groups.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {groups.map(g => (
                  <motion.span key={g.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: `${g.color}12`, border: `1px solid ${g.color}30`, color: g.color }}>
                    {g.label}
                  </motion.span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[11px]" style={{ color: 'rgba(148,163,184,0.6)' }}>No major functional groups detected — simple hydrocarbon-like scaffold.</p>
          )}
        </div>
      </Section>

      {/* 2. Physicochemical */}
      <Section icon={FlaskConical} iconColor="#38bdf8" iconBg="rgba(14,165,233,0.1)" title="2. Physicochemical Interpretation">
        <div className="grid grid-cols-2 gap-1.5">
          <PropRow label="Mol. Weight" value={`${dispMW} Da`} note={dispMW > 500 ? 'Lipinski violation (>500 Da)' : 'Within drug-like range'} flag={dispMW > 500 ? 'high' : dispMW > 400 ? 'moderate' : null} />
          <PropRow label="LogP" value={dispLogP} note={dispLogP > 5 ? 'High lipophilicity — bioaccumulation risk' : dispLogP < 0 ? 'Hydrophilic — low membrane permeability' : 'Balanced lipophilicity'} flag={dispLogP > 5 ? 'high' : dispLogP > 3 ? 'moderate' : null} />
          <PropRow label="TPSA" value={`${dispTPSA} A2`} note={dispTPSA > 140 ? 'Poor oral absorption predicted' : dispTPSA < 40 ? 'High CNS penetration risk' : 'Good oral absorption window'} flag={dispTPSA > 140 ? 'high' : (dispTPSA < 40 && dispLogP > 3) ? 'moderate' : null} />
          <PropRow label="H-Bond Donors" value={dispHBD} note={dispHBD > 5 ? 'Lipinski violation (>5)' : 'Acceptable'} flag={dispHBD > 5 ? 'high' : null} />
          <PropRow label="H-Bond Acceptors" value={dispHBA} note={dispHBA > 10 ? 'Lipinski violation (>10)' : 'Acceptable'} flag={dispHBA > 10 ? 'high' : null} />
          <PropRow label="Rotatable Bonds" value={dispRot} note={dispRot > 10 ? 'High flexibility — reduced oral bioavailability' : 'Good conformational rigidity'} flag={dispRot > 10 ? 'moderate' : null} />
          {dispQED && <PropRow label="QED (Drug-likeness)" value={dispQED} note={+dispQED > 0.7 ? 'Excellent drug-likeness' : +dispQED > 0.4 ? 'Moderate drug-likeness' : 'Poor drug-likeness'} flag={+dispQED < 0.3 ? 'moderate' : null} />}
        </div>
      </Section>

      {/* 3. Lipinski */}
      <Section icon={Scale} iconColor="#fbbf24" iconBg="rgba(234,179,8,0.1)" title="3. Drug-likeness — Lipinski Ro5">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {lipPass ? <ShieldCheck size={14} style={{ color: '#4ade80' }} /> : <ShieldAlert size={14} style={{ color: '#f87171' }} />}
            <span className="text-[12px] font-bold" style={{ color: lipPass ? '#4ade80' : '#f87171' }}>
              {lipPass ? 'Passes all 4 Lipinski rules' : `${lipinskiViol} violation${lipinskiViol > 1 ? 's' : ''} detected`}
            </span>
          </div>
          {[
            { rule: 'MW <= 500 Da',          pass: dispMW <= 500,   val: `${dispMW} Da` },
            { rule: 'LogP <= 5',             pass: dispLogP <= 5,   val: `LogP = ${dispLogP}` },
            { rule: 'H-Bond Donors <= 5',    pass: dispHBD <= 5,    val: `HBD = ${dispHBD}` },
            { rule: 'H-Bond Acceptors <= 10',pass: dispHBA <= 10,   val: `HBA = ${dispHBA}` },
          ].map(({ rule, pass, val }) => (
            <div key={rule} className="flex items-center gap-2.5 rounded-lg px-3 py-2"
              style={{ background: pass ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)', border: `1px solid ${pass ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}` }}>
              <span className="text-sm">{pass ? '✅' : '❌'}</span>
              <span className="text-[11px] flex-1" style={{ color: 'rgba(203,213,225,0.85)' }}>{rule}</span>
              <span className="text-[10px] font-mono" style={{ color: pass ? '#4ade80' : '#f87171' }}>{val}</span>
            </div>
          ))}
          <p className="text-[10px] leading-relaxed pt-1" style={{ color: 'rgba(100,116,139,0.6)' }}>
            Lipinski Ro5 predicts oral bioavailability. Violations suggest the compound may need formulation strategies or alternative delivery routes.
          </p>
        </div>
      </Section>

      {/* 4. Toxicity Risk */}
      <Section icon={riskLevel === 'Low' ? ShieldCheck : ShieldAlert} iconColor={riskColor} iconBg={`${riskColor}18`} title="4. Toxicity Risk Assessment">
        <div className="space-y-2">
          <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: `${riskColor}0d`, border: `1px solid ${riskColor}25` }}>
            <span className="text-2xl">{riskEmoji}</span>
            <div>
              <p className="text-[13px] font-black" style={{ color: riskColor }}>{riskLevel} Risk</p>
              <p className="text-[10px]" style={{ color: 'rgba(148,163,184,0.7)' }}>Risk score: {riskScore} / 15 · Structural alerts + physicochemical flags</p>
            </div>
          </div>
          {riskReasons.map((r, i) => {
            const sv = RISK_SEV[r.sev] || RISK_SEV.low
            return (
              <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                className="flex gap-2 rounded-lg px-3 py-2" style={{ background: sv.bg, border: `1px solid ${sv.border}` }}>
                <div className="w-1 rounded-full flex-shrink-0 mt-1" style={{ background: sv.text, minHeight: 10 }} />
                <p className="text-[11px] leading-relaxed" style={{ color: sv.text }}>{r.text}</p>
              </motion.div>
            )
          })}
        </div>
      </Section>

      {/* 5. Drug Similarity */}
      <Section icon={BookOpen} iconColor="#fb923c" iconBg="rgba(251,146,60,0.1)" title="5. Real-world Drug Similarity" defaultOpen={false}>
        <div className="space-y-2">
          {exactMatch ? (
            <div className="rounded-xl p-3" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.18)' }}>
              <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'rgba(34,197,94,0.6)' }}>Exact match</p>
              <p className="text-[13px] font-bold" style={{ color: '#4ade80' }}>{exactMatch.name}</p>
              <p className="text-[11px]" style={{ color: 'rgba(148,163,184,0.8)' }}>{exactMatch.cls}</p>
            </div>
          ) : similar.length > 0 ? similar.map((d, i) => (
            <motion.div key={d.name} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              className="rounded-xl p-3" style={{ background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.15)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-bold" style={{ color: '#38bdf8' }}>{d.name}</p>
                  <p className="text-[10px]" style={{ color: 'rgba(148,163,184,0.7)' }}>{d.cls}</p>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full" style={{ background: 'rgba(56,189,248,0.1)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.2)' }}>
                  ~{Math.round(d.score * 100)}% similar
                </span>
              </div>
            </motion.div>
          )) : (
            <p className="text-[11px]" style={{ color: 'rgba(100,116,139,0.6)' }}>No close structural matches found in the reference database. This may be a novel scaffold.</p>
          )}
        </div>
      </Section>

      {/* 6. Student Explanation */}
      <Section icon={GraduationCap} iconColor="#c084fc" iconBg="rgba(192,132,252,0.1)" title="6. Simple Explanation for Students" defaultOpen={false}>
        <div className="space-y-2">
          {studentLines.map((line, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="flex gap-2.5 rounded-xl p-3" style={{ background: 'rgba(192,132,252,0.05)', border: '1px solid rgba(192,132,252,0.12)' }}>
              <span className="text-sm flex-shrink-0">💡</span>
              <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(196,181,253,0.9)' }}>{line}</p>
            </motion.div>
          ))}
        </div>
      </Section>
    </motion.div>
  )
}
