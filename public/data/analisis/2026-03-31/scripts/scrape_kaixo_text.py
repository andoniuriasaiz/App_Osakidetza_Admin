import urllib.request, ssl, re, json, os, concurrent.futures

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def fetch_q(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=10) as r:
            html = r.read().decode('utf-8')
            # Extract question text from <b> tag
            q_match = re.search(r'<b>\s*(\d+[\.-].*?)\s*</b>', html, re.DOTALL | re.IGNORECASE)
            # Answer: Kaixo practice page doesn t show the check. 
            # We already have the answer in the Table Scraper.
            return {
                'text': q_match.group(1).strip() if q_match else '',
                'ans': '' # Answer will be mapped from the table later
            }
    except: return {}

def scrape_kaixo(category, count, output_path, limit=None):
    if limit: count = limit
    print(f'Scraping {category} (count: {count})...')
    base_url = f'https://www.kaixo.com/opeosaki/index.php?aukera={category}&hizk=1&num='
    results = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(fetch_q, base_url + str(i)): i for i in range(1, count + 1)}
        for future in concurrent.futures.as_completed(futures):
            i = futures[future]
            q_data = future.result()
            if q_data: results[str(i)] = q_data
            if i % 50 == 0: print(f'Progress: {i}/{count}')
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f'Saved {len(results)} questions to {output_path}')

if __name__ == '__main__':
    os.makedirs('public/data/analisis/2026-03-31/data_text/', exist_ok=True)
    # Common 300
    scrape_kaixo('ope26osakicomun300', 300, 'public/data/analisis/2026-03-31/data_text/kaixo_c2_text.json')
    # Técnico Common A1
    scrape_kaixo('ope26osakicomun200', 200, 'public/data/analisis/2026-03-31/data_text/kaixo_a1_text.json')
    # Admin
    scrape_kaixo('ope26osakiadmin', 200, 'public/data/analisis/2026-03-31/data_text/kaixo_admin_text.json')
    # Aux
    scrape_kaixo('ope26osakiaux', 200, 'public/data/analisis/2026-03-31/data_text/kaixo_aux_text.json')
