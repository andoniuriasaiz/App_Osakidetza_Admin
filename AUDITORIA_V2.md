# Auditoría completa + Propuesta de Upgrade v2.0

> Análisis de código, UX/UI, pedagogía y funcionalidades — 21-03-2026
> Referencia: Duolingo, Quizlet, Kahoot, Anki, Khan Academy

---

## 1. Auditoría de código

### ✅ Lo que está bien

- **TypeScript estricto** sin errores (`tsc --noEmit` limpio)
- **Singleton del cliente Postgres** en `db.ts` — evita conexiones redundantes en dev
- **JWT en cookie HTTP-only** — correcto desde el punto de vista de seguridad
- **Fire-and-forget en progress sync** — la UI no espera a la BD, es la decisión correcta
- **Fisher-Yates shuffle** bien implementado en `questions.ts`
- **Caché de preguntas en módulo** — evita refetch entre páginas
- **SM-2 puro** separado del estado de la aplicación (`spaced-repetition.ts` vs `progress.ts`)
- **Cache-busting con SHA de commit** en los JSONs — correcto para Vercel CDN

### ⚠️ Problemas y deudas técnicas

**Seguridad / Robustez**

1. **Sin middleware de protección de rutas** — todas las páginas protegidas hacen el check en `useEffect` (client-side). Esto significa que el HTML de `/dashboard` se sirve brevemente antes del redirect. Un middleware de Next.js en `middleware.ts` lo resolvería.

2. **Race condition multi-tab** — si el usuario tiene dos pestañas abiertas y ambas hacen `syncFromDB()` + responden preguntas, la última en sincronizar gana y puede sobreescribir progreso de la otra.

3. **`logout` sin try/catch en el caller** — si la llamada a `/api/auth/logout` falla, `localStorage` se limpia igualmente pero el cookie servidor no, quedando en estado inconsistente.

4. **Sin validación de módulo en `/study/[module]`** — si alguien navega a `/study/modulo-inventado` la app crashea silenciosamente.

**Performance**

5. **`loadStats()` en dashboard es secuencial** — un for-loop que espera cada módulo. Debería ser `Promise.all`.

```ts
// Actual (lento):
for (const mod of MODULES) {
  const questions = await loadQuestions(mod.id);
  ...
}

// Correcto:
const results = await Promise.all(MODULES.map(async mod => {
  const questions = await loadQuestions(mod.id);
  return { mod, questions };
}));
```

6. **`syncFromDB()` bloquea el dashboard** — se llama con `.then()` pero la UI espera a que termine para mostrar los stats correctos. Una solución es mostrar los datos de localStorage inmediatamente y actualizar en background.

**UX técnica**

7. **`confirm()` nativo en el examen** — `window.confirm()` es horrible en móvil. Debería ser un modal propio.

8. **Sin ErrorBoundary** — si un componente lanza, toda la página crashea. Especialmente crítico en `study/[module]` donde hay lógica compleja.

9. **`vercel.json` pone `no-store` en `/data/*`** pero el cliente también hace cache-busting por SHA. Son dos mecanismos redundantes: el `no-store` servidor hace que Vercel no cachee, pero el cliente luego sí cachea en su `questionCache`. Revisar si conviene eliminarlo y dejar solo el SHA.

---

## 2. Auditoría de UX / UI

### ✅ Lo que funciona bien

