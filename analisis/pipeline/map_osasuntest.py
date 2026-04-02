#!/usr/bin/env python3
"""
map_osasuntest.py — Mapea preguntas de la App con respuestas de Osasuntest por texto
======================================================================================
Usa fuzzy matching para emparejar cada pregunta de la App con su equivalente en
los bloques de Osasuntest descargados por extraer_osasuntest_adm.py, ignorando
el orden (que puede diferir entre la App y Osasuntest).

Genera analisis/raw/osasun_*.json  (consumidos por consensus_builder.py)
"""
import json
import re
import difflib
import sys
from pathlib import Path

# ─── Normalización de texto ───────────────────────────────────────────────────

TEXT_NORM_LEN = 120
FUZZY_CUTOFF  = 0.65

REPLACEMENTS = {
    "rd":    "real decreto",
    "rdl":   "real decreto legislativo",
    "ebep":  "estatuto basico del empleado publico",
    "lopd":  "ley organica de proteccion de datos",
    "sns":   "sistema nacional de salud",
}


def norm_text(t: str) -> str:
    if not t:
        return ""
    t = t.lower().strip()
    t = re.sub(r"^\s*\d+[\.\-\)]\s*", "", t)
    for k, v in REPLACEMENTS.items():
        t = t.replace(k, v)
    t = re.sub(r"[^a-z0-9áéíóúñü]", "", t)
    return t[:TEXT_NORM_LEN]


# ─── Tabla de mapeos ──────────────────────────────────────────────────────────

MAPPINGS = [
    {
        "name":        "C2",
        "app_file":    "comun.json",
        "osa_file":    "osasuntest_administrativo_c2_comun.json",
        "output_file": "osasun_c2.json",
    },
    {
        "name":        "A2",
        "app_file":    "tec-comun.json",
        "osa_file":    "osasuntest_enfermero_c2_comun.json",
        "output_file": "osasun_nurse.json",
    },
    {
        "name":        "ADM",
        "app_file":    "adm.json",
        "osa_file":    "osasuntest_administrativo_especifico.json",
        "output_file": "osasun_admin.json",
    },
    {
        "name":        "AUX",
        "app_file":    "aux.json",
        "osa_file":    "osasuntest_auxiliar-administrativo_especifico.json",
        "output_file": "osasun_aux.json",
    },
]


# ─── Mapeo de una categoría ───────────────────────────────────────────────────

def map_category(name: str, app_file: str, osa_file: str, output_file: str, 
                 data_dir: Path, osa_out_dir: Path, raw_dir: Path) -> None:
    print(f"  [{name}] ", end="", flush=True)
    app_path = data_dir / app_file
    osa_path = osa_out_dir / osa_file
    out_path = raw_dir / output_file

    if not app_path.exists() or not osa_path.exists():
        missing = []
        if not app_path.exists():
            missing.append(f"APP:{app_file}")
        if not osa_path.exists():
            missing.append(f"OSA:{osa_file}")
        print(f"⚠  FALTA: {', '.join(missing)}")
        return

    with open(app_path, encoding="utf-8") as f:
        app_data = json.load(f)
    with open(osa_path, encoding="utf-8") as f:
        osa_data = json.load(f)

    # Índice Osasuntest por texto normalizado
    osa_index: dict[str, dict] = {}
    for q in osa_data:
        nt = norm_text(q["question"])
        if nt:
            osa_index[nt] = q
    osa_texts = list(osa_index.keys())

    mapping: dict[str, str] = {}
    exact = fuzzy = 0

    for q in app_data:
        orig_id = q.get("originalId") or q.get("officialId") or q.get("questionNum")
        nt = norm_text(q["question"])

        target = osa_index.get(nt)
        if target is None:
            closest = difflib.get_close_matches(nt, osa_texts, n=1, cutoff=FUZZY_CUTOFF)
            if closest:
                target = osa_index[closest[0]]
                fuzzy += 1
        else:
            exact += 1

        if target:
            ans = target.get("correctAnswer") or target.get("correct") or "?"
            mapping[str(orig_id)] = ans

    raw_dir.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(mapping, f, indent=2, ensure_ascii=False)

    total = len(app_data)
    matched = exact + fuzzy
    pct = matched / total * 100 if total else 0
    print(f"{matched}/{total} ({pct:.0f}%)  [exact: {exact}  fuzzy: {fuzzy}]")


# ─── Punto de entrada ─────────────────────────────────────────────────────────

def run(categories: list | None = None, force: bool = False, root_path: Path | None = None) -> None:
    """Llamado por run_pipeline.py.

    categories : ['C2', 'ADM', …] o None = todas.
    force      : ignorado (compatibilidad).
    root_path  : Path raíz del proyecto.
    """
    if root_path is None:
        # Fallback para ejecución directa: 3 niveles arriba de este script
        root_path = Path(__file__).resolve().parent.parent.parent
    
    data_dir    = root_path / "public" / "data"
    raw_dir     = root_path / "analisis" / "raw"
    osa_out_dir = root_path / "osasuntest_output"

    print("\n" + "=" * 62)
    print("  PASO 2 — Mapeando Osasuntest por texto")
    print(f"  ROOT: {root_path}")
    print("=" * 62)

    selected_names = set(categories) if categories else {m["name"] for m in MAPPINGS}

    for m in MAPPINGS:
        if m["name"] in selected_names:
            map_category(
                name=m["name"],
                app_file=m["app_file"],
                osa_file=m["osa_file"],
                output_file=m["output_file"],
                data_dir=data_dir,
                osa_out_dir=osa_out_dir,
                raw_dir=raw_dir
            )

    print("  ✓ Mapeo Osasuntest completado.")


if __name__ == "__main__":
    run()
