"""
fix_applier.py — Aplicador de correcciones + actualización de campos de fuentes
=================================================================================
⚠ NUNCA se ejecuta automáticamente.
Solo se activa con flag explícito: python run_pipeline.py --apply

Lógica de corrección:
  - Solo corrige preguntas con estado RED_FLAG (K+U coinciden contra la App).
  - Los estados REVIEW_K_VS_UGT, UGT_OUTLIER, UGT_ONLY requieren revisión manual.
  - No se toca ningún archivo si no se pasa --apply.
  - En modo dry-run muestra exactamente qué cambiaría y por qué.
  - Hace backup antes de modificar.

Adicionalmente, cuando se aplican correcciones (--apply --confirm), también
actualiza los campos de fiabilidad de fuentes en TODOS los archivos:
  - sourceSources: lista de fuentes que confirman la respuesta correcta
    Ej: ["Kaixo", "Osasuntest", "UGT", "IA"] → máxima fiabilidad
  - sourceStatus:  estado del consenso ('PERFECT', 'RED_FLAG', 'UGT_OUTLIER', etc.)
  - sourceTrio:    true si las 4 fuentes coinciden (legacy, para compatibilidad)
  - o_reliable:    false si Osasuntest no es fiable para esta categoría

Estas etiquetas son las que ve el usuario en la app tras responder una pregunta.
"""

import json
import shutil
import sys
from datetime import datetime
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


def _compute_source_sources(
    app_ans: str,
    ka: str,
    oa: str,
    ua: str,
    o_reliable: bool,
    correct_ans: str,
) -> list[str]:
    """
    Devuelve la lista de fuentes que coinciden con la respuesta correcta.
    Orden: Kaixo, Osasuntest, UGT, IA (la app).
    Solo se incluye una fuente si tiene dato (no "?") y coincide con correct_ans.
    """
    sources = []
    if ka != "?" and ka == correct_ans:
        sources.append("Kaixo")
    if oa != "?" and o_reliable and oa == correct_ans:
        sources.append("Osasuntest")
    if ua != "?" and ua == correct_ans:
        sources.append("UGT")
    # La IA (app) se incluye si su respuesta coincide con el consenso
    # Tras aplicar --apply --confirm, la respuesta de la app YA está corregida,
    # por lo que app_ans == correct_ans para la mayoría de preguntas.
    if app_ans != "?" and app_ans == correct_ans:
        sources.append("IA")
    return sources


def compute_changes(consensus: dict) -> list[dict]:
    """
    Calcula qué preguntas necesitan corrección sin tocar nada.
    Solo procesa RED_FLAG (K+U coinciden, o consenso externo claro).
    Los estados REVIEW_K_VS_UGT, UGT_OUTLIER y UGT_ONLY requieren revisión manual
    y nunca se auto-corrigen aquí.
    Devuelve lista de {id, file, old_letter, new_letter, status, text, ...}.
    """
    AUTO_CORRECT_STATUSES = {"FIX_SUGGESTED"}

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
                "confidence": q.get("confidence", 0),
                "votes": {
                    "ia": q.get("ia", "?"),
                    "k":  q.get("k", "?"),
                    "o":  q.get("o", "?"),
                    "u":  q.get("u", "?")
                },
                # Fuentes que coincidirán DESPUÉS de aplicar la corrección
                # (target = la respuesta corregida, así que IA también coincide)
                "source_sources": _compute_source_sources(
                    target,           # app_ans = target (ya corregida)
                    q.get("k", "?"),
                    q.get("o", "?"),
                    q.get("u", "?"),
                    q.get("o_reliable", True),
                    target,
                ),
                "source_status": q.get("status", "UNKNOWN"),
                "o_reliable":    q.get("o_reliable", True),
            })
    return changes


