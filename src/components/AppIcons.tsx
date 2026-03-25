'use client';

// ─────────────────────────────────────────────────────────────────────────────
//  AppIcons.tsx — Unified SVG icon library for Osakidetza OPEk
//
//  ● Module icons  — colored Microsoft Office–style tiles (40×40)
//  ● UI icons      — 24×24 monochrome stroke icons (1.5–1.8px weight)
// ─────────────────────────────────────────────────────────────────────────────

type IconProps = { size?: number; className?: string };

// ═══════════════════════════════════════════════════════════════════════════
//  MODULE ICONS — colored app tiles (official Microsoft Office colour palette)
// ═══════════════════════════════════════════════════════════════════════════

/** Access 2000 — burgundy tile, stylised A letterform */
export function AccessIcon({ size = 40 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect width="40" height="40" rx="9" fill="#a4262c" />
      <path
        d="M13 28L20 12L27 28M16.2 23.5H23.8"
        stroke="white" strokeWidth="2.4"
        strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

/** Excel 2010 — green tile, 2×2 cell grid */
export function ExcelIcon({ size = 40 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect width="40" height="40" rx="9" fill="#217346" />
      <rect x="11"   y="14" width="7.5" height="5.5" rx="1.2" fill="white" fillOpacity="0.88" />
      <rect x="21.5" y="14" width="7.5" height="5.5" rx="1.2" fill="white" fillOpacity="0.88" />
      <rect x="11"   y="21.5" width="7.5" height="5.5" rx="1.2" fill="white" fillOpacity="0.88" />
      <rect x="21.5" y="21.5" width="7.5" height="5.5" rx="1.2" fill="white" fillOpacity="0.88" />
    </svg>
  );
}

/** Word 2010 — blue tile, W letterform */
export function WordIcon({ size = 40 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect width="40" height="40" rx="9" fill="#2b579a" />
      <path
        d="M10 14L15 28L20 19L25 28L30 14"
        stroke="white" strokeWidth="2.4"
        strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

/** PowerPoint XP — orange tile, slide silhouette */
export function PowerPointIcon({ size = 40 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect width="40" height="40" rx="9" fill="#b7472a" />
      <rect x="9" y="11" width="22" height="14" rx="2" stroke="white" strokeWidth="2" fill="none" />
      <line x1="20" y1="25" x2="20" y2="30" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <line x1="14" y1="30" x2="26" y2="30" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Mezcla / All modules — Osakidetza blue tile, 2×2 mixed grid */
export function MixIcon({ size = 40 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect width="40" height="40" rx="9" fill="#282182" />
      <rect x="10" y="10" width="8" height="8" rx="2" fill="white" fillOpacity="0.92" />
      <rect x="22" y="10" width="8" height="8" rx="2" fill="white" fillOpacity="0.52" />
      <rect x="10" y="22" width="8" height="8" rx="2" fill="white" fillOpacity="0.52" />
      <rect x="22" y="22" width="8" height="8" rx="2" fill="white" fillOpacity="0.92" />
    </svg>
  );
}

/** Renders the correct module tile by module id */
export function ModuleIcon({ id, size = 40 }: { id: string; size?: number }) {
  switch (id) {
    case 'access-basico':  return <AccessIcon size={size} />;
    case 'excel-avanzado': return <ExcelIcon size={size} />;
    case 'powerpoint':     return <PowerPointIcon size={size} />;
    case 'word-avanzado':  return <WordIcon size={size} />;
    case 'mezcla':         return <MixIcon size={size} />;
    default:               return <MixIcon size={size} />;
  }
}


// ═══════════════════════════════════════════════════════════════════════════
//  UI ICONS — 24×24 monochrome stroke icons
// ═══════════════════════════════════════════════════════════════════════════

/** Clock — "Práctica de hoy" */
export function IconClock({ size = 20, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 7.5V12L14.5 14.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Lightning bolt — "Preguntas nuevas" */
export function IconBolt({ size = 20, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M13 2L4.5 13.5H11.5L11 22L19.5 10.5H12.5L13 2Z"
        stroke="currentColor" strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

/** Shuffle arrows — "Repaso libre" */
export function IconShuffle({ size = 20, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M16 3h5v5M21 3l-7 7M3 21l7-7M21 21h-5v-5M16 21l5-5M3 3l7 7"
        stroke="currentColor" strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

/** Bullseye — "Mis errores" */
export function IconBullseye({ size = 20, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="5.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}

/** Mouse — "Simulación" badge */
export function IconMouse({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="7" y="3" width="10" height="17" rx="5" stroke="currentColor" strokeWidth="1.6" />
      <line x1="12" y1="3" x2="12" y2="10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/** Check in square — "Test" badge */
export function IconCheckSquare({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="3.5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M7.5 12.5L10.5 15.5L16.5 9.5"
        stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

/** Stacked layers — "Todo" filter */
export function IconLayers({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <polygon
        points="12,3 21,8 12,13 3,8"
        stroke="currentColor" strokeWidth="1.6"
        fill="none" strokeLinejoin="round"
      />
      <path d="M3 13l9 5 9-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Bar chart — Stats */
export function IconBarChart({ size = 20, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="3"  y="12" width="4" height="9" rx="1" fill="currentColor" fillOpacity="0.65" />
      <rect x="10" y="7"  width="4" height="14" rx="1" fill="currentColor" />
      <rect x="17" y="3"  width="4" height="18" rx="1" fill="currentColor" fillOpacity="0.65" />
    </svg>
  );
}

/** Flame — Racha / Streak */
export function IconFlame({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 21C8.5 21 6 18.5 6 15c0-3.5 2-6 3.5-8 .3 1.5 1 2.5 1.5 3C11 7.5 12.5 5 12 2c2.5 3.5 6 6.5 6 10 .5-1 .5-2 .5-3C21 12 21 15 21 15c0 3.5-3 6-7 6z"
        stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" fill="none"
      />
    </svg>
  );
}

/** Zoom in — Lightbox hint */
export function IconZoomIn({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.6" />
      <path d="M15 15L21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="10" y1="7" x2="10" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="7"  y1="10" x2="13" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Monitor — no-image fallback */
export function IconMonitor({ size = 32, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="2" y="3" width="20" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 21h8M12 16v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Cursor / pointer — click instruction */
export function IconCursor({ size = 24, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4 4L10 21.5L13 14L20 21L21.5 19.5L14.5 12.5L21.5 4.5H4Z"
        stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

/** Graduation cap — Simulacro / Exam CTA */
export function IconGraduationCap({ size = 32, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <polygon
        points="12,3 22,8.5 12,14 2,8.5"
        stroke="currentColor" strokeWidth="1.6"
        fill="none" strokeLinejoin="round"
      />
      <path d="M6 12v5c0 0 2 3 6 3s6-3 6-3v-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="22" y1="8.5" x2="22" y2="14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Trophy — session completed (high score) */
export function IconTrophy({ size = 48, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M7 3h10v9a5 5 0 01-10 0V3z" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M4 3c0 5 3 8 3 8M20 3c0 5-3 8-3 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 16v4M8 20h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Star outline — medium score */
export function IconStar({ size = 48, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <polygon
        points="12,2 15.1,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.9,8.26"
        stroke="currentColor" strokeWidth="1.5"
        fill="none" strokeLinejoin="round"
      />
    </svg>
  );
}

/** Refresh — low score / retry */
export function IconRefresh({ size = 48, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M1 4v6h6M23 20v-6h-6"
        stroke="currentColor" strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round"
      />
      <path
        d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15"
        stroke="currentColor" strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

/** Seedling — 3-day milestone */
export function IconSeedling({ size = 14, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M12 22v-9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M12 13C12 13 9 9.5 5.5 9c0 4 3 6.5 6.5 6.5"
        stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round"
      />
      <path
        d="M12 13C12 13 15 9.5 18.5 9c0 4-3 6.5-6.5 6.5"
        stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

/** Star small — 7-day milestone */
export function IconStarSm({ size = 14, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <polygon
        points="12,2 15.1,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.9,8.26"
        stroke="currentColor" strokeWidth="1.5"
        fill="none" strokeLinejoin="round"
      />
    </svg>
  );
}

/** Double-star sparkle — 14-day milestone */
export function IconSparkle({ size = 14, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <polygon
        points="12,2 13.9,7.86 20,9.27 15.5,13.6 16.9,20 12,17 7.1,20 8.5,13.6 4,9.27 10.1,7.86"
        stroke="currentColor" strokeWidth="1.5"
        fill="none" strokeLinejoin="round"
      />
      <line x1="3" y1="3" x2="3" y2="5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="1.75" y1="4.25" x2="4.25" y2="4.25" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="20" y1="1" x2="20" y2="2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="19.25" y1="1.75" x2="20.75" y2="1.75" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/** Trophy small — 30-day milestone */
export function IconTrophySm({ size = 14, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M7 3h10v9a5 5 0 01-10 0V3z" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M4 3c0 5 3 8 3 8M20 3c0 5-3 8-3 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 16v4M8 20h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Check circle — correct answer */
export function IconCheckCircle({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** X circle — wrong answer */
export function IconXCircle({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Arrow right — navigate/CTA */
export function IconArrowRight({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Trending up — stats link */
export function IconTrendingUp({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <polyline
        points="22,7 13.5,15.5 8.5,10.5 2,17"
        stroke="currentColor" strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round"
      />
      <polyline
        points="16,7 22,7 22,13"
        stroke="currentColor" strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

/** Image frame — Type I badge */
export function IconImage({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** X mark — error / wrong */
export function IconX({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Shield — streak shield / protection */
export function IconShield({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 3L4 6.5v5c0 4.5 3.4 8.7 8 9.5 4.6-.8 8-5 8-9.5v-5L12 3z"
        stroke="currentColor" strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

/** Sun — light mode / day */
export function IconSun({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
        stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
      />
    </svg>
  );
}

/** Moon — dark mode / night */
export function IconMoon({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
        stroke="currentColor" strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

/** Pencil / Edit — inline goal editor */
export function IconPencil({ size = 14, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
        stroke="currentColor" strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round"
      />
      <path
        d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
        stroke="currentColor" strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

/** Share — Web Share / export */
export function IconShare({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="18" cy="5" r="3" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="6"  cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="18" cy="19" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8.59 13.51l6.83 3.98M15.41 6.51L8.59 10.49" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Lightbulb — idea / recommendation */
export function IconLightbulb({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M9 21h6M12 3a6 6 0 0 1 4.24 10.24C15.28 14.2 15 15.1 15 16H9c0-.9-.28-1.8-1.24-2.76A6 6 0 0 1 12 3z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Signal / radar — domain radar chart */
export function IconSignal({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M2 12C2 6.48 6.48 2 12 2s10 4.48 10 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M5 12a7 7 0 0 1 7-7 7 7 0 0 1 7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8 12a4 4 0 0 1 4-4 4 4 0 0 1 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

/** Clipboard — session list */
export function IconClipboard({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="8" y="2" width="8" height="4" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Timer / stopwatch — duration / forecast */
export function IconTimer({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="13" r="8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 9v4l2.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 2.5h5M12 2.5v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Difficulty / layers bar — ease factor map */
export function IconDifficulty({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="3" y="14" width="4" height="7" rx="1" fill="currentColor" opacity="0.9" />
      <rect x="10" y="9" width="4" height="12" rx="1" fill="currentColor" opacity="0.7" />
      <rect x="17" y="3" width="4" height="18" rx="1" fill="currentColor" opacity="0.5" />
    </svg>
  );
}

/** Calendar / forecast icon */
export function IconCalendar({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="8" cy="15" r="1.5" fill="currentColor" />
      <circle cx="12" cy="15" r="1.5" fill="currentColor" />
      <circle cx="16" cy="15" r="1.5" fill="currentColor" />
    </svg>
  );
}
