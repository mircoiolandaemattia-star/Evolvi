import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, isApiError } from "./api";
import type { ActivityLevel, Goal } from "./calorieCalculator";

/**
 * Riga `users` restituita dall'API (snake_case, come il DB):
 * una sola riga per utente, non esiste un `:id`.
 */
export interface ApiProfile {
  id: string;
  email: string;
  name: string;
  birth_date: string | null;
  gender: "male" | "female" | "other" | null;
  height_cm: number | null;
  weight_kg: number | null;
  goal: string;
  activity_level: string;
  daily_calorie_target: number | null;
  protein_target_g: number | null;
  carbs_target_g: number | null;
  fat_target_g: number | null;
  subscription_status: string;
  subscription_expires_at: string | null;
  created_at: string;
}

/** Corpo di POST /api/users: solo dati del profilo, l'identità è nel token. */
export interface CreateProfileInput {
  name: string;
  birth_date: string;
  gender: "male" | "female" | "other";
  height_cm: number;
  weight_kg: number;
  goal: "lose" | "maintain" | "gain";
  activity_level: "sedentary" | "light" | "moderate" | "active";
}

/** Enum dell'app → enum del backend (i due dizionari non coincidono). */
export const GOAL_TO_API: Record<Goal, CreateProfileInput["goal"]> = {
  dimagrire: "lose",
  mantenimento: "maintain",
  massa: "gain",
};

export const ACTIVITY_TO_API: Record<ActivityLevel, CreateProfileInput["activity_level"]> = {
  sedentary: "sedentary",
  light: "light",
  moderate: "moderate",
  high: "active",
};

/**
 * Dizionari inversi: il backend parla "lose"/"active", l'app "dimagrire"/
 * "high". Senza queste mappe il profilo non evidenziava mai l'obiettivo
 * (e il livello) scelti, perché i due enum non coincidono.
 */
export const GOAL_FROM_API: Record<CreateProfileInput["goal"], Goal> = {
  lose: "dimagrire",
  maintain: "mantenimento",
  gain: "massa",
};

export const ACTIVITY_FROM_API: Record<CreateProfileInput["activity_level"], ActivityLevel> = {
  sedentary: "sedentary",
  light: "light",
  moderate: "moderate",
  active: "high",
};

/** `goal` del server → `Goal` dell'app, `null` se il valore è sconosciuto. */
export function goalFromApi(goal: string | null | undefined): Goal | null {
  if (!goal) return null;
  return GOAL_FROM_API[goal as CreateProfileInput["goal"]] ?? null;
}

/** `activity_level` del server → `ActivityLevel` dell'app, `null` se sconosciuto. */
export function activityFromApi(level: string | null | undefined): ActivityLevel | null {
  if (!level) return null;
  return ACTIVITY_FROM_API[level as CreateProfileInput["activity_level"]] ?? null;
}

/**
 * L'onboarding raccoglie l'età anagrafica, il backend vuole `birth_date`:
 * deriviamo il 1° gennaio dell'anno (oggi − età). La precisione è annuale,
 * che è esattamente la precisione usata dal calcolo TDEE.
 */
export function birthDateFromAge(age: number): string {
  return `${new Date().getFullYear() - age}-01-01`;
}

/**
 * Data → "YYYY-MM-DD" a mezzanotte UTC, il formato che il backend si
 * aspetta per `birth_date`.
 */
export function toIsoDate(date: Date): string {
  const p = birthDateParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

/**
 * Data → i tre campi del form di nascita. Pezzi UTC, come la memorizza il
 * backend, e tutti vuoti se la data manca.
 */
export function birthDateParts(date: Date | null): { day: string; month: string; year: string } {
  if (!date) return { day: "", month: "", year: "" };
  const pad = (n: number) => String(n).padStart(2, "0");
  return { day: pad(date.getUTCDate()), month: pad(date.getUTCMonth() + 1), year: String(date.getUTCFullYear()) };
}

/**
 * Data di nascita dai tre campi dell'onboarding. Ritorna `null` se i numeri
 * non formano una data reale: 31/02 va scartato (il costruttore `Date`
 * lo normalizzerebbe in 03/03 senza dirlo a nessuno), come un futuro.
 * A mezzanotte UTC, come la memorizza il backend.
 */
export function birthDateFromParts(day: string, month: string, year: string): Date | null {
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) return null;
  if (y < 1900 || m < 1 || m > 12 || d < 1 || d > 31) return null;

  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return null;
  }

  // "Oggi" è la data locale (quella che l'utente vede): niente nascite future.
  const now = new Date();
  if (date.getTime() > Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) return null;
  return date;
}

/**
 * `birth_date` arriva come "2009-03-14", "2009-03-14 00:00:00" oppure ISO
 * con la Z: si legge solo la parte di data e si assume mezzanotte UTC.
 * `new Date()` puro interpreterebbe l'orario come ora locale e a fusi
 * positivi sposterebbe il compleanno di un giorno — l'età, e quindi il
 * fabbisogno, ne risentirebbero.
 */
export function parseStoredBirthDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export const profileKeys = {
  /** Una riga per utente: una sola chiave, invalidata al login/onboarding. */
  me: ["profile", "me"] as const,
};

/** 404 su GET /users/me = onboarding non completato (non un errore di rete). */
export function isProfileMissing(error: unknown): boolean {
  return isApiError(error) && error.status === 404;
}

/**
 * Profilo dell'utente autenticato. Il 404 è atteso al primo avvio (riga
 * inesistente): viene gestito dal guard di navigazione, non ritentato.
 */
export function useProfile(enabled = true) {
  return useQuery({
    queryKey: profileKeys.me,
    queryFn: () => api.get<ApiProfile>("/users/me"),
    enabled,
    // Gli errori HTTP 4xx sono risposte, non intoppi: mai in retry.
    retry: (failureCount, error) =>
      isApiError(error) ? error.status >= 500 && failureCount < 1 : failureCount < 2,
  });
}

/** Crea la riga profilo (POST /api/users) e aggiorna subito la cache. */
export function useCreateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProfileInput) => api.post<ApiProfile>("/users", input),
    onSuccess: (profile) => {
      // Annulla il 404 appena letto e ri-verifica col server.
      queryClient.setQueryData(profileKeys.me, profile);
      void queryClient.invalidateQueries({ queryKey: profileKeys.me });
    },
  });
}

/** PUT /api/users/me: aggiorna obiettivo/attività/dati personali (ricalcola TDEE lato server). */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<CreateProfileInput>) => api.put<ApiProfile>("/users/me", patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profileKeys.me });
    },
  });
}
