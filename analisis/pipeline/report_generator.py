"""
report_generator.py — Generador de informes CSV para revisión manual
=====================================================================
Genera 4 CSVs en analisis/reports/ con las preguntas agrupadas por
nivel de confianza y urgencia de revisión.

  CSV 1 — correcciones_urgentes.csv
    RED_FLAG: Kaixo y Osasun coinciden pero la App tiene otra respuesta.
    Son las más fiables: corregir directamente con --apply --confirm.

  CSV 2 — disputas_manuales.csv
    TRIPLE_DISPUTE: las 3 fuentes difieren. Revisar el texto legal.

  CSV 3 — sin_kaixo_osasun_difiere.csv
    INCOMPLETE donde App ≠ Osasun y Kaixo no tiene datos.
    Kaixo no cubrió estas preguntas; Osasun discrepa con la App.

  CSV 4 — spot_check_kaixo_solo.csv
    PERFECT (App=K) donde Osasun dice algo distinto.
    Son probablemente correctas, pero sirven para spot-check.

Columnas en todos los CSVs:
  Categoría, Nº, Pregunta, OpciónA, OpciónB, OpciónC, OpciónD,
  RespuestaApp, RespuestaKaixo, RespuestaOsasun, Estado, Trío,
  Acción_recomendada, Explicación

Uso:
  python analisis/pipeline/report_generator.py
  o como parte del pipeline: se llama desde run_pipeline.py con --reports
"""

import csv
import json
import sys
from datetime import datetime
from pathlib import Path

_HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(_HERE))
from config import REPORTS_DIR, CATEGORIES


# ── Helpers ──────────────────────────────────────────────────────────────────

LETTER_NAMES = {"A": "A", "B": "B", "C": "C", "D": "D", "?": "—"}
STATUS_ES = {
    "PERFECT":        "Perfecto",
    "RED_FLAG":       "Red Flag ← corregir",
    "TRIPLE_DISPUTE": "Disputa triple",
    "INCOMPLETE":     "Sin datos Kaixo",
}
ACTION = {
    "RED_FLAG":       "CORREGIR: cambiar a respuesta Kaixo/Osasun",
    "TRIPLE_DISPUTE": "REVISAR MANUALMENTE: consultar texto legal",
    "INCOMPLETE":     "REVISAR: Kaixo no tiene este bloque; Osasun discrepa",
    "PERFECT_SPOT":   "SPOT-CHECK: App=Kaixo pero Osasun discrepa",
}


def _write_csv(path: Path, rows: list[dict], fieldnames: list[str]) -> int:
    with open(path, "w", encoding="utf-8-sig", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=fieldnames, delimiter=";",
                           extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)
    return len(rows)


def _build_row(q: dict, cat_key: str, action: str) -> dict:
    opts = q.get("options", {})
    return {
        "Categoría":         CATEGORIES[cat_key]["label"],
        "Nº":                q.get("originalId", ""),
        "ID":                q.get("id", ""),
        "Pregunta":          q.get("text", ""),
        "OpciónA":           opts.get("A", ""),
        "OpciónB":           opts.get("B", ""),
        "OpciónC":           opts.get("C", ""),
        "OpciónD":           opts.get("D", ""),
        "RespuestaApp":      q.get("app", "?"),
        "RespuestaKaixo":    q.get("k", "?"),
        "RespuestaOsasun":   q.get("o", "?"),
        "Trío(A=K=O)":       "Sí" if q.get("trio") else "No",
        "Estado":            STATUS_ES.get(q.get("status", ""), q.get("status", "")),
        "Acción":            action,
        "Explicación_app":   q.get("explanation", ""),
    }


FIELDNAMES = [
    "Categoría", "Nº", "ID", "Pregunta",
    "OpciónA", "OpciónB", "OpciónC", "OpciónD",
    "RespuestaApp", "RespuestaKaixo", "RespuestaOsasun",
    "Trío(A=K=O)", "Estado", "Acción", "Explicación_app",
]


