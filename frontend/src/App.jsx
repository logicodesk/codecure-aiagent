import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Moon, Sun, Zap, Activity } from 'lucide-react'

import Logo from './components/Logo'
// import MoleculeBackground from './components/MoleculeBackground'
import IdleHero from './components/IdleHero'
import Card3D from './components/Card3D'
import InputCard from './components/InputCard'
import DrugSearch from './components/DrugSearch'
import Loader from './components/Loader'
import ResultCard from './components/ResultCard'
import InsightBox from './components/InsightBox'
import FeatureChart from './components/FeatureChart'
import MultiTargetPanel from './components/MultiTargetPanel'
import ChatHistory from './components/ChatHistory'
import MolViewer3D from './components/MolViewer3D'
import CompoundInfo from './components/CompoundInfo'
import DrugLikinessPanel from './components/DrugLikinessPanel'
import VoiceAssistant from './components/VoiceAssistant'
import PharmacologyPanel from './components/PharmacologyPanel'
import MoleculeAnalysis from './components/MoleculeAnalysis'
import MolImage2D from './components/MolImage2D'
import BatchAnalysis from './components/BatchAnalysis'
import ReportDownload from './components/ReportDownload'
import SHAPExplanation from './components/SHAPExplanation'
import ProbabilityChart from './components/ProbabilityChart'
import DrugComparison from './components/DrugComparison'
import CompoundAnalyzer from './components/CompoundAnalyzer'
import AmesMutagenicityPanel from './components/AmesMutagenicityPanel'
import ToxicophoreHighlight from './components/ToxicophoreHighlight'
import OrganToxicityPanel from './components/OrganToxicityPanel'
import AtomSaliencyMap from './components/AtomSaliencyMap'
import BioisosterePanel from './components/BioisosterePanel'
import NovelModalityPanel from './components/NovelModalityPanel'
import SimilarMoleculesPanel from './components/SimilarMoleculesPanel'
import TraceabilityReport from './components/TraceabilityReport'
import { predictToxicity, fetchExamples } from './lib/mockApi'
import { APP_NAME, FOOTER_TEXT } from './brand'

const VIEWS = ['Summary', 'Detailed', 'Multi-Target', '3D Structure', '2D Structure']
const INPUT_MODES = ['SMILES', 'Drug Name', '🎤 Voice AI']

