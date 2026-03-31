import json
import glob
import os

# Paths
BASE_DIR = "/Users/andoniuria/Library/CloudStorage/GoogleDrive-uriasaiz@gmail.com/Mi unidad/40-49_Trabajo/44_Oposiciones/04_OSAKIDETZA/60_HERRAMIENTAS/App_Osakidetza_Admin"
CLEAN_JSON = os.path.join(BASE_DIR, "public/data/analisis/2026-03-31/CLEAN_CONSENSUS.json")
KAIXO_FILE = os.path.join(BASE_DIR, "public/data/analisis/2026-03-31/raw/kaixo_common_a2.json")
OSASUN_FILE = os.path.join(BASE_DIR, "public/data/analisis/2026-03-31/raw/osasun_nurse.json")
DATA_DIR = os.path.join(BASE_DIR, "public/data")

def cleanup_answer(ans):
    if ans is None or ans == "?": return "?"
    
    # Handle numeric values from App (1, 2, 3, 4 -> A, B, C, D)
    mapping = {1: 'A', 2: 'B', 3: 'C', 4: 'D', "1": "A", "2": "B", "3": "C", "4": "D"}
    if ans in mapping:
        return mapping[ans]
    
    # Handle string letters
    s_ans = str(ans).strip().upper()
    if not s_ans: return "?"
    
    if len(s_ans) > 1:
        if 'D' in s_ans: return 'D'
        return s_ans[0]
    return s_ans

def get_consensus(a, k, o):
    """Majority Voting Consensus Logic"""
    # Priority 1: Kaixo and Osasun agree
    if k != "?" and o != "?" and k == o:
        return k
    # Priority 2: App and Kaixo agree (during dispute)
    elif a != "?" and k != "?" and a == k:
        return a
    # Priority 3: App and Osasun agree (during dispute)
    elif a != "?" and o != "?" and a == o:
        return a
    # Priority 4: If only one exists, use that
    elif k != "?" and o == "?":
        return k
    elif o != "?" and k == "?":
        return o
    # Priority 5: Fallback to dispute
    elif k != "?" and o != "?" and k != o:
        return "???"
    return "?"

def update_audit_data():
    print("Loading existing CLEAN_CONSENSUS.json...")
    with open(CLEAN_JSON, 'r', encoding='utf-8') as f:
        clean_data = json.load(f)
    
    print("Building MASTER App Dictionary from study modules...")
    master_app = {} # id -> answer_letter
    json_files = glob.glob(os.path.join(DATA_DIR, "*.json"))
    for fpath in json_files:
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except: continue
        if not isinstance(data, list): continue
        
        for q in data:
            q_id = q.get('id')
            if not q_id: continue
            
            # Answer extraction
            app_raw_nums = q.get('correctAnswerNums', [])
            app_ans = "?"
            if app_raw_nums and len(app_raw_nums) > 0:
                app_ans = cleanup_answer(app_raw_nums[0])
            if app_ans == "?" and q.get('answer'):
                app_ans = cleanup_answer(q.get('answer'))
            
            master_app[q_id] = app_ans
    
    print(f"Master Dictionary loaded with {len(master_app)} answers.")
    
    # Refresh all categories in CLEAN_CONSENSUS
    print("Refreshing audit records for all categories...")
    updated_count = 0
    categories = list(clean_data.keys())
    
    for cat in categories:
        print(f"Updating category {cat}...")
        for q in clean_data[cat]:
            q_id = q.get('id')
            if q_id in master_app:
                # Refresh APP answer from current module state
                current_app_ans = master_app[q_id]
                q['app'] = current_app_ans
                
                # Re-calculate consensus
                q['consensus'] = get_consensus(current_app_ans, q.get('k', '?'), q.get('o', '?'))
                updated_count += 1
            
    # Save the updated result
    with open(CLEAN_JSON, 'w', encoding='utf-8') as f:
        json.dump(clean_data, f, ensure_ascii=False, indent=2)
    print(f"Saved updated CLEAN_CONSENSUS.json. Total records refreshed: {updated_count}")

if __name__ == "__main__":
    update_audit_data()
