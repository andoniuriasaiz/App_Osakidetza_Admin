# Pipeline de Análisis y Auditoría de Respuestas — Osakidetza OPE 2026

Documentación del sistema de comparación de respuestas entre la app, Kaixo.com y Osasuntest.es.

---

## Índice

1. [Objetivo](#objetivo)
2. [Estructura de archivos](#estructura-de-archivos)
3. [Fuentes de datos](#fuentes-de-datos)
4. [Pasos del pipeline](#pasos-del-pipeline)
5. [Estados de consenso (PERFECT, RED_FLAG…)](#estados-de-consenso)
6. [Categorías y mapeos](#categorías-y-mapeos)
7. [IDs de pregunta: originalId vs officialId](#ids-de-pregunta)
8. [Cómo ejecutar](#cómo-ejecutar)
9. [Outputs generados](#outputs-generados)
10. [Limitaciones conocidas](#limitaciones-conocidas)

---

## Objetivo

Cruzar las respuestas de tres fuentes para detectar errores en la app:

| Fuente | Descripción | Confianza |
|--------|-------------|-----------|
| **App** | `public/data/*.json` — respuestas actuales en la app | referencia |
| **Kaixo** | kaixo.com — banco de preguntas OPE 2026 oficial | ★★★ (fuente principal) |
| **Osasuntest** | osasuntest.es — banco alternativo con matching por texto | ★★ (verificación) |

Kaixo se trata como la fuente de verdad. Si App = Kaixo → la respuesta es correcta, con independencia de lo que diga Osasuntest.

---

## Estructura de archivos

```
App_Osakidetza_Admin/
│
├── public/data/                    ← Datos de la app (fuente)
│   ├── comun-t01.json              ← Preguntas por tema (individual)
│   ├── comun-t02.json
│   ├── ...
│   ├── comun.json                  ← Consolidado (generado por pipeline)
│   ├── tec-comun.json              ← Consolidado A2
│   ├── adm.json                    ← Consolidado ADM
│   └── aux.json                    ← Consolidado AUX
│
├── osasuntest_output/              ← JSON extraídos de Osasuntest (data-questions)
│   ├── osasuntest_administrativo_c2_comun.json     (300 preguntas)
│   ├── osasuntest_administrativo_especifico.json   (200 preguntas)
│   ├── osasuntest_auxiliar-administrativo_*.json
│   ├── osasuntest_enfermero_c2_comun.json          (200 preguntas — usado para A2)
│   └── ...
│
├── analisis/
│   ├── pipeline/                   ← Scripts del pipeline
│   │   ├── config.py               ← Configuración central (rutas, categorías, URLs)
│   │   ├── consolidator.py         ← PASO 0: fusión de archivos individuales
│   │   ├── scraper_kaixo.py        ← PASO 1: scraping de Kaixo.com
│   │   ├── map_osasuntest.py       ← PASO 2: matching por texto App ↔ Osasuntest
│   │   ├── consensus_builder.py    ← PASO 3: cruce App vs Kaixo vs Osasun
│   │   ├── dashboard_builder.py    ← PASO 4: generación del HTML
│   │   ├── report_generator.py     ← PASO 4b: CSVs de revisión
│   │   └── fix_applier.py          ← PASO 5: aplicar correcciones (opt-in)
│   │
│   ├── raw/                        ← Respuestas normalizadas (generadas por pipeline)
│   │   ├── kaixo_c2.json           ← {num: letra} Kaixo C2
│   │   ├── kaixo_common_a2.json    ← {num: letra} Kaixo A2
│   │   ├── kaixo_admin.json        ← {num: letra} Kaixo ADM
│   │   ├── kaixo_aux.json          ← {num: letra} Kaixo AUX
│   │   ├── osasun_c2.json          ← {originalId: letra} Osasun C2 (mapeado por texto)
│   │   ├── osasun_nurse.json       ← {officialId: letra} Osasun A2
│   │   ├── osasun_admin.json       ← {originalId: letra} Osasun ADM
│   │   └── osasun_aux.json         ← {originalId: letra} Osasun AUX
│   │
│   ├── reports/                    ← Outputs (generados por pipeline)
│   │   ├── CLEAN_CONSENSUS.json    ← Consenso completo en JSON
│   │   ├── dashboard_latest.html   ← Dashboard visual (abrir en navegador)
│   │   ├── 1_correcciones_urgentes_*.csv
│   │   ├── 2_disputas_manuales_*.csv
│   │   ├── 3_sin_kaixo_osasun_difiere_*.csv
│   │   └── 4_spot_check_*.csv
│   │
│   └── PIPELINE.md                 ← Este archivo
│
├── backup/                         ← Backups antes de aplicar correcciones
│   └── fix_YYYYMMDD_HHMMSS/
│
└── run_pipeline.py                 ← Orquestador principal
```

---

## Fuentes de datos

### Kaixo.com

URL base: `https://www.kaixo.com/opeosaki/index.php?aukera={categoria}&aukera2=eran&hizk=1`

El parámetro `aukera2=eran` devuelve una página con **todas las respuestas en una tabla** (una sola petición por categoría). El scraper extrae pares `num → letra` con regex. No hay textos de pregunta disponibles en Kaixo, solo el número y la respuesta.

### Osasuntest.es

URL base: `https://www.osasuntest.es/osakidetza/{categoria}/`

La página de categoría embebe el JSON completo del banco de preguntas en el atributo HTML `data-questions`. Este JSON contiene, para cada pregunta: `id`, `question` (texto), `answers` (dict A/B/C/D → texto), `correct_answer`, `explanation`.

El script `extraer_osasuntest_adm.py` descarga y guarda estos JSON en `osasuntest_output/`. El matching posterior se hace por **texto de pregunta**, no por número, porque el orden de Osasuntest puede diferir del de la app.

---

## Pasos del pipeline

```
PASO 0   consolidator.py      Fusiona tec-comun-t01.json + t02… → tec-comun.json
PASO 1   scraper_kaixo.py     Descarga respuestas de Kaixo → analisis/raw/kaixo_*.json
PASO 2   map_osasuntest.py    Empareja App ↔ Osasuntest por texto → analisis/raw/osasun_*.json
PASO 3   consensus_builder.py Cruza las 3 fuentes → CLEAN_CONSENSUS.json
PASO 4   dashboard_builder.py Genera dashboard_latest.html
PASO 4b  report_generator.py  Genera CSVs de revisión (con --reports)
PASO 5   fix_applier.py       Aplica correcciones a los JSON individuales (opt-in)
```

### PASO 0 — Consolidación (`consolidator.py`)

Lee todos los `comun-t*.json`, `tec-comun-t*.json`, `adm-*.json`, `aux-e*.json` y los fusiona en los archivos maestros `comun.json`, `tec-comun.json`, `adm.json`, `aux.json`. Ordena por `originalId` (o `officialId` como fallback).

Estos archivos maestros son los que usa la app en producción. Los individuales son la fuente de edición.

### PASO 1 — Scraping Kaixo (`scraper_kaixo.py`)

Una sola petición HTTP por categoría al endpoint `aukera2=eran`. El resultado es un JSON `{num_pregunta: letra}` guardado en `analisis/raw/`. Si el archivo ya existe y no se pasa `--force`, se omite la descarga (caché).

Cobertura actual: C2=298/300, A2=198/200, ADM=194/200, AUX=200/200.

### PASO 2 — Mapping Osasuntest (`map_osasuntest.py`)

Para cada pregunta de la app, busca su equivalente en el banco de Osasuntest por coincidencia de texto:

1. Normaliza el texto: minúsculas, solo alfanumérico, elimina numeración inicial, expande siglas (RD→real decreto, EBEP→estatuto básico…).
2. Búsqueda exacta en el índice de Osasuntest.
3. Si no hay exact match: fuzzy matching con `difflib` (umbral 0.65).
4. Escribe `{originalId_o_officialId: letra_correcta}` en `analisis/raw/osasun_*.json`.

El archivo resultante tiene el mismo esquema que los de Kaixo: `{num: letra}`. Esto permite que `consensus_builder.py` los trate de la misma forma.

Cobertura actual: C2=299/299, A2=170/200, ADM=190/200, AUX=199/199.

### PASO 3 — Consenso (`consensus_builder.py`)

Para cada pregunta de la app:

1. Busca la respuesta de Kaixo por `originalId` (o `officialId` para A2).
2. Busca la respuesta de Osasuntest (ya mapeada en PASO 2).
3. Determina el **estado** según las reglas de prioridad (ver sección siguiente).
4. Guarda el resultado en `CLEAN_CONSENSUS.json`.

---

## Estados de consenso

Cada pregunta recibe uno de estos cuatro estados:

### ✅ PERFECT

`App == Kaixo`

La app tiene la misma respuesta que Kaixo, que es la fuente principal. No importa lo que diga Osasuntest. La pregunta está correcta.

Subtipo **trio** (campo booleano interno): `App == Kaixo == Osasun` — máxima confianza, las tres fuentes coinciden.

### 🔴 RED_FLAG

`Kaixo == Osasun ≠ App`

Kaixo y Osasuntest coinciden en una respuesta distinta a la de la app. **Alta confianza de que la app tiene un error.** Estas son las correcciones más seguras de aplicar automáticamente.

### 🟠 TRIPLE_DISPUTE

`App ≠ Kaixo ≠ Osasun` (las tres difieren, o al menos Kaixo ≠ App y Osasun ≠ App ≠ Osasun)

Ninguna fuente coincide con las demás. Puede deberse a:
- Pregunta con matices legales que las tres fuentes interpretan distinto.
- Texto de opciones ligeramente diferente entre fuentes (mismo contenido, distinta redacción).
- Error real en la app que ninguna fuente externa confirma claramente.

**Requieren revisión manual consultando el texto legal.**

### ⚪ INCOMPLETE

`Kaixo == "?"` (Kaixo no tiene datos para esta pregunta)

Kaixo no devolvió respuesta para este número de pregunta. Causas habituales:
- La pregunta existe en la app pero Kaixo no la incluye en su banco (su banco tiene ~198/200, ~298/300 preguntas, no siempre el 100%).
- El número de pregunta de la app no coincide con el de Kaixo (raro con el sistema actual de IDs).

En estos casos el pipeline confía en la respuesta de la app por defecto. Si Osasuntest también difiere, aparece en el CSV 3 (sin Kaixo + Osasun difiere) para revisión manual.

> **Nota:** INCOMPLETE no significa que la respuesta sea incorrecta. Significa que no hay confirmación externa de Kaixo. La mayoría de los INCOMPLETE son correctos.

---

## Categorías y mapeos

| Clave | Nombre | Preguntas app | Kaixo cat | Osasuntest cat | Notas |
|-------|--------|--------------|-----------|----------------|-------|
| C2  | Común C2 | 299 | `ope26osakicomun300` | `administrativo` (bloque 1-300) | Compartido por ADM y AUX |
| A2  | Técnico / Común A2 | 200 | `ope26osakicomun200` | `enfermero` (bloque común) | Mismo temario que enfermería |
| ADM | Administrativo específico | 200 | `ope26osakiadmin` | `administrativo` (bloque 301-500) | Osasuntest ADM-específico usa banco diferente → `osasun_unreliable_specific: True` |
| AUX | Auxiliar específico | 199 | `ope26osakiaux` | `auxiliar-administrativo` (bloque 301-500) | |

### ADM y Osasuntest — banco diferente

Las primeras ~3 preguntas del bloque ADM específico de Osasuntest coinciden con las nuestras (ambas empiezan por el mismo temario EBEP), pero a partir de la Q4 el contenido es completamente diferente. Osasuntest tiene su propio banco ADM que no corresponde al de la OPE 2026. Por eso `config.py` tiene `osasun_unreliable_specific: True` para ADM, y el consenso fuerza `o = "?"` para todas las preguntas específicas de ADM.

### A2 y el bloque "enfermero" de Osasuntest

El temario común A2 (técnico-administrativo) y el temario común de enfermería son **idénticos** (mismas leyes: Ley 44/2003, Ley 16/2003, Ley 55/2003, LOPD…). Osasuntest solo tiene el bloque bajo la categoría `enfermero`, pero el matching por texto lo empareja correctamente con las preguntas de `tec-comun.json`.

---

## IDs de pregunta

Los JSON de la app usan varios campos de identificación:

| Campo | Descripción | Presente en |
|-------|-------------|-------------|
| `id` | String único tipo `comun-t01_1`. Determina a qué archivo individual pertenece la pregunta. | Todos |
| `originalId` | Número de pregunta en el banco original (1-300 para C2, 1-200 para ADM/AUX). | C2, ADM, AUX (no en A2) |
| `officialId` | Número secuencial asignado al hacer el mapeo con el PDF oficial (1-200 para A2). | A2 / tec-comun |
| `questionNum` | Número de pregunta dentro del tema (se reinicia en cada tema: 1-10). No es único. | Todos |

**Para A2:** `originalId` es siempre `None` porque ese bloque se creó antes de hacer el mapeo con el PDF oficial. Se usa `officialId` (1-200) que sí es único y coincide con la numeración de Kaixo.

El pipeline usa en todos los sitios: `originalId ?? officialId ?? questionNum`.

---

## Cómo ejecutar

```bash
# Flujo completo (scraping + análisis + dashboard)
python run_pipeline.py

# Solo análisis (sin red, usa datos cacheados)
python run_pipeline.py --no-scrape

# Análisis + CSVs de revisión
python run_pipeline.py --no-scrape --reports

# Solo regenerar el dashboard
python run_pipeline.py --dashboard-only

# Previsualizar correcciones sin aplicar (dry-run)
python run_pipeline.py --apply

# Aplicar correcciones (modifica archivos individuales)
python run_pipeline.py --apply --confirm

# Solo una categoría
python run_pipeline.py --cats A2

# Re-descargar Osasuntest (actualizar osasuntest_output/)
python analisis/pipeline/extraer_osasuntest_adm.py
```

---

## Outputs generados

### `analisis/reports/CLEAN_CONSENSUS.json`

Estructura completa del consenso. Cada pregunta contiene:

```json
{
  "id": "tec-comun-t02_1",
  "originalId": 11,
  "text": "Según dispone la Ley 16/2003...",
  "options": {"A": "...", "B": "...", "C": "...", "D": "..."},
  "explanation": "...",
  "app": "B",
  "k": "B",
  "o": "B",
  "o_reliable": true,
  "trio": true,
  "consensus": "B",
  "status": "PERFECT"
}
```

### `analisis/reports/dashboard_latest.html`

Dashboard visual con filtros, tabla interactiva y exportación CSV. Abrir directamente en el navegador (archivo local, sin servidor).

### CSVs de revisión (con `--reports`)

| Archivo | Contenido | Acción recomendada |
|---------|-----------|-------------------|
| `1_correcciones_urgentes_*.csv` | RED_FLAGs: K=O≠App | Aplicar con `--apply --confirm` |
| `2_disputas_manuales_*.csv` | TRIPLE_DISPUTEs | Revisar texto legal manualmente |
| `3_sin_kaixo_osasun_difiere_*.csv` | INCOMPLETE + O≠App | Revisar con cautela |
| `4_spot_check_*.csv` | PERFECT + O discrepa | Spot-check opcional |

---

## Limitaciones conocidas

- **A2 Kaixo numbering**: Se asume que `officialId` (1-200) coincide con la numeración de Kaixo. Verificado empíricamente: los RED_FLAGs corregidos tenían K=O en la misma pregunta, lo que confirma el alineamiento.

- **Fuzzy matching A2**: 30 de las 200 preguntas A2 no tienen match en Osasuntest (85% cobertura). Esas 30 quedan como INCOMPLETE si Kaixo tampoco tiene datos, o como PERFECT/RED_FLAG si Kaixo sí tiene respuesta.

- **ADM Osasuntest**: El banco específico de Osasuntest para ADM es diferente al de la OPE. Solo los primeros ~3 temas coinciden. El campo `osasun_unreliable_specific: True` en `config.py` desactiva Osasun para ADM específico.

- **Preguntas duplicadas en C2**: Los `originalId` 130, 135 y 167 aparecen dos veces en `comun.json` (dos preguntas distintas con el mismo número). Ambas tienen la misma respuesta correcta en la app, por lo que no causa errores visibles pero sí imprecisión en el lookup de Kaixo/Osasun.

- **Kaixo sin cobertura total**: Kaixo no tiene datos para ~2-6 preguntas por categoría (preguntas que no incluyó en su banco). Esas preguntas quedan como INCOMPLETE.
