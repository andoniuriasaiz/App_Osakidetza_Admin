"""
dashboard_builder.py — Generador del dashboard HTML de análisis
===============================================================
Genera un archivo HTML autocontenido (sin servidor) que muestra:
  - Resumen global del consenso
  - Detalle por categoría (PERFECT / RED_FLAG / TRIPLE_DISPUTE / INCOMPLETE)
  - Tabla filtrable de todas las discrepancias
  - Indicador de cuántas correcciones están pendientes de aplicar
"""

import json
import sys
from datetime import datetime
from pathlib import Path

_HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(_HERE))
from config import REPORTS_DIR, CATEGORIES


def _status_color(status: str) -> str:
    return {
        "PERFECT":        "#22c55e",
        "RED_FLAG":       "#ef4444",
        "TRIPLE_DISPUTE": "#f97316",
        "INCOMPLETE":     "#94a3b8",
    }.get(status, "#6b7280")


def _status_label(status: str) -> str:
    return {
        "PERFECT":        "✓ Perfecto",
        "RED_FLAG":       "🚩 Red Flag",
        "TRIPLE_DISPUTE": "⚡ Disputa",
        "INCOMPLETE":     "○ Incompleto",
    }.get(status, status)


def build(consensus: dict, out_path: Path | None = None) -> Path:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    if out_path is None:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        out_path = REPORTS_DIR / f"dashboard_{ts}.html"
        # También sobrescribir el archivo "latest"
        latest = REPORTS_DIR / "dashboard_latest.html"
    else:
        latest = None

    gen_ts = datetime.now().strftime("%d/%m/%Y %H:%M")

    # ── Estadísticas globales ─────────────────────────────────────────────────
    global_stats = {"PERFECT": 0, "RED_FLAG": 0, "TRIPLE_DISPUTE": 0, "INCOMPLETE": 0}
    cat_stats    = {}
    all_disputes: list[dict] = []  # preguntas con status != PERFECT

    for cat_key, questions in consensus.items():
        if not isinstance(questions, list):
            continue
        cs = {"PERFECT": 0, "RED_FLAG": 0, "TRIPLE_DISPUTE": 0, "INCOMPLETE": 0, "total": 0}
        for q in questions:
            s = q.get("status", "INCOMPLETE")
            cs[s] = cs.get(s, 0) + 1
            cs["total"] += 1
            global_stats[s] = global_stats.get(s, 0) + 1
            if s != "PERFECT":
                all_disputes.append({**q, "_cat": cat_key})
        cat_stats[cat_key] = cs

    global_total    = sum(global_stats.values())
    needs_review    = global_stats.get("RED_FLAG", 0) + global_stats.get("TRIPLE_DISPUTE", 0)
    kaixo_fixes     = sum(
        1 for q in all_disputes
        if q.get("app") != q.get("k") and q.get("k") not in ("?", None, "")
    )

    # ── Serializar disputes para JS ───────────────────────────────────────────
    disputes_json = json.dumps(all_disputes, ensure_ascii=False)
    cat_stats_json = json.dumps(cat_stats, ensure_ascii=False)
    categories_meta = {k: v["label"] for k, v in CATEGORIES.items()}

    # Pre-computar bloques complejos para evitar f-strings anidados
    if needs_review == 0:
        alert_html = ""
    else:
        fix_hint = (f"De ellas, <strong>{kaixo_fixes}</strong> se corregiran si ejecutas: "
                    f"<code>python run_pipeline.py --apply</code>") if kaixo_fixes else ""
        alert_html = (
            f'<div class="alert">\n'
            f'  &#9888; Hay <strong>{needs_review}</strong> preguntas con discrepancias\n'
            f'  ({global_stats.get("RED_FLAG",0)} Red Flags + '
            f'{global_stats.get("TRIPLE_DISPUTE",0)} Disputas).\n'
            f'  {fix_hint}\n</div>'
        )

    pct_perfect = f"{global_stats.get('PERFECT',0)/global_total*100:.1f}"
    n_perfect   = global_stats.get('PERFECT', 0)
    n_red       = global_stats.get('RED_FLAG', 0)
    n_dispute   = global_stats.get('TRIPLE_DISPUTE', 0)
    n_inc       = global_stats.get('INCOMPLETE', 0)

    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dashboard Auditoría Osakidetza — {gen_ts}</title>
