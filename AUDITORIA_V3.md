# Auditoría Comparativa v3.0 — IT Txartelak vs. Apps de Referencia
**Fecha:** 2026-03-21 · **Versión actual:** 2.0

---

## 1. Estado actual de la app (v2.0)

### ✅ Lo que ya tenemos

| Área | Feature |
|---|---|
| **Aprendizaje** | Algoritmo SM-2 (Anki-style) — repaso espaciado real |
| **Aprendizaje** | 3 tipos de pregunta: Test, Imagen, Simulación click-through |
| **Aprendizaje** | 4 modos de estudio: Pendientes, Nuevas, Todas, Errores |
| **Aprendizaje** | Modo supervivencia (3 vidas ❤️) |
| **Gamificación** | Sistema XP con 6 niveles (Novato → Maestro) |
| **Gamificación** | CelebrationFlash (+XP flotante) en respuesta correcta |
| **Gamificación** | Racha de días (streak) con heatmap de actividad |
| **Gamificación** | Objetivo diario (daily goal) con barra de progreso |
| **Examen** | Simulacro cronometrado con penalización −1/3 |
| **Examen** | Kahoot-style colored buttons (A=rojo, B=azul, C=verde, D=naranja) |
| **Examen** | ConfirmModal personalizado (sin window.confirm) |
| **Visual** | Radar/spider chart de dominio por módulo |
| **Visual** | Predictor de preparación ("listo en ~N semanas") |
| **Visual** | Top errores list, milestone badges de racha |
| **Técnico** | BD Neon (Postgres) por usuario |
| **Técnico** | JWT auth + proxy de rutas (server-side) |
| **Técnico** | Sync fire-and-forget a BD, localStorage como caché |
| **Técnico** | Build limpio Next.js 16.2, TypeScript strict, Tailwind 4 |

---

## 2. Benchmarking contra apps de referencia

### 🟡 Kahoot!
**Core loop:** pregunta → opciones de colores → revelar respuesta → puntos por velocidad → podio final

| Feature Kahoot | ¿Lo tenemos? | Gap |
|---|---|---|
| Botones de colores (A/B/C/D) | ✅ Sí | — |
| Temporizador **por pregunta** (no por examen) | ❌ No | **M1** — Speed mode |
| Bonus XP por velocidad de respuesta | ❌ No | **M1** |
| Podio animado al final de sesión | ❌ No | **M2** |
| Efectos de sonido (correcto/incorrecto) | ❌ No | **M1** — Muy impactante |
| Confetti / partículas | ❌ No | **M2** |
| Ranking entre usuarios (leaderboard) | ❌ No | **M3** |
| Modo multijugador | ❌ No | **M3** (muy complejo) |

**Resumen Kahoot:** el punto más doloroso es la **ausencia de sonidos** y el **temporizador por pregunta**. Estas dos cosas juntas crean la tensión y el engagement que hace famoso a Kahoot.

---

### 🟢 Duolingo
**Core loop:** lección corta → variedad de ejercicios → streak → ligas → recompensas sociales

| Feature Duolingo | ¿Lo tenemos? | Gap |
|---|---|---|
| Racha (streak) | ✅ Sí | — |
| Vidas por sesión | ✅ Modo supervivencia | Parcial |
| Objetivo diario configurable | ✅ Sí | — |
| XP y niveles | ✅ Sí | — |
| **Combo multiplier** (racha de aciertos → XP×2) | ❌ No | **M1** |
| **Level-up celebration** (pantalla completa) | ❌ No | **M1** |
| **Streak freeze** (proteger racha si fallas 1 día) | ❌ No | **M2** |
| **Misiones diarias múltiples** (no solo un objetivo) | ❌ No | **M2** |
| **Repasar errores** al final de lección | ✅ Parcial (al final de sesión) | Mejorable |
| Liga/ranking semanal | ❌ No | **M3** |
| Amigos / social | ❌ No | **M3** |
| Notificaciones / recordatorios | ❌ No | **M2** |
| Mascota / personaje animado | ❌ No | **M3** |
| Onboarding / tutorial | ❌ No | **M2** |

**Resumen Duolingo:** el **combo multiplier** y la **celebración de level-up** son las dos cosas que más engagement añadirían con menos esfuerzo. El streak freeze es pedagógicamente interesante para no desmotivar al alumno.

---

### 🔵 Quizlet / Vaia (StudySmarter)
**Core loop:** flashcards → múltiples modos de estudio → importar/exportar → grupos

| Feature Quizlet/Vaia | ¿Lo tenemos? | Gap |
|---|---|---|
| **Animación flip de tarjeta** (voltear para ver respuesta) | ❌ No | **M2** |
| Múltiples modos: Learn, Write, Test, Match | Parcial | **M2** |
| **Juego Match** (emparejar pregunta↔respuesta en tiempo) | ❌ No | **M2** |
| Modo flashcard puro (sin SM-2, solo flip) | ❌ No | **M2** |
| Importar desde CSV / Excel | ❌ No | **M3** |
| Grupos colaborativos | ❌ No | **M3** |
| Temporizador Pomodoro integrado | ❌ No | **M3** |
| **Notas / explicación por pregunta** | ❌ No | **M1** — CRÍTICO pedagógico |
| Marcar/favoritar preguntas | ❌ No | **M1** |
| **Historial de respuestas por pregunta** | Parcial (solo wrong count) | **M2** |
| Modo escribir (write the answer) | ❌ No | **M3** |

