#!/usr/bin/env python3
"""
Parsea los HTMLs descargados con "view-source" del navegador y genera
los JSON para App_Chatelac.

Los archivos pueden ser:
  1) HTML real del servidor (directo)
  2) HTML del viewer "view-source" del Chrome (el contenido real está
     dentro de <td class="line-content">...)

Uso:
  python3 scrape_modules.py <html_file> <module_id> [base_url]
  e.g.
  python3 scrape_modules.py ../internetavanzado.html internet-avanzado https://sosit-txartela.net/demonline/internetavanzado/
  python3 scrape_modules.py ../outlookxp.html outlook-xp https://sosit-txartela.net/demonline/outlookxp/
"""

import sys
import json
import re
from pathlib import Path
from html import unescape

try:
    from bs4 import BeautifulSoup
    BS4 = True
except ImportError:
    print("ERROR: Instala beautifulsoup4: pip3 install beautifulsoup4")
    sys.exit(1)


BASE_URL_MAP = {
    'internet-avanzado': 'https://sosit-txartela.net/demonline/internetavanzado/',
    'outlook-xp': 'https://sosit-txartela.net/demonline/outlookxp/',
}


def extract_real_html(raw_content: str) -> str:
    """
    Si el archivo es el viewer de view-source de Chrome, extrae el HTML real
    que está dentro del DOM del viewer. De lo contrario devuelve el raw tal cual.
    """
    # El viewer de Chrome guarda el contenido como HTML inside <td class="line-content">
    # Cada línea del fuente va en un <td class="line-content">...</td>
    soup_outer = BeautifulSoup(raw_content, 'html.parser')
    line_tds = soup_outer.find_all('td', class_='line-content')
    
    if line_tds:
        # Reconstruimos el HTML real concatenando el texto de cada línea
        lines = []
        for td in line_tds:
            # El texto dentro del td ya está HTML-escapado dos veces en algunos casos.
            # get_text() extrae el texto plano de los spans de sintaxis.
            line_text = td.get_text()
            lines.append(line_text)
        real_html = '\n'.join(lines)
        # Hay casos donde aún quedan &amp;lt; -> necesitamos unescapar
        real_html = unescape(real_html)
        return real_html
    
    # No es viewer, es HTML directo
    return raw_content


def parse_tipo_c(fs, module_id, q_num):
    """Preguntas de tipo test C: múltiple opción."""
    # Enunciado: primer <p>
    p = fs.find('p')
    question_text = p.get_text(strip=True) if p else ''

    # Imagen en el enunciado
    has_image = False
    image_url = None
    img = fs.find('img')
    if img and not fs.find('div', class_='simulacionContainer'):
        has_image = True
        src = img.get('src', '')
        image_url = src if src.startswith('http') else None

    # Opciones: div.respuesta (la correcta también tiene clase "correcta")
    options = []
    correct_answer_nums = []
    correct_answers = []

    resp_divs = fs.find_all('div', class_='respuesta')
    for div in resp_divs:
        opt_text = div.get_text(separator=' ', strip=True)
        # Quitar guion líder si lo hay
        if opt_text.startswith('- '):
            opt_text = opt_text[2:]
        if not opt_text:
            continue
        value = len(options) + 1
        options.append({'value': value, 'text': opt_text})

        classes = div.get('class', [])
        if 'correcta' in classes:
            correct_answer_nums.append(value)
            correct_answers.append(opt_text)

    # Fallback: si no hay div.respuesta, intentar con <tr>
    if not options:
        rows = fs.find_all('tr')
        if rows:
            question_text = question_text or rows[0].get_text(separator=' ', strip=True)
            for row in rows[1:]:
                opt_text = row.get_text(separator=' ', strip=True)
                if not opt_text:
                    continue
                value = len(options) + 1
                options.append({'value': value, 'text': opt_text})
                row_classes = ' '.join(row.get('class', []))
                td_classes = ' '.join(c for td in row.find_all('td') for c in td.get('class', []))
                if 'correcta' in row_classes or 'correcta' in td_classes:
                    correct_answer_nums.append(value)
                    correct_answers.append(opt_text)

    return build_question(module_id, q_num, 'C', question_text, options,
                          correct_answer_nums, correct_answers,
                          len(correct_answer_nums) > 1,
                          has_image, image_url)


def parse_tipo_b(fs, module_id, q_num, base_url):
    """
    Preguntas de simulación (Tipo B): tienen simulacionContainer con imágenes
    y clickRect con coordenadas data-x, data-y, data-w, data-h.
    """
    # Enunciado
    p = fs.find('p')
    question_text = p.get_text(strip=True) if p else fs.find('legend').next_sibling
    if hasattr(question_text, 'get_text'):
        question_text = question_text.get_text(strip=True)
    else:
        question_text = str(question_text).strip() if question_text else ''

    # Pasos de simulación
    solution_images = []
    click_areas = []  # [{step, x, y, w, h, imgSrc}]

    containers = fs.find_all('div', class_='simulacionContainer')
    for i, container in enumerate(containers, 1):
        img = container.find('img', class_='media')
        img_src = ''
        if img:
            src = img.get('src', '')
            if src and not src.startswith('http'):
                img_src = base_url + src if base_url else src
            else:
                img_src = src
            solution_images.append(img_src)

        click_rect = container.find('div', class_='clickRect')
        if click_rect:
            click_areas.append({
                'step': i,
                'x': int(click_rect.get('data-x', 0)),
                'y': int(click_rect.get('data-y', 0)),
                'w': int(click_rect.get('data-w', 0)),
                'h': int(click_rect.get('data-h', 0)),
                'imgSrc': img_src,
            })

    q = build_question(module_id, q_num, 'B', question_text, None,
                       [], [], False, False, None)
    q['solutionImages'] = solution_images
    q['clickAreas'] = click_areas
    return q


