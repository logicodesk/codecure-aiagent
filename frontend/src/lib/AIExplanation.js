import { predictToxicity } from './mockApi'
import { resolveSmiles, fuzzyCorrect, correctDrugName } from './smilesResolver'

// ── Intent patterns ───────────────────────────────────────────
const STOP_WORDS = [
  'is', 'are', 'was', 'were', 'the', 'a', 'an', 'of', 'for', 'to', 'in', 'on', 'at', 'about',
  'explain', 'predict', 'analyze', 'check', 'show', 'give', 'me', 'details', 'tell', 'know',
  'what', 'how', 'why', 'when', 'where', 'which', 'who',
  'safe', 'toxic', 'toxicity', 'dangerous', 'danger',
  'compound', 'drug', 'medicine', 'molecule', 'chemical', 'structure'
]

export function detectIntent(text) {
  if (!text) return 'help'
  const t = text.toLowerCase()
  
  // High priority for comparison
  if (/\b(compare|versus|vs|difference|between|contrast)\b/i.test(t) || t.includes(' vs ') || t.includes(' versus ')) {
    return 'comparison'
  }

  for (const intent of INTENTS) {
    if (intent.patterns.some(p => p.test(t))) {
      return intent.type
    }
  }
  return 'predict' // default
}

const INTENTS = [
  { type: 'explain',  patterns: [/explain/i, /tell me about/i, /what is/i, /describe/i, /about/i] },
  { type: 'predict',  patterns: [/predict/i, /check/i, /analyze/i, /analyse/i, /test/i, /run/i] },
  { type: 'safe',     patterns: [/is .* safe/i, /safe\?/i, /safe to/i, /non.?toxic/i] },
  { type: 'toxic',    patterns: [/is .* toxic/i, /toxic\?/i, /toxicity of/i, /how toxic/i, /danger/i] },
  { type: 'compare',  patterns: [/compare/i, /vs\.?/i, /versus/i, /difference/i] },
  { type: 'help',     patterns: [/^help$/i, /what can you/i, /how do i/i, /commands/i] },
]

// ── Localization ─────────────────────────────────────────────
const TRANSLATIONS = {
  'en-US': {
    verdictSafe: (name, pct, risk) => `${name} is predicted NON-TOXIC (${100 - pct}% confidence, ${risk} risk).`,
    verdictToxic: (name, pct, risk) => `${name} is predicted TOXIC (${pct}% probability, ${risk} risk).`,
    confidenceNote: "Structural, mechanistic, and ML evidence converge on this classification.",
    uncertainNote: "Moderate confidence — experimental validation recommended.",
    classLabel: "Class", useLabel: "Primary Use", mechanismLabel: "Mechanism",
    metabolismLabel: "Metabolism", sourcesLabel: "Sources",
    helpText: "I'm ToxScout AI Research, your computational chemistry and toxicology assistant. Ask me things like: \"Is aspirin safe?\", \"Explain toxicity of ibuprofen\", or \"Predict caffeine toxicity\".",
  },
  'hi-IN': {
    verdictSafe: (name, pct, risk) => `${name} के गैर-विषाक्त (NON-TOXIC) होने की भविष्यवाणी की गई है (${100 - pct}% विश्वास, ${risk} जोखिम)।`,
    verdictToxic: (name, pct, risk) => `${name} के विषाक्त (TOXIC) होने की भविष्यवाणी की गई है (${pct}% संभावना, ${risk} जोखिम)।`,
    confidenceNote: "संरचनात्मक, यंत्रवत और मशीन लर्निंग साक्ष्य इस वर्गीकरण पर सहमत हैं।",
    uncertainNote: "मध्यम विश्वास — प्रयोगात्मक सत्यापन की सिफारिश की जाती है।",
    classLabel: "वर्ग", useLabel: "प्राथमिक उपयोग", mechanismLabel: "तंत्र",
    metabolismLabel: "चयापचय", sourcesLabel: "स्रोत",
    helpText: "मैं टॉक्सस्काउट एआई रिसर्च हूं, आपका कम्प्यूटेशनल केमिस्ट्री और टॉक्सिकोलॉजी सहायक। मुझसे पूछें: \"क्या एस्पिरिन सुरक्षित है?\", \"इबुप्रोफेन की विषाक्तता समझाएं\"।",
  },
  'es-ES': {
    verdictSafe: (name, pct, risk) => `Se predice que ${name} NO ES TÓXICO (${100 - pct}% de confianza, riesgo ${risk}).`,
    verdictToxic: (name, pct, risk) => `Se predice que ${name} es TÓXICO (${pct}% de probabilidad, riesgo ${risk}).`,
    confidenceNote: "La evidencia estructural, mecánica y de ML convergen en esta clasificación.",
    uncertainNote: "Confianza moderada — se recomienda validación experimental.",
    classLabel: "Clase", useLabel: "Uso primario", mechanismLabel: "Mecanismo",
    metabolismLabel: "Metabolismo", sourcesLabel: "Fuentes",
  },
  'fr-FR': {
    verdictSafe: (name, pct, risk) => `${name} est prédit NON TOXIQUE (${100 - pct}% de confiance, risque ${risk}).`,
    verdictToxic: (name, pct, risk) => `${name} est prédit TOXIQUE (${pct}% de probabilité, risque ${risk}).`,
    confidenceNote: "Les preuves structurelles, mécanistes et ML convergent sur cette classification.",
    uncertainNote: "Confiance modérée — validation expérimentale recommandée.",
  },
  'de-DE': {
    verdictSafe: (name, pct, risk) => `${name} wird als NICHT TOXISCH vorhergesagt (${100 - pct}% Vertrauen, ${risk} Risiko).`,
    verdictToxic: (name, pct, risk) => `${name} wird als TOXISCH vorhergesagt (${pct}% Wahrscheinlichkeit, ${risk} Risiko).`,
    confidenceNote: "Strukturelle, mechanistische und ML-Beweise stützen diese Klassifizierung.",
  },
  'zh-CN': {
    verdictSafe: (name, pct, risk) => `预测 ${name} 无毒 (置信度 ${100 - pct}%, ${risk} 风险)。`,
    verdictToxic: (name, pct, risk) => `预测 ${name} 有毒 (概率 ${pct}%, ${risk} 风险)。`,
  },
  'ja-JP': {
    verdictSafe: (name, pct, risk) => `${name} は非毒性と予測されます (信頼度 ${100 - pct}%, ${risk} リスク)。`,
    verdictToxic: (name, pct, risk) => `${name} は毒性があると予測されます (確率 ${pct}%, ${risk} リスク)。`,
  },
  'pt-BR': {
    verdictSafe: (name, pct, risk) => `${name} é previsto como NÃO TÓXICO (${100 - pct}% de confiança, risco ${risk}).`,
    verdictToxic: (name, pct, risk) => `${name} é previsto como TÓXICO (${pct}% de probabilidade, risco ${risk}).`,
  }
}

const LOCALIZED_STOP_WORDS = {
  'en-US': STOP_WORDS,
  'hi-IN': [...STOP_WORDS, 'क्या', 'है', 'के', 'बारे', 'में', 'बताएं', 'समझाएं'],
  'es-ES': [...STOP_WORDS, 'que', 'es', 'sobre', 'explica', 'seguro'],
  'fr-FR': [...STOP_WORDS, 'est', 'ce', 'que', 'explique', 'sur'],
}

