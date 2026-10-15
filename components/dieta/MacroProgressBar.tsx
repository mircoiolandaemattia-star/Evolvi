import { Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { CountUp } from "@/components/ui/CountUp";
import { useProgress } from "@/lib/anim";

type MacroProgressBarProps = {
  label: string;
  current: number;
  target: number;
  color: string;
  unit?: string;
};

/**
 * Barra di avanzamento di un macro. La barra scorre fino al nuovo rapporto
 * (così aggiungere un alimento la fa crescere invece di "teletrasportarla")
 * e il valore corrente sale al contatore. Sul web la barra resta statica,
 * il conteggio no.
 */
export function MacroProgressBar({ label, current, target, color, unit = "g" }: MacroProgressBarProps) {
  const ratio = target > 0 ? Math.min(current / target, 1) : 0;
  const progress = useProgress(ratio);
  const barStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <View className="gap-1.5">
      <View className="flex-row items-center justify-between">
        <Text className="font-inter-semibold text-xs text-muted">{label}</Text>
        <Text className="font-sans text-xs text-muted">
          <CountUp value={current} className="font-inter-semibold text-foreground" />
          <Text className="font-inter-semibold text-foreground">{unit}</Text>
          <Text className="text-muted"> / {target}{unit}</Text>
        </Text>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-background">
        <Animated.View className="h-2 rounded-full" style={[{ backgroundColor: color }, barStyle]} />
      </View>
    </View>
  );
}