<style>
  *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
         background: #f1f5f9; color: #1e293b; font-size: 14px; }}
  header {{ background: #282182; color: white; padding: 20px 28px;
            display: flex; justify-content: space-between; align-items: center; }}
  header h1 {{ font-size: 18px; font-weight: 800; }}
  header small {{ opacity: .7; font-size: 11px; }}
  .container {{ max-width: 1200px; margin: 0 auto; padding: 24px 20px; }}
  /* Cards */
  .cards {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; margin-bottom: 28px; }}
  .card {{ background: white; border-radius: 12px; padding: 16px; border-left: 4px solid #e2e8f0;
           box-shadow: 0 1px 3px rgba(0,0,0,.06); }}
  .card .val {{ font-size: 28px; font-weight: 900; line-height: 1; }}
  .card .lbl {{ font-size: 11px; font-weight: 700; text-transform: uppercase;
                letter-spacing: .05em; color: #64748b; margin-top: 4px; }}
  .card .sub {{ font-size: 11px; color: #94a3b8; margin-top: 2px; }}
  /* Sections */
  .section {{ background: white; border-radius: 14px; padding: 20px;
              box-shadow: 0 1px 3px rgba(0,0,0,.06); margin-bottom: 24px; }}
  .section h2 {{ font-size: 13px; font-weight: 800; text-transform: uppercase;
                 letter-spacing: .06em; color: #475569; margin-bottom: 16px;
                 padding-bottom: 8px; border-bottom: 2px solid #f1f5f9; }}
  /* Category bars */
  .cat-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }}
  .cat-block h3 {{ font-size: 12px; font-weight: 700; margin-bottom: 8px; color: #334155; }}
  .bar-row {{ display: flex; align-items: center; gap: 8px; margin-bottom: 5px; font-size: 12px; }}
  .bar-row .label {{ width: 100px; color: #64748b; }}
  .bar-row .bar {{ flex: 1; background: #f1f5f9; border-radius: 4px; height: 8px; overflow: hidden; }}
  .bar-row .fill {{ height: 8px; border-radius: 4px; transition: width .4s; }}
  .bar-row .count {{ width: 36px; text-align: right; font-weight: 700; color: #1e293b; }}
  /* Filters */
  .filters {{ display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; align-items: center; }}
  .filters input {{ flex: 1; min-width: 180px; padding: 8px 12px; border: 1px solid #e2e8f0;
                    border-radius: 8px; font-size: 13px; outline: none; }}
  .filters input:focus {{ border-color: #282182; }}
  .filters select {{ padding: 8px 10px; border: 1px solid #e2e8f0; border-radius: 8px;
                     font-size: 12px; background: white; cursor: pointer; }}
  /* Table */
  .tbl-wrap {{ overflow-x: auto; border-radius: 10px; border: 1px solid #f1f5f9; }}
  table {{ width: 100%; border-collapse: collapse; font-size: 12px; }}
  th {{ background: #f8fafc; padding: 10px 12px; text-align: left;
        font-size: 10px; font-weight: 800; text-transform: uppercase;
        letter-spacing: .07em; color: #64748b; border-bottom: 2px solid #e2e8f0; }}
  td {{ padding: 9px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }}
  tr:last-child td {{ border-bottom: none; }}
  tr:hover td {{ background: #f8fafc; }}
  .badge {{ display: inline-block; padding: 2px 7px; border-radius: 20px; font-size: 10px;
            font-weight: 800; letter-spacing: .03em; color: white; }}
  .ans {{ display: inline-block; width: 22px; height: 22px; border-radius: 50%;
          text-align: center; line-height: 22px; font-weight: 900; font-size: 12px; }}
  .ans-app  {{ background: #e0e7ff; color: #3730a3; }}
  .ans-k    {{ background: #dcfce7; color: #166534; }}
  .ans-o    {{ background: #fff7ed; color: #9a3412; }}
  .ans-diff {{ background: #fee2e2; color: #991b1b; border: 2px solid #f87171; }}
  .txt-trunc {{ max-width: 340px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: help; }}
  .pager {{ display: flex; gap: 6px; align-items: center; justify-content: flex-end;
            margin-top: 12px; font-size: 12px; }}
  .pager button {{ padding: 5px 10px; border: 1px solid #e2e8f0; border-radius: 6px;
                   background: white; cursor: pointer; font-size: 12px; }}
  .pager button:hover {{ background: #f1f5f9; }}
  .pager button.active {{ background: #282182; color: white; border-color: #282182; }}
  .pager .info {{ color: #64748b; }}
  /* Alert banner */
  .alert {{ background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px;
            padding: 12px 16px; margin-bottom: 20px; color: #991b1b;
            font-size: 13px; font-weight: 600; }}
  .alert-ok {{ background: #f0fdf4; border-color: #bbf7d0; color: #166534; }}
  /* Nota */
  .nota {{ background: #f8fafc; border-radius: 10px; padding: 14px 16px;
           font-size: 12px; color: #64748b; border: 1px solid #e2e8f0; }}
  .nota code {{ background: #e2e8f0; padding: 2px 5px; border-radius: 4px;
                font-family: monospace; font-size: 11px; }}
</style>
</head>
<body>

<header>
  <div>
    <h1>🔍 Dashboard Auditoría Osakidetza OPE 2026</h1>
    <small>Generado: {gen_ts} · Solo lectura — ningún archivo ha sido modificado</small>
  </div>
  <div style="text-align:right">
    <div style="font-size:22px;font-weight:900">{needs_review}</div>
    <small>preguntas a revisar</small>
  </div>
</header>

<div class="container">

<!-- Alerta -->
{alert_html}

<!-- Tarjetas globales -->
<div class="cards">
  <div class="card" style="border-color:#22c55e">
    <div class="val" style="color:#22c55e">{n_perfect}</div>
    <div class="lbl">Perfectas</div>
    <div class="sub">{pct_perfect}% del total</div>
  </div>
  <div class="card" style="border-color:#ef4444">
    <div class="val" style="color:#ef4444">{n_red}</div>
    <div class="lbl">Red Flags</div>
    <div class="sub">K&amp;O coinciden vs App</div>
  </div>
  <div class="card" style="border-color:#f97316">
    <div class="val" style="color:#f97316">{n_dispute}</div>
    <div class="lbl">Disputas</div>
    <div class="sub">Los 3 difieren</div>
  </div>
  <div class="card" style="border-color:#94a3b8">
    <div class="val" style="color:#94a3b8">{n_inc}</div>
    <div class="lbl">Sin datos</div>
    <div class="sub">K o O no disponibles</div>
  </div>
  <div class="card" style="border-color:#282182">
    <div class="val" style="color:#282182">{global_total}</div>
    <div class="lbl">Total analizado</div>
    <div class="sub">4 categorías</div>
  </div>
</div>

<!-- Por categoría -->
<div class="section">
  <h2>Desglose por categoría</h2>
  <div class="cat-grid" id="cat-grid"></div>
</div>

<!-- Tabla de discrepancias -->
<div class="section">
  <h2>Preguntas con discrepancia <span id="dispute-count" style="color:#94a3b8;font-weight:400"></span></h2>

  <div class="filters">
    <input type="text" id="search" placeholder="🔍 Buscar por texto o ID…">
    <select id="filter-cat">
      <option value="">Todas las categorías</option>
    </select>
    <select id="filter-status">
      <option value="">Todos los estados</option>
      <option value="RED_FLAG">🚩 Red Flag</option>
      <option value="TRIPLE_DISPUTE">⚡ Disputa</option>
      <option value="INCOMPLETE">○ Incompleto</option>
    </select>
    <select id="filter-diff">
      <option value="">App vs Kaixo: todos</option>
      <option value="diff">Solo diferentes (app≠K)</option>
      <option value="same">App = Kaixo</option>
    </select>
  </div>

  <div class="tbl-wrap">
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Cat</th>
          <th>Pregunta</th>
          <th>App</th>
          <th>Kaixo</th>
          <th>Osasun</th>
          <th>Estado</th>
        </tr>
      </thead>
      <tbody id="tbl-body"></tbody>
    </table>
  </div>
  <div class="pager" id="pager"></div>
</div>

<!-- Nota de uso -->
<div class="nota">
  <strong>Cómo usar este análisis:</strong><br>
  Este dashboard es <em>solo lectura</em>. Para aplicar las correcciones de Kaixo a la app, ejecuta:<br>
  <code>python run_pipeline.py --apply</code> (añade <code>--dry-run</code> para previsualizar sin cambiar nada).<br><br>
  Para actualizar los datos scrapeados: <code>python run_pipeline.py --scrape</code>
</div>

</div><!-- /container -->

<script>
const STATUS_COLORS = {{"PERFECT":"#22c55e","RED_FLAG":"#ef4444","TRIPLE_DISPUTE":"#f97316","INCOMPLETE":"#94a3b8"}};
const DISPUTES  = {disputes_json};
const CAT_STATS = {cat_stats_json};
const CAT_META  = {json.dumps(categories_meta, ensure_ascii=False)};

// ── Barras por categoría ─────────────────────────────────────────────────────
const grid = document.getElementById('cat-grid');
for (const [cat, cs] of Object.entries(CAT_STATS)) {{
  const total = cs.total || 1;
  const rows = [
    ['Perfecto',  cs.PERFECT        || 0, '#22c55e'],
    ['Red Flag',  cs.RED_FLAG       || 0, '#ef4444'],
    ['Disputa',   cs.TRIPLE_DISPUTE || 0, '#f97316'],
    ['Sin datos', cs.INCOMPLETE     || 0, '#94a3b8'],
  ];
  const blocHtml = rows.map(([lbl, n, col]) => `
    <div class="bar-row">
      <span class="label">${{lbl}}</span>
      <div class="bar"><div class="fill" style="width:${{(n/total*100).toFixed(1)}}%;background:${{col}}"></div></div>
      <span class="count">${{n}}</span>
    </div>`).join('');
  grid.innerHTML += `
    <div class="cat-block">
      <h3>${{CAT_META[cat] || cat}} <small style="color:#94a3b8;font-weight:400">(${{total}})</small></h3>
      ${{blocHtml}}
    </div>`;
}}

// ── Tabla ────────────────────────────────────────────────────────────────────
const PAGE_SIZE = 50;
let page = 1;
let filtered = [];

const tbody  = document.getElementById('tbl-body');
const pager  = document.getElementById('pager');
const dispEl = document.getElementById('dispute-count');

// Poblar select de categorías
const catSel = document.getElementById('filter-cat');
Object.keys(CAT_STATS).forEach(cat => {{
  catSel.innerHTML += `<option value="${{cat}}">${{CAT_META[cat] || cat}}</option>`;
}});

function ansClass(ans, ref) {{
  if (!ans || ans === '?') return 'ans';
  return ans !== ref ? 'ans ans-diff' : `ans ans-${{ref === DISPUTES[0]?.app ? 'app' : 'k'}}`;
}}

function renderTable() {{
  const search = document.getElementById('search').value.toLowerCase();
  const catF   = catSel.value;
  const statF  = document.getElementById('filter-status').value;
  const diffF  = document.getElementById('filter-diff').value;

  filtered = DISPUTES.filter(q => {{
    if (catF  && q._cat !== catF)    return false;
    if (statF && q.status !== statF) return false;
    if (diffF === 'diff' && q.app === q.k) return false;
    if (diffF === 'same' && q.app !== q.k) return false;
    if (search) {{
      const hay = (q.text + q.id).toLowerCase();
      if (!hay.includes(search)) return false;
    }}
    return true;
  }});

  dispEl.textContent = `(${{filtered.length}} de ${{DISPUTES.length}})`;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (page > totalPages) page = 1;
  const slice = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  tbody.innerHTML = slice.map(q => {{
    const appDiff = q.app !== q.k && q.k !== '?';
    return `<tr>
      <td style="font-family:monospace;font-size:11px;white-space:nowrap">${{q.id}}</td>
      <td><span class="badge" style="background:#282182">${{q._cat}}</span></td>
      <td><div class="txt-trunc" title="${{(q.text||'').replace(/"/g,'&quot;')}}">${{(q.text||'—').substring(0,80)}}…</div></td>
      <td><span class="ans ans-app ${{appDiff ? 'ans-diff' : ''}}">${{q.app||'?'}}</span></td>
      <td><span class="ans ans-k">${{q.k||'?'}}</span></td>
      <td><span class="ans ans-o">${{q.o||'?'}}</span></td>
      <td><span class="badge" style="background:${{STATUS_COLORS[q.status]||'#6b7280'}}">${{q.status}}</span></td>
    </tr>`;
  }}).join('');

  // Pager
  pager.innerHTML = `<span class="info">Pág ${{page}}/${{totalPages}} · ${{filtered.length}} resultados</span>`;
  for (let p = Math.max(1, page-2); p <= Math.min(totalPages, page+2); p++) {{
    pager.innerHTML += `<button class="${{p===page?'active':''}}" onclick="goPage(${{p}})">${{p}}</button>`;
  }}
  if (page < totalPages) pager.innerHTML += `<button onclick="goPage(${{page+1}})">›</button>`;
}}

function goPage(p) {{ page = p; renderTable(); window.scrollTo(0,400); }}

['search','filter-cat','filter-status','filter-diff'].forEach(id => {{
  document.getElementById(id).addEventListener('input', () => {{ page=1; renderTable(); }});
}});

renderTable();
</script>
</body>
</html>
"""

    with open(out_path, "w", encoding="utf-8") as fh:
        fh.write(html)
    if latest:
        with open(latest, "w", encoding="utf-8") as fh:
            fh.write(html)
        print(f"  ✓ Dashboard → {out_path.name}")
        print(f"  ✓ Dashboard (latest) → {latest.name}")
    return out_path


def run(consensus: dict) -> Path:
    print("\n" + "=" * 60)
    print("  PASO 4 — Generando dashboard HTML")
    print("=" * 60)
    path = build(consensus)
    print()
    return path


if __name__ == "__main__":
    # Ejecutar standalone: carga el consenso existente
    consensus_path = REPORTS_DIR / "CLEAN_CONSENSUS.json"
    if not consensus_path.exists():
        print(f"ERROR: No existe {consensus_path}. Ejecuta primero el pipeline completo.")
        sys.exit(1)
    with open(consensus_path, encoding="utf-8") as fh:
        data = json.load(fh)
    run({k: v for k, v in data.items() if not k.startswith("_")})