def parse_tipo_i(fs, module_id, q_num, base_url):
    """Preguntas de imagen + test (Tipo I)."""
    p = fs.find('p')
    question_text = p.get_text(strip=True) if p else ''
    options = []
    correct_answer_nums = []
    correct_answers = []
    image_url = None

    # Buscar imagen (que no sea de simulacion)
    img = fs.find('img')
    if img:
        src = img.get('src', '')
        if not src.startswith('http') and base_url:
            image_url = base_url + src
        else:
            image_url = src

    # Opciones: div.respuesta
    resp_divs = fs.find_all('div', class_='respuesta')
    for div in resp_divs:
        opt_text = div.get_text(separator=' ', strip=True)
        if opt_text.startswith('- '):
            opt_text = opt_text[2:]
        if not opt_text:
            continue
        value = len(options) + 1
        options.append({'value': value, 'text': opt_text})
        classes = div.get('class', [])
        if 'correcta' in classes:
            correct_answer_nums.append(value)
            correct_answers.append(opt_text)

    # Fallback con <tr>
    if not options:
        rows = fs.find_all('tr')
        for row in rows:
            opt_text = row.get_text(separator=' ', strip=True)
            if not opt_text:
                continue
            value = len(options) + 1
            options.append({'value': value, 'text': opt_text})
            row_classes = ' '.join(row.get('class', []))
            td_classes = ' '.join(c for td in row.find_all('td') for c in td.get('class', []))
            if 'correcta' in row_classes or 'correcta' in td_classes:
                correct_answer_nums.append(value)
                correct_answers.append(opt_text)

    q = build_question(module_id, q_num, 'I', question_text, options,
                       correct_answer_nums, correct_answers,
                       len(correct_answer_nums) > 1,
                       bool(image_url), image_url)
    return q


def build_question(module_id, q_num, q_type, question, options,
                   correct_nums, correct_texts, multiple,
                   has_image, image_url):
    return {
        'id': f'{module_id}_{q_num}',
        'questionNum': q_num,
        'question': question,
        'type': q_type,
        'options': options,
        'correctAnswerNums': correct_nums,
        'correctAnswers': correct_texts,
        'multipleCorrect': multiple,
        'hasImage': has_image,
        'image': None,
        'imageUrl': image_url,
        'module': module_id,
        'solutionImages': [],
    }


def parse_html(html_content, module_id, base_url=''):
    soup = BeautifulSoup(html_content, 'html.parser')
    questions = []

    for fs in soup.find_all('fieldset'):
        legend = fs.find('legend')
        if not legend:
            continue
        legend_text = legend.get_text(strip=True)

        num_match = re.search(r'Pregunta\s+(\d+)', legend_text, re.IGNORECASE)
        if not num_match:
            continue
        q_num = int(num_match.group(1))

        if 'Tipo C' in legend_text:
            q = parse_tipo_c(fs, module_id, q_num)
        elif 'Tipo B' in legend_text:
            q = parse_tipo_b(fs, module_id, q_num, base_url)
        elif 'Tipo I' in legend_text:
            q = parse_tipo_i(fs, module_id, q_num, base_url)
        elif 'Tipo A' in legend_text:
            q = parse_tipo_c(fs, module_id, q_num)  # mismo formato
            q['type'] = 'A'
        else:
            continue

        questions.append(q)

    return sorted(questions, key=lambda q: q['questionNum'])


def main():
    if len(sys.argv) < 3:
        print("Uso: python3 scrape_modules.py <html_file> <module_id> [base_url]")
        sys.exit(1)

    html_file = Path(sys.argv[1])
    module_id = sys.argv[2]
    base_url = sys.argv[3] if len(sys.argv) > 3 else BASE_URL_MAP.get(module_id, '')

    if not html_file.exists():
        print(f"ERROR: No existe el archivo {html_file}")
        sys.exit(1)

    print(f"Leyendo {html_file} ({html_file.stat().st_size:,} bytes)...")
    raw_content = html_file.read_text(encoding='utf-8', errors='replace')
    
    print("Extrayendo HTML real (descodificando view-source si es necesario)...")
    real_html = extract_real_html(raw_content)
    
    print(f"HTML real: {len(real_html):,} chars. Parseando preguntas...")
    questions = parse_html(real_html, module_id, base_url)

    # Estadísticas
    tipos = {}
    for q in questions:
        tipos[q['type']] = tipos.get(q['type'], 0) + 1
    print(f"\n=== Módulo: {module_id} ===")
    print(f"Total preguntas: {len(questions)}")
    print(f"Por tipo: {tipos}")
    
    sin_correcta = [q['questionNum'] for q in questions
                    if q['type'] in ('C', 'I') and not q['correctAnswerNums']]
    if sin_correcta:
        print(f"AVISO: {len(sin_correcta)} preguntas C/I sin respuesta correcta: {sin_correcta[:20]}")

    # Guardar JSON
    out_dir = Path(__file__).parent.parent / 'public' / 'data'
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f'{module_id}.json'
    out_path.write_text(json.dumps(questions, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"\nGuardado: {out_path} ({out_path.stat().st_size:,} bytes)")


if __name__ == '__main__':
    main()
