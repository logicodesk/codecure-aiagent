from backend.toxiguard_engine import analyze_compound
import json

def run_tests():
    print("🧪 Starting ToxiGuard AI Verification...\n")
    
    test_cases = [
        "aspirin",
        "glucose",
        "CO2",
        "carbon monoxide",
        "H2O",
        "CC(=O)Oc1ccccc1C(=O)O", # Aspirin SMILES
        "C6H12O6",
        "InvalidCompound99XYZ"
    ]

    for query in test_cases:
        print(f"Testing: {query}")
        result = analyze_compound(query)
        print(json.dumps(result, indent=2))
        
        if result["success"]:
            print(f"✅ SUCCESS: {result['smiles']}")
            if not result["descriptors"]:
                print("❌ ERROR: Descriptors missing for successful compound!")
        else:
            print(f"⚠️ EXPECTED FAIL: {result['error']}")
        print("-" * 40)

if __name__ == "__main__":
    run_tests()
