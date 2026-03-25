# Chatelac Quiz — Documentación y Pauta de Desarrollo

> Documento de referencia para Claude y para Andoni. Recoge el estado actual completo de la app, la arquitectura, las decisiones técnicas, las claves y cómo operar el sistema.
>
> **Última actualización:** 21-03-2026 (v3.0)

---

## ¿Qué es esta app?

Plataforma de práctica para el examen de **IT Txartelak de Osakidetza** (certificación de ofimática). Permite estudiar los 4 módulos de Office (Access, Excel, PowerPoint, Word) con dos modos:

- **Test** — preguntas de opción múltiple con penalización tipo oposición (−1/3)
- **Simulación** — replicación interactiva click-through de los Flash clips originales del examen

El motor de aprendizaje usa **SM-2 (Spaced Repetition)**, el mismo algoritmo que Anki, para mostrar las preguntas en el momento óptimo de repaso.

---

## Stack técnico

| Capa | Tecnología |
|------|------------|
| Framework | Next.js 16.2.0 — App Router |
| Runtime | React 19.2.4 |
| Lenguaje | TypeScript 5 |
| Estilos | Tailwind CSS 4 |
| Base de datos | Neon (Postgres serverless) — Frankfurt |
| Auth | JWT firmado con jose + cookie HTTP-only |
| Passwords | bcryptjs (coste 12) |
| Deploy | Vercel — rama `main` → auto-deploy |
| Imágenes CDN | Vercel static + `sosit-txartela.net` |

---

## Estructura de archivos

```
chatelac-quiz/
│
├── public/
│   ├── data/                        # JSONs de preguntas (estáticos, cacheados)
│   │   ├── access-basico.json
│   │   ├── excel-avanzado.json
│   │   ├── powerpoint.json
│   │   └── word-avanzado.json
│   ├── images/
│   │   ├── access-basico/
│   │   │   ├── Imagenes/ImagenesAccess/   # Imágenes de enunciado
│   │   │   └── solutions/                 # PNGs de pasos de solución
│   │   ├── excel-avanzado/
│   │   ├── powerpoint/
│   │   └── word-avanzado/
│   ├── manifest.json                # PWA manifest (v3.0)
│   ├── icon-192.png                 # PWA icon — generado con Node.js puro
│   └── icon-512.png                 # PWA icon — generado con Node.js puro
│
├── scripts/
│   └── create-user.mjs              # CLI para dar de alta usuarios en BD
│
├── src/
│   ├── app/
│   │   ├── layout.tsx               # Root layout, anti-FOUC theme script, PWA meta
│   │   ├── page.tsx                 # Redirect → /dashboard o /login
│   │   ├── globals.css              # Variables CSS corporativas + dark mode overrides
│   │   ├── login/page.tsx           # Formulario de login (client)
│   │   ├── dashboard/page.tsx       # Panel principal — quests, goal, shields, dark toggle
│   │   ├── study/[module]/page.tsx  # Estudio SM-2 — ComboBanner, logSession, bookmarks
│   │   ├── exam/page.tsx            # Simulacro cronometrado — share results
│   │   ├── stats/page.tsx           # Estadísticas — sesiones, recomendaciones, heatmap
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── login/route.ts
│   │       │   ├── logout/route.ts
│   │       │   └── me/route.ts
│   │       ├── progress/
│   │       │   ├── route.ts
│   │       │   └── touch-day/route.ts  # POST — acepta { date? } para streak shield
│   │       ├── user/
│   │       │   ├── xp/route.ts         # GET devuelve { xp, dailyGoal }; POST guarda XP
│   │       │   ├── goal/route.ts       # POST — actualiza daily_goal en BD
│   │       │   └── bookmarks/route.ts  # GET/POST — sincroniza bookmarks con BD
│   │       └── admin/
│   │           └── create-user/route.ts
│   │
│   ├── components/
│   │   ├── AppIcons.tsx             # Biblioteca SVG inline — única fuente de iconos UI
│   │   ├── BottomNav.tsx            # Barra navegación fija inferior
│   │   ├── XPBar.tsx                # Barra de XP con nivel y progreso
│   │   ├── CelebrationFlash.tsx     # Flash verde/rojo en respuesta correcta/incorrecta
│   │   ├── LevelUpModal.tsx         # Overlay fullscreen con confetti al subir de nivel
│   │   ├── ComboBanner.tsx          # Banner animado en rachas ×1.5 / ×2 / ×3 XP
│   │   └── ConfirmModal.tsx         # Modal genérico de confirmación
│   │
│   └── lib/
│       ├── db.ts                    # Singleton cliente Postgres (neon)
│       ├── session.ts               # JWT encrypt/decrypt + cookies (server-only)
│       ├── auth.ts                  # Cliente auth (llama a API routes)
│       ├── progress.ts              # SM-2 state + sync con BD en background
│       ├── spaced-repetition.ts     # Algoritmo SM-2 puro
│       ├── questions.ts             # Carga y caché de preguntas
│       ├── modules.ts               # Metadata de módulos
│       ├── xp.ts                    # Sistema XP: niveles, combo, objetivo diario, sync BD
│       ├── sound.ts                 # Web Audio API — sonidos procedurales sin ficheros
│       ├── bookmarks.ts             # Favoritas: localStorage + sync BD (fire-and-forget)
│       ├── quests.ts                # Misiones diarias — 3 quests, reset a medianoche
│       ├── session-history.ts       # Historial de sesiones — ring buffer de 30 en localStorage
│       ├── streak-shield.ts         # Escudo de racha — 1/semana auto, max 2, ISO week
│       └── theme.ts                 # Dark mode — aplica data-theme en <html>, persiste en localStorage
│
├── .env.local                       # Variables de entorno locales (no en git)
├── next.config.ts
├── vercel.json
├── PAUTA.md                         # Este documento
└── AGENTS.md                        # Instrucciones para agentes IA
```

