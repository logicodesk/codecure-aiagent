// ============================================================
// smilesResolver.js — Master SMILES Resolution Module
// ============================================================
// Resolves any drug name / synonym / CID / InChI → canonical SMILES
// using a 5-layer resolution chain with caching and fuzzy matching.
//
// Resolution order:
//   1. Local hardcoded DB (instant, zero-latency)
//   2. Session cache (Map, survives re-renders)
//   3. Backend /resolve-smiles endpoint (RDKit-validated)
//   4. PubChem REST — name → SMILES (live, CORS-friendly)
//   5. PubChem REST — CID lookup (for numeric IDs)
//   6. Fuzzy name correction → retry layer 4
//
// Returns: ResolvedCompound | null
// ============================================================

const PUBCHEM = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug'

// ── Layer 1: Local hardcoded DB ───────────────────────────────
// Covers the most common drugs + toxic compounds used in demos.
// Keys are lowercase name variants and common synonyms.
export const LOCAL_DB = {
  // ── Safe / common drugs ──────────────────────────────────────
  aspirin:              { smiles: 'CC(=O)Oc1ccccc1C(=O)O',                         cid: 2244,   name: 'Aspirin',       formula: 'C9H8O4',    mw: 180.16 },
  'acetylsalicylic acid':{ smiles: 'CC(=O)Oc1ccccc1C(=O)O',                        cid: 2244,   name: 'Aspirin',       formula: 'C9H8O4',    mw: 180.16 },
  caffeine:             { smiles: 'CN1C=NC2=C1C(=O)N(C(=O)N2C)C',                  cid: 2519,   name: 'Caffeine',      formula: 'C8H10N4O2', mw: 194.19 },
  ibuprofen:            { smiles: 'CC(C)Cc1ccc(cc1)C(C)C(=O)O',                    cid: 3672,   name: 'Ibuprofen',     formula: 'C13H18O2',  mw: 206.28 },
  advil:                { smiles: 'CC(C)Cc1ccc(cc1)C(C)C(=O)O',                    cid: 3672,   name: 'Ibuprofen',     formula: 'C13H18O2',  mw: 206.28 },
  paracetamol:          { smiles: 'CC(=O)Nc1ccc(O)cc1',                             cid: 1983,   name: 'Paracetamol',   formula: 'C8H9NO2',   mw: 151.16 },
  acetaminophen:        { smiles: 'CC(=O)Nc1ccc(O)cc1',                             cid: 1983,   name: 'Paracetamol',   formula: 'C8H9NO2',   mw: 151.16 },
  tylenol:              { smiles: 'CC(=O)Nc1ccc(O)cc1',                             cid: 1983,   name: 'Paracetamol',   formula: 'C8H9NO2',   mw: 151.16 },
  metformin:            { smiles: 'CN(C)C(=N)NC(=N)N',                              cid: 3386,   name: 'Metformin',     formula: 'C4H11N5',   mw: 129.16 },
  morphine:             { smiles: 'OC1=CC=C2CC3N(C)CCC34C2=C1OC4',                 cid: 5865,   name: 'Morphine',      formula: 'C17H19NO3', mw: 285.34 },
  testosterone:         { smiles: 'CC12CCC3C(C1CCC2O)CCC4=CC(=O)CCC34C',            cid: 6013,   name: 'Testosterone',  formula: 'C19H28O2',  mw: 288.43 },
  penicillin:           { smiles: 'CC1(C)SC2C(NC(=O)Cc3ccccc3)C(=O)N2C1C(=O)O',   cid: 5743,   name: 'Penicillin G',  formula: 'C16H18N2O4S', mw: 334.39 },
  'penicillin g':       { smiles: 'CC1(C)SC2C(NC(=O)Cc3ccccc3)C(=O)N2C1C(=O)O',   cid: 5743,   name: 'Penicillin G',  formula: 'C16H18N2O4S', mw: 334.39 },
  amoxicillin:          { smiles: 'CC1(C)SC2C(NC(=O)C(N)c3ccc(O)cc3)C(=O)N2C1C(=O)O', cid: 33613, name: 'Amoxicillin', formula: 'C16H19N3O5S', mw: 365.40 },
  atorvastatin:         { smiles: 'CC(C)c1n(CC(O)CC(O)CC(=O)O)c(C(=O)Nc2ccccc2)c(c1-c1ccc(F)cc1)C(=O)Nc1ccccc1', cid: 60823, name: 'Atorvastatin', formula: 'C33H35FN2O5', mw: 558.64 },
  lipitor:              { smiles: 'CC(C)c1n(CC(O)CC(O)CC(=O)O)c(C(=O)Nc2ccccc2)c(c1-c1ccc(F)cc1)C(=O)Nc1ccccc1', cid: 60823, name: 'Atorvastatin', formula: 'C33H35FN2O5', mw: 558.64 },
  remdesivir:           { smiles: 'CCC(CC)COC(=O)C(C)NP(=O)(OCC1C(C(C(O1)N1C=CC(=O)NC1=O)O)O)Oc1ccccc1', cid: 2723949, name: 'Remdesivir', formula: 'C27H35N6O8P', mw: 602.58 },
  doxorubicin:          { smiles: 'COc1cccc2C(=O)c3c(O)c4CC(O)(CC(=O)CO)Cc4c(O)c3C(=O)c12', cid: 5284616, name: 'Doxorubicin', formula: 'C27H29NO11', mw: 543.52 },
  cisplatin:            { smiles: 'N.N.Cl[Pt]Cl',                                   cid: 84691,  name: 'Cisplatin',     formula: 'Cl2H6N2Pt', mw: 300.05 },
  warfarin:             { smiles: 'OC(=O)c1ccccc1',                                 cid: 54678486, name: 'Warfarin',    formula: 'C19H16O4',  mw: 308.33 },
  omeprazole:           { smiles: 'COc1ccc2[nH]c(S(=O)Cc3ncc(C)c(OC)c3C)nc2c1',   cid: 4594,   name: 'Omeprazole',    formula: 'C17H19N3O3S', mw: 345.42 },
  lisinopril:           { smiles: 'OC(=O)C(CCc1ccccc1)NC(C(=O)N1CCCC1C(=O)O)CCCCN', cid: 5362119, name: 'Lisinopril', formula: 'C21H31N3O5', mw: 405.49 },
  simvastatin:          { smiles: 'CCC(C)(C)C(=O)OC1CC(CC2C1C1CCC(C)(C(=O)O)C1CC2)C', cid: 54454, name: 'Simvastatin', formula: 'C25H38O5', mw: 418.57 },
  sildenafil:           { smiles: 'CCCC1=NN(C)C(=C1C(=O)N1CCN(CC1)S(=O)(=O)c1ccc(OCC)cc1)c1cc(S(=O)(=O)N(C)C)ccc1OCC', cid: 135398744, name: 'Sildenafil', formula: 'C22H30N6O4S', mw: 474.58 },
  viagra:               { smiles: 'CCCC1=NN(C)C(=C1C(=O)N1CCN(CC1)S(=O)(=O)c1ccc(OCC)cc1)c1cc(S(=O)(=O)N(C)C)ccc1OCC', cid: 135398744, name: 'Sildenafil', formula: 'C22H30N6O4S', mw: 474.58 },
  diazepam:             { smiles: 'CN1C(=O)CN=C(c2ccccc2)c2cc(Cl)ccc21',           cid: 3016,   name: 'Diazepam',      formula: 'C16H13ClN2O', mw: 284.74 },
  valium:               { smiles: 'CN1C(=O)CN=C(c2ccccc2)c2cc(Cl)ccc21',           cid: 3016,   name: 'Diazepam',      formula: 'C16H13ClN2O', mw: 284.74 },
  codeine:              { smiles: 'COc1ccc2CC3N(C)CCC34c2c1OC4',                   cid: 5284371, name: 'Codeine',       formula: 'C18H21NO3', mw: 299.36 },
  naproxen:             { smiles: 'COc1ccc2cc(C(C)C(=O)O)ccc2c1',                  cid: 156391, name: 'Naproxen',       formula: 'C14H14O3',  mw: 230.26 },
  // ── Toxic compounds ──────────────────────────────────────────
  aniline:              { smiles: 'c1ccc(cc1)N',                                    cid: 6115,   name: 'Aniline',       formula: 'C6H7N',     mw: 93.13  },
  nitrobenzene:         { smiles: 'c1ccc([N+](=O)[O-])cc1',                         cid: 7416,   name: 'Nitrobenzene',  formula: 'C6H5NO2',   mw: 123.11 },
  benzaldehyde:         { smiles: 'O=Cc1ccccc1',                                    cid: 240,    name: 'Benzaldehyde',  formula: 'C7H6O',     mw: 106.12 },
  dichloromethane:      { smiles: 'ClCCl',                                           cid: 6344,   name: 'Dichloromethane', formula: 'CH2Cl2',  mw: 84.93  },
  'methylene chloride': { smiles: 'ClCCl',                                           cid: 6344,   name: 'Dichloromethane', formula: 'CH2Cl2',  mw: 84.93  },
  pcb:                  { smiles: 'Clc1ccc(cc1Cl)c1cc(Cl)ccc1Cl',                   cid: 15981,  name: 'PCB-47',        formula: 'C12H6Cl4',  mw: 291.99 },
  benzene:              { smiles: 'c1ccccc1',                                        cid: 241,    name: 'Benzene',       formula: 'C6H6',      mw: 78.11  },
  toluene:              { smiles: 'Cc1ccccc1',                                       cid: 1140,   name: 'Toluene',       formula: 'C7H8',      mw: 92.14  },
  formaldehyde:         { smiles: 'C=O',                                             cid: 712,    name: 'Formaldehyde',  formula: 'CH2O',      mw: 30.03  },
  chloroform:           { smiles: 'ClC(Cl)Cl',                                       cid: 6212,   name: 'Chloroform',    formula: 'CHCl3',     mw: 119.38 },
  acetone:              { smiles: 'CC(C)=O',                                         cid: 180,    name: 'Acetone',       formula: 'C3H6O',     mw: 58.08  },
  ethanol:              { smiles: 'CCO',                                              cid: 702,    name: 'Ethanol',       formula: 'C2H6O',     mw: 46.07  },
  methanol:             { smiles: 'CO',                                               cid: 887,    name: 'Methanol',      formula: 'CH4O',      mw: 32.04  },
}

