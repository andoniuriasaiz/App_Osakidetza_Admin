import json, os, difflib, collections

def load_json(p):
    if not os.path.exists(p): return {}
    with open(p, 'r', encoding='utf-8') as f: return json.load(f)

# Improved normalization for text matching
def clean_txt(t):
    if not t: return ''
    t = t.lower().strip()
    # Remove markers like 1.- or 1. or (1)
    for prefix in ['.-', '. ', ') ']:
        if prefix in t[:10]: t = t.split(prefix, 1)[1]
    return ''.join(c for c in t if c.isalnum())[:80]

# Clean multi-letter answers from Kaixo (TAKE LAST)
def clean_ans(a):
    if not a: return '?'
    a = a.strip().upper()
    if len(a) > 1: return a[-1] # DB -> B, AB -> B
    return a if a in 'ABCD' else '?'

def aggregate(local_app, k_text_file, k_ans_file, o_ans_file, o_offset, category_name):
    print(f'Processing {category_name}...')
    app = load_json('public/data/' + local_app)
    k_txt = load_json('public/data/analisis/2026-03-31/data_text/' + k_text_file)
    k_ans = load_json('public/data/analisis/2026-03-31/raw/' + k_ans_file)
    o_ans = load_json('public/data/analisis/2026-03-31/raw/' + o_ans_file)
    
    # Pre-index Kaixo by cleaned text for cases where ID matching fails
    k_map = {clean_txt(v.get('text','')): clean_ans(k_ans.get(k,'?')) for k,v in k_txt.items() if clean_txt(v.get('text',''))}
    
    n2l = {1:'A', 2:'B', 3:'C', 4:'D'}
    final = []
    
    for q in app:
        # originalId should now be present for A2 questions
        oid = q.get('originalId')
        app_ans = n2l.get(q.get('correctAnswerNums', [None])[0], '?')
        app_txt = q.get('question', '')
        c_txt = clean_txt(app_txt)
        
        # Match Kaixo: Try ID first, then text matching
        ka = '?'
        if oid and str(oid) in k_ans:
            ka = clean_ans(k_ans.get(str(oid)))
        else:
            ka = k_map.get(c_txt, '?')
            if ka == '?' and c_txt:
                matches = difflib.get_close_matches(c_txt, k_map.keys(), n=1, cutoff=0.7)
                if matches: ka = k_map[matches[0]]
            
        # Match Osasuntest: Try ID with offset
        oa = '?'
        try:
            if oid and (isinstance(oid, int) or str(oid).isdigit()):
                oa = o_ans.get(str(int(oid) + o_offset), '?')
        except:
            pass
        
        # Determine Status
        status = 'PERFECT'
        consensus = app_ans
        
        if ka == oa != '?' and app_ans == ka:
            status = 'PERFECT'
        elif ka == oa != '?' and app_ans != ka:
            status = 'RED_FLAG'
            consensus = ka
        elif (ka == app_ans and oa == '?') or (oa == app_ans and ka == '?'):
            status = 'PERFECT' # Sufficient partial consensus
        elif ka != '?' and oa != '?' and ka != oa:
            status = 'TRIPLE_DISPUTE'
            consensus = '???'
        elif ka == '?' and oa == '?':
            status = 'INCOMPLETE'
            
        final.append({
            'id': q.get('id'),
            'originalId': oid,
            'text': app_txt,
            'app': app_ans,
            'k': ka,
            'o': oa,
            'consensus': consensus,
            'status': status
        })
    return final

if __name__ == '__main__':
    data = {
        'C2': aggregate('comun.json', 'kaixo_c2_text.json', 'kaixo_c2.json', 'osasun_admin.json', 0, 'C2'),
        'A2': aggregate('tec-comun.json', 'kaixo_nurse_text.json', 'kaixo_common_a2.json', 'osasun_nurse.json', 0, 'A2'),
        'ADM': aggregate('adm.json', 'kaixo_admin_text.json', 'kaixo_admin.json', 'osasun_admin.json', 298, 'ADM'),
        'AUX': aggregate('aux.json', 'kaixo_aux_text.json', 'kaixo_aux.json', 'osasun_aux.json', 298, 'AUX')
    }
    
    out_dir = 'public/data/analisis/2026-03-31/'
    all_results = data
    
    with open(out_dir + 'CLEAN_CONSENSUS.json', 'w', encoding='utf-8') as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)
    print('Clean consensus data generated.')
    
    audit_summary = {}
    total_q = 0
    for cat, qs in all_results.items():
        perf = len([q for q in qs if q['status'] == 'PERFECT'])
        rf = len([q for q in qs if q['status'] == 'RED_FLAG'])
        td = len([q for q in qs if q['status'] == 'TRIPLE_DISPUTE'])
        inc = len([q for q in qs if q['status'] == 'INCOMPLETE'])
        audit_summary[cat] = f"PERFECT: {perf} ({perf/len(qs):.2%}), RED_FLAG: {rf}, DISPUTE: {td}, INCOMPLETE: {inc}"
        total_q += len(qs)
    
    print("Summary of Audit:")
    for cat, summary in audit_summary.items():
        print(f"{cat}: {summary}")
    print(f"Total: {total_q}")

