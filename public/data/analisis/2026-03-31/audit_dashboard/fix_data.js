const fs = require('fs');
const jsonPath = '/Users/andoniuria/Library/CloudStorage/GoogleDrive-uriasaiz@gmail.com/Mi unidad/40-49_Trabajo/44_Oposiciones/04_OSAKIDETZA/60_HERRAMIENTAS/App_Osakidetza_Admin/public/data/analisis/2026-03-31/CLEAN_CONSENSUS.json';
const outputPath = '/Users/andoniuria/Library/CloudStorage/GoogleDrive-uriasaiz@gmail.com/Mi unidad/40-49_Trabajo/44_Oposiciones/04_OSAKIDETZA/60_HERRAMIENTAS/App_Osakidetza_Admin/public/data/analisis/2026-03-31/audit_dashboard/data.js';

const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const summary = { 
    total: 0, PERFECT: 0, MATCH_KAIXO: 0, MATCH_OSA: 0, MATCH: 0, RED_FLAG: 0, FAIL_APP: 0, 
    TRIPLE_DISPUTE: 0, INCOMPLETE: 0,
    soloStats: { app: 0, kaixo: 0, osasuntest: 0 },
    veracityStats: { extrema: 0, alta: 0, media: 0, baja: 0, critica: 0 },
    categories: {},
    sourceAccuracy: { app: 0, kaixo: 0, osasuntest: 0 }
};
const questions = [];

for (const cat in data) {
    summary.categories[cat] = { total: 0, PERFECT: 0, MATCH_KAIXO: 0, MATCH_OSA: 0, MATCH: 0, RED_FLAG: 0, FAIL_APP: 0, TRIPLE_DISPUTE: 0, INCOMPLETE: 0 };
    data[cat].forEach(q => {
        summary.total++;
        summary.categories[cat].total++;
        // Revised Status Determination Logic
        let status = 'MATCH';
        const a = q.app; const k = q.k; const o = q.o;
        const cons = q.consensus;
        
        // Flags
        const isRedFlag = !!(k && o && k !== '?' && o !== '?' && k === o && k !== a);
        const isTripleDispute = !!(a && k && o && a !== '?' && k !== '?' && o !== '?' && a !== k && a !== o && k !== o);

        if (!a || a === '?') {
            status = 'INCOMPLETE';
        } else if (a === k && a === o) {
            status = 'PERFECT';
        } else if (isRedFlag) {
            status = 'RED_FLAG';
        } else if (a === k && k !== '?') {
            status = 'MATCH_KAIXO';
        } else if (a === o && o !== '?') {
            status = 'MATCH_OSA';
        } else if (isTripleDispute) {
            status = 'TRIPLE_DISPUTE';
        } else if (cons && cons !== '?' && cons !== '???' && a !== cons) {
            status = 'FAIL_APP';
        }

        // Veracity Scoring
        let veracityScore = 0;
        let veracityLevel = '';
        
        if (status === 'PERFECT') { veracityScore = 100; veracityLevel = 'extrema'; }
        else if (status === 'MATCH_KAIXO' || status === 'MATCH_OSA') { veracityScore = 75; veracityLevel = 'alta'; }
        else if (status === 'MATCH') { veracityScore = 50; veracityLevel = 'media'; }
        else if (status === 'RED_FLAG' || status === 'TRIPLE_DISPUTE') { veracityScore = 25; veracityLevel = 'baja'; }
        else if (status === 'FAIL_APP') { veracityScore = 0; veracityLevel = 'critica'; }
        else { veracityScore = 10; veracityLevel = 'baja'; }

        summary.veracityStats[veracityLevel]++;

        // Solo Logic for UI
        const isSoloApp = !!(a && a !== '?' && a !== k && a !== o);
        const isSoloKaixo = !!(k && k !== '?' && k !== a && k !== o);
        const isSoloOsa = !!(o && o !== '?' && o !== a && o !== k);
        
        if (isSoloApp) summary.soloStats.app++;
        if (isSoloKaixo) summary.soloStats.kaixo++;
        if (isSoloOsa) summary.soloStats.osasuntest++;

        // Source Accuracy
        if (cons && cons !== '?' && cons !== '???') {
            if (a === cons) summary.sourceAccuracy.app++;
            if (k === cons) summary.sourceAccuracy.kaixo++;
            if (o === cons) summary.sourceAccuracy.osasuntest++;
        }
        
        summary[status]++;
        summary.categories[cat][status]++;
        
        // Review Logic (Priority: Kaixo)
        const isReview = !!(a && k && a !== '?' && k !== '?' && a !== k);
        if (isReview) {
            summary.REVISAR = (summary.REVISAR || 0) + 1;
            summary.categories[cat].REVISAR = (summary.categories[cat].REVISAR || 0) + 1;
        }

        questions.push({ ...q, category: cat, status, isRedFlag, isSoloApp, isSoloKaixo, isSoloOsa, isTripleDispute, isReview, veracityScore, veracityLevel });
    });
}
summary.sourceAccuracy.app = Math.round((summary.sourceAccuracy.app / summary.total) * 100);
summary.sourceAccuracy.kaixo = Math.round((summary.sourceAccuracy.kaixo / summary.total) * 100);
summary.sourceAccuracy.osasuntest = Math.round((summary.sourceAccuracy.osasuntest / summary.total) * 100);

// Export Data.js
fs.writeFileSync(outputPath, 'const CONSENSUS_DATA = ' + JSON.stringify({ summary, questions }) + ';');

// Export Review stand-alone
const reviewData = questions.filter(q => q.isReview || q.isTripleDispute);
fs.writeFileSync('/Users/andoniuria/Library/CloudStorage/GoogleDrive-uriasaiz@gmail.com/Mi unidad/40-49_Trabajo/44_Oposiciones/04_OSAKIDETZA/60_HERRAMIENTAS/App_Osakidetza_Admin/public/data/analisis/2026-03-31/review_audit.json', JSON.stringify(reviewData, null, 2));

console.log('Generated data.js and review_audit.json with Kaixo-Centric Review Logic');
