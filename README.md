# Osakidetza OPE 2026 - Admin/Auxiliary Quiz App

Aplicación de estudio para las OPE 2026 de Osakidetza (Administrativo y Auxiliar Administrativo).

## Características principales

- **Modo de Rol Dual**: Alterna entre Administrativo y Auxiliar Administrativo.
- **Filtrado Inteligente**: Temario común y específico según el rol seleccionado.
- **Modo Invitado (Guest Mode)**: Acceso local funcional incluso sin conexión a base de datos.
- **Dashboard de Administrador**: Seguimiento de progreso, XP y estadísticas.
- **PWA Ready**: Instalable en dispositivos móviles para estudio offline.

## Configuración Inicial

1. Instala las dependencias:
   ```bash
   npm install
   ```

2. Configura las variables de entorno en `.env.local` (ver ejemplo en el archivo).

3. Ejecuta el servidor de desarrollo:
   ```bash
   npm run dev
   ```

## Migración de Base de Datos

Para inicializar las tablas en el nuevo schema `osakidetza`:

1. Asegúrate de que `DATABASE_URL` y `ADMIN_SECRET` estén configurados.
2. Realiza una petición POST al endpoint de migración:

   ```bash
   curl -X POST http://localhost:3000/api/admin/migrate \
        -H "Authorization: Bearer TU_ADMIN_SECRET"
   ```

## Despliegue en Vercel

1. Conecta este repositorio a Vercel.
2. Configura las variables de entorno (`DATABASE_URL`, `ADMIN_SECRET`, `SESSION_SECRET`) en el panel de Vercel.
3. El despliegue será automático.
