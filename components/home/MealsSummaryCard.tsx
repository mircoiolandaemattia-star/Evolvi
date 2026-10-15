import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Plus, UtensilsCrossed } from "lucide-react-native";
import type { Meal } from "@/types";
import { suggestedMealType } from "@/lib/dietaStore";
import { PressableScale } from "@/lib/reveal";
import { Card } from "./Card";

type MealsSummaryCardProps = {
  meals: Meal[];
};

/**
 * Card "Pasti di oggi": elenco pasti con calorie e bottone "+" che apre
 * **direttamente** il modal di inserimento del Dieta per il pasto del
 * momento (dall'ora corrente), saltando il passaggio per la tab.
 *
 * Toccando una riga si apre invece il Dieta sulla giornata.
 */
export function MealsSummaryCard({ meals }: MealsSummaryCardProps) {
  function openAddMeal() {
    router.navigate({
      pathname: "/(tabs)/dieta",
      params: { addMeal: suggestedMealType() },
    });
  }

  return (
    <Card delay={260}>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <View className="h-11 w-11 items-center justify-center rounded-xl bg-accent/15">
            <UtensilsCrossed size={22} color="#22C55E" strokeWidth={2.2} />
          </View>
          <Text className="font-inter-semibold text-base text-foreground">Pasti di oggi</Text>
        </View>

        <PressableScale
          onPress={openAddMeal}
          accessibilityRole="button"
          accessibilityLabel="Aggiungi un pasto"
          hitSlop={8}
          scaleTo={0.88}
          className="h-11 w-11 items-center justify-center rounded-xl bg-primary/15 active:opacity-80 cursor-pointer"
        >
          <Plus size={22} color="#F97316" strokeWidth={2.5} />
        </PressableScale>
      </View>

      {meals.length === 0 ? (
        <Pressable
          onPress={openAddMeal}
          accessibilityRole="button"
          accessibilityLabel="Registra il primo pasto di oggi"
          className="mt-4 rounded-xl border border-dashed border-border px-4 py-6 active:opacity-80"
        >
          <Text className="text-center font-sans text-sm text-muted">
            Nessun pasto registrato — tocca qui per aggiungerne uno
          </Text>
        </Pressable>
      ) : (
        <View className="mt-4 gap-2">
          {meals.map((meal) => (
            <Pressable
              key={meal.id}
              onPress={() => router.navigate("/(tabs)/dieta")}
              accessibilityRole="button"
              accessibilityLabel={`${meal.type}, ${meal.totalCalories} calorie, apri il diario`}
              className="flex-row items-center justify-between rounded-xl bg-background/60 px-4 py-3 active:opacity-70"
            >
              <View className="flex-row items-center gap-2.5">
                <View className="h-2 w-2 rounded-full bg-primary" />
                <Text className="font-sans text-sm text-foreground">{meal.type}</Text>
              </View>
              <Text className="font-inter-semibold text-sm text-foreground">
                {meal.totalCalories} kcal
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </Card>
  );
}
