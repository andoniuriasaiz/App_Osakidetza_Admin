#!/usr/bin/env python3
"""
Descarga todas las imágenes de los módulos desde sosit-txartela.net
y las guarda en public/images/{moduleId}/

Uso:
  cd chatelac-quiz
  python3 scripts/download-images.py

Después de ejecutarlo las imágenes estarán en public/images/ y los JSON
tendrán el campo imageUrl actualizado apuntando a /images/...
"""

import json
import os
import time
import urllib.request
import urllib.error
from pathlib import Path

# Directorio raíz del proyecto (donde está este script/../)
ROOT = Path(__file__).parent.parent

DATA_DIR = ROOT / "public" / "data"
IMAGES_DIR = ROOT / "public" / "images"

MODULES = {
    "access-basico":  "https://sosit-txartela.net/demonline/access2000basico/",
    "excel-avanzado": "https://sosit-txartela.net/demonline/excel2010avanzado/",
    "powerpoint":     "https://sosit-txartela.net/demonline/powerxp/",
    "word-avanzado":  "https://sosit-txartela.net/demonline/word2010avanzado/",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Referer": "https://sosit-txartela.net/",
}

def download_image(url: str, dest: Path) -> bool:
    """Descarga una imagen si no existe ya. Devuelve True si tuvo éxito."""
    if dest.exists():
        return True  # ya descargada
    dest.parent.mkdir(parents=True, exist_ok=True)
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = resp.read()
        if len(data) < 100:
            print(f"  SKIP (demasiado pequeño): {url}")
            return False
        dest.write_bytes(data)
        return True
    except urllib.error.HTTPError as e:
        print(f"  ERROR HTTP {e.code}: {url}")
        return False
    except Exception as e:
        print(f"  ERROR: {url} — {e}")
        return False


def process_module(module_id: str, base_url: str):
    json_path = DATA_DIR / f"{module_id}.json"
    if not json_path.exists():
        print(f"\n[{module_id}] JSON no encontrado, saltando")
        return

    with open(json_path, encoding="utf-8") as f:
        questions = json.load(f)

    module_img_dir = IMAGES_DIR / module_id
    ok = 0
    skip = 0
    err = 0
    updated = 0

    print(f"\n=== {module_id} ({len(questions)} preguntas) ===")

    for q in questions:
        img_rel = q.get("image")
        if not img_rel or "noimage" in img_rel.lower():
            q["imageUrl"] = None
            continue

        img_url = base_url + img_rel
        # Construir ruta local conservando la estructura de carpetas
        # Ejemplo: Imagenes/23tema1/power647.png → public/images/powerpoint/Imagenes/23tema1/power647.png
        dest = module_img_dir / img_rel

        success = download_image(img_url, dest)
        if success:
            ok += 1
            # Actualizar imageUrl a ruta local para la app
            local_url = f"/images/{module_id}/{img_rel}"
            q["imageUrl"] = local_url
            updated += 1
        else:
            err += 1
            q["imageUrl"] = None  # fallback: la app usará URL remota

        # Pequeña pausa para no sobrecargar el servidor
        time.sleep(0.1)

    print(f"  Descargadas: {ok} | Errores: {err} | Omitidas (noimage): {skip}")
    print(f"  imageUrl actualizado en {updated} preguntas")

    # Guardar JSON actualizado
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(questions, f, ensure_ascii=False, indent=2)
    print(f"  JSON guardado: {json_path}")


if __name__ == "__main__":
    print("Descargando imágenes de sosit-txartela.net...")
    print(f"Destino: {IMAGES_DIR}")

    for module_id, base_url in MODULES.items():
        process_module(module_id, base_url)

    print("\n¡Listo! Ahora haz 'npm run build' para verificar que todo compila.")
    print("Recuerda incluir public/images/ en el repositorio antes de hacer deploy a Vercel.")
