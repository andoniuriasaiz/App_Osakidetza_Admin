import json
import os
import glob

# Paths
BASE_DIR = "/Users/andoniuria/Library/CloudStorage/GoogleDrive-uriasaiz@gmail.com/Mi unidad/40-49_Trabajo/44_Oposiciones/04_OSAKIDETZA/60_HERRAMIENTAS/App_Osakidetza_Admin"
CLEAN_JSON = os.path.join(BASE_DIR, "public/data/analisis/2026-03-31/CLEAN_CONSENSUS.json")
MODULES_DIR = os.path.join(BASE_DIR, "public/data")

# Consolidated files mapping
CONSOLIDATED_MAP = {
    "A2": "tec-comun.json",
    "C2": "comun.json",
    "ADM": "adm.json",
    "AUX": "aux.json"
}

LETTER_TO_NUM = {"A": 1, "B": 2, "C": 3, "D": 4}

def apply_global_red_flags():
    print("Loading audit results from CLEAN_CONSENSUS.json...")
    with open(CLEAN_JSON, 'r', encoding='utf-8') as f:
        audit_data = json.load(f)
    
    # 1. Collect all Red Flags across ALL categories
    # Definition: App != Consensus AND Consensus is clear (not ???)
    all_red_flags = {} # id -> correct_letter
    for cat in audit_data:
        for q in audit_data[cat]:
            a = q.get('app')
            c = q.get('consensus')
            q_id = q.get('id')
            if c and c != "?" and c != "???" and a != c:
                all_red_flags[q_id] = c
            
    print(f"Total Red Flags to apply globally: {len(all_red_flags)}")
    if not all_red_flags:
        print("No red flags found to correct.")
        return

    # 2. Map IDs to specific source files
    # We will iterate through all JSON files once and update them if they contain target IDs
    json_files = glob.glob(os.path.join(MODULES_DIR, "*.json"))
    total_corrected = 0
    updated_files_count = 0
    
    for fpath in json_files:
        fname = os.path.basename(fpath)
        # Skip consolidated files initially or process them together? 
        # Better: process EVERYTHING, including consolidated files.
        
        with open(fpath, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError:
                continue
        
        if not isinstance(data, list): continue # Skip if not a question list
        
        modified = False
        file_corrections = 0
        for q in data:
            q_id = q.get("id")
            if q_id in all_red_flags:
                new_letter = all_red_flags[q_id]
                new_num = LETTER_TO_NUM.get(new_letter)
                
                if new_num:
                    q['correctAnswerNums'] = [new_num]
                    # Update correctAnswers text
                    for opt in q.get('options', []):
                        if opt.get('value') == new_num:
                            q['correctAnswers'] = [opt.get('text')]
                            break
                    
                    # Update explanation if possible
                    q['explanation'] = (q.get('explanation', '') + 
                                       f"\n[AUTO-AUDIT 2026-03-31]: Corrected to {new_letter} based on Kaixo/Osasun consensus.").strip()
                    
                    modified = True
                    file_corrections += 1
        
        if modified:
            with open(fpath, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"  Fixed {file_corrections} questions in {fname}")
            total_corrected += file_corrections
            updated_files_count += 1

    print(f"\nCorrection complete.")
    print(f"Total Unique Questions Corrected: {len(all_red_flags)}")
    print(f"Total Instances Updated (Individual + Consolidated): {total_corrected}")
    print(f"Files Modified: {updated_files_count}")

if __name__ == "__main__":
    apply_global_red_flags()
