import { type PropsWithChildren } from "react";
import Animated, { type EntryOrExitLayoutType } from "react-native-reanimated";

type CardProps = PropsWithChildren<{
  className?: string;
  /** Animazione d'ingresso (es. `enterDown(80)` da `lib/anim.ts`). */
  entering?: EntryOrExitLayoutType;
}>;

/**
 * Contenitore base delle card della Home: superficie + bordo del tema.
 */
export function Card({ children, className = "", entering }: CardProps) {
  return (
    <Animated.View entering={entering} className={`rounded-2xl border border-border bg-surface p-5 ${className}`}>
      {children}
    </Animated.View>
  );
}
