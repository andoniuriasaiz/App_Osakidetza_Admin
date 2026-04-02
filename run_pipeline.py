#!/usr/bin/env python3
"""
run_pipeline.py — Orquestador del pipeline de análisis Osakidetza OPE 2026
===========================================================================

MODO NORMAL (solo análisis, sin tocar la app):
  python run_pipeline.py                 # Todo: scrape + consenso + dashboard
  python run_pipeline.py --no-scrape     # Solo consenso + dashboard (sin red)
  python run_pipeline.py --dashboard-only  # Regenerar solo el HTML

SCRAPING SELECTIVO:
  python run_pipeline.py --scrape-kaixo   # Actualizar solo respuestas Kaixo
  python run_pipeline.py --scrape-osasun  # Actualizar solo respuestas Osasun
  python run_pipeline.py --force          # Re-descargar TODO aunque ya exista

CORRECCIONES (⚠ modifica archivos de la app — REQUIERE REVISIÓN PREVIA):
  python run_pipeline.py --apply          # Ver qué cambiaría (dry-run con detalle)
  python run_pipeline.py --apply --confirm  # Aplicar correcciones realmente

CATEGORÍAS (se puede combinar con cualquier flag):
  python run_pipeline.py --cats C2 ADM    # Solo categorías C2 y ADM

FLUJO RECOMENDADO:
  1. python run_pipeline.py               → scrape + análisis + dashboard
  2. Abrir analisis/reports/dashboard_latest.html en el navegador
  3. Revisar manualmente las discrepancias
  4. python run_pipeline.py --apply       → ver qué cambiaría (dry-run)
  5. python run_pipeline.py --apply --confirm  → aplicar si estás de acuerdo
"""

import argparse
import sys
import importlib
import importlib.util
import time
from pathlib import Path
from datetime import datetime

# ── Configurar path para importar el pipeline ─────────────────────────────────
_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(_ROOT / "analisis" / "pipeline"))
importlib.invalidate_caches()  # Fuerza releer .py, ignora .pyc obsoletos

from config import CATEGORIES, REPORTS_DIR, RAW_DIR


def _banner(msg: str) -> None:
    print("\n" + "█" * 62)
    print(f"  {msg}")
    print("█" * 62)


def _section(n: int, msg: str) -> None:
    print(f"\n{'─'*62}")
    print(f"  [{n}] {msg}")
    print(f"{'─'*62}")


