import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import {
  FadeInDown,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  Easing,
  type EntryOrExitLayoutType,
  type SharedValue,
} from "react-native-reanimated";

/**
 * Micro-animazioni condivise (Reanimated + contatori).
 *
 * Due famiglie:
 * - `useCountUp` / `<CountUp>`: numeri che "contano" fino al valore. Il loop
 *   gira su `requestAnimationFrame` nel JS thread e vive dentro il piccolo
 *   componente che renderizza il testo, così le rirenderi restano locali e
 *   funziona anche sul web (dove invece le animazioni di layout sono omesse).
 * - `useProgress` / `enterDown`: barre, ring e entrate delle card, animati
 *   sul UI thread da Reanimated.
 *
 * In entrambi i casi vale l'impostazione di accessibilità "riduci movimento":
 * con reduce motion attivo i valori arrivano subito al target.
 */

/** Durata tipica delle micro-animazioni (ms). */
export const ANIM_DURATION = 750;

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
 * Numero che conta fino a `target`.
 *
 * Parte dal valore corrente (0 al primo render) e raggiunge `target` con
 * easing; se `target` cambia durante l'animazione (dati che arrivano dal
 * backend) riparte da ciò che è già stato mostrato, senza scatti.
 * Con reduce motion attivo assegna `target` direttamente.
 */
export function useCountUp(target: number, options: TimingOptions = {}): number {
  const { duration = ANIM_DURATION, delay = 0 } = options;
  const reduced = useReducedMotion();
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    // Nessun cambio (o partenza già sul target): niente loop.
    if (from === target) return;

    // Con "riduci movimento" si salta direttamente al valore finale.
    const totalDuration = reduced ? 0 : duration;
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
  }, [target, duration, delay, reduced]);

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
  const reduced = useReducedMotion();
  const target = clamp01(ratio);
  const progress = useSharedValue(0);

  useEffect(() => {
    // Con reduce motion (o sul web) il valore arriva subito: nessuna anima.
    if (reduced || !IS_NATIVE) {
      progress.value = target;
      return;
    }
    // Reanimated 4 non accetta `delay` in `withTiming`: il ritardo va da `withDelay`.
    const animated = withTiming(target, { duration, easing: EASE });
    progress.value = delay > 0 ? withDelay(delay, animated) : animated;
  }, [target, duration, delay, reduced, progress]);

  return progress;
}

/**
 * Entrata morbida "scaglionata" per le card di una schermata:
 * `entering={enterDown(80)}`.
 *
 * Restituisce `undefined` sul web: le animazioni di layout lì sono omesse
 * per non rischiare elementi invisibili nel PWA, che resta statico e leggibile.
 */
export function enterDown(delayMs = 0): EntryOrExitLayoutType | undefined {
  if (!IS_NATIVE) return undefined;
  return FadeInDown.delay(delayMs).duration(480).easing(EASE);
}
