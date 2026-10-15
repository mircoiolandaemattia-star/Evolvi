import { Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { CountUp } from "@/components/ui/CountUp";
import { useProgress } from "@/lib/anim";

type Props = {
  current: number; // 1-based
  total: number;
};

/**
 * Progresso dell'onboarding: quando si passa al passo successivo la barra
 * scorre al nuovo valore e la percentuale sale al contatore, invece di
 * sostituirsi di colpo.
 */
export function OnboardingProgressBar({ current, total }: Props) {
  const pct = Math.round((current / total) * 100);
  const progress = useProgress(pct / 100, { duration: 550 });
  const barStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="font-sans text-xs text-muted">
          Passo {current} di {total}
        </Text>
        <CountUp value={pct} duration={550} format={(v) => `${Math.round(v)}%`} className="font-inter-semibold text-xs text-primary" />
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-surface">
        <Animated.View className="h-2 rounded-full bg-primary" style={barStyle} />
      </View>
    </View>
  );
}
