export interface Option {
  value: number;
  text: string;
}

export interface Question {
  id: string;
  questionNum: number;
  question: string;
  type: 'C' | 'A' | 'I' | 'B' | 'D'; // C=test, I=image+test, B=simulation/click
  options: Option[] | null;
  correctAnswerNums: number[];
  correctAnswers: string[];
  multipleCorrect: boolean;
  hasImage: boolean;
  image: string | null;           // relative path like "Imagenes/ImagenesAccess/barrest.jpg"
  imageUrl: string | null;        // full URL (overrides computed URL if set)
  solutionImages?: string[];      // ordered list of solution step images (with highlights/annotations)
  module: string;
}

import { MODULES } from './modules';

const questionCache: Record<string, Question[]> = {};

// Helper to get role from localStorage (defaults to administrativo)
function getUserRole(): 'administrativo' | 'auxiliar' {
  if (typeof window === 'undefined') return 'administrativo';
  return (localStorage.getItem('osakidetza_role') as any) || 'administrativo';
}

export async function loadQuestions(moduleId: string): Promise<Question[]> {
  if (questionCache[moduleId]) return questionCache[moduleId];

  // Virtual "mezcla" module — loads and shuffles all relevant modules for the role
  if (moduleId === 'mezcla') {
    const role = getUserRole();
    const relevantModules = MODULES.filter(m => 
      m.category === 'comun' || m.category === role
    ).map(m => m.id);
    
    const all = await Promise.all(relevantModules.map(m => loadQuestions(m)));
    const combined = shuffleArray(all.flat());
    questionCache[moduleId] = combined;
    return combined;
  }

  try {
    // Append the git commit SHA so each Vercel deployment busts the CDN cache.
    // Falls back to a session timestamp locally (where the env var isn't set).
    const v = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 8)
      || (typeof window !== 'undefined' ? String(Math.floor(Date.now() / 86400000)) : '');
    const url = v ? `/data/${moduleId}.json?v=${v}` : `/data/${moduleId}.json`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    questionCache[moduleId] = data;
    return data;
  } catch (e) {
    console.warn('No questions for', moduleId, e);
    return [];
  }
}

export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// No documentation URLs for local Osakidetza questions yet
export function getModuleBaseUrl(_moduleId: string): string {
  return '#';
}