---

## Pauta de diseño e iconografía

### Regla fundamental — Sin emojis en la UI funcional

Todos los iconos de interfaz (botones, badges, navegación, indicadores de estado) usan **SVG inline** a través de `AppIcons.tsx`. Nunca emojis Unicode para elementos funcionales.

Los emojis **sí** están permitidos únicamente en:
- Contenido de datos de juego (emojis de quests: 🎯, 🏋️...)
- Texto celebratorio en resultados (🏆, ⭐, 💪) — contexto emocional explícito
- Labels de texto plano en botones de modal (p.ej. "🛡️ Usar escudo" como copy)

### Catálogo de iconos SVG (`AppIcons.tsx`)

**Iconos de módulo** (colored tiles 40×40):
`AccessIcon`, `ExcelIcon`, `WordIcon`, `PowerPointIcon`, `MixIcon`, `ModuleIcon` (dispatcher)

**Iconos UI** (stroke monochrome, `size` configurable):
| Función | Export |
|---------|--------|
| Reloj | `IconClock` |
| Rayo/XP | `IconBolt` |
| Barajar | `IconShuffle` |
| Diana | `IconBullseye` |
| Ratón | `IconMouse` |
| Checkbox | `IconCheckSquare` |
| Capas | `IconLayers` |
| Gráfica | `IconBarChart` |
| Llama/Racha | `IconFlame` |
| Zoom | `IconZoomIn` |
| Monitor | `IconMonitor` |
| Cursor | `IconCursor` |
| Graduación | `IconGraduationCap` |
| Trofeo | `IconTrophy`, `IconTrophySm` |
| Estrella | `IconStar`, `IconStarSm` |
| Destello | `IconSparkle` |
| Planta | `IconSeedling` |
| Check círculo | `IconCheckCircle` |
| X círculo | `IconXCircle` |
| Flecha der. | `IconArrowRight` |
| Tendencia | `IconTrendingUp` |
| Imagen | `IconImage` |
| X mark | `IconX` |
| Escudo | `IconShield` |
| Sol | `IconSun` |
| Luna | `IconMoon` |
| Lápiz/Editar | `IconPencil` |
| Compartir | `IconShare` |

