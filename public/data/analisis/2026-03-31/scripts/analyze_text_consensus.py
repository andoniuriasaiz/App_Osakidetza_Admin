import json, os, difflib, collections

def load_json(path):
    if not os.path.exists(path): return {}
    with open(path, 'r', encoding='utf-8') as f: return json.load(f)

# Normalize text for better matching
def norm(txt):
    if not txt: return ''
    # Remove numbering and leading/trailing spaces
    txt = txt.strip().lower()
    if '.-' in txt[:10]: txt = txt.split('.-', 1)[1]
    elif '. ' in txt[:10]: txt = txt.split('.', 1)[1]
    return txt.strip()[:60] # Use first 60 chars for comparison

def find_match(app_txt, search_pool):
    # search_pool is a dict {id: {text, ans}}
    target = norm(app_txt)
    for qid, qdata in search_pool.items():
        if norm(qdata.get('text', '')) == target:
            return qid, qdata.get('ans', '?')
    # If no exact snippet match, try fuzzy (last resort)
    return None, '?'

def analyze_category(local_file, kaixo_text_file, osasun_ans_file, osasun_offset, title):
    app_data = load_json('public/data/' + local_file)
    k_pool = load_json('public/data/analisis/2026-03-31/data_text/' + kaixo_text_file)
    o_ans = load_json('public/data/analisis/2026-03-31/raw/' + osasun_ans_file)
    
    n2l = {1:'A', 2:'B', 3:'C', 4:'D'}
    results = []
    
    for q in app_data:
        oid = q.get('originalId')
        oid_s = str(oid) if oid else ''
        app_ans = n2l.get(q.get('correctAnswerNums', [None])[0], '?')
        app_txt = q.get('question', '')
        
        # Match Kaixo by Text
        _, k_ans = find_match(app_txt, k_pool)
        
        # Match Osasun by Offset (fallback to ID if offset is 0)
        oa = o_ans.get(str(int(oid) + osasun_offset) if oid else '', '?')
        
        # Determine Status
        if app_ans == k_ans == oa != '?': status = 'ACUERDO'
        elif k_ans == oa != '?' and app_ans != k_ans: status = 'FALLO APP'
        elif app_ans != '?' and k_ans != '?' and oa != '?' and k_ans != oa: status = 'DISPUTA K/O'
        else: status = 'REVISAR'
        
        # Consensus
        votes = [v for v in [app_ans, k_ans, oa] if v != '?']
        con = collections.Counter(votes).most_common(1)[0][0] if votes else '?'
        
        results.append({
            'ID': oid,
            'Txt': app_txt[:60],
            'App': app_ans,
            'K': k_ans,
            'O': oa,
            'Con': con,
            'Status': status
        })
    return results

if __name__ == '__main__':
    # Offsets refined: Admin/Aux start Spec at 299? 
    # Let's use 298 for Específicas based on user's Q4=302 example.
    report_data = {
        'C2_COMUN': analyze_category('comun.json', 'kaixo_c2_text.json', 'osasun_admin.json', 0, 'Comun C2'),
        'A2_COMUN': analyze_category('tec-comun.json', 'kaixo_a1_text.json', 'osasun_nurse.json', 0, 'Comun A2'),
        'ADMIN': analyze_category('adm.json', 'kaixo_admin_text.json', 'osasun_admin.json', 298, 'Admin'),
        'AUX': analyze_category('aux.json', 'kaixo_aux_text.json', 'osasun_aux.json', 298, 'Auxiliar')
    }
    
    out = 'public/data/analisis/2026-03-31/'
    md = open(out + 'INFORME_FINAL_TEXTUAL.md', 'w', encoding='utf-8')
    md.write('# Auditoría de Consenso Osakidetza (Final Content-Based)\n\n')
    
    for cat, data in report_data.items():
        tot = len(data)
        ok = sum(1 for x in data if x['Status'] == 'ACUERDO')
        fail = sum(1 for x in data if x['Status'] == 'FALLO APP')
        disp = sum(1 for x in data if x['Status'] == 'DISPUTA K/O')
        md.write(f'## {cat}\n')
        md.write(f'- Total: {tot} | Acuerdo: {ok} ({ok/tot*100:.1f}%) | Fallo App: {fail} | Disputa K/O: {disp}\n\n')
        
        problems = [x for x in data if x['Status'] != 'ACUERDO']
        if problems:
            md.write('| ID | Pregunta | App | K | O | Status |\n|---|---|---|---|---|---|\n')
            for p in problems[:40]:
                md.write(f'| {p["ID"]} | {p["Txt"]}... | {p["App"]} | {p["K"]} | {p["O"]} | **{p["Status"]}** |\n')
        md.write('\n\n---\n')
        json.dump(data, open(out + cat + '_final.json', 'w'), indent=2, ensure_ascii=False)
    md.close()
    print('Final text-based analysis generated.')