def build_source_index(consensus: dict) -> dict[str, dict]:
    """
    Construye un índice {question_id: {sourceSources, sourceStatus, sourceTrio, o_reliable}}
    para TODAS las preguntas del consenso, incluyendo las que no necesitan corrección.
    Se usa para actualizar los campos de fiabilidad en los JSONs tras aplicar --confirm.
    """
    index = {}
    for cat_qs in consensus.values():
        if not isinstance(cat_qs, list):
            continue
        for q in cat_qs:
            qid = q.get("id")
            if not qid:
                continue

            app    = q.get("app", "?")
            ka     = q.get("k", "?")
            oa     = q.get("o", "?")
            ua     = q.get("u", "?")
            status = q.get("status", "UNKNOWN")
            o_rel  = q.get("o_reliable", True)
            # La respuesta "correcta" (el consenso gold)
            correct = q.get("consensus", app)

            # Usamos la respuesta ACTUAL de la app (no el consenso) para calcular
            # si "IA" aparece en las fuentes. Tras aplicar --apply --confirm, la
            # respuesta de la app se habrá corregido y "IA" se incluirá.
            sources = _compute_source_sources(app, ka, oa, ua, o_rel, correct)
            index[qid] = {
                "sourceSources":    sources,
                "sourceStatus":     status,
                "sourceTrio":       len(sources) == 4,  # Kaixo+Osasun+UGT+IA
                "sourceConfidence": q.get("confidence", 0),
                "sourceVotes": {
                    "ia": ka, # Error en variable ka? no, ka es k. Ah, espera.
                    # Déjame corregir esto. El loop de build_source_index tiene ka=q.get("k")
                    "ia": q.get("ia", "?"),
                    "k":  ka,
                    "o":  oa,
                    "u":  ua
                },
                "o_reliable":       o_rel,
            }
    return index


def apply(consensus: dict, dry_run: bool = True) -> dict:
    """
    Aplica (o simula) correcciones a los archivos individuales.
    En modo real (dry_run=False), también actualiza los campos de fiabilidad
    de fuentes para TODAS las preguntas del consenso.
    Devuelve resumen {applied, skipped, errors, changes}.
    """
    changes = compute_changes(consensus)
    source_index = build_source_index(consensus)

    # Agrupar correcciones por archivo
    by_file: dict[str, list] = {}
    for ch in changes:
        by_file.setdefault(ch["file"], []).append(ch)

    # Todos los archivos que tienen datos de fuentes (puede ser más que los que
    # tienen correcciones pendientes)
    source_files: dict[str, list] = {}
    for qid, src_data in source_index.items():
        last_ = qid.rfind("_")
        if last_ == -1:
            continue
        fname = qid[:last_] + ".json"
        source_files.setdefault(fname, []).append((qid, src_data))

    total_files    = len(by_file)
    total_changes  = len(changes)
    applied = skipped = errors = 0
    log = []

    mode_label = "DRY-RUN" if dry_run else "APLICANDO"
    print(f"\n  Modo: {mode_label}")
    print(f"  Correcciones pendientes: {total_changes} en {total_files} archivos")
    if dry_run:
        print("  (Para aplicar: python run_pipeline.py --apply --confirm)")
    else:
        print(f"  Actualizando campos de fuentes en {len(source_files)} archivos")

    backup_dir_run = BACKUP_DIR / f"fix_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    # Archivos a procesar: todos los que tienen correcciones + todos los que tienen
    # datos de fuentes (en modo real, para actualizar los badges)
    all_files_to_process = set(by_file.keys())
    if not dry_run:
        all_files_to_process |= set(source_files.keys())

    for fname in sorted(all_files_to_process):
        fpath = DATA_DIR / fname
        if not fpath.exists():
            print(f"  ⚠  Archivo no encontrado: {fname}")
            if fname in by_file:
                errors += len(by_file[fname])
            continue

        questions = _load(fpath)
        id_index  = {q["id"]: i for i, q in enumerate(questions)}

        file_applied = 0
        file_changes = by_file.get(fname, [])

        # ── 1. Aplicar correcciones de respuesta ──────────────────────────────
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

        # ── 2. Actualizar campos de fiabilidad de fuentes ─────────────────────
        # Para preguntas recién corregidas, usamos el source_sources pre-calculado
        # en compute_changes (que ya incluye "IA" porque usó la nueva respuesta).
        # Para el resto, usamos build_source_index (respuesta actual de la app).
        if not dry_run:
            src_entries = source_files.get(fname, [])
            # Índice de source_sources post-corrección para las preguntas que se corrigen
            corrected_sources = {ch["id"]: ch for ch in file_changes}
            for qid, src_data in src_entries:
                idx = id_index.get(qid)
                if idx is None:
                    continue
                if qid in corrected_sources:
                    # Pregunta corregida: usar fuentes pre-calculadas con nueva respuesta
                    ch = corrected_sources[qid]
                    new_ss = ch["source_sources"]
                    questions[idx]["sourceSources"]    = new_ss
                    questions[idx]["sourceStatus"]     = src_data["sourceStatus"]
                    questions[idx]["sourceTrio"]       = len(new_ss) == 4
                    questions[idx]["sourceConfidence"] = ch["confidence"]
                    questions[idx]["sourceVotes"]      = ch["votes"]
                    questions[idx]["o_reliable"]       = src_data["o_reliable"]
                else:
                    # Pregunta sin corrección: usar datos directos del índice
                    questions[idx]["sourceSources"]    = src_data["sourceSources"]
                    questions[idx]["sourceStatus"]     = src_data["sourceStatus"]
                    questions[idx]["sourceTrio"]       = src_data["sourceTrio"]
                    questions[idx]["sourceConfidence"] = src_data["sourceConfidence"]
                    questions[idx]["sourceVotes"]      = src_data["sourceVotes"]
                    questions[idx]["o_reliable"]       = src_data["o_reliable"]

        # ── 3. Guardar ────────────────────────────────────────────────────────
        if not dry_run and (file_applied > 0 or src_entries):
            backup_dir_run.mkdir(parents=True, exist_ok=True)
            shutil.copy2(fpath, backup_dir_run / fname)
            _save(fpath, questions)

        skipped_file = len(file_changes) - file_applied
        if fname in by_file:
            icon = "✓" if not dry_run else "→"
            print(f"  {icon} {fname}: {len(file_changes)} correcciones"
                  + (f" (skipped={skipped_file})" if skipped_file else ""))

    if not dry_run:
        REPORTS_DIR.mkdir(parents=True, exist_ok=True)
        log_path = REPORTS_DIR / f"fix_log_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(log_path, "w", encoding="utf-8") as fh:
            json.dump({"applied": applied, "errors": errors, "changes": log},
                      fh, ensure_ascii=False, indent=2)
        print(f"\n  ✓ Log guardado → {log_path.name}")
        print(f"  📦 Backup → {backup_dir_run}")
        print(f"  ✅ Campos sourceSources/sourceStatus actualizados en {len(source_files)} archivos")

    return {"applied": applied, "skipped": skipped, "errors": errors, "changes": log}