### Paleta corporativa

```css
--osk:       #282182   /* Azul Osakidetza PANTONE 273 — color primario */
--osk-dark:  #1e1965   /* Hover/pressed */
--osk-pale:  #e8e7f7   /* Fondo suave tintado */
--background: #f4f4fb  /* Fondo página */
--surface:    #ffffff  /* Superficie card */
--border:     #e4e3f0  /* Borde con tinte */
```

Colores Kahoot para opciones múltiples: A=`#e21b3c` (rojo) · B=`#1368ce` (azul) · C=`#26890c` (verde) · D=`#e6820e` (naranja)

---

## Módulos de preguntas

| ID | Nombre completo | Test (C/I) | Simulación (B) | Total |
|----|-----------------|-----------|----------------|-------|
| `access-basico` | Access 2000 Básico | 60 | 77 | 137 |
| `excel-avanzado` | Excel 2010 Avanzado | 110 | 18 | 128 |
| `powerpoint` | PowerPoint XP | 197 | 103 | 300 |
| `word-avanzado` | Word 2010 Avanzado | 189 | 55 | 244 |
| `mezcla` | Todos los módulos | 556 | 253 | 809 |

El módulo `mezcla` es **virtual** — se genera combinando los 4 anteriores dinámicamente. No tiene JSON propio.

### Tipos de pregunta

- **C** — Test estándar, opción múltiple, sin imagen
- **I** — Test con imagen en el enunciado
- **B** — Simulación interactiva (click-through con imágenes de solución)

---

## Arquitectura de base de datos — Neon Postgres

**Proyecto:** `chatelac-quiz`
**Región:** AWS Europe Central 1 (Frankfurt)
**Plan:** Free (0.5 GB, escala a cero cuando inactiva)
**Consola:** https://console.neon.tech/app/projects/polished-boat-04661592

### Esquema completo (v3.0)

```sql
-- Usuarios (solo los da de alta Andoni manualmente)
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,          -- bcrypt coste 12
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  -- v3.0 additions:
  xp            INTEGER NOT NULL DEFAULT 0,
  daily_goal    INTEGER NOT NULL DEFAULT 20,
  bookmarks     TEXT NOT NULL DEFAULT '[]'  -- JSON array de question IDs
);

-- Estado SM-2 por usuario y pregunta
CREATE TABLE card_states (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id       TEXT NOT NULL,           -- ej: "access-basico_12"
  interval_days REAL DEFAULT 1,
  ease_factor   REAL DEFAULT 2.5,
  repetitions   INTEGER DEFAULT 0,
  next_review   BIGINT DEFAULT 0,        -- timestamp ms
  last_review   BIGINT DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  total_wrong   INTEGER DEFAULT 0,
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, card_id)
);

-- Días de estudio (para racha, heatmap y escudo de racha)
-- touch-day/route.ts acepta { date? } opcional para restaurar con escudo
CREATE TABLE study_dates (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  study_date  DATE NOT NULL,
  UNIQUE(user_id, study_date)
);

-- Sesiones de auth (reservada, no usada — auth vía JWT cookie)
CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);
```

