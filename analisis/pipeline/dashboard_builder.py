"""
dashboard_builder.py — Generador del dashboard HTML de análisis
===============================================================
Genera un archivo HTML autocontenido (sin servidor) que muestra:
  - Resumen global del consenso con KPIs y matriz de acuerdo
  - Desglose por categoría con barras apiladas
  - Tabla filtrable con filas expandibles, export CSV, paginación y orden
  - Indicador de correcciones pendientes

NOTA: El JSON embebido se sanitiza con replace("</", "<\\/") para evitar
que textos con "</script>" cierren el tag de script prematuramente.
"""

import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional, Union

_HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(_HERE))
from config import REPORTS_DIR, CATEGORIES


def _safe_json(obj) -> str:
    """JSON serializado con </script> escapado para embed seguro en HTML."""
    return json.dumps(obj, ensure_ascii=False).replace("</", "<\\/")


def build(consensus: dict, out_path: Optional[Path] = None) -> Path:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    if out_path is None:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        out_path = REPORTS_DIR / f"dashboard_{ts}.html"
        latest = REPORTS_DIR / "dashboard_latest.html"
    else:
        latest = None

    gen_ts = datetime.now().strftime("%d/%m/%Y %H:%M")

    # ── Estadísticas globales ─────────────────────────────────────────────────
    global_stats = {"PERFECT": 0, "RED_FLAG": 0, "TRIPLE_DISPUTE": 0, "INCOMPLETE": 0}
    cat_stats    = {}
    all_disputes: list[dict] = []
    agree_au = agree_ak = agree_ao = agree_ko = 0
    total_u = total_k = total_o = total_ko = 0

    for cat_key, questions in consensus.items():
        if not isinstance(questions, list):
            continue
        cs = {"PERFECT": 0, "RED_FLAG": 0, "TRIPLE_DISPUTE": 0, "INCOMPLETE": 0, "total": 0}
        for q in questions:
            s = q.get("status", "INCOMPLETE")
            cs[s] = cs.get(s, 0) + 1
            cs["total"] += 1
            global_stats[s] = global_stats.get(s, 0) + 1

            app, k, o, u = q.get("app", "?"), q.get("k", "?"), q.get("o", "?"), q.get("u", "?")
            if u not in ("?", ""):
                total_u += 1
                if app == u: agree_au += 1
            if k not in ("?", ""):
                total_k += 1
                if app == k: agree_ak += 1
            if o not in ("?", ""):
                total_o += 1
                if app == o: agree_ao += 1
            if k not in ("?", "") and o not in ("?", ""):
                total_ko += 1
                if k == o: agree_ko += 1

            has_any_diff = (
                (u not in ("?", "") and app != u) or
                (k not in ("?", "") and app != k) or
                (o not in ("?", "") and app != o) or
                (k not in ("?", "") and o not in ("?", "") and k != o)
            )
            if s != "PERFECT" or has_any_diff:
                all_disputes.append({**q, "_cat": cat_key})
        cat_stats[cat_key] = cs

    global_total = sum(global_stats.values())
    needs_review = global_stats.get("RED_FLAG", 0) + global_stats.get("TRIPLE_DISPUTE", 0)
    correctable  = sum(
        1 for q in all_disputes
        if (q.get("u") not in ("?", None, "") and q.get("app") != q.get("u")) or 
           (q.get("u") in ("?", None, "") and q.get("app") != q.get("k") and q.get("k") not in ("?", None, ""))
    )

    pct_perfect = f"{global_stats.get('PERFECT', 0) / global_total * 100:.1f}" if global_total else "0"
    n_perfect   = global_stats.get("PERFECT", 0)
    n_red       = global_stats.get("RED_FLAG", 0)
    n_dispute   = global_stats.get("TRIPLE_DISPUTE", 0)
    n_inc       = global_stats.get("INCOMPLETE", 0)

    pct_au = f"{agree_au / total_u * 100:.0f}" if total_u else "—"
    pct_ak = f"{agree_ak / total_k * 100:.0f}" if total_k else "—"
    pct_ao = f"{agree_ao / total_o * 100:.0f}" if total_o else "—"
    pct_ko = f"{agree_ko / total_ko * 100:.0f}" if total_ko else "—"

    # ── Datos embebidos de forma segura ───────────────────────────────────────
    disputes_json  = _safe_json(all_disputes)
    cat_stats_json = _safe_json(cat_stats)
    cat_meta_json  = _safe_json({k: v["label"] for k, v in CATEGORIES.items()})

    if needs_review == 0:
        alert_html = '<div class="alert alert-ok"><span class="alert-icon">✓</span> Sin discrepancias críticas — todos los bloques están en consenso.</div>'
    else:
        fix_hint = ""
        if correctable:
            fix_hint = (f' De ellas, <strong>{correctable}</strong> son corregibles automáticamente '
                        f'con <code>python run_pipeline.py --apply --confirm</code>.')
        alert_html = (
            f'<div class="alert">'
            f'<span class="alert-icon">⚠</span> '
            f'<strong>{needs_review}</strong> preguntas con discrepancias '
            f'<span class="alert-breakdown">({n_red} Red Flags · {n_dispute} Disputas)</span>.'
            f'{fix_hint}'
            f'</div>'
        )

    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dashboard Auditoría Osakidetza — {gen_ts}</title>
