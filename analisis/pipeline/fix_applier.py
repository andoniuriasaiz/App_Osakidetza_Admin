"""
fix_applier.py — Aplicador de correcciones a los JSON individuales
==================================================================
⚠ NUNCA se ejecuta automáticamente.
Solo se activa con flag explícito: python run_pipeline.py --apply

Lógica de corrección:
  - Si app != kaixo → proponer cambio a Kaixo (fuente más fiable).
  - No se toca ningún archivo si no se pasa --apply.
  - En modo dry-run muestra exactamente qué cambiaría y por qué.
  - Hace backup antes de modificar.

Las preguntas con k="?" (Kaixo sin dato) nunca se modifican.
"""

import json
import shutil
import sys
from pathlib import Path
from typing import List, Union, Dict

_HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(_HERE))
from config import DATA_DIR, REPORTS_DIR, BACKUP_DIR, LETTER_TO_NUM


def _load(path: Path) -> Union[List, Dict]:
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def _save(path: Path, data: Union[List, Dict]) -> None:
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
    with open(path, "a", encoding="utf-8") as fh:
        fh.write("\n")


def compute_changes(consensus: dict) -> list[dict]:
    """
    Calcula qué preguntas necesitan corrección sin tocar nada.
    Solo procesa RED_FLAG (K+U coinciden, o consenso externo claro).
    Los estados REVIEW_K_VS_UGT, UGT_OUTLIER y UGT_ONLY requieren revisión manual
    y nunca se auto-corrigen aquí.
    Devuelve lista de {id, file, old_letter, new_letter, status, text}.
    """
    # Solo estos estados se autocorrigen — el resto requiere revisión manual
    AUTO_CORRECT_STATUSES = {"RED_FLAG"}

    changes = []
    for cat_qs in consensus.values():
        if not isinstance(cat_qs, list):
            continue
        for q in cat_qs:
            app = q.get("app", "?")
            target = q.get("consensus", "?")

            if q.get("status") not in AUTO_CORRECT_STATUSES:
                continue
            if app == "?" or target == "?" or app == target:
                continue

            qid = q["id"]
            last_ = qid.rfind("_")
            if last_ == -1:
                continue
            fname = qid[:last_] + ".json"
            changes.append({
                "id":         qid,
                "file":       fname,
                "qnum":       int(qid[last_ + 1:]),
                "old_letter": app,
                "new_letter": target,
                "old_num":    LETTER_TO_NUM.get(app),
                "new_num":    LETTER_TO_NUM.get(target),
                "status":     q.get("status", "UNKNOWN"),
                "text":       q.get("text", "")[:80],
                "osasun":     q.get("o", "?"),
            })
    return changes


def apply(consensus: dict, dry_run: bool = True) -> dict:
    """
    Aplica (o simula) correcciones a los archivos individuales.
    Devuelve resumen {applied, skipped, errors, changes}.
    """
    changes = compute_changes(consensus)

    # Agrupar por archivo
    by_file: dict[str, list] = {}
    for ch in changes:
        by_file.setdefault(ch["file"], []).append(ch)

    total_files    = len(by_file)
    total_changes  = len(changes)
    applied = skipped = errors = 0
    log = []

    mode_label = "DRY-RUN" if dry_run else "APLICANDO"
    print(f"\n  Modo: {mode_label}")
    print(f"  Correcciones pendientes: {total_changes} en {total_files} archivos")
    if dry_run:
        print("  (Para aplicar: python run_pipeline.py --apply)")

    backup_dir_run = BACKUP_DIR / f"fix_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    for fname, file_changes in sorted(by_file.items()):
        fpath = DATA_DIR / fname
        if not fpath.exists():
            print(f"  ⚠  Archivo no encontrado: {fname}")
            errors += len(file_changes)
            continue

        questions = _load(fpath)
        id_index  = {q["id"]: i for i, q in enumerate(questions)}

        file_applied = 0
        for ch in file_changes:
            idx = id_index.get(ch["id"])
            if idx is None:
                errors += 1
                continue
            q       = questions[idx]
            new_num = ch["new_num"]
            if new_num is None:
                errors += 1
                continue
            # Buscar texto de la opción nueva
            new_text = next(
                (opt["text"] for opt in q.get("options", []) if opt["value"] == new_num),
                None
            )
            if new_text is None:
                errors += 1
                continue

            entry = {
                "id":     ch["id"],
                "status": ch["status"],
                "antes":  f"{ch['old_letter']} → {q.get('correctAnswers', ['?'])[0][:60]}",
                "despues": f"{ch['new_letter']} → {new_text[:60]}",
                "osasun": ch["osasun"],
            }
            log.append(entry)

            if not dry_run:
                questions[idx]["correctAnswerNums"] = [new_num]
                questions[idx]["correctAnswers"]    = [new_text]
                file_applied += 1

            applied += 1

        if not dry_run and file_applied > 0:
            # Backup
            backup_dir_run.mkdir(parents=True, exist_ok=True)
            shutil.copy2(fpath, backup_dir_run / fname)
            _save(fpath, questions)

        skipped_file = len(file_changes) - file_applied
        icon = "✓" if not dry_run else "→"
        print(f"  {icon} {fname}: {len(file_changes)} correcciones"
              + (f" (skipped={skipped_file})" if skipped_file else ""))

    if not dry_run:
        # Guardar log
        REPORTS_DIR.mkdir(parents=True, exist_ok=True)
        log_path = REPORTS_DIR / f"fix_log_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(log_path, "w", encoding="utf-8") as fh:
            json.dump({"applied": applied, "errors": errors, "changes": log},
                      fh, ensure_ascii=False, indent=2)
        print(f"\n  ✓ Log guardado → {log_path.name}")
        print(f"  📦 Backup → {backup_dir_run}")

    return {"applied": applied, "skipped": skipped, "errors": errors, "changes": log}


def run(consensus: dict, dry_run: bool = True) -> None:
    print("\n" + "=" * 60)
    lbl = "PASO 5 — Correcciones (DRY-RUN)" if dry_run else "PASO 5 — Aplicando correcciones"
    print(f"  {lbl}")
    print("=" * 60)
    result = apply(consensus, dry_run=dry_run)
    print(f"\n  Resumen: aplicadas={result['applied']}, errores={result['errors']}")
    if dry_run:
        print("  ⚠  Ningún archivo fue modificado.")
        print("  Para aplicar los cambios: python run_pipeline.py --apply")
    else:
        print("  ✅ Archivos actualizados correctamente.")