**Columnas añadidas en v3.0** (migración aplicada con `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`):
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS xp INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_goal INTEGER NOT NULL DEFAULT 20;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bookmarks TEXT NOT NULL DEFAULT '[]';
```

---

## Sistema XP y niveles (`src/lib/xp.ts`)

### XP por respuesta

| Calidad | Label | XP base |
|---------|-------|---------|
| 0 | No sé | 2 |
| 1 | Difícil | 5 |
| 2 | Bien | 10 |
| 3 | Fácil | 15 |
| Examen correcto | — | 8 |
| Examen incorrecto | — | 1 |

### Combo multiplier (rachas consecutivas en sesión)

| Racha | Multiplicador | Label |
|-------|---------------|-------|
| ≥ 3 | ×1.5 | ComboBanner rojo |
| ≥ 6 | ×2 | ComboBanner naranja |
| ≥ 10 | ×3 | ComboBanner morado |

XP aplicado: `Math.round(baseXP × multiplicador)`

### Niveles

| Nivel | Nombre | XP mínimo | XP máximo |
|-------|--------|-----------|-----------|
| 1 | Novato 🌱 | 0 | 100 |
| 2 | Aprendiz 📘 | 100 | 300 |
| 3 | Practicante ⚡ | 300 | 600 |
| 4 | Competente 🔥 | 600 | 1000 |
| 5 | Experto 🎯 | 1000 | 1500 |
| 6 | Maestro 🏆 | 1500 | ∞ |

Al subir de nivel → `LevelUpModal` (fullscreen, 24 partículas CSS confetti, 4s auto-cierre).

### Sincronización XP

```
Responder pregunta → addLocalXP(xp) → persistXP(total) → POST /api/user/xp
Dashboard mount → syncXPFromDB() → GET /api/user/xp → { xp, dailyGoal }
```

### Objetivo diario

- Almacenado en `localStorage['chatelac_daily_goal']` y en `users.daily_goal` BD
- El usuario puede cambiarlo con el selector inline en el dashboard (presets: 10-50)
- `POST /api/user/goal { dailyGoal: N }` → persiste en BD
- `incrementTodayAnswerCount()` → incrementa contador en `localStorage['chatelac_goal_progress']` con fecha

---

## Sistema de misiones (`src/lib/quests.ts`)

3 misiones diarias fijas, se resetean a medianoche (comprobación por fecha ISO en localStorage):

| ID | Emoji | Objetivo | XP recompensa |
|----|-------|----------|---------------|
| `daily-answers` | 🎯 | Responder 20 preguntas hoy | 30 XP |
| `daily-streak` | 🔥 | Alcanzar racha de 5 aciertos seguidos | 50 XP |
| `daily-errors` | 💪 | Corregir 3 errores del histórico | 40 XP |

Estado por misión: `{ progress, target, completed, rewardClaimed }` en `localStorage['chatelac_quests']`.

Funciones clave: `getQuests()`, `claimQuestReward(questId)`, `notifyAnswered(count)`, `notifyStreak(streak)`, `notifyErrorFixed()`.

---

## Sistema de favoritas/bookmarks (`src/lib/bookmarks.ts`)

- **localStorage como caché inmediata**, `users.bookmarks` (JSON array) como fuente de verdad en BD
- `toggleBookmark(id)` → actualiza localStorage + `persistBookmarks()` (fire-and-forget POST)
- `syncBookmarksFromDB()` → GET `/api/user/bookmarks` → DB gana sobre localStorage
- Se llama `syncBookmarksFromDB()` en mount de dashboard y study page
- Modo de estudio "Mis favoritas" filtra preguntas por `getBookmarkedIds()`

---

## Historial de sesiones (`src/lib/session-history.ts`)

Ring buffer de las últimas 30 sesiones en `localStorage['chatelac_sessions']`.

```ts
interface SessionEntry {
  id: string;        // uuid corto
  date: string;      // ISO "2026-03-21"
  ts: number;        // timestamp
  moduleId: string;
  moduleName: string;
  mode: string;      // 'due' | 'new' | 'all' | 'errors' | 'bookmarks'
  correct: number;
  wrong: number;
  total: number;
  xp: number;
  maxStreak: number;
  durationSec: number;
}
```

Se registra automáticamente al terminar cada sesión de estudio (`useEffect([mode])` en study page). Se consume en Stats → sección "Últimas sesiones".

---

## Escudo de racha (`src/lib/streak-shield.ts`)

- Se otorga **1 escudo por semana** (ISO week "YYYY-WXX") automáticamente al entrar al dashboard
- Máximo 2 escudos acumulados
- Al usar un escudo: se añade ayer a `studyDates` en localStorage y se hace POST `/api/progress/touch-day { date: "ayer" }` para persistir en BD
- La detección de racha rota usa `chatelac_had_streak` y `chatelac_streak_broken_date` en localStorage
- El modal de racha rota se muestra solo una vez por día

---

## ComboBanner (`src/components/ComboBanner.tsx`)

Banner fullscreen que aparece al alcanzar multiplicadores de combo:

| Racha | Config |
|-------|--------|
| 3 | Rojo — "¡EN RACHA! ×1.5 XP" |
| 6 | Naranja — "¡IMPARABLE! ×2 XP" |
| 10 | Morado — "¡MODO DIOS! ×3 XP" |

Se auto-descarta tras 2.2s. Animación spring slide-from-top. Se activa en `submitAnswer` y `rateAndNext` cuando `newStreak === 3 || 6 || 10`.

---

## Dark mode (`src/lib/theme.ts`)

- Se aplica como `document.documentElement.dataset.theme = 'dark'`
- Persiste en `localStorage['chatelac_theme']`
- Anti-FOUC: inline script en `layout.tsx` antes del primer render aplica el tema guardado
- CSS overrides en `globals.css` con `html[data-theme='dark'] .bg-white` etc. (solo clases Tailwind — los `style={}` inline no se ven afectados)
- Toggle: botón `IconMoon`/`IconSun` en el header del dashboard

---

## PWA

- `public/manifest.json` — `display: standalone`, `theme_color: #282182`
- `public/icon-192.png` y `public/icon-512.png` — generados con Node.js puro (`zlib.deflateSync` + PNG manual, sin deps externas)
- `layout.tsx` incluye `<link rel="manifest">` + apple-mobile-web-app meta tags
- `export const viewport: Viewport = { themeColor: '#282182' }` en layout.tsx

