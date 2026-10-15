import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import {
  GestureResponderEvent,
  Platform,
  Pressable,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useFocusEffect } from "expo-router";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type AnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import { ChevronDown } from "lucide-react-native";
import { useReduceMotionSetting } from "./motionSettings";

/**
 * Sistema di animazione **guidato dal focus** (Reanimated).
 *
 * Le `entering` layout animation di Reanimated scattano solo al *mount*.
 * Con le tab di expo-router gli screen restano montati quando si cambia
 * tab, quindi le entrate si vedevano solo alla prima visita. Qui
 * l'entrata è pilotata da una shared value che viene **riazzerata a ogni
 * focus dello schermo**: così la cascata si rivede ogni volta che si
 * torna su una tab, senza smontare niente (posizione di scroll, dati e
 * stato dei form restano intatti).
 *
 * `RevealProvider` fa **una sola** subscription di focus per schermo (non
 * una per card) e la espone come contatore "epoch"; i componenti che
 * animano la consumano via `useRevealEpoch`.
 *
 * Come `lib/anim.ts`, tutto rispetta il "riduci movimento" (sistema o
 * in-app) e sul web (PWA statico) le animazioni vengono saltate.
 */

/** Durata tipica dell'entrata delle card (ms). */
export const ENTER_DURATION = 750;

/** `true` solo dove girano le animazioni native (escluso il web statico). */
export const IS_NATIVE = Platform.OS !== "web";

const EASE = Easing.bezier(0.22, 1, 0.36, 1);

const RevealContext = createContext(0);

/** Epoch corrente: aumenta a ogni focus dello schermo che contiene il provider. */
export function useRevealEpoch(): number {
  return useContext(RevealContext);
}

/**
 * Conteggio dei focus dello schermo. Il primo focus (il mount) NON
 * incrementa: le animazioni di entrata partono una volta sola al mount,
 * poi si ripetono a ogni ritorno sulla tab.
 */
export function RevealProvider({ children }: PropsWithChildren) {
  const [epoch, setEpoch] = useState(0);
  const first = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      setEpoch((e) => e + 1);
    }, []),
  );

  return <RevealContext.Provider value={epoch}>{children}</RevealContext.Provider>;
}

/** `true` quando le animazioni vanno saltate (sistema **o** in-app). */
export function useMotionOff(): boolean {
  const systemReduced = useReducedMotion();
  const appReduced = useReduceMotionSetting();
  return systemReduced || appReduced;
}

/**
 * Stile d'entrata "fade + sale" che si **riepiloga a ogni focus**.
 *
 * `delayMs === undefined` disabilita l'animazione (il contenuto resta
 * fermo): utile per le card annidate dentro un `<Reveal>` già animato.
 */
export function useRevealStyle(
  delayMs?: number,
  distance = 20,
): AnimatedStyle<ViewStyle> {
  const epoch = useRevealEpoch();
  const motionOff = useMotionOff();
  const enabled = delayMs !== undefined;
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!enabled || motionOff || !IS_NATIVE) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    const animated = withTiming(1, { duration: ENTER_DURATION, easing: EASE });
    progress.value = delayMs > 0 ? withDelay(delayMs, animated) : animated;
  }, [enabled, epoch, delayMs, motionOff, progress]);

  return useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * distance }],
  }));
}

/**
 * Progressione 0→1 che **riparte a ogni focus** dello schermo.
 *
 * Serve per animazioni "disegnate" (tracciato di un grafico, barre che
 * crescono) che devono rivedersi ogni volta che si torna sulla tab, non
 * solo al mount. Ritorna una shared value già avviata.
 */
export function useRevealProgress(
  delayMs = 0,
  duration = ENTER_DURATION,
): SharedValue<number> {
  const epoch = useRevealEpoch();
  const motionOff = useMotionOff();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (motionOff || !IS_NATIVE) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    const animated = withTiming(1, { duration, easing: EASE });
    progress.value = delayMs > 0 ? withDelay(delayMs, animated) : animated;
  }, [epoch, delayMs, duration, motionOff, progress]);

  return progress;
}

