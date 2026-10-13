import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { CheckCircle2, ChevronRight, Dumbbell, Moon } from "lucide-react-native";
import type { WorkoutDay, WorkoutSession } from "@/types";
import { Card } from "./Card";

/** "18:32" — ora locale di fine sessione. */
const TIME_FORMATTER = new Intl.DateTimeFormat("it-IT", {
  hour: "2-digit",
  minute: "2-digit",
});

type WorkoutTodayCardProps = {
  /** Giorno programmato per oggi; null se non c'è allenamento. */
  day: WorkoutDay | null;
  /**
   * Sessione chiusa oggi su questo giorno (ultima, se ce ne sono più):
   * la card allora racconta il fatto invece di proporre l'avvio.
   */
  session?: WorkoutSession | null;
};

/**
 * Card "Allenamento di oggi": mostra il giorno di scheda e il bottone
 * per iniziare la sessione, oppure lo stato di riposo — e, quando la
 * sessione di oggi è già stata conclusa, "Allenamento completato".
 */
export function WorkoutTodayCard({ day, session = null }: WorkoutTodayCardProps) {
  const isRestDay = day === null || day.isRestDay;
  /** C'è un allenamento programmato ed è già stato concluso oggi. */
  const completed = !isRestDay && session !== null;

  function handleStart() {
    if (!day || isRestDay) return;
    router.push({
      pathname: "/(tabs)/scheda/allenamento/[dayId]",
      params: { dayId: day.id },
    });
  }

  return (
    <Card>
      <View className="flex-row items-center gap-3">
        <View
          className={`h-11 w-11 items-center justify-center rounded-xl ${
            completed ? "bg-accent/15" : "bg-primary/15"
          }`}
        >
          {isRestDay ? (
            <Moon size={22} color="#94A3B8" strokeWidth={2.2} />
          ) : completed ? (
            <CheckCircle2 size={22} color="#22C55E" strokeWidth={2.2} />
          ) : (
            <Dumbbell size={22} color="#F97316" strokeWidth={2.2} />
          )}
        </View>
        <Text className="font-inter-semibold text-base text-foreground">Allenamento di oggi</Text>
      </View>

      {isRestDay ? (
        <View className="mt-4">
          <Text className="font-inter-bold text-xl text-foreground">Giorno di riposo</Text>
          <Text className="mt-1 font-sans text-sm leading-5 text-muted">
            Recupera e ricarica le energie: oggi non è previsto allenamento.
          </Text>
        </View>
      ) : (
        <View className="mt-4">
          <Text className="font-inter-bold text-xl text-foreground">{day.name}</Text>
          <Text className="mt-1 font-sans text-sm text-muted">
            {day.muscleGroups.join(" · ")}
          </Text>
          <Text className="mt-1 font-sans text-xs text-muted">
            {day.exercises.length} esercizi
          </Text>

          {completed ? (
            <View className="mt-4 gap-3">
              <View className="flex-row items-center gap-3 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3.5">
                <CheckCircle2 size={22} color="#22C55E" strokeWidth={2.4} />
                <View className="flex-1">
                  <Text className="font-inter-bold text-xl text-foreground">
                    Allenamento completato
                  </Text>
                  <Text className="mt-1 font-sans text-xs text-muted">
                    {day.name} · {session.durationMinutes} min · concluso alle{" "}
                    {TIME_FORMATTER.format(new Date(session.endedAt))}
                  </Text>
                </View>
              </View>
              <Text className="font-sans text-sm leading-5 text-muted">
                Ottimo lavoro: per oggi sei a posto. Il prossimo allenamento è quello del
                prossimo giorno programmato.
              </Text>
            </View>
          ) : (
            <Pressable
              onPress={handleStart}
              accessibilityRole="button"
              accessibilityLabel={`Inizia allenamento ${day.name}`}
              className="mt-4 flex-row items-center justify-center gap-1.5 rounded-xl bg-primary py-3.5 active:opacity-80 cursor-pointer"
            >
              <Text className="font-inter-bold text-base text-primary-foreground">
                Inizia allenamento
              </Text>
              <ChevronRight size={18} color="#0F172A" strokeWidth={2.5} />
            </Pressable>
          )}
        </View>
      )}
    </Card>
  );
}