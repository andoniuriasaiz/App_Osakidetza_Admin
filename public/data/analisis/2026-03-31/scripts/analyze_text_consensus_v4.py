import json, os, collections

def load_json(path):
    if not os.path.exists(path): return {}
    with open(path, 'r', encoding='utf-8') as f: return json.load(f)

# Normalize text for fuzzy matching
def norm(txt):
    if not txt: return ''
    txt = txt.strip().lower()
    # Remove numbering like "1.-" or "1."
    if '.-' in txt[:10]: txt = txt.split('.-', 1)[1]
    elif '. ' in txt[:10]: txt = txt.split('.', 1)[1]
    # Remove weird characters and spaces
    txt = ''.join(c for i, c in enumerate(txt) if c.isalnum())
    return txt[:100] # Use first 100 alpha-numeric chars for matching

def analyze_category(local_app_file, kaixo_text_file, kaixo_ans_file, osasun_ans_file, osasun_offset, title):
    print(f'Analyzing {title}...')
    app_data = load_json('public/data/' + local_app_file)
    k_text = load_json('public/data/analisis/2026-03-31/data_text/' + kaixo_text_file)
    k_ans = load_json('public/data/analisis/2026-03-31/raw/' + kaixo_ans_file)
    o_ans = load_json('public/data/analisis/2026-03-31/raw/' + osasun_ans_file)
    
    # Create Kaixo Content-indexed map
    k_content_map = {}
    for kid, kdata in k_text.items():
        ans = k_ans.get(kid, '?')
        content_key = norm(kdata.get('text', ''))
        if content_key: k_content_map[content_key] = ans
        
    n2l = {1:'A', 2:'B', 3:'C', 4:'D'}
    results = []
    
    for q in app_data:
        oid = q.get('originalId')
        app_ans = n2l.get(q.get('correctAnswerNums', [None])[0], '?')
        app_txt = q.get('question', '')
        
        # Match Kaixo by Content
        ka = k_content_map.get(norm(app_txt), '?')
        
        # Match Osasun by Numeric ID + Offset
        oa = o_ans.get(str(int(oid) + osasun_offset) if oid else '', '?')
        
        # Status
        if app_ans == ka == oa != '?': stat = 'ACUERDO'
        elif ka == oa != '?' and app_ans != ka: stat = 'FALLO APP'
        elif app_ans != '?' and ka != '?' and oa != '?' and ka != oa: stat = 'DISPUTA K/O'
        else: stat = 'REVISAR'
        
        # Consensus
        votes = [v for v in [app_ans, ka, oa] if v != '?']
        con = collections.Counter(votes).most_common(1)[0][0] if votes else '?'
        
        results.append({
            'ID': oid,
            'Txt': app_txt[:60],
            'App': app_ans,
            'K': ka,
            'O': oa,
            'Con': con,
            'Status': stat
        })
    return results

if __name__ == '__main__':
    report_data = {
        'C2_COMUN': analyze_category('comun.json', 'kaixo_c2_text.json', 'kaixo_c2.json', 'osasun_admin.json', 0, 'C2_COMUN'),
        'A2_COMUN': analyze_category('tec-comun.json', 'kaixo_a1_text.json', 'kaixo_common_a2.json', 'osasun_nurse.json', 0, 'A2_COMUN'),
        'ADMIN': analyze_category('adm.json', 'kaixo_admin_text.json', 'kaixo_admin.json', 'osasun_admin.json', 298, 'ADMIN'),
        'AUX': analyze_category('aux.json', 'kaixo_aux_text.json', 'kaixo_aux.json', 'osasun_aux.json', 298, 'AUX')
    }
    
    out = 'public/data/analisis/2026-03-31/'
    md_path = out + 'REPORT_FINAL_V4.md'
    with open(md_path, 'w', encoding='utf-8') as f:
        f.write('# Informe Maestro Auditoría Osakidetza (V4 - Alineación por Contenido)\n\n')
        f.write('Este informe utiliza **Fuzzy Matching** por texto para ignorar los fallos de numeración en las webs.\n\n')
        
        for cat, data in report_data.items():
            tot = len(data)
            ok = sum(1 for x in data if x['Status'] == 'ACUERDO')
            fail = sum(1 for x in data if x['Status'] == 'FALLO APP')
            disp = sum(1 for x in data if x['Status'] == 'DISPUTA K/O')
            f.write(f'## {cat}\n')
            f.write(f'- Total analizadas: {tot} | Acuerdo: {ok} ({(ok/tot*100 if tot else 0):.1f}%) | Recomendación Mejora: {fail}\n\n')
            
            # Highlight non-agreements
            conflicts = [x for x in data if x['Status'] != 'ACUERDO']
            if conflicts:
                f.write('| ID | Pregunta | App | K | O | Status |\n|---|---|---|---|---|---|\n')
                for p in conflicts[:50]:
                    f.write(f'| {p["ID"]} | {p["Txt"]}... | {p["App"]} | {p["K"]} | {p["O"]} | **{p["Status"]}** |\n')
                if len(conflicts) > 50: f.write(f'\n*...y {len(conflicts)-50} discrepancias más.*')
            f.write('\n\n---\n')
        
        f.write('\n> [!NOTE]\n> Los archivos JSON con el detalle completo están en la misma carpeta.')
    
    # Save JSON details
    for cat, data in report_data.items():
        json.dump(data, open(out + cat + '_V4_DETALLE.json', 'w'), indent=2, ensure_ascii=False)
    
    print(f'Done! Report V4 generated at {md_path}')
