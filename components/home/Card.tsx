import { type PropsWithChildren } from "react";
import Animated, { type EntryOrExitLayoutType } from "react-native-reanimated";
import { useMotionOff } from "@/lib/anim";

type CardProps = PropsWithChildren<{
  className?: string;
  /** Animazione d'ingresso (es. `enterDown(80)` da `lib/anim.ts`). */
  entering?: EntryOrExitLayoutType;
}>;

/**
 * Contenitore base delle card della Home: superficie + bordo del tema.
 *
 * L'entrata ricevuta viene annullata quando è attivo il "riduci movimento"
 * (sistema o in-app): le animazioni di layout sono props statiche, quindi
 * è qui che le disattiviamo.
 */
export function Card({ children, className = "", entering }: CardProps) {
  const motionOff = useMotionOff();

  return (
    <Animated.View
      entering={motionOff ? undefined : entering}
      className={`rounded-2xl border border-border bg-surface p-5 ${className}`}
    >
      {children}
    </Animated.View>
  );
}