- **Identidad visual fuerte** — el azul Osakidetza (#282182) es consistente en toda la app
- **Bottom nav** — correcta para móvil, con indicador de pestaña activa y áreas táctiles WCAG
- **Keyboard shortcuts** — 1-4, Espacio, Enter, flechas — power user ready
- **Lightbox** — zoom en imágenes de enunciado y solución, bien ejecutado
- **Ripple de click** — la animación de clic en simulaciones es satisfactoria
- **Progress bars animadas** — la transición CSS de 500ms da sensación de fluidez
- **Rating buttons con preview de intervalo** — el usuario sabe cuándo volverá la pregunta antes de valorar
- **Skeleton loading** — el `animate-pulse` evita layout shift
- **Header sticky** — siempre se sabe en qué módulo se está

### ❌ Problemas de UX detectados

**Dashboard**

1. **Sobrecarga de información en primera visita** — el dashboard muestra simultáneamente: banner de bienvenida, 2 CTAs grandes, 4 tarjetas de módulo, caja de "Cómo funciona" y caja de rendimiento global. Para un usuario nuevo es abrumador; para un usuario recurrente, el "Cómo funciona" ocupa espacio innecesario.

2. **Sin jerarquía clara de acción prioritaria** — el usuario no sabe si debería hacer "Práctica de hoy", "Simulacro" o "Mezcla". Falta una acción primaria destacada que diga "esto es lo que tienes que hacer HOY".

3. **El banner de bienvenida es decorativo** — muestra "X dominadas" pero no dice al usuario qué hacer con esa información.

**Sesión de estudio**

4. **Transición entre tarjetas es abrupta** — las tarjetas simplemente aparecen/desaparecen. Falta una animación de deslizamiento (slide-left on advance) que dé sensación de flujo.

5. **RatingButtons es inconsistente** — si aciertas ves 2 botones (Bien/Fácil), si fallas ves 4 (No sé/Difícil/Bien/Fácil). El cambio visual es confuso. La convención de Anki es mostrar siempre los 4.

6. **Sin feedback emocional en aciertos** — en Duolingo hay un "¡Genial! +10 XP" y una animación verde. Aquí solo aparecen los botones de rating sin celebración.

7. **La barra de progreso muestra "X / Y completadas"** pero Y es el total de la cola, no el total del módulo. Un usuario que filtra por "due" ve "0 / 5" y no sabe si ha progresado globalmente.

8. **Sin indicación de fin de sesión inminente** — el usuario no sabe que le quedan 2 preguntas hasta que llega. Podría haber una señal visual cuando quedan ≤ 3.

**Examen**

9. **Opciones en el examen son austeras** — círculo gris con letra. En Kahoot las opciones tienen colores brillantes (rojo, azul, verde, amarillo) que hacen la selección mucho más rápida visualmente.

10. **La cuadrícula de navegación de preguntas** (los numeritos abajo) es útil pero está al final del scroll — en móvil el usuario tiene que bajar para verla.

11. **El resumen de examen no da contexto** — te dice que sacaste un 72% pero no te dice si eso es bueno, malo, o en qué preguntas fallaste (aunque hay lista, no hay análisis).

**Stats**

12. **El heatmap es solo de actividad** — no hay datos de rendimiento en el tiempo. No se puede ver si el accuracy está mejorando.

13. **Sin gráfico de progreso** — el heatmap muestra cuándo estudiaste pero no cuánto has mejorado.

14. **Los milestones de racha son visuales pero sin celebración** — llegaste a 7 días pero no hubo ningún momento WOW.

**General**

15. **Sin dark mode** — en un contexto de estudio nocturno (que es frecuente), la pantalla blanca cansa.

16. **Sin feedback de "primera vez"** (onboarding) — el usuario nuevo llega al dashboard sin saber por dónde empezar.

17. **El módulo "word-avanzado" tiene 28 simulaciones sin imágenes de solución** — el usuario ve un monitor vacío. Es una experiencia rota que debería comunicarse mejor ("Esta pregunta no tiene solución visual disponible").

---

## 3. Auditoría pedagógica — Método de aprendizaje

### ✅ Lo que está bien

- **SM-2 bien calibrado** — los intervalos son correctos para memorización a largo plazo
- **Filtro de errores** — poder repasar solo las más falladas es muy útil antes del examen
- **Simulación interactiva** — replicar el gesto del examen real (clic en pantalla) activa memoria procedimental, no solo declarativa
- **Mezcla de módulos** — el interleaving (intercalar temas) está demostrado que mejora retención vs estudiar un bloque completo

### ❌ Brechas pedagógicas

1. **Sin explicación del porqué** — cuando una respuesta es incorrecta, la app muestra cuál era la correcta pero no explica por qué. Apps como Quizlet Learn muestran el contexto; Khan Academy da una explicación paso a paso. La memoria se consolida mejor cuando se entiende el razonamiento.

2. **Sin espaciado óptimo de sesión** — la ciencia del aprendizaje recomienda sesiones de 20-30 minutos máximo (efecto de primacía y recencia). La app no guía al usuario sobre duración óptima.

3. **Sin variedad de modalidad de repaso** — siempre es "ver pregunta → seleccionar opción". Quizlet alterna entre: flashcard, opción múltiple, escribir la respuesta, match game. La variedad de formatos mejora la retención (deseable dificultad).

4. **Sin sistema de "no sé vs no recuerdo"** — hay una diferencia entre una pregunta que el usuario nunca aprendió y una que aprendió pero olvidó. El algoritmo SM-2 las trata igual. Anki distingue entre "Again" (nunca aprendido) y "Hard" (olvidado).

5. **Sin revisión post-examen guiada** — tras un examen, la app muestra una lista de preguntas falladas pero el usuario tiene que volver manualmente a estudiarlas. Debería haber un "Repasar lo que fallé ahora" que lleve directamente a una sesión con esas preguntas.

6. **Sin predicción de preparación** — el usuario no sabe si está listo para el examen. Podría calcularse: si tienes X% dominado y el examen requiere un 60% de nota, te faltan N semanas al ritmo actual.

7. **Sin alertas de olvido** — si el usuario no entra 3 días, su progreso SM-2 se degrada pero nadie le avisa. Notificaciones push o email de "Tienes 30 preguntas pendientes" serían muy efectivas.

---

## 4. Lo que hacen las mejores apps — benchmarking

### Duolingo
- **XP diario + racha + ligas** — la gamificación extrinseca funciona para mantener el hábito
- **Corazones (vidas)** — introducen una sensación de riesgo que aumenta la atención
- **Objetivo diario configurable** — el usuario decide cuánto tiempo invertir cada día
- **Animaciones de celebración** — confeti, personaje que baila, sonido de acierto
- **"Perfect lesson"** — bonus por sesión sin errores

### Kahoot
- **Opciones de colores brillantes** — A=rojo, B=azul, C=amarillo, D=verde — selección visual instantánea
- **Countdown visual** — el timer es enorme y dramático, crea urgencia
- **Leaderboard** — la competición social aumenta motivación

### Quizlet
- **Múltiples modos de estudio** para la misma pregunta: flashcard, learn, test, match, gravedad
- **"Learn mode"** — adapta el tipo de pregunta según tu performance (empieza con opción múltiple, pasa a escribir)
- **Términos en progreso** — barra horizontal que va llenándose mientras dominas el set

### Anki
- **Intervalo visible ANTES de valorar** — la app ya lo implementa ✅
- **"Buried cards"** — posponer una carta para mañana sin penalizar el intervalo
- **Estadísticas avanzadas** — gráfico de retención prevista, distribución de intervalos

### Khan Academy
- **Árbol de habilidades** — los conceptos se desbloquean al dominar los anteriores
- **Puntos de energía** — gamificación suave sin presión
- **Hints** — el usuario puede pedir una pista antes de responder (penaliza levemente)

---

## 5. Propuesta de Upgrade — v2.0

### Principio rector
> Pasar de "herramienta de práctica" a "sistema de preparación inteligente con engagement".

### Priorización: MoSCoW

---

### 🔴 MUST — Core de v2.0 (alto impacto, implementación media)

#### M1. Middleware de protección de rutas
```ts
// middleware.ts (en raíz del proyecto)
export function middleware(request) {
  const session = request.cookies.get('chatelac_session');
  if (!session && !request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect('/login');
  }
}
```
Protege todas las rutas en servidor, no en cliente. Una línea de cambio real.

#### M2. Botones de opción con color — Kahoot style
Las 4 opciones con colores fijos: Rojo / Azul / Verde / Naranja. La selección visual es 3× más rápida que leer una letra. Afecta `study/[module]` y `exam`.

```
Opción A → bg-red-500
Opción B → bg-blue-500
Opción C → bg-emerald-500
Opción D → bg-amber-500
(con opacity-50 en las no seleccionadas)
```

#### M3. Acción primaria clara en el Dashboard — "Lo de hoy"
En lugar de mostrar todo a la vez, destacar UN botón grande al inicio:

```
╔══════════════════════════════╗
║  📅 Práctica de hoy          ║
║  47 preguntas pendientes     ║
║  → Empezar (aprox. 15 min)   ║
╚══════════════════════════════╝
```

Si no hay pendientes: mostrar "🎉 ¡Al día! Próxima revisión mañana."

#### M4. Animaciones de transición entre tarjetas
La tarjeta actual sale por la izquierda, la nueva entra por la derecha. Con CSS puro (transform + opacity + transition).

```css
.card-exit { transform: translateX(-40px); opacity: 0; }
.card-enter { transform: translateX(40px); opacity: 0; }
.card-active { transform: translateX(0); opacity: 1; transition: all 0.25s ease; }
```

#### M5. Celebración en acierto
Un flash verde sutil + un pequeño "✓ +1" que sube y desaparece (como +XP en Duolingo). No necesita sonido — solo una animación CSS de 600ms.

#### M6. "Repasar errores del examen" — botón directo post-exam
En el resumen del examen, un botón "📚 Repasar las {N} que fallé ahora" que lanza directamente una sesión SM-2 con solo esas preguntas.

#### M7. Modal de confirmación propio (reemplazar `confirm()`)
Un `<dialog>` o componente inline que reemplace el `window.confirm()` nativo. Estilizado y responsive.

---

### 🟠 SHOULD — Gran valor, más trabajo

#### S1. Sistema de XP y niveles

Cada respuesta correcta suma XP:
- Bien: +10 XP
- Fácil: +15 XP
- Difícil: +5 XP
- Malo: +0 XP
- Racha de 3+: multiplicador ×1.5

Niveles:
```
0–200 XP      Novato
201–500 XP    Aprendiz
501–1000 XP   Candidato
1001–2000 XP  Experto
2000+ XP      Maestro
```

Guardar en BD (columna `xp` y `level` en tabla `users`).
Mostrar en dashboard: barra de nivel + XP actual.

#### S2. Objetivo diario configurable

Setting en perfil: "Quiero estudiar X preguntas al día" (opciones: 10, 20, 30, 50).
En el dashboard, una barra de progreso diario: "Hoy: 14 / 20 ✓".
Al completar el objetivo: animación de celebración.

Guardar en `users.daily_goal`.

#### S3. Modo supervivencia

Nuevo modo de estudio: responder preguntas hasta cometer 3 errores.
- Empieza rápido, se va complicando
- 3 "vidas" representadas con corazones ❤️❤️❤️
- Al perder la última: pantalla de game over con score final y comparación con mejor marca
- Guardar highscore en BD

Proporciona la sensación de riesgo de Duolingo/Kahoot.

#### S4. Radar de módulos (gráfico)

En la página de stats, un gráfico tipo radar/araña que muestre la puntuación en los 4 módulos. Visual instantánea del estado global.

Usar SVG puro (sin librería) — 4 ejes, polígono relleno con el % de dominio de cada módulo.

```
         Access
          100%
           ●
    Excel  ●   ●  Word
    80%    ●●●     75%
           ●
         PowerPoint
          90%
```

#### S5. Explicaciones breves por pregunta

Añadir campo `explanation?: string` al JSON de preguntas. Para las preguntas más importantes, incluir 1-2 frases explicando el porqué de la respuesta correcta.

Mostrar en el feedback post-respuesta, en un bloque colapsable "¿Por qué?".

No necesita estar en todas las preguntas — el campo es opcional. Se puede ir rellenando progresivamente.

#### S6. Predictor de preparación

En el dashboard, bajo los módulos:
```
📊 A tu ritmo actual, estarías listo en ~3 semanas
   (Necesitas 60% para aprobar · Tienes 47% dominado)
```

Cálculo simple:
- Preguntas por sesión media × días hasta examen = dominio esperado
- Si el usuario no ha puesto fecha de examen, mostrar selector

#### S7. Notificaciones de recordatorio (Vercel Cron)

Usar `Vercel Cron Jobs` (gratis en Hobby plan) para enviar un email de recordatorio si el usuario no ha estudiado en 2 días.

```ts
// app/api/cron/reminder/route.ts
// Cron: 0 18 * * * (cada día a las 18:00)
// Consulta users sin study_date en los últimos 2 días
// Envía email con resnet (Resend.com, 3000 emails/mes gratis)
```

---

### 🟡 COULD — Bonus, menor impacto o más complejo

#### C1. Dark mode
Toggle en el header. Guardar preferencia en `localStorage`. Usar variables CSS para el tema.

#### C2. "5 minutos ahora" — sesión express
Botón en el dashboard que lanza exactamente 10 preguntas due, sin pantalla de configuración. Para los días que no hay tiempo.

#### C3. Modo match / memoria (Quizlet-style)
Un juego donde se presentan 8 tarjetas boca abajo (pregunta y respuesta mezcladas) y el usuario las empareja. Puro JS, sin BD. Muy entretenido para repasar vocabulario tipo Access.

#### C4. Tabla de historial de exámenes
Guardar en BD cada examen completado: fecha, módulo, score, tiempo. Mostrar en stats como tabla "Mis simulacros".

#### C5. Importar/exportar progreso (backup JSON)
Botón en settings para descargar el progreso como JSON y re-importarlo. Útil si el usuario quiere cambiar de cuenta.

#### C6. Modo sin conexión (PWA)
Añadir `manifest.json` y un service worker básico que cachée los JSONs de preguntas y las imágenes de solución. El usuario puede estudiar sin internet (ya funciona parcialmente con el caché de localStorage).

---

## 6. Roadmap sugerido — v2.0 en fases

### Fase 1 — Fundamentos (1-2 sesiones de trabajo)
- M1: Middleware de protección de rutas
- M4: Animaciones de transición entre tarjetas
- M7: Modal de confirmación propio
- M2: Botones con color (Kahoot style)
- Fix: `Promise.all` en loadStats del dashboard

### Fase 2 — Engagement (2-3 sesiones)
- M3: Acción primaria "Lo de hoy" en dashboard
- M5: Celebración en acierto
- M6: "Repasar errores" tras examen
- S2: Objetivo diario con barra de progreso
- S1: Sistema XP básico (sin ligas)

### Fase 3 — Pedagogía (2-3 sesiones)
- S3: Modo supervivencia con vidas
- S5: Explicaciones por pregunta (al menos para las top-20 más falladas)
- S6: Predictor de preparación
- S4: Radar de módulos en stats

### Fase 4 — Polish (1-2 sesiones)
- C1: Dark mode
- C2: Sesión express "5 minutos"
- C5: Export/import de progreso
- C4: Historial de exámenes en BD

---

## 7. Resumen ejecutivo

| Categoría | Estado actual | v2.0 |
|-----------|--------------|-------|
| Seguridad | Client-side auth check | Middleware servidor |
| Performance | Sequential module load | Promise.all paralelo |
| UX decisión principal | 5 acciones posibles en dashboard | 1 acción primaria clara |
| Feedback de acierto | Aparecen botones de rating | Flash + micro-celebración |
| Opciones visuales | Círculo gris + letra | Colores Kahoot (A/B/C/D) |
| Gamificación | Racha + estadísticas | XP + niveles + objetivos diarios |
| Pedagogía | SM-2 + feedback básico | SM-2 + explicaciones + modo supervivencia |
| Analytics | Heatmap + contadores | Radar + historial + predictor |
| Modos de estudio | Due/New/All/Errors | + Supervivencia + Express + Match |

**Impacto esperado del upgrade:**
- Sesiones más largas por mayor engagement (celebraciones, XP)
- Mayor retorno diario por objetivo diario visible y notificaciones
- Mejor retención por variedad de modos y explicaciones
- Percepción de progreso más clara por radar y predictor
