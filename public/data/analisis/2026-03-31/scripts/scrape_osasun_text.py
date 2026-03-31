import urllib.request, ssl, re, json, os, concurrent.futures

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def fetch_osasun_q(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=10) as r:
            html = r.read().decode('utf-8')
            # Extract question text from h2 or main div
            # Example: 1.- De acuerdo con ...
            q_match = re.search(r'<div class=\"wpts-enunciado\">\s*(\d+[\.-].*?)\s*</div>', html, re.DOTALL | re.IGNORECASE)
            # Answer: resp-d\"> D
            ans_match = re.search(r'resp-[a-d]\">\s*([a-d])\s*</span>', html, re.DOTALL | re.IGNORECASE)
            return {
                'text': q_match.group(1).strip() if q_match else '',
                'ans': ans_match.group(1).upper() if ans_match else ''
            }
    except: return {}

def scrape_osasun(category, count, output_path):
    print(f'Scraping Osasun {category} ({count} questions)...')
    base_url = f'https://www.osasuntest.es/osakidetza/{category}/pregunta-'
    results = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(fetch_osasun_q, base_url + str(i)): i for i in range(1, count + 1)}
        for future in concurrent.futures.as_completed(futures):
            i = futures[future]
            q_data = future.result()
            if q_data: results[str(i)] = q_data
            if i % 100 == 0: print(f'Progress: {i}/{count}')
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f'Saved {len(results)} questions to {output_path}')

if __name__ == '__main__':
    os.makedirs('public/data/analisis/2026-03-31/data_text/', exist_ok=True)
    # Admin 500
    scrape_osasun('administrativo', 500, 'public/data/analisis/2026-03-31/data_text/osasun_admin_text.json')
    # Aux 500
    scrape_osasun('auxiliar-administrativo', 500, 'public/data/analisis/2026-03-31/data_text/osasun_aux_text.json')
    # Nurse 700? 
    scrape_osasun('enfermero', 700, 'public/data/analisis/2026-03-31/data_text/osasun_nurse_text.json')
