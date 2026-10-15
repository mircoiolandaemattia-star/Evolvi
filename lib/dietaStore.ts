/**
 * Helper condivisi della schermata Dieta: etichette dei pasti e utility data.
 * I dati (pasti, alimenti, totali) arrivano da React Query: `lib/dietQueries.ts`.
 */

/** Tipi pasto supportati (etichette UI; l'API usa gli enum `meal_type`). */
export const MEAL_TYPES = ["Colazione", "Pranzo", "Cena", "Snack"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

/**
 * Pasto più probabile per l'ora corrente: serve all'aggiunta rapida dalla
 * Home, dove il "+" apre subito il modal del pasto del momento
 * (5-11 colazione, 11-15 pranzo, 15-18 snack, altrimenti cena).
 */
export function suggestedMealType(date: Date = new Date()): MealType {
  const hour = date.getHours();
  if (hour >= 5 && hour < 11) return "Colazione";
  if (hour >= 11 && hour < 15) return "Pranzo";
  if (hour >= 15 && hour < 18) return "Snack";
  return "Cena";
}

/* ------------------------------------------------------------------ */
/* Helpers per data (in fuso LOCALE: il giorno dell'app è quello utente) */
/* ------------------------------------------------------------------ */

export function formatDayLabel(date: Date): string {
  const today = new Date();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  if (isToday) return "Oggi";
  return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" }).format(date);
}

/** Data locale → `YYYY-MM-DD` (con `toISOString` si finirebbe sul giorno UTC). */
export function dateToString(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(date: Date, offset: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + offset);
  return d;
}