**Resumen Quizlet/Vaia:** la **ausencia total de explicaciones/notas por pregunta** es el mayor gap pedagógico. El alumno falla una pregunta y no sabe *por qué* es correcta la otra. El **modo Match** (asociar pares) sería un minijuego muy popular.

---

### 🔴 Análisis específico: pedagogía del aprendizaje

Comparando con principios de apps de aprendizaje efectivo (basados en ciencia cognitiva):

| Principio | Apps referencia | Nuestra app | Urgencia |
|---|---|---|---|
| **Repetición espaciada** | Anki, Duolingo | ✅ SM-2 | — |
| **Recuperación activa** (test yourself) | Quizlet Test | ✅ Estudio | — |
| **Interleaving** (mezcla de módulos) | Duolingo | ✅ Modo Mezcla | — |
| **Feedback inmediato** | Todos | ✅ Tras respuesta | — |
| **Elaboración** (¿por qué es correcta?) | Anki notas, Khan Academy | ❌ **Ausente** | 🔴 CRÍTICO |
| **Ejemplo concreto** (ver el proceso) | Simulaciones | ✅ Tipo B | — |
| **Dificultad ajustada** (SM-2 ease factor) | Anki | ✅ Ease factor | — |
| **Metacognición** (¿sé lo que no sé?) | Anki | Parcial (radar) | 🟡 |
| **Variedad de formatos** | Quizlet | Parcial (3 tipos) | 🟡 |
| **Motivación intrínseca** (progreso visible) | Todos | ✅ Stats, XP | — |
| **Carga cognitiva** (sesiones cortas) | Duolingo | Parcial (50 máx.) | 🟡 |

---

## 3. Propuesta de mejoras v3.0

### Priorización MoSCoW

#### 🔴 MUST (Impacto máximo / coste bajo)

**M1.1 — Efectos de sonido** *(~2h)*
- Web Audio API: pitido suave correcto (Do mayor), tono grave incorrecto
- Sonido de nivel subido (jingle 0.5s)
- Toggle mute en header (🔊/🔇)
- Sin librería externa, generado con AudioContext

**M1.2 — Combo multiplier XP** *(~2h)*
- Racha de aciertos consecutivos: ×1.0 → ×1.5 (3+) → ×2.0 (6+) → ×3.0 (10+)
- Badge visible en header durante la racha: `🔥 ×2`
- Se rompe con cualquier respuesta mala (No sé / Difícil)
- El multiplicador se aplica al XP base

**M1.3 — Explicaciones por pregunta** *(~4h + contenido)*
- Campo `explanation` en el JSON de preguntas (opcional)
- Si existe, se muestra tras responder en un recuadro azul claro
- Formato: "💡 La respuesta correcta es A porque..."
- Prioridad: primero en las 20 preguntas más falladas globalmente

**M1.4 — Marcar/favoritar preguntas** *(~3h)*
- Botón ★ en cada pregunta durante el estudio
- Nueva tabla `bookmarks` en BD (user_id, card_id)
- Modo de estudio "Favoritas" en el selector del módulo
- Badge counter en el módulo si hay favoritas pendientes

**M1.5 — Level-up celebration** *(~2h)*
- Detectar cuando XP cruza el umbral de nivel
- Pantalla modal fullscreen: confetti, nombre del nuevo nivel, emoji grande
- Animación de 3 segundos, luego se descarta automáticamente

---

#### 🟡 SHOULD (Alto impacto / coste medio)

**M2.1 — Speed mode / Temporizador por pregunta** *(~4h)*
- Opción en pantalla de selección: ⚡ Modo velocidad (10s / 20s / 30s por pregunta)
- Barra de tiempo que se vacía por debajo de la pregunta (animación CSS)
- Bonus XP si responde en <50% del tiempo: "+Rápido +5 XP"
- Si se agota, cuenta como respuesta incorrecta

**M2.2 — Modo Match / Emparejar** *(~5h)*
- Grid de 8 tarjetas (4 preguntas + 4 respuestas mezcladas)
- Clic en pregunta → clic en respuesta → desaparece si correcto
- Temporizador global, puntuación por velocidad
- Sin SM-2 (es un minijuego de repaso rápido)

**M2.3 — Resumen animado de sesión** *(~3h)*
- Al terminar, pantalla de resumen con stats animados
- "Racha de X aciertos 🔥", "XP ganado: +N", "Nivel: X→Y"
- Comparación con sesión anterior ("Mejor que ayer" / "Nuevo récord")
- Botón "Repasar errores ahora" (carga solo las falladas de esta sesión)

**M2.4 — Misiones diarias** *(~4h)*
- 3 misiones generadas cada día (reset a medianoche)
- Ejemplos: "Haz 10 preguntas de Excel", "No falles 5 seguidas", "Completa modo Supervivencia"
- Recompensa XP bonus al completar (+50 / +75 / +100 XP)
- Badge en dashboard con contador de misiones pendientes

