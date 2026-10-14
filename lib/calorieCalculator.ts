/**
 * Vocabolario dell'app per fabbisogno, obiettivo e attività: tipi e opzioni
 * mostrate nelle schermate.
 *
 * La formula del fabbisogno **non è più qui**. Vive in
 * `src/api/lib/tdee.ts` (`computeTargets`), che sia l'onboarding, il
 * ricalcolo dal profilo o l'anteprima a chiamare: è l'unica copia in
 * giro. C'era una seconda implementazione (Harris-Benedict, con delta
 * fissi per obiettivo) che produceva numeri diversi dal server — in
 * profilo si vedevano kcal che la Home non confermava.
 */

export type Gender = "male" | "female" | "other";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "high";
export type Goal = "dimagrire" | "mantenimento" | "massa";

export const GOAL_OPTIONS: { key: Goal; label: string; description: string }[] = [
  { key: "dimagrire", label: "Dimagrire", description: "Deficit moderato per favorire la perdita di grasso preservando la massa muscolare." },
  { key: "mantenimento", label: "Mantenimento", description: "Mantieni il peso attuale con equilibrio tra energia e attività." },
  { key: "massa", label: "Massa muscolare", description: "Surplus controllato per supportare ipertrofia e recupero." },
];

export const ACTIVITY_OPTIONS: { key: ActivityLevel; label: string; description: string }[] = [
  { key: "sedentary", label: "Sedentario", description: "Poco o nessun esercizio, lavoro d'ufficio." },
  { key: "light", label: "Leggermente attivo", description: "Esercizio leggero 1-3 giorni a settimana." },
  { key: "moderate", label: "Moderatamente attivo", description: "Esercizio moderato 3-5 giorni a settimana." },
  { key: "high", label: "Molto attivo", description: "Esercizio intenso 6-7 giorni a settimana." },
];
