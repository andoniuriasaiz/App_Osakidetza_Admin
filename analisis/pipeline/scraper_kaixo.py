"""
scraper_kaixo.py — Scraper de respuestas de Kaixo.com
======================================================
Actualiza los archivos raw/kaixo_*.json con las respuestas correctas.

CÓMO FUNCIONA:
  Kaixo tiene una página especial que muestra TODAS las respuestas en tabla:
    https://www.kaixo.com/opeosaki/index.php?aukera={cat}&aukera2=eran&hizk=1

  Una sola petición por categoría recupera num→letra para todas las preguntas.
  Los números de pregunta en Kaixo corresponden al originalId/officialId de la app.

  Si el fetch falla, conserva el valor cacheado que ya tengamos.
"""

import urllib.request
import ssl
import re
import json
import sys
from pathlib import Path
from typing import List, Optional

_HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(_HERE))
from config import KAIXO_ERAN_BASE, CATEGORIES, RAW_DIR

# ── SSL permisivo (kaixo.com puede tener problemas de cert en algunos entornos) ──
_CTX = ssl.create_default_context()
_CTX.check_hostname = False
_CTX.verify_mode = ssl.CERT_NONE

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9",
}

# Regex: <td><a href=...num=N >N</a> LETRA(S)</td>
_ANS_RE = re.compile(r">\s*(\d+)\s*</a>\s*([A-Ea-e]+)\s*</td>", re.I)


def _clean_answer(raw: str) -> str:
    """Normaliza respuestas multi-letra (p.ej. 'DB' → 'B', 'AB' → 'B')."""
    if not raw:
        return "?"
    raw = raw.strip().upper()
    for ch in reversed(raw):
        if ch in "ABCDE":
            return ch
    return "?"


def _fetch_answers(category: str) -> dict[str, str]:
    """
    Fetcha la página resumen de Kaixo y extrae {num_str → letra}.
    Devuelve dict vacío en caso de error.
    """
    url = KAIXO_ERAN_BASE.format(category=category)
    req = urllib.request.Request(url, headers=_HEADERS)
    try:
        with urllib.request.urlopen(req, context=_CTX, timeout=30) as r:
            html = r.read().decode("utf-8", errors="replace")
    except Exception as exc:
        print(f"  ⚠  Error al conectar con Kaixo: {exc}")
        return {}

    matches = _ANS_RE.findall(html)
    if not matches:
        print(f"  ⚠  No se encontraron respuestas en la página Kaixo ({len(html)} bytes)")
        return {}

    return {num: _clean_answer(letter) for num, letter in matches}


def scrape_category(cat_key: str, force: bool = False) -> dict:
    """
    Scrapea una categoría de Kaixo y actualiza el archivo raw.
    Si force=False, solo reemplaza los valores "?" o ausentes.
    Devuelve el dict {num_str: letra} actualizado.
    """
    cfg      = CATEGORIES[cat_key]
    out_path = RAW_DIR / cfg["raw_kaixo"]
    category = cfg["kaixo_cat"]
    total    = cfg["kaixo_n"]

    # Cargar datos existentes
    existing: dict = {}
    if out_path.exists() and not force:
        with open(out_path, encoding="utf-8") as fh:
            raw = json.load(fh)
        for k, v in raw.items():
            existing[k] = _clean_answer(v if isinstance(v, str) else v.get("ans", ""))

    print(f"  [Kaixo/{cat_key}] Descargando respuestas de {category}…")
    live = _fetch_answers(category)

    if not live:
        print(f"  [Kaixo/{cat_key}] Sin datos nuevos — usando caché ({len(existing)} entradas).")
        return existing

    # Merge: si force, live gana; si no, live solo rellena "?" o vacíos
    merged = dict(existing)
    updated = 0
    for num_str, letter in live.items():
        if force or not merged.get(num_str) or merged[num_str] == "?":
            if merged.get(num_str) != letter:
                merged[num_str] = letter
                updated += 1

    # Guardar
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(
            dict(sorted(merged.items(), key=lambda x: int(x[0]))),
            fh, ensure_ascii=False, indent=2
        )
    with open(out_path, "a", encoding="utf-8") as fh:
        fh.write("\n")

    known   = sum(1 for v in merged.values() if v and v != "?")
    unknown = sum(1 for v in merged.values() if not v or v == "?")
    print(f"  [Kaixo/{cat_key}] ✓ {len(live)} respuestas obtenidas, "
          f"{updated} actualizadas → {out_path.name}")
    print(f"    Con respuesta: {known}/{total}  |  Sin respuesta(?): {unknown}")
    if unknown:
        missing = [k for k, v in merged.items() if not v or v == "?"]
        print(f"    Preguntas sin resp: {missing[:20]}" + (" …" if len(missing) > 20 else ""))

    return merged


def run(categories: Optional[List] = None, force: bool = False) -> None:
    print("\n" + "=" * 60)
    print("  PASO 1 — Scraping Kaixo.com (respuestas completas)")
    print("=" * 60)
    cats = categories or list(CATEGORIES.keys())
    # Evitar duplicar si dos categorías comparten el mismo raw_kaixo
    done_files: set = set()
    for cat in cats:
        raw_file = CATEGORIES[cat]["raw_kaixo"]
        if raw_file in done_files:
            print(f"  [Kaixo/{cat}] Ya cubierto ({raw_file}), omitiendo.")
            continue
        done_files.add(raw_file)
        scrape_category(cat, force=force)
    print()


if __name__ == "__main__":
    run()