// ── Session cache (Map) ───────────────────────────────────────
const _cache = new Map()

// ── Fuzzy name correction table ───────────────────────────────
// Maps common misspellings / voice-recognition errors → canonical name
const FUZZY_CORRECTIONS = {
  'asprin': 'aspirin', 'aspren': 'aspirin', 'aspirin': 'aspirin',
  'ibuprofin': 'ibuprofen', 'ibuprophen': 'ibuprofen', 'ibupropen': 'ibuprofen',
  'paracetamole': 'paracetamol', 'paracetamole': 'paracetamol',
  'acetaminofen': 'acetaminophen', 'acetaminofin': 'acetaminophen',
  'cafeine': 'caffeine', 'caffiene': 'caffeine', 'cofeine': 'caffeine',
  'metphormin': 'metformin', 'metphormine': 'metformin',
  'morfine': 'morphine', 'morphin': 'morphine',
  'testosteron': 'testosterone', 'testostrone': 'testosterone',
  'penicilin': 'penicillin', 'penicilline': 'penicillin',
  'amoxicilin': 'amoxicillin', 'amoxycillin': 'amoxicillin',
  'atorvastatin': 'atorvastatin', 'atorvastatin': 'atorvastatin',
  'diazapam': 'diazepam', 'diazapem': 'diazepam',
  'codiene': 'codeine', 'codien': 'codeine',
  'naproxin': 'naproxen', 'naproxene': 'naproxen',
  'sildenafill': 'sildenafil', 'sildenafile': 'sildenafil',
  'nitrobenzine': 'nitrobenzene', 'nitrobenzeen': 'nitrobenzene',
  'anilin': 'aniline', 'anilene': 'aniline',
  'benzaldahyde': 'benzaldehyde', 'benzaldahide': 'benzaldehyde',
  'chlorofoam': 'chloroform', 'cloroform': 'chloroform',
  'dichloromethane': 'dichloromethane', 'methylene chloride': 'dichloromethane',
  'remdesavir': 'remdesivir', 'remdisivir': 'remdesivir',
  'doxorubicin': 'doxorubicin', 'doxorubicine': 'doxorubicin',
  'cisplatinum': 'cisplatin', 'cis-platin': 'cisplatin',
  'warfarine': 'warfarin', 'warferin': 'warfarin',
  'omeprazol': 'omeprazole', 'omeprazole': 'omeprazole',
}

