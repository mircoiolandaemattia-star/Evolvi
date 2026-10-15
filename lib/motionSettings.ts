import { useSyncExternalStore } from "react";
import { getJson, setJson } from "./storage";

/**
 * Preferenza in-app "riduci movimento", salvata sul dispositivo.
 *
 * Esiste oltre all'impostazione di sistema (Reanimated la legge da sola):
 * non tutti la conoscono e some utenti la vogliono solo per l'app. Le
 * animazioni di `lib/anim.ts` sono disattivate quando è attiva **oppure**
 * quando è attiva quella di sistema.
 */
const STORAGE_KEY = "evolvi_reduce_motion";

/** Valore corrente (aggiornato da `loadReduceMotion` all'avvio). */
let enabled = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

/**
 * Legge la preferenza da disco la prima volta (chiamare all'avvio dell'app).
 * Non blocca nulla: le animazioni partono con il valore già noto e, se era
 * diverso, viene aggiornato appena il disco risponde.
 */
export async function loadReduceMotion(): Promise<void> {
  const stored = await getJson<boolean>(STORAGE_KEY);
  if (typeof stored === "boolean" && stored !== enabled) {
    enabled = stored;
    emit();
  }
}

/** Cambia e persiste la preferenza. */
export async function setReduceMotion(value: boolean): Promise<void> {
  enabled = value;
  emit();
  try {
    await setJson(STORAGE_KEY, value);
  } catch {
    // AsyncStorage non disponibile (es. storage di browser bloccato):
    // la preferenza resta valida per questa sessione.
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Preferenza corrente (SSR: false). */
export function useReduceMotionSetting(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => enabled,
    () => false,
  );
}
