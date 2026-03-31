import json
import re
import os
import glob

def normalize(text):
    if not text: return ""
    # Remove extra whitespace, newlines, and convert to lowercase
    text = re.sub(r'\s+', ' ', text).strip().lower()
    # Remove common prefixes from PDF text if they slipped in
    text = re.sub(r'^\d+\.- ', '', text)
    return text

def extract_pdf_mapping(txt_path):
    with open(txt_path, 'r', encoding='utf-8') as f:
        text = f.read()
    
    # Split by numbering like '1.- ', '2.- '
    parts = re.split(r'\n(\d+)\.-', '\n' + text)
    mapping = {}
    
    # parts[0] is empty or header
    for i in range(1, len(parts), 2):
        num = parts[i]
        content = parts[i+1]
        
        # Extract just the question text (before the options A, B, C, D)
        q_text_match = re.split(r'\n[A-D]\)', content)
        q_text = q_text_match[0]
        
        norm_q = normalize(q_text)
        if norm_q:
            mapping[norm_q] = int(num)
            # Also store a shorter version for fuzzy matching if needed
            mapping[norm_q[:100]] = int(num)
            
    return mapping

def update_json_files(mapping):
    json_files = glob.glob('public/data/tec-comun-t*.json')
    total_updated = 0
    total_skipped = 0
    
    for file_path in json_files:
        print(f"Processing {file_path}...")
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        changed = False
        for q in data:
            norm_app = normalize(q['question'])
            
            # Try exact match first
            pdf_id = mapping.get(norm_app)
            
            # Try prefix match if exact fails
            if not pdf_id:
                pdf_id = mapping.get(norm_app[:100])
                
            if pdf_id:
                if q.get('originalId') != pdf_id:
                    q['originalId'] = pdf_id
                    changed = True
                    total_updated += 1
            else:
                print(f"  Warning: No match for question: {q['question'][:60]}...")
                total_skipped += 1
                
        if changed:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"  Updated {file_path}")
            
    print(f"\nFinal Summary: Updated {total_updated} questions, Skipped {total_skipped}.")

if __name__ == "__main__":
    pdf_txt = "/tmp/temario_comun.txt"
    if os.path.exists(pdf_txt):
        pdf_mapping = extract_pdf_mapping(pdf_txt)
        print(f"Mapped {len(pdf_mapping)} entries from PDF.")
        update_json_files(pdf_mapping)
    else:
        print("PDF text file not found!")
