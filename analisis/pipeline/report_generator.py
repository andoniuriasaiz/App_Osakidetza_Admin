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

# Estado → etiqueta legible
STATUS_ES = {
    "VERIFIED":       "Verificado",
    "STABLE":         "Estable (IA)",
    "UGT_OUTLIER":    "UGT Outlier (Protegido)",
    "KAIXO_RECOVERY": "RECUPERABLE: Typo en Kaixo",
    "FIX_SUGGESTED":  "Sugerencia de Cambio",
    "DISPUTE":        "Disputa / Duda",
    "INCOMPLETE":     "Sin datos suficientes",
}

# Estado → acción recomendada
ACTION = {
    "FIX_SUGGESTED":  "CORREGIR: cambiar a respuesta sugerida",
    "KAIXO_RECOVERY": "RESTAURAR IA: Kaixo indujo error, UGT coincide con IA",
    "DISPUTE":        "REVISAR MANUALMENTE: consulta texto legal",
    "INCOMPLETE":     "REVISAR: faltan fuentes para validar",
    "PERFECT_SPOT":   "SPOT-CHECK: App=UGT pero otra academia discrepa",
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
        "RespuestaIA":       q.get("ia", "?"),
        "RespuestaApp":      q.get("app", "?"),
        "RespuestaUGT":      q.get("u", "?"),
        "RespuestaKaixo":    q.get("k", "?"),
        "RespuestaOsasun":   q.get("o", "?"),
        "Trío(A=K=O)":       "Sí" if q.get("trio") else "No",
        "Confianza":         f"{q.get('confidence', 0)}%",
        "Estado":            STATUS_ES.get(q.get("status", ""), q.get("status", "")),
        "Acción":            action,
        "Explicación_app":   q.get("explanation", ""),
    }


FIELDNAMES = [
    "Categoría", "Nº", "ID", "Pregunta",
    "OpciónA", "OpciónB", "OpciónC", "OpciónD",
    "RespuestaIA", "RespuestaApp", "RespuestaUGT", "RespuestaKaixo", "RespuestaOsasun",
    "Trío(A=K=O)", "Confianza", "Estado", "Acción", "Explicación_app",
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

    rows_urgent      = []
    rows_dispute     = []
    rows_no_k        = []
    rows_spot        = []

    for cat_key, questions in consensus.items():
        if not isinstance(questions, list):
            continue
        for q in questions:
            if not isinstance(q, dict):
                continue
            status = q.get("status", "")
            o = q.get("o", "?")
            app = q.get("app", "?")
            k = q.get("k", "?")
            u = q.get("u", "?")

            if status == "FIX_SUGGESTED":
                rows_urgent.append(_build_row(q, cat_key, ACTION["FIX_SUGGESTED"]))

            elif status == "KAIXO_RECOVERY":
                rows_urgent.append(_build_row(q, cat_key, ACTION["KAIXO_RECOVERY"]))

            elif status == "DISPUTE":
                rows_dispute.append(_build_row(q, cat_key, ACTION["DISPUTE"]))

            elif status == "INCOMPLETE" and o != "?" and app != o:
                rows_no_k.append(_build_row(q, cat_key, ACTION["INCOMPLETE"]))

            elif (status == "STABLE" or status == "UGT_OUTLIER" or status == "VERIFIED") and (k != "?" and k != app or u != "?" and u != app):
                # App coincide con mayoría pero hay algún disidente (Kaixo o UGT)
                rows_spot.append(_build_row(q, cat_key, ACTION["PERFECT_SPOT"]))

    ts = datetime.now().strftime("%Y%m%d")

    # ── CSV 1: Urgentes (Fixes + Recovery) ───────────────────────────────────
    p1 = REPORTS_DIR / f"1_corregir_urgente_{ts}.csv"
    n1 = _write_csv(p1, rows_urgent, FIELDNAMES)
    print(f"  ✓ {p1.name}  ({n1} preguntas)")
    generated.append(p1)

    # ── CSV 2: Disputas ──────────────────────────────────────────────────────
    p2 = REPORTS_DIR / f"2_disputas_manuales_{ts}.csv"
    n2 = _write_csv(p2, rows_dispute, FIELDNAMES)
    print(f"  ✓ {p2.name}  ({n2} preguntas)")
    generated.append(p2)

    # ── CSV 3: Sin Kaixo + Osasun difiere ────────────────────────────────────
    p3 = REPORTS_DIR / f"3_sin_kaixo_osasun_difiere_{ts}.csv"
    n3 = _write_csv(p3, rows_no_k, FIELDNAMES)
    print(f"  ✓ {p3.name}  ({n3} preguntas)")
    generated.append(p3)

    # ── CSV 4: Spot-check (App=UGT pero academia discrepa) ────────────────────
    p4 = REPORTS_DIR / f"4_spot_check_ugt_ok_{ts}.csv"
    n4 = _write_csv(p4, rows_spot, FIELDNAMES)
    print(f"  ✓ {p4.name}  ({n4} preguntas)")
    generated.append(p4)

    # ── Resumen ───────────────────────────────────────────────────────────────
    print()
    print(f"  RESUMEN:")
    print(f"    🔴 Corregir urgente (Red Flags + Recovery): {n1}")
    print(f"    🟠 Disputas (sin mayoría clara):            {n2}")
    print(f"    ⚪ Sin Kaixo (Osasun difiere):              {n3}")
    print(f"    🏅 Spot-check (Consenso con disidentes):    {n4}")
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
