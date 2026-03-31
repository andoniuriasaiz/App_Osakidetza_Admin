import json
import re
import os
import glob
from pypdf import PdfReader
from difflib import SequenceMatcher

# Paths
PDF_PATH = "/Users/andoniuria/Library/CloudStorage/GoogleDrive-uriasaiz@gmail.com/Mi unidad/40-49_Trabajo/44_Oposiciones/04_OSAKIDETZA/20_BATERIA_PREGUNTAS/05_comun_A1_tec_superiror_admon.pdf"
# Target individual modules (Exactly 200 questions total)
JSON_FILES = sorted(glob.glob('public/data/tec-comun-t*.json'))

def normalize(text):
    if not text: return ""
    # Standardize whitespace and case
    text = re.sub(r'\s+', ' ', text).strip().lower()
    # Normalize abbreviations
    replacements = {
        "sns": "sistema nacional de salud",
        "c.a.": "comunidad autónoma",
        "osi": "organizaciones sanitarias integradas",
        "osis": "organizaciones sanitarias integradas",
        "lo": "ley organica",
        "ley organica": "lo", # simplify both ways for matching
        "ee.uu.": "estados unidos",
        "art.": "articulo",
        "d.": "decreto",
        "d.l.": "decreto legislativo"
    }
    for k, v in replacements.items():
        text = text.replace(k, v)
    # Strip legislative dates (e.g., "de 24 de marzo", "de 16 de julio")
    text = re.sub(r'de \d+ de [a-z]+', '', text)
    # Remove accents and all non-alphanumeric
    text = text.replace('á','a').replace('é','e').replace('í','i').replace('ó','o').replace('ú','u').replace('ñ','n').replace('ü','u')
    text = re.sub(r'[^a-z0-9]', '', text)
    return text

def similarity(a, b):
    # Quick token-based similarity
    a_set = set(re.findall(r'\w+', a.lower()))
    b_set = set(re.findall(r'\w+', b.lower()))
    if not a_set or not b_set: return 0
    return len(a_set & b_set) / min(len(a_set), len(b_set))

def extract_pdf_mapping(pdf_path):
    print(f"Extracting text from {pdf_path}...")
    reader = PdfReader(pdf_path)
    full_text = "\n".join([p.extract_text() for p in reader.pages])
    
    # Split by numbering: e.g., "1.- " or "1. " at the start of a line
    parts = re.split(r'\n\s*(\d+)\s*[\.\s-]+', '\n' + full_text)
    mapping = {} # Normalized -> ID
    raw_questions = {} # ID -> Raw Text
    
    for i in range(1, len(parts), 2):
        num = int(parts[i])
        content = parts[i+1]
        
        # Stop at options
        q_text_match = re.split(r'\n\s*[a-dA-D][\)\.]\s+', content)
        q_text = q_text_match[0].replace('\n', ' ').strip()
        
        norm_q = normalize(q_text)
        if norm_q:
            mapping[norm_q] = num
            raw_questions[num] = q_text
            # Prefix mapping
            if len(norm_q) > 50:
                prefix = norm_q[:50]
                if prefix not in mapping:
                    mapping[prefix] = num

    return mapping, raw_questions

def update_json_files(mapping, raw_pdf_qs):
    total_matches = 0
    total_questions = 0
    missing_questions = []
    mapped_ids = set()
    
    # Priority Match - First pass: Exact/Prefix
    all_qs = []
    for file_path in JSON_FILES:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            for q in data:
                all_qs.append({'file': os.path.basename(file_path), 'data': data, 'q': q})

    for entry in all_qs:
        q = entry['q']
        total_questions += 1
        norm_app = normalize(q.get('question', ''))
        
        pdf_id = mapping.get(norm_app) or mapping.get(norm_app[:50])
        if pdf_id:
            q['officialId'] = pdf_id
            mapped_ids.add(pdf_id)
            total_matches += 1
        else:
            missing_questions.append(entry)

    # Fuzzy Match - Second pass: for missing ones
    print(f"Attempting fuzzy match for {len(missing_questions)} questions...")
    still_missing = []
    for entry in missing_questions:
        q = entry['q']
        app_text = q.get('question', '')
        
        best_match_id = None
        best_score = 0
        
        # Iterate through PDF questions (only those not already mapped if possible, or all)
        for pdf_id, pdf_text in raw_pdf_qs.items():
            # Higher score if they share unique identifiers like "53/1984" or "3/2021"
            score = similarity(app_text, pdf_text)
            
            # Boost score for legislative numbers
            nums_app = re.findall(r'\d+/\d+', app_text)
            nums_pdf = re.findall(r'\d+/\d+', pdf_text)
            if nums_app and nums_pdf and set(nums_app) == set(nums_pdf):
                score += 0.5
            
            if score > best_score:
                best_score = score
                best_match_id = pdf_id
        
        if best_score > 0.6: # Confidence threshold
            q['officialId'] = best_match_id
            total_matches += 1
        else:
            still_missing.append(entry)

    # Save results
    for file_path in JSON_FILES:
        # Re-save each file (the objects in all_qs are references to the loaded data)
        # Wait, I need to load them uniquely or use the all_qs objects correctly.
        # Actually, let's just save the main files.
        fname = os.path.basename(file_path)
        # Find questions for this file in all_qs
        file_data = [e['data'] for e in all_qs if e['file'] == fname][0]
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(file_data, f, ensure_ascii=False, indent=2)
        print(f"Saved {fname}")
            
    print(f"\nFinal Summary:")
    print(f"  Total questions checked: {total_questions}")
    print(f"  Total officialIds mapped: {total_matches}")
    print(f"  Match rate: {total_matches/total_questions:.1%}")
    
    if still_missing:
        print("\nStill Missing Mapping:")
        for sm in still_missing:
            print(f"  {sm['file']} / {sm['q']['id']}: {sm['q']['question'][:100]}...")
    else:
        print("\nSUCCESS: 100% Mapping Achievement Unlocked!")

if __name__ == "__main__":
    if os.path.exists(PDF_PATH):
        pdf_mapping, raw_pdf_qs = extract_pdf_mapping(PDF_PATH)
        print(f"Parsed {len(raw_pdf_qs)} questions from PDF.")
        update_json_files(pdf_mapping, raw_pdf_qs)
    else:
        print(f"ERROR: PDF not found at {PDF_PATH}")