/**
 * Apply fuzzy correction to a drug name.
 * Returns the corrected name (or original if no match found).
 */
export function fuzzyCorrect(name) {
  if (!name) return name
  const lower = name.toLowerCase().trim()
  if (FUZZY_CORRECTIONS[lower]) return FUZZY_CORRECTIONS[lower]
  // Levenshtein distance ≤ 2 against known names
  const keys = Object.keys(LOCAL_DB)
  let best = null, bestDist = Infinity
  for (const key of keys) {
    const d = levenshtein(lower, key)
    if (d < bestDist && d <= 2) { bestDist = d; best = key }
  }
  return best ?? lower
}

function levenshtein(a, b) {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
  return dp[m][n]
}

// ── PubChem helpers ───────────────────────────────────────────
async function pubchemByName(name, timeout = 5000) {
  const enc = encodeURIComponent(name)
  const url = `${PUBCHEM}/compound/name/${enc}/property/IsomericSMILES,CanonicalSMILES,MolecularFormula,MolecularWeight,IUPACName,Title/JSON`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeout) })
    if (!res.ok) return null
    const data = await res.json()
    const p = data?.PropertyTable?.Properties?.[0]
    if (!p) return null
    return {
      smiles:  p.IsomericSMILES || p.CanonicalSMILES,
      cid:     p.CID,
      name:    p.Title || name,
      formula: p.MolecularFormula || '',
      mw:      p.MolecularWeight ? parseFloat(p.MolecularWeight) : null,
      iupac:   p.IUPACName || '',
    }
  } catch { return null }
}

