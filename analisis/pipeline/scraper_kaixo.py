"""
scraper_kaixo.py — Scraper de respuestas de Kaixo.com
======================================================
Actualiza los archivos raw/kaixo_*.json con las respuestas correctas
de cada pregunta de práctica.

NOTA TÉCNICA:
  Kaixo.com muestra la respuesta correcta en la misma página estática,
  pero usa distintas variantes de HTML según el modo de práctica.
  Este scraper prueba varios patrones de extracción. Si una pregunta
  no puede extraerse (JS required o patrón no reconocido), conserva el
  valor que ya tenemos en el archivo raw existente.

  Si Kaixo cambia su HTML, ajustar las regexes en _extract_answer().
"""

import urllib.request
import ssl
import re
import json
import concurrent.futures
import sys
from pathlib import Path

# Importar config con ruta relativa compatible con ejecución directa
_HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(_HERE))
from config import KAIXO_BASE, CATEGORIES, RAW_DIR

# ── SSL permisivo (kaixo.com tiene cert autofirmado en algunos entornos) ─────
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


def _clean_answer(raw: str) -> str:
    """Normaliza respuestas multi-letra (p.ej. 'DB' → 'B')."""
    if not raw:
        return "?"
    raw = raw.strip().upper()
    # Tomar el último carácter válido (los multi-letra son artefactos del scraper manual)
    for ch in reversed(raw):
        if ch in "ABCDE":
            return ch
    return "?"


def _extract_answer(html: str) -> str:
    """
    Intenta extraer la respuesta correcta del HTML de una pregunta de Kaixo.
    Prueba varios patrones en orden de fiabilidad.
    Devuelve '' si no puede extraerla.
    """
    patterns = [
        # Patrón 1: clase CSS 'correcta' o 'respuesta-correcta'
        r'class=["\'][^"\']*(?:correcta|correct|right)[^"\']*["\'][^>]*>\s*([A-D])\b',
        # Patrón 2: data-respuesta o data-correct
        r'data-(?:respuesta|correct(?:a)?)["\']?\s*[:=]\s*["\']?([A-D])\b',
        # Patrón 3: texto "Respuesta correcta: X"
        r'[Rr]espuesta\s+correcta[:\s]+([A-D])\b',
        # Patrón 4: JSON embebido con "answer" o "respuesta"
        r'"(?:answer|respuesta|correcta?)"\s*:\s*"([A-D])"',
        # Patrón 5: radio/checkbox seleccionado marcado como correcto
        r'<(?:input|label)[^>]+(?:checked|selected)[^>]*>\s*([A-D])\b',
        # Patrón 6: highlight en span/div con la letra
        r'<(?:span|div|li)[^>]+(?:ok|correct|bien|verde)[^>]*>\s*([A-D])\b',
    ]
    for pat in patterns:
        m = re.search(pat, html, re.I | re.DOTALL)
        if m:
            ans = m.group(1).upper()
            if ans in "ABCDE":
                return ans
    return ""


def _fetch_one(url: str) -> dict:
    req = urllib.request.Request(url, headers=_HEADERS)
    try:
        with urllib.request.urlopen(req, context=_CTX, timeout=15) as r:
            html = r.read().decode("utf-8", errors="replace")
        ans = _extract_answer(html)
        # Texto de la pregunta (útil para verificación manual)
        q_m = re.search(r"<b>\s*(\d+[\.-].*?)\s*</b>", html, re.DOTALL | re.I)
        text = q_m.group(1).strip() if q_m else ""
        return {"ans": ans, "text": text, "ok": bool(ans)}
    except Exception as exc:
        return {"ans": "", "text": "", "ok": False, "error": str(exc)}


def scrape_category(cat_key: str, force: bool = False, workers: int = 5) -> dict:
    """
    Scrapea una categoría de Kaixo y actualiza el archivo raw correspondiente.
    Si force=False, solo descarga las preguntas que faltan.
    Devuelve el dict {num_str: letra} actualizado.
    """
    cfg     = CATEGORIES[cat_key]
    out_path = RAW_DIR / cfg["raw_kaixo"]
    category = cfg["kaixo_cat"]
    total    = cfg["kaixo_n"]

    # Cargar datos existentes
    existing: dict = {}
    if out_path.exists():
        with open(out_path, encoding="utf-8") as fh:
            raw = json.load(fh)
        # Normalizar: convertir valores que puedan ser dict {"ans":...} a letra limpia
        for k, v in raw.items():
            existing[k] = _clean_answer(v if isinstance(v, str) else v.get("ans", ""))

    # Determinar qué preguntas hay que pedir
    need = [i for i in range(1, total + 1)
            if force or not existing.get(str(i)) or existing[str(i)] == "?"]

    if not need:
        print(f"  [Kaixo/{cat_key}] Sin cambios — {total} respuestas ya disponibles.")
        return existing

    print(f"  [Kaixo/{cat_key}] Descargando {len(need)}/{total} preguntas "
          f"(cat={category}, workers={workers})…")

    results = dict(existing)
    fetched = ok = err = 0

    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as ex:
        future_map = {
            ex.submit(_fetch_one, KAIXO_BASE.format(category=category, num=i)): i
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
                # Conservar valor previo si existe; si no, marcar como desconocido
                if str(i) not in results:
                    results[str(i)] = "?"
                err += 1
            if fetched % 50 == 0 or fetched == len(need):
                pct = fetched / len(need) * 100
                print(f"    {fetched}/{len(need)} ({pct:.0f}%)  ok={ok}  sin_resp={err}")

    # Guardar
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(dict(sorted(results.items(), key=lambda x: int(x[0]))),
                  fh, ensure_ascii=False, indent=2)

    known = sum(1 for v in results.values() if v and v != "?")
    print(f"  [Kaixo/{cat_key}] ✓ Guardado → {out_path.name}  "
          f"(con respuesta: {known}/{total})")
    if err:
        print(f"  [Kaixo/{cat_key}] ⚠ {err} preguntas sin respuesta extraíble "
              f"(Kaixo puede requerir JS para mostrarlas).")
    return results


def run(categories: list | None = None, force: bool = False) -> None:
    print("\n" + "=" * 60)
    print("  PASO 1 — Scraping Kaixo.com")
    print("=" * 60)
    cats = categories or list(CATEGORIES.keys())
    for cat in cats:
        scrape_category(cat, force=force)
    print()


if __name__ == "__main__":
    run()
