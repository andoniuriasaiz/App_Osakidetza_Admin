"""
consensus_builder.py — Generador de CLEAN_CONSENSUS.json
=========================================================
Cruza las respuestas de la App, Kaixo y Osasuntest para cada pregunta
y determina el estado de acuerdo/desacuerdo.

Resultado: analisis/reports/CLEAN_CONSENSUS.json
"""

import json
import difflib
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Union, Dict

_HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(_HERE))
from config import (
    DATA_DIR, RAW_DIR, REPORTS_DIR, UGT_DIR,
    CATEGORIES, NUM_TO_LETTER, FUZZY_CUTOFF, TEXT_NORM_LEN
)


# ── Helpers ──────────────────────────────────────────────────────────────────

def load_json(path: Path) -> Union[Dict, List]:
    if not path.exists():
        return {}
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def clean_ans(raw) -> str:
    """Normaliza respuestas: 'DB' → 'B', None → '?'"""
    if not raw:
        return "?"
    raw = str(raw).strip().upper()
    for ch in reversed(raw):
        if ch in "ABCDE":
            return ch
    return "?"


def norm_text(t: str) -> str:
    """Texto normalizado para fuzzy matching: solo alfanumérico, minúsculas, N chars."""
    if not t:
        return ""
    t = t.lower().strip()
    # Eliminar numeración inicial "1.- " / "1. " / "(1) "
    t = re.sub(r"^\s*\d+[\.\-\)]\s*", "", t)
    return re.sub(r"[^a-z0-9áéíóúñü]", "", t)[:TEXT_NORM_LEN]


def build_kaixo_index(k_raw: dict) -> dict:
    """Índice {norm_text → letra} para fallback por texto."""
    # k_raw = {num_str: letra}  ya normalizado
    return {}   # Sin texto de kaixo disponible en raw, se usa ID directo


def _determine_status(app: str, k: str, o: str, u: str) -> tuple[str, str]:
    """
    Determina el estado de consenso con 4 fuentes:
      App (A) — lo que queremos validar
      Kaixo (K) — plataforma web, alta fiabilidad técnica (match directo por ID)
      Osasuntest (O) — plataforma web, fiabilidad media (banco puede diferir)
      UGT (U) — sindicato, alta fiabilidad editorial; posibles typos en PDFs

    Jerarquía del modelo:
      - K+U acuerdan entre sí → señal muy fuerte (independientes de distinta naturaleza).
        Si App discrepa → RED_FLAG definitivo.
      - App=K=O y solo UGT difiere → UGT tiene probable typo → UGT_OUTLIER (no autocorregir).
      - App=K y solo UGT difiere (sin O) → disputa tier-1 → REVIEW_K_VS_UGT.
      - App=U y solo K difiere → App+UGT probablemente ok → CONSENSUS.
      - Solo UGT disponible, difiere → UGT_ONLY (revisar, no autocorregir).
      - Mayoría externa clara (≥2 fuentes) sin K+U combinados → RED_FLAG si App pierde.

    Retorna (status, respuesta_consenso)
    """
    from collections import Counter

    available = {s: v for s, v in [("K", k), ("O", o), ("U", u)] if v != "?"}

    # ── Sin datos externos ────────────────────────────────────────────────────
    if not available:
        return "INCOMPLETE", app

    # ── PERFECT: App coincide con todas las fuentes disponibles ──────────────
    if all(v == app for v in available.values()):
        return "PERFECT", app

    ext_votes = Counter(available.values())
    top_ans, top_n = ext_votes.most_common(1)[0]
    app_support = ext_votes.get(app, 0)

    # ── K y U coinciden entre sí (las dos fuentes tier-1) ────────────────────
    if k != "?" and u != "?" and k == u:
        if k == app:
            return "PERFECT", app
        return "RED_FLAG", k          # K+U contra App → corrección definitiva

    # ── Todas las fuentes disponibles (≥2) dicen lo mismo ≠ App ──────────────
    if app_support == 0 and top_n >= 2:
        return "RED_FLAG", top_ans    # Consenso externo unánime contra App

    # ── App=K=O pero solo UGT difiere → UGT probable typo ────────────────────
    if (u != "?" and u != app
            and k != "?" and k == app
            and (o == "?" or o == app)
            and sum(1 for v in available.values() if v == app) >= 2):
        return "UGT_OUTLIER", app     # ≥2 fuentes externas apoyan App, UGT outlier

    # ── App=K pero UGT discrepa (O no desempata o va con UGT) ────────────────
    if (k != "?" and k == app
            and u != "?" and u != app
            and (o == "?" or o == u)):
        return "REVIEW_K_VS_UGT", u   # Disputa entre las dos fuentes tier-1

    # ── App=U pero Kaixo discrepa (O no desempata o va con App/U) ────────────
    if (u != "?" and u == app
            and k != "?" and k != app
            and (o == "?" or o == app)):
        return "CONSENSUS", app       # App+UGT vs Kaixo; probablemente ok

    # ── Solo UGT disponible y difiere (K=?, O=?) ─────────────────────────────
    if k == "?" and o == "?" and u != "?" and u != app:
        return "UGT_ONLY", u          # Única fuente externa, sin corroboración

    # ── Solo K disponible y difiere ───────────────────────────────────────────
    if u == "?" and k != "?" and k != app:
        if o == "?" or o == app:
            return "INCOMPLETE", k    # Solo K discrepa, sin UGT
        return "RED_FLAG", k          # K+O coinciden ≠ App (lógica clásica)

    # ── App tiene mayoría de fuentes pero no todas ────────────────────────────
    if app_support > len(available) / 2:
        return "CONSENSUS", app

    # ── Disputa genuina sin mayoría clara ─────────────────────────────────────
    return "TRIPLE_DISPUTE", top_ans


