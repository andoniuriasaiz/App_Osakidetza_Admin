"""
consolidator.py — Fusión de archivos JSON individuales en archivos maestros
=========================================================================
Este módulo se encarga de leer los archivos por temas (ej: comun-t01.json)
y los combina en los archivos consolidados que usa la aplicación (ej: comun.json).
"""

import json
import glob
from pathlib import Path
import sys

# ── Configurar path para importar config ──────────────────────────────────────
_HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(_HERE))
from config import DATA_DIR, CATEGORIES


def consolidate_category(prefix: str, output_name: str) -> int:
    """
    Busca archivos que empiecen por 'prefix' y los une en 'output_name'.
    Retorna el número total de preguntas procesadas.
    """
    # Buscar todos los archivos .json que empiecen por el prefijo
    pattern = str(DATA_DIR / f"{prefix}*.json")
    files = sorted(glob.glob(pattern))
    
    # Excluir el propio archivo de salida si ya existe y coincide con el patrón
    files = [f for f in files if Path(f).name != output_name]
    
    if not files:
        return 0

    all_questions = []
    for f in files:
        try:
            with open(f, "r", encoding="utf-8") as fh:
                data = json.load(fh)
                if isinstance(data, list):
                    all_questions.extend(data)
        except Exception as e:
            print(f"  [Error] No se pudo leer {f}: {e}")
    
    if not all_questions:
        return 0

    # Ordenar por originalId (numérico si es posible) para mantener consistencia
    def sort_key(q):
        # officialId como fallback cuando originalId es None (ej: tec-comun)
        orig_id = q.get("originalId") or q.get("officialId") or ""
        try:
            return (int(orig_id), q.get("id", ""))
        except (ValueError, TypeError):
            return (0, q.get("id", ""))

    all_questions.sort(key=sort_key)
    
    # Guardar el resultado en el directorio de datos
    out_path = DATA_DIR / output_name
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(all_questions, fh, ensure_ascii=False, indent=2)
    # Newline final por convención
    with open(out_path, "a", encoding="utf-8") as fh:
        fh.write("\n")
    
    return len(all_questions)


def run(categories: list[str] | None = None) -> None:
    """
    Ejecuta la consolidación para las categorías especificadas (o todas).
    """
    print("\n" + "=" * 60)
    print("  PASO 0 — Consolidando archivos individuales (*-tXX.json)")
    print("=" * 60)

    # Mapeo de prefijos basado en la estructura conocida
    # (Podríamos mover esto a config.py si crece mucho)
    PREFIX_MAP = {
        "C2":  ("comun-t",      "comun.json"),
        "A2":  ("tec-comun-t",  "tec-comun.json"),
        "ADM": ("adm-",         "adm.json"),
        "AUX": ("aux-e",        "aux.json"),
    }

    cats = categories or list(CATEGORIES.keys())
    
    for cat in cats:
        if cat in PREFIX_MAP:
            prefix, out_name = PREFIX_MAP[cat]
            count = consolidate_category(prefix, out_name)
            print(f"  [{cat:3s}] {prefix:12s} ➔ {out_name:15s} | {count:4d} preguntas")
        else:
            print(f"  [{cat:3s}] Saltando (sin prefijo de consolidación configurado)")

    print("\n  ✓ Consolidación completada.")


if __name__ == "__main__":
    run()
