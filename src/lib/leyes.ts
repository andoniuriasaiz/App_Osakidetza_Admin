/**
 * Agrupación de módulos por Ley/Norma.
 * Permite estudiar todas las preguntas de una misma ley
 * a la vez (interleaving AUX + ADM + TEC).
 */

export interface LeyGroup {
  id: string;
  nombre: string;
  descripcion: string;
  icono: string;
  /** IDs de módulos que tratan esta ley */
  modulos: string[];
  /** Qué tracks tienen preguntas de esta ley */
  tracks: Array<'aux' | 'admin' | 'tec'>;
  /** Categoría para agrupar en la UI */
  categoria: 'administrativa' | 'laboral' | 'sanitaria' | 'organica' | 'tec-especifico';
}

export const LEYES: LeyGroup[] = [

  // ─── DERECHO ADMINISTRATIVO ──────────────────────────────────────────────
  {
    id: 'lpac',
    nombre: 'LPAC — Ley 39/2015',
    descripcion: 'Procedimiento Administrativo Común',
    icono: '⚖️',
    modulos: [
      'aux-e02', 'aux-e03', 'aux-e04',
      'adm-lpac-interesados-y-actos', 'adm-lpac-procedimiento', 'adm-lpac-recursos',
      'tec-t04',
    ],
    tracks: ['aux', 'admin', 'tec'],
    categoria: 'administrativa',
  },
  {
    id: 'lrjsp',
    nombre: 'LRJSP — Ley 40/2015',
    descripcion: 'Régimen Jurídico del Sector Público',
    icono: '🏛️',
    modulos: ['aux-e05', 'adm-lrjsp-sector-publico', 'tec-t04'],
    tracks: ['aux', 'admin', 'tec'],
    categoria: 'administrativa',
  },
  {
    id: 'eapv',
    nombre: 'EAPV — Estatuto de Autonomía',
    descripcion: 'Estatuto de Autonomía del País Vasco',
    icono: '🏴',
    modulos: ['aux-e01', 'adm-eapv-estatuto-autonomia', 'tec-t02'],
    tracks: ['aux', 'admin', 'tec'],
    categoria: 'organica',
  },
  {
    id: 'constitucion',
    nombre: 'Constitución Española',
    descripcion: 'CE 1978 — solo OPE TEC',
    icono: '📜',
    modulos: ['tec-t01'],
    tracks: ['tec'],
    categoria: 'organica',
  },
  {
    id: 'ley7-1981',
    nombre: 'Ley 7/1981 Gobierno Vasco',
    descripcion: 'Ley del Gobierno y Administración de la CAPV',
    icono: '🏛️',
    modulos: ['tec-t03'],
    tracks: ['tec'],
    categoria: 'organica',
  },
  {
    id: 'transparencia',
    nombre: 'Transparencia y Buen Gobierno',
    descripcion: 'Ley 19/2013 de Transparencia',
    icono: '🔍',
    modulos: ['adm-transparencia-y-buen-gobierno', 'tec-t05'],
    tracks: ['admin', 'tec'],
    categoria: 'administrativa',
  },

  // ─── EMPLEO PÚBLICO / LABORAL ────────────────────────────────────────────
  {
    id: 'ebep',
    nombre: 'EBEP — Empleo Público',
    descripcion: 'Estatuto Básico del Empleado Público',
    icono: '🏢',
    modulos: ['aux-e06', 'adm-ebep-empleado-publico', 'tec-t06'],
    tracks: ['aux', 'admin', 'tec'],
    categoria: 'laboral',
  },
  {
    id: 'estatuto-marco',
    nombre: 'Estatuto Marco Personal Sanitario',
    descripcion: 'Ley 55/2003 — personal estatutario',
    icono: '📋',
    modulos: ['comun-t03', 'tec-comun-t03'],
    tracks: ['aux', 'admin', 'tec'],
    categoria: 'laboral',
  },
  {
    id: 'condiciones-trabajo',
    nombre: 'Condiciones de Trabajo Osakidetza',
    descripcion: 'Acuerdo y condiciones laborales internas',
    icono: '👷',
    modulos: ['aux-e08', 'adm-condiciones-trabajo-osakidetza'],
    tracks: ['aux', 'admin'],
    categoria: 'laboral',
  },
  {
    id: 'prl',
    nombre: 'PRL — Prevención de Riesgos',
    descripcion: 'Ley 31/1995 de Prevención de Riesgos Laborales',
    icono: '⚠️',
    modulos: ['aux-e12', 'aux-e13', 'adm-prl-prevencion-riesgos', 'adm-prl-atencion-cliente-osaki'],
    tracks: ['aux', 'admin'],
    categoria: 'laboral',
  },
  {
    id: 'puestos-funcionales',
    nombre: 'Puestos Funcionales Osakidetza',
    descripcion: 'Relación de puestos y organización funcional',
    icono: '📊',
    modulos: ['adm-puestos-funcionales', 'tec-t07'],
    tracks: ['admin', 'tec'],
    categoria: 'laboral',
  },
  {
    id: 'acoso-sexual',
    nombre: 'Protocolo Acoso Sexual',
    descripcion: 'Protocolo de actuación en Osakidetza',
    icono: '🛡️',
    modulos: ['adm-protocolo-acoso-sexual-osaki'],
    tracks: ['admin'],
    categoria: 'laboral',
  },

  // ─── ORGANIZACIÓN SANITARIA ──────────────────────────────────────────────
  {
    id: 'profesiones-sanitarias',
    nombre: 'Profesiones Sanitarias',
    descripcion: 'Ley 44/2003 de Ordenación de Profesiones Sanitarias',
    icono: '🩺',
    modulos: ['comun-t01', 'tec-comun-t01'],
    tracks: ['aux', 'admin', 'tec'],
    categoria: 'sanitaria',
  },
  {
    id: 'cohesion-sns',
    nombre: 'Cohesión y Calidad del SNS',
    descripcion: 'Ley 16/2003',
    icono: '🏥',
    modulos: ['comun-t02', 'tec-comun-t02'],
    tracks: ['aux', 'admin', 'tec'],
    categoria: 'sanitaria',
  },
  {
    id: 'ley8-1997',
    nombre: 'Ley 8/1997 Ordenación Sanitaria',
    descripcion: 'Ley de Ordenación Sanitaria de Euskadi',
    icono: '🏥',
    modulos: ['comun-t04', 'tec-comun-t04', 'tec-t08'],
    tracks: ['aux', 'admin', 'tec'],
    categoria: 'sanitaria',
  },
  {
    id: 'd255',
    nombre: 'D.255/2022 — Osakidetza',
    descripcion: 'Decreto de estructura y organización de Osakidetza',
    icono: '🏥',
    modulos: ['comun-t05', 'aux-e07', 'adm-d255-osakidetza-especifico', 'tec-t08'],
    tracks: ['aux', 'admin', 'tec'],
    categoria: 'sanitaria',
  },
  {
    id: 'osi',
    nombre: 'D.100/2018 — Organizaciones Sanitarias Integradas',
    descripcion: 'OSI y modelo organizativo',
    icono: '🏥',
    modulos: ['comun-t06', 'tec-comun-t05'],
    tracks: ['aux', 'admin', 'tec'],
    categoria: 'sanitaria',
  },
  {
    id: 'autonomia-paciente',
    nombre: 'Autonomía del Paciente',
    descripcion: 'Ley 41/2002 de derechos del paciente',
    icono: '🤝',
    modulos: ['comun-t08', 'tec-comun-t06', 'tec-comun-t08'],
    tracks: ['aux', 'admin', 'tec'],
    categoria: 'sanitaria',
  },
  {
    id: 'voluntades-anticipadas',
    nombre: 'Voluntades Anticipadas',
    descripcion: 'Declaración de voluntades anticipadas',
    icono: '📝',
    modulos: ['comun-t09', 'tec-comun-t09'],
    tracks: ['aux', 'admin', 'tec'],
    categoria: 'sanitaria',
  },
  {
    id: 'segunda-opinion',
    nombre: 'Segunda Opinión Médica',
    descripcion: 'Ley vasca de segunda opinión médica',
    icono: '🩺',
    modulos: ['aux-e11', 'adm-segunda-opinion-medica'],
    tracks: ['aux', 'admin'],
    categoria: 'sanitaria',
  },
  {
    id: 'seguridad-paciente',
    nombre: 'Seguridad del Paciente',
    descripcion: 'Plan de Seguridad del Paciente Osakidetza',
    icono: '🛡️',
    modulos: ['comun-t14', 'tec-comun-t14'],
    tracks: ['aux', 'admin', 'tec'],
    categoria: 'sanitaria',
  },

  // ─── DERECHOS FUNDAMENTALES / ORGÁNICA ──────────────────────────────────
  {
    id: 'proteccion-datos',
    nombre: 'Protección de Datos — RGPD/LOPDGDD',
    descripcion: 'Reglamento General de Protección de Datos',
    icono: '🔒',
    modulos: ['comun-t10', 'tec-comun-t10'],
    tracks: ['aux', 'admin', 'tec'],
    categoria: 'organica',
  },
  {
    id: 'igualdad',
    nombre: 'Igualdad Efectiva M/H',
    descripcion: 'Ley Orgánica 3/2007 de Igualdad',
    icono: '⚖️',
    modulos: ['comun-t11', 'tec-comun-t11'],
    tracks: ['aux', 'admin', 'tec'],
    categoria: 'organica',
  },
  {
    id: 'eutanasia',
    nombre: 'Ley de Eutanasia',
    descripcion: 'Ley Orgánica 3/2021 de regulación de la eutanasia',
    icono: '📜',
    modulos: ['comun-t18', 'tec-comun-t16'],
    tracks: ['aux', 'admin', 'tec'],
    categoria: 'organica',
  },
  {
    id: 'incompatibilidades',
    nombre: 'Incompatibilidades AAPP',
    descripcion: 'Ley 53/1984 de incompatibilidades',
    icono: '⛔',
    modulos: ['comun-t19', 'tec-comun-t16'],
    tracks: ['aux', 'admin', 'tec'],
    categoria: 'organica',
  },

  // ─── PLANES Y ESTRATEGIAS ────────────────────────────────────────────────
  {
    id: 'plan-salud-2030',
    nombre: 'Plan de Salud Euskadi 2030',
    descripcion: 'Objetivos y estrategia sanitaria',
    icono: '📊',
    modulos: ['comun-t12', 'tec-comun-t12'],
    tracks: ['aux', 'admin', 'tec'],
    categoria: 'sanitaria',
  },
  {
    id: 'pacto-vasco-salud',
    nombre: 'Pacto Vasco por la Salud',
    descripcion: 'Acuerdo de partidos',
    icono: '🤝',
    modulos: ['comun-t13', 'tec-comun-t13'],
    tracks: ['aux', 'admin', 'tec'],
    categoria: 'sanitaria',
  },
  {
    id: 'euskera',
    nombre: 'Normalización del Euskera',
    descripcion: 'Uso del euskera en Osakidetza',
    icono: '🌿',
    modulos: ['comun-t16', 'tec-comun-t15', 'tec-t08'],
    tracks: ['aux', 'admin', 'tec'],
    categoria: 'organica',
  },
  {
    id: 'oncologia',
    nombre: 'Plan Oncológico Euskadi',
    descripcion: 'Plan de lucha contra el cáncer',
    icono: '🎗️',
    modulos: ['comun-t17', 'tec-comun-t15'],
    tracks: ['aux', 'admin', 'tec'],
    categoria: 'sanitaria',
  },
  {
    id: 'igualdad-osakidetza',
    nombre: 'Plan de Igualdad Osakidetza',
    descripcion: 'Plan interno de igualdad',
    icono: '⚖️',
    modulos: ['comun-t15'],
    tracks: ['aux', 'admin'],
    categoria: 'laboral',
  },
];

export function getLeysForTrack(trackId: 'aux' | 'admin' | 'tec'): LeyGroup[] {
  return LEYES.filter(l => l.tracks.includes(trackId));
}

export function getLeysForModulo(moduloId: string): LeyGroup[] {
  return LEYES.filter(l => l.modulos.includes(moduloId));
}

export function getLey(id: string): LeyGroup | undefined {
  return LEYES.find(l => l.id === id);
}

export const CATEGORIA_LABELS: Record<LeyGroup['categoria'], string> = {
  administrativa: 'Derecho Administrativo',
  laboral: 'Empleo Público / Laboral',
  sanitaria: 'Organización Sanitaria',
  organica: 'Derechos y Leyes Orgánicas',
  'tec-especifico': 'TEC Específico',
};

export const CATEGORIA_COLORS: Record<LeyGroup['categoria'], { bg: string; border: string; text: string }> = {
  administrativa: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800' },
  laboral:        { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800' },
  sanitaria:      { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-800' },
  organica:       { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-800' },
  'tec-especifico': { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800' },
};