<style>
*, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
:root {{
  --blue:   #1d4ed8;
  --blue-d: #1e3a8a;
  --blue-l: #eff6ff;
  --green:  #16a34a;
  --red:    #dc2626;
  --orange: #ea580c;
  --slate:  #475569;
  --muted:  #94a3b8;
  --border: #e2e8f0;
  --bg:     #f8fafc;
  --card:   #ffffff;
  --text:   #0f172a;
  --radius: 10px;
}}
body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
       background: var(--bg); color: var(--text); font-size: 14px; line-height: 1.5; }}

/* ── Header ── */
.header {{
  background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #1d4ed8 100%);
  color: #fff; padding: 20px 32px;
  display: flex; justify-content: space-between; align-items: center;
  box-shadow: 0 2px 12px rgba(0,0,0,.25);
}}
.header-title {{ display: flex; align-items: center; gap: 12px; }}
.header-title h1 {{ font-size: 18px; font-weight: 800; letter-spacing: -.02em; }}
.header-title p  {{ font-size: 11px; opacity: .6; margin-top: 2px; }}
.header-score {{ text-align: right; }}
.header-score .score-val {{ font-size: 36px; font-weight: 900; line-height: 1; }}
.header-score .score-lbl {{ font-size: 11px; opacity: .65; margin-top: 2px; }}

/* ── Layout ── */
.container {{ max-width: 1300px; margin: 0 auto; padding: 24px 20px 48px; }}
.section {{ background: var(--card); border-radius: 14px; padding: 20px 22px;
            box-shadow: 0 1px 4px rgba(0,0,0,.06); margin-bottom: 20px;
            border: 1px solid var(--border); }}
.section-title {{
  font-size: 11px; font-weight: 800; text-transform: uppercase;
  letter-spacing: .08em; color: var(--slate); margin-bottom: 18px;
  padding-bottom: 10px; border-bottom: 1px solid var(--border);
  display: flex; align-items: center; gap: 8px;
}}
.section-title .cnt {{
  background: var(--bg); color: var(--muted); padding: 2px 9px;
  border-radius: 20px; font-size: 10px; font-weight: 700; letter-spacing: 0;
}}

/* ── Alertas ── */
.alert {{
  background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px;
  padding: 12px 18px; margin-bottom: 20px; color: #991b1b;
  font-size: 13px; display: flex; align-items: flex-start; gap: 10px;
}}
.alert-ok {{ background: #f0fdf4; border-color: #bbf7d0; color: #166534; }}
.alert-icon {{ font-size: 16px; flex-shrink: 0; }}
.alert-breakdown {{ opacity: .75; }}
.alert code {{ background: rgba(0,0,0,.08); padding: 2px 5px; border-radius: 4px;
               font-size: 11px; font-family: monospace; }}

/* ── KPI grid ── */
.kpi-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; margin-bottom: 20px; }}
.kpi {{
  background: var(--card); border-radius: 12px; padding: 16px;
  border: 1px solid var(--border); border-top: 3px solid var(--border);
  transition: transform .15s, box-shadow .15s;
}}
.kpi:hover {{ transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,.08); }}
.kpi-val {{ font-size: 32px; font-weight: 900; line-height: 1.1; }}
.kpi-lbl {{ font-size: 10px; font-weight: 700; text-transform: uppercase;
            letter-spacing: .07em; color: var(--slate); margin-top: 5px; }}
.kpi-sub {{ font-size: 10px; color: var(--muted); margin-top: 2px; }}

/* ── Agree cards ── */
.agree-grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }}
.agree-card {{
  background: var(--card); border: 1px solid var(--border); border-radius: 12px;
  padding: 16px; text-align: center;
}}
.agree-pct {{ font-size: 28px; font-weight: 900; }}
.agree-lbl {{ font-size: 11px; color: var(--slate); margin-top: 4px; }}
.agree-bar {{ height: 5px; background: var(--border); border-radius: 3px; margin-top: 10px; overflow: hidden; }}
.agree-fill {{ height: 100%; border-radius: 3px; transition: width .6s ease; }}

/* ── Cat grid ── */
.cat-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }}
.cat-card {{
  background: var(--bg); border: 1px solid var(--border); border-radius: 10px;
  padding: 14px 16px;
}}
.cat-card-header {{ display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; }}
.cat-name {{ font-size: 13px; font-weight: 700; color: var(--text); }}
.cat-meta {{ font-size: 11px; color: var(--muted); }}
.stacked-bar {{ height: 8px; border-radius: 4px; overflow: hidden; display: flex; gap: 1px; margin-bottom: 9px; }}
.stacked-seg {{ height: 100%; }}
.bar-legend {{ display: flex; flex-wrap: wrap; gap: 4px 12px; }}
.legend-item {{ display: flex; align-items: center; gap: 4px; font-size: 10px; color: var(--slate); }}
.legend-dot {{ width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }}

