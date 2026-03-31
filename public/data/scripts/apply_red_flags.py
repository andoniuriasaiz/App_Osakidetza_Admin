import json
import os
import glob

# Paths
BASE_DIR = "/Users/andoniuria/Library/CloudStorage/GoogleDrive-uriasaiz@gmail.com/Mi unidad/40-49_Trabajo/44_Oposiciones/04_OSAKIDETZA/60_HERRAMIENTAS/App_Osakidetza_Admin"
CLEAN_JSON = os.path.join(BASE_DIR, "public/data/analisis/2026-03-31/CLEAN_CONSENSUS.json")
MODULES_DIR = os.path.join(BASE_DIR, "public/data")
CONSOLIDATED_FILE = os.path.join(BASE_DIR, "public/data/tec-comun.json")

LETTER_TO_NUM = {"A": 1, "B": 2, "C": 3, "D": 4}

def apply_red_flags():
    print("Loading audit results from CLEAN_CONSENSUS.json...")
    with open(CLEAN_JSON, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Identify Red Flags in A2 (Common Syllabus)
    red_flags = {} # id -> correct_letter
    for q in data.get("A2", []):
        # A Red Flag is where App != Consensus AND Consensus is clear (not ???)
        a = q['app']
        c = q['consensus']
        if c and c != "?" and c != "???" and a != c:
            red_flags[q['id']] = c
            
    print(f"Total Red Flags to apply: {len(red_flags)}")
    if not red_flags:
        print("No red flags found to correct.")
        return

    # Update individual modules
    module_files = glob.glob(os.path.join(MODULES_DIR, "tec-comun-t*.json"))
    total_corrected = 0
    
    for fpath in module_files:
        print(f"Processing module: {os.path.basename(fpath)}...")
        with open(fpath, 'r', encoding='utf-8') as f:
            module_data = json.load(f)
        
        modified = False
        for q in module_data:
            q_id = q.get("id")
            if q_id in red_flags:
                new_letter = red_flags[q_id]
                new_num = LETTER_TO_NUM.get(new_letter)
                
                if new_num:
                    print(f"  Fixing {q_id}: {q.get('correctAnswers')} -> ['{new_letter}']")
                    q['correctAnswerNums'] = [new_num]
                    
                    # Update correctAnswers text based on the mapped option
                    for opt in q.get('options', []):
                        if opt.get('value') == new_num:
                            q['correctAnswers'] = [opt.get('text')]
                            break
                    
                    # Add automatic audit note to explanation
                    q['explanation'] = (q.get('explanation', '') + 
                                       f"\n[AUTO-AUDIT 2026-03-31]: Corrected based on Kaixo/Osasun consensus. Previous answer was incorrect.").strip()
                    
                    modified = True
                    total_corrected += 1
        
        if modified:
            with open(fpath, 'w', encoding='utf-8') as f:
                json.dump(module_data, f, ensure_ascii=False, indent=2)
            print(f"  Saved {os.path.basename(fpath)}")

    # Update consolidated file
    print(f"Updating consolidated file: {os.path.basename(CONSOLIDATED_FILE)}...")
    if os.path.exists(CONSOLIDATED_FILE):
        with open(CONSOLIDATED_FILE, 'r', encoding='utf-8') as f:
            consolidated_data = json.load(f)
        
        for q in consolidated_data:
            q_id = q.get("id")
            if q_id in red_flags:
                new_letter = red_flags[q_id]
                new_num = LETTER_TO_NUM.get(new_letter)
                if new_num:
                    q['correctAnswerNums'] = [new_num]
                    for opt in q.get('options', []):
                        if opt.get('value') == new_num:
                            q['correctAnswers'] = [opt.get('text')]
                            break
                    q['explanation'] = (q.get('explanation', '') + 
                                       f"\n[AUTO-AUDIT 2026-03-31]: Corrected based on Kaixo/Osasun consensus.").strip()
        
        with open(CONSOLIDATED_FILE, 'w', encoding='utf-8') as f:
            json.dump(consolidated_data, f, ensure_ascii=False, indent=2)
        print("  Saved consolidated file.")

    print(f"Correction complete. Total questions updated: {total_corrected}")

if __name__ == "__main__":
    apply_red_flags()
