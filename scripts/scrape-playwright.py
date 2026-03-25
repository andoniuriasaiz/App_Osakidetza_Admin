#!/usr/bin/env python3
import base64
import json
import re
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).parent.parent
DATA_DIR = ROOT / "public" / "data"
IMAGE_DIR = ROOT / "public" / "images"

MODULES = {
    "access-basico":  "https://sosit-txartela.net/demonline/access2000basico/",
    "excel-avanzado": "https://sosit-txartela.net/demonline/excel2010avanzado/",
    "powerpoint":     "https://sosit-txartela.net/demonline/powerxp/",
    "word-avanzado":  "https://sosit-txartela.net/demonline/word2010avanzado/",
}

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
        )
        page = context.new_page()

        print("Logging in...")
        page.goto("https://sosit-txartela.net/foro/index.php?action=login")
        
        page.fill('input[name="user"]', 'kuxkuxin')
        page.fill('input[name="passwrd"]', 'Raquel1504')
        

            
        page.click('input[type="submit"]')
        # Wait a bit
        try:
            page.wait_for_load_state('networkidle', timeout=5000)
        except:
            pass
        
        print(f"Current URL: {page.url}")
        
        if page.locator('input[name="user"]').count() > 0 and 'kuxkuxin' not in page.content().lower():
            print("Login failed! The server might be blocking headless Chromium or the credentials are wrong.")
            sys.exit(1)
            
        print("Logged in successfully!")
        
        total_updated = 0
        for mod_id, base_url in MODULES.items():
            print(f"\n📦 Processing module {mod_id}")
            json_path = DATA_DIR / f"{mod_id}.json"
            if not json_path.exists():
                print(f"Not found: {json_path}")
                continue
                
            with open(json_path, encoding='utf-8') as f:
                questions = json.load(f)
                
            sim_qs = [q for q in questions if q.get('type') == 'B']
            updated = 0
            
            for q in sim_qs:
                qnum = q.get('questionNum')
                encoded = base64.b64encode(str(qnum).encode()).decode().rstrip('=')
                url = f"{base_url}chivato.php?pregunta={encoded}"
                
                page.goto(url)
                
                if "action=login" in page.url or "Iniciar sesión" in page.content():
                    print(f"❌ Q{qnum}: Session expired or unauthorized!")
                    break
                    
                imgs = page.evaluate('''() => {
                    return Array.from(document.querySelectorAll('img')).map(img => img.src).filter(src => src.startsWith('data:image'));
                }''')
                
                if not imgs:
                    # Some questions might not have solution images
                    print(f"— Q{qnum}: no inline images")
                    continue
                    
                paths = []
                sol_dir = IMAGE_DIR / mod_id / "solutions"
                sol_dir.mkdir(parents=True, exist_ok=True)
                
                for i, src in enumerate(imgs, start=1):
                    match = re.search(r'data:image/(.*?);base64,(.*)', src)
                    if not match: continue
                    ext = match.group(1)
                    if ext == "jpeg": ext = "jpg"
                    data = match.group(2).strip()
                    
                    filename = f"q{qnum}_step{i}.{ext}"
                    dest = sol_dir / filename
                    local_path = f"/images/{mod_id}/solutions/{filename}"
                    
                    try:
                        dest.write_bytes(base64.b64decode(data))
                        paths.append(local_path)
                    except Exception as e:
                        print(f"  Error saving {filename}: {e}")
                        
                if paths:
                    q['solutionImages'] = paths
                    updated += 1
                    print(f"✅ Q{qnum}: {len(paths)} images scraped")
                    
            if updated > 0:
                with open(json_path, 'w', encoding='utf-8') as f:
                    json.dump(questions, f, ensure_ascii=False, indent=2)
                print(f"💾 Saved {updated} questions successfully in {mod_id}.json")
                total_updated += updated
                
        print(f"\n🎉 Done! Total questions updated: {total_updated}")
        browser.close()

if __name__ == '__main__':
    run()