export function extractDrugName(text, lang = 'en-US') {
  const names = extractDrugNames(text, lang)
  return names.length > 0 ? names[0] : null
}

/**
 * Extract multiple drug names from a transcript, identifying separators like "and", "vs", "versus".
 */
export function extractDrugNames(text, lang = 'en-US') {
  const stops = LOCALIZED_STOP_WORDS[lang] || STOP_WORDS;
  const t = text.toLowerCase().trim();
  
  // 1. Check for comparison connectors
  const connectors = [/\s+vs\s+/i, /\s+versus\s+/i, /\s+and\s+/i, /\s+compared to\s+/i, /\s+difference between\s+/i];
  let parts = [t];
  
  for (const conn of connectors) {
    let nextParts = [];
    for (const p of parts) {
      const split = p.split(conn);
      nextParts.push(...split);
    }
    parts = nextParts;
  }

  // 2. Clean each part from command noise
  const cleaner = /\b(compare|analyze|check|difference|between|drug|compound|molecule|chemicals?|the|and|with)\b/gi;
  
  const results = parts.map(p => {
    let clean = p.replace(cleaner, '').trim();
    const words = clean.split(/\s+/);
    const filtered = words.filter(w => !stops.includes(w) && w.length > 2);
    if (!filtered.length) return null;
    return correctDrugName(filtered.join(' '));
  }).filter(Boolean);

  return [...new Set(results)]; // Unique names
}

