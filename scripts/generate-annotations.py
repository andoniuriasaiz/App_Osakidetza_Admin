#!/usr/bin/env python3
"""
Genera imágenes de solución anotadas (step2) para las 36 preguntas del Grupo B
(simulaciones sin imagen de solución real).

Dibuja un círculo rojo con etiqueta sobre la imagen de enunciado indicando
exactamente dónde debe hacer clic el usuario.

Uso:
  python3 scripts/generate-annotations.py
  python3 scripts/generate-annotations.py --dry-run    # sólo lista sin guardar
  python3 scripts/generate-annotations.py --module excel-avanzado
"""

import argparse
import json
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("Instala Pillow primero:  pip install Pillow --break-system-packages")
    sys.exit(1)

ROOT      = Path(__file__).parent.parent
DATA_DIR  = ROOT / "public" / "data"
IMAGE_DIR = ROOT / "public" / "images"

# ---------------------------------------------------------------------------
# Datos de anotación por módulo y pregunta.
# Formato: qnum -> (archivo_fuente, cx, cy, radio, etiqueta)
#   cx, cy  = coordenadas del centro del círculo en píxeles (440×250)
#   radio   = radio del círculo en píxeles
# ---------------------------------------------------------------------------
ANNOTATIONS = {

    "excel-avanzado": {
        "src_dir": "Imagenes/0tema1",
        "questions": {
            # q47: Selecciona todas las celdas con un click
            # → botón Seleccionar Todo (esquina sup-izq de la cuadrícula)
            47:  ("cap_20150504132058.png", 37,  150, 15, "Clic aquí"),

            # q49: Alinee el texto en el medio de la celda (alineación vertical)
            # → botón Alinear en el centro (grupo Alineación, fila superior)
            49:  ("cap_20150504153020.png", 356, 64,  16, "Alinear centro"),

            # q50: Centre el texto seleccionado (alineación horizontal)
            # → botón Centrar (grupo Alineación, segunda fila)
            50:  ("cap_20150504153104.png", 320, 78,  16, "Centrar"),

            # q53: Seleccione la columna C
            # → clic en la cabecera de columna C
            53:  ("cap_20150504154146.png", 210, 150, 18, "Col C"),

            # q124: Deshaga la última acción sin el teclado
            # → botón Deshacer en la Barra de acceso rápido (QAT)
            124: ("cap_20150505112926.png", 73,  8,   12, "Deshacer"),
        },
    },

    "access-basico": {
        "src_dir": "Imagenes/ImagenesAccess",
        "questions": {
            # q14: Envíe a imprimir la consulta
            # → botón Imprimir en la barra de herramientas
            14:  ("consultadatos.jpg",  45,  46,  18, "Imprimir"),

            # q91: Elimine la macro siguiente
            # → botón Eliminar (X) en la barra de la ventana de base de datos
            91:  ("ventmacro2.jpg",     127, 68,  14, "Eliminar"),

            # q115: Crear tabla en Vista Diseño (primer paso)
            # → doble clic en "Crear una tabla en vista Diseño"
            115: ("ventanatabla2.jpg",  220, 97,  45, "Vista Diseño"),

            # q116: Abrir tabla Clientes en Vista Diseño
            # → primero clic en "Tablas" en el panel izquierdo
            116: ("ventpag.jpg",        73,  100, 20, "Tablas"),

            # q117: Abrir tabla Clientes en Vista Hoja de datos
            # → primero clic en "Tablas" en el panel izquierdo
            117: ("ventpag.jpg",        73,  100, 20, "Tablas"),
        },
    },

    "powerpoint": {
        "src_dir": "Imagenes/23tema1",
        "questions": {
            # q2: ¿Cómo se puede cerrar el archivo?
            # → menú Archivo
            2:   ("power.aberto1.png",       55,  28,  25, "Archivo"),

            # q4: ¿Cómo acceder a la vista clasificador de diapositivas?
            # → menú Ver
            4:   ("power3.plan.aberto.png",  103, 28,  20, "Ver"),

            # q19: ¿A qué ventana para insertar WordArt?
            # → menú Insertar
            19:  ("power.aberto.png",        138, 28,  25, "Insertar"),

            # q33: ¿Cómo enviar la presentación por correo electrónico?
            # → menú Archivo
            33:  ("power657.correo.png",     55,  28,  25, "Archivo"),

            # q38: ¿En qué parte pinchar para agregar una nota?
            # → barra de notas en la parte inferior
            38:  ("power.aberto2.png",       280, 222, 38, "Área de notas"),

            # q77: ¿Cuál es el botón que permite dar sombra al cuadrado?
            # → botón Estilo de sombra en la barra de dibujo (parte inferior)
            77:  ("power813.aberto.png",     405, 238, 13, "Sombra"),

            # q152: ¿Dónde escribir un término para consultar la Ayuda?
            # → campo "Escriba una pregunta" en la parte superior derecha
            152: ("1.png",                   375, 28,  45, "Ayuda"),

            # q153: Desactive la casilla para cerrar el ayudante de Office
            # → casilla "Utilizar el Ayudante de Office"
            153: ("3.png",                   18,  40,  14, "Casilla"),

            # q163: Acceder a plantillas de diseño a través del panel de tareas
            # → opción "De plantilla de diseño" en el panel
            163: ("22.png",                  350, 216, 42, "Plantilla"),

            # q165: Señale con un clic el patrón de títulos (slide 2 en panel)
            165: ("29.png",                  65,  185, 30, "Patrón títulos"),

            # q166: Señale con un clic el patrón de diapositivas (slide 1 en panel)
            166: ("29.png",                  65,  118, 30, "Patrón diap."),

            # q167: Cierre el patrón de diapositivas
            # → botón "Cerrar vista Patrón"
            167: ("32.png",                  356, 66,  42, "Cerrar patrón"),

            # q175: Botón que disminuye un nivel el párrafo (demote / →)
            # → flecha derecha en el panel de esquema (izq. del panel)
            175: ("48.png",                  18,  44,  12, "Dem. nivel"),

            # q176: Botón que aumenta un nivel el párrafo (promote / ←)
            # → flecha izquierda en el panel de esquema
            176: ("47.png",                  8,   44,  12, "Aum. nivel"),

            # q177: Botón que sube un párrafo (move up / ↑)
            177: ("49.png",                  8,   50,  12, "Subir"),

            # q178: Botón que baja un párrafo (move down / ↓)
            178: ("49.png",                  18,  50,  12, "Bajar"),

            # q179: Botón para realizar una revisión ortográfica
            # → botón ABC en la barra de herramientas estándar
            179: ("52.png",                  70,  47,  15, "Ortografía"),

            # q180: Cambiar la palabra todas las veces que aparezca
            # → botón "Cambiar todas" en el cuadro de diálogo Ortografía
            180: ("54.png",                  333, 197, 32, "Cambiar todas"),

            # q185: ¿Qué casilla activar para mantener el formato propio?
            # → casilla "Mantener formato de origen" en Buscador de diapositivas
            185: ("64.png",                  18,  219, 15, "Mantener formato"),

            # q187: Insertar un organigrama (diagramas de org)
            # → icono de organigrama en el marcador de contenido
            187: ("70.png",                  319, 195, 22, "Organigrama"),

            # q197: Avance automático de diapositivas
            # → casilla "Automáticamente después de" en panel de transición
            197: ("82.png",                  264, 165, 48, "Automáticamente"),

            # q200: Acceder a propiedades de la impresora
            # → botón "Propiedades" en el cuadro de diálogo Imprimir
            200: ("87.png",                  395, 42,  32, "Propiedades"),

            # q235: Vista preliminar sin la barra de menús
            # → botón Vista preliminar en la barra de herramientas
            235: ("powerpoint-duplicar.png", 30,  47,  15, "Vista previa"),

            # q239: Cuadrícula sin la barra de menús
            # → botón Cuadrícula en la barra de herramientas
            239: ("powerpoint-escala.png",   204, 47,  15, "Cuadrícula"),

            # q262: ¿Qué opción para insertar imagen desde un archivo?
            # → icono "Insertar imagen" en el marcador de contenido
            262: ("powerpoint-opcion.png",   210, 148, 26, "Desde archivo"),
        },
    },

    "word-avanzado": {
        "src_dir": "Imagenes/0tema1",
        "questions": {
            # q37: Borrar el formato del texto seleccionado
            # → botón "Borrar todo el formato" en el grupo Fuente (Inicio)
            37: ("cap_20150507024219.png", 178, 61, 16, "Borrar formato"),
        },
    },
}

