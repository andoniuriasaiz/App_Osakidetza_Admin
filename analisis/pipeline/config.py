"""
config.py — Configuración central del pipeline de análisis Osakidetza OPE 2026
===============================================================================
Todos los paths, URLs y parámetros de categoría en un solo sitio.
"""

from pathlib import Path

# ── Rutas ────────────────────────────────────────────────────────────────────

def _get_root():
    import os
    # Intentar desde este archivo
    p = Path(__file__).absolute()
    for _ in range(5):
        if (p / "run_pipeline.py").exists():
            return p
        p = p.parent
    # Fallback: CWD
    cwd = Path(os.getcwd())
    if (cwd / "run_pipeline.py").exists():
        return cwd
    # Fallback desesperado: 3 niveles arriba de este archivo
    return Path(__file__).absolute().parent.parent.parent

ROOT          = _get_root()
DATA_DIR      = ROOT / "public" / "data"
ANALISIS_DIR  = ROOT / "analisis"
RAW_DIR       = ANALISIS_DIR / "raw"                # respuestas crudas scrapeadas
REPORTS_DIR   = ANALISIS_DIR / "reports"            # outputs generados
BACKUP_DIR    = ROOT / "backup"

# ── URLs de scraping ─────────────────────────────────────────────────────────
# Kaixo: página resumen con TODAS las respuestas en tabla (aukera2=eran)
# Una sola petición por categoría — mucho más eficiente que per-pregunta.
KAIXO_ERAN_BASE = "https://www.kaixo.com/opeosaki/index.php?aukera={category}&aukera2=eran&hizk=1"
# Kaixo: URL de la práctica interactiva (conservada para referencia)
KAIXO_BASE   = "https://www.kaixo.com/opeosaki/index.php?aukera={category}&hizk=1&num={num}"
# Osasuntest: página de categoría con tabla de todas las respuestas
# (las preguntas individuales no existen como URLs separadas)
OSASUN_CAT_BASE = "https://www.osasuntest.es/osakidetza/{category}/"
# Conservada para referencia histórica (devuelve 404)
OSASUN_BASE  = "https://www.osasuntest.es/osakidetza/{category}/pregunta-{num}"

# ── Mapa de categorías ───────────────────────────────────────────────────────
# Cada clave es el nombre interno del bloque de preguntas:
#   kaixo_cat / kaixo_n     → categoría y número de preguntas en kaixo.com
#   osasun_cat / osasun_n   → categoría y número de preguntas en osasuntest.es
#   osasun_offset           → desplazamiento ID entre osasun y app
#                             (osasun admin 1..500: las 1..298 = bloque C2,
#                              las 299..498 = bloque ADM con offset 298)
#   raw_kaixo / raw_osasun  → nombres de archivo en RAW_DIR
#   app_file                → JSON consolidado en DATA_DIR (para construir consenso)

CATEGORIES = {
    "C2": {
        "label":          "Común C2 (AUX + ADM)",
        "kaixo_cat":      "ope26osakicomun300",
        "kaixo_n":        300,
        "osasun_cat":     "administrativo",
        "osasun_n":       500,
        "osasun_offset":  0,
        "raw_kaixo":      "kaixo_c2.json",
        "raw_osasun":     "osasun_c2.json",
        "app_file":       "comun.json",
    },
    "A2": {
        "label":          "Común A2 / Técnico",
        "kaixo_cat":      "ope26osakicomun200",
        "kaixo_n":        200,
        # Osasuntest: el bloque enfermero tiene 700 preguntas en total,
        # pero solo las primeras 200 son el bloque común A2 (las que nos interesan).
        # Usamos la tabla MÁS PEQUEÑA de la página (= solo el bloque común).
        "osasun_cat":       "enfermero",
        "osasun_n":         200,
        "osasun_offset":    0,
        "raw_kaixo":      "kaixo_common_a2.json",
        "raw_osasun":     "osasun_nurse.json",
        "app_file":       "tec-comun.json",
    },
    "ADM": {
        "label":          "Administrativo (específico)",
        "kaixo_cat":      "ope26osakiadmin",
        "kaixo_n":        200,
        "osasun_cat":     "administrativo",
        "osasun_n":       500,
        # NOTA: El banco de preguntas ADM-específico de Osasuntest NO coincide
        # con el nuestro. Las primeras 3 preguntas (EBEP inicial) coinciden,
        # pero a partir de Q4 el contenido es completamente diferente.
        # Verificado manualmente: Q123/Q168 Osasuntest tienen preguntas distintas
        # a las nuestras (diferente banco, no diferente offset).
        # Máximo 31% de match en cualquier offset probado.
        # Offset 300 = semánticamente correcto (tras 300 preguntas C2 comunes).
        "osasun_offset":  0,
        "osasun_unreliable_specific": False,  # Mapeado por texto ahora
        "raw_kaixo":      "kaixo_admin.json",
        "raw_osasun":     "osasun_admin.json",
        "app_file":       "adm.json",
    },
    "AUX": {
        "label":          "Auxiliar Administrativo (específico)",
        "kaixo_cat":      "ope26osakiaux",
        "kaixo_n":        200,
        "osasun_cat":     "auxiliar-administrativo",
        "osasun_n":       500,
        # Offset corregido: era 298, debe ser 300.
        # Verificado empíricamente: con offset=300 hay 92% de coincidencia K=O.
        # Las preguntas AUX-específicas empiezan en posición 301 del archivo combinado
        # (posiciones 1-300 = bloque C2 común compartido).
        "osasun_offset":  0,
        "raw_kaixo":      "kaixo_aux.json",
        "raw_osasun":     "osasun_aux.json",
        "app_file":       "aux.json",
    },
}

# ── Conversión número ↔ letra ─────────────────────────────────────────────────
NUM_TO_LETTER = {1: "A", 2: "B", 3: "C", 4: "D", 5: "E"}
LETTER_TO_NUM = {v: k for k, v in NUM_TO_LETTER.items()}

# ── Umbrales de fuzzy matching ────────────────────────────────────────────────
FUZZY_CUTOFF = 0.72   # difflib SequenceMatcher ratio mínimo para aceptar match
TEXT_NORM_LEN = 90    # caracteres alfanuméricos a comparar
