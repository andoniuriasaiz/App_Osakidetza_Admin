#!/usr/bin/env python3
"""
apply_consensus_fixes.py
------------------------
Aplica las correcciones de respuestas derivadas de CLEAN_CONSENSUS.json
a los archivos JSON individuales en public/data/.

Lógica de decisión:
  - Si app != kaixo → cambiar a la respuesta de Kaixo (Kaixo es la fuente más fiable).
  - Esto cubre todos los casos: TRIPLE_DISPUTE, RED_FLAG, y Excepción de Protección
    (cuando App y Osasun coinciden pero Kaixo difiere).
  - El único caso donde NO se hace nada es cuando app == kaixo (no hay discrepancia).

Uso:
  python3 apply_consensus_fixes.py          # Dry-run (solo muestra los cambios)
  python3 apply_consensus_fixes.py --apply  # Aplica los cambios reales
"""

import json
import os
import sys
import shutil
from datetime import datetime
from pathlib import Path

# ──────────────────────────────────────────────────────────────────────────────
# Configuración
# ──────────────────────────────────────────────────────────────────────────────
CONSENSUS_FILE = "public/data/analisis/2026-03-31/CLEAN_CONSENSUS.json"
DATA_DIR = "public/data"
BACKUP_DIR = f"backup/consensus_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

LETTER_TO_NUM = {"A": 1, "B": 2, "C": 3, "D": 4, "E": 5}

# ──────────────────────────────────────────────────────────────────────────────
# Funciones auxiliares
# ──────────────────────────────────────────────────────────────────────────────

def load_json(path: str) -> list | dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_json(path: str, data: list | dict) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    # Añadir newline final (convención Unix)
    with open(path, "a", encoding="utf-8") as f:
        f.write("\n")


def backup_file(src: str, backup_dir: str) -> None:
    """Copia el archivo original a la carpeta de backup manteniendo la estructura."""
    rel_path = os.path.relpath(src, DATA_DIR)
    dst = os.path.join(backup_dir, rel_path)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(src, dst)


def collect_fixes(consensus: dict) -> dict[str, list[dict]]:
    """
    Devuelve un diccionario {filename: [fix1, fix2, ...]} donde cada fix es:
      {id, questionNum, old_num, new_num, old_letter, new_letter, status, category}
    Solo incluye las entradas donde app != kaixo.
    """
    fixes_by_file: dict[str, list] = {}

    for category, questions in consensus.items():
        for q in questions:
            app = q.get("app")
            k = q.get("k")
            if not app or not k or app == k:
                continue  # Sin discrepancia → no hacer nada

            qid = q["id"]
            # El id tiene formato "archivo_numero", ej: "comun-t01_11"
            last_underscore = qid.rfind("_")
            if last_underscore == -1:
                print(f"  [WARN] ID con formato inesperado, ignorando: {qid}")
                continue

            file_base = qid[:last_underscore]
            q_num = int(qid[last_underscore + 1:])
            filename = f"{file_base}.json"
            filepath = os.path.join(DATA_DIR, filename)

            if not os.path.exists(filepath):
                print(f"  [WARN] Archivo no encontrado: {filepath}")
                continue

            fixes_by_file.setdefault(filename, []).append({
                "id": qid,
                "questionNum": q_num,
                "old_letter": app,
                "new_letter": k,
                "old_num": LETTER_TO_NUM.get(app),
                "new_num": LETTER_TO_NUM.get(k),
                "status": q.get("status", "UNKNOWN"),
                "category": category,
                "osasun": q.get("o", "?"),
            })

    return fixes_by_file


