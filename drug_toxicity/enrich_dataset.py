"""
enrich_dataset.py — Enriches curated_drugs.csv with pharmacological metadata.
Usage: python drug_toxicity/enrich_dataset.py
"""
import os, csv

_HERE = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(_HERE, "curated_drugs.csv")

NEW_COLS = [
    "cas_number","iupac_name","synonyms","mechanism_of_action",
    "therapeutic_category","route_of_administration","half_life",
    "protein_binding","bioavailability","side_effects","contraindications",
    "pregnancy_category","fda_status","year_approved","target_protein","pubchem_cid"
]

# (cas, iupac, synonyms, mechanism, therapeutic_category, route,
#  half_life, protein_binding, bioavailability, side_effects,
#  contraindications, pregnancy_cat, fda_status, year_approved,
#  target_protein, pubchem_cid)
ENRICHMENT = {
"Paracetamol":("103-90-2","N-(4-hydroxyphenyl)acetamide","Acetaminophen; Tylenol; Panadol","Inhibits prostaglandin synthesis centrally","Analgesic / Antipyretic","Oral; IV; Rectal","2-3 h","10-25%","~88%","Hepatotoxicity (overdose); nausea; rash","Severe hepatic impairment; hypersensitivity","B","Approved",1955,"COX-1/COX-2 (weak)",1983),
"Aspirin":("50-78-2","2-acetyloxybenzoic acid","Acetylsalicylic acid; Bayer Aspirin","Irreversibly inhibits COX-1 and COX-2","NSAID / Antiplatelet","Oral","15-20 min (aspirin); 3-5 h (salicylate)","80-90%","~80%","GI bleeding; peptic ulcer; Reye syndrome","Children with viral illness; active GI bleeding","D","Approved",1899,"COX-1/COX-2",2244),
"Ibuprofen":("15687-27-1","2-[4-(2-methylpropyl)phenyl]propanoic acid","Advil; Motrin; Nurofen","Reversibly inhibits COX-1 and COX-2","NSAID","Oral; IV; Topical","2 h","99%","~80%","GI upset; peptic ulcer; renal impairment; cardiovascular risk","Active GI bleeding; severe renal/hepatic impairment; 3rd trimester pregnancy","C/D","Approved",1969,"COX-1/COX-2",3672),
"Diclofenac":("15307-86-5","2-[2-(2,6-dichloroanilino)phenyl]acetic acid","Voltaren; Cataflam","Preferential COX-2 inhibitor","NSAID","Oral; Topical; IM","1-2 h","99%","~54%","GI bleeding; hepatotoxicity; cardiovascular events","Active GI bleeding; severe heart failure; 3rd trimester pregnancy","C/D","Approved",1974,"COX-2",3033),
"Naproxen":("22204-53-1","(S)-2-(6-methoxynaphthalen-2-yl)propanoic acid","Aleve; Naprosyn","Non-selective COX inhibitor; longer half-life","NSAID","Oral","12-17 h","99%","~95%","GI bleeding; cardiovascular risk; renal impairment","Active GI bleeding; severe renal impairment; 3rd trimester pregnancy","C/D","Approved",1976,"COX-1/COX-2",156391),
"Indomethacin":("53-86-1","2-[1-(4-chlorobenzoyl)-5-methoxy-2-methylindol-3-yl]acetic acid","Indocin; Indocid","Potent non-selective COX inhibitor","NSAID","Oral; IV; Rectal","4.5 h","99%","~100%","Severe GI toxicity; headache; renal impairment","Active GI bleeding; severe renal impairment","C/D","Approved",1965,"COX-1/COX-2",3715),
"Ketorolac":("74103-06-3","(RS)-5-benzoyl-2,3-dihydro-1H-pyrrolizine-1-carboxylic acid","Toradol; Acular","Potent non-selective COX inhibitor","NSAID","Oral; IM; IV","5-6 h","99%","~100%","GI bleeding; renal impairment; platelet inhibition","Active GI bleeding; renal impairment; >5 days use","C/D","Approved",1989,"COX-1/COX-2",3826),
"Celecoxib":("169590-42-5","4-[5-(4-methylphenyl)-3-(trifluoromethyl)pyrazol-1-yl]benzenesulfonamide","Celebrex; Onsenal","Selective COX-2 inhibitor","NSAID / COX-2 Inhibitor","Oral","11 h","97%","~99%","Cardiovascular events; GI upset; edema","Sulfonamide allergy; post-CABG; severe hepatic impairment","C/D","Approved",1998,"COX-2",2662),
"Etoricoxib":("202409-33-4","5-chloro-6'-methyl-3-[4-(methylsulfonyl)phenyl]-2,3'-bipyridine","Arcoxia","Highly selective COX-2 inhibitor","NSAID / COX-2 Inhibitor","Oral","22 h","92%","~100%","Cardiovascular events; hypertension; edema","Uncontrolled hypertension; post-CABG","C/D","Approved (non-US)",2002,"COX-2",123619),
"Mefenamic acid":("61-68-7","2-(2,3-dimethylphenyl)aminobenzoic acid","Ponstel; Ponstan","Non-selective COX inhibitor","NSAID","Oral","2 h","90%","~90%","GI upset; diarrhea; hemolytic anemia","Active GI disease; renal impairment; >7 days use","C/D","Approved",1967,"COX-1/COX-2",4044),
"Piroxicam":("36322-90-4","4-hydroxy-2-methyl-N-(pyridin-2-yl)-2H-1,2-benzothiazine-3-carboxamide 1,1-dioxide","Feldene","Long-acting non-selective COX inhibitor","NSAID","Oral; Topical","50 h","99%","~100%","GI bleeding; peptic ulcer; photosensitivity","Active GI bleeding; severe renal/hepatic impairment","C/D","Approved",1982,"COX-1/COX-2",54676228),
"Meloxicam":("71125-38-7","4-hydroxy-2-methyl-N-(5-methylthiazol-2-yl)-2H-1,2-benzothiazine-3-carboxamide 1,1-dioxide","Mobic; Movalis","Preferential COX-2 inhibitor at therapeutic doses","NSAID","Oral; IM","15-20 h","99%","~89%","GI upset; edema; renal impairment","Active GI bleeding; severe renal/hepatic impairment","C/D","Approved",1996,"COX-2",54677470),
}

