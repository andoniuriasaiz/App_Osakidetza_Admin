#!/usr/bin/env python3
"""
Scraper de soluciones — sosit-txartela.net
==========================================
Extrae las imágenes de solución de cada pregunta tipo B (simulación) y
actualiza los JSON con el campo solutionImages[].

Las imágenes de solución están embebidas en el HTML de chivato.php como
data:image/png;base64,... — se decodifican y guardan como archivos PNG.

Uso más simple (sesión activa del navegador):
  python3 scripts/scrape-solutions.py --session PHPSESSID_VALUE

Uso con usuario/contraseña (alternativa):
  python3 scripts/scrape-solutions.py --user kuxkuxin --password Raquel1504

Cómo obtener el PHPSESSID:
  1. Abre https://sosit-txartela.net/demonline/access2000basico/ en Chrome
  2. Abre DevTools (F12) > Application > Cookies > sosit-txartela.net
  3. Copia el valor de PHPSESSID
  O desde la consola del navegador: document.cookie

Opciones:
  --session   Valor de PHPSESSID (sin necesidad de login)
  --user      Usuario del foro (alternativa a --session)
  --password  Contraseña (alternativa a --session)
  --module    Módulo concreto (access-basico | excel-avanzado | powerpoint | word-avanzado)
  --dry-run   No guarda cambios, sólo muestra lo que haría
"""

import argparse
import base64 as b64lib
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path
from http.cookiejar import CookieJar

try:
    import requests as _requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

ROOT      = Path(__file__).parent.parent
DATA_DIR  = ROOT / "public" / "data"
IMAGE_DIR = ROOT / "public" / "images"

MODULES = {
    "access-basico":  "https://sosit-txartela.net/demonline/access2000basico/",
    "excel-avanzado": "https://sosit-txartela.net/demonline/excel2010avanzado/",
    "powerpoint":     "https://sosit-txartela.net/demonline/powerxp/",
    "word-avanzado":  "https://sosit-txartela.net/demonline/word2010avanzado/",
}

LOGIN_PAGE = "https://sosit-txartela.net/foro/index.php?action=login"
LOGIN_URL  = "https://sosit-txartela.net/foro/index.php?action=login2"

BASE_HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
        'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    ),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
}

# ─── HTTP session ──────────────────────────────────────────────────────────────

class Session:
    def __init__(self, phpsessid: str = ''):
        if HAS_REQUESTS:
            self._sess = _requests.Session()
            self._sess.headers.update(BASE_HEADERS)
            if phpsessid:
                self._sess.cookies.set('PHPSESSID', phpsessid, domain='sosit-txartela.net')
            self._mode = 'requests'
        else:
            cj = CookieJar()
            self._opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
            self._opener.addheaders = list(BASE_HEADERS.items())
            if phpsessid:
                # Inject cookie manually via header
                self._opener.addheaders.append(('Cookie', f'PHPSESSID={phpsessid}'))
            self._mode = 'urllib'

    def get(self, url, timeout=15) -> str:
        if self._mode == 'requests':
            r = self._sess.get(url, timeout=timeout)
            r.raise_for_status()
            return r.text
        else:
            resp = self._opener.open(url, timeout=timeout)
            return resp.read().decode('utf-8', errors='replace')

    def post(self, url, data: dict, referer='', timeout=15) -> str:
        encoded = urllib.parse.urlencode(data).encode()
        extra = {
            'Referer': referer,
            'Origin': 'https://sosit-txartela.net',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-User': '?1',
            'Sec-Fetch-Dest': 'document',
        }
        if self._mode == 'requests':
            r = self._sess.post(url, data=data, headers=extra, timeout=timeout)
            r.raise_for_status()
            return r.text
        else:
            req = urllib.request.Request(url, data=encoded, headers={**BASE_HEADERS, **extra})
            resp = self._opener.open(req, timeout=timeout)
            return resp.read().decode('utf-8', errors='replace')


