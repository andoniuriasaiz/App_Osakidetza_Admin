import json
import re
import difflib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
DATA_DIR = ROOT / "public" / "data"
OUT_DIR = ROOT / "osasuntest_output"

def norm_text(t: str) -> str:
    if not t: return ""
    t = t.lower().strip()
    t = re.sub(r"^\s*\d+[\.\-\)]\s*", "", t)
    return re.sub(r"[^a-z0-9áéíóúñü]", "", t)[:120]

def debug_adm_misses():
    app_data = json.load(open(DATA_DIR / "adm.json", encoding="utf-8"))
    osa_data = json.load(open(OUT_DIR / "osasuntest_adm_especifico.json", encoding="utf-8"))
    
    osa_index = {norm_text(q["question"]): q for q in osa_data}
    osa_texts = list(osa_index.keys())
    
    print(f"Debug ADM Misses (First 5):")
    count = 0
    for q in app_data:
        nt = norm_text(q["question"])
        if nt not in osa_index:
            closest = difflib.get_close_matches(nt, osa_texts, n=1, cutoff=0.1)
            orig_id = q.get("originalId") or q.get("questionNum")
            print(f"\nApp Question (ID {orig_id}):")
            # print(f"  Raw: {q['question'][:100]}...")
            if closest:
                match = osa_index[closest[0]]
                ratio = difflib.SequenceMatcher(None, nt, closest[0]).ratio()
                print(f"  Closest Osasun ({ratio:.2f}):")
                print(f"    Raw: {match['question'][:100]}...")
            
            count += 1
            if count >= 5: break

if __name__ == "__main__":
    debug_adm_misses()