def main() -> None:
    p = argparse.ArgumentParser(
        description="Pipeline de análisis y auditoría de respuestas Osakidetza",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    # ── Pasos ─────────────────────────────────────────────────────────────────
    p.add_argument("--no-scrape",      action="store_true",
                   help="Saltar el scraping (usar datos cacheados)")
    p.add_argument("--scrape-kaixo",   action="store_true",
                   help="Actualizar solo Kaixo")
    p.add_argument("--scrape-osasun",  action="store_true",
                   help="Actualizar solo Osasuntest")
    p.add_argument("--force",          action="store_true",
                   help="Re-descargar aunque ya tengamos datos")
    p.add_argument("--no-dashboard",   action="store_true",
                   help="No generar el HTML de dashboard")
    p.add_argument("--dashboard-only", action="store_true",
                   help="Solo regenerar el dashboard (sin scraping ni consenso)")
    p.add_argument("--no-consolidate", action="store_true",
                   help="Saltar la fusión de archivos individuales (*-tXX.json)")
    p.add_argument("--reports",        action="store_true",
                   help="Generar CSVs de revisión (red flags, disputas, spot-check)")

    # ── Correcciones (opt-in explícito) ───────────────────────────────────────
    p.add_argument("--apply",    action="store_true",
                   help="Mostrar correcciones pendientes (dry-run por defecto)")
    p.add_argument("--confirm",  action="store_true",
                   help="Aplicar las correcciones realmente (requiere --apply)")

    # ── Filtros ────────────────────────────────────────────────────────────────
    p.add_argument("--cats", nargs="+", choices=list(CATEGORIES.keys()),
                   metavar="CAT",
                   help="Categorías a procesar (defecto: todas). Ej: --cats C2 ADM")

    args = p.parse_args()

    cats = args.cats or list(CATEGORIES.keys())

    _banner(f"PIPELINE OSAKIDETZA  ·  {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    print(f"  Categorías: {', '.join(cats)}")

    t0 = time.time()

    # ─────────────────────────────────────────────────────────────────────────
    # PASO 0 — Consolidación (Fusión de archivos individuales)
    # ─────────────────────────────────────────────────────────────────────────
    if not args.no_consolidate:
        from consolidator import run as run_consolidator
        run_consolidator(categories=cats)
    else:
        print("\n  ⏩ Consolidación omitida (--no-consolidate).")

    # ─────────────────────────────────────────────────────────────────────────
    # MODO: solo dashboard (carga consenso existente)
    # ─────────────────────────────────────────────────────────────────────────
    if args.dashboard_only:
        from dashboard_builder import run as build_dashboard
        consensus_path = REPORTS_DIR / "CLEAN_CONSENSUS.json"
        if not consensus_path.exists():
            print(f"\nERROR: {consensus_path} no existe. Ejecuta primero sin --dashboard-only.")
            sys.exit(1)
        import json
        with open(consensus_path, encoding="utf-8") as fh:
            data = json.load(fh)
        consensus = {k: v for k, v in data.items() if not k.startswith("_")}
        out = build_dashboard(consensus)
        print(f"\n  Abre: {out}")
        return

    # ─────────────────────────────────────────────────────────────────────────
    # PASO 1 — Scraping
    # ─────────────────────────────────────────────────────────────────────────
    if not args.no_scrape:
        do_kaixo  = args.scrape_kaixo or not (args.scrape_kaixo or args.scrape_osasun)
        do_osasun = args.scrape_osasun or not (args.scrape_kaixo or args.scrape_osasun)

        if do_kaixo:
            _section(1, "Scraping Kaixo.com")
            from scraper_kaixo import run as scrape_kaixo
            scrape_kaixo(categories=cats, force=args.force)
    else:
        print("\n  ⏩ Scraping Kaixo omitido (--no-scrape).")

    # Mapeo Osasuntest siempre se ejecuta (lee osasuntest_output/, sin red)
    # Para re-descargar Osasuntest usa: python analisis/pipeline/extraer_osasuntest_adm.py
    _section(2, "Mapeando Osasuntest por texto")
    from map_osasuntest import run as map_osasun
    map_osasun(categories=cats, root_path=_ROOT)

    _section(3, "Construyendo consenso (App vs Kaixo vs Osasun)")
    from consensus_builder import run as build_consensus
    consensus = build_consensus(categories=cats)

    # ─────────────────────────────────────────────────────────────────────────
    # PASO 3 — Dashboard
    # ─────────────────────────────────────────────────────────────────────────
    if not args.no_dashboard:
        _section(4, "Generando dashboard HTML")
        from dashboard_builder import run as build_dashboard
        out_html = build_dashboard(consensus)

    # ─────────────────────────────────────────────────────────────────────────
    # PASO 4b (opcional) — Informes CSV de revisión
    # ─────────────────────────────────────────────────────────────────────────
    if args.reports:
        _section(5, "Generando CSVs de revisión")
        from report_generator import run as gen_reports
        gen_reports(consensus)

    # ─────────────────────────────────────────────────────────────────────────
    # PASO 4 (opcional) — Correcciones
    # ─────────────────────────────────────────────────────────────────────────
    if args.apply:
        from fix_applier import run as apply_fixes
        apply_real = args.apply and args.confirm
        _section(5, "Correcciones" + (" (DRY-RUN — usa --confirm para aplicar)" if not apply_real else " ⚠ APLICANDO"))
        if apply_real:
            confirm = input(
                "\n  ⚠ Esto MODIFICARÁ archivos de la app. ¿Continuar? (escribe 'si'): "
            ).strip().lower()
            if confirm != "si":
                print("  Cancelado.")
            else:
                apply_fixes(consensus, dry_run=False)
        else:
            apply_fixes(consensus, dry_run=True)

    # ─────────────────────────────────────────────────────────────────────────
    # Resumen final
    # ─────────────────────────────────────────────────────────────────────────
    elapsed = time.time() - t0
    _banner(f"COMPLETADO en {elapsed:.1f}s")

    # Stats rápidas
    for cat, qs in consensus.items():
        if not isinstance(qs, list):
            continue
        by_s = {}
        for q in qs:
            s = q.get("status", "?")
            by_s[s] = by_s.get(s, 0) + 1
        parts = " | ".join(f"{s}={n}" for s, n in sorted(by_s.items()))
        print(f"  {cat:6s} → {parts}")

    total_disputes = sum(
        sum(1 for q in qs if q.get("status") != "PERFECT")
        for qs in consensus.values()
        if isinstance(qs, list)
    )
    kaixo_diffs = sum(
        sum(1 for q in qs if q.get("app") != q.get("k") and q.get("k") not in ("?",""))
        for qs in consensus.values()
        if isinstance(qs, list)
    )

    print(f"\n  Discrepancias totales: {total_disputes}")
    print(f"  Diferencias App≠Kaixo: {kaixo_diffs}")

    if not args.no_dashboard:
        print(f"\n  📊 Dashboard: {REPORTS_DIR / 'dashboard_latest.html'}")
        print("     Ábrelo en tu navegador para revisar visualmente.")

    if kaixo_diffs > 0 and not args.apply:
        print(f"\n  💡 Para ver las correcciones propuestas:")
        print(f"     python run_pipeline.py --apply")
        print(f"     python run_pipeline.py --apply --confirm  ← para aplicarlas")

    print()


if __name__ == "__main__":
    main()