# ── Procesador por categoría ─────────────────────────────────────────────────

def process_category(cat_key: str) -> list[dict]:
    cfg = CATEGORIES[cat_key]
    print(f"  [{cat_key}] {cfg['label']}…")

    app_data = load_json(DATA_DIR / cfg["app_file"])
    k_raw    = load_json(RAW_DIR / cfg["raw_kaixo"])   # {num_str: letra|dict}
    # raw_osasun puede ser None si la categoría no tiene banco Osasuntest (ej: TEC)
    raw_osasun_file = cfg.get("raw_osasun")
    o_raw    = load_json(RAW_DIR / raw_osasun_file) if raw_osasun_file else {}  # {num_str: letra}
    o_offset = cfg["osasun_offset"]
    
    # Cargar datos UGT
    ugt_file = cfg.get("ugt_file")
    u_raw = load_json(UGT_DIR / ugt_file) if ugt_file else []
    
    # Indexar UGT por originalId
    u_index: dict[str, str] = {}
    for item in u_raw:
        if "id" in item and item.get("correctAnswer"):
            u_index[str(item["id"])] = item["correctAnswer"]

    if isinstance(app_data, dict):
        # Si el app_file es un dict (raro), convertir a lista
        app_data = list(app_data.values())

    # Normalizar k_raw (puede tener valores dict o multi-letra)
    k_clean: dict[str, str] = {}
    for k, v in k_raw.items():
        val = v if isinstance(v, str) else v.get("ans", "?")
        k_clean[k] = clean_ans(val)

    # Construir índice de texto para fuzzy matching Kaixo
    # (usamos las preguntas de la App para hacer match)
    app_text_index: dict[str, str] = {}  # norm_text → original_id_str

    results = []
    matched_by_id = 0
    matched_by_fuzzy = 0
    no_match_k = 0

    for q in app_data:
        orig_id = q.get("originalId") or q.get("officialId") or q.get("questionNum")
        app_ans = NUM_TO_LETTER.get(
            (q.get("correctAnswerNums") or [None])[0], "?"
        )
        app_txt = q.get("question", "")

        # ── Match Kaixo ──────────────────────────────────────────────────
        ka = "?"
        if orig_id and str(orig_id) in k_clean:
            ka = k_clean[str(orig_id)]
            matched_by_id += 1
        else:
            # Fallback fuzzy por texto (si tenemos texto en k_raw)
            norm_app = norm_text(app_txt)
            if norm_app and app_text_index:
                matches = difflib.get_close_matches(
                    norm_app, app_text_index.keys(), n=1, cutoff=FUZZY_CUTOFF
                )
                if matches:
                    ka = k_clean.get(app_text_index[matches[0]], "?")
                    matched_by_fuzzy += 1
                else:
                    no_match_k += 1
            else:
                no_match_k += 1

        # ── Match Osasun ─────────────────────────────────────────────────
        # Si la categoría tiene bloque específico de Osasun no fiable,
        # marcamos el valor de Osasun como "?" (banco distinto, no comparable).
        o_reliable = True
        oa = "?"
        if orig_id is not None:
            try:
                o_key = str(int(orig_id) + o_offset)
                oa = clean_ans(o_raw.get(o_key, "?"))
            except (ValueError, TypeError):
                pass
        if cfg.get("osasun_unreliable_specific") and oa != "?":
            # El banco ADM-específico de Osasun no se alinea con el nuestro
            oa = "?"
            o_reliable = False

        # ── Match UGT ──────────────────────────────────────────────────
        ua = "?"
        if orig_id is not None and str(orig_id) in u_index:
            ua = u_index[str(orig_id)]

        # ── Status ───────────────────────────────────────────────────────
        status, consensus_ans = _determine_status(app_ans, ka, oa, ua)

        # ── Campos extra útiles para análisis / CSVs ─────────────────────
        trio = (app_ans == ka == oa == ua and ua != "?") # O una coincidencia fuerte
        opts = q.get("options", [])
        options_map = {chr(64 + o.get("value", i+1)): o.get("text", "")
                       for i, o in enumerate(opts)} if isinstance(opts, list) else {}

        results.append({
            "id":          q.get("id", f"{cat_key}_{orig_id}"),
            "originalId":  orig_id,
            "text":        app_txt,
            "options":     options_map,       # {"A": "...", "B": "...", ...}
            "explanation": q.get("explanation", ""),
            "app":         app_ans,
            "k":           ka,
            "o":           oa,
            "u":           ua,
            "o_reliable":  o_reliable,
            "trio":        trio,
            "consensus":   consensus_ans,
            "status":      status,
        })

    total = len(results)
    by_status = {}
    for r in results:
        by_status[r["status"]] = by_status.get(r["status"], 0) + 1

    print(f"    Total: {total} | "
          + " | ".join(f"{s}: {n} ({n/total:.0%})" for s, n in sorted(by_status.items())))
    print(f"    Match Kaixo → por ID: {matched_by_id}, fuzzy: {matched_by_fuzzy}, "
          f"sin match: {no_match_k}")
    return results


# ── Punto de entrada ─────────────────────────────────────────────────────────

def run(categories: Optional[List] = None) -> Dict:
    print("\n" + "=" * 60)
    print("  PASO 3 — Construyendo consenso")
    print("=" * 60)

    cats = categories or list(CATEGORIES.keys())
    consensus: dict[str, list] = {}

    for cat in cats:
        consensus[cat] = process_category(cat)

    # Guardar
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    out = REPORTS_DIR / "CLEAN_CONSENSUS.json"
    meta = {
        "_generated": datetime.now().isoformat(timespec="seconds"),
        "_categories": list(consensus.keys()),
    }
    payload = {**meta, **consensus}
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)

    # Copiar también a la ruta histórica que usa apply_consensus_fixes.py
    hist = DATA_DIR / "analisis" / "2026-03-31" / "CLEAN_CONSENSUS.json"
    if hist.parent.exists():
        with open(hist, "w", encoding="utf-8") as fh:
            # La versión histórica no incluye meta-keys
            json.dump({k: v for k, v in payload.items() if not k.startswith("_")},
                      fh, ensure_ascii=False, indent=2)

    print(f"\n  ✓ CLEAN_CONSENSUS.json → {out}")
    return consensus


if __name__ == "__main__":
    run()
