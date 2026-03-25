const qs = {"access-basico": [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 14, 15, 16, 18, 19, 21, 22, 23, 24, 25, 27, 28, 29, 32, 34, 37, 38, 39, 40, 43, 44, 46, 47, 48, 49, 52, 55, 57, 58, 60, 63, 65, 67, 69, 71, 72, 74, 77, 81, 84, 88, 90, 91, 93, 95, 97, 98, 100, 102, 103, 109, 114, 115, 116, 117, 119, 121, 122, 123, 124, 125, 127, 131, 132, 133, 134, 137], "excel-avanzado": [47, 48, 49, 50, 51, 52, 53, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 128], "powerpoint": [1, 2, 3, 4, 5, 6, 8, 9, 12, 13, 14, 16, 17, 18, 19, 20, 22, 24, 25, 26, 27, 28, 32, 33, 34, 35, 38, 39, 40, 41, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 65, 69, 73, 77, 80, 83, 152, 153, 154, 155, 158, 159, 163, 164, 165, 166, 167, 171, 174, 175, 176, 177, 178, 179, 180, 181, 184, 185, 186, 187, 188, 189, 195, 197, 199, 200, 234, 235, 236, 239, 243, 244, 247, 255, 262, 263, 270, 272, 274, 281, 286, 296], "word-avanzado": [1, 2, 3, 7, 14, 22, 37, 43, 49, 52, 61, 62, 68, 72, 91, 108, 118, 121, 140, 161, 167, 169, 173, 181, 182, 183, 184]};

const MODULE_URLS = {
  "access-basico": "https://sosit-txartela.net/demonline/access2000basico/",
  "excel-avanzado": "https://sosit-txartela.net/demonline/excel2010avanzado/",
  "powerpoint": "https://sosit-txartela.net/demonline/powerxp/",
  "word-avanzado": "https://sosit-txartela.net/demonline/word2010avanzado/"
};

async function logMsg(msg) {
  console.log(msg);
  try {
    await fetch('http://127.0.0.1:31337', { method: 'POST', body: JSON.stringify({type:'log', msg}) });
  } catch(e) {}
}

async function scrapeAll() {
  await logMsg("Starting scrape loop...");
  for (const mod in qs) {
    const questions = qs[mod];
    const baseUrl = MODULE_URLS[mod];
    
    for (const qnum of questions) {
      try {
        const encoded = btoa(qnum.toString()).replace(/=+$/, '');
        const url = `${baseUrl}chivato.php?pregunta=${encoded}`;
        
        const resp = await fetch(url);
        const html = await resp.text();
        
        if (html.includes('action=login') || html.includes('Iniciar sesión')) {
            await logMsg("Session expired on " + url);
            continue;
        }
        
        const doc = new DOMParser().parseFromString(html, "text/html");
        const imgs = Array.from(doc.querySelectorAll('img'))
            .map(img => img.src)
            .filter(src => src.startsWith('data:image'));
            
        if (imgs.length === 0) {
            await logMsg(`Q${qnum}: No inline images`);
            continue;
        }
        
        let paths = [];
        let step = 1;
        for (const src of imgs) {
            const match = src.match(/data:image\/(.*?);base64,(.*)/);
            if (!match) continue;
            let ext = match[1];
            if (ext === 'jpeg') ext = 'jpg';
            const b64data = match[2];
            
            await fetch('http://127.0.0.1:31337', {
                method: 'POST',
                body: JSON.stringify({
                    type: 'save_image',
                    module: mod,
                    qnum: qnum,
                    step: step,
                    ext: ext,
                    data: b64data
                })
            }).catch(e=>{});
            paths.push(`/images/${mod}/solutions/q${qnum}_step${step}.${ext}`);
            step++;
        }
        
        await fetch('http://127.0.0.1:31337', {
            method: 'POST',
            body: JSON.stringify({
                type: 'update_json',
                module: mod,
                qnum: qnum,
                paths: paths
            })
        }).catch(e=>{});
        
        await logMsg(`Q${qnum}: Scraped ${paths.length} steps`);
      } catch (e) {
        await logMsg(`Error on Q${qnum}: ` + e.message);
      }
    }
  }
  try {
    await fetch('http://127.0.0.1:31337', { method: 'POST', body: JSON.stringify({type:'done'}) });
  } catch(e) {}
  await logMsg("All done!");
}

scrapeAll();
