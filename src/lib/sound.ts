// ─── Web Audio Sound Engine ─────────────────────────────────────────────────
// Sin dependencias externas — todo generado con AudioContext

const MUTE_KEY = 'chatelac_muted';

export function isMuted(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(MUTE_KEY) === '1';
}

export function toggleMute(): boolean {
  const next = !isMuted();
  localStorage.setItem(MUTE_KEY, next ? '1' : '0');
  return next;
}

// Obtener (o crear) el contexto de audio
let _ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!_ctx) _ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  return _ctx;
}

// Crear un oscilador y conectarlo al output
function playTone(
  freq: number,
  type: OscillatorType,
  startTime: number,
  duration: number,
  gainPeak: number,
  ctx: AudioContext
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);

  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(gainPeak, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.01);
}

// ─── Sonido: respuesta correcta ─────────────────────────────────────────────
export function playCorrect() {
  if (isMuted()) return;
  const ctx = getCtx();
  if (!ctx) return;

  // Breve acorde mayor (Do + Mi) — agradable y claro
  const t = ctx.currentTime;
  playTone(523.25, 'sine', t,       0.18, 0.22, ctx); // C5
  playTone(659.25, 'sine', t + 0.02, 0.18, 0.18, ctx); // E5
}

// ─── Sonido: respuesta incorrecta ───────────────────────────────────────────
export function playWrong() {
  if (isMuted()) return;
  const ctx = getCtx();
  if (!ctx) return;

  // Tono grave descendente — claramente "error" sin ser molesto
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(220, t);
  osc.frequency.exponentialRampToValueAtTime(110, t + 0.22);

  gain.gain.setValueAtTime(0.15, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.3);
}

// ─── Sonido: level up ────────────────────────────────────────────────────────
export function playLevelUp() {
  if (isMuted()) return;
  const ctx = getCtx();
  if (!ctx) return;

  // Arpegio ascendente Do-Mi-Sol-Do — fanfarria corta
  const t = ctx.currentTime;
  const notes = [261.63, 329.63, 392, 523.25]; // C4 E4 G4 C5
  notes.forEach((freq, i) => {
    playTone(freq, 'sine', t + i * 0.1, 0.25, 0.25, ctx);
  });
  // Armónico final más fuerte
  playTone(523.25, 'sine', t + 0.45, 0.4, 0.3, ctx);
}

// ─── Sonido: objetivo diario completado ─────────────────────────────────────
export function playGoalDone() {
  if (isMuted()) return;
  const ctx = getCtx();
  if (!ctx) return;

  const t = ctx.currentTime;
  // Acorde mayor completo: Do-Mi-Sol + shimmer
  [261.63, 329.63, 392, 523.25].forEach((freq, i) => {
    playTone(freq, 'sine', t + i * 0.05, 0.5, 0.2, ctx);
  });
}

// ─── Sonido: combo activado ──────────────────────────────────────────────────
export function playCombo() {
  if (isMuted()) return;
  const ctx = getCtx();
  if (!ctx) return;

  // Dos notas rápidas ascendentes — "¡bien!"
  const t = ctx.currentTime;
  playTone(440, 'sine', t,      0.1, 0.15, ctx); // A4
  playTone(880, 'sine', t + 0.08, 0.15, 0.18, ctx); // A5
}

// ─── Sonido: racha rota ──────────────────────────────────────────────────────
export function playStreakBroken() {
  if (isMuted()) return;
  const ctx = getCtx();
  if (!ctx) return;

  const t = ctx.currentTime;
  playTone(200, 'sine', t,       0.15, 0.1, ctx);
  playTone(150, 'sine', t + 0.1, 0.2,  0.1, ctx);
}

// ─── Sonido: sesión completada ───────────────────────────────────────────────
export function playSessionDone() {
  if (isMuted()) return;
  const ctx = getCtx();
  if (!ctx) return;

  // Fanfarria corta tipo "misión completada"
  const t = ctx.currentTime;
  const seq = [392, 392, 523.25]; // G4 G4 C5
  seq.forEach((freq, i) => {
    playTone(freq, 'sine', t + i * 0.15, 0.2, 0.22, ctx);
  });
  playTone(659.25, 'sine', t + 0.5, 0.5, 0.28, ctx); // E5 largo
}
