import { useEffect, useState } from "react";
import { Pressable, Text, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import type { Period } from "@/lib/progressQueries";
import { PERIOD_LABELS } from "@/lib/progressQueries";
import { useMotionOff } from "@/lib/reveal";

type Props = {
  value: Period;
  onChange: (p: Period) => void;
};

const OPTIONS: Period[] = ["week", "month", "3months"];
const PILL_SPRING = { damping: 18, stiffness: 260 };

export function PeriodSelector({ value, onChange }: Props) {
  const [containerW, setContainerW] = useState(0);
  const activeIndex = OPTIONS.indexOf(value);
  const motionOff = useMotionOff();

  const progress = useSharedValue(activeIndex);

  useEffect(() => {
    if (motionOff) {
      progress.value = activeIndex;
      return;
    }
    progress.value = withSpring(activeIndex, PILL_SPRING);
  }, [activeIndex, motionOff, progress]);

  // Geometria della pillola: padding 4 (p-1), gap 8 (gap-2), segmenti uguali.
  const PAD = 4;
  const GAP = 8;
  const innerW = Math.max(0, containerW - PAD * 2 - GAP * (OPTIONS.length - 1));
  const segmentW = innerW / OPTIONS.length;

  const pillStyle = useAnimatedStyle(() => {
    if (containerW === 0) return { opacity: 0 };
    const x = PAD + progress.value * (segmentW + GAP);
    return {
      opacity: 1,
      transform: [{ translateX: x }],
      width: segmentW,
    };
  });

  function handleLayout(e: LayoutChangeEvent) {
    setContainerW(e.nativeEvent.layout.width);
  }

  return (
    <View
      className="flex-row gap-2 rounded-full bg-surface p-1"
      onLayout={handleLayout}
    >
      {/* Pillola scorrevole dietro al segmento attivo */}
      <Animated.View
        pointerEvents="none"
        style={pillStyle}
        className="absolute bottom-1 left-0 top-1 rounded-full bg-primary"
      />
      {OPTIONS.map((p) => {
        const active = value === p;
        return (
          <Pressable
            key={p}
            onPress={() => onChange(p)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            className="flex-1 items-center rounded-full px-3 py-2.5 active:opacity-80"
          >
            <Text
              className={`font-inter-semibold text-sm ${
                active ? "text-primary-foreground" : "text-muted"
              }`}
            >
              {PERIOD_LABELS[p]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