def run(consensus: dict) -> list[Path]:
    """
    Genera los 4 CSVs a partir del consenso ya calculado.
    Devuelve lista de paths generados.
    """
    print("\n" + "=" * 60)
    print("  Generando informes CSV de revisión")
    print("=" * 60)

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    generated = []

    rows_urgent   = []   # RED_FLAG
    rows_dispute  = []   # TRIPLE_DISPUTE
    rows_no_k     = []   # INCOMPLETE (Kaixo falta, Osasun difiere)
    rows_spot     = []   # PERFECT pero Osasun discrepa

    for cat_key, questions in consensus.items():
        if not isinstance(questions, list):
            continue
        for q in questions:
            if not isinstance(q, dict):
                continue
            status = q.get("status", "")
            app, k, o = q.get("app","?"), q.get("k","?"), q.get("o","?")

            if status == "RED_FLAG":
                rows_urgent.append(_build_row(q, cat_key, ACTION["RED_FLAG"]))

            elif status == "TRIPLE_DISPUTE":
                rows_dispute.append(_build_row(q, cat_key, ACTION["TRIPLE_DISPUTE"]))

            elif status == "INCOMPLETE" and o != "?" and app != o:
                # Kaixo falta, pero Osasun dice otra cosa que la App
                rows_no_k.append(_build_row(q, cat_key, ACTION["INCOMPLETE"]))

            elif status == "PERFECT" and o != "?" and o != k and q.get("o_reliable", True):
                # App=Kaixo pero Osasun discrepa (y Osasun es fiable para esta cat.)
                rows_spot.append(_build_row(q, cat_key, ACTION["PERFECT_SPOT"]))

    ts = datetime.now().strftime("%Y%m%d")

    # ── CSV 1: Red Flags ──────────────────────────────────────────────────────
    p = REPORTS_DIR / f"1_correcciones_urgentes_{ts}.csv"
    n = _write_csv(p, rows_urgent, FIELDNAMES)
    print(f"  ✓ {p.name}  ({n} preguntas)")
    generated.append(p)

    # ── CSV 2: Disputas ───────────────────────────────────────────────────────
    p = REPORTS_DIR / f"2_disputas_manuales_{ts}.csv"
    n = _write_csv(p, rows_dispute, FIELDNAMES)
    print(f"  ✓ {p.name}  ({n} preguntas)")
    generated.append(p)

    # ── CSV 3: Sin Kaixo + Osasun difiere ─────────────────────────────────────
    p = REPORTS_DIR / f"3_sin_kaixo_osasun_difiere_{ts}.csv"
    n = _write_csv(p, rows_no_k, FIELDNAMES)
    print(f"  ✓ {p.name}  ({n} preguntas)")
    generated.append(p)

    # ── CSV 4: Spot-check (App=K pero O discrepa) ─────────────────────────────
    p = REPORTS_DIR / f"4_spot_check_kaixo_vs_osasun_{ts}.csv"
    n = _write_csv(p, rows_spot, FIELDNAMES)
    print(f"  ✓ {p.name}  ({n} preguntas)")
    generated.append(p)

    # ── Resumen ───────────────────────────────────────────────────────────────
    print()
    print(f"  RESUMEN:")
    print(f"    🔴 Red Flags (corregir ya):          {len(rows_urgent)}")
    print(f"    🟠 Disputas (revisar manualmente):   {len(rows_dispute)}")
    print(f"    🟡 Sin Kaixo + Osasun difiere:       {len(rows_no_k)}")
    print(f"    🔵 Spot-check (App=K, O discrepa):   {len(rows_spot)}")
    print(f"    📁 CSVs en: {REPORTS_DIR}")
    print()

    return generated


if __name__ == "__main__":
    consensus_path = REPORTS_DIR / "CLEAN_CONSENSUS.json"
    if not consensus_path.exists():
        print(f"ERROR: No existe {consensus_path}. Ejecuta primero: python run_pipeline.py")
        sys.exit(1)
    with open(consensus_path, encoding="utf-8") as fh:
        data = json.load(fh)
    run({k: v for k, v in data.items() if not k.startswith("_")})
