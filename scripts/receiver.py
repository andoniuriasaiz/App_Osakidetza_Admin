import json
import base64
from pathlib import Path
from http.server import BaseHTTPRequestHandler, HTTPServer
import sys

ROOT = Path(__file__).parent.parent
DATA_DIR = ROOT / 'public' / 'data'
IMAGE_DIR = ROOT / 'public' / 'images'

class ReceiverHandler(BaseHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Access-Control-Request-Private-Network')
        self.send_header('Access-Control-Allow-Private-Network', 'true')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        req = json.loads(post_data.decode('utf-8'))
        
        if req.get('type') == 'save_image':
            mod = req['module']
            qnum = req['qnum']
            step = req['step']
            ext = req['ext']
            b64data = req['data']
            
            filename = f"q{qnum}_step{step}.{ext}"
            sol_dir = IMAGE_DIR / mod / "solutions"
            sol_dir.mkdir(parents=True, exist_ok=True)
            
            dest = sol_dir / filename
            dest.write_bytes(base64.b64decode(b64data))
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"status": "ok"}')
            print(f"✅ Saved {mod} - {filename}")
            
        elif req.get('type') == 'update_json':
            mod = req['module']
            qnum = req['qnum']
            paths = req['paths']
            
            json_path = DATA_DIR / f"{mod}.json"
            if json_path.exists():
                with open(json_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                for q in data:
                    if q.get('questionNum') == qnum:
                        q['solutionImages'] = paths
                        break
                        
                with open(json_path, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                    
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"status": "ok"}')
            print(f"💾 Updated JSON for {mod} Q{qnum} with {len(paths)} images")
        
        elif req.get('type') == 'log':
            msg = req['msg']
            print(f"🌐 Browser: {msg}")
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"status": "ok"}')
            
        elif req.get('type') == 'done':
            print("🎉 Done scraping all modules!")
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"status": "ok"}')
            
print("Started receiver on 127.0.0.1:31337...")
server = HTTPServer(('127.0.0.1', 31337), ReceiverHandler)
server.serve_forever()
