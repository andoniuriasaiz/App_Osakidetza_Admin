/**
 * tracks.ts
 * Define las 3 OPEs disponibles y los módulos que pertenecen a cada una.
 *
 * Arquitectura de temarios:
 *  - AUX  (Auxiliar Administrativo C2): COM_C2 (T01-T19) + AUX específico (E01-E13)
 *  - ADMIN (Administrativo C1):          COM_C2 (T01-T19) + ADM específico (E01-E14)
 *  - TEC  (Técnico Superior Adm. A1):    COM_ABC1 (T01-T16) + TEC específico (T01-T08)
 */

export interface OpeTrack {
  id: 'aux' | 'admin' | 'tec';
  name: string;
  shortName: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  badgeColor: string;
  /** IDs de los módulos comunes a esta OPE (en orden de estudio recomendado) */
  commonModuleIds: string[];
  /** IDs de los módulos específicos de esta OPE (en orden de estudio recomendado) */
  specificModuleIds: string[];
  /** Fecha del examen */
  examDate: string;
}

// Módulos comunes C2 (para AUX + ADMIN)
const COMUN_C2_IDS = [
  'comun-t01', 'comun-t02', 'comun-t03', 'comun-t04',
  'comun-t05', 'comun-t06', 'comun-t08', 'comun-t09',
  'comun-t10', 'comun-t11', 'comun-t12', 'comun-t13',
  'comun-t14', 'comun-t15', 'comun-t16', 'comun-t17',
  'comun-t18', 'comun-t19',
];

// Módulos comunes ABC1 (solo para TEC)
const COMUN_ABC1_IDS = [
  'tec-comun-t01', 'tec-comun-t02', 'tec-comun-t03', 'tec-comun-t04',
  'tec-comun-t05', 'tec-comun-t06', 'tec-comun-t08', 'tec-comun-t09',
  'tec-comun-t10', 'tec-comun-t11', 'tec-comun-t12', 'tec-comun-t13',
  'tec-comun-t14', 'tec-comun-t15', 'tec-comun-t16',
];

export const OPE_TRACKS: OpeTrack[] = [
  {
    id: 'aux',
    name: 'Auxiliar Administrativo',
    shortName: 'AUX',
    description: 'OPE Auxiliar Administrativo de Osakidetza — Grupo C2',
    icon: '📋',
    color: 'text-emerald-800',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-300',
    badgeColor: 'bg-emerald-100 text-emerald-800',
    commonModuleIds: COMUN_C2_IDS,
    specificModuleIds: [
      'aux-e01', 'aux-e02', 'aux-e03', 'aux-e04',
      'aux-e05', 'aux-e06', 'aux-e07', 'aux-e08',
      'aux-e11', 'aux-e12', 'aux-e13',
    ],
    examDate: '2026-06-21',
  },
  {
    id: 'admin',
    name: 'Administrativo',
    shortName: 'ADM',
    description: 'OPE Administrativo de Osakidetza — Grupo C1',
    icon: '🏢',
    color: 'text-indigo-800',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-300',
    badgeColor: 'bg-indigo-100 text-indigo-800',
    commonModuleIds: COMUN_C2_IDS,
    specificModuleIds: [
      'adm-eapv-estatuto-autonomia',
      'adm-lpac-interesados-y-actos',
      'adm-lpac-procedimiento',
      'adm-lpac-recursos',
      'adm-lrjsp-sector-publico',
      'adm-ebep-empleado-publico',
      'adm-d255-osakidetza-especifico',
      'adm-condiciones-trabajo-osakidetza',
      'adm-segunda-opinion-medica',
      'adm-prl-prevencion-riesgos',
      'adm-prl-atencion-cliente-osaki',
      'adm-puestos-funcionales',
      'adm-transparencia-y-buen-gobierno',
      'adm-protocolo-acoso-sexual-osaki',
    ],
    examDate: '2026-06-21',
  },
  {
    id: 'tec',
    name: 'Técnico Superior en Administración',
    shortName: 'TEC',
    description: 'OPE Técnico Superior en Administración de Osakidetza — Grupo A1',
    icon: '🎓',
    color: 'text-amber-800',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-300',
    badgeColor: 'bg-amber-100 text-amber-800',
    commonModuleIds: COMUN_ABC1_IDS,
    specificModuleIds: [
      'tec-t01', 'tec-t02', 'tec-t03', 'tec-t04',
      'tec-t05', 'tec-t06', 'tec-t07', 'tec-t08',
      'tec-hacienda-pv', 'tec-presupuesto-euskadi',
      'tec-economia-empresa',
      'tec-pgc-contabilidad', 'tec-analisis-financiero', 'tec-control-publico',
      'tec-logistica-scm', 'tec-compras',
      'tec-derecho-aplicado', 'tec-casos-practicos',
    ],
    examDate: '2026-06-21',
  },
];

/** Assigns de usuario: qué OPEs prepara cada usuario */
export const USER_TRACK_DEFAULTS: Record<string, OpeTrack['id'][]> = {
  andoni: ['aux', 'admin', 'tec'],
  ander:  ['aux', 'admin'],
};

export function getTrack(id: OpeTrack['id']): OpeTrack | undefined {
  return OPE_TRACKS.find(t => t.id === id);
}

export function getAllModuleIdsForTrack(track: OpeTrack): string[] {
  return [...track.commonModuleIds, ...track.specificModuleIds];
}

/** Días hasta el examen desde hoy */
export function daysUntilExam(examDate: string): number {
  const now = new Date();
  const exam = new Date(examDate);
  const diff = exam.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