// ── Drug knowledge base ───────────────────────────────────────
const DRUG_CLASS_DB = {
  aspirin:       { class: 'NSAID', use: 'Pain relief, anti-inflammatory, antiplatelet',
                   mechanism: 'Irreversible COX-1/COX-2 inhibition via acetylation of Ser530',
                   metabolism: 'Hydrolyzed to salicylate; conjugated via glucuronidation and glycine',
                   organTox: ['GI', 'Renal'], alerts: ['ester'] },
  ibuprofen:     { class: 'NSAID', use: 'Pain relief, fever reduction, anti-inflammatory',
                   mechanism: 'Reversible COX-1/COX-2 inhibition, reducing prostaglandin E2 synthesis',
                   metabolism: 'CYP2C9-mediated hydroxylation; glucuronide conjugation',
                   organTox: ['GI', 'Renal', 'Cardiovascular'], alerts: [] },
  paracetamol:   { class: 'Analgesic/Antipyretic', use: 'Pain relief, fever reduction',
                   mechanism: 'Central COX-3 inhibition; endocannabinoid system modulation',
                   metabolism: 'CYP2E1/CYP3A4 → NAPQI (toxic); glutathione conjugation at therapeutic doses',
                   organTox: ['Hepatic'], alerts: ['amide'] },
  acetaminophen: { class: 'Analgesic/Antipyretic', use: 'Pain relief, fever reduction',
                   mechanism: 'Central COX-3 inhibition; endocannabinoid system modulation',
                   metabolism: 'CYP2E1/CYP3A4 → NAPQI (toxic); glutathione conjugation at therapeutic doses',
                   organTox: ['Hepatic'], alerts: ['amide'] },
  caffeine:      { class: 'Xanthine stimulant', use: 'CNS stimulant, adenosine antagonist',
                   mechanism: 'Non-selective adenosine A1/A2A receptor antagonism; PDE inhibition',
                   metabolism: 'CYP1A2 → paraxanthine (84%), theobromine, theophylline',
                   organTox: ['CNS', 'Cardiovascular'], alerts: [] },
  morphine:      { class: 'Opioid analgesic', use: 'Severe pain management',
                   mechanism: 'μ-opioid receptor (MOR) agonism; inhibits adenylyl cyclase, opens K+ channels',
                   metabolism: 'UGT2B7 → morphine-6-glucuronide (active) and morphine-3-glucuronide',
                   organTox: ['CNS', 'Respiratory'], alerts: ['phenol'] },
  metformin:     { class: 'Biguanide', use: 'Type 2 diabetes management',
                   mechanism: 'AMPK activation; inhibits mitochondrial complex I; reduces hepatic gluconeogenesis',
                   metabolism: 'Not metabolized; excreted unchanged renally',
                   organTox: ['Renal'], alerts: [] },
  aniline:       { class: 'Aromatic amine', use: 'Industrial chemical / research reagent',
                   mechanism: 'N-hydroxylation by CYP1A2 → arylhydroxylamine → nitrosobenzene; DNA adduct formation',
                   metabolism: 'CYP1A2 N-hydroxylation; NAT2 acetylation; peroxidase oxidation',
                   organTox: ['Hematologic', 'Hepatic', 'Genotoxic'], alerts: ['aromatic_amine'] },
  nitrobenzene:  { class: 'Nitroaromatic', use: 'Industrial solvent / chemical precursor',
                   mechanism: 'Nitroreduction by gut flora/CYP → nitroso/hydroxylamine → methemoglobin formation',
                   metabolism: 'Nitroreductase → hydroxylamine; CYP-mediated ring hydroxylation',
                   organTox: ['Hematologic', 'CNS', 'Hepatic'], alerts: ['nitro'] },
  benzaldehyde:  { class: 'Aromatic aldehyde', use: 'Flavoring agent / chemical intermediate',
                   mechanism: 'Aldehyde oxidation to benzoic acid; protein adduct formation via Schiff base',
                   metabolism: 'Aldehyde dehydrogenase (ALDH) → benzoic acid → hippuric acid',
                   organTox: ['Hepatic', 'Mucosal'], alerts: ['aldehyde'] },
  testosterone:  { class: 'Androgen steroid', use: 'Hormone replacement therapy',
                   mechanism: 'Androgen receptor (AR) agonism; nuclear transcription factor activation',
                   metabolism: 'CYP3A4 → 6β-hydroxytestosterone; 5α-reductase → DHT; aromatase → estradiol',
                   organTox: ['Hepatic', 'Cardiovascular'], alerts: [] },
  cisplatin:     { class: 'Platinum chemotherapy', use: 'Cancer treatment (antineoplastic)',
                   mechanism: 'Intrastrand Pt-DNA crosslinks at GG/AG sequences; blocks replication/transcription',
                   metabolism: 'Aquation in cytoplasm; renal excretion of platinum complexes',
                   organTox: ['Renal', 'Neurological', 'Hematologic'], alerts: [] },
  doxorubicin:   { class: 'Anthracycline antibiotic', use: 'Cancer chemotherapy',
                   mechanism: 'DNA intercalation + topoisomerase II inhibition; semiquinone radical → ROS generation',
                   metabolism: 'Carbonyl reductase → doxorubicinol; CYP3A4 deglycosylation',
                   organTox: ['Cardiac', 'Hematologic', 'Hepatic'], alerts: ['quinone'] },
  warfarin:      { class: 'Anticoagulant', use: 'Blood clot prevention',
                   mechanism: 'VKORC1 inhibition → blocks vitamin K recycling → depletes clotting factors II,VII,IX,X',
                   metabolism: 'CYP2C9 (S-warfarin), CYP3A4 (R-warfarin); highly protein-bound',
                   organTox: ['Hematologic'], alerts: ['coumarin'] },
  atorvastatin:  { class: 'Statin', use: 'Cholesterol reduction',
                   mechanism: 'HMG-CoA reductase competitive inhibition; reduces hepatic cholesterol synthesis',
                   metabolism: 'CYP3A4 → ortho- and para-hydroxy metabolites (active)',
                   organTox: ['Hepatic', 'Muscular'], alerts: [] },
  amoxicillin:   { class: 'Beta-lactam antibiotic', use: 'Bacterial infection treatment',
                   mechanism: 'PBP (penicillin-binding protein) inhibition → cell wall synthesis disruption',
                   metabolism: 'Minimal hepatic; ~80% excreted unchanged renally',
                   organTox: ['Renal', 'Hepatic'], alerts: ['beta_lactam'] },
  diazepam:      { class: 'Benzodiazepine', use: 'Anxiety, seizure, muscle relaxant',
                   mechanism: 'Positive allosteric modulator of GABA-A receptor; increases Cl⁻ conductance',
                   metabolism: 'CYP2C19/CYP3A4 → desmethyldiazepam (active) → oxazepam → glucuronide',
                   organTox: ['CNS', 'Respiratory'], alerts: [] },
  fluoxetine:    { class: 'SSRI antidepressant', use: 'Depression, OCD, anxiety disorders',
                   mechanism: 'Selective serotonin reuptake inhibitor (SERT); increases synaptic 5-HT',
                   metabolism: 'CYP2D6 → norfluoxetine (active, long t½); CYP2C9 involvement',
                   organTox: ['CNS', 'Cardiac'], alerts: [] },
  haloperidol:   { class: 'Typical antipsychotic', use: 'Schizophrenia, acute psychosis',
                   mechanism: 'D2 receptor antagonism; also blocks α1-adrenergic and H1 receptors',
                   metabolism: 'CYP3A4/CYP2D6 → reduced haloperidol; glucuronidation',
                   organTox: ['CNS', 'Cardiac'], alerts: [] },
  fentanyl:      { class: 'Synthetic opioid', use: 'Severe/chronic pain, anesthesia',
                   mechanism: 'High-affinity μ-opioid receptor agonist (100× morphine potency)',
                   metabolism: 'CYP3A4 → norfentanyl (inactive); rapid redistribution to fat',
                   organTox: ['CNS', 'Respiratory'], alerts: [] },
  methotrexate:  { class: 'Antimetabolite', use: 'Cancer, autoimmune diseases',
                   mechanism: 'DHFR inhibition → blocks folate metabolism → impairs DNA/RNA synthesis',
                   metabolism: 'Polyglutamation intracellularly; renal excretion; hepatic accumulation',
                   organTox: ['Hepatic', 'Renal', 'Hematologic'], alerts: [] },
  tamoxifen:     { class: 'SERM', use: 'Breast cancer treatment/prevention',
                   mechanism: 'Estrogen receptor partial agonist/antagonist; tissue-selective ER modulation',
                   metabolism: 'CYP2D6/CYP3A4 → endoxifen (active, 100× potency); N-desmethyltamoxifen',
                   organTox: ['Hepatic', 'Uterine'], alerts: [] },
  penicillin:    { class: 'Beta-lactam antibiotic', use: 'Bacterial infection treatment',
                   mechanism: 'PBP inhibition → peptidoglycan crosslinking failure → bacteriolysis',
                   metabolism: 'Minimal; renal tubular secretion; β-lactam ring hydrolysis',
                   organTox: ['Renal'], alerts: ['beta_lactam'] },
  codeine:       { class: 'Opioid analgesic', use: 'Mild-moderate pain, cough suppression',
                   mechanism: 'Prodrug; CYP2D6 converts to morphine (active); μ-opioid receptor agonism',
                   metabolism: 'CYP2D6 → morphine; CYP3A4 → norcodeine; UGT2B7 → codeine-6-glucuronide',
                   organTox: ['CNS', 'Respiratory'], alerts: [] },
  dexamethasone: { class: 'Corticosteroid', use: 'Inflammation, immune suppression',
                   mechanism: 'GR agonism → NF-κB/AP-1 suppression; inhibits cytokine transcription',
                   metabolism: 'CYP3A4 → 6β-hydroxydexamethasone; low protein binding',
                   organTox: ['Endocrine', 'Immunologic', 'Musculoskeletal'], alerts: [] },
  losartan:      { class: 'ARB antihypertensive', use: 'Hypertension, heart failure',
                   mechanism: 'AT1 receptor antagonism → blocks angiotensin II vasoconstriction',
                   metabolism: 'CYP2C9 → EXP3174 (active, 10–40× potency); CYP3A4 involvement',
                   organTox: ['Renal'], alerts: [] },
  omeprazole:    { class: 'Proton pump inhibitor', use: 'Acid reflux, peptic ulcer',
                   mechanism: 'Irreversible H⁺/K⁺-ATPase inhibition in gastric parietal cells',
                   metabolism: 'CYP2C19 (major) → 5-hydroxyomeprazole; CYP3A4 → omeprazole sulfone',
                   organTox: ['Renal', 'Hepatic'], alerts: [] },
  sertraline:    { class: 'SSRI antidepressant', use: 'Depression, anxiety, PTSD',
                   mechanism: 'Selective SERT inhibition; weak dopamine reuptake inhibition',
                   metabolism: 'CYP2C19/CYP2D6 → desmethylsertraline (weakly active)',
                   organTox: ['CNS', 'Cardiac'], alerts: [] },
  remdesivir:    { class: 'Antiviral nucleotide analog', use: 'COVID-19, Ebola treatment',
                   mechanism: 'RdRp inhibition via adenosine analog incorporation → premature chain termination',
                   metabolism: 'Intracellular activation to GS-443902 (triphosphate); esterase hydrolysis',
                   organTox: ['Hepatic', 'Renal'], alerts: [] },
}

export function getDrugClass(name) {
  if (!name) return null
  return DRUG_CLASS_DB[name.toLowerCase().trim()] || null
}

