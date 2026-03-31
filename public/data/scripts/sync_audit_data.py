import json
import glob
import os

# Paths
BASE_DIR = "/Users/andoniuria/Library/CloudStorage/GoogleDrive-uriasaiz@gmail.com/Mi unidad/40-49_Trabajo/44_Oposiciones/04_OSAKIDETZA/60_HERRAMIENTAS/App_Osakidetza_Admin"
CLEAN_JSON = os.path.join(BASE_DIR, "public/data/analisis/2026-03-31/CLEAN_CONSENSUS.json")
KAIXO_FILE = os.path.join(BASE_DIR, "public/data/analisis/2026-03-31/raw/kaixo_common_a2.json")
OSASUN_FILE = os.path.join(BASE_DIR, "public/data/analisis/2026-03-31/raw/osasun_nurse.json")
MODULES_PATTERN = os.path.join(BASE_DIR, "public/data/tec-comun-t*.json")

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
    
    print("Loading consensus sources for A2...")
    with open(KAIXO_FILE, 'r', encoding='utf-8') as f:
        kaixo = json.load(f)
    with open(OSASUN_FILE, 'r', encoding='utf-8') as f:
        osasun = json.load(f)
        
    # 1. SPECIAL CASE: Regenerate A2 from modules (preserves our 100% mapping)
    print("Regenerating A2 category from modules...")
    app_qs = []
    module_files = sorted(glob.glob(MODULES_PATTERN))
    for fpath in module_files:
        with open(fpath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            for q in data:
                app_qs.append(q)
    
    new_a2 = []
    for q in app_qs:
        off_id = q.get('officialId')
        if off_id is None: continue
        str_id = str(off_id)
        
        k_ans = cleanup_answer(kaixo.get(str_id))
        o_ans = cleanup_answer(osasun.get(str_id))
        
        app_raw_nums = q.get('correctAnswerNums', [])
        app_ans = "?"
        if app_raw_nums and len(app_raw_nums) > 0:
            app_ans = cleanup_answer(app_raw_nums[0])
        if app_ans == "?" and q.get('answer'):
            app_ans = cleanup_answer(q.get('answer'))
            
        consensus = get_consensus(app_ans, k_ans, o_ans)
            
        new_a2.append({
            "id": q.get('id'),
            "officialId": off_id,
            "text": q.get('question'),
            "app": app_ans,
            "k": k_ans,
            "o": o_ans,
            "consensus": consensus
        })
    clean_data["A2"] = new_a2
    print(f"Updated A2 with {len(new_a2)} questions.")

    # 2. GENERAL CASE: Update consensus for ALL other categories (C2, ADM, AUX, etc.)
    print("Applying universal consensus logic to all other categories...")
    for cat in clean_data:
        if cat == "A2": continue
        
        print(f"Processing category: {cat}...")
        for q in clean_data[cat]:
            # Use existing fields in the JSON
            a_ans = cleanup_answer(q.get('app'))
            k_ans = cleanup_answer(q.get('k'))
            o_ans = cleanup_answer(q.get('o'))
            
            # Re-calculate consensus
            q['consensus'] = get_consensus(a_ans, k_ans, o_ans)
            
    # Save the unified result
    with open(CLEAN_JSON, 'w', encoding='utf-8') as f:
        json.dump(clean_data, f, ensure_ascii=False, indent=2)
    print("Saved updated CLEAN_CONSENSUS.json globally.")

if __name__ == "__main__":
    update_audit_data()