async function pubchemByCID(cid, timeout = 5000) {
  const url = `${PUBCHEM}/compound/cid/${cid}/property/IsomericSMILES,CanonicalSMILES,MolecularFormula,MolecularWeight,IUPACName,Title/JSON`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeout) })
    if (!res.ok) return null
    const data = await res.json()
    const p = data?.PropertyTable?.Properties?.[0]
    if (!p) return null

    // Also fetch description
    const desc = await pubchemDescription(cid, timeout)

    return {
      smiles:  p.IsomericSMILES || p.CanonicalSMILES,
      cid:     p.CID,
      name:    p.Title || String(cid),
      formula: p.MolecularFormula || '',
      mw:      p.MolecularWeight ? parseFloat(p.MolecularWeight) : null,
      iupac:   p.IUPACName || '',
      description: desc?.text || null,
      sourceUrl:   desc?.url || `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`,
    }
  } catch { return null }
}

async function pubchemDescription(cid, timeout = 3000) {
  const url = `${PUBCHEM}/compound/cid/${cid}/description/JSON`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeout) })
    if (!res.ok) return null
    const data = await res.json()
    const info = data?.InformationList?.Information?.find(i => i.Description)
    if (!info) return null
    return {
      text: info.Description,
      url:  info.DescriptionURL || `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`,
      source: info.DescriptionSourceName || 'PubChem'
    }
  } catch { return null }
}

async function backendResolve(query, timeout = 4000) {
  try {
    const res = await fetch(`/api/resolve-smiles?q=${encodeURIComponent(query)}`, {
      signal: AbortSignal.timeout(timeout),
    })
    if (res.ok) {
      const data = await res.json()
      if (data?.smiles) return data
    }
  } catch {}
  return null
}

// ── Master resolver ───────────────────────────────────────────

/**
 * Resolve any drug name / synonym / CID / SMILES → ResolvedCompound.
 *
 * @param {string} query  Drug name, synonym, CID (numeric), or raw SMILES
 * @param {object} opts
 *   opts.skipCache   {boolean} — bypass session cache
 *   opts.timeout     {number}  — per-layer timeout ms (default 5000)
 *   opts.onProgress  {fn}      — called with status string at each layer
 *
 * @returns {Promise<ResolvedCompound|null>}
 *   ResolvedCompound: { smiles, cid, name, formula, mw, iupac, source }
 *   source: 'local' | 'cache' | 'backend' | 'pubchem_name' | 'pubchem_cid' | 'fuzzy'
 */
