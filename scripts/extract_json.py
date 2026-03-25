import json
import base64
from pathlib import Path

ROOT = Path('/Users/andoniuria/Library/CloudStorage/GoogleDrive-uriasaiz@gmail.com/Mi unidad/40-49_Trabajo/44_Oposiciones/04_OSAKIDETZA/70_App_Chatelac/chatelac-quiz')
JSON_FILE = ROOT / 'soluciones_chatelac.json'
PUBLIC_DIR = ROOT / 'public'
DATA_DIR = PUBLIC_DIR / 'data'

with open(JSON_FILE, 'r', encoding='utf-8') as f:
    data = json.load(f)

json_updates = {}
saved_images = 0

for key, val in data.items():
    if key.startswith('__json__'):
        parts = key.replace('__json__', '').split('_')
        mod = parts[0]
        qnum = int(parts[1])
        if mod not in json_updates:
            json_updates[mod] = {}
        json_updates[mod][qnum] = val
    else:
        rel_path = key.lstrip('/')
        dest = PUBLIC_DIR / rel_path
        
        dest.parent.mkdir(parents=True, exist_ok=True)
        img_bytes = base64.b64decode(val['b64'])
        dest.write_bytes(img_bytes)
        saved_images += 1

print(f"Extracted {saved_images} images.")

for mod, updates in json_updates.items():
    mod_file = DATA_DIR / f"{mod}.json"
    if not mod_file.exists(): continue
    
    with open(mod_file, 'r', encoding='utf-8') as f:
        mod_data = json.load(f)
        
    updated = 0
    for q in mod_data:
        qnum = q.get('questionNum')
        if qnum in updates:
            q['solutionImages'] = updates[qnum]
            updated += 1
            
    with open(mod_file, 'w', encoding='utf-8') as f:
        json.dump(mod_data, f, ensure_ascii=False, indent=2)
        
    print(f"Updated {updated} questions in {mod}.json")
