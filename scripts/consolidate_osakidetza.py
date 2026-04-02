import json
import glob
import os
from pathlib import Path

DATA_DIR = Path("public/data")

def consolidate(prefix, output_name):
    print(f"Consolidating {prefix}* -> {output_name}...")
    # Get all files except the target output itself
    files = sorted(glob.glob(str(DATA_DIR / f"{prefix}*.json")))
    files = [f for f in files if Path(f).name != output_name]
    
    all_questions = []
    for f in files:
        with open(f, "r", encoding="utf-8") as fh:
            data = json.load(fh)
            if isinstance(data, list):
                all_questions.extend(data)
            else:
                print(f"  [WARN] {f} is not a list, skipping contents.")
    
    # Sort by originalId if available, otherwise by id
    all_questions.sort(key=lambda x: (int(x.get("originalId", 0)) if str(x.get("originalId", "")).isdigit() else 0, x.get("id", "")))
    
    out_path = DATA_DIR / output_name
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(all_questions, fh, ensure_ascii=False, indent=2)
    # Unix newline
    with open(out_path, "a", encoding="utf-8") as fh:
        fh.write("\n")
    
    print(f"  Done. Total questions: {len(all_questions)}")

if __name__ == "__main__":
    consolidate("comun-t", "comun.json")
    consolidate("tec-comun-t", "tec-comun.json")
    consolidate("aux-e", "aux.json")
    # For ADM, we take everything that starts with adm- 
    consolidate("adm-", "adm.json")
