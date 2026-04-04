import { motion } from 'framer-motion'
import { BookOpen, ExternalLink, AlertTriangle, CheckCircle, Info } from 'lucide-react'

// ── Compound database ─────────────────────────────────────────
const COMPOUND_DB = {
  'CC(=O)Oc1ccccc1C(=O)O': {
    name: 'Aspirin',
    iupac: '2-acetoxybenzoic acid',
    formula: 'C₉H₈O₄',
    cas: '50-78-2',
    pubchem: 2244,
    category: 'NSAID / Analgesic',
    description: 'One of the most widely used medications in the world. Acts as an anti-inflammatory, analgesic, and antipyretic by irreversibly inhibiting COX-1 and COX-2 enzymes.',
    uses: ['Pain relief', 'Fever reduction', 'Anti-inflammatory', 'Antiplatelet (low dose)'],
    hazards: ['GI irritation at high doses', 'Reye\'s syndrome risk in children'],
    solubility: 'Slightly soluble in water (3 g/L at 20°C)',
    meltingPoint: '135°C',
    appearance: 'White crystalline powder',
  },
  'CN1C=NC2=C1C(=O)N(C(=O)N2C)C': {
    name: 'Caffeine',
    iupac: '1,3,7-trimethyl-3,7-dihydro-1H-purine-2,6-dione',
    formula: 'C₈H₁₀N₄O₂',
    cas: '58-08-2',
    pubchem: 2519,
    category: 'Stimulant / Xanthine alkaloid',
    description: 'A central nervous system stimulant and the world\'s most widely consumed psychoactive substance. Found naturally in coffee, tea, and cacao. Blocks adenosine receptors.',
    uses: ['CNS stimulation', 'Alertness enhancement', 'Headache treatment', 'Neonatal apnea'],
    hazards: ['Anxiety at high doses', 'Insomnia', 'Dependence with regular use'],
    solubility: 'Soluble in water (21.7 g/L at 25°C)',
    meltingPoint: '235–238°C',
    appearance: 'White crystalline powder, odorless',
  },
  'CC(C)Cc1ccc(cc1)C(C)C(=O)O': {
    name: 'Ibuprofen',
    iupac: '(RS)-2-(4-(2-methylpropyl)phenyl)propanoic acid',
    formula: 'C₁₃H₁₈O₂',
    cas: '15687-27-1',
    pubchem: 3672,
    category: 'NSAID / Analgesic',
    description: 'A propionic acid derivative NSAID used for pain, fever, and inflammation. Inhibits both COX-1 and COX-2 enzymes, reducing prostaglandin synthesis.',
    uses: ['Pain relief', 'Fever reduction', 'Arthritis treatment', 'Dysmenorrhea'],
    hazards: ['GI bleeding risk', 'Cardiovascular risk at high doses', 'Renal impairment'],
    solubility: 'Practically insoluble in water (21 mg/L)',
    meltingPoint: '75–78°C',
    appearance: 'White to off-white crystalline powder',
  },
  'c1ccc(cc1)N': {
    name: 'Aniline',
    iupac: 'benzenamine',
    formula: 'C₆H₇N',
    cas: '62-53-3',
    pubchem: 6115,
    category: 'Aromatic amine / Industrial chemical',
    description: 'A primary aromatic amine used as a precursor in the manufacture of dyes, rubber, pharmaceuticals, and pesticides. Classified as a probable human carcinogen (Group 2A by IARC).',
    uses: ['Dye manufacturing', 'Rubber processing', 'Pharmaceutical synthesis', 'Polymer production'],
    hazards: ['Methemoglobinemia', 'Carcinogenic (IARC 2A)', 'Skin/eye irritant', 'Toxic by inhalation'],
    solubility: 'Miscible with most organic solvents; 36 g/L in water',
    meltingPoint: '−6.3°C',
    appearance: 'Colorless to pale yellow oily liquid',
  },
  'Clc1ccc(cc1Cl)c1cc(Cl)ccc1Cl': {
    name: 'PCB-47 (Polychlorinated Biphenyl)',
    iupac: "2,2',4,4'-tetrachlorobiphenyl",
    formula: 'C₁₂H₆Cl₄',
    cas: '2437-79-8',
    pubchem: 16889,
    category: 'Persistent organic pollutant',
    description: 'A polychlorinated biphenyl congener. PCBs are persistent environmental contaminants banned in most countries since the 1970s. Highly lipophilic and bioaccumulative in the food chain.',
    uses: ['Formerly: electrical insulators', 'Formerly: hydraulic fluids', 'Formerly: plasticizers'],
    hazards: ['Endocrine disruptor', 'Carcinogenic (IARC Group 1)', 'Bioaccumulative', 'Neurotoxic'],
    solubility: 'Practically insoluble in water; soluble in organic solvents',
    meltingPoint: '47–50°C',
    appearance: 'White crystalline solid',
  },
  'CC(=O)Nc1ccc(O)cc1': {
    name: 'Paracetamol (Acetaminophen)',
    iupac: 'N-(4-hydroxyphenyl)acetamide',
    formula: 'C₈H₉NO₂',
    cas: '103-90-2',
    pubchem: 1983,
    category: 'Analgesic / Antipyretic',
    description: 'One of the most commonly used over-the-counter medications worldwide. Acts centrally to reduce fever and pain. Unlike NSAIDs, has minimal anti-inflammatory activity.',
    uses: ['Pain relief', 'Fever reduction', 'Osteoarthritis', 'Post-vaccination fever'],
    hazards: ['Hepatotoxic in overdose', 'Liver failure at high doses', 'Toxic metabolite NAPQI'],
    solubility: 'Soluble in water (14 g/L at 20°C)',
    meltingPoint: '168–172°C',
    appearance: 'White crystalline powder',
  },
  'ClCCl': {
    name: 'Dichloromethane (DCM)',
    iupac: 'dichloromethane',
    formula: 'CH₂Cl₂',
    cas: '75-09-2',
    pubchem: 6344,
    category: 'Halogenated solvent',
    description: 'A volatile chlorinated solvent widely used in paint stripping, pharmaceutical manufacturing, and chemical synthesis. Classified as a possible human carcinogen (IARC Group 2A).',
    uses: ['Paint stripping', 'Pharmaceutical solvent', 'Decaffeination', 'Chemical synthesis'],
    hazards: ['CNS depressant', 'Carcinogenic (IARC 2A)', 'Metabolized to CO', 'Skin/eye irritant'],
    solubility: 'Slightly soluble in water (20 g/L at 20°C)',
    meltingPoint: '−97°C',
    appearance: 'Colorless volatile liquid with sweet odor',
  },
  'CC12CCC3C(C1CCC2O)CCC4=CC(=O)CCC34C': {
    name: 'Testosterone',
    iupac: '17β-hydroxy-4-androsten-3-one',
    formula: 'C₁₉H₂₈O₂',
    cas: '58-22-0',
    pubchem: 6013,
    category: 'Androgen / Steroid hormone',
    description: 'The primary male sex hormone and an anabolic steroid. Produced mainly in the testes and adrenal glands. Regulates development of male reproductive tissues and secondary sexual characteristics.',
    uses: ['Hypogonadism treatment', 'Hormone replacement therapy', 'Delayed puberty', 'Muscle wasting conditions'],
    hazards: ['Liver toxicity (oral forms)', 'Cardiovascular risk', 'Hormonal disruption', 'Abuse potential'],
    solubility: 'Practically insoluble in water; soluble in ethanol',
    meltingPoint: '155°C',
    appearance: 'White or creamy-white crystalline powder',
  },
}

