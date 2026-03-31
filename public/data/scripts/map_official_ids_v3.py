import json
import re
import os
import glob

def normalize(text):
    if not text: return ""
    # Remove extra whitespace, newlines, and convert to lowercase
    text = re.sub(r'\s+', ' ', text).strip().lower()
    # Remove common prefixes like '1.- ' or '1.-'
    text = re.sub(r'^\d+\s*[\.-]\s*', '', text)
    return text

def extract_pdf_mapping(txt_path):
    with open(txt_path, 'r', encoding='utf-8') as f:
        text = f.read()
    
    # Split by numbering like '1.- ', '2.- '
    parts = re.split(r'\n(\d+)\.-', '\n' + text)
    mapping = {}
    
    for i in range(1, len(parts), 2):
        num = parts[i]
        content = parts[i+1]
        
        # Extract just the question text (before the options A, B, C, D)
        q_text_match = re.split(r'\n[A-D]\)', content)
        q_text = q_text_match[0]
        
        norm_q = normalize(q_text)
        if norm_q:
            mapping[norm_q] = int(num)
            # Prefix mapping for robustness
            mapping[norm_q[:150]] = int(num)
            
    return mapping

def update_json_files(mapping):
    # Process ALL tec-comun files
    json_files = sorted(glob.glob('public/data/tec-comun-t*.json'))
    total_matches = 0
    
    for file_path in json_files:
        print(f"Checking {file_path}...")
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        changed = False
        for q in data:
            norm_app = normalize(q.get('question', ''))
            
            # Match
            pdf_id = mapping.get(norm_app) or mapping.get(norm_app[:150])
            
            if pdf_id:
                if q.get('originalId') != pdf_id:
                    q['originalId'] = pdf_id
                    changed = True
                    total_matches += 1
        
        if changed:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                f.flush()
                os.fsync(f.fileno())
            print(f"  SUCCESS: Updated {file_path}")
            
    print(f"\nFinished. Total originalIds assigned: {total_matches}")

if __name__ == "__main__":
    pdf_txt = "/tmp/temario_comun_v2.txt"
    if os.path.exists(pdf_txt):
        pdf_mapping = extract_pdf_mapping(pdf_txt)
        print(f"Parsed {len(pdf_mapping)} questions from PDF text.")
        update_json_files(pdf_mapping)
    else:
        print("ERROR: PDF text not found at /tmp/temario_comun_v2.txt")
