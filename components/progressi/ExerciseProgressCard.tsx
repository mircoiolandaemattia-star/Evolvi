import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { ExerciseProgress } from "@/lib/progressQueries";
import { TrendChart, formatTrendValue } from "./TrendChart";

type Metric = "weight" | "reps";

type Props = {
  /** Progressi del periodo, più allenati in cima. */
  items: ExerciseProgress[];
};

const METRICS: { key: Metric; label: string }[] = [
  { key: "weight", label: "Peso" },
  { key: "reps", label: "Reps" },
];

/**
 * Progresso per esercizio: orizzontale dei nomi (quelli allenati più spesso
 * in cima), toggle Peso/Reps e il grafico della metrica scelta, ricavato
 * dalle serie del `performed_data` delle sessioni del periodo.
 */
export function ExerciseProgressCard({ items }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>("weight");

  // La selezione non segue più la lista (cambio periodo): torna al primo.
  const selected =
    items.find((item) => item.exerciseId === selectedId) ?? items[0] ?? null;

  const series = selected?.points ?? [];
  const points =
    metric === "weight"
      ? series
          .filter((point) => point.weight > 0)
          .map((point) => ({ date: point.date, label: point.label, value: point.weight }))
      : series
          .filter((point) => point.reps > 0)
          .map((point) => ({ date: point.date, label: point.label, value: point.reps }));

  if (!selected) return null;

  const unit = metric === "weight" ? "kg" : "rip.";
  const decimals = metric === "weight" ? 1 : 0;
  const record =
    points.length > 0 ? Math.max(...points.map((point) => point.value)) : null;
  const summary = [
    `${selected.points.length} ${selected.points.length === 1 ? "sessione" : "sessioni"}`,
    `${selected.sets} serie`,
    ...(record != null ? [`record ${formatTrendValue(record, decimals)} ${unit}`] : []),
  ].join(" · ");

  return (
    <View className="gap-3">
      {/* Esercizi allenati nel periodo: scorrimento orizzontale */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 pr-2"
      >
        {items.map((item) => {
          const active = item.exerciseId === selected.exerciseId;
          return (
            <Pressable
              key={item.exerciseId}
              onPress={() => setSelectedId(item.exerciseId)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              className={`rounded-full border px-3.5 py-2 active:opacity-80 ${
                active ? "border-primary bg-primary" : "border-border bg-surface"
              }`}
            >
              <Text
                className={`font-inter-semibold text-xs ${
                  active ? "text-primary-foreground" : "text-muted"
                }`}
              >
                {item.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Toggle metrica */}
      <View className="flex-row gap-2 rounded-full bg-background p-1">
        {METRICS.map((option) => {
          const active = metric === option.key;
          return (
            <Pressable
              key={option.key}
              onPress={() => setMetric(option.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              className={`flex-1 items-center rounded-full py-2 active:opacity-80 ${
                active ? "bg-primary" : ""
              }`}
            >
              <Text
                className={`font-inter-semibold text-sm ${
                  active ? "text-primary-foreground" : "text-muted"
                }`}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <TrendChart
        points={points}
        unit={unit}
        decimals={decimals}
        emptyText={
          metric === "weight"
            ? "Nessun carico registrato: quest'esercizio è a corpo libero."
            : "Nessuna ripetizione registrata per questo esercizio."
        }
      />

      <Text className="font-sans text-xs text-muted">{summary}</Text>
    </View>
  );
}