export default function App() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('theme')
    if (saved) return saved === 'dark'
    return true // default dark
  })
  const [state, setState] = useState('idle')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])
  const [view, setView] = useState('Summary')
  const [examples, setExamples] = useState([])
  const [inputMode, setInputMode] = useState('SMILES')
  const [activeDrugName, setActiveDrugName] = useState(null)

  useEffect(() => {
    // dark-first: use 'dark' class on html, 'light' class for light mode
    document.documentElement.classList.toggle('dark', dark)
    document.documentElement.classList.toggle('light', !dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  useEffect(() => { fetchExamples().then(setExamples) }, [])

  const handleSubmit = useCallback(async (smilesInput) => {
    setState('loading')
    setResult(null)
    setError('')
    setView('Summary')
    setActiveDrugName(null)
    try {
      const res = await predictToxicity(smilesInput)
      setResult(res)
      setState('result')
      setHistory(h => [{
        id: Date.now(),
        smiles: smilesInput,
        result: res,
        timestamp: Date.now(),
      }, ...h].slice(0, 20))
    } catch (e) {
      setError(e.message || 'Prediction failed')
      setState('error')
    }
  }, [])

  // Called by DrugSearch after lookup + prediction
  const handleDrugResult = useCallback((prediction, drugInfo) => {
    setResult(prediction)
    setState('result')
    setView('Summary')
    setActiveDrugName(drugInfo?.name || null)
    setHistory(h => [{
      id: Date.now(),
      smiles: prediction.smiles,
      result: prediction,
      drugName: drugInfo?.name,
      timestamp: Date.now(),
    }, ...h].slice(0, 20))
  }, [])

  // ── AI Intelligence: Natural Language Command Handler ──
  const handleNaturalLanguageCommand = useCallback(async (text) => {
    if (!text) return
    const cmd = text.toLowerCase()

    // 1. Theme Toggle
    if (cmd.includes('dark mode') || cmd.includes('light mode') || cmd.includes('switch theme') || cmd.includes('toggle theme')) {
      setDark(prev => !prev)
      return true
    }

    // 2. Reset / Clear
    if (cmd.includes('reset') || cmd.includes('clear') || cmd.includes('start over')) {
      setState('idle')
      setResult(null)
      setError('')
      setActiveDrugName(null)
      return true
    }

    // 3. Navigation / View
    if (cmd.includes('show summary') || cmd.includes('overview') || cmd.includes('summary')) { setView('Summary'); return true }
    if (cmd.includes('show detailed') || cmd.includes('show details') || cmd.includes('detail')) { setView('Detailed'); return true }
    if (cmd.includes('show 3d') || cmd.includes('three d') || cmd.includes('3d structure')) { setView('3D Structure'); return true }
    if (cmd.includes('show 2d') || cmd.includes('two d') || cmd.includes('2d structure')) { setView('2D Structure'); return true }
    if (cmd.includes('maximize') || cmd.includes('expand')) {
       // If organ or toxicity mentioned
       if (cmd.includes('organ')) {
         setView('Detailed')
         return true
       }
    }

    // 4. Analysis commands: "Analyze [drug]", "Check [drug]"
    const analyzeMatch = cmd.match(/(?:analyze|check|search for|look at|predict)\s+([a-z0-9\-]+)/i)
    if (analyzeMatch && analyzeMatch[1]) {
      const target = analyzeMatch[1].trim()
      handleSubmit(target)
      return true
    }

    // 5. Special prompt responses (from ChatHistory)
    if (cmd.includes('explain why') || cmd.includes('reason for toxicity') || cmd.includes('why toxic?')) {
       if (state === 'result') {
         setView('Detailed')
         return true
       }
    }
    
    if (cmd.includes('safer structural') || cmd.includes('alternatives') || cmd.includes('bioisostere')) {
       if (state === 'result' && result?.toxic) {
         setView('Detailed')
         return true
       }
    }

    if (cmd.includes('compare')) {
       // This could eventually trigger the DrugComparison component
       // For now, let's just show Detailed view where comparisons might be visible
       setView('Detailed')
       return true
    }

    // 6. Generic search fallback
    // If it's a short alphanumeric string, try to search it
    const searchMatch = cmd.match(/^(?:search|find|lookup)?\s*([a-z0-9\-]{2,15})$/i)
    if (searchMatch && searchMatch[1]) {
       handleSubmit(searchMatch[1])
       return true
    }

    return false // No command caught
  }, [handleSubmit, state, result])


  // Called by VoiceAssistant after a voice query completes
  const handleVoiceResult = useCallback((prediction, drugName, rawText) => {
    // Check for UI commands first
    if (rawText && handleNaturalLanguageCommand(rawText)) {
      return 
    }
    if (!prediction) return
    setResult(prediction)
    setState('result')
    setView('Summary')
    setActiveDrugName(drugName || null)
    setHistory(h => [{
      id: Date.now(),
      smiles: prediction.smiles,
      result: prediction,
      drugName: drugName || null,
      timestamp: Date.now(),
    }, ...h].slice(0, 20))
  }, [handleNaturalLanguageCommand])

  // Called by suggested prompt chips in ChatHistory
  const handlePromptSelect = useCallback((query) => {
    // If it's a command, execute it directly
    handleNaturalLanguageCommand(query)
  }, [handleNaturalLanguageCommand])

  // Called by IdleHero demo buttons
  const handleDemoClick = useCallback(async (drugName, smiles) => {
    setState('loading')
    setResult(null)
    setError('')
    setView('Summary')
    setActiveDrugName(drugName)
    try {
      const res = await predictToxicity(smiles)
      setResult(res)
      setState('result')
      setHistory(h => [{
        id: Date.now(),
        smiles: smiles,
        result: res,
        drugName: drugName,
        timestamp: Date.now(),
      }, ...h].slice(0, 20))
    } catch (e) {
      setError(e.message || 'Prediction failed')
      setState('error')
    }
  }, [])

  return (
    <div className="min-h-screen flex flex-col above-canvas">
      {/* <MoleculeBackground /> */}

      {/* ── Header ── */}
      <motion.header
        initial={{ opacity: 0, y: -28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 22 }}
        className="sticky top-0 z-50"
        style={{
          background: dark
            ? 'rgba(6,9,18,0.88)'
            : 'rgba(248,250,252,0.90)',
          backdropFilter: 'blur(24px) saturate(200%)',
          WebkitBackdropFilter: 'blur(24px) saturate(200%)',
          borderBottom: dark
            ? '1px solid rgba(14,165,233,0.12)'
            : '1px solid rgba(0,0,0,0.07)',
          boxShadow: dark
            ? '0 1px 0 rgba(14,165,233,0.08), 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)'
            : '0 1px 0 rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.06)',
        }}
      >
        {/* Animated top border line */}
        <motion.div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{
            background: 'linear-gradient(90deg, transparent, #0ea5e9, #06b6d4, #8b5cf6, transparent)',
          }}
          animate={{ opacity: [0.4, 0.9, 0.4] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />

        <div className="max-w-6xl mx-auto px-5 h-18 flex items-center justify-between"
             style={{ height: 68 }}>
          <Logo dark={dark} size="sm" />

          <div className="flex items-center gap-3">
            {/* Live status */}
            <motion.div
              whileHover={{ scale: 1.05, y: -1 }}
              className="hidden sm:flex items-center gap-2 stat-pill"
              style={{ fontSize: 12, padding: '6px 12px' }}
            >
              <span className="neon-dot" />
              <span className="font-semibold">Live</span>
              <span className="opacity-30">·</span>
              <Zap size={11} className="text-brand-400" />
              <span>1777 features</span>
            </motion.div>

            {/* Activity indicator */}
            <motion.div
              whileHover={{ scale: 1.05, y: -1 }}
              className="hidden md:flex items-center gap-1.5 stat-pill"
              style={{ fontSize: 12, padding: '6px 12px' }}
            >
              <Activity size={11} className="text-purple-400" />
              <span className="font-semibold">Tox21 · RDKit</span>
            </motion.div>

            {/* Theme toggle */}
            <motion.button
              whileHover={{ scale: 1.1, rotateZ: 15 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setDark(d => !d)}
              className="p-2.5 rounded-xl transition-colors"
              style={{
                background: dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
                border: dark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.09)',
                color: dark ? '#94a3b8' : '#64748b',
                boxShadow: dark ? '0 2px 8px rgba(0,0,0,0.3)' : '0 1px 4px rgba(0,0,0,0.08)',
              }}
              aria-label="Toggle theme"
            >
              {dark ? <Sun size={14} /> : <Moon size={14} />}
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* ── Main ── */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.65fr] gap-6">

          {/* ── Left column ── */}
          <div className="space-y-4">
            {/* Hero text — 3D depth on hover */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="space-y-3"
              style={{ transformStyle: 'preserve-3d' }}
            >
              <div className="flex items-center gap-2">
                <span className="section-label">Molecular Intelligence</span>
                <motion.span
                  whileHover={{ scale: 1.08, y: -1 }}
                  className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }}>
                  <span className="neon-dot" style={{ width: 5, height: 5 }} /> AI Ready
                </motion.span>
              </div>

              <h1 className="text-[2rem] font-extrabold leading-tight tracking-tight"
                  style={{
                    color: dark ? '#f1f5f9' : '#0f172a',
                    textShadow: dark ? '0 2px 20px rgba(14,165,233,0.15)' : 'none',
                  }}>
                Predict molecular<br />
                  <span className="gradient-text"
                      style={{ display: 'inline-block' }}>
                  toxicity with AI
                </span>
              </h1>

              <p className="text-sm leading-relaxed"
                 style={{ color: dark ? 'rgba(148,163,184,0.8)' : '#64748b' }}>
                Enter a SMILES string for instant toxicity predictions across
                12 biological targets using ensemble ML models trained on Tox21.
              </p>

              {/* 3D Stats row */}
              <div className="flex flex-wrap gap-2 pt-1">
                {[
                  ['12', 'Tox21 targets', '#0ea5e9'],
                  ['1777', 'Features', '#8b5cf6'],
                  ['7831', 'Training samples', '#06b6d4'],
                ].map(([n, l, c], i) => (
                  <motion.div
                    key={l}
                    className="stat-pill"
                    whileHover={{
                      scale: 1.08, y: -3,
                      boxShadow: `0 8px 20px ${c}30`,
                      borderColor: `${c}50`,
                    }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + i * 0.07, type: 'spring' }}
                    style={{ cursor: 'default' }}
                  >
                    <span className="font-bold" style={{ color: c }}>{n}</span>
                    <span>{l}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
              {/* Input mode toggle */}
              <div className="flex gap-1 p-1 rounded-xl mb-3"
                   style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', width: 'fit-content' }}>
                {INPUT_MODES.map(m => (
                  <button
                    key={m}
                    onClick={() => setInputMode(m)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${inputMode === m ? 'active tab-btn' : 'tab-btn'}`}
                  >
                    {m === 'SMILES' ? '⚗ SMILES' : m === 'Drug Name' ? '🔍 Drug Name' : m}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {inputMode === 'SMILES' ? (
                  <motion.div key="smiles-input"
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                    <InputCard onSubmit={handleSubmit} loading={state === 'loading'} examples={examples} dark={dark} />
                  </motion.div>
                ) : inputMode === 'Drug Name' ? (
                  <motion.div key="drug-search"
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                    <DrugSearch
                      onResult={handleDrugResult}
                      onLoading={loading => loading ? setState('loading') : null}
                      dark={dark}
                    />
                  </motion.div>
                ) : (
                  <motion.div key="voice-ai"
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                    <VoiceAssistant onResult={handleVoiceResult} dark={dark} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
              <ChatHistory history={history} onClear={() => setHistory([])} dark={dark} onPromptSelect={handlePromptSelect} />
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
              <BatchAnalysis dark={dark} />
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }}>
              <DrugComparison dark={dark} />
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.30 }}>
              <CompoundAnalyzer dark={dark} />
            </motion.div>
          </div>

          {/* ── Right column ── */}
          <div className="space-y-4">
            <AnimatePresence mode="wait">

              {/* Idle */}
              {state === 'idle' && <IdleHero key="idle" dark={dark} onDemoClick={handleDemoClick} />}

              {/* Loading */}
              {state === 'loading' && <Loader key="loading" />}

              {/* Error */}
              {state === 'error' && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="glass p-6 text-center space-y-3"
                  style={{ border: '1px solid rgba(239,68,68,0.2)' }}
                >
                  <div className="w-10 h-10 rounded-full mx-auto flex items-center justify-center text-xl"
                       style={{ background: 'rgba(239,68,68,0.1)' }}>⚠️</div>
                  <p className="text-sm font-medium" style={{ color: '#f87171' }}>{error}</p>
                  <button
                    onClick={() => setState('idle')}
                    className="text-xs underline transition-colors"
                    style={{ color: dark ? '#64748b' : '#94a3b8' }}
                  >
                    Try again
                  </button>
                </motion.div>
              )}

              {/* Result */}
              {state === 'result' && result && (
                <motion.div key="result" className="space-y-4">
                  {/* View tabs */}
                  <div className="flex gap-1 p-1 rounded-xl"
                       style={{ background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                                border: dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)' }}>
                    {VIEWS.map(v => (
                      <motion.button
                        key={v}
                        onClick={() => setView(v)}
                        whileTap={{ scale: 0.96 }}
                        className={`tab-btn flex-1 ${view === v ? 'active' : ''}`}
                      >
                        {v}
                      </motion.button>
                    ))}
                  </div>

                  <Card3D>
                    <ResultCard result={result} dark={dark} />
                  </Card3D>
                  <div className="flex justify-end">
                    <ReportDownload result={result} drugName={activeDrugName} dark={dark} />
                  </div>

                  <AnimatePresence mode="wait">
                    {view === 'Summary' && (
                      <motion.div key="summary" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                        <InsightBox insight={result.insight} features={result.features} shap_top5={result.shap_top5} ai_text={result.ai_text} shap_explanation={result.shap_explanation} />
                        <ToxicophoreHighlight result={result} />
                        <AtomSaliencyMap result={result} />
                        <OrganToxicityPanel organToxicity={result.organ_toxicity} />
                        <BioisosterePanel result={result} onAnalyzeSwap={handleSubmit} />
                        <NovelModalityPanel novelModality={result.novel_modality} />
                        <SimilarMoleculesPanel result={result} onAnalyze={handleSubmit} />
                        <TraceabilityReport result={result} />
                        <ProbabilityChart probability={result.probability} confidence={result.confidence} toxic={result.toxic} />
                        <SHAPExplanation result={result} drugName={activeDrugName} />
                        {activeDrugName && (
                          <PharmacologyPanel drugName={activeDrugName} result={result} />
                        )}
                        <MoleculeAnalysis smiles={result.smiles} result={result} />
                        <AmesMutagenicityPanel smiles={result.smiles} />
                        <DrugLikinessPanel features={result.features} />
                        <CompoundInfo smiles={result.smiles} compoundInfo={result.compound_info} />
                      </motion.div>
                    )}
                    {view === 'Detailed' && (
                      <motion.div key="detailed" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                        <FeatureChart data={result.feature_importance} />
                        <InsightBox insight={result.insight} features={result.features} shap_top5={result.shap_top5} ai_text={result.ai_text} shap_explanation={result.shap_explanation} />
                      </motion.div>
                    )}
                    {view === 'Multi-Target' && (
                      <motion.div key="multi" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                        <MultiTargetPanel data={result.multi_target} />
                      </motion.div>
                    )}
                    {view === '3D Structure' && (
                      <motion.div key="3d" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                        <MolViewer3D smiles={result.smiles} toxic={result.toxic} result={result} />
                        <CompoundInfo smiles={result.smiles} />
                      </motion.div>
                    )}
                    {view === '2D Structure' && (
                      <motion.div key="2d" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                        <MolImage2D smiles={result.smiles} width={420} height={300} />
                        <CompoundInfo smiles={result.smiles} compoundInfo={result.compound_info} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="py-5 text-center text-[11px]"
              style={{
                borderTop: dark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.06)',
                color: dark ? 'rgba(100,116,139,0.6)' : '#94a3b8',
              }}>
        {FOOTER_TEXT}
      </footer>
    </div>
  )
}
