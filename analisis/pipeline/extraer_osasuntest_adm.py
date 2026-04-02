#!/usr/bin/env python3
import urllib.request
import ssl
import re
import json
import sys
from pathlib import Path

# SSL Context
_CTX = ssl.create_default_context()
_CTX.check_hostname = False
_CTX.verify_mode = ssl.CERT_NONE

_HEADERS = {"User-Agent": "Mozilla/5.0"}
OUT_DIR = Path("osasuntest_output")

# Regex to extract table answers
_ROW_RE  = re.compile(r"<tr[^>]*>(.*?)</tr>",  re.DOTALL | re.I)
_CELL_RE = re.compile(r"<td[^>]*>(.*?)</td>",  re.DOTALL | re.I)
_TAG_RE  = re.compile(r"<[^>]+>")

def extract_table_answers(html_tbl: str) -> list[str]:
    answers = []
    for row_m in _ROW_RE.finditer(html_tbl):
        cells = [_TAG_RE.sub("", c.group(1)).strip() for c in _CELL_RE.finditer(row_m.group(1))]
        if len(cells) >= 2 and cells[0].isdigit() and len(cells[1]) == 1 and cells[1].upper() in "ABCDE":
            answers.append(cells[1].upper())
    return answers

def extract_category(cat_name: str):
    print(f"\n--- Scrapeando Category: {cat_name} ---")
    url = f"https://osasuntest.es/categoria/{cat_name}/"
    req = urllib.request.Request(url, headers=_HEADERS)
    try:
        with urllib.request.urlopen(req, context=_CTX) as r:
            html = r.read().decode("utf-8")
    except Exception as e:
        print(f"Error descargando {url}: {e}")
        return

    # 1. Extract JSON blocks from data-questions
    json_blobs = re.findall(r"data-questions=[\"\'](.*?)[\"\']", html)
    # 2. Extract Tables
    tables = re.findall(r'<table.*?class=["\'][^"\']*wpts-tabla-respuestas[^"\']*["\'].*?</table>', html, re.DOTALL | re.I)

    if not json_blobs or not tables:
        print(f"Error: No se encontraron datos (Blobs: {len(json_blobs)}, Tablas: {len(tables)})")
        return

    print(f"Encontrados {len(json_blobs)} bloques de preguntas y {len(tables)} tablas.")

    OUT_DIR.mkdir(exist_ok=True)
    
    suffixes = ["c2_comun", "especifico", "total"]
    for i, blob in enumerate(json_blobs):
        if i >= len(suffixes): break
        
        # Parse JSON
        raw_json = re.sub(r"&quot;", "\"", blob)
        try:
            questions = json.loads(raw_json)
        except Exception as e:
            print(f"Error parseando JSON {i}: {e}")
            continue

        # Extract Table Answers
        table_ans = extract_table_answers(tables[i])
        
        # Merge by index
        merged = []
        for j, q in enumerate(questions):
            ans = table_ans[j] if j < len(table_ans) else "?"
            q["correctAnswer"] = ans
            merged.append(q)

        out_name = OUT_DIR / f"osasuntest_{cat_name}_{suffixes[i]}.json"
        with open(out_name, "w", encoding="utf-8") as f:
            json.dump(merged, f, indent=2, ensure_ascii=False)
        print(f"  - Bloque {i+1} ({len(merged)} qs): {out_name.name}")

if __name__ == "__main__":
    cats = sys.argv[1:] if len(sys.argv) > 1 else ["administrativo"]
    for c in cats:
        extract_category(c)