// ── Hazard badge ──────────────────────────────────────────────
function HazardBadge({ text }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full
                     bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400
                     border border-red-200 dark:border-red-500/20">
      <AlertTriangle size={9} /> {text}
    </span>
  )
}

function UseBadge({ text }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full
                     bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400
                     border border-green-200 dark:border-green-500/20">
      <CheckCircle size={9} /> {text}
    </span>
  )
}

export default function CompoundInfo({ smiles, compoundInfo }) {
  // Prefer live backend data, fall back to local DB
  const dbInfo = COMPOUND_DB[smiles?.trim()]

  // If we have backend compound_info, show a streamlined panel
  if (compoundInfo?.cid || compoundInfo?.iupac_name || compoundInfo?.description) {
    const ci = compoundInfo
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass p-5 space-y-4"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-brand-500/10 dark:bg-brand-500/20">
              <BookOpen size={14} className="text-brand-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {(ci.synonyms?.[0]) || ci.name || ci.iupac_name || 'Compound'}
              </h3>
              <p className="text-[10px] text-slate-400">
                {ci.cid ? `PubChem CID: ${ci.cid}` : 'External Research Compound'}
              </p>
            </div>
          </div>
          {(ci.cid || ci.sourceUrl) && (
            <a
              href={ci.sourceUrl || `https://pubchem.ncbi.nlm.nih.gov/compound/${ci.cid}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] text-brand-500 hover:text-brand-400
                         bg-brand-500/10 px-2 py-1 rounded-lg transition-colors shadow-sm"
            >
              {ci.sourceUrl ? 'View Source' : 'PubChem'} <ExternalLink size={9} />
            </a>
          )}
        </div>

        {ci.description && (
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed italic">
              "{ci.description}"
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {[
            ['Formula',    ci.formula],
            ['MW',         ci.molecular_weight ? `${ci.molecular_weight} Da` : '—'],
            ['IUPAC Name', ci.iupac_name],
            ['CAS',        ci.cas ?? '—'],
          ].map(([k, v]) => (
            <div key={k} className="bg-slate-50 dark:bg-white/5 rounded-lg px-3 py-2">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">{k}</p>
              <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{v || '—'}</p>
            </div>
          ))}
        </div>

        {ci.synonyms?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {ci.synonyms.slice(0, 10).map(s => (
              <span key={s} className="text-[10px] bg-brand-500/10 text-brand-600 dark:text-brand-400
                                       px-2 py-0.5 rounded-full">{s}</span>
            ))}
          </div>
        )}
      </motion.div>
    )
  }

  // Fall back to local DB info
  const info = dbInfo

  if (!info) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass p-5 space-y-3"
      >
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/10">
            <Info size={14} className="text-slate-500" />
          </div>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Compound Information
          </span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Detailed information is available for the example compounds.
          Try Aspirin, Caffeine, Ibuprofen, Paracetamol, Aniline, PCB, Dichloromethane, or Testosterone.
        </p>
        <div className="grid grid-cols-2 gap-2 pt-1">
          {[
            ['SMILES', smiles],
            ['Formula', 'Unknown'],
            ['CAS', 'Unknown'],
            ['Category', 'Custom compound'],
          ].map(([k, v]) => (
            <div key={k} className="bg-slate-50 dark:bg-white/5 rounded-lg px-3 py-2">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">{k}</p>
              <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{v}</p>
            </div>
          ))}
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass p-5 space-y-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-brand-500/10 dark:bg-brand-500/20">
            <BookOpen size={14} className="text-brand-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              {info.name}
            </h3>
            <p className="text-[10px] text-slate-400">{info.category}</p>
          </div>
        </div>
        {info.pubchem && (
          <a
            href={`https://pubchem.ncbi.nlm.nih.gov/compound/${info.pubchem}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] text-brand-500 hover:text-brand-400
                       bg-brand-500/10 px-2 py-1 rounded-lg transition-colors"
          >
            PubChem <ExternalLink size={9} />
          </a>
        )}
      </div>

      {/* Description */}
      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
        {info.description}
      </p>

      {/* Key properties grid */}
      <div className="grid grid-cols-2 gap-2">
        {[
          ['Formula',       info.formula],
          ['CAS Number',    info.cas],
          ['IUPAC Name',    info.iupac],
          ['Appearance',    info.appearance],
          ['Melting Point', info.meltingPoint],
          ['Solubility',    info.solubility],
        ].map(([k, v]) => (
          <motion.div
            key={k}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-slate-50 dark:bg-white/5 rounded-lg px-3 py-2 col-span-1
                       last:col-span-2"
          >
            <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">{k}</p>
            <p className="text-xs font-medium text-slate-700 dark:text-slate-200">{v}</p>
          </motion.div>
        ))}
      </div>

      {/* Uses */}
      <div className="space-y-1.5">
        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">
          Medical / Industrial Uses
        </p>
        <div className="flex flex-wrap gap-1.5">
          {info.uses.map(u => <UseBadge key={u} text={u} />)}
        </div>
      </div>

      {/* Hazards */}
      <div className="space-y-1.5">
        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">
          Known Hazards
        </p>
        <div className="flex flex-wrap gap-1.5">
          {info.hazards.map(h => <HazardBadge key={h} text={h} />)}
        </div>
      </div>
    </motion.div>
  )
}
