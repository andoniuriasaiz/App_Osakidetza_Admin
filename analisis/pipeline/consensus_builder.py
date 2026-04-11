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
import math
import sys
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Union, Dict

_HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(_HERE))
from config import (
    DATA_DIR, RAW_DIR, REPORTS_DIR, UGT_DIR, ROOT,
    CATEGORIES, NUM_TO_LETTER, FUZZY_CUTOFF, TEXT_NORM_LEN
)

BACKUP_IA = ROOT / "backup" / "public_data_20260331_174229"


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


# Precisiones estimadas por fuente (0-1)
ACCURACIES = {
    "U":  0.95,  # UGT: Oráculo (con un aliado gana a las plataformas)
    "K":  0.90,  # Kaixo: Plataforma sólida (reajustada para equilibrio)
    "IA": 0.75,  # IA Original
    "O":  0.65,  # Osasuntest
}

# Peso log-odds: ln(p / (1-p))
def get_weight(p):
    return math.log(p / (1 - p))

WEIGHTS = {s: get_weight(p) for s, p in ACCURACIES.items()}

def _determine_status(app: str, k: str, o: str, u: str, ia: str) -> tuple[str, str, float]:
    """
    Determina el estado de consenso usando un modelo bayesiano y quórum ponderado.
    Retorna (status, consensus_ans, confidence_pct)
    """
    available = {s: v for s, v in [("K", k), ("O", o), ("U", u), ("IA", ia)] if v != "?"}
    
    if not available:
        return "INCOMPLETE", (app if app != "?" else "?"), 0.0

    options_scores = {}
    for source, ans in available.items():
        w = WEIGHTS.get(source, 1.0)
        options_scores[ans] = options_scores.get(ans, 0.0) + w

    winner_ans = max(options_scores, key=options_scores.get)
    
    # Probabilidad bayesiana (Softmax de los scores acumulados)
    total_exp = sum(math.exp(v) for v in options_scores.values())
    winner_prob = math.exp(options_scores[winner_ans]) / total_exp

    # ── Ajuste de Confianza por Autoridad (Weighted Quorum) ───────────────────
    # En lugar de (votos/total), usamos (peso_ganadores / peso_total)
    total_available_weight = sum(WEIGHTS[s] for s in available.keys())
    voters_weight = sum(WEIGHTS[s] for s, v in available.items() if v == winner_ans)
    
    # Factor de Quórum Ponderado: ¿Cuánta "autoridad" del total disponible apoya al ganador?
    weighted_ratio = voters_weight / total_available_weight if total_available_weight > 0 else 0
    
    # ¿UGT tiene al menos un aliado entre las otras fuentes externas?
    ugt_has_ally = (u != "?" and u == winner_ans) and (
        (ia != "?" and ia == winner_ans) or 
        (k != "?" and k == winner_ans) or 
        (o != "?" and o == winner_ans)
    )

    # La confianza base es Prob * Ratio
    conf = winner_prob * weighted_ratio

    # ── Bonificación por Autoridad (UGT + Aliado) ───────────────────────────
    # Si el oráculo coincide con otro experto, la confianza debe ser alta (>= 85%)
    # independientemente de si una fuente débil (IA/Osasun) disiente.
    if ugt_has_ally:
        conf = max(conf, 0.85)
    
    conf_pct = round(conf * 100, 1)

    # ── Determinación de Status ──────────────────────────────────────────────
    is_unanimous = (len([v for v in available.values() if v == winner_ans]) == len(available))

    if app == winner_ans:
        if is_unanimous:
            return "VERIFIED", app, conf_pct
        
        if u != "?" and u != app:
            return "UGT_OUTLIER", app, conf_pct
            
        return "STABLE", app, conf_pct
    
    else:
        # App difiere del ganador estadístico (Posible error en App)
        # Si la confianza es alta o hay alianza UGT, sugerimos el cambio.
        if conf_pct > 65 or ugt_has_ally:
            if app != ia and winner_ans == ia:
                return "KAIXO_RECOVERY", winner_ans, conf_pct
            return "FIX_SUGGESTED", winner_ans, conf_pct
        
        return "DISPUTE", winner_ans, conf_pct


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

    # Cargar datos base de la IA (backup original de Marzo)
    ia_data = load_json(BACKUP_IA / cfg["app_file"])
    if isinstance(ia_data, dict):
        ia_data = list(ia_data.values())
        
    ia_index: dict[str, str] = {}
    for q in ia_data:
        orig = q.get("originalId") or q.get("officialId") or q.get("questionNum")
        if orig is not None:
            ia_ans = NUM_TO_LETTER.get((q.get("correctAnswerNums") or [None])[0], "?")
            ia_index[str(orig)] = ia_ans

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

        # ── Match IA Original ──────────────────────────────────────────────
        iaa = "?"
        if orig_id is not None and str(orig_id) in ia_index:
            iaa = ia_index[str(orig_id)]

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

        # ── Determinación de estado ──────────────────────────────────────
        status, consensus_ans, confidence = _determine_status(app_ans, ka, oa, ua, iaa)

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
            "ia":          iaa,
            "app":         app_ans,
            "k":           ka,
            "o":           oa,
            "u":           ua,
            "o_reliable":  o_reliable,
            "trio":        trio,
            "confidence":  confidence,
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