/* ── Filters ── */
.filter-bar {{ display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 10px; }}
.filter-label {{ font-size: 10px; font-weight: 700; text-transform: uppercase;
                 letter-spacing: .06em; color: var(--muted); white-space: nowrap; }}
.filter-bar input[type=text] {{
  flex: 1; min-width: 220px; padding: 8px 12px;
  border: 1px solid var(--border); border-radius: 8px; font-size: 12px;
  outline: none; background: var(--card); color: var(--text);
}}
.filter-bar input:focus {{ border-color: var(--blue); box-shadow: 0 0 0 3px rgba(29,78,216,.1); }}
.filter-bar select {{
  padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px;
  font-size: 12px; background: var(--card); color: var(--text); outline: none; cursor: pointer;
}}
.filter-bar select:focus {{ border-color: var(--blue); }}
.btn {{
  padding: 8px 14px; border-radius: 8px; border: 1px solid transparent;
  cursor: pointer; font-size: 12px; font-weight: 600; transition: all .15s;
  white-space: nowrap;
}}
.btn-primary {{ background: var(--blue); color: #fff; border-color: var(--blue); }}
.btn-primary:hover {{ background: var(--blue-d); }}
.btn-ghost {{ background: var(--card); color: var(--slate); border-color: var(--border); }}
.btn-ghost:hover {{ background: var(--bg); }}

/* ── Chips ── */
.chip-row {{ display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 12px; }}
.chip {{
  padding: 5px 12px; border-radius: 20px; font-size: 11px; font-weight: 600;
  border: 1.5px solid var(--border); cursor: pointer; background: var(--card);
  color: var(--slate); transition: all .12s;
}}
.chip:hover:not(.active) {{ border-color: var(--blue); color: var(--blue); background: var(--blue-l); }}
.chip.active {{ background: var(--blue); color: #fff; border-color: var(--blue); }}
.chip.chip-red.active    {{ background: #dc2626; border-color: #dc2626; }}
.chip.chip-orange.active {{ background: #ea580c; border-color: #ea580c; }}
.chip.chip-slate.active  {{ background: #64748b; border-color: #64748b; }}
.chip.chip-green.active  {{ background: #16a34a; border-color: #16a34a; }}

/* ── Table ── */
.tbl-info-row {{ display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }}
.tbl-info {{ font-size: 12px; color: var(--muted); }}
.tbl-wrap {{ overflow-x: auto; border: 1px solid var(--border); border-radius: 10px; }}
table {{ width: 100%; border-collapse: collapse; font-size: 12px; }}
thead th {{
  background: var(--bg); padding: 10px 12px;
  font-size: 10px; font-weight: 800; text-transform: uppercase;
  letter-spacing: .07em; color: var(--slate); border-bottom: 2px solid var(--border);
  white-space: nowrap; cursor: pointer; user-select: none; text-align: left;
}}
thead th:hover {{ background: var(--border); color: var(--text); }}
thead th.sorted {{ color: var(--blue); }}
thead th .si {{ margin-left: 3px; opacity: .4; font-size: 9px; }}
thead th.sorted .si {{ opacity: 1; }}
tbody td {{ padding: 9px 12px; border-bottom: 1px solid var(--bg); vertical-align: middle; }}
tbody tr:last-child td {{ border-bottom: none; }}
tbody tr.data-row:hover > td {{ background: var(--bg); cursor: pointer; }}
tbody tr.expand-row td {{ padding: 0; background: #f1f5f9; border-bottom: 1px solid var(--border); }}

/* ── Expand panel ── */
.expand-inner {{ padding: 14px 18px; }}
.expand-q {{ font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 12px; line-height: 1.55; }}
.expand-opts {{
  display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 6px;
  margin-bottom: 12px;
}}
.opt-item {{
  display: flex; gap: 8px; align-items: flex-start; padding: 6px 10px;
  border-radius: 7px; font-size: 11px; line-height: 1.4; background: var(--card);
  border: 1px solid var(--border);
}}
.opt-item.opt-app  {{ background: #eff6ff; border-color: #bfdbfe; }}
.opt-item.opt-k    {{ background: #f0fdf4; border-color: #bbf7d0; }}
.opt-item.opt-bad  {{ background: #fef2f2; border-color: #fecaca; }}
.opt-letter {{ font-weight: 900; font-size: 13px; min-width: 16px; color: var(--slate); }}
.expand-sources {{ display: flex; flex-wrap: wrap; gap: 10px; font-size: 11px; color: var(--slate); }}
.expand-sources .src {{ display: flex; align-items: center; gap: 5px; }}
.src-dot {{ width: 8px; height: 8px; border-radius: 50%; display: inline-block; }}

/* ── Answer badges ── */
.ans {{
  display: inline-flex; width: 26px; height: 26px; border-radius: 50%;
  align-items: center; justify-content: center;
  font-weight: 900; font-size: 12px; flex-shrink: 0;
}}
.ans-A {{ background: #dbeafe; color: #1e40af; }}
.ans-B {{ background: #dcfce7; color: #166534; }}
.ans-C {{ background: #fef3c7; color: #92400e; }}
.ans-D {{ background: #fee2e2; color: #991b1b; }}
.ans-NA {{ background: var(--bg); color: var(--muted); }}
.ans-diff {{ outline: 2.5px solid #ef4444; outline-offset: 1px; }}

/* ── Status badges ── */
.badge {{
  display: inline-block; padding: 3px 8px; border-radius: 20px;
  font-size: 10px; font-weight: 800; color: #fff; white-space: nowrap;
}}
.badge-PERFECT        {{ background: #16a34a; }}
.badge-RED_FLAG       {{ background: #dc2626; }}
.badge-TRIPLE_DISPUTE {{ background: #ea580c; }}
.badge-INCOMPLETE     {{ background: #64748b; }}
.badge-cat            {{ background: var(--blue-d); }}

/* ── Paginator ── */
.pager-row {{ display: flex; justify-content: space-between; align-items: center; margin-top: 14px; }}
.pager {{ display: flex; gap: 3px; }}
.pager button {{
  padding: 5px 10px; border: 1px solid var(--border); border-radius: 6px;
  background: var(--card); cursor: pointer; font-size: 11px; font-weight: 600;
  transition: all .1s;
}}
.pager button:hover {{ background: var(--bg); }}
.pager button.active {{ background: var(--blue); color: #fff; border-color: var(--blue); }}
.pager button:disabled {{ opacity: .4; cursor: not-allowed; }}
.pager-info {{ font-size: 11px; color: var(--muted); }}

/* ── Footer note ── */
.note {{
  background: var(--card); border: 1px solid var(--border); border-radius: 10px;
  padding: 14px 18px; font-size: 12px; color: var(--slate); line-height: 1.6;
}}
.note code {{
  background: var(--bg); padding: 2px 6px; border-radius: 4px;
  font-family: monospace; font-size: 11px; color: #334155; border: 1px solid var(--border);
}}

/* ── Separator ── */
.divider {{ height: 1px; background: var(--border); margin: 16px 0; }}

/* ── Txt truncate ── */
.txt-trunc {{ max-width: 340px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }}

@media (max-width: 640px) {{
  .agree-grid {{ grid-template-columns: 1fr; }}
  .header-score {{ display: none; }}
}}
</style>
</head>
<body>

<header class="header">
  <div class="header-title">
    <div>
      <h1>Auditoría de Respuestas · Osakidetza OPE 2026</h1>
      <p>Generado: {gen_ts} &nbsp;·&nbsp; Solo lectura</p>
    </div>
  </div>
  <div class="header-score">
    <div class="score-val">{pct_perfect}%</div>
    <div class="score-lbl">en consenso</div>
  </div>
</header>

<div class="container">

{alert_html}

<!-- KPIs -->
<div class="kpi-grid">
  <div class="kpi" style="border-top-color:#16a34a">
    <div class="kpi-val" style="color:#16a34a">{n_perfect}</div>
    <div class="kpi-lbl">Perfectas</div>
    <div class="kpi-sub">App = Kaixo</div>
  </div>
  <div class="kpi" style="border-top-color:#dc2626">
    <div class="kpi-val" style="color:#dc2626">{n_red}</div>
    <div class="kpi-lbl">Red Flags</div>
    <div class="kpi-sub">K&amp;O coinciden ≠ App</div>
  </div>
  <div class="kpi" style="border-top-color:#ea580c">
    <div class="kpi-val" style="color:#ea580c">{n_dispute}</div>
    <div class="kpi-lbl">Disputas</div>
    <div class="kpi-sub">3 fuentes difieren</div>
  </div>
  <div class="kpi" style="border-top-color:#64748b">
    <div class="kpi-val" style="color:#64748b">{n_inc}</div>
    <div class="kpi-lbl">Sin datos</div>
    <div class="kpi-sub">Kaixo o Osasun —</div>
  </div>
  <div class="kpi" style="border-top-color:#1d4ed8">
    <div class="kpi-val" style="color:#1d4ed8">{correctable}</div>
    <div class="kpi-lbl">Corregibles</div>
    <div class="kpi-sub">App ≠ Kaixo (tiene resp.)</div>
  </div>
  <div class="kpi" style="border-top-color:#0891b2">
    <div class="kpi-val" style="color:#0891b2">{global_total}</div>
    <div class="kpi-lbl">Total</div>
    <div class="kpi-sub">4 categorías</div>
  </div>
</div>

<!-- Acuerdo entre fuentes -->
<div class="agree-grid">
  <div class="agree-card">
    <div class="agree-pct" style="color:#ea580c">{pct_au}<span style="font-size:18px">%</span></div>
    <div class="agree-lbl">App = UGT</div>
    <div class="agree-bar"><div class="agree-fill" id="ab4" style="background:#ea580c;width:0%"></div></div>
  </div>
  <div class="agree-card">
    <div class="agree-pct" style="color:#1d4ed8">{pct_ak}<span style="font-size:18px">%</span></div>
    <div class="agree-lbl">App = Kaixo</div>
    <div class="agree-bar"><div class="agree-fill" id="ab1" style="background:#1d4ed8;width:0%"></div></div>
  </div>
  <div class="agree-card" style="display:none">
    <div class="agree-pct" style="color:#0891b2">{pct_ao}<span style="font-size:18px">%</span></div>
    <div class="agree-lbl">App = Osasuntest</div>
    <div class="agree-bar"><div class="agree-fill" id="ab2" style="background:#0891b2;width:0%"></div></div>
  </div>
  <div class="agree-card" style="display:none">
    <div class="agree-pct" style="color:#7c3aed">{pct_ko}<span style="font-size:18px">%</span></div>
    <div class="agree-lbl">Kaixo = Osasuntest</div>
    <div class="agree-bar"><div class="agree-fill" id="ab3" style="background:#7c3aed;width:0%"></div></div>
  </div>
</div>

<!-- Categorías -->
<div class="section">
  <div class="section-title">Desglose por categoría</div>
  <div class="cat-grid" id="cat-grid">
    <p style="color:var(--muted);font-size:12px">Cargando…</p>
  </div>
</div>

<!-- Tabla de discrepancias -->
<div class="section">
  <div class="section-title">
    Preguntas con discrepancia
    <span class="cnt" id="dispute-count">…</span>
  </div>

  <!-- Búsqueda + botones -->
  <div class="filter-bar">
    <input type="text" id="search" placeholder="🔍  Buscar texto, ID o pregunta…">
    <button class="btn btn-primary" id="btn-csv">↓ Exportar CSV</button>
    <button class="btn btn-ghost"   id="btn-reset">✕ Limpiar filtros</button>
  </div>

  <!-- Chips de estado -->
  <div class="chip-row" id="chip-status">
    <button class="chip active"           data-val="">Todos</button>
    <button class="chip chip-red"         data-val="RED_FLAG">🚩 Red Flag</button>
    <button class="chip chip-orange"      data-val="TRIPLE_DISPUTE">⚡ Disputa</button>
    <button class="chip chip-slate"       data-val="INCOMPLETE">○ Incompleto</button>
    <button class="chip chip-green"       data-val="PERFECT">✓ Perfecto+diff</button>
  </div>

  <!-- Filtros avanzados -->
  <div class="filter-bar">
    <span class="filter-label">Categoría</span>
    <select id="filter-cat">
      <option value="">Todas</option>
    </select>
    <span class="filter-label">App vs Kaixo</span>
    <select id="filter-diff">
      <option value="">Todos</option>
      <option value="diff">Solo App ≠ Kaixo</option>
      <option value="same">App = Kaixo</option>
      <option value="correctable">Corregibles</option>
    </select>
    <span class="filter-label">K vs O</span>
    <select id="filter-ko">
      <option value="">Todos</option>
      <option value="agree">K = O</option>
      <option value="disagree">K ≠ O</option>
      <option value="no-k">Sin Kaixo</option>
      <option value="no-o">Sin Osasun</option>
    </select>
    <span class="filter-label">Resp. App</span>
    <select id="filter-app-ans">
      <option value="">Cualquiera</option>
      <option>A</option><option>B</option><option>C</option><option>D</option>
    </select>
    <span class="filter-label">Por página</span>
    <select id="page-size">
      <option value="25">25</option>
      <option value="50" selected>50</option>
      <option value="100">100</option>
      <option value="9999">Todas</option>
    </select>
  </div>

  <!-- Tabla -->
  <div class="tbl-wrap">
    <table>
      <thead>
        <tr>
          <th data-col="originalId">ID <span class="si">⇅</span></th>
          <th data-col="_cat">Cat <span class="si">⇅</span></th>
          <th>Pregunta</th>
          <th data-col="app">App <span class="si">⇅</span></th>
          <th data-col="u">UGT <span class="si">⇅</span></th>
          <th data-col="k">Kaixo <span class="si">⇅</span></th>
          <th data-col="o">Osasun <span class="si">⇅</span></th>
          <th data-col="status">Estado <span class="si">⇅</span></th>
        </tr>
      </thead>
      <tbody id="tbl-body"></tbody>
    </table>
  </div>

  <!-- Paginador -->
  <div class="pager-row">
    <span class="pager-info" id="result-info"></span>
    <div class="pager" id="pager"></div>
  </div>
</div>

<!-- Nota de uso -->
<div class="note">
  <strong>Cómo interpretar:</strong>
  <strong style="color:#dc2626">Red Flag</strong> = Kaixo y Osasun coinciden pero la app difiere (alta prioridad).
  &nbsp;·&nbsp;
  <strong style="color:#ea580c">Disputa</strong> = las 3 fuentes difieren (revisar manualmente).
  &nbsp;·&nbsp;
  <strong style="color:#64748b">Incompleto</strong> = falta alguna fuente externa (no implica error).
  <br>
  <strong>Correcciones:</strong>
  <code>python run_pipeline.py --apply</code> previsualiza ·
  <code>python run_pipeline.py --apply --confirm</code> ejecuta.
</div>

</div><!-- /container -->

<!-- Datos embebidos (type application/json no se ejecuta) -->
<script type="application/json" id="j-disputes">{disputes_json}</script>
<script type="application/json" id="j-cat-stats">{cat_stats_json}</script>
<script type="application/json" id="j-cat-meta">{cat_meta_json}</script>

<script>
// ── Cargar datos ───────────────────────────────────────────────────────────────
const DISPUTES  = JSON.parse(document.getElementById('j-disputes').textContent);
const CAT_STATS = JSON.parse(document.getElementById('j-cat-stats').textContent);
const CAT_META  = JSON.parse(document.getElementById('j-cat-meta').textContent);

const STATUS_COLORS = {{
  PERFECT:        '#16a34a',
  RED_FLAG:       '#dc2626',
  TRIPLE_DISPUTE: '#ea580c',
  INCOMPLETE:     '#64748b',
}};
const STATUS_LABELS = {{
  PERFECT:        'Perfecto',
  RED_FLAG:       'Red Flag',
  TRIPLE_DISPUTE: 'Disputa',
  INCOMPLETE:     'Incompleto',
}};

// ── Barras de acuerdo ─────────────────────────────────────────────────────────
(function () {{
  const data = [
    ['ab4', '{pct_au}'],
    ['ab1', '{pct_ak}'],
    ['ab2', '{pct_ao}'],
    ['ab3', '{pct_ko}'],
  ];
  data.forEach(([id, raw]) => {{
    const el = document.getElementById(id);
    if (!el) return;
    const n = parseFloat(raw);
    el.style.width = (isNaN(n) ? 0 : n) + '%';
  }});
}})();

// ── Categorías ────────────────────────────────────────────────────────────────
(function () {{
  const grid = document.getElementById('cat-grid');
  grid.innerHTML = '';
  for (const [cat, cs] of Object.entries(CAT_STATS)) {{
    const total = cs.total || 1;
    const segs = [
      ['PERFECT',        cs.PERFECT        || 0, '#16a34a'],
      ['RED_FLAG',       cs.RED_FLAG        || 0, '#dc2626'],
      ['TRIPLE_DISPUTE', cs.TRIPLE_DISPUTE  || 0, '#ea580c'],
      ['INCOMPLETE',     cs.INCOMPLETE      || 0, '#64748b'],
    ].filter(([, n]) => n > 0);

    const stackHtml = segs.map(([, n, c]) =>
      `<div class="stacked-seg" style="flex:${{n}};background:${{c}}"></div>`
    ).join('');
    const legendHtml = segs.map(([lbl, n, c]) =>
      `<span class="legend-item"><span class="legend-dot" style="background:${{c}}"></span>${{STATUS_LABELS[lbl] || lbl}}: <strong>${{n}}</strong></span>`
    ).join('');
    const pct = Math.round((cs.PERFECT || 0) / total * 100);

    const card = document.createElement('div');
    card.className = 'cat-card';
    card.innerHTML = `
      <div class="cat-card-header">
        <span class="cat-name">${{CAT_META[cat] || cat}}</span>
        <span class="cat-meta">${{cs.total}} preguntas · ${{pct}}% ok</span>
      </div>
      <div class="stacked-bar">${{stackHtml}}</div>
      <div class="bar-legend">${{legendHtml}}</div>`;
    grid.appendChild(card);
  }}
}})();

// ── Poblar select de categorías ───────────────────────────────────────────────
(function () {{
  const sel = document.getElementById('filter-cat');
  for (const cat of Object.keys(CAT_STATS)) {{
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = CAT_META[cat] || cat;
    sel.appendChild(opt);
  }}
}})();

// ── Estado: chips ─────────────────────────────────────────────────────────────
let activeStatus = '';
document.getElementById('chip-status').addEventListener('click', e => {{
  const chip = e.target.closest('.chip');
  if (!chip) return;
  document.querySelectorAll('#chip-status .chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  activeStatus = chip.dataset.val;
  page = 1;
  renderTable();
}});

// ── Tabla ─────────────────────────────────────────────────────────────────────
let page    = 1;
let filtered = [];
let sortCol = 'originalId';
let sortDir = 1;

const tbody  = document.getElementById('tbl-body');
const pager  = document.getElementById('pager');
const dispEl = document.getElementById('dispute-count');

function ansClass(l) {{
  return 'ans ' + ({{'A':'ans-A','B':'ans-B','C':'ans-C','D':'ans-D'}}[l] || 'ans-NA');
}}

function esc(s) {{
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}}

function renderTable() {{
  const search  = document.getElementById('search').value.trim().toLowerCase();
  const catF    = document.getElementById('filter-cat').value;
  const diffF   = document.getElementById('filter-diff').value;
  const koF     = document.getElementById('filter-ko').value;
  const appAns  = document.getElementById('filter-app-ans').value;
  const ps      = parseInt(document.getElementById('page-size').value) || 50;

  filtered = DISPUTES.filter(q => {{
    if (catF && q._cat !== catF) return false;
    if (activeStatus && q.status !== activeStatus) return false;
    if (diffF === 'diff'        && q.app === q.k) return false;
    if (diffF === 'same'        && q.app !== q.k) return false;
    if (diffF === 'correctable' && (q.app === q.k || !q.k || q.k === '?')) return false;
    if (koF === 'agree'    && (q.k !== q.o || !q.k || q.k === '?')) return false;
    if (koF === 'disagree' && (q.k === q.o || !q.k || q.k==='?' || !q.o || q.o==='?')) return false;
    if (koF === 'no-k' && q.k && q.k !== '?') return false;
    if (koF === 'no-o' && q.o && q.o !== '?') return false;
    if (appAns && q.app !== appAns) return false;
    if (search) {{
      const hay = ((q.text || '') + ' ' + (q.id || '') + ' ' + (q.originalId || '')).toLowerCase();
      if (!hay.includes(search)) return false;
    }}
    return true;
  }});

  filtered.sort((a, b) => {{
    let av = a[sortCol] ?? '', bv = b[sortCol] ?? '';
    if (sortCol === 'originalId' || sortCol === 'id') {{
      const na = parseInt(av), nb = parseInt(bv);
      if (!isNaN(na) && !isNaN(nb)) return (na - nb) * sortDir;
    }}
    return String(av).localeCompare(String(bv), 'es') * sortDir;
  }});

  dispEl.textContent = filtered.length;
  const totalPages = Math.max(1, Math.ceil(filtered.length / ps));
  if (page > totalPages) page = 1;
  const slice = filtered.slice((page - 1) * ps, page * ps);

  tbody.innerHTML = '';
  slice.forEach((q, i) => {{
    const rowId   = 'r' + i;
    const appDiff = q.k && q.k !== '?' && q.app !== q.k || q.u && q.u !== '?' && q.app !== q.u;
    const oDiff   = q.o && q.o !== '?' && q.o !== q.app;
    const uDiff   = q.u && q.u !== '?' && q.u !== q.app;
    const statusColor = STATUS_COLORS[q.status] || '#64748b';

    const tr = document.createElement('tr');
    tr.className = 'data-row';
    tr.dataset.rowid = rowId;
    tr.innerHTML =
      `<td style="font-family:monospace;font-size:11px;color:#475569;white-space:nowrap">${{esc(q.originalId ?? q.id)}}</td>` +
      `<td><span class="badge badge-cat">${{esc(q._cat)}}</span></td>` +
      `<td><div class="txt-trunc" title="${{esc(q.text)}}">${{esc((q.text || '—').substring(0, 90))}}…</div></td>` +
      `<td><span class="${{ansClass(q.app)}} ${{appDiff ? 'ans-diff' : ''}}">${{esc(q.app || '?')}}</span></td>` +
      `<td><span class="${{ansClass(q.u)}} ${{uDiff ? 'ans-diff' : ''}}">${{esc(q.u || '?')}}</span></td>` +
      `<td><span class="${{ansClass(q.k)}}">${{esc(q.k || '?')}}</span></td>` +
      `<td><span class="${{ansClass(q.o)}} ${{oDiff ? 'ans-diff' : ''}}">${{esc(q.o || '?')}}</span></td>` +
      `<td><span class="badge badge-${{q.status}}">${{STATUS_LABELS[q.status] || q.status}}</span></td>`;

    tr.addEventListener('click', () => toggleExpand(rowId, q, tr));
    tbody.appendChild(tr);

    const expTr = document.createElement('tr');
    expTr.className = 'expand-row';
    expTr.id = 'exp-' + rowId;
    expTr.style.display = 'none';
    expTr.innerHTML = '<td colspan="7"></td>';
    tbody.appendChild(expTr);
  }});

  // Info
  document.getElementById('result-info').textContent =
    `${{filtered.length}} resultado${{filtered.length !== 1 ? 's' : ''}} · página ${{page}} / ${{totalPages}}`;

  // Pager
  pager.innerHTML = '';
  const mkBtn = (label, p, active, disabled) => {{
    const b = document.createElement('button');
    b.innerHTML = label;
    if (active)   b.classList.add('active');
    if (disabled) b.disabled = true;
    b.addEventListener('click', () => {{ page = p; renderTable(); window.scrollTo(0, 350); }});
    return b;
  }};
  pager.appendChild(mkBtn('‹', page - 1, false, page <= 1));
  const s2 = Math.max(1, page - 2), e2 = Math.min(totalPages, page + 2);
  for (let p2 = s2; p2 <= e2; p2++) pager.appendChild(mkBtn(p2, p2, p2 === page, false));
  pager.appendChild(mkBtn('›', page + 1, false, page >= totalPages));
}}

function toggleExpand(rowId, q, tr) {{
  const expRow = document.getElementById('exp-' + rowId);
  const isOpen = expRow.style.display !== 'none';
  document.querySelectorAll('.expand-row').forEach(r => r.style.display = 'none');
  if (isOpen) return;

  const opts = q.options || {{}};
  let optsHtml = '';
  ['A','B','C','D'].forEach(l => {{
    if (!opts[l]) return;
    let cls = 'opt-item';
    if (l === q.app && l !== q.k && l !== q.u) cls += ' opt-bad';
    else if (l === q.app)         cls += ' opt-app';
    if (l === q.k && l !== q.app) cls += ' opt-k';
    optsHtml += `<div class="${{cls}}"><span class="opt-letter">${{l}}</span><span>${{esc(opts[l])}}</span></div>`;
  }});
  if (!optsHtml) optsHtml = '<em style="color:var(--muted);font-size:11px">Opciones no disponibles</em>';

  expRow.querySelector('td').innerHTML = `
    <div class="expand-inner">
      <div class="expand-q">${{esc(q.text || '—')}}</div>
      <div class="expand-opts">${{optsHtml}}</div>
      <div class="expand-sources">
        <span class="src"><span class="src-dot" style="background:#1d4ed8"></span>App: <strong>${{esc(q.app || '?')}}</strong></span>
        <span class="src"><span class="src-dot" style="background:#ea580c"></span>UGT: <strong>${{esc(q.u || '?')}}</strong></span>
        <span class="src"><span class="src-dot" style="background:#16a34a"></span>Kaixo: <strong>${{esc(q.k || '?')}}</strong></span>
        <span class="src"><span class="src-dot" style="background:#7c3aed"></span>Osasun: <strong>${{esc(q.o || '?')}}</strong></span>
        <span class="src" style="color:var(--muted)">ID interno: ${{esc(q.id)}}</span>
      </div>
    </div>`;
  expRow.style.display = '';
}}

// ── Sort ──────────────────────────────────────────────────────────────────────
document.querySelectorAll('thead th[data-col]').forEach(th => {{
  th.addEventListener('click', () => {{
    const col = th.dataset.col;
    if (sortCol === col) sortDir *= -1;
    else {{ sortCol = col; sortDir = 1; }}
    document.querySelectorAll('thead th').forEach(t => t.classList.remove('sorted'));
    th.classList.add('sorted');
    const si = th.querySelector('.si');
    if (si) si.textContent = sortDir === 1 ? '↑' : '↓';
    page = 1; renderTable();
  }});
}});

// ── Filter events ─────────────────────────────────────────────────────────────
['search','filter-cat','filter-diff','filter-ko','filter-app-ans','page-size'].forEach(id => {{
  const el = document.getElementById(id);
  if (el) el.addEventListener('change', () => {{ page = 1; renderTable(); }});
}});
document.getElementById('search').addEventListener('input', () => {{ page = 1; renderTable(); }});

// ── Reset ─────────────────────────────────────────────────────────────────────
document.getElementById('btn-reset').addEventListener('click', () => {{
  document.getElementById('search').value           = '';
  document.getElementById('filter-cat').value       = '';
  document.getElementById('filter-diff').value      = '';
  document.getElementById('filter-ko').value        = '';
  document.getElementById('filter-app-ans').value   = '';
  document.getElementById('page-size').value        = '50';
  document.querySelectorAll('#chip-status .chip').forEach(c => c.classList.remove('active'));
  document.querySelector('#chip-status .chip[data-val=""]').classList.add('active');
  activeStatus = '';
  page = 1; renderTable();
}});

// ── CSV export ────────────────────────────────────────────────────────────────
document.getElementById('btn-csv').addEventListener('click', () => {{
  const cols   = ['id','originalId','_cat','status','app','u','k','o','text'];
  const header = ['ID','OriginalID','Categoría','Estado','App','UGT','Kaixo','Osasun','Pregunta'];
  const rows   = [header.join(';')];
  filtered.forEach(q =>
    rows.push(cols.map(c => '"' + String(q[c] ?? '').replace(/"/g,'""') + '"').join(';'))
  );
  const blob = new Blob(['\\ufeff' + rows.join('\\n')], {{type:'text/csv;charset=utf-8'}});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'osakidetza_discrepancias.csv';
  a.click();
}});

// ── Init ──────────────────────────────────────────────────────────────────────
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
    consensus_path = REPORTS_DIR / "CLEAN_CONSENSUS.json"
    if not consensus_path.exists():
        print(f"ERROR: No existe {consensus_path}. Ejecuta primero el pipeline completo.")
        sys.exit(1)
    with open(consensus_path, encoding="utf-8") as fh:
        data = json.load(fh)
    run({k: v for k, v in data.items() if not k.startswith("_")})