ENRICHMENT.update({
"Amoxicillin":("26787-78-0","(2S,5R,6R)-6-[[(2R)-2-amino-2-(4-hydroxyphenyl)acetyl]amino]-3,3-dimethyl-7-oxo-4-thia-1-azabicyclo[3.2.0]heptane-2-carboxylic acid","Amoxil; Trimox","Inhibits bacterial cell wall synthesis by binding PBPs","Antibiotic","Oral; IM; IV","1-1.5 h","17%","~93%","Diarrhea; rash; nausea; hypersensitivity","Penicillin allergy; mononucleosis","B","Approved",1972,"Penicillin-binding proteins (PBPs)",33613),
"Ampicillin":("69-53-4","(2S,5R,6R)-6-[[(2R)-2-amino-2-phenylacetyl]amino]-3,3-dimethyl-7-oxo-4-thia-1-azabicyclo[3.2.0]heptane-2-carboxylic acid","Principen; Omnipen","Inhibits bacterial cell wall synthesis; broader spectrum than penicillin G","Antibiotic","Oral; IM; IV","1-1.5 h","15-25%","~40%","Diarrhea; rash; nausea; hypersensitivity","Penicillin allergy; mononucleosis","B","Approved",1961,"Penicillin-binding proteins (PBPs)",6249),
"Penicillin G":("61-33-6","(2S,5R,6R)-3,3-dimethyl-7-oxo-6-[(2-phenylacetyl)amino]-4-thia-1-azabicyclo[3.2.0]heptane-2-carboxylic acid","Benzylpenicillin; Pfizerpen","Inhibits bacterial cell wall synthesis; bactericidal","Antibiotic","IM; IV","30 min","60%","N/A (parenteral)","Hypersensitivity; anaphylaxis; neurotoxicity (high doses)","Penicillin allergy","B","Approved",1942,"Penicillin-binding proteins (PBPs)",5743),
"Penicillin V":("87-08-1","(2S,5R,6R)-3,3-dimethyl-7-oxo-6-[[(2R)-2-phenoxyacetyl]amino]-4-thia-1-azabicyclo[3.2.0]heptane-2-carboxylic acid","Phenoxymethylpenicillin; Pen-Vee K","Acid-stable oral penicillin; inhibits PBPs","Antibiotic","Oral","30-60 min","75-80%","~60%","Hypersensitivity; GI upset; diarrhea","Penicillin allergy","B","Approved",1954,"Penicillin-binding proteins (PBPs)",6869),
"Ciprofloxacin":("85721-33-1","1-cyclopropyl-6-fluoro-4-oxo-7-(piperazin-1-yl)quinoline-3-carboxylic acid","Cipro; Ciproxin","Inhibits ba