# ---------------------------------------------------------------------------
# Generación de imágenes
# ---------------------------------------------------------------------------

RED         = (220, 30,  30,  255)
RED_FILL    = (220, 30,  30,  60)   # semitransparente
WHITE       = (255, 255, 255, 255)
SHADOW_CLR  = (0,   0,   0,   100)


def draw_annotation(img: Image.Image, cx: int, cy: int, r: int, label: str) -> Image.Image:
    """Dibuja un círculo anotado sobre la imagen y devuelve una nueva imagen."""
    # Trabajamos en RGBA para soportar transparencia
    if img.mode != "RGBA":
        base = img.convert("RGBA")
    else:
        base = img.copy()

    # Capa de anotación (transparente)
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    # Círculo relleno semitransparente
    draw.ellipse(
        [cx - r, cy - r, cx + r, cy + r],
        fill=RED_FILL,
        outline=RED,
        width=3,
    )

    # Cruz interior (punto de referencia)
    draw.line([cx - 4, cy, cx + 4, cy], fill=RED, width=2)
    draw.line([cx, cy - 4, cx, cy + 4], fill=RED, width=2)

    # Etiqueta de texto
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 11)
    except Exception:
        font = ImageFont.load_default()

    # Posición del texto (abajo del círculo, centrado)
    text_y = cy + r + 3
    if text_y + 14 > base.height:
        text_y = cy - r - 16   # encima si no cabe abajo

    # Fondo del texto (sombra/pill)
    bbox = draw.textbbox((0, 0), label, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tx = cx - tw // 2
    # Sombra de texto
    draw.rectangle([tx - 2, text_y - 1, tx + tw + 2, text_y + th + 1],
                   fill=(0, 0, 0, 140))
    # Texto blanco
    draw.text((tx, text_y), label, font=font, fill=WHITE)

    # Combinar capas
    result = Image.alpha_composite(base, overlay)
    return result


def process_module(module_id: str, dry_run: bool = False) -> int:
    info = ANNOTATIONS[module_id]
    src_base = IMAGE_DIR / module_id / info["src_dir"]
    sol_dir  = IMAGE_DIR / module_id / "solutions"
    json_path = DATA_DIR / f"{module_id}.json"

    with open(json_path, encoding="utf-8") as f:
        questions = json.load(f)

    q_map = {q["questionNum"]: q for q in questions}

    updated = 0
    for qnum, (src_file, cx, cy, r, label) in info["questions"].items():
        src_path = src_base / src_file
        dest_path = sol_dir / f"q{qnum}_step2.png"

        print(f"  Q{qnum:>3}: {src_file}  →  q{qnum}_step2.png  @ ({cx},{cy}) r={r}", end="  ")

        if not src_path.exists():
            print(f"❌ origen no encontrado: {src_path}")
            continue

        if not dry_run:
            sol_dir.mkdir(parents=True, exist_ok=True)
            img = Image.open(src_path)
            annotated = draw_annotation(img, cx, cy, r, label)
            # Guardar como PNG (sin importar si el original era JPEG)
            annotated.convert("RGB").save(dest_path, "PNG", optimize=True)

        # Actualizar el JSON
        q = q_map.get(qnum)
        if q is not None:
            existing = q.get("solutionImages", [])
            step1 = existing[0] if existing else f"/images/{module_id}/solutions/q{qnum}_step1.png"
            new_path = f"/images/{module_id}/solutions/q{qnum}_step2.png"
            if len(existing) < 2:
                q["solutionImages"] = [step1, new_path]
                updated += 1
                tag = "(dry-run) " if dry_run else ""
                print(f"✅ {tag}guardado")
            else:
                print(f"— step2 ya existe en JSON, no se sobreescribe")
        else:
            print(f"⚠️  Q{qnum} no encontrada en JSON")

    if not dry_run and updated > 0:
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(questions, f, ensure_ascii=False, indent=2)
        print(f"\n  💾 JSON guardado: {updated} preguntas actualizadas en {module_id}")

    return updated


def main():
    parser = argparse.ArgumentParser(description="Genera imágenes de solución anotadas para Grupo B")
    parser.add_argument("--dry-run", action="store_true", help="No guardar cambios")
    parser.add_argument("--module", default=None, help="Módulo concreto (opcional)")
    args = parser.parse_args()

    modules = [args.module] if args.module else list(ANNOTATIONS.keys())
    total = 0

    for mod_id in modules:
        if mod_id not in ANNOTATIONS:
            print(f"Módulo desconocido: {mod_id}")
            continue
        print(f"\n📦 {mod_id}")
        total += process_module(mod_id, dry_run=args.dry_run)

    print(f"\n{'='*55}")
    print(f"Total preguntas procesadas: {total}")
    if total > 0 and not args.dry_run:
        print("\nPróximo paso:")
        print("  git add public/data/*.json public/images/*/solutions/")
        print('  git commit -m "feat: annotated solution images for Group B simulations"')
        print("  git push")


if __name__ == "__main__":
    main()
