export interface Module {
  id: string;
  name: string;
  shortName: string;
  description: string;
  icon: string;
  category: "comun" | "administrativo" | "auxiliar" | "virtual";
  color: string;
  bgColor: string;
  borderColor: string;
  questionFile: string;
}

export const MODULES: Module[] = [
  {"id": "adm-condiciones-trabajo-osakidetza", "name": "ADM: Condiciones Trabajo Osakidetza", "shortName": "Condiciones Trabajo Osakidetza", "description": "Preguntas sobre ADM: Condiciones Trabajo Osakidetza", "icon": "🏥", "category": "administrativo", "color": "text-indigo-800", "bgColor": "bg-indigo-50", "borderColor": "border-indigo-200", "questionFile": "adm-condiciones-trabajo-osakidetza"},
  {"id": "adm-d255-osakidetza-especifico", "name": "ADM: D255 Osakidetza Especifico", "shortName": "D255 Osakidetza Especifico", "description": "Preguntas sobre ADM: D255 Osakidetza Especifico", "icon": "🏥", "category": "administrativo", "color": "text-indigo-800", "bgColor": "bg-indigo-50", "borderColor": "border-indigo-200", "questionFile": "adm-d255-osakidetza-especifico"},
  {"id": "adm-eapv-estatuto-autonomia", "name": "ADM: Eapv Estatuto Autonomia", "shortName": "Eapv Estatuto Autonomia", "description": "Preguntas sobre ADM: Eapv Estatuto Autonomia", "icon": "📚", "category": "administrativo", "color": "text-indigo-800", "bgColor": "bg-indigo-50", "borderColor": "border-indigo-200", "questionFile": "adm-eapv-estatuto-autonomia"},
  {"id": "adm-ebep-empleado-publico", "name": "ADM: Ebep Empleado Publico", "shortName": "Ebep Empleado Publico", "description": "Preguntas sobre ADM: Ebep Empleado Publico", "icon": "🏢", "category": "administrativo", "color": "text-indigo-800", "bgColor": "bg-indigo-50", "borderColor": "border-indigo-200", "questionFile": "adm-ebep-empleado-publico"},
  {"id": "adm-lpac-interesados-y-actos", "name": "ADM: Lpac Interesados Y Actos", "shortName": "Lpac Interesados Y Actos", "description": "Preguntas sobre ADM: Lpac Interesados Y Actos", "icon": "⚖️", "category": "administrativo", "color": "text-indigo-800", "bgColor": "bg-indigo-50", "borderColor": "border-indigo-200", "questionFile": "adm-lpac-interesados-y-actos"},
  {"id": "adm-lpac-procedimiento", "name": "ADM: Lpac Procedimiento", "shortName": "Lpac Procedimiento", "description": "Preguntas sobre ADM: Lpac Procedimiento", "icon": "⚖️", "category": "administrativo", "color": "text-indigo-800", "bgColor": "bg-indigo-50", "borderColor": "border-indigo-200", "questionFile": "adm-lpac-procedimiento"},
  {"id": "adm-lpac-recursos", "name": "ADM: Lpac Recursos", "shortName": "Lpac Recursos", "description": "Preguntas sobre ADM: Lpac Recursos", "icon": "⚖️", "category": "administrativo", "color": "text-indigo-800", "bgColor": "bg-indigo-50", "borderColor": "border-indigo-200", "questionFile": "adm-lpac-recursos"},
  {"id": "adm-lrjsp-sector-publico", "name": "ADM: Lrjsp Sector Publico", "shortName": "Lrjsp Sector Publico", "description": "Preguntas sobre ADM: Lrjsp Sector Publico", "icon": "⚖️", "category": "administrativo", "color": "text-indigo-800", "bgColor": "bg-indigo-50", "borderColor": "border-indigo-200", "questionFile": "adm-lrjsp-sector-publico"},
  {"id": "adm-prl-atencion-cliente-osaki", "name": "ADM: Prl Atencion Cliente Osaki", "shortName": "Prl Atencion Cliente Osaki", "description": "Preguntas sobre ADM: Prl Atencion Cliente Osaki", "icon": "⚠️", "category": "administrativo", "color": "text-indigo-800", "bgColor": "bg-indigo-50", "borderColor": "border-indigo-200", "questionFile": "adm-prl-atencion-cliente-osaki"},
  {"id": "adm-prl-prevencion-riesgos", "name": "ADM: Prl Prevencion Riesgos", "shortName": "Prl Prevencion Riesgos", "description": "Preguntas sobre ADM: Prl Prevencion Riesgos", "icon": "⚠️", "category": "administrativo", "color": "text-indigo-800", "bgColor": "bg-indigo-50", "borderColor": "border-indigo-200", "questionFile": "adm-prl-prevencion-riesgos"},
  {"id": "adm-protocolo-acoso-sexual-osaki", "name": "ADM: Protocolo Acoso Sexual Osaki", "shortName": "Protocolo Acoso Sexual Osaki", "description": "Preguntas sobre ADM: Protocolo Acoso Sexual Osaki", "icon": "📚", "category": "administrativo", "color": "text-indigo-800", "bgColor": "bg-indigo-50", "borderColor": "border-indigo-200", "questionFile": "adm-protocolo-acoso-sexual-osaki"},
  {"id": "adm-puestos-funcionales", "name": "ADM: Puestos Funcionales", "shortName": "Puestos Funcionales", "description": "Preguntas sobre ADM: Puestos Funcionales", "icon": "📚", "category": "administrativo", "color": "text-indigo-800", "bgColor": "bg-indigo-50", "borderColor": "border-indigo-200", "questionFile": "adm-puestos-funcionales"},
  {"id": "adm-segunda-opinion-medica", "name": "ADM: Segunda Opinion Medica", "shortName": "Segunda Opinion Medica", "description": "Preguntas sobre ADM: Segunda Opinion Medica", "icon": "📚", "category": "administrativo", "color": "text-indigo-800", "bgColor": "bg-indigo-50", "borderColor": "border-indigo-200", "questionFile": "adm-segunda-opinion-medica"},
  {"id": "adm-transparencia-y-buen-gobierno", "name": "ADM: Transparencia Y Buen Gobierno", "shortName": "Transparencia Y Buen Gobierno", "description": "Preguntas sobre ADM: Transparencia Y Buen Gobierno", "icon": "📚", "category": "administrativo", "color": "text-indigo-800", "bgColor": "bg-indigo-50", "borderColor": "border-indigo-200", "questionFile": "adm-transparencia-y-buen-gobierno"},
  {"id": "aux-e01", "name": "AUX: E01", "shortName": "E01", "description": "Preguntas sobre AUX: E01", "icon": "📚", "category": "auxiliar", "color": "text-emerald-800", "bgColor": "bg-emerald-50", "borderColor": "border-emerald-200", "questionFile": "aux-e01"},
  {"id": "aux-e02", "name": "AUX: E02", "shortName": "E02", "description": "Preguntas sobre AUX: E02", "icon": "📚", "category": "auxiliar", "color": "text-emerald-800", "bgColor": "bg-emerald-50", "borderColor": "border-emerald-200", "questionFile": "aux-e02"},
  {"id": "aux-e03", "name": "AUX: E03", "shortName": "E03", "description": "Preguntas sobre AUX: E03", "icon": "📚", "category": "auxiliar", "color": "text-emerald-800", "bgColor": "bg-emerald-50", "borderColor": "border-emerald-200", "questionFile": "aux-e03"},
  {"id": "aux-e04", "name": "AUX: E04", "shortName": "E04", "description": "Preguntas sobre AUX: E04", "icon": "📚", "category": "auxiliar", "color": "text-emerald-800", "bgColor": "bg-emerald-50", "borderColor": "border-emerald-200", "questionFile": "aux-e04"},
  {"id": "aux-e05", "name": "AUX: E05", "shortName": "E05", "description": "Preguntas sobre AUX: E05", "icon": "📚", "category": "auxiliar", "color": "text-emerald-800", "bgColor": "bg-emerald-50", "borderColor": "border-emerald-200", "questionFile": "aux-e05"},
  {"id": "aux-e06", "name": "AUX: E06", "shortName": "E06", "description": "Preguntas sobre AUX: E06", "icon": "📚", "category": "auxiliar", "color": "text-emerald-800", "bgColor": "bg-emerald-50", "borderColor": "border-emerald-200", "questionFile": "aux-e06"},
  {"id": "aux-e07", "name": "AUX: E07", "shortName": "E07", "description": "Preguntas sobre AUX: E07", "icon": "📚", "category": "auxiliar", "color": "text-emerald-800", "bgColor": "bg-emerald-50", "borderColor": "border-emerald-200", "questionFile": "aux-e07"},
  {"id": "aux-e08", "name": "AUX: E08", "shortName": "E08", "description": "Preguntas sobre AUX: E08", "icon": "📚", "category": "auxiliar", "color": "text-emerald-800", "bgColor": "bg-emerald-50", "borderColor": "border-emerald-200", "questionFile": "aux-e08"},
  {"id": "aux-e11", "name": "AUX: E11", "shortName": "E11", "description": "Preguntas sobre AUX: E11", "icon": "📚", "category": "auxiliar", "color": "text-emerald-800", "bgColor": "bg-emerald-50", "borderColor": "border-emerald-200", "questionFile": "aux-e11"},
  {"id": "aux-e12", "name": "AUX: E12", "shortName": "E12", "description": "Preguntas sobre AUX: E12", "icon": "📚", "category": "auxiliar", "color": "text-emerald-800", "bgColor": "bg-emerald-50", "borderColor": "border-emerald-200", "questionFile": "aux-e12"},
  {"id": "aux-e13", "name": "AUX: E13", "shortName": "E13", "description": "Preguntas sobre AUX: E13", "icon": "📚", "category": "auxiliar", "color": "text-emerald-800", "bgColor": "bg-emerald-50", "borderColor": "border-emerald-200", "questionFile": "aux-e13"},
  {"id": "comun-t01", "name": "Común: T01", "shortName": "T01", "description": "Preguntas sobre Común: T01", "icon": "📚", "category": "comun", "color": "text-blue-800", "bgColor": "bg-blue-50", "borderColor": "border-blue-200", "questionFile": "comun-t01"},
  {"id": "comun-t02", "name": "Común: T02", "shortName": "T02", "description": "Preguntas sobre Común: T02", "icon": "📚", "category": "comun", "color": "text-blue-800", "bgColor": "bg-blue-50", "borderColor": "border-blue-200", "questionFile": "comun-t02"},
  {"id": "comun-t03", "name": "Común: T03", "shortName": "T03", "description": "Preguntas sobre Común: T03", "icon": "📚", "category": "comun", "color": "text-blue-800", "bgColor": "bg-blue-50", "borderColor": "border-blue-200", "questionFile": "comun-t03"},
  {"id": "comun-t04", "name": "Común: T04", "shortName": "T04", "description": "Preguntas sobre Común: T04", "icon": "📚", "category": "comun", "color": "text-blue-800", "bgColor": "bg-blue-50", "borderColor": "border-blue-200", "questionFile": "comun-t04"},
  {"id": "comun-t05", "name": "Común: T05", "shortName": "T05", "description": "Preguntas sobre Común: T05", "icon": "📚", "category": "comun", "color": "text-blue-800", "bgColor": "bg-blue-50", "borderColor": "border-blue-200", "questionFile": "comun-t05"},
  {"id": "comun-t06", "name": "Común: T06", "shortName": "T06", "description": "Preguntas sobre Común: T06", "icon": "📚", "category": "comun", "color": "text-blue-800", "bgColor": "bg-blue-50", "borderColor": "border-blue-200", "questionFile": "comun-t06"},
  {"id": "comun-t08", "name": "Común: T08", "shortName": "T08", "description": "Preguntas sobre Común: T08", "icon": "📚", "category": "comun", "color": "text-blue-800", "bgColor": "bg-blue-50", "borderColor": "border-blue-200", "questionFile": "comun-t08"},
  {"id": "comun-t09", "name": "Común: T09", "shortName": "T09", "description": "Preguntas sobre Común: T09", "icon": "📚", "category": "comun", "color": "text-blue-800", "bgColor": "bg-blue-50", "borderColor": "border-blue-200", "questionFile": "comun-t09"},
  {"id": "comun-t10", "name": "Común: T10", "shortName": "T10", "description": "Preguntas sobre Común: T10", "icon": "📚", "category": "comun", "color": "text-blue-800", "bgColor": "bg-blue-50", "borderColor": "border-blue-200", "questionFile": "comun-t10"},
  {"id": "comun-t11", "name": "Común: T11", "shortName": "T11", "description": "Preguntas sobre Común: T11", "icon": "📚", "category": "comun", "color": "text-blue-800", "bgColor": "bg-blue-50", "borderColor": "border-blue-200", "questionFile": "comun-t11"},
  {"id": "comun-t12", "name": "Común: T12", "shortName": "T12", "description": "Preguntas sobre Común: T12", "icon": "📚", "category": "comun", "color": "text-blue-800", "bgColor": "bg-blue-50", "borderColor": "border-blue-200", "questionFile": "comun-t12"},
  {"id": "comun-t13", "name": "Común: T13", "shortName": "T13", "description": "Preguntas sobre Común: T13", "icon": "📚", "category": "comun", "color": "text-blue-800", "bgColor": "bg-blue-50", "borderColor": "border-blue-200", "questionFile": "comun-t13"},
  {"id": "comun-t14", "name": "Común: T14", "shortName": "T14", "description": "Preguntas sobre Común: T14", "icon": "📚", "category": "comun", "color": "text-blue-800", "bgColor": "bg-blue-50", "borderColor": "border-blue-200", "questionFile": "comun-t14"},
  {"id": "comun-t15", "name": "Común: T15", "shortName": "T15", "description": "Preguntas sobre Común: T15", "icon": "📚", "category": "comun", "color": "text-blue-800", "bgColor": "bg-blue-50", "borderColor": "border-blue-200", "questionFile": "comun-t15"},
  {"id": "comun-t16", "name": "Común: T16", "shortName": "T16", "description": "Preguntas sobre Común: T16", "icon": "📚", "category": "comun", "color": "text-blue-800", "bgColor": "bg-blue-50", "borderColor": "border-blue-200", "questionFile": "comun-t16"},
  {"id": "comun-t17", "name": "Común: T17", "shortName": "T17", "description": "Preguntas sobre Común: T17", "icon": "📚", "category": "comun", "color": "text-blue-800", "bgColor": "bg-blue-50", "borderColor": "border-blue-200", "questionFile": "comun-t17"},
  {"id": "comun-t18", "name": "Común: T18", "shortName": "T18", "description": "Preguntas sobre Común: T18", "icon": "📚", "category": "comun", "color": "text-blue-800", "bgColor": "bg-blue-50", "borderColor": "border-blue-200", "questionFile": "comun-t18"},
  {"id": "comun-t19", "name": "Común: T19", "shortName": "T19", "description": "Preguntas sobre Común: T19", "icon": "📚", "category": "comun", "color": "text-blue-800", "bgColor": "bg-blue-50", "borderColor": "border-blue-200", "questionFile": "comun-t19"},
  {
    id: "mezcla",
    name: "Todos los módulos",
    shortName: "Mezcla",
    description: "Práctica mixta intercalando todos los módulos",
    icon: "🔀",
    category: "virtual",
    color: "text-[#282182]",
    bgColor: "bg-[#e8e7f7]",
    borderColor: "border-[#c5c3e8]",
    questionFile: "mezcla"
  }
];

export function getModule(id: string): Module | undefined {
  return MODULES.find(m => m.id === id);
}

export function getModulesByCategory(category: Module['category']): Module[] {
  return MODULES.filter(m => m.category === category);
}
