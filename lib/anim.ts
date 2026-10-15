import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import {
  FadeIn,
  FadeInDown,
  FadeOut,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  Easing,
  type EntryOrExitLayoutType,
  type SharedValue,
} from "react-native-reanimated";
import { useReduceMotionSetting } from "./motionSettings";

/**
 * Micro-animazioni condivise (Reanimated + contatori).
 *
 * Due famiglie:
 * - `useCountUp` / `<CountUp>`: numeri che "contano" fino al valore. Il loop
 *   gira su `requestAnimationFrame` nel JS thread e vive dentro il piccolo
 *   componente che renderizza il testo, così le rirenderi restano locali.
 * - `useProgress` / `enterDown`: barre, ring e entrate delle card, animati
 *   sul UI thread da Reanimated.
 *
 * Ogni animazione rispetta il "riduci movimento", che può venire da due
 * posti: l'impostazione di sistema (letta da Reanimated) e quella in-app
 * in Profilo (`lib/motionSettings.ts`). Con uno dei due attivo i valori
 * arrivano subito al target, senza transizioni.
 */

/** Durata tipica delle micro-animazioni (ms). */
export const ANIM_DURATION = 750;

/** Durata dell'entrata delle card (ms): lenta abbastanza da essere notata. */
export const ENTER_DURATION = 750;

/** `true` solo dove girano le animazioni native (escluso il web statico). */
export const IS_NATIVE = Platform.OS !== "web";

const EASE = Easing.bezier(0.22, 1, 0.36, 1);

type TimingOptions = {
  /** Durata in ms (default `ANIM_DURATION`). */
  duration?: number;
  /** Ritardo in ms prima di partire (default 0). */
  delay?: number;
};

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** easeOutCubic puro: usato dai contatori, senza passare per le worklet. */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * `true` quando le animazioni vanno saltate: impostazione di sistema
 * **o** in-app (Profilo → Impostazioni → Riduci movimento).
 */
export function useMotionOff(): boolean {
  const systemReduced = useReducedMotion();
  const appReduced = useReduceMotionSetting();
  return systemReduced || appReduced;
}

/**
 * Numero che conta fino a `target`.
 *
 * Parte dal valore corrente (0 al primo render) e raggiunge `target` con
 * easing; se `target` cambia durante l'animazione (dati che arrivano dal
 * backend) riparte da ciò che è già stato mostrato, senza scatti.
 */
export function useCountUp(target: number, options: TimingOptions = {}): number {
  const { duration = ANIM_DURATION, delay = 0 } = options;
  const motionOff = useMotionOff();
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    // Nessun cambio (o partenza già sul target): niente loop.
    if (from === target) return;

    // Con "riduci movimento" si salta direttamente al valore finale.
    const totalDuration = motionOff ? 0 : duration;
    let raf = 0;
    let startedAt = 0;

    const tick = (now: number) => {
      if (startedAt === 0) startedAt = now + delay;
      const t = totalDuration === 0 ? 1 : clamp01((now - startedAt) / totalDuration);
      const current = from + (target - from) * easeOutCubic(t);
      fromRef.current = current;
      setValue(current);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
        setValue(target);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, delay, motionOff]);

  return value;
}

/**
 * Progressione 0→1 animata sul UI thread (per ring SVG e barre di
 * progresso con larghezza in percentuale).
 *
 * Al primo render parte da 0: così il ring "cresce" quando la card compare.
 * Sui valori già noti non c'è nessun salto: l'effetto parte dal valore
 * corrente della shared value.
 */
export function useProgress(ratio: number, options: TimingOptions = {}): SharedValue<number> {
  const { duration = ANIM_DURATION, delay = 0 } = options;
  const motionOff = useMotionOff();
  const target = clamp01(ratio);
  const progress = useSharedValue(0);

  useEffect(() => {
    // Con riduci movimento (o sul web) il valore arriva subito: niente anima.
    if (motionOff || !IS_NATIVE) {
      progress.value = target;
      return;
    }
    // Reanimated 4 non accetta `delay` in `withTiming`: il ritardo va da `withDelay`.
    const animated = withTiming(target, { duration, easing: EASE });
    progress.value = delay > 0 ? withDelay(delay, animated) : animated;
  }, [target, duration, delay, motionOff, progress]);

  return progress;
}

/**
 * Entrata morbida "scaglionata" per le card di una schermata:
 * `entering={enterDown(120)}` — fade + discesa lenta (750ms), così la
 * cascata si vede mentre si guarda lo schermo.
 *
 * Restituisce `undefined` sul web: le animazioni di layout lì sono omesse
 * per non rischiare elementi invisibili nel PWA, che resta statico e leggibile.
 */
export function enterDown(delayMs = 0): EntryOrExitLayoutType | undefined {
  if (!IS_NATIVE) return undefined;
  return FadeInDown.delay(delayMs).duration(ENTER_DURATION).easing(EASE);
}

/**
 * Cascata scaglionata per N card: `cards.map((c, i) => <Card entering={enterStagger(i)} …>)`.
 * `step` è lo scarto tra una card e la successiva (default 130ms).
 */
export function enterStagger(index: number, step = 130): EntryOrExitLayoutType | undefined {
  return enterDown(index * step);
}

/**
 * Entrata/uscita dei contenuti che si espandono (sezioni pasto, filtri):
 * più rapida delle card (260/160ms), perché segue un tocco immediato.
 * `delayMs` serve a dare una mini-cascata alle righe di un elenco.
 *
 * `off` è il valore di `useMotionOff()`: le entering animation sono props
 * statiche, quindi il "riduci movimento" va passato a mano.
 */
export function expandIn(off = false, delayMs = 0): EntryOrExitLayoutType | undefined {
  if (off || !IS_NATIVE) return undefined;
  return FadeInDown.delay(delayMs).duration(260).easing(EASE);
}

export function expandOut(off = false): EntryOrExitLayoutType | undefined {
  if (off || !IS_NATIVE) return undefined;
  return FadeOut.duration(160).easing(EASE);
}

/**
 * Entrata di un pannello dentro un modal: dissolvenza rapida dal basso.
 * Stessa logica di `expandIn` per il "riduci movimento".
 */
export function modalIn(off = false): EntryOrExitLayoutType | undefined {
  if (off || !IS_NATIVE) return undefined;
  return FadeIn.duration(220).easing(EASE);
}
