import json
import logging
from pathlib import Path

def merge():
    base = Path("public/data/ugt_respuestas/extracted")
    with open(base / "RESPUESTAS-T.-ESPECIFICO-PREGUNTAS-TECNICOA-SUPERIOR-DE-ADMINISTRACION-Y-GESTION-2.json", encoding="utf-8") as f:
        t_qs = json.load(f)
    with open(base / "RESPUESTAS-T.-ESPECIFICO-SUPUESTOS-PRACTICOS-TECNICOA-SUPERIOR-DE-ADMINISTRACION-Y-GESTION-2.json", encoding="utf-8") as f:
        t_practicos = json.load(f)

    # Filter out entries without correctAnswer (spurious text parsed as questions)
    t_qs = [q for q in t_qs if q.get("correctAnswer")]
    
    # Filter out spurious entries (solution/explanation text parsed as questions)
    t_practicos = [q for q in t_practicos if q.get("correctAnswer")]

    # Adding offset 450 to practical cases
    for q in t_practicos:
        q["id"] += 450

    combined = t_qs + t_practicos
    with open(base / "ugt_tec_consolidado.json", "w", encoding="utf-8") as f:
        json.dump(combined, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    merge()