# ─── Auth ──────────────────────────────────────────────────────────────────────

def login(session: Session, username: str, password: str) -> bool:
    """Login via usuario/contraseña. Devuelve True si ok."""
    try:
        html = session.get(LOGIN_PAGE)
    except Exception as e:
        print(f"ERROR cargando página de login: {e}")
        return False

    # Extract hidden CSRF fields (SMF uses random field names per session)
    pwd_pos = html.find('name="passwrd"')
    if pwd_pos < 0:
        print("ERROR: No se encontró el formulario de login")
        return False
    form_start = html.rfind('<form', 0, pwd_pos)
    form_end   = html.find('</form>', pwd_pos) + 7
    form_html  = html[form_start:form_end]

    form_data = {}
    for tag in re.findall(r'<input\b[^>]+>', form_html, re.I):
        nm = re.search(r'name=["\']([^"\']+)["\']', tag)
        vl = re.search(r'value=["\']([^"\']*)["\']', tag)
        tp = re.search(r'type=["\']([^"\']+)["\']', tag, re.I)
        if nm and tp and tp.group(1).lower() == 'hidden':
            form_data[nm.group(1)] = vl.group(1) if vl else ''

    form_data.update({'user': username, 'passwrd': password, 'cookielength': '-1'})

    try:
        html2 = session.post(LOGIN_URL, data=form_data, referer=LOGIN_PAGE)
        if 'action=logout' in html2 or username.lower() in html2.lower():
            print(f"✅ Login exitoso como '{username}'")
            return True
        print("❌ Login fallido — verifica usuario/contraseña")
        return False
    except Exception as e:
        print(f"ERROR en login: {e}")
        if '403' in str(e):
            print()
            print("  El servidor bloquea el POST automático (WAF/nginx).")
            print("  Usa --session en lugar de --user/--password:")
            print()
            print("  1. Abre Chrome y ve a sosit-txartela.net (con sesión iniciada)")
            print("  2. Abre la consola (F12 > Console) y ejecuta:")
            print("       document.cookie.split(';').find(c=>c.includes('PHPSESSID'))")
            print("  3. Copia el valor y ejecuta:")
            print("       python3 scripts/scrape-solutions.py --session TU_PHPSESSID")
            print()
        return False


def verify_session(session: Session) -> bool:
    """Verifica que la sesión esté activa accediendo a una página protegida."""
    try:
        html = session.get(MODULES['access-basico'])
        if 'action=login' in html or 'Iniciar sesión' in html:
            print("❌ Sesión no válida o expirada")
            return False
        print("✅ Sesión activa")
        return True
    except Exception as e:
        print(f"ERROR verificando sesión: {e}")
        return False


# ─── Fetch & parse ─────────────────────────────────────────────────────────────

def fetch_chivato(session: Session, module_url: str, question_num: int) -> str | None:
    """Carga chivato.php para la pregunta dada. Devuelve HTML o None."""
    encoded = b64lib.b64encode(str(question_num).encode()).decode().rstrip('=')
    url = f"{module_url}chivato.php?pregunta={encoded}"
    try:
        html = session.get(url)
        if 'action=login' in html or 'Iniciar sesión' in html:
            return None  # session expired
        return html if len(html) > 200 else None
    except Exception:
        return None


def extract_inline_images(html: str, module_id: str, question_num: int, dry_run: bool) -> list[str]:
    """
    Extrae imágenes data:image/png;base64,... del HTML,
    las guarda en public/images/{module_id}/solutions/ y devuelve sus rutas locales.
    """
    # Find all inline base64 images in img src attributes
    matches = re.findall(
        r'src=["\']( data:image/([a-z]+);base64,([A-Za-z0-9+/=\s]+))["\']',
        html, re.I
    )
    # Fallback: broader match
    if not matches:
        matches = re.findall(
            r'src="(data:image/([a-z]+);base64,([^"]{100,}))"',
            html, re.I
        )

    if not matches:
        return []

    local_paths = []
    sol_dir = IMAGE_DIR / module_id / "solutions"

    for i, (_, ext, raw_b64) in enumerate(matches, start=1):
        filename = f"q{question_num}_step{i}.{ext}"
        dest = sol_dir / filename
        local_path = f"/images/{module_id}/solutions/{filename}"

        if not dry_run:
            sol_dir.mkdir(parents=True, exist_ok=True)
            if not dest.exists():
                try:
                    img_bytes = b64lib.b64decode(raw_b64.strip())
                    dest.write_bytes(img_bytes)
                except Exception as e:
                    print(f"      ERROR guardando {filename}: {e}")
                    continue

        local_paths.append(local_path)

    return local_paths


