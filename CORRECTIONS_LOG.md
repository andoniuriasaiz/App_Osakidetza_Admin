# Log de Correcciones — Consenso Kaixo/Osasuntest
**Fecha:** 2026-03-31
**Script:** `apply_consensus_fixes.py`
**Fuente:** `public/data/analisis/2026-03-31/CLEAN_CONSENSUS.json`

---

## Resumen

| Métrica | Valor |
|---|---|
| Correcciones aplicadas | **150** |
| Archivos modificados | **45** |
| Avisos (letra `?` sin datos) | 3 |
| Backup | `backup/consensus_backup_20260331_220706/` |

---

## Lógica aplicada

**Regla única: Kaixo es la fuente más fiable.**
Si `app != kaixo` → se cambia `correctAnswerNums` y `correctAnswers` a la respuesta de Kaixo, sin excepción. Esto cubre:

- `TRIPLE_DISPUTE` (121 preguntas): las tres fuentes difieren.
- `UNKNOWN` (29 preguntas): categoría A2/tec-comun sin etiqueta de status; se aplica la misma regla.
- `RED_FLAG` (0 en este lote): Kaixo y Osasun coinciden contra App → también se cambia a Kaixo.
- **Excepción de Protección**: App y Osasun coinciden pero Kaixo difiere → también se cambia a Kaixo.

Los 3 avisos corresponden a `tec-comun-t15_7` y `tec-comun-t15_23`, donde `k="?"` (Kaixo no tenía datos para esas preguntas). Esas dos preguntas **no se han modificado**.

---

## Archivos modificados

| Archivo | Correcciones |
|---|---|
| adm-d255-osakidetza-especifico.json | 9 |
| adm-transparencia-y-buen-gobierno.json | 13 |
| adm-protocolo-acoso-sexual-osaki.json | 4 |
| adm-puestos-funcionales.json | 5 |
| adm-segunda-opinion-medica.json | 4 |
| adm-lpac-interesados-y-actos.json | 3 |
| adm-lpac-procedimiento.json | 2 |
| adm-lpac-recursos.json | 1 |
| adm-lrjsp-sector-publico.json | 2 |
| adm-ebep-empleado-publico.json | 1 |
| adm-prl-atencion-cliente-osaki.json | 2 |
| adm-prl-prevencion-riesgos.json | 1 |
| aux-e01.json | 8 |
| aux-e02.json | 5 |
| aux-e03.json | 1 |
| aux-e05.json | 1 |
| aux-e06.json | 3 |
| aux-e08.json | 3 |
| aux-e11.json | 4 |
| aux-e12.json | 6 |
| comun-t01.json | 2 |
| comun-t02.json | 4 |
| comun-t03.json | 6 |
| comun-t04.json | 12 |
| comun-t05.json | 1 |
| comun-t08.json | 2 |
| comun-t09.json | 2 |
| comun-t10.json | 3 |
| comun-t12.json | 2 |
| comun-t14.json | 3 |
| comun-t15.json | 2 |
| comun-t16.json | 1 |
| comun-t17.json | 1 |
| comun-t18.json | 3 |
| tec-comun-t02.json | 1 |
| tec-comun-t03.json | 2 |
| tec-comun-t04.json | 4 |
| tec-comun-t06.json | 1 |
| tec-comun-t08.json | 7 |
| tec-comun-t09.json | 4 |
| tec-comun-t10.json | 3 |
| tec-comun-t12.json | 1 |
| tec-comun-t13.json | 2 |
| tec-comun-t14.json | 1 |
| tec-comun-t15.json | 3 |

---

## Próximos pasos

Los archivos **consolidados** (`comun.json`, `aux.json`, `adm.json`, `tec-comun.json`) se han regenerado automáticamente desde los individuales.
Si en el futuro se detectan más discrepancias, repetir el proceso actualizando `CLEAN_CONSENSUS.json` y ejecutando:

```bash
# Dry-run (previsualizar cambios)
python3 apply_consensus_fixes.py

# Aplicar cambios reales
python3 apply_consensus_fixes.py --apply
```