---

## Arquitectura de autenticación

### Flujo de login

```
Usuario → POST /api/auth/login { username, password }
  → Busca user en BD por username
  → bcrypt.compare(password, hash)
  → createSession(userId, username)  ← firma JWT con jose (HS256, 7 días)
  → Set-Cookie: chatelac_session=<JWT>; HttpOnly; Secure; SameSite=lax
  → { ok: true, username }
```

### Protección de rutas API

Todas las rutas de `/api/progress/*`, `/api/user/*` y `/api/admin/*` llaman a `getSession()` que lee y verifica el JWT de la cookie. Si no hay sesión válida → 401.

### Estado en el cliente

- `localStorage['chatelac_session']` — solo guarda `{ username, loginTime }` como caché de UI
- `isAuthenticated()` — comprueba si existe el item en localStorage (rápido, sin red)

---

## Arquitectura de progreso — Sync BD + localStorage

### Estrategia: localStorage como caché, BD como fuente de verdad

**Al hacer login / entrar al dashboard:**
```
syncFromDB()       → GET /api/progress → { cards, wrongCounts, studyDates } → recalcula streak
syncXPFromDB()     → GET /api/user/xp  → { xp, dailyGoal }
syncBookmarksFromDB() → GET /api/user/bookmarks → { bookmarks: string[] }
```

**Al responder una pregunta:**
```
recordAnswer(questionId, quality)
  → Actualiza localStorage inmediatamente
  → fire-and-forget: POST /api/progress { cardId, cardState }
addLocalXP(xp) → persistXP(total)
  → fire-and-forget: POST /api/user/xp { xp: total }
incrementTodayAnswerCount()
  → solo localStorage
```