// ── SMILES structural alert scanner ──────────────────────────
const STRUCTURAL_ALERTS = [
  { id: 'nitro',        label: 'Nitro group',          pattern: /\[N\+\]\(=O\)\[O\-\]|N\(=O\)=O/,  severity: 'high',
    reason: 'Nitro groups undergo nitroreduction to reactive nitroso/hydroxylamine species causing oxidative stress and methemoglobin formation.' },
  { id: 'aromatic_amine', label: 'Aromatic amine',     pattern: /c[NX3H2]|c1ccc\(cc1\)N|cN(?!H?C=O)/i, severity: 'high',
    reason: 'Aromatic amines are N-hydroxylated by CYP1A2 to form reactive arylhydroxylamines that form DNA adducts — known genotoxic mechanism.' },
  { id: 'aldehyde',     label: 'Aldehyde',             pattern: /C=O(?!.*\[)/,                       severity: 'moderate',
    reason: 'Aldehydes form Schiff base adducts with lysine residues in proteins, causing cellular dysfunction and potential genotoxicity.' },
  { id: 'epoxide',      label: 'Epoxide',              pattern: /C1OC1/,                             severity: 'high',
    reason: 'Epoxides are highly reactive electrophiles that alkylate DNA and proteins, acting as direct-acting mutagens.' },
  { id: 'halide_arom',  label: 'Aromatic halide',      pattern: /c[FClBrI]/,                         severity: 'moderate',
    reason: 'Aromatic halides increase metabolic stability and lipophilicity, potentially enhancing bioaccumulation and off-target binding.' },
  { id: 'azo',          label: 'Azo group',            pattern: /N=N/,                               severity: 'high',
    reason: 'Azo compounds are reductively cleaved by gut microbiota to aromatic amines, which are known carcinogens.' },
  { id: 'thiol',        label: 'Thiol / Sulfhydryl',   pattern: /\[SH\]/,                            severity: 'moderate',
    reason: 'Thiols can form mixed disulfides with protein cysteines, disrupting enzyme function and redox homeostasis.' },
  { id: 'quinone',      label: 'Quinone / Semiquinone', pattern: /C1=CC\(=O\)C=CC1=O|O=C1C=CC\(=O\)/,severity: 'high',
    reason: 'Quinones undergo redox cycling generating superoxide radicals, causing oxidative stress and mitochondrial damage.' },
  { id: 'michael',      label: 'Michael acceptor',     pattern: /C=CC=O|C=CC#N/,                     severity: 'moderate',
    reason: 'α,β-unsaturated carbonyls act as Michael acceptors, covalently modifying nucleophilic residues in proteins and DNA.' },
  { id: 'beta_lactam',  label: 'β-Lactam ring',        pattern: /C1CNC1=O|C1CC\(=O\)N1/,            severity: 'low',
    reason: 'β-Lactam ring can cause hypersensitivity reactions via protein haptenation; generally low systemic toxicity.' },
  { id: 'coumarin',     label: 'Coumarin scaffold',    pattern: /c1ccc2c\(c1\)OC\(=O\)C=C2/,        severity: 'moderate',
    reason: 'Coumarin scaffold associated with hepatotoxicity via CYP2A6-mediated 3,4-epoxide formation.' },
  { id: 'phenol',       label: 'Phenol',               pattern: /c1ccc\(O\)cc1|c1cc\(O\)ccc1/,      severity: 'low',
    reason: 'Phenols can be oxidized to reactive quinones; generally low toxicity but relevant at high concentrations.' },
  { id: 'amide',        label: 'Amide bond',           pattern: /NC=O|C\(=O\)N/,                    severity: 'low',
    reason: 'Amide bonds are generally stable; relevant as metabolic hydrolysis sites producing potentially reactive amines.' },
  { id: 'ester',        label: 'Ester / Prodrug',      pattern: /OC=O|C\(=O\)O[^H]/,               severity: 'low',
    reason: 'Esters are hydrolyzed by esterases to carboxylic acids and alcohols; relevant for prodrug activation.' },
]

export function scanStructuralAlerts(smiles) {
  if (!smiles) return []
  return STRUCTURAL_ALERTS.filter(a => a.pattern.test(smiles))
}

// ── H-bond & physicochemical reasoning ───────────────────────
function interpretHBonding(hbd, hba) {
  const notes = []
  if (hbd != null) {
    if (hbd > 5)
      notes.push(`High H-bond donor count (${hbd}) reduces membrane permeability and oral bioavailability (Lipinski violation).`)
    else if (hbd === 0)
      notes.push(`No H-bond donors — favors passive membrane diffusion but may reduce aqueous solubility.`)
    else
      notes.push(`H-bond donors (${hbd}) within acceptable range for oral absorption.`)
  }
  if (hba != null) {
    if (hba > 10)
      notes.push(`High H-bond acceptor count (${hba}) limits passive permeability and may indicate poor CNS penetration.`)
    else if (hba >= 5)
      notes.push(`Moderate H-bond acceptors (${hba}) — balanced polarity for drug-like distribution.`)
  }
  return notes
}

// ── Descriptor interpretation engine ─────────────────────────
export function interpretDescriptors(features = {}) {
  const { LogP, TPSA, MolWeight, AromaticRings, QED, Fsp3, HBD, HBA, RotBonds } = features
  const insights = []

  if (LogP != null) {
    if (LogP > 5)
      insights.push({ prop: 'LogP', value: LogP.toFixed(2), flag: 'high',
        reason: `High lipophilicity (LogP ${LogP.toFixed(2)}) drives passive membrane penetration and promotes bioaccumulation in lipid-rich tissues (adipose, CNS myelin). Increases risk of off-target binding and chronic toxicity.` })
    else if (LogP > 3)
      insights.push({ prop: 'LogP', value: LogP.toFixed(2), flag: 'moderate',
        reason: `Moderate lipophilicity (LogP ${LogP.toFixed(2)}) supports good membrane permeability with acceptable volume of distribution. Metabolic clearance via CYP oxidation is likely.` })
    else if (LogP < 0)
      insights.push({ prop: 'LogP', value: LogP.toFixed(2), flag: 'low',
        reason: `Low lipophilicity (LogP ${LogP.toFixed(2)}) limits passive diffusion across membranes. Renal clearance dominates; reduced tissue accumulation risk.` })
    else
      insights.push({ prop: 'LogP', value: LogP.toFixed(2), flag: 'optimal',
        reason: `Optimal lipophilicity (LogP ${LogP.toFixed(2)}) — balanced membrane permeability and aqueous solubility. Consistent with Lipinski drug-like space.` })
  }

  if (TPSA != null) {
    if (TPSA > 140)
      insights.push({ prop: 'TPSA', value: `${TPSA} Å²`, flag: 'high',
        reason: `High polar surface area (${TPSA} Å²) severely limits intestinal absorption (<10% predicted) and blood-brain barrier penetration. Likely requires active transport.` })
    else if (TPSA < 40)
      insights.push({ prop: 'TPSA', value: `${TPSA} Å²`, flag: 'low',
        reason: `Low polar surface area (${TPSA} Å²) enables rapid passive diffusion across all biological membranes including the BBB — elevated CNS exposure and toxicity risk.` })
    else if (TPSA <= 90)
      insights.push({ prop: 'TPSA', value: `${TPSA} Å²`, flag: 'optimal',
        reason: `TPSA (${TPSA} Å²) is within the optimal oral bioavailability window (20–90 Å²). Good predicted intestinal absorption.` })
    else
      insights.push({ prop: 'TPSA', value: `${TPSA} Å²`, flag: 'moderate',
        reason: `TPSA (${TPSA} Å²) is elevated — absorption may be reduced but compound remains within drug-like space.` })
  }

  if (MolWeight != null) {
    if (MolWeight > 500)
      insights.push({ prop: 'MW', value: `${MolWeight} Da`, flag: 'high',
        reason: `High molecular weight (${MolWeight} Da) violates Lipinski Ro5. Impairs passive absorption; may require formulation strategies. Slower renal clearance increases accumulation risk.` })
    else if (MolWeight < 150)
      insights.push({ prop: 'MW', value: `${MolWeight} Da`, flag: 'low',
        reason: `Low molecular weight (${MolWeight} Da) allows rapid distribution and renal filtration. May indicate limited target selectivity and higher off-target activity.` })
    else
      insights.push({ prop: 'MW', value: `${MolWeight} Da`, flag: 'optimal',
        reason: `Molecular weight (${MolWeight} Da) is within the drug-like range (150–500 Da). Consistent with favorable ADME properties.` })
  }

  if (AromaticRings != null && AromaticRings >= 3)
    insights.push({ prop: 'Aromatic Rings', value: AromaticRings, flag: 'high',
      reason: `${AromaticRings} aromatic rings increase metabolic activation risk via CYP-mediated epoxidation and arene oxide formation — potential reactive intermediate generation and genotoxicity.` })

  if (Fsp3 != null) {
    if (Fsp3 < 0.25)
      insights.push({ prop: 'Fsp3', value: Fsp3.toFixed(2), flag: 'high',
        reason: `Low fraction of sp3 carbons (Fsp3 ${Fsp3.toFixed(2)}) indicates a flat, aromatic-rich scaffold. Associated with higher promiscuity, metabolic activation risk, and lower clinical success rates.` })
    else if (Fsp3 > 0.5)
      insights.push({ prop: 'Fsp3', value: Fsp3.toFixed(2), flag: 'optimal',
        reason: `High Fsp3 (${Fsp3.toFixed(2)}) indicates a 3D-rich scaffold with better selectivity and lower metabolic activation risk.` })
  }

  if (QED != null) {
    if (QED < 0.3)
      insights.push({ prop: 'QED', value: QED.toFixed(2), flag: 'low',
        reason: `Low drug-likeness score (QED ${QED.toFixed(2)}) reflects poor overall pharmaceutical profile — likely multiple Lipinski violations or unfavorable physicochemical properties.` })
    else if (QED > 0.7)
      insights.push({ prop: 'QED', value: QED.toFixed(2), flag: 'optimal',
        reason: `High QED (${QED.toFixed(2)}) indicates favorable drug-likeness across all physicochemical dimensions.` })
  }

  if (RotBonds != null && RotBonds > 10)
    insights.push({ prop: 'Rotatable Bonds', value: RotBonds, flag: 'high',
      reason: `High rotatable bond count (${RotBonds}) reduces oral bioavailability and increases conformational flexibility, potentially reducing binding selectivity.` })

  return insights
}

// ── Organ toxicity routing ────────────────────────────────────
const ORGAN_TOX_META = {
  Hepatic:        { label: 'Hepatotoxicity',      icon: '🫀', color: '#f97316',
    note: 'Liver is primary site of CYP-mediated metabolism; reactive intermediates can cause hepatocellular damage.' },
  Renal:          { label: 'Nephrotoxicity',       icon: '🫘', color: '#38bdf8',
    note: 'Renal tubular concentration of drugs/metabolites can cause proximal tubule injury.' },
  CNS:            { label: 'CNS Toxicity',         icon: '🧠', color: '#a78bfa',
    note: 'Lipophilic compounds cross the BBB; CNS toxicity includes sedation, seizures, and neurotoxicity.' },
  Cardiac:        { label: 'Cardiotoxicity',       icon: '❤️', color: '#f87171',
    note: 'hERG channel blockade and mitochondrial damage are primary cardiac toxicity mechanisms.' },
  Hematologic:    { label: 'Hematotoxicity',       icon: '🩸', color: '#fb923c',
    note: 'Reactive metabolites can oxidize hemoglobin (methemoglobin) or cause bone marrow suppression.' },
  Respiratory:    { label: 'Respiratory Toxicity', icon: '🫁', color: '#34d399',
    note: 'CNS-active compounds (opioids, benzodiazepines) suppress respiratory drive at high doses.' },
  Genotoxic:      { label: 'Genotoxicity',         icon: '🧬', color: '#e879f9',
    note: 'DNA-reactive metabolites form adducts, causing mutations and potential carcinogenicity.' },
  Cardiovascular: { label: 'Cardiovascular Risk',  icon: '💓', color: '#f87171',
    note: 'COX inhibition reduces prostacyclin, shifting thromboxane/prostacyclin balance toward thrombosis.' },
  Muscular:       { label: 'Myotoxicity',          icon: '💪', color: '#fbbf24',
    note: 'Statins can cause myopathy via CoQ10 depletion and mitochondrial dysfunction in muscle.' },
  Endocrine:      { label: 'Endocrine Disruption', icon: '⚗️', color: '#818cf8',
    note: 'Steroid-like compounds and receptor modulators can disrupt hormonal homeostasis.' },
  Immunologic:    { label: 'Immunosuppression',    icon: '🛡️', color: '#94a3b8',
    note: 'Corticosteroids suppress adaptive immunity; chronic use increases infection risk.' },
  Mucosal:        { label: 'Mucosal Irritation',   icon: '🔴', color: '#fb923c',
    note: 'Reactive aldehydes and acids can irritate mucosal membranes directly.' },
  Neurological:   { label: 'Neurotoxicity',        icon: '⚡', color: '#a78bfa',
    note: 'Platinum compounds accumulate in dorsal root ganglia causing peripheral neuropathy.' },
  Uterine:        { label: 'Uterine Effects',      icon: '🔬', color: '#f472b6',
    note: 'SERMs with partial agonist activity in uterine tissue increase endometrial cancer risk.' },
  Musculoskeletal:{ label: 'Musculoskeletal',      icon: '🦴', color: '#fbbf24',
    note: 'Chronic corticosteroid use causes osteoporosis and avascular necrosis.' },
  GI:             { label: 'GI Toxicity',          icon: '🫃', color: '#fb923c',
    note: 'COX-1 inhibition reduces gastroprotective prostaglandins, causing ulceration and bleeding.' },
}

export function getOrganToxicity(drugClassData, smiles, features = {}) {
  const organs = new Set(drugClassData?.organTox || [])

  // Infer from SMILES alerts
  const alerts = scanStructuralAlerts(smiles || '')
  if (alerts.some(a => ['nitro','aromatic_amine','azo'].includes(a.id))) organs.add('Hematologic')
  if (alerts.some(a => ['quinone','michael'].includes(a.id)))            organs.add('Cardiac')
  if (alerts.some(a => ['epoxide','aldehyde'].includes(a.id)))           organs.add('Genotoxic')

  // Infer from descriptors
  if (features.LogP > 4 && features.TPSA < 90) organs.add('CNS')
  if (features.MolWeight > 500)                 organs.add('Renal')

  return [...organs].map(o => ORGAN_TOX_META[o]).filter(Boolean)
}

// ── Risk classifier ───────────────────────────────────────────
export function classifyRisk(probability) {
  if (probability >= 0.70) return { level: 'High',     color: 'red',    emoji: '🔴' }
  if (probability >= 0.45) return { level: 'Moderate', color: 'orange', emoji: '🟠' }
  if (probability >= 0.25) return { level: 'Low',      color: 'yellow', emoji: '🟡' }
  return                          { level: 'Minimal',  color: 'green',  emoji: '🟢' }
}

// ── Dose-response reasoning ───────────────────────────────────
function buildDoseResponse(drugName, toxic, features = {}, drugClassData = null) {
  const { LogP, MolWeight, TPSA } = features
  const name = drugName || 'This compound'
  const cls  = drugClassData?.class || ''

  const classReasoning = {
    'NSAID':                  { normal: 'COX inhibition provides effective analgesia; GI effects are manageable with food or PPIs.', high: 'Sustained COX-1 inhibition depletes gastroprotective prostaglandins → GI bleeding, renal vasoconstriction, and cardiovascular events.' },
    'Opioid analgesic':       { normal: 'μ-opioid receptor activation provides dose-dependent analgesia with manageable constipation and sedation.', high: 'Overdose causes respiratory depression via brainstem μ-receptor activation; potentially fatal apnea.' },
    'Synthetic opioid':       { normal: 'Extremely potent at microgram doses; requires careful titration and monitoring.', high: 'Extremely narrow therapeutic window — nanogram overdoses cause fatal respiratory depression. Naloxone reversal required.' },
    'Analgesic/Antipyretic':  { normal: 'Safe and effective at ≤4g/day; hepatic glutathione conjugates NAPQI efficiently.', high: 'Overdose (>10g) saturates glutathione → NAPQI accumulation → centrilobular hepatic necrosis. N-acetylcysteine is antidote.' },
    'Xanthine stimulant':     { normal: 'Adenosine antagonism improves alertness and reduces fatigue; mild diuresis.', high: 'Doses >1g cause tachycardia, anxiety, tremor; >10g can cause seizures and cardiac arrhythmias.' },
    'Aromatic amine':         { normal: 'No therapeutic use — any significant exposure carries genotoxic risk via CYP1A2 activation.', high: 'Methemoglobinemia, hepatocellular damage, and DNA adduct formation. Classified as Group 1 carcinogen (IARC).' },
    'Nitroaromatic':          { normal: 'No therapeutic use — industrial chemical with no safe exposure level.', high: 'Severe methemoglobinemia (>70% MetHb is fatal), CNS depression, and hepatic necrosis.' },
    'Aromatic aldehyde':      { normal: 'Low-level exposure metabolized to benzoic acid (hippuric acid excretion).', high: 'Protein adduct formation, mucosal irritation, and potential genotoxicity at high concentrations.' },
    'Platinum chemotherapy':  { normal: 'DNA crosslinking in rapidly dividing cancer cells; nephrotoxicity managed with hydration.', high: 'Cumulative nephrotoxicity (proximal tubule), peripheral neuropathy, and ototoxicity at high doses.' },
    'Anthracycline antibiotic':{ normal: 'Topoisomerase II inhibition in cancer cells; cumulative cardiotoxicity is dose-limiting.', high: 'Dilated cardiomyopathy at cumulative doses >550 mg/m² due to ROS-mediated mitochondrial damage.' },
    'Anticoagulant':          { normal: 'INR 2–3 provides therapeutic anticoagulation; requires regular monitoring.', high: 'Supratherapeutic INR causes spontaneous hemorrhage; intracranial bleeding is life-threatening.' },
    'Statin':                 { normal: 'HMG-CoA reductase inhibition reduces LDL-C by 30–50%; generally well tolerated.', high: 'Myopathy and rhabdomyolysis at high doses, especially with CYP3A4 inhibitors; hepatotoxicity rare.' },
    'Benzodiazepine':         { normal: 'GABA-A potentiation provides anxiolysis and sedation; tolerance develops with chronic use.', high: 'Respiratory depression in combination with opioids or alcohol; physical dependence and withdrawal seizures.' },
    'Biguanide':              { normal: 'AMPK activation reduces hepatic glucose output; no hypoglycemia risk as monotherapy.', high: 'Lactic acidosis risk in renal impairment due to metformin accumulation and mitochondrial complex I inhibition.' },
    'Androgen steroid':       { normal: 'AR activation restores physiological androgen levels; well tolerated at replacement doses.', high: 'Supraphysiological doses cause hepatotoxicity (oral forms), polycythemia, and cardiovascular risk.' },
    'Antimetabolite':         { normal: 'DHFR inhibition at low doses provides anti-inflammatory effects (RA); leucovorin rescue used in cancer.', high: 'Myelosuppression, mucositis, and hepatotoxicity; renal impairment dramatically increases toxicity.' },
    'SERM':                   { normal: 'ER antagonism in breast tissue reduces recurrence; agonist activity in bone preserves density.', high: 'Increased endometrial cancer risk (uterine agonism); thromboembolic events at therapeutic doses.' },
    'Corticosteroid':         { normal: 'GR-mediated anti-inflammatory effects; effective for acute inflammation.', high: 'Chronic use causes HPA axis suppression, osteoporosis, hyperglycemia, and immunosuppression.' },
  }

  const reasoning = classReasoning[cls]
  if (reasoning) return reasoning

  const normalDose = toxic
    ? `Even at standard doses, ${name} exhibits toxicity indicators. ${LogP > 4 ? 'High lipophilicity promotes tissue accumulation and off-target binding.' : ''}`
    : `At normal doses, ${name} appears safe. ${TPSA > 60 ? 'Polar surface area limits non-specific membrane penetration.' : ''}`

  const highDose = toxic
    ? `Elevated doses substantially increase toxicity risk. ${MolWeight > 400 ? 'High molecular weight slows clearance, prolonging systemic exposure.' : ''} Off-target receptor interactions become significant.`
    : `At high doses, metabolic pathways may be saturated, generating reactive intermediates. Off-target effects and accumulation in lipid-rich tissues become relevant.`

  return { normal: normalDose, high: highDose }
}

// ── Model interpretation section ──────────────────────────────
function buildModelInterpretation(toxic, probability, features = {}, shap_explanation = {},
                                   structuralAlerts = [], drugClassData = null) {
  const confPct = Math.round(Math.abs(probability - 0.5) * 200)
  const topShap = (shap_explanation?.top_features || []).slice(0, 5)
  const model   = shap_explanation?.model_used || 'Voting Ensemble'
  const base    = shap_explanation?.base_value

  const lines = []

  // Why this prediction
  lines.push(`The ${model} model predicted ${toxic ? 'toxicity' : 'non-toxicity'} at ${Math.round(probability * 100)}% probability (confidence: ${confPct}%).`)

  // Base rate context
  if (base != null)
    lines.push(`The model's baseline toxicity rate for the Tox21 dataset is ${Math.round(base * 100)}% — this compound ${toxic ? 'exceeds' : 'falls below'} that baseline.`)

  // SHAP drivers
  if (topShap.length) {
    const toxicDrivers = topShap.filter(f => f.direction === 'toxic').slice(0, 3)
    const safeDrivers  = topShap.filter(f => f.direction === 'safe').slice(0, 2)
    if (toxicDrivers.length)
      lines.push(`Key toxicity-pushing features: ${toxicDrivers.map(f => `${f.label} (SHAP +${Math.abs(f.shap_value).toFixed(3)})`).join(', ')}.`)
    if (safeDrivers.length)
      lines.push(`Protective features: ${safeDrivers.map(f => `${f.label} (SHAP −${Math.abs(f.shap_value).toFixed(3)})`).join(', ')}.`)
  }

  // Structural alert contribution
  if (structuralAlerts.length)
    lines.push(`${structuralAlerts.length} structural alert(s) detected (${structuralAlerts.map(a => a.label).join(', ')}) — these PAINS/toxicophore patterns are known to activate Tox21 assays.`)

  // Descriptor contribution
  const { LogP, TPSA, AromaticRings } = features
  if (LogP > 4)
    lines.push(`High LogP (${LogP.toFixed(2)}) increases fingerprint similarity to known Tox21-active lipophilic compounds.`)
  if (AromaticRings >= 3)
    lines.push(`${AromaticRings} aromatic rings contribute to Morgan fingerprint bits associated with metabolic activation in the training set.`)

  // Uncertainty
  if (confPct < 70)
    lines.push(`⚠️ Prediction uncertainty is moderate (${confPct}% confidence). The compound may lie near the decision boundary — further experimental validation is recommended.`)

  return lines
}

// ── Key insights generator ────────────────────────────────────
function generateKeyInsights(drugName, toxic, probability, features = {}, drugClassData = null,
                              shap_explanation = {}, multi_target = [], structuralAlerts = []) {
  const insights = []
  const { LogP, TPSA, MolWeight, QED, Fsp3 } = features
  const name    = drugName || 'This compound'
  const confPct = Math.round(Math.abs(probability - 0.5) * 200)
  const activeTargets = multi_target.filter(t => t.toxic)

  if (confPct < 70)
    insights.push(`Prediction confidence is moderate (${confPct}%). The compound may lie near the Tox21 decision boundary — results should be validated with in-vitro assays before drawing conclusions.`)

  if (LogP > 4 && !toxic)
    insights.push(`Despite a non-toxic prediction, ${name}'s high lipophilicity (LogP ${LogP.toFixed(2)}) suggests potential for adipose/CNS tissue accumulation with chronic exposure — single-dose Tox21 models do not capture this risk.`)

  if (activeTargets.length >= 4)
    insights.push(`Activity across ${activeTargets.length} Tox21 targets (${activeTargets.slice(0,3).map(t=>t.label).join(', ')}...) indicates broad biological interference — polypharmacology risk that may not manifest in single-target assays.`)

  const topShap = shap_explanation?.top_features?.[0]
  if (topShap?.magnitude === 'high')
    insights.push(`SHAP identifies ${topShap.label} as the dominant prediction driver (SHAP ${topShap.shap_value > 0 ? '+' : ''}${topShap.shap_value.toFixed(3)}) — a ${topShap.direction === 'toxic' ? 'risk-amplifying' : 'protective'} feature with disproportionate model influence.`)

  if (structuralAlerts.some(a => a.severity === 'high'))
    insights.push(`High-severity structural alert(s) detected: ${structuralAlerts.filter(a=>a.severity==='high').map(a=>a.label).join(', ')}. These toxicophores are associated with reactive metabolite formation and should be flagged for medicinal chemistry optimization.`)

  if (drugClassData?.class === 'NSAID' && !toxic)
    insights.push(`NSAIDs are safe at therapeutic doses but carry cumulative GI and cardiovascular risk with long-term use — a pharmacodynamic limitation not captured by Tox21 receptor-binding models.`)

  if (drugClassData?.class?.toLowerCase().includes('opioid'))
    insights.push(`Opioid compounds have a narrow therapeutic index. Tox21 evaluates receptor-level toxicity, but addiction liability and respiratory depression risk require separate pharmacological assessment.`)

  if (drugClassData?.class?.toLowerCase().includes('chemotherapy') || drugClassData?.class?.toLowerCase().includes('antineoplastic'))
    insights.push(`Chemotherapy agents are intentionally cytotoxic. High toxicity prediction is clinically expected and acceptable when therapeutic benefit outweighs risk — context-dependent interpretation is essential.`)

  if (Fsp3 != null && Fsp3 < 0.2 && toxic)
    insights.push(`Low Fsp3 (${Fsp3.toFixed(2)}) combined with toxicity prediction indicates a flat, aromatic-rich scaffold with high metabolic activation potential — a common pattern in Tox21-active compounds.`)

  if (!insights.length)
    insights.push(toxic
      ? `The combination of molecular fingerprint patterns, descriptor profile, and structural alerts places ${name} in the high-risk category across multiple Tox21 biological targets.`
      : `${name} demonstrates a favorable safety profile across all evaluated molecular dimensions — no significant toxicophores, acceptable physicochemical properties, and low Tox21 target activity.`)

  return insights.slice(0, 2)
}

// ── Scientific explanation builder ────────────────────────────
function buildScientificExplanation(drugName, toxic, features = {}, drugClassData = null,
                                     shap_explanation = {}, multi_target = [], structuralAlerts = []) {
  const name = drugName || 'This compound'
  const descInsights = interpretDescriptors(features)
  const activeTargets = multi_target.filter(t => t.toxic).slice(0, 3)
  const topShap = (shap_explanation?.top_features || []).slice(0, 3)

  const descNarrative = descInsights.filter(d => !['optimal'].includes(d.flag)).slice(0, 3).map(d => d.reason).join(' ')

  const mechNote = drugClassData?.mechanism
    ? `Mechanistically, ${drugClassData.mechanism.toLowerCase()}.`
    : ''

  const metabNote = drugClassData?.metabolism
    ? `Metabolic pathway: ${drugClassData.metabolism}.`
    : ''

  const shapNarrative = topShap.length
    ? `SHAP analysis (${shap_explanation.model_used || 'ensemble'}) identifies ${topShap.map(f => f.label).join(', ')} as the most influential prediction features — ${topShap[0]?.direction === 'toxic' ? 'collectively driving toward toxicity' : 'collectively supporting a safe classification'}.`
    : ''

  const alertNarrative = structuralAlerts.length
    ? `Structural alert scan detected: ${structuralAlerts.map(a => a.label).join(', ')}. ${structuralAlerts[0]?.reason || ''}`
    : ''

  const targetNarrative = activeTargets.length
    ? `Tox21 target activity flagged on: ${activeTargets.map(t => t.label).join(', ')}.`
    : toxic ? '' : 'No Tox21 biological targets were flagged.'

  return [descNarrative, mechNote, metabNote, alertNarrative, shapNarrative, targetNarrative]
    .filter(Boolean).join(' ')
}

// ── Main structured report builder ───────────────────────────
export function buildStructuredReport(drugName, result, intent, lang = 'en-US') {
  if (!result || intent === 'help') return null

  const t = TRANSLATIONS[lang] || TRANSLATIONS['en-US']

  const {
    toxic, probability, features = {}, drug_likeness = {},
    shap_explanation = {}, multi_target = [], compound_info = {}, smiles,
  } = result

  const name           = compound_info?.synonyms?.[0] || drugName || 'Unknown compound'
  const pct            = Math.round(probability * 100)
  const confPct        = Math.round(Math.abs(probability - 0.5) * 200)
  const drugClassData  = getDrugClass(drugName)
  const risk           = classifyRisk(probability)
  const descInsights   = interpretDescriptors(features)
  const hbondNotes     = interpretHBonding(features.HBD, features.HBA)
  const structAlerts   = scanStructuralAlerts(smiles || '')
  const organTox       = getOrganToxicity(drugClassData, smiles, features)
  const doseResponse   = buildDoseResponse(drugName, toxic, features, drugClassData)
  const modelInterp    = buildModelInterpretation(toxic, probability, features, shap_explanation, structAlerts, drugClassData)
  const keyInsights    = generateKeyInsights(drugName, toxic, probability, features, drugClassData, shap_explanation, multi_target, structAlerts)
  const sciExplanation = buildScientificExplanation(drugName, toxic, features, drugClassData, shap_explanation, multi_target, structAlerts)

  const uncertain = confPct < 70

  const verdict = toxic
    ? t.verdictToxic(name, pct, risk.level) + " " + (uncertain ? (t.uncertainNote || "") : (t.confidenceNote || ""))
    : t.verdictSafe(name, pct, risk.level) + " " + (uncertain ? (t.uncertainNote || "") : (t.confidenceNote || ""))

  // Build sources
  const sources = []
  if (compound_info?.cid) {
    sources.push({ label: 'PubChem', url: `https://pubchem.ncbi.nlm.nih.gov/compound/${compound_info.cid}`, icon: '🔬' })
  }
  if (compound_info?.sourceUrl) {
    sources.push({ label: 'Research Source', url: compound_info.sourceUrl, icon: '🔗' })
  }
  sources.push({ label: 'Tox21 Database', url: 'https://tripod.nih.gov/tox21/', icon: '🧬' })

  return {
    name,
    drugClass:    drugClassData?.class    || (compound_info?.description ? 'Research Compound' : 'Unknown Compound'),
    primaryUse:   drugClassData?.use      || compound_info?.description || 'Data not available in local knowledge base',
    mechanism:    drugClassData?.mechanism || null,
    metabolism:   drugClassData?.metabolism || null,
    prediction:   toxic ? 'Toxic' : 'Non-Toxic',
    probability:  pct,
    confidence:   confPct,
    uncertain,
    riskLevel:    risk,
    descInsights,
    hbondNotes,
    structAlerts,
    organTox,
    sciExplanation,
    doseResponse,
    modelInterp,
    keyInsights,
    verdict,
    sources,
    features: {
      logP: features.LogP, tpsa: features.TPSA, mw: features.MolWeight,
      qed:  features.QED,  hbd:  features.HBD,  hba: features.HBA,
      fsp3: features.Fsp3, rings: features.AromaticRings,
    },
  }
}

// ── Voice-optimised flat explanation (TTS) ────────────────────
export function buildExplanation(drugName, result, intent, lang = 'en-US') {
  const t = TRANSLATIONS[lang] || TRANSLATIONS['en-US']
  if (intent === 'help' || !result) {
    return t.helpText || `I'm ToxScout AI Research, your computational chemistry and toxicology assistant.`
  }

  const report = buildStructuredReport(drugName, result, intent, lang)
  if (!report) return 'Analysis complete.'

  const { name, drugClass, prediction, probability, confidence, riskLevel,
          doseResponse, keyInsights, mechanism } = report

  if (intent === 'comparison' && result.comparison) {
    const { compounds } = result.comparison
    const summary = compounds.map(c => `${c.name} (${c.prediction})`).join(' vs ')
    const detail = compounds[0].probability > compounds[1].probability 
      ? `${compounds[0].name} has a higher predicted toxicity.`
      : `${compounds[1].name} has a higher predicted toxicity.`
    return `Comparing ${summary}. ${detail} ${keyInsights[0] || ''}`
  }

  if (intent === 'safe' || intent === 'toxic') {
    return `${report.verdict} ${keyInsights[0] || ''}`
  }

  // Simple localized explanation
  let msg = `${name}`
  if (lang === 'hi-IN') {
    msg = `${name} एक ${drugClass} है। विषाक्तता की भविष्यवाणी: ${prediction}, ${probability}% संभावना के साथ।`
  } else if (lang === 'es-ES') {
    msg = `${name} es un ${drugClass}. Predicción de toxicidad: ${prediction} con ${probability}% de probabilidad.`
  } else {
    msg = `${name} is a ${drugClass}. Toxicity prediction: ${prediction} at ${probability}% probability.`
  }

  return [
    msg,
    mechanism ? `Mechanism: ${mechanism.split(';')[0]}.` : '',
    keyInsights[0] || '',
  ].filter(Boolean).join(' ')
}

// ── Full voice query pipeline ─────────────────────────────────
export async function processVoiceQuery(transcript, { lang = 'en-US', onStatus } = {}) {
  const intent   = detectIntent(transcript)
  const drugNames = extractDrugNames(transcript, lang)

  if (intent === 'help' || drugNames.length === 0) {
    return { intent: 'help', drugName: null, result: null,
             explanation: buildExplanation(null, null, 'help', lang) }
  }

  const isComparison = intent === 'comparison' && drugNames.length > 1

  if (isComparison) {
    onStatus?.('fetching')
    // Parallel resolution
    const resolvedBatch = await Promise.all(drugNames.map(name => resolveSmiles(name, { timeout: 7000 })))
    const validResolved = resolvedBatch.filter(r => r?.smiles)

    if (validResolved.length < 2) {
      return {
        intent: 'predict', drugName: drugNames[0], result: null,
        explanation: `I found ${validResolved.length} compound(s), but I need at least two for a valid comparison.`
      }
    }

    onStatus?.('predicting')
    const predictions = await Promise.all(validResolved.map(r => predictToxicity(r.smiles)))
    
    // Build a mock comparison result
    const comparisonResult = {
      ...predictions[0], // Base state from first compound
      comparison: {
        compounds: validResolved.map((r, i) => ({
          name: r.name,
          prediction: predictions[i].toxic ? 'Toxic' : 'Non-Toxic',
          probability: Math.round(predictions[i].probability * 100)
        }))
      }
    }

    return {
      intent: 'comparison',
      drugName: validResolved.map(r => r.name).join(' vs '),
      result: comparisonResult,
      explanation: buildExplanation(validResolved[0].name, comparisonResult, 'comparison', lang)
    }
  }

  // Single compound logic
  const drugName = drugNames[0]
  onStatus?.('fetching')
  const resolved = await resolveSmiles(drugName, { timeout: 7000 })

  if (!resolved?.smiles) {
    return {
      intent, drugName, result: null,
      explanation: lang === 'hi-IN' 
        ? `मुझे "${drugName}" के लिए आणविक संरचना नहीं मिल सकी।`
        : `I couldn't find a molecular structure for "${drugName}".`,
    }
  }

  onStatus?.('predicting')
  const result = await predictToxicity(resolved.smiles)

  // Enrich result with resolved compound info
  if (result && resolved.cid) {
    result.compound_info = {
      ...result.compound_info,
      cid:              resolved.cid,
      iupac_name:       resolved.iupac || result.compound_info?.iupac_name,
      formula:          resolved.formula || result.compound_info?.formula,
      molecular_weight: resolved.mw || result.compound_info?.molecular_weight,
      description:      resolved.description || result.compound_info?.description,
      sourceUrl:        resolved.sourceUrl || result.compound_info?.sourceUrl,
      synonyms:         result.compound_info?.synonyms?.length
                          ? result.compound_info.synonyms
                          : [resolved.name || drugName],
    }
  }

  return {
    intent,
    drugName: resolved.name || drugName,
    smiles: resolved.smiles,
    result,
    explanation: buildExplanation(resolved.name || drugName, result, intent, lang),
  }
}

