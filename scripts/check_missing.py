import json
from pathlib import Path

DATA_DIR = Path('public/data')
missing = {}

for p in DATA_DIR.glob('*.json'):
    mod = p.stem
    with open(p, 'r') as f:
        data = json.load(f)
    for q in data:
        # We only really care about simulation (type B) since those failed
        # BUT let's just grab ANY question that has no solutionImages but is not type C maybe?
        if 'solutionImages' not in q or len(q['solutionImages']) == 0:
            if mod not in missing:
                missing[mod] = []
            missing[mod].append(q['questionNum'])

print("const qs_missing = " + json.dumps(missing) + ";")
