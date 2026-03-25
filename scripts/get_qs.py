import json
from pathlib import Path

ROOT = Path('/Users/andoniuria/Library/CloudStorage/GoogleDrive-uriasaiz@gmail.com/Mi unidad/40-49_Trabajo/44_Oposiciones/04_OSAKIDETZA/70_App_Chatelac/chatelac-quiz')
DATA_DIR = ROOT / 'public' / 'data'

modules = ["access-basico", "excel-avanzado", "powerpoint", "word-avanzado"]
output = {}

for m in modules:
    path = DATA_DIR / f"{m}.json"
    if path.exists():
        with open(path) as f:
            data = json.load(f)
        qs = [q['questionNum'] for q in data if q.get('type') == 'B']
        output[m] = qs
    
print(json.dumps(output))