**Al activar un escudo:**
```
useShield()
  → localStorage['chatelac_shields'] - 1
  → Añade ayer a localStorage progress.studyDates
  → fire-and-forget: POST /api/progress/touch-day { date: "ayer" }
```

---

## API Routes (completo v3.0)

### Auth

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/login` | Login con username/password |
| POST | `/api/auth/logout` | Cierra la sesión |
| GET | `/api/auth/me` | Devuelve el usuario actual |

### Progreso

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/progress` | Carga todo el progreso del usuario desde BD |
| POST | `/api/progress` | Guarda el estado de una carta |
| POST | `/api/progress/touch-day` | Registra un día de estudio. Body: `{ date?: "YYYY-MM-DD" }` (defecto = hoy) |

### Usuario (v3.0)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/user/xp` | Devuelve `{ xp, dailyGoal }` del usuario |
| POST | `/api/user/xp` | Actualiza `users.xp`. Body: `{ xp: number }` |
| POST | `/api/user/goal` | Actualiza `users.daily_goal`. Body: `{ dailyGoal: number }` |
| GET | `/api/user/bookmarks` | Devuelve `{ bookmarks: string[] }` |
| POST | `/api/user/bookmarks` | Actualiza `users.bookmarks`. Body: `{ bookmarks: string[] }` |

### Admin

| Método | Ruta | Header | Descripción |
|--------|------|--------|-------------|
| POST | `/api/admin/create-user` | `Authorization: Bearer <ADMIN_SECRET>` | Crea usuario nuevo |

---

## Variables de entorno

### `.env.local` (local, no en git)

```env
DATABASE_URL=postgresql://neondb_owner:<password>@ep-polished-leaf-alx496yj-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
ADMIN_SECRET=chatelac-admin-2026
SESSION_SECRET=chatelac-session-secret-2026
```

### Vercel (ya configuradas en producción)

Las mismas 3 variables están guardadas en Vercel → Project Settings → Environment Variables → All Environments.

---

## Motor SM-2 (Spaced Repetition)

Implementado en `src/lib/spaced-repetition.ts`.

### Calidades de respuesta

| Valor | Label | Efecto |
|-------|-------|--------|
| 0 | No sé | Reset: interval=1d, ease−0.3, repetitions=0 |
| 1 | Difícil | Ralentiza: interval×1.2, ease−0.15 |
| 2 | Bien | Avanza SM-2: 1d → 3d → interval×ease |
| 3 | Fácil | Acelera: interval×ease×1.3, ease+0.1 |

### Restricciones
- `easeFactor` mínimo: 1.3, máximo: 3.0
- Una pregunta se considera **dominada** cuando `interval >= 21` días

### Filtros de estudio

| Filtro | Lógica |
|--------|--------|
| `due` | `now >= nextReview` o nunca vistas |
| `new` | `lastReview === 0` |
| `all` | Todas las preguntas del módulo |
| `errors` | Las N más falladas (`wrongCounts` decreciente) |
| `bookmarks` | IDs en `getBookmarkedIds()` (cross-módulo) |

---

## Modo Simulación — Flow interactivo (tipo B)

1. **Fase interactiva** — Se muestra el estado inicial. El usuario hace clic.
2. **Ripple** — Animación circular en el punto de clic, 480ms.
3. **Avance automático** — Siguiente imagen hasta el último paso.
4. **Modo revisión** — Navegador ←/→ y valoración 0-3.
5. **Lightbox** — Tap sobre imagen para ampliar.
6. **Skip** — Botón o tecla Espacio para saltar a revisión.
7. **Teclado** — Espacio = saltar, 1-4 = valorar (0-3).

---

## Modo Examen (Simulacro)

- Solo preguntas tipo C e I (no simulaciones)
- Configuración: módulo, número de preguntas, tiempo límite (opcional)
- Penalización: −1/3 por respuesta incorrecta
- Auto-submit cuando se acaba el tiempo
- Fase de revisión con navegador
- Registra SM-2 + XP + quests
- Botón "Compartir resultado" → Web Share API (fallback: clipboard)

