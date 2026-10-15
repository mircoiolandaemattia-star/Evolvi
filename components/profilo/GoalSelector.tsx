import { Pressable, Text, View } from "react-native";
import { Card } from "@/components/home/Card";
import { RadioDot } from "@/lib/reveal";
import { GOAL_OPTIONS, type Goal } from "@/lib/calorieCalculator";

type Props = {
  value: Goal | string | null;
  readOnly?: boolean;
  onChange: (g: Goal) => void;
};

/**
 * Il fabbisogno non è più calcolato qui: è in `TdeeCard`, un riepilogo
 * solo per Obiettivo e Livello di attività mostrava lo stesso numero
 * due volte, con una formula diversa da quella della Home.
 */
export function GoalSelector({ value, readOnly = false, onChange }: Props) {
  return (
    <Card className="gap-4">
      <Text className="font-inter-semibold text-base text-foreground">Obiettivo</Text>

      <View className="gap-2">
        {GOAL_OPTIONS.map((o) => {
          const active = value === o.key;
          return (
            <Pressable
              key={o.key}
              disabled={readOnly}
              onPress={() => onChange(o.key)}
              className={`rounded-xl border px-4 py-3.5 active:opacity-80 ${active ? "border-primary bg-primary/15" : "border-border bg-background/40"} ${readOnly ? "opacity-60" : ""}`}
            >
              <View className="flex-row items-center justify-between gap-2">
                <View className="flex-1 gap-0.5">
                  <Text className={`font-inter-semibold text-sm ${active ? "text-primary" : "text-foreground"}`}>{o.label}</Text>
                  <Text className="font-sans text-xs leading-4 text-muted">{o.description}</Text>
                </View>
                <RadioDot selected={active} size={24} color="#F97316" />
              </View>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}
