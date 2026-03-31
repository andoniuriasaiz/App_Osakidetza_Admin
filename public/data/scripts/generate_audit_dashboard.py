import json
import os
import glob
from datetime import datetime

# Paths
INPUT_FILES = glob.glob('public/data/tec-comun-t*.json')
KAIXO_PATH = 'public/data/analisis/2026-03-31/raw/kaixo_common_a2.json'
OSASUN_PATH = 'public/data/analisis/2026-03-31/raw/osasun_nurse.json'
OUTPUT_DIR = 'public/data/analisis/2026-03-31'
OUTPUT_FILE = os.path.join(OUTPUT_DIR, 'audit_dashboard.json')

def load_json(path):
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def get_letter(num_list, options):
    if not num_list: return None
    # Assuming standard A, B, C, D mapping (1=A, 2=B, 3=C, 4=D)
    idx = num_list[0] - 1
    if 0 <= idx < len(options):
        # We can just return the letter index if we want (0=A, etc)
        return chr(65 + idx)
    return str(num_list[0])

def generate_dashboard():
    kaixo_data = load_json(KAIXO_PATH)
    osasun_data = load_json(OSASUN_PATH)
    
    # Filter Osasun to first 200 as per user rule
    osasun_filtered = {k: v for k, v in osasun_data.items() if int(k) <= 200}
    
    stats = {
        "total_questions": 0,
        "questions_with_official_id": 0,
        "discrepancies": 0,
        "red_flags": 0, # Both external sources agree but differ from App
        "raw_data": []
    }
    
    for file_path in sorted(INPUT_FILES):
        data = load_json(file_path)
        for q in data:
            stats["total_questions"] += 1
            official_id = q.get('officialId')
            if not official_id:
                continue
            
            stats["questions_with_official_id"] += 1
            off_id_str = str(official_id)
            
            app_ans = get_letter(q.get('correctAnswerNums'), q.get('options'))
            kaixo_ans = kaixo_data.get(off_id_str)
            osasun_ans = osasun_filtered.get(off_id_str)
            
            issue = False
            red_flag = False
            
            # Comparison logic
            # Kaixo and Osasun might return multiple letters like "AD" or "BC"
            # We treat them as matching if the app answer is one of them? 
            # Or strict match? Standard is strict match.
            
            if kaixo_ans and app_ans != kaixo_ans:
                issue = True
            if osasun_ans and app_ans != osasun_ans:
                issue = True
                
            # Red Flag: Both agree but differ from App
            if kaixo_ans and osasun_ans and kaixo_ans == osasun_ans and app_ans != kaixo_ans:
                red_flag = True
                stats["red_flags"] += 1
            
            if issue:
                stats["discrepancies"] += 1
                stats["raw_data"].append({
                    "id": q.get('id'),
                    "officialId": official_id,
                    "question": q.get('question'),
                    "app": app_ans,
                    "kaixo": kaixo_ans,
                    "osasun": osasun_ans,
                    "isRedFlag": red_flag,
                    "file": os.path.basename(file_path)
                })
                
    # Save output
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)
    
    print(f"Finished generating dashboard.")
    print(f"  Total Questions: {stats['total_questions']}")
    print(f"  Mapped Questions: {stats['questions_with_official_id']}")
    print(f"  Discrepancies found: {stats['discrepancies']}")
    print(f"  Red Flags (Consensus discrepancy): {stats['red_flags']}")
    print(f"Dashboard saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    generate_dashboard()