/** Contenitore animato che ripete la sua entrata a ogni focus dello schermo. */
export function Reveal({
  children,
  delay = 0,
  distance = 20,
  className,
  style,
}: PropsWithChildren<{
  delay?: number;
  distance?: number;
  className?: string;
  style?: StyleProp<ViewStyle>;
}>) {
  const animated = useRevealStyle(delay, distance);
  return (
    <Animated.View className={className} style={[style, animated]}>
      {children}
    </Animated.View>
  );
}

/**
 * Chevron che ruota di 180° quando l'elemento si espande: sostituisce lo
 * scambio fra `ChevronDown`/`ChevronUp`, che appariva di colpo.
 */
export function RotatingChevron({
  expanded,
  size = 18,
  color = "#94A3B8",
  strokeWidth = 2.2,
}: {
  expanded: boolean;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const progress = useSharedValue(0);
  const motionOff = useMotionOff();

  useEffect(() => {
    if (motionOff) {
      progress.value = expanded ? 1 : 0;
      return;
    }
    progress.value = withTiming(expanded ? 1 : 0, { duration: 260, easing: EASE });
  }, [expanded, motionOff, progress]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 180}deg` }],
  }));

  return (
    <Animated.View style={style}>
      <ChevronDown size={size} color={color} strokeWidth={strokeWidth} />
    </Animated.View>
  );
}

/**
 * Punto radio che "scatta" con uno spring quando selezionato, invece di
 * apparire di colpo. Usato nei selettori a scelta singola (Obiettivo,
 * Livello di attività). Il riempimento è un cerchio interno che cresce.
 */
export function RadioDot({
  selected,
  size = 24,
  color = "#F97316",
  borderColor,
  innerColor = "#0F172A",
}: {
  selected: boolean;
  size?: number;
  color?: string;
  borderColor?: string;
  innerColor?: string;
}) {
  const progress = useSharedValue(selected ? 1 : 0);
  const motionOff = useMotionOff();

  useEffect(() => {
    if (motionOff) {
      progress.value = selected ? 1 : 0;
      return;
    }
    progress.value = withSpring(selected ? 1 : 0, { damping: 14, stiffness: 320 });
  }, [selected, motionOff, progress]);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: progress.value }],
  }));

  const inner = size * 0.42;

  return (
    <View
      style={{
        height: size,
        width: size,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: borderColor ?? (selected ? color : "#334155"),
      }}
    >
      <Animated.View
        style={[
          dotStyle,
          { height: inner, width: inner, borderRadius: inner / 2, backgroundColor: innerColor },
        ]}
      />
    </View>
  );
}

/**
 * Pressable con feedback di pressione "spring" (rimpicciolisce leggermente
 * al tocco e torna su al rilascio). Fa da base per i pulsanti principali,
 * dove un semplice `active:opacity` è poco reattivo.
 */
export function PressableScale({
  children,
  scaleTo = 0.96,
  disabled,
  style,
  onPressIn,
  onPressOut,
  ...rest
}: PropsWithChildren<
  Omit<PressableProps, "style"> & {
    /** Scala raggiunta durante la pressione (default 0.96). */
    scaleTo?: number;
    /** Stile statico (non la forma funzione di Pressable, per fonderlo con l'animazione). */
    style?: StyleProp<ViewStyle>;
  }
>) {
  const scale = useSharedValue(1);
  const motionOff = useMotionOff();
  // Lo stato di pressione vive in React: la regola di immutabilità del
  // compiler accetta le mutazioni dentro un `useEffect`, mentre un evento
  // inline che tocca la shared value viene segnalato. La molla parte
  // comunque sul UI thread.
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    if (motionOff) {
      scale.value = 1;
      return;
    }
    scale.value = withSpring(pressed ? scaleTo : 1, { damping: 15, stiffness: 320 });
  }, [pressed, scaleTo, motionOff, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      disabled={disabled}
      onPressIn={(e: GestureResponderEvent) => {
        setPressed(true);
        onPressIn?.(e);
      }}
      onPressOut={(e: GestureResponderEvent) => {
        setPressed(false);
        onPressOut?.(e);
      }}
      // Reanimated restituisce uno stile "handle" che il tipo di `style` di
      // Pressable non prevede esplicitamente: un cast mantiene intatto il
      // layout flessibile del contenuto (icona+testo) senza wrapper extra.
      style={[style, animatedStyle] as unknown as StyleProp<ViewStyle>}
      {...rest}
    >
      {children}
    </Pressable>
  );
}