---

## Stats

- **Heatmap 10 semanas** — intensidad por actividad diaria
- **Racha** — días consecutivos, milestones a 3/7/14/30/60/100 días
- **Recomendación del día** — analiza módulo con más pendientes, menor precisión y menor dominio
- **Últimas sesiones** — las 8 últimas desde `session-history.ts`: fecha, modo, aciertos, XP
- **Top-10 errores** — preguntas más falladas globalmente
- **Desglose por módulo** — precisión, dominadas, pendientes

---

## localStorage — Keys completo

| Key | Contenido |
|-----|-----------|
| `chatelac_session` | `{ username, loginTime }` — caché de auth UI |
| `chatelac_progress` | Objeto Progress completo — SM-2 state, streaks, studyDates |
| `chatelac_xp` | Número total de XP |
| `chatelac_daily_goal` | Objetivo diario (número) |
| `chatelac_goal_progress` | `{ date, count }` — progreso hoy |
| `chatelac_bookmarks` | JSON array de question IDs favoritos |
| `chatelac_quests` | `{ date, quests: Quest[] }` — estado misiones del día |
| `chatelac_sessions` | Array SessionEntry[] — últimas 30 sesiones (ring buffer) |
| `chatelac_shields` | Número de escudos disponibles |
| `chatelac_shield_week` | ISO week "YYYY-WXX" del último escudo otorgado |
| `chatelac_had_streak` | `"yes"` si el usuario tuvo racha alguna vez |
| `chatelac_streak_broken_date` | Fecha ISO del último modal de racha rota |
| `chatelac_theme` | `"light"` o `"dark"` |

---

## Gestión de usuarios

### Dar de alta un usuario nuevo

**Opción A — Script CLI:**
```bash
node scripts/create-user.mjs NombreUsuario password
```

**Opción B — curl contra producción:**
```bash
curl -X POST https://chatelac-quiz.vercel.app/api/admin/create-user \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer chatelac-admin-2026" \
  -d '{"username": "Maria", "password": "su-password"}'
```

### Usuarios actuales en BD

| ID | Username | Desde |
|----|----------|-------|
| 1 | Ander | 21-03-2026 |

---

## Cómo ejecutar

```bash
npm run dev        # http://localhost:3000
npx tsc --noEmit   # type-check sin compilar
npm run build      # build de producción
```

### Deploy

Push a `main` → Vercel detecta y despliega automáticamente.

```bash
git push origin main
```

---

## Credenciales y accesos

| Servicio | URL | Credencial |
|----------|-----|------------|
| App (producción) | https://chatelac-quiz.vercel.app | usuarios en BD |
| Vercel | https://vercel.com/andonis-projects-ecdfe47a/chatelac-quiz | cuenta Andoni |
| Neon (BD) | https://console.neon.tech | uriasaiz@gmail.com |
| GitHub repo | https://github.com/andoniuriasaiz/chatelac-quiz | cuenta Andoni |
| sosit-txartela.net | (fuente original) | `kuxkuxin` / `Raquel1504` |

---

## Auditoría técnica — Estado a 21-03-2026 (v3.0)

### ✅ Funciona y está probado