export async function resolveSmiles(query, opts = {}) {
  const { skipCache = false, timeout = 5000, onProgress } = opts
  if (!query?.trim()) return null

  const raw   = query.trim()
  const lower = raw.toLowerCase()

  // ── Detect if input is already a SMILES string ────────────────
  // SMILES contain chars like =, #, (, ), [, ], /, \, @, +, -
  // Drug names are plain alphabetic. Heuristic: if it has = or ( it's SMILES.
  const looksLikeSMILES = /[=()[\]#@+\\/]/.test(raw) && raw.length > 3
  if (looksLikeSMILES) {
    return { smiles: raw, cid: null, name: raw, formula: null, mw: null, iupac: null, source: 'raw_smiles' }
  }

  // ── Detect numeric CID ────────────────────────────────────────
  if (/^\d+$/.test(raw)) {
    const cacheKey = `cid:${raw}`
    if (!skipCache && _cache.has(cacheKey)) return { ..._cache.get(cacheKey), source: 'cache' }
    onProgress?.('Resolving CID via PubChem…')
    const result = await pubchemByCID(parseInt(raw), timeout)
    if (result) {
      const resolved = { ...result, source: 'pubchem_cid' }
      _cache.set(cacheKey, resolved)
      _cache.set(lower, resolved)
      return resolved
    }
    return null
  }

  // ── Layer 2: Session cache ────────────────────────────────────
  if (!skipCache && _cache.has(lower)) {
    return { ..._cache.get(lower), source: 'cache' }
  }

  // ── Layer 1: Local DB ─────────────────────────────────────────
  if (LOCAL_DB[lower]) {
    const resolved = { ...LOCAL_DB[lower], source: 'local' }
    _cache.set(lower, resolved)
    return resolved
  }

  // ── Layer 3: Backend /resolve-smiles ──────────────────────────
  onProgress?.('Checking backend…')
  const backendResult = await backendResolve(raw, Math.min(timeout, 4000))
  if (backendResult?.smiles) {
    const resolved = { ...backendResult, source: 'backend' }
    _cache.set(lower, resolved)
    return resolved
  }

  // ── Layer 4: PubChem by name ──────────────────────────────────
  onProgress?.('Searching PubChem…')
  const pubchemResult = await pubchemByName(raw, timeout)
  if (pubchemResult?.smiles) {
    const resolved = { ...pubchemResult, source: 'pubchem_name' }
    _cache.set(lower, resolved)
    return resolved
  }

  // ── Layer 5: Fuzzy correction → retry PubChem ─────────────────
  const corrected = fuzzyCorrect(lower)
  if (corrected !== lower) {
    onProgress?.(`Trying corrected name: "${corrected}"…`)

    // Check local DB with corrected name
    if (LOCAL_DB[corrected]) {
      const resolved = { ...LOCAL_DB[corrected], source: 'fuzzy' }
      _cache.set(lower, resolved)
      return resolved
    }

    // PubChem with corrected name
    const fuzzyResult = await pubchemByName(corrected, timeout)
    if (fuzzyResult?.smiles) {
      const resolved = { ...fuzzyResult, source: 'fuzzy' }
      _cache.set(lower, resolved)
      return resolved
    }
  }

  return null
}

/**
 * Resolve multiple queries in parallel (up to concurrency limit).
 * Returns array of ResolvedCompound|null in same order as input.
 */
export async function resolveBatch(queries, opts = {}) {
  const { concurrency = 4 } = opts
  const results = new Array(queries.length).fill(null)
  for (let i = 0; i < queries.length; i += concurrency) {
    const chunk = queries.slice(i, i + concurrency)
    const resolved = await Promise.all(chunk.map(q => resolveSmiles(q, opts)))
    resolved.forEach((r, j) => { results[i + j] = r })
  }
  return results
}

/**
 * Quick lookup — returns SMILES string only, or null.
 * Fastest path: local DB → cache → PubChem.
 */
export async function quickSMILES(name, timeout = 5000) {
  const result = await resolveSmiles(name, { timeout })
  return result?.smiles ?? null
}

/**
 * Invalidate a specific cache entry (e.g. after a failed prediction).
 */
export function invalidateCache(name) {
  _cache.delete(name?.toLowerCase?.())
}

/**
 * Clear the entire session cache.
 */
export function clearCache() {
  _cache.clear()
}

/**
 * Get cache stats for debugging.
 */
export function cacheStats() {
  return { size: _cache.size, keys: [..._cache.keys()] }
}

/**
 * Correct common speech-to-text misrecognitions for drug names.
 * Delegates to fuzzyCorrect for systematic matching.
 */
export function correctDrugName(raw) {
  if (!raw) return raw
  const trimmed = raw.toLowerCase().trim()
  const corrected = fuzzyCorrect(trimmed)
  if (corrected && corrected !== trimmed) {
    // Return capitalized version of the canonical name
    return corrected.charAt(0).toUpperCase() + corrected.slice(1)
  }
  // No correction found, just capitalize original
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}
