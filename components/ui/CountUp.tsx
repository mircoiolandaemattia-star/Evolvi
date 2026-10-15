import { Text, type TextProps } from "react-native";
import { useCountUp } from "@/lib/anim";

type CountUpProps = Omit<TextProps, "children"> & {
  /** Valore finale verso cui l'animazione converge. */
  value: number;
  /** Formattazione del valore in transito; default: intero arrotondato. */
  format?: (value: number) => string;
  /** Durata in ms (default 750). */
  duration?: number;
  /** Ritardo in ms prima di partire (default 0). */
  delay?: number;
};

/**
 * Testo con numero "al contatore": sale dal valore precedente fino a
 * `value` con easing (vedi `lib/anim.ts`). Il conteggio vive dentro questo
 * componente, quindi ogni frame rirendera solo il singolo testo e non
 * l'intera schermata. Con "riduci movimento" attivo mostra subito `value`.
 */
export function CountUp({ value, format, duration, delay, ...rest }: CountUpProps) {
  const animated = useCountUp(value, { duration, delay });
  const text = format ? format(animated) : String(Math.round(animated));
  return <Text {...rest}>{text}</Text>;
}
