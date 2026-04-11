#!/usr/bin/env python3
import pypdf
import sys
import re
import json

def test_extract():
    pdf_path = sys.argv[1]
    with open(pdf_path, "rb") as f:
        pdf = pypdf.PdfReader(f)
        text = "\n".join(page.extract_text() for page in pdf.pages)
    
    # We want to match "\n1. " or "^1. "
    # But sometimes the header/footer interferes.
    # The header has "osakidetza@ugt-speuskadi.org" and "Preguntas..."
    # We should clean up headers/footers first.
    
    # Clean headers/footers
    lines = text.split('\n')
    clean_lines = []
    for line in lines:
        if "osakidetza@ugt-speuskadi.org" in line: continue
        if "Preguntas Temario Especí" in line: continue
        if "PREGUNTAS BATERIA COM" in line: continue
        if "Teléfono: 607 16 20 21" in line: continue
        if "En cumplimiento del Reglamento General" in line: continue
        if "dos por ESFERA OPOSICIONES" in line: continue
        if "medio. Puede ejercer sus derechos" in line: continue
        if "Aquí podrás realizar tantas veces como quieras" in line: continue
        if re.match(r'^Página \d+', line): continue
        if line.strip() == "": continue
        clean_lines.append(line)
        
    text = "\n".join(clean_lines)
    
    blocks = re.finditer(r'(?:^|\n)(\d+)\.\s+([\s\S]*?)(?=\n\d+\.\s|$)', text)
    extracted = []
    
    for b in blocks:
        qid = int(b.group(1))
        content = b.group(2).strip()
        
        # Split by newlines starting with (a), (b), (c)...
        parts = re.split(r'\n\(([a-e])\)\s*', content)
        
        qtext = parts[0].strip()
        options = {}
        correct = None
        
        for i in range(1, len(parts), 2):
            letter = parts[i].upper()
            opt_text = parts[i+1].strip()
            
            # Check if it contains (Correcta) or ( Correcta)
            if re.search(r'\(\s*[Cc]orrecta\s*\)', opt_text):
                correct = letter
            
            # Clean up the (Correcta)/ (Incorrecta) from the text
            opt_text = re.sub(r'\s*\(\s*(in)?[Cc]orrecta\s*\)\s*', '', opt_text, flags=re.IGNORECASE).strip()
            options[letter] = opt_text
            
        extracted.append({
            "id": qid,
            "question": qtext,
            "correctAnswer": correct,
            "options": options
        })
        
    with open("test_out.json", "w", encoding="utf-8") as f:
        json.dump(extracted, f, ensure_ascii=False, indent=2)
        
    print(f"Extracted {len(extracted)} questions.")
    
if __name__ == "__main__":
    test_extract()