# ─── Process module ────────────────────────────────────────────────────────────

def process_module(session: Session, module_id: str, dry_run: bool = False) -> int:
    module_url = MODULES[module_id]
    json_path  = DATA_DIR / f"{module_id}.json"

    if not json_path.exists():
        print(f"  JSON no encontrado: {json_path}")
        return 0

    with open(json_path, encoding='utf-8') as f:
        questions = json.load(f)

    sim_qs = [q for q in questions if q.get('type') == 'B']
    print(f"  {len(sim_qs)} preguntas tipo B")

    updated = 0
    for q in sim_qs:
        qnum = q.get('questionNum')
        print(f"    Pregunta {qnum}...", end=' ', flush=True)

        html = fetch_chivato(session, module_url, qnum)
        if html is None:
            print("❌ sin acceso (sesión expirada o error)")
            time.sleep(0.3)
            continue

        paths = extract_inline_images(html, module_id, qnum, dry_run)

        if paths:
            q['solutionImages'] = paths
            updated += 1
            tag = '(dry-run) ' if dry_run else ''
            print(f"✅ {tag}{len(paths)} imagen(es)")
        else:
            print("— sin imágenes inline")

        time.sleep(0.4)  # sé amable con el servidor

    if not dry_run and updated > 0:
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(questions, f, ensure_ascii=False, indent=2)
        print(f"\n  💾 JSON guardado: {updated} preguntas actualizadas")
    elif dry_run and updated > 0:
        print(f"\n  (dry-run) Se actualizarían {updated} preguntas")

    return updated


# ─── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description='Scraper de soluciones — sosit-txartela.net',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument('--session',  default='', help='Valor de PHPSESSID (recomendado)')
    parser.add_argument('--user',     default='', help='Usuario del foro (alternativa)')
    parser.add_argument('--password', default='', help='Contraseña (alternativa)')
    parser.add_argument('--module',   default=None, help='Módulo concreto (opcional)')
    parser.add_argument('--dry-run',  action='store_true', help='No guardar cambios')
    args = parser.parse_args()

    if not args.session and not (args.user and args.password):
        parser.error("Necesitas --session PHPSESSID  o  --user USER --password PASS")

    if not HAS_REQUESTS:
        print("ℹ️  Instala requests para mejores resultados: pip3 install requests")

    session = Session(phpsessid=args.session)

    if args.session:
        if not verify_session(session):
            print("\nLa sesión no es válida. Obtén un PHPSESSID fresco del navegador.")
            sys.exit(1)
    else:
        if not login(session, args.user, args.password):
            sys.exit(1)

    modules_to_process = [args.module] if args.module else list(MODULES.keys())
    total = 0

    for mod_id in modules_to_process:
        if mod_id not in MODULES:
            print(f"Módulo desconocido: {mod_id}")
            continue
        print(f"\n📦 {mod_id}")
        total += process_module(session, mod_id, dry_run=args.dry_run)

    print(f"\n{'='*50}")
    print(f"Total preguntas con solución: {total}")
    if total > 0 and not args.dry_run:
        print("\nPróximo paso:")
        print("  git add public/data/*.json public/images/")
        print('  git commit -m "feat: solution images for all modules"')
        print("  git push")


if __name__ == '__main__':
    main()
