import { useState } from "react";
import { Text, View } from "react-native";
import { ChevronRight, Clock, Flame } from "lucide-react-native";
import type { WorkoutSession } from "@/types";
import { Card } from "@/components/home/Card";
import { CountUp } from "@/components/ui/CountUp";
import { PressableScale } from "@/lib/reveal";
import { SessionDetailModal } from "./SessionDetailModal";

type WorkoutHistoryListProps = {
  sessions: WorkoutSession[];
  /** Nome dei giorni per id: la sessione conserva solo i riferimenti. */
  dayNames: Record<string, string>;
  /**
   * Nomi degli esercizi per id: coprono le sessioni salvate senza `name`
   * interno al `performed_data` (es. quelle registrate in precedenza).
   */
  exerciseNames?: Record<string, string>;
};

const DATE_FORMATTER = new Intl.DateTimeFormat("it-IT", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

function formatDate(iso: string): string {
  try {
    return DATE_FORMATTER.format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * Storico delle sessioni: data, giorno di scheda, durata e (se presenti)
 * calorie. I dati arrivano da GET /api/workout-sessions via React Query.
 * Ogni riga entra con una cascata scaglionata e i numeri contano fino al
 * valore; toccando una riga si apre il dettaglio con tutte le serie svolte.
 */
export function WorkoutHistoryList({
  sessions,
  dayNames,
  exerciseNames = {},
}: WorkoutHistoryListProps) {
  const [selected, setSelected] = useState<WorkoutSession | null>(null);

  if (sessions.length === 0) {
    return (
      <Card>
        <Text className="font-sans text-sm text-muted">
          Nessuna sessione registrata: completa il primo allenamento!
        </Text>
      </Card>
    );
  }

  return (
    <View className="gap-3">
      {sessions.map((session, index) => {
        const dayName = dayNames[session.dayId] ?? "Allenamento";
        return (
          <PressableScale
            key={session.id}
            onPress={() => setSelected(session)}
            accessibilityRole="button"
            accessibilityLabel={`Apri dettaglio della sessione del ${formatDate(session.endedAt)}`}
          >
            <Card className="p-4" delay={index * 70}>
              <View className="flex-row items-center gap-3">
                <View className="flex-1">
                  <Text className="font-inter-semibold text-sm text-foreground">{dayName}</Text>
                  <Text className="mt-0.5 font-sans text-xs text-muted">
                    {formatDate(session.endedAt)}
                  </Text>
                </View>

                <View className="flex-row items-center gap-2">
                  <View className="flex-row items-center gap-1.5 rounded-lg bg-accent/15 px-2.5 py-1.5">
                    <Clock size={14} color="#22C55E" strokeWidth={2.2} />
                    <Text className="font-inter-semibold text-xs text-accent">
                      <CountUp value={session.durationMinutes} /> min
                    </Text>
                  </View>
                  {/* Le kcal esistono solo nei dati mock: senza valore non si mostra. */}
                  {typeof session.caloriesBurned === "number" ? (
                    <View className="flex-row items-center gap-1.5 rounded-lg bg-primary/15 px-2.5 py-1.5">
                      <Flame size={14} color="#F97316" strokeWidth={2.2} />
                      <Text className="font-inter-semibold text-xs text-primary">
                        <CountUp value={session.caloriesBurned} /> kcal
                      </Text>
                    </View>
                  ) : null}
                  {/* Freccia: la riga è toccabile, il dettaglio è l'unico modo
                      di rivedere le serie svolte. */}
                  <ChevronRight size={18} color="#64748B" strokeWidth={2.2} />
                </View>
              </View>
            </Card>
          </PressableScale>
        );
      })}

      <SessionDetailModal
        session={selected}
        dayName={selected ? (dayNames[selected.dayId] ?? "Allenamento") : ""}
        exerciseNames={exerciseNames}
        onClose={() => setSelected(null)}
      />
    </View>
  );
}
