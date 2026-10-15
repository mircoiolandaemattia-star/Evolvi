import { type PropsWithChildren } from "react";
import Animated from "react-native-reanimated";
import { useRevealStyle } from "@/lib/reveal";

type CardProps = PropsWithChildren<{
  className?: string;
  /**
   * Ritardo (ms) dell'entrata, per la cascata scaglionata della schermata.
   * `undefined` disabilita l'animazione (card ferma, già dentro un
   * contenitore animato). L'entrata si **ripete a ogni cambio di tab**.
   */
  delay?: number;
  /** Distanza (px) della salita dell'entrata (default 20). */
  distance?: number;
}>;

/**
 * Contenitore base delle card: superficie + bordo del tema.
 *
 * L'entrata è guidata dal focus (`lib/reveal.tsx`): così si rivede ogni
 * volta che si torna sulla tab, cosa che le `entering` mount-only non
 * facevano. Il "riduci movimento" è gestito dentro `useRevealStyle`.
 */
export function Card({ children, className = "", delay, distance }: CardProps) {
  const animated = useRevealStyle(delay, distance);

  return (
    <Animated.View
      style={animated}
      className={`rounded-2xl border border-border bg-surface p-5 ${className}`}
    >
      {children}
    </Animated.View>
  );
}
