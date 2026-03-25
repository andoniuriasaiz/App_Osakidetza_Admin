'use client';

import { useRouter, usePathname } from 'next/navigation';

/* ── SVG icons (sin emoji para aspecto institucional) ── */
function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 12L12 3L21 12V21H15V15H9V21H3V12Z"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinejoin="round"
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? 0.12 : 0}
      />
    </svg>
  );
}

function ExamIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="4" y="2" width="16" height="20" rx="2"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? 0.12 : 0}
      />
      <line x1="8" y1="8"  x2="16" y2="8"  stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <line x1="8" y1="16" x2="12" y2="16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  );
}

function StatsIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="3" y="12" width="4" height="9" rx="1"
        fill="currentColor"
        fillOpacity={active ? 1 : 0.65}
      />
      <rect
        x="10" y="7" width="4" height="14" rx="1"
        fill="currentColor"
        fillOpacity={active ? 1 : 0.65}
      />
      <rect
        x="17" y="3" width="4" height="18" rx="1"
        fill="currentColor"
        fillOpacity={active ? 1 : 0.65}
      />
    </svg>
  );
}

function PlanIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="3" y="4" width="18" height="17" rx="2"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? 0.12 : 0}
      />
      <line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" strokeWidth="1.6"/>
      <line x1="8" y1="2" x2="8" y2="6"  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="7" y1="14" x2="10" y2="14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <line x1="7" y1="17" x2="10" y2="17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <line x1="14" y1="14" x2="17" y2="14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  );
}

const items = [
  { href: '/dashboard', label: 'Inicio',  Icon: HomeIcon },
  { href: '/exam',      label: 'Examen',  Icon: ExamIcon },
  { href: '/stats',     label: 'Stats',   Icon: StatsIcon },
  { href: '/plan',      label: 'Plan',    Icon: PlanIcon },
] as const;

export default function BottomNav() {
  const router   = useRouter();
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-20 bg-white safe-bottom"
      style={{ borderTop: '1px solid #e4e3f0' }}
      aria-label="Navegación principal"
    >
      <div className="max-w-lg mx-auto flex">
        {items.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <button
              key={href}
              onClick={() => router.push(href)}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors relative"
              style={{
                color: active ? '#282182' : '#a0a0c0',
                minHeight: '52px', // WCAG touch target ≥ 44px
              }}
              onMouseEnter={e => {
                if (!active) (e.currentTarget as HTMLButtonElement).style.color = '#4a4a6a';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.color = active ? '#282182' : '#a0a0c0';
              }}
            >
              <Icon active={active} />
              <span
                className="text-[10px] font-semibold leading-none mt-0.5"
                style={{ color: active ? '#282182' : '#a0a0c0' }}
              >
                {label}
              </span>
              {/* Indicador activo */}
              {active && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-b"
                  style={{ background: '#282182' }}
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