**M2.5 — Streak Freeze** *(~2h)*
- El usuario puede "congelar" su racha comprando con XP (100 XP = 1 freeze)
- Se activa automáticamente si hay freeze disponible y no estudia un día
- Máximo 2 freezes almacenados
- Icono de cristal de hielo ❄️ en el indicador de racha

**M2.6 — PWA instalable** *(~2h)*
- `manifest.json` con iconos y theme color corporativo
- Service worker básico (cache de assets estáticos)
- Banner "Instalar app" en mobile
- Permite uso offline en modo lectura

**M2.7 — Modo flashcard flip** *(~3h)*
- Nueva opción de modo: 🃏 Tarjetas
- Tarjeta con animación CSS 3D rotateY (flip)
- Cara frontal: pregunta; cara trasera: respuesta correcta
- Botones: "Sabía" / "No sabía" (sin opciones múltiples)
- Más rápido para repasos rápidos

---

#### 🟢 COULD (Interesante / coste alto)

**M3.1 — Leaderboard entre usuarios** *(~6h)*
- Ranking semanal de XP entre todos los usuarios registrados
- Tabla en página de stats: puesto, nombre (ofuscado), XP semana
- Reset cada lunes a las 00:00

**M3.2 — Notificaciones push (recordatorio de racha)** *(~8h)*
- Notificación a las 20:00 si no ha estudiado ese día
- Web Push API + service worker
- Opt-in con botón en settings

**M3.3 — Historial de exámenes** *(~4h)*
- Nueva tabla `exam_history` en BD
- Guardar: fecha, módulo, nº preguntas, % correcto, % penalizado
- Sección en stats: "Mis simulacros" con gráfico de evolución

**M3.4 — Gráfico de progreso temporal** *(~4h)*
- Línea de preguntas dominadas por día (últimos 30 días)
- SVG chart simple (sin librería), dibujado igual que el radar chart
- En la página de stats

**M3.5 — Modo examen cronometrado por pregunta** *(~3h)*
- En el simulacro, opción: "30 segundos por pregunta"
- Auto-avanza al siguiente al agotar tiempo
- Simula la presión de algunos exámenes tipo oposición

**M3.6 — Importar/exportar progreso** *(~3h)*
- Botón "Exportar progreso" → descarga JSON
- Botón "Importar progreso" → merge con localStorage
- Útil para backup o cambio de dispositivo

---

## 4. Comparativa visual resumen

```
                    NUESTRA APP v2.0
                    ══════════════════════════════
Repaso espaciado    ████████████████████  100%
Gamificación        ████████████░░░░░░░░   60%
Variedad modos      ████████░░░░░░░░░░░░   40%
Feedback pedagógico █████░░░░░░░░░░░░░░░   25%  ← GAP CRÍTICO
Sonido / sensación  ░░░░░░░░░░░░░░░░░░░░    0%  ← GAP CRÍTICO
Social / comunidad  █░░░░░░░░░░░░░░░░░░░    5%
Retención a largo   ████████████░░░░░░░░   60%
```

---

## 5. Roadmap v3.0 recomendado

### Sprint 1 — "Feels alive" (~2 días)
1. **Sonidos** (M1.1) — Transforma completamente la sensación
2. **Combo multiplier** (M1.2) — Muy fácil, muy visible
3. **Level-up celebration** (M1.5) — Cierra el loop de XP

### Sprint 2 — "Aprende mejor" (~2 días)
4. **Explicaciones por pregunta** (M1.3) — Pedagógicamente crítico
5. **Marcar favoritas** (M1.4) — Autonomía del alumno
6. **Resumen animado de sesión** (M2.3)

### Sprint 3 — "Vuelve cada día" (~3 días)
7. **Misiones diarias** (M2.4)
8. **Speed mode** (M2.1)
9. **Modo Match** (M2.2)
10. **Streak Freeze** (M2.5)

### Sprint 4 — "Instálame" (~1 día)
11. **PWA** (M2.6)
12. **Historial de exámenes** (M3.3)
13. **Gráfico progreso temporal** (M3.4)

---

## 6. La apuesta más diferenciadora

Si hay que elegir **una sola cosa** para implementar primero, es **M1.3 — Explicaciones por pregunta**.

Las apps de referencia (Kahoot, Duolingo) son entretenidas pero pedagógicamente superficiales. Un alumno que está preparando unas oposiciones necesita **entender por qué** una respuesta es correcta, no solo memorizarla. Ninguna app de quiz española para oposiciones de ofimática ofrece esto de forma integrada.

La explicación puede ser tan simple como una frase: *"En Access 2000, para crear una relación debes ir a Herramientas → Relaciones, no al menú Insertar."* Eso vale más que 50 XP.

**Segunda apuesta: M1.1 — Sonidos.** El sonido convierte una app "útil" en una app que "se siente bien usar". Duolingo tiene notoriamente buen audio design. Con 2 horas de Web Audio API se puede conseguir el 80% del impacto.

---

*Auditoría generada el 2026-03-21 para IT Txartelak v2.0*