def apply_fixes_to_file(
    filepath: str,
    fixes: list[dict],
    dry_run: bool,
    backup_dir: str,
) -> tuple[int, int]:
    """
    Aplica las correcciones a un archivo JSON individual.
    Retorna (aplicadas, fallidas).
    """
    questions = load_json(filepath)
    # Indexar por id para acceso O(1)
    id_index: dict[str, int] = {q["id"]: i for i, q in enumerate(questions)}

    applied = 0
    failed = 0
    changes = []

    for fix in fixes:
        qid = fix["id"]
        idx = id_index.get(qid)
        if idx is None:
            print(f"    [WARN] ID no encontrado en archivo: {qid}")
            failed += 1
            continue

        q = questions[idx]
        current_nums = q.get("correctAnswerNums", [])
        new_num = fix["new_num"]

        if new_num is None:
            print(f"    [WARN] Letra no reconocida '{fix['new_letter']}' para: {qid}")
            failed += 1
            continue

        # Buscar el texto de la opción correcta nueva
        new_option_text = None
        for opt in q.get("options", []):
            if opt["value"] == new_num:
                new_option_text = opt["text"]
                break

        if new_option_text is None:
            print(f"    [WARN] Opción {new_num} no encontrada en opciones de: {qid}")
            failed += 1
            continue

        old_num = fix["old_num"]
        old_texts = q.get("correctAnswers", [])

        changes.append({
            "id": qid,
            "old": f"{fix['old_letter']}({old_num}) → {old_texts}",
            "new": f"{fix['new_letter']}({new_num}) → [{new_option_text[:80]}...]",
            "status": fix["status"],
            "osasun": fix["osasun"],
        })

        if not dry_run:
            questions[idx]["correctAnswerNums"] = [new_num]
            questions[idx]["correctAnswers"] = [new_option_text]

        applied += 1

    if not dry_run and applied > 0:
        backup_file(filepath, backup_dir)
        save_json(filepath, questions)

    return applied, failed, changes


# ──────────────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────────────

def main():
    dry_run = "--apply" not in sys.argv

    print("=" * 70)
    print("  CORRECCIÓN DE CONSENSO — Osakidetza OPE 2026")
    print(f"  Modo: {'DRY-RUN (sin cambios)' if dry_run else '⚠ APLICANDO CAMBIOS REALES'}")
    print("=" * 70)
    print()

    # 1. Cargar consenso
    print(f"Cargando {CONSENSUS_FILE}...")
    consensus = load_json(CONSENSUS_FILE)

    # 2. Calcular fixes
    fixes_by_file = collect_fixes(consensus)

    total_fixes = sum(len(v) for v in fixes_by_file.values())
    total_files = len(fixes_by_file)
    print(f"Encontradas {total_fixes} correcciones en {total_files} archivos.\n")

    # 3. Crear directorio de backup (solo si vamos a aplicar)
    if not dry_run:
        os.makedirs(BACKUP_DIR, exist_ok=True)
        print(f"Backup en: {BACKUP_DIR}\n")

    # 4. Procesar cada archivo
    total_applied = 0
    total_failed = 0
    all_changes = []

    for filename in sorted(fixes_by_file.keys()):
        fixes = fixes_by_file[filename]
        filepath = os.path.join(DATA_DIR, filename)

        print(f"📄 {filename} ({len(fixes)} correcciones)")
        applied, failed, changes = apply_fixes_to_file(
            filepath, fixes, dry_run, BACKUP_DIR
        )

        for ch in changes:
            marker = "  ✓" if not dry_run else "  →"
            print(f"{marker} [{ch['status']}] {ch['id']}")
            print(f"       Antes: {ch['old']}")
            print(f"       Ahora: {ch['new']}")
            print(f"       (Osasun={ch['osasun']})")
            all_changes.append(ch)

        total_applied += applied
        total_failed += failed
        print()

    # 5. Resumen
    print("=" * 70)
    print("  RESUMEN")
    print("=" * 70)
    print(f"  Archivos procesados : {total_files}")
    print(f"  Correcciones {'aplicadas' if not dry_run else 'pendientes'}: {total_applied}")
    print(f"  Errores / avisos    : {total_failed}")

    if dry_run:
        print()
        print("  ⚠  Esto es un DRY-RUN. Para aplicar los cambios ejecuta:")
        print("     python3 apply_consensus_fixes.py --apply")
    else:
        print()
        print("  ✅ Cambios aplicados correctamente.")
        print(f"  📦 Backup guardado en: {BACKUP_DIR}")
        print()
        print("  SIGUIENTE PASO:")
        print("  Si tienes script de compilación (build) para generar aux.json,")
        print("  adm.json, comun.json, tec-comun.json, ejecútalo ahora para")
        print("  sincronizar los archivos consolidados.")

    # 6. Guardar log
    log_path = f"public/data/analisis/2026-03-31/fix_log_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    log_data = {
        "timestamp": datetime.now().isoformat(),
        "mode": "dry_run" if dry_run else "applied",
        "total_fixes": total_applied,
        "total_errors": total_failed,
        "changes": all_changes,
    }
    save_json(log_path, log_data)
    print(f"\n  Log guardado en: {log_path}")


if __name__ == "__main__":
    main()
