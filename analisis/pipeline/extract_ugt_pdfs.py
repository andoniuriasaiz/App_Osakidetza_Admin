#!/usr/bin/env python3
"""
extract_ugt_pdfs.py — Extractor de preguntas y respuestas correctas de los PDFs de UGT.
=====================================================================================
Extrae el contenido de los PDFs proporcionados por UGT y los convierte a JSON.
Cada JSON contendrá la estructura completa (texto de la pregunta, opciones y la opción correcta),
vinculado por su ID numérico.
"""

import pypdf
import sys
import re
import json
from pathlib import Path

def clean_pdf_text(text: str) -> str:
    """Elimina encabezados, pies de página y textos fijos del PDF."""
    lines = text.split('\n')
    clean_lines = []
    
    # Textos comunes de encabezado/pie en los PDFs de UGT
    skips = [
        "osakidetza@ugt-speuskadi.org",
        "T eléfono: 607 16 20 21",
        "Teléfono: 607 16 20 21",
        "En cumplimiento del Reglamento General",
        "dos por ESFERA OPOSICIONES",
        "medio. Puede ejercer sus derechos",
        "Aquí podrás realizar tantas veces como",
        "R E S P U E S T A S",
        "T E M A R I O S  O P E",
        "O S A K I D E T Z A",
        "O P E",
        "A C T U A L I Z A D O S",
        "L o s  c o n t e n i d o s",
        "a y u d a r  a l  e s t u d i o"
    ]
    
    for line in lines:
        if not line.strip():
            continue
            
        # Ignorar líneas que contengan alguno de los 'skips'
        if any(s in line for s in skips):
            continue
            
        # Ignorar paginación (e.g. "Página 4")
        if re.match(r'^Página\s+\d+$', line.strip()):
            continue
            
        # Ignorar "Preguntas Temario Específico..." repetitivo en cabeceras
        if "Preguntas " in line and ("OPE " in line or "Temario" in line or "BATERIA" in line):
            continue
            
        clean_lines.append(line)
        
    # Limpiar saltos de línea extraños provenientes de 'T eléfono' y guiones de fin de línea
    joined_text = "\n".join(clean_lines)
    joined_text = joined_text.replace("-\n", "")
    joined_text = re.sub(r'T\s*el[eé]fono:\s*\d{3}\s*\d{2}\s*\d{2}\s*\d{2}', '', joined_text)
    
    return joined_text


def parse_questions(text: str) -> list[dict]:
    """Usa regex para parsear cada bloque de pregunta y sus opciones."""
    # Buscar inicio de línea, número, punto, un espacio normal (no salto de línea), y el resto.
    blocks = re.finditer(r'(?:^|\n)(\d+)\.[ \t]+([\s\S]*?)(?=\n\d+\.[ \t]|$)', text)
    extracted = []
    
    for b in blocks:
        qid = int(b.group(1))
        content = b.group(2).strip()
        
        # Separar el texto principal de las opciones (a), (b), (c), (d), (e)
        parts = re.split(r'\n\s*\(([a-e])\)\s*', content)
        
        qtext = parts[0].strip()
        options = {}
        correct = None
        
        for i in range(1, len(parts), 2):
            letter = parts[i].upper()
            opt_text = parts[i+1].strip()
            
            # Buscar la etiqueta de correcta
            if re.search(r'\(\s*[Cc]orrecta\s*\)', opt_text):
                correct = letter
            
            # Limpiar etiquetas del texto de la opción
            opt_text = re.sub(r'\s*\(\s*(in)?[Cc]orrecta\s*\)\s*', '', opt_text, flags=re.IGNORECASE).strip()
            options[letter] = opt_text
            
        extracted.append({
            "id": qid,
            "question": qtext,
            "correctAnswer": correct,
            "options": options
        })
        
    return extracted


def process_pdf(pdf_path: Path, output_dir: Path) -> None:
    print(f"Procesando: {pdf_path.name}")
    try:
        with open(pdf_path, "rb") as f:
            pdf = pypdf.PdfReader(f)
            text = "\n".join(page.extract_text() for page in pdf.pages)
            
        clean_txt = clean_pdf_text(text)
        questions = parse_questions(clean_txt)
        
        # Validar si hemos detectado algo incorrecto
        missing_answers = [q["id"] for q in questions if not q["correctAnswer"]]
        if missing_answers:
            print(f"  ⚠ Advertencia: Las siguientes preguntas no tienen respuesta detectada: {missing_answers[:10]}...")
            
        out_name = pdf_path.stem + ".json"
        out_path = output_dir / out_name
        
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(questions, f, ensure_ascii=False, indent=2)
            
        print(f"  ✓ Completado: {len(questions)} preguntas guardadas en {out_name}")
        
    except Exception as e:
        print(f"  ❌ Error al procesar {pdf_path.name}: {e}")


def main():
    base_dir = Path(__file__).resolve().parent.parent.parent
    pdfs_dir = base_dir / "public" / "data" / "ugt_respuestas"
    out_dir = pdfs_dir / "extracted"
    
    out_dir.mkdir(parents=True, exist_ok=True)
    
    print("\n" + "=" * 60)
    print("  Extracción de Raspuestas UGT")
    print("=" * 60)
    
    pdf_files = list(pdfs_dir.glob("*.pdf"))
    if not pdf_files:
        print(f"No se encontraron PDFs en {pdfs_dir}")
        return
        
    for pdf_path in sorted(pdf_files):
        process_pdf(pdf_path, out_dir)
        
    print("\n  ✓ ¡Todos los archivos han sido procesados!")
    print(f"  Archivos generados en: {out_dir}")

if __name__ == "__main__":
    main()
