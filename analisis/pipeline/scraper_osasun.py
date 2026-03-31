"""
scraper_osasun.py — Scraper de respuestas de Osasuntest.es
===========================================================
Actualiza los archivos raw/osasun_*.json.
Osasuntest muestra la respuesta correcta directamente en el HTML estático,
por lo que no necesita JavaScript.
"""

import urllib.request
import ssl
import re
import json
import concurrent.futures
import sys
from pathlib import Path

_HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(_HERE))
from config import OSASUN_BASE, CATEGORIES, RAW_DIR

_CTX = ssl.create_default_context()
_CTX.check_hostname = False
_CTX.verify_mode = ssl.CERT_NONE

_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; OsakidetzaBot/1.0)"}


def _fetch_one(url: str) -> dict:
    req = urllib.request.Request(url, headers=_HEADERS)
    try:
        with urllib.request.urlopen(req, context=_CTX, timeout=15) as r:
            html = r.read().decode("utf-8", errors="replace")

        # Respuesta correcta: <span class="resp-b"> B </span>  (la destacada)
        ans_m = re.search(
            r'<span[^>]+class=["\'][^"\']*resp-([a-d])[^"\']*["\'][^>]*>',
            html, re.I
        )
        # Texto de la pregunta
        q_m = re.search(
            r'<div[^>]+class=["\'][^"\']*wpts-enunciado[^"\']*["\'][^>]*>\s*(.*?)\s*</div>',
            html, re.DOTALL | re.I
        )
        ans  = ans_m.group(1).upper() if ans_m else ""
        text = re.sub(r"<[^>]+>", "", q_m.group(1)).strip() if q_m else ""
        return {"ans": ans, "text": text, "ok": bool(ans)}
    except Exception as exc:
        return {"ans": "", "text": "", "ok": False, "error": str(exc)}


def scrape_category(cat_key: str, force: bool = False, workers: int = 10) -> dict:
    cfg      = CATEGORIES[cat_key]
    out_path = RAW_DIR / cfg["raw_osasun"]
    category = cfg["osasun_cat"]
    total    = cfg["osasun_n"]

    # Cargar existente
    existing: dict = {}
    if out_path.exists():
        with open(out_path, encoding="utf-8") as fh:
            existing = json.load(fh)

    need = [i for i in range(1, total + 1)
            if force or not existing.get(str(i)) or existing[str(i)] == "?"]

    if not need:
        print(f"  [Osasun/{cat_key}] Sin cambios — {total} respuestas ya disponibles.")
        return existing

    print(f"  [Osasun/{cat_key}] Descargando {len(need)}/{total} preguntas "
          f"(cat={category}, workers={workers})…")

    results = dict(existing)
    fetched = ok = err = 0

    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as ex:
        future_map = {
            ex.submit(_fetch_one, OSASUN_BASE.format(category=category, num=i)): i
            for i in need
        }
        for future in concurrent.futures.as_completed(future_map):
            i    = future_map[future]
            data = future.result()
            fetched += 1
            if data["ok"]:
                results[str(i)] = data["ans"]
                ok += 1
            else:
                if str(i) not in results:
                    results[str(i)] = "?"
                err += 1
            if fetched % 100 == 0 or fetched == len(need):
                pct = fetched / len(need) * 100
                print(f"    {fetched}/{len(need)} ({pct:.0f}%)  ok={ok}  err={err}")

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(dict(sorted(results.items(), key=lambda x: int(x[0]))),
                  fh, ensure_ascii=False, indent=2)

    known = sum(1 for v in results.values() if v and v != "?")
    print(f"  [Osasun/{cat_key}] ✓ Guardado → {out_path.name}  "
          f"(con respuesta: {known}/{total})")
    return results


def run(categories: list | None = None, force: bool = False) -> None:
    print("\n" + "=" * 60)
    print("  PASO 2 — Scraping Osasuntest.es")
    print("=" * 60)
    # Osasun está organizado por bloques, no por categoría app:
    # solo scrapear cada archivo raw una vez aunque varias cats lo usen
    done_files: set = set()
    cats = categories or list(CATEGORIES.keys())
    for cat in cats:
        raw_file = CATEGORIES[cat]["raw_osasun"]
        if raw_file in done_files:
            print(f"  [Osasun/{cat}] Ya cubierto por scraping anterior ({raw_file}), omitiendo.")
            continue
        done_files.add(raw_file)
        scrape_category(cat, force=force)
    print()


if __name__ == "__main__":
    run()
