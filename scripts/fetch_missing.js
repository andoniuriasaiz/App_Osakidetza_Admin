const qs_missing = {"access-basico": [12, 17, 20, 30, 35, 42, 50, 53, 54, 56, 59, 61, 62, 64, 66, 68, 70, 73, 75, 79, 80, 82, 83, 85, 87, 89, 92, 94, 96, 99, 101, 104, 105, 106, 107, 108, 110, 111, 112, 113, 118, 120, 126, 128, 129, 130, 135, 136, 3, 13, 26, 31, 33, 36, 41, 45, 51, 76, 78, 86], "word-avanzado": [4, 5, 6, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18, 19, 20, 21, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 38, 39, 40, 42, 44, 45, 46, 47, 48, 50, 54, 55, 56, 57, 58, 59, 60, 63, 64, 65, 66, 67, 69, 70, 71, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 88, 90, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 109, 110, 111, 112, 114, 115, 116, 117, 119, 120, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 162, 163, 164, 165, 166, 168, 170, 171, 172, 177, 178, 179, 185, 186, 187, 188, 189, 190, 191, 192, 193, 41, 51, 53, 87, 89, 92, 113, 174, 175, 176, 180], "excel-avanzado": [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 1, 28, 29, 30, 31, 32, 33, 34, 35, 36, 125, 126, 127, 47, 48, 49, 50, 51, 52, 53, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 128], "powerpoint": [7, 10, 11, 15, 21, 29, 30, 31, 36, 37, 42, 64, 66, 67, 70, 71, 72, 74, 75, 79, 81, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 156, 157, 161, 162, 168, 183, 190, 191, 192, 193, 194, 198, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231, 232, 233, 240, 242, 248, 249, 250, 251, 252, 253, 254, 256, 264, 265, 266, 275, 276, 277, 278, 279, 280, 282, 283, 284, 285, 288, 289, 290, 291, 292, 294, 295, 300, 23, 68, 76, 78, 82, 90, 104, 105, 160, 169, 170, 172, 173, 182, 196, 237, 238, 241, 245, 246, 257, 258, 259, 260, 261, 267, 268, 269, 271, 273, 287, 293, 297, 298, 299]};

const MODULE_URLS = {
  "access-basico": "https://sosit-txartela.net/demonline/access2000basico/",
  "excel-avanzado": "https://sosit-txartela.net/demonline/excel2010avanzado/",
  "powerpoint": "https://sosit-txartela.net/demonline/powerxp/",
  "word-avanzado": "https://sosit-txartela.net/demonline/word2010avanzado/"
};

async function getBase64FromUrl(url) {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
             resolve(reader.result);
        };
        reader.readAsDataURL(blob);
    });
}

async function scrapeMissing() {
  console.log("Iniciando la descarga de imágenes FALTANTES (simulación)...");
  let allData = {};
  
  for (const mod in qs_missing) {
    const questions = qs_missing[mod];
    const baseUrl = MODULE_URLS[mod];
    console.log(`Procesando módulo: ${mod} (${questions.length} preguntas)`);
    
    for (const qnum of questions) {
      try {
        const encoded = btoa(qnum.toString()).replace(/=+$/, '');
        let url = `${baseUrl}chivato.php?pregunta=${encoded}`;
        
        let resp = await fetch(url);
        let html = await resp.text();
        
        if (resp.status === 404 || html.includes('action=login') || html.includes('Iniciar sesión')) {
            url = `${baseUrl}solution.php?pregunta=${encoded}`;
            resp = await fetch(url);
            if (resp.ok) {
                html = await resp.text();
            }
        }
        
        if (html.includes('action=login') || html.includes('Iniciar sesión')) {
            console.log("Sesión expirada en " + url);
            continue;
        }
        
        const doc = new DOMParser().parseFromString(html, "text/html");
        // En simulación, las imágenes suelen ser PNGs normales, no data:image (ej: Imagenes/0tema1/cap_xyz.png)
        // Excluimos logos e iconos de la UI
        const imgs = Array.from(doc.querySelectorAll('img'))
            .map(img => img.src)
            .filter(src => {
                if (src.startsWith('data:image')) return true;
                if (src.includes('Imagenes/') && 
                    !src.includes('logo') && 
                    !src.includes('up.gif') && 
                    !src.includes('stats.gif') && 
                    !src.includes('pie-li.gif')) {
                    return true;
                }
                return false;
            });
            
        if (imgs.length === 0) {
            continue;
        }
        
        let paths = [];
        let step = 1;
        for (const src of imgs) {
            let b64data = "";
            let ext = "png";
            
            if (src.startsWith('data:image')) {
                const match = src.match(/data:image\/(.*?);base64,(.*)/);
                if (match) {
                    ext = match[1];
                    b64data = match[2];
                }
            } else {
                try {
                    const dataUrl = await getBase64FromUrl(src);
                    const match = dataUrl.match(/data:image\/(.*?);base64,(.*)/);
                    if (match) {
                        ext = match[1];
                        b64data = match[2];
                    }
                } catch(e) {
                    console.error("No se pudo descargar imagen normal:", src);
                }
            }
            
            if (!b64data) continue;
            if (ext === 'jpeg') ext = 'jpg';
            
            const filename = `q${qnum}_step${step}.${ext}`;
            const fullPath = `/images/${mod}/solutions/${filename}`;
            
            allData[fullPath] = {
                module: mod,
                qnum: qnum,
                step: step,
                ext: ext,
                b64: b64data
            };
            
            paths.push(fullPath);
            step++;
        }
        
        if (paths.length > 0) {
            allData[`__json__${mod}_${qnum}`] = paths;
            console.log(`Q${qnum}: ¡Extraídas ${paths.length} imágenes!`);
        }
      } catch (e) {
        console.log(`Error en Q${qnum}: ` + e.message);
      }
    }
  }
  
  if (Object.keys(allData).length === 0) {
      console.log("No se encontraron nuevas imágenes.");
      return;
  }
  
  console.log("¡Todo procesado! Empaquetando en un único archivo de descarga...");
  
  const jsonStr = JSON.stringify(allData);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const downloadUrl = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = 'soluciones_chatelac_faltantes.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  console.log("¡Descarga completada! (soluciones_chatelac_faltantes.json)");
}

scrapeMissing();
