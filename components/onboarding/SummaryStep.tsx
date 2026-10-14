import { Text, View } from "react-native";
import { Flame, Drum, Wheat, Droplets } from "lucide-react-native";
import { type ActivityLevel, type Gender, type Goal } from "@/lib/calorieCalculator";
import { ACTIVITY_TO_API, GOAL_TO_API } from "@/lib/profileQueries";
import { computeTargets } from "@/src/api/lib/tdee";

type Props = {
  weight: number;
  height: number;
  birthDate: Date;
  gender: Gender | string;
  activity: ActivityLevel | string;
  goal: Goal | string;
};

/**
 * Mostra gli stessi numeri che il server scriverà nella riga profilo:
 * kcal e macro arrivano tutti da `computeTargets`, non da percentuali
 * fisse. Il 30/45/25 che c'era prima era un'altra versione della
 * suddivisione — le proteine, per esempio, venivano 166 g dove il server
 * ne salva 108.
 */
export function SummaryStep({ weight, height, birthDate, gender, activity, goal }: Props) {
  const targets = computeTargets({
    birthDate,
    gender,
    heightCm: height,
    weightKg: weight,
    // Il passaggio è raggiungibile solo con obiettivo e attività scelti:
    // il ripiego serve al type checker, non a runtime.
    goal: GOAL_TO_API[goal as Goal] ?? "maintain",
    activityLevel: ACTIVITY_TO_API[activity as ActivityLevel] ?? "sedentary",
  });

  return (
    <View className="gap-6">
      <View className="items-center gap-2">
        <View className="h-16 w-16 items-center justify-center rounded-3xl bg-primary/15">
          <Flame size={28} color="#F97316" />
        </View>
        <Text className="font-sans text-sm text-muted">Il tuo fabbisogno stimato</Text>
        <Text className="font-inter-bold text-4xl text-primary">{targets.daily_calorie_target} kcal / giorno</Text>
        <Text className="text-center font-sans text-xs text-muted">Mifflin-St Jeor + TDEE. Valore indicativo.</Text>
      </View>

      <View className="rounded-2xl border border-border bg-surface p-4">
        <Text className="font-inter-semibold text-sm text-foreground">Suddivisione macro consigliata</Text>
        <View className="mt-4 gap-3">
          <View className="flex-row items-center gap-3">
            <View className="h-9 w-9 items-center justify-center rounded-xl bg-primary/15">
              <Drum size={16} color="#F97316" />
            </View>
            <View className="flex-1">
              <Text className="font-sans text-xs text-muted">Proteine</Text>
              <Text className="font-inter-semibold text-sm text-foreground">{targets.protein_target_g} g</Text>
            </View>
          </View>
          <View className="flex-row items-center gap-3">
            <View className="h-9 w-9 items-center justify-center rounded-xl bg-accent/15">
              <Wheat size={16} color="#22C55E" />
            </View>
            <View className="flex-1">
              <Text className="font-sans text-xs text-muted">Carboidrati</Text>
              <Text className="font-inter-semibold text-sm text-foreground">{targets.carbs_target_g} g</Text>
            </View>
          </View>
          <View className="flex-row items-center gap-3">
            <View className="h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15">
              <Droplets size={16} color="#F59E0B" />
            </View>
            <View className="flex-1">
              <Text className="font-sans text-xs text-muted">Grassi</Text>
              <Text className="font-inter-semibold text-sm text-foreground">{targets.fat_target_g} g</Text>
            </View>
          </View>
        </View>
      </View>

      <Text className="text-center font-sans text-xs leading-4 text-muted">Potrai modificare questi valori in qualsiasi momento dal profilo.</Text>
    </View>
  );
}
