"""
config.py — Configuración central del pipeline de análisis Osakidetza OPE 2026
===============================================================================
Todos los paths, URLs y parámetros de categoría en un solo sitio.
"""

from pathlib import Path

# ── Rutas ────────────────────────────────────────────────────────────────────
ROOT          = Path(__file__).resolve().parent.parent.parent   # raíz del proyecto
DATA_DIR      = ROOT / "public" / "data"
ANALISIS_DIR  = ROOT / "analisis"
RAW_DIR       = ANALISIS_DIR / "raw"                # respuestas crudas scrapeadas
REPORTS_DIR   = ANALISIS_DIR / "reports"            # outputs generados
BACKUP_DIR    = ROOT / "backup"

# ── URLs de scraping ─────────────────────────────────────────────────────────
# Kaixo: URL de la práctica interactiva
KAIXO_BASE   = "https://www.kaixo.com/opeosaki/index.php?aukera={category}&hizk=1&num={num}"
# Osasuntest: página estática con respuesta visible en HTML
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
        "raw_osasun":     "osasun_admin.json",
        "app_file":       "comun.json",
    },
    "A2": {
        "label":          "Común A2 / Técnico",
        "kaixo_cat":      "ope26osakicomun200",
        "kaixo_n":        200,
        "osasun_cat":     "enfermero",
        "osasun_n":       700,
        "osasun_offset":  0,
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
        "osasun_offset":  298,
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
        "osasun_offset":  298,
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