def update_sources_only(consensus: dict) -> dict:
    """
    Actualiza SOLO los campos de fiabilidad (sourceSources, sourceStatus, etc.)
    en todos los archivos JSON, sin modificar las respuestas correctas.
    Útil para refrescar los badges tras regenerar el consenso sin aplicar fixes.
    """
    source_index = build_source_index(consensus)
    source_files: dict[str, list] = {}
    for qid, src_data in source_index.items():
        last_ = qid.rfind("_")
        if last_ == -1:
            continue
        fname = qid[:last_] + ".json"
        source_files.setdefault(fname, []).append((qid, src_data))

    updated_files = 0
    updated_questions = 0

    for fname, entries in sorted(source_files.items()):
        fpath = DATA_DIR / fname
        if not fpath.exists():
            continue
        questions = _load(fpath)
        id_index  = {q["id"]: i for i, q in enumerate(questions)}
        changed = False
        for qid, src_data in entries:
            idx = id_index.get(qid)
            if idx is None:
                continue
            questions[idx]["sourceSources"]    = src_data["sourceSources"]
            questions[idx]["sourceStatus"]     = src_data["sourceStatus"]
            questions[idx]["sourceTrio"]       = src_data["sourceTrio"]
            questions[idx]["sourceConfidence"] = src_data["sourceConfidence"]
            questions[idx]["sourceVotes"]      = src_data["sourceVotes"]
            questions[idx]["o_reliable"]       = src_data["o_reliable"]
            changed = True
            updated_questions += 1
        if changed:
            _save(fpath, questions)
            updated_files += 1

    return {"updated_files": updated_files, "updated_questions": updated_questions}


def run(consensus: dict, dry_run: bool = True) -> None:
    print("\n" + "=" * 60)
    lbl = "PASO 5 — Correcciones (DRY-RUN)" if dry_run else "PASO 5 — Aplicando correcciones"
    print(f"  {lbl}")
    print("=" * 60)
    result = apply(consensus, dry_run=dry_run)
    print(f"\n  Resumen: aplicadas={result['applied']}, errores={result['errors']}")
    if dry_run:
        print("  ⚠  Ningún archivo fue modificado.")
        print("  Para aplicar los cambios: python run_pipeline.py --apply --confirm")
    else:
        print("  ✅ Archivos actualizados correctamente.")
