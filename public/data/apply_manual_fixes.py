import json
import os

fixes = [
    # C2 fixes (Topic 01)
    {
        "file": "public/data/comun-t01.json",
        "id": "comun-t01_7",
        "new_ans": [3]
    },
    {
        "file": "public/data/comun-t01.json",
        "id": "comun-t01_18",
        "new_ans": [4]
    },
    {
        "file": "public/data/comun-t01.json",
        "id": "comun-t01_19",
        "new_ans": [4]
    },
    # ADM fixes
    {
        "file": "public/data/comun-t04.json",
        "id": "comun-t04_87",
        "new_ans": [4]
    },
    {
        "file": "public/data/adm-e09.json",
        "id": "adm-e09_28",
        "new_ans": [4]
    }
]

for fix in fixes:
    path = fix["file"]
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        found = False
        for q in data:
            if q.get("id") == fix["id"]:
                print(f"Fixing {fix['id']} in {path}: {q['correctAnswerNums']} -> {fix['new_ans']}")
                q["correctAnswerNums"] = fix["new_ans"]
                found = True
                break
        
        if found:
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"Saved {path}")
        else:
            print(f"ID {fix['id']} NOT FOUND in {path}")
    else:
        print(f"File {path} DOES NOT EXIST")
