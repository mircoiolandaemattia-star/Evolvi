import { getJson, removeItem, setJson } from "./storage";

/**
 * Sessione di allenamento sospesa, salvata su AsyncStorage.
 *
 * La sessione viene POSTata solo alla fine (`POST /workout-sessions`): se
 * l'app viene chiusa (o crasha) in mezzo all'allenamento, tutto il
 * progresso vive fin qui. La bozza è locale al dispositivo, scade da sola
 * dopo `DRAFT_TTL_MS` e viene cancellata quando la sessione va a buon fine.
 */

/** Serie registrata in sessione: valori grezzi come nei campi di testo. */
export type SessionSetLog = {
  completed: boolean;
  weight: string;
  reps: string;
};

/**
 * Esercizio della sessione: la riga della scheda con le modifiche al volo
 * (macchinari occupati, esercizio non disponibile…).
 *
 * `id` è quello della scheda e **non cambia mai**: è il legame con il
 * `performed_data` dello storico, quindi anche un esercizio sostituito fa
 * capo alla riga originale.
 */
export type SessionExercise = {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weightKg: number;
  restSeconds: number | null;
  notes: string | null;
  /** Toccato durante la sessione (mostra il badge "modificato"). */
  edited: boolean;
  /**
   * Sostituito con un altro esercizio (macchinario occupato…): il carico
   * svolto appartiene a quel movimento, **non** alla riga della scheda, quindi
   * non deve diventare il nuovo peso prescritto.
   */
  replaced?: boolean;
};

export type ActiveWorkoutDraft = {
  dayId: string;
  planId: string;
  /** Nome del giorno: serve al banner senza ricaricare la scheda. */
  dayName: string;
  /** Inizio sessione (ms da epoch): da qui si calcola la durata. */
  startedAt: number;
  /** Esercizio su cui era rimasto l'utente. */
  index: number;
  exercises: SessionExercise[];
  logs: SessionSetLog[][];
  /** Ultimo salvataggio: misura l'anzianità e la lunghezza della pausa. */
  updatedAt: number;
};

const KEY = "evolvi:active-workout";

/** Oltre quest'età la sessione sospesa si considera dimenticata. */
export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Pausa più lunga di questa non viene conteggiata nella durata quando la
 * sessione viene ripresa: senza questo, un allenamento lasciato aperto la
 * sera prima comparirebbe nello storico come una sessione di 18 ore.
 */
export const LONG_PAUSE_MS = 10 * 60 * 1000;

/**
 * Millisecondi dall'epoch. È `new Date().getTime()` e non `Date.now()`
 * perché il lint di React vieta `Date.now()` fuori dagli effect.
 */
export function nowMs(): number {
  return new Date().getTime();
}

/**
 * Le scritture si incolonnano: due salvataggi ravvicinati (uno per tasto
 * premuto) non si sovrappongono e l'ordine resta quello della sequenza.
 * Un errore di scrittura non rompe la coda successiva.
 */
let queue: Promise<void> = Promise.resolve();

/** Legge la sessione sospesa; le bozze scadute vengono cancellate. */
export async function loadActiveWorkout(): Promise<ActiveWorkoutDraft | null> {
  const draft = await getJson<ActiveWorkoutDraft>(KEY);
  if (!draft || typeof draft.updatedAt !== "number" || !Array.isArray(draft.exercises)) {
    return null;
  }
  if (nowMs() - draft.updatedAt > DRAFT_TTL_MS) {
    await clearActiveWorkout();
    return null;
  }
  return draft;
}

/** Salva (o riscrive) la sessione in corso, senza attendere la risposta. */
export function saveActiveWorkout(draft: ActiveWorkoutDraft): void {
  queue = queue.then(() => setJson(KEY, draft)).catch(() => undefined);
}

/** Rimuove la bozza: il promise risolve quando la cancellazione è andata a buon fine. */
export function clearActiveWorkout(): Promise<void> {
  queue = queue.then(() => removeItem(KEY)).catch(() => undefined);
  return queue;
}

/**
 * Inizio sessione al ripristino: le pause più lunghe di `LONG_PAUSE_MS`
 * vengono sottratte, quelle brevi (recupero fra le serie) restano.
 */
export function resumeStartedAt(draft: ActiveWorkoutDraft, now: number): number {
  const gap = Math.max(0, now - draft.updatedAt);
  return draft.startedAt + Math.max(0, gap - LONG_PAUSE_MS);
}

const TIME_FORMATTER = new Intl.DateTimeFormat("it-IT", {
  hour: "2-digit",
  minute: "2-digit",
});
const DAY_FORMATTER = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" });

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

/** "oggi alle 18:32", "ieri alle 18:32", "12 ott alle 18:32". */
export function formatDraftWhen(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date(nowMs());
  const yesterday = new Date(nowMs() - 24 * 60 * 60 * 1000);
  const dayLabel = sameDay(date, now)
    ? "oggi"
    : sameDay(date, yesterday)
      ? "ieri"
      : DAY_FORMATTER.format(date);
  return `${dayLabel} alle ${TIME_FORMATTER.format(date)}`;
}
