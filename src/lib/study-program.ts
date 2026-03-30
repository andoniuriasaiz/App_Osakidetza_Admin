import { getTrack } from './tracks';

export interface StudyDay {
  date: string; // YYYY-MM-DD
  dayOfWeek: number; // 0-6
  phase: number; // 1: Vuelta 1, 2: Vuelta 2, 3: Sprint Final
  type: 'new' | 'review' | 'simulacro' | 'weaks' | 'rest';
  assignedModules: string[];
  description: string;
  completed: boolean;
}

export interface StudyProgram {
  startDate: string;
  examDate: string;
  trackId: string;
  days: StudyDay[];
}

export async function fetchStudyProgram(): Promise<StudyProgram | null> {
  if (typeof window === 'undefined') return null;
  try {
    const res = await fetch('/api/study-program');
    if (!res.ok) return null;
    const data = await res.json();
    return data.program;
  } catch (err) {
    console.error(err);
    return null;
  }
}

export async function saveStudyProgram(program: StudyProgram): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await fetch('/api/study-program', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save', program })
    });
  } catch (err) {
    console.error(err);
  }
}

export async function resetStudyProgram(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await fetch('/api/study-program', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete' })
    });
  } catch (err) {
    console.error(err);
  }
}

export async function completeStudyDay(dateStr: string): Promise<StudyProgram | null> {
  const p = await fetchStudyProgram();
  if (p) {
    const day = p.days.find(d => d.date === dateStr);
    if (day) day.completed = true;
    await saveStudyProgram(p);
  }
  return p;
}

export async function generateProgram(startDateStr: string, trackId: string, examDateStr: string = '2026-06-21'): Promise<StudyProgram> {
  const track = getTrack(trackId as 'aux' | 'admin' | 'tec');
  if (!track) throw new Error('Track no encontrado');

  const start = new Date(startDateStr);
  start.setHours(0, 0, 0, 0);
  const exam = new Date(examDateStr);
  exam.setHours(0, 0, 0, 0);

  const totalDays = Math.ceil((exam.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (totalDays <= 0) throw new Error('La fecha de examen debe ser posterior a la de inicio');

  // Todas las asignaturas de la OPE
  const allModules = [...track.commonModuleIds, ...track.specificModuleIds];

  const phase1Days = Math.floor(totalDays * 0.6);
  const phase2Days = Math.floor(totalDays * 0.3);
  // phase3Days is the rest

  const days: StudyDay[] = [];
  const currentDate = new Date(start);

  // Calcula cuántos días habiles para temas nuevos hay en la Fase 1
  let availableNewDays = 0;
  for (let i = 0; i < phase1Days; i++) {
    const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    const dow = d.getDay();
    // Monday(1), Tuesday(2), Thursday(4) are new topic days
    if (dow === 1 || dow === 2 || dow === 4) availableNewDays++;
  }

  // Precalcula cuántos módulos por día hábil
  const modulesPerNewDay = availableNewDays > 0 ? Math.ceil(allModules.length / availableNewDays) : allModules.length;

  let moduleIndex = 0;
  const seenModules: string[] = [];
  let weekModules: string[] = [];

  for (let i = 0; i < totalDays; i++) {
    const isSprint = i >= (phase1Days + phase2Days);
    const isVuelta2 = !isSprint && i >= phase1Days;
    const isVuelta1 = i < phase1Days;

    const dow = currentDate.getDay(); // 0: Sun, 1: Mon, 2: Tue, 3: Wed, 4: Thu, 5: Fri, 6: Sat
    
    // Reset week track on Monday
    if (dow === 1) {
      weekModules = [];
    }

    const dayObj: StudyDay = {
      date: currentDate.toISOString().split('T')[0],
      dayOfWeek: dow,
      phase: isVuelta1 ? 1 : isVuelta2 ? 2 : 3,
      type: 'review', // default, to be overwritten
      assignedModules: [],
      description: '',
      completed: false,
    };

    if (isVuelta1) {
      if (dow === 0) { // Sunday
        dayObj.type = 'rest';
        dayObj.description = 'Vuelta 1: Día libre. ¡Desconecta y recarga pilas!';
      } else if (dow === 6) { // Saturday
        dayObj.type = 'simulacro';
        dayObj.description = 'Vuelta 1: Simulacro de los módulos vistos en la semana.';
        dayObj.assignedModules = [...weekModules];
      } else if (dow === 5) { // Friday
        dayObj.type = 'review';
        dayObj.description = 'Vuelta 1: Repaso general de la semana mediante test intercalado.';
        dayObj.assignedModules = [...weekModules];
      } else if (dow === 3) { // Wednesday
        dayObj.type = 'weaks';
        dayObj.description = 'Vuelta 1: ¡Día de Puntos Débiles! Machaca los errores que más cometes.';
      } else { // Mon, Tue, Thu
        const toAssign = [];
        for (let m = 0; m < modulesPerNewDay; m++) {
          if (moduleIndex < allModules.length) {
            toAssign.push(allModules[moduleIndex]);
            moduleIndex++;
          }
        }
        
        if (toAssign.length > 0) {
          dayObj.type = 'new';
          dayObj.assignedModules = toAssign;
          dayObj.description = 'Vuelta 1: Avance de temario. Test rápidos para familiarizarte.';
          weekModules.push(...toAssign);
          seenModules.push(...toAssign);
        } else {
          dayObj.type = 'review';
          dayObj.description = 'Vuelta 1: Repaso espaciado de módulos anteriores.';
        }
      }
    } else if (isVuelta2) { // Phase 2
      if (dow === 0) {
        dayObj.type = 'rest';
        dayObj.description = 'Vuelta 2: Descanso dominical.';
      } else if (dow === 3) {
        dayObj.type = 'weaks';
        dayObj.description = 'Vuelta 2: ¡Puntos Débiles! Elimina los fallos repetitivos.';
      } else if (dow === 6) {
        dayObj.type = 'simulacro';
        dayObj.description = 'Vuelta 2: Simulacro completo oficial (60 preguntas).';
      } else if (dow === 4) {
        dayObj.type = 'simulacro';
        dayObj.description = 'Vuelta 2: Medio Simulacro (30 preguntas).';
      } else {
        dayObj.type = 'review';
        dayObj.description = 'Vuelta 2: Uso intensivo del Entrenamiento Mixto para asentar la memoria a largo plazo.';
      }
    } else { // Phase 3 (Sprint)
      if (dow === 0) {
        dayObj.type = 'rest';
        dayObj.description = 'Sprint: Descanso vital para consolidar la memoria antes del examen.';
      } else if (dow === 3) { // Wed
        dayObj.type = 'weaks';
        dayObj.description = 'Sprint: Limpieza final de Puntos Débiles.';
      } else if (dow === 1 || dow === 6) { // Mon, Sat
        dayObj.type = 'simulacro';
        dayObj.description = 'Sprint: Simulacro oficial (60 preguntas en 90 min) cronometrado al máximo rendimiento.';
      } else { // 2, 4, 5
        dayObj.type = 'review';
        dayObj.description = 'Sprint: Revisa tus fallos del simulacro anterior y refuerza puntos concretos.';
      }
    }

    days.push(dayObj);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  const program: StudyProgram = {
    startDate: start.toISOString().split('T')[0],
    examDate: exam.toISOString().split('T')[0],
    trackId,
    days,
  };

  await saveStudyProgram(program);
  return program;
}