- Login/logout con cookie HTTP-only y JWT firmado
- Registro y sync de progreso SM-2 en Neon BD
- Días de estudio registrados en BD + touch-day con fecha opcional (escudo)
- XP con combo multiplier (×1.5 / ×2 / ×3), persistido en BD
- Sistema de niveles 1-6 con LevelUpModal
- ComboBanner animado en milestones de racha
- Misiones diarias con reclamación de XP
- Objetivo diario ajustable con selector inline, persistido en BD
- Bookmarks (favoritas) — localStorage + BD sync fire-and-forget
- Historial de sesiones — ring buffer 30 entradas en localStorage
- Escudo de racha — 1/semana auto, max 2, restaura streak en BD
- Modal de racha rota con oferta de escudo
- Modo "Mis favoritas" en estudio
- Web Share API en resultados de examen (fallback clipboard)
- Dark mode con anti-FOUC script, toggle con IconSun/IconMoon SVG
- PWA manifest + icons (192/512)
- Iconografía: 100% SVG inline en AppIcons.tsx, sin emojis en UI funcional
- Stats: recomendaciones + últimas sesiones + heatmap + top errores
- TypeScript limpio (`tsc --noEmit` sin errores)
- Build de producción limpio (17 rutas, 0 errores)

### ⚠️ Pendiente / conocido

- **word-avanzado:** solo 27 de 55 preguntas B tienen imágenes de solución
- **Dark mode parcial:** solo afecta clases Tailwind. Los `style={}` inline con hex no responden (banners, módulos, headers azules permanecen en light)
- **Racha offline:** `touch-day` falla silenciosamente sin conexión
- **Sincronización multi-dispositivo parcial:** merge de estados no implementado
- **Sin panel admin web** para ver usuarios y estadísticas agregadas
- **Sin export/import de progreso** (backup localStorage)
- **Sin recuperación de contraseña** — solo el admin puede cambiar passwords

### 🔒 Seguridad

- Passwords hasheados con bcrypt coste 12
- Sesión en cookie `HttpOnly; Secure; SameSite=lax`
- JWT firmado con `SESSION_SECRET` (HS256)
- Ruta admin protegida por `ADMIN_SECRET`
- `DATABASE_URL` solo en servidor

---

## Decisiones técnicas

**¿Por qué localStorage como caché y no fetch en cada página?**
La app es mayormente offline-capable. El localStorage es instantáneo. La BD se consulta una vez al login.

**¿Por qué fire-and-forget para XP, bookmarks y goal?**
La UI no debe esperar confirmación de red para responder. Si falla la red, en el siguiente login se sincroniza desde BD (que es la fuente de verdad).

**¿Por qué ISO week para el escudo de racha?**
Evita depender de fechas absolutas y es agnóstico al día de inicio de semana. `getISOWeek()` da una cadena "YYYY-WXX" estable.

**¿Por qué SVG inline y no icon library (Lucide, HeroIcons)?**
Control total sobre tamaños, strokeWidth y colores. Sin dependencia externa que pueda cambiar. Tree-shaking perfecto.

**¿Por qué Web Audio API procedural para sonidos?**
Sin ficheros de audio externos. Los sonidos se generan en tiempo real con osciladores y filtros. Funciona offline y es instantáneo.

**¿Por qué `key={displaySrc}` en contenedor de imagen de simulación?**
`position: absolute` + `onError` imperativo podían dejar el DOM en estado inconsistente. Con `key` se desmonta/remonta al cambiar el src.

**¿Por qué el anti-FOUC script en layout.tsx?**
El `data-theme` debe aplicarse antes de que React hidrate para evitar el flash de modo claro. Un `<script>` síncrono en `<head>` lee localStorage y aplica el atributo antes de que el CSS tenga efecto.

---

## Fixes aplicados históricamente

- **Bug imágenes de solución no se mostraban** → `key={displaySrc}` en contenedor
- **Simulación v1 → v2** → Flow pasivo → click-through interactivo
- **Access Q73, Q110 y otras** → Respuestas corregidas según foro Sosit-txartela.net
- **Penalización examen** → Sistema −1/3 para opción múltiple con respuesta única
- **`themeColor` en metadata** → Movido a `export const viewport: Viewport` (Next.js 16)
- **`setDailyGoal` naming conflict** → Aliasado como `saveDailyGoal` en dashboard import
- **touch-day sin body** → Actualizado a `NextRequest` para aceptar `{ date? }` opcional
