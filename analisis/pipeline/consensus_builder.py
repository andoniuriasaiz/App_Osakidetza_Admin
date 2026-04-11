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

_HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(_HERE))
from config import (
    DATA_DIR, RAW_DIR, REPORTS_DIR,
    CATEGORIES, NUM_TO_LETTER, FUZZY_CUTOFF, TEXT_NORM_LEN
)


# ── Helpers ──────────────────────────────────────────────────────────────────

def load_json(path: Path) -> dict | list:
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


def _determine_status(app: str, k: str, o: str) -> tuple[str, str]:
    """
    Determina el estado de consenso basado en las respuestas de la App (A), Kaixo (K) y Osasuntest (O).
    
    Reglas de prioridad:
    1. Si K y O no existen -> INCOMPLETE (confiamos en App por defecto)
    2. Si App coincide con Kaixo (K) -> PERFECT (Kaixo es la fuente principal)
    3. Si K y O coinciden pero App no -> RED_FLAG (Necesita corrección)
    4. Si K difiere de App y de O -> TRIPLE_DISPUTE (Revisión manual necesaria)
    """
    # 1. Falta de datos crítica
    if k == "?" and o == "?":
        return "INCOMPLETE", app

    # 2. MATCH con Kaixo: Si la App ya tiene lo que dice Kaixo, está PERFECTA.
    # (Incluso si Osasun difiere, confiamos en el binomio App-Kaixo)
    if k != "?" and app == k:
        return "PERFECT", app

    # 3. RED FLAG: Kaixo y Osasun coinciden en una corrección que la App no tiene.
    if k != "?" and o != "?" and k == o and app != k:
        return "RED_FLAG", k

    # 4. Caso especial: App coincide con la única fuente disponible
    if k == "?" and app == o:
        return "PERFECT", app
    if o == "?" and app == k: # (Ya cubierto por el punto 2, pero por claridad)
        return "PERFECT", app

    # 5. INCOMPLETE: Si falta una fuente y no hay coincidencia con la otra.
    if k == "?" or o == "?":
        return "INCOMPLETE", k if k != "?" else o

    # 6. TRIPLE DISPUTE: Realmente hay 3 versiones o App=Osasun pero Kaixo dice otra cosa.
    # O simplemente App y Kaixo no coinciden y no hay consenso de fuentes.
    return "TRIPLE_DISPUTE", k if k != "?" else (o if o != "?" else app)


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

        # ── Status ───────────────────────────────────────────────────────
        status, consensus_ans = _determine_status(app_ans, ka, oa)

        # ── Campos extra útiles para análisis / CSVs ─────────────────────
        trio = (app_ans == ka == oa and oa != "?")
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
            "o_reliable":  o_reliable,
            "trio":        trio,              # True = App=K=O (máxima confianza)
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

def run(categories: list | None = None) -> dict:
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
