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
    "PERFECT":          "✅ Perfecto",
    "CONSENSUS":        "✅ Consenso (App ok)",
    "RED_FLAG":         "🔴 Red Flag — CORREGIR",
    "UGT_OUTLIER":      "🟡 UGT Outlier — revisar UGT",
    "REVIEW_K_VS_UGT":  "🟠 Kaixo vs UGT — revisión manual",
    "UGT_ONLY":         "🟡 Solo UGT difiere — revisar",
    "TRIPLE_DISPUTE":   "🟠 Disputa triple",
    "INCOMPLETE":       "⚪ Sin datos suficientes",
}

# Estado → acción recomendada
ACTION = {
    "RED_FLAG":         "CORREGIR: K+U coinciden o consenso externo claro — cambiar respuesta App",
    "UGT_OUTLIER":      "REVISAR UGT: App=K=O concuerdan; solo UGT difiere — probable typo PDF",
    "REVIEW_K_VS_UGT":  "REVISIÓN MANUAL: Kaixo y UGT discrepan — consultar texto legal",
    "UGT_ONLY":         "REVISAR: solo UGT tiene datos y difiere — verificar manualmente",
    "TRIPLE_DISPUTE":   "REVISIÓN MANUAL: 3 respuestas diferentes — consultar texto legal",
    "INCOMPLETE":       "MONITORIZAR: datos insuficientes para decidir",
    "CONSENSUS_SPOT":   "SPOT-CHECK: App=K=O pero UGT discrepa (ya marcado UGT_OUTLIER)",
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
        "RespuestaUGT":      q.get("u", "?"),
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
    "RespuestaApp", "RespuestaUGT", "RespuestaKaixo", "RespuestaOsasun",
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

    rows_urgent      = []   # RED_FLAG: corrección definitiva
    rows_k_vs_ugt    = []   # REVIEW_K_VS_UGT: Kaixo y UGT discrepan
    rows_ugt_outlier = []   # UGT_OUTLIER: solo UGT difiere vs App+K+O
    rows_ugt_only    = []   # UGT_ONLY: solo UGT tiene datos y difiere
    rows_dispute     = []   # TRIPLE_DISPUTE: 3 respuestas distintas

    for cat_key, questions in consensus.items():
        if not isinstance(questions, list):
            continue
        for q in questions:
            if not isinstance(q, dict):
                continue
            status = q.get("status", "")

            if status == "RED_FLAG":
                rows_urgent.append(_build_row(q, cat_key, ACTION["RED_FLAG"]))
            elif status == "REVIEW_K_VS_UGT":
                rows_k_vs_ugt.append(_build_row(q, cat_key, ACTION["REVIEW_K_VS_UGT"]))
            elif status == "UGT_OUTLIER":
                rows_ugt_outlier.append(_build_row(q, cat_key, ACTION["UGT_OUTLIER"]))
            elif status == "UGT_ONLY":
                rows_ugt_only.append(_build_row(q, cat_key, ACTION["UGT_ONLY"]))
            elif status == "TRIPLE_DISPUTE":
                rows_dispute.append(_build_row(q, cat_key, ACTION["TRIPLE_DISPUTE"]))

    ts = datetime.now().strftime("%Y%m%d")

    # ── CSV 1: Red Flags — corrección definitiva (K+U coinciden o consenso claro) ──
    p = REPORTS_DIR / f"1_corregir_urgente_{ts}.csv"
    n = _write_csv(p, rows_urgent, FIELDNAMES)
    print(f"  ✓ {p.name}  ({n} preguntas)")
    generated.append(p)

    # ── CSV 2: Kaixo vs UGT — las dos fuentes tier-1 discrepan ──────────────
    p = REPORTS_DIR / f"2_kaixo_vs_ugt_{ts}.csv"
    n = _write_csv(p, rows_k_vs_ugt, FIELDNAMES)
    print(f"  ✓ {p.name}  ({n} preguntas)")
    generated.append(p)

    # ── CSV 3: UGT Outlier — solo UGT difiere vs App+K+O ────────────────────
    p = REPORTS_DIR / f"3_ugt_outlier_{ts}.csv"
    n = _write_csv(p, rows_ugt_outlier, FIELDNAMES)
    print(f"  ✓ {p.name}  ({n} preguntas)")
    generated.append(p)

    # ── CSV 4: Solo UGT — sin datos Kaixo, UGT discrepa ─────────────────────
    p = REPORTS_DIR / f"4_solo_ugt_difiere_{ts}.csv"
    n = _write_csv(p, rows_ugt_only, FIELDNAMES)
    print(f"  ✓ {p.name}  ({n} preguntas)")
    generated.append(p)

    # ── CSV 5: Triple dispute ─────────────────────────────────────────────────
    p = REPORTS_DIR / f"5_triple_dispute_{ts}.csv"
    n = _write_csv(p, rows_dispute, FIELDNAMES)
    print(f"  ✓ {p.name}  ({n} preguntas)")
    generated.append(p)

    # ── Resumen ───────────────────────────────────────────────────────────────
    print()
    print(f"  RESUMEN:")
    print(f"    🔴 Corregir urgente (K+U coinciden o consenso claro): {len(rows_urgent)}")
    print(f"    🟠 Kaixo vs UGT (revisión manual tier-1):             {len(rows_k_vs_ugt)}")
    print(f"    🟡 UGT Outlier (App+K+O vs UGT solo):                 {len(rows_ugt_outlier)}")
    print(f"    🟡 Solo UGT difiere (sin Kaixo, revisar):             {len(rows_ugt_only)}")
    print(f"    🟠 Triple dispute (3 respuestas distintas):           {len(rows_dispute)}")
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
