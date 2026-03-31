"""
scraper_osasun.py — Scraper de respuestas de Osasuntest.es
===========================================================
Actualiza los archivos raw/osasun_*.json.

CÓMO FUNCIONA:
  Osasuntest.es es un WordPress con el plugin wpts que embebe todas las
  preguntas y respuestas en la página de categoría (1 página = todas).
  Las URLs de pregunta individual (/pregunta-N) devuelven 404.

  Cada página de categoría contiene varias tablas "wpts-tabla-respuestas":
    - Tabla 1: solo bloque común (ej. 300 preguntas C2)
    - Tabla 2: solo bloque específico (ej. 200 preguntas ADM)
    - Tabla 3: todos combinados (ej. 500 preguntas)  ← usamos ESTA

  Los números de la tabla corresponden al originalId/officialId de la app.

  Una sola petición por categoría — sin concurrencia necesaria.
"""

import urllib.request
import ssl
import re
import json
import sys
from pathlib import Path

_HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(_HERE))
from config import OSASUN_CAT_BASE, CATEGORIES, RAW_DIR

_CTX = ssl.create_default_context()
_CTX.check_hostname = False
_CTX.verify_mode = ssl.CERT_NONE

_HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}

# Regex para extraer filas de tabla: <td>NUM</td>...<td>LETRA</td>
_ROW_RE  = re.compile(r"<tr[^>]*>(.*?)</tr>",  re.DOTALL | re.I)
_CELL_RE = re.compile(r"<td[^>]*>(.*?)</td>",  re.DOTALL | re.I)
_TAG_RE  = re.compile(r"<[^>]+>")


def _extract_tables(html: str) -> list[dict[str, str]]:
    """
    Extrae todas las tablas wpts-tabla-respuestas.
    Devuelve lista de dicts {num_str → letra}.
    """
    tables = []
    for tstart in [m.start() for m in re.finditer(
            r'<table\s[^>]*class=["\'][^"\']*wpts-tabla-respuestas[^"\']*["\']', html, re.I)]:
        tend = html.find("</table>", tstart) + 8
        tbl  = html[tstart:tend]
        answers: dict[str, str] = {}
        for row_m in _ROW_RE.finditer(tbl):
            cells = [_TAG_RE.sub("", c.group(1)).strip()
                     for c in _CELL_RE.finditer(row_m.group(1))]
            if len(cells) >= 2 and cells[0].isdigit() and len(cells[1]) == 1 and cells[1].upper() in "ABCDE":
                answers[cells[0]] = cells[1].upper()
        if answers:
            tables.append(answers)
    return tables


def scrape_category(cat_key: str, force: bool = False) -> dict:
    """
    Scrapea una categoría de Osasuntest y actualiza el archivo raw.
    Usa la tabla más grande de la página (bloque combinado).
    Devuelve el dict {num_str: letra}.
    """
    cfg      = CATEGORIES[cat_key]
    out_path = RAW_DIR / cfg["raw_osasun"]
    category = cfg["osasun_cat"]
    total    = cfg["osasun_n"]

    # Cargar datos existentes (si no force)
    existing: dict = {}
    if out_path.exists() and not force:
        with open(out_path, encoding="utf-8") as fh:
            existing = json.load(fh)

    print(f"  [Osasun/{cat_key}] Descargando {category}…")
    url = OSASUN_CAT_BASE.format(category=category)
    req = urllib.request.Request(url, headers=_HEADERS)
    try:
        with urllib.request.urlopen(req, context=_CTX, timeout=60) as r:
            html = r.read().decode("utf-8", errors="replace")
    except Exception as exc:
        print(f"  ⚠  Error al conectar con Osasuntest: {exc}")
        return existing

    tables = _extract_tables(html)
    if not tables:
        print(f"  ⚠  No se encontraron tablas de respuestas ({len(html)} bytes)")
        return existing

    # Para la mayoría de categorías usamos la tabla más grande (= combinada).
    # Para A2/enfermero usamos la más pequeña (= solo el bloque común de 200).
    use_smallest = cfg.get("osasun_min_table", False)
    best = min(tables, key=len) if use_smallest else max(tables, key=len)
    label = "más pequeña" if use_smallest else "más grande"
    print(f"  [Osasun/{cat_key}] {len(tables)} tabla(s); "
          f"usando la {label} ({len(best)} preguntas)")

    # Merge
    merged = dict(existing)
    updated = 0
    for num_str, letter in best.items():
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
    print(f"  [Osasun/{cat_key}] ✓ {updated} actualizadas → {out_path.name}")
    print(f"    Con respuesta: {known}/{total}  |  Sin respuesta(?): {unknown}")

    return merged


def run(categories: list | None = None, force: bool = False) -> None:
    print("\n" + "=" * 60)
    print("  PASO 2 — Scraping Osasuntest.es (tablas de respuestas)")
    print("=" * 60)
    done_files: set = set()
    cats = categories or list(CATEGORIES.keys())
    for cat in cats:
        raw_file = CATEGORIES[cat]["raw_osasun"]
        if raw_file in done_files:
            print(f"  [Osasun/{cat}] Ya cubierto ({raw_file}), omitiendo.")
            continue
        done_files.add(raw_file)
        scrape_category(cat, force=force)
    print()


if __name__ == "__main__":
    run()
