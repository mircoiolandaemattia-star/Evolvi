import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { Clock, Dumbbell, Repeat, X } from "lucide-react-native";
import type { PerformedExercise, WorkoutSession } from "@/types";

type Props = {
  /** Sessione aperta dalla lista (`null` = modal chiuso). */
  session: WorkoutSession | null;
  /** Nome del giorno di scheda; la sessione conserva solo gli id. */
  dayName: string;
  /** Nomi degli esercizi della scheda: coprono le sessioni senza `name`. */
  exerciseNames: Record<string, string>;
  onClose: () => void;
};

const DAY_FORMATTER = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const TIME_FORMATTER = new Intl.DateTimeFormat("it-IT", {
  hour: "2-digit",
  minute: "2-digit",
});

/** Formatta una data senza rischiare `RangeError` su stringhe anomale. */
function formatWhen(iso: string): { day: string; time: string } {
  try {
    const date = new Date(iso);
    return { day: DAY_FORMATTER.format(date), time: TIME_FORMATTER.format(date) };
  } catch {
    return { day: iso, time: "" };
  }
}

/** Etichetta di una singola serie: "8 × 60 kg", o "10 rip." senza carico. */
function formatSet(reps: number, weightKg?: number): string {
  const hasWeight = typeof weightKg === "number" && weightKg > 0;
  return hasWeight ? `${reps} × ${weightKg} kg` : `${reps} rip.`;
}

type ExerciseBlockProps = {
  entry: PerformedExercise;
  exerciseNames: Record<string, string>;
};

/** Un esercizio con la griglia delle sue serie (in ordine di esecuzione). */
function ExerciseBlock({ entry, exerciseNames }: ExerciseBlockProps) {
  const name = entry.name ?? exerciseNames[entry.exerciseId] ?? "Esercizio";
  const weights = entry.sets
    .map((set) => set.weightKg)
    .filter((weight): weight is number => typeof weight === "number" && weight > 0);
  const bestWeight = weights.length > 0 ? Math.max(...weights) : null;
  const reps = entry.sets.reduce((sum, set) => sum + set.reps, 0);

  return (
    <View className="gap-2 rounded-xl border border-border bg-background p-3.5">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="flex-1 font-inter-semibold text-sm text-foreground">{name}</Text>
        <View className="flex-row items-center gap-2">
          {entry.replaced ? (
            <View className="rounded-md bg-surface px-2 py-1">
              <Text className="font-sans text-[10px] text-muted">sostituito</Text>
            </View>
          ) : null}
          <Text className="font-sans text-xs text-muted">
            {entry.sets.length} serie · {reps} rip.
          </Text>
        </View>
      </View>

      {/* Serie come chip: si leggono a colpo d'occhio, senza liste lunghe. */}
      <View className="flex-row flex-wrap gap-2">
        {entry.sets.map((set, index) => (
          <View
            key={`${index}-${set.reps}`}
            className={`rounded-lg px-2.5 py-1.5 ${bestWeight != null && set.weightKg === bestWeight ? "bg-primary/15" : "bg-surface"}`}
          >
            <Text
              className={`font-inter-semibold text-xs ${bestWeight != null && set.weightKg === bestWeight ? "text-primary" : "text-foreground"}`}
            >
              {formatSet(set.reps, set.weightKg)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Dettaglio di una sessione dello storico: data, durata, totali e le serie
 * di ogni esercizio come registrate in `performed_data`. Le serie migliori
 * (carico più alto) sono evidenziate in arancione.
 */
export function SessionDetailModal({ session, dayName, exerciseNames, onClose }: Props) {
  const performed = session?.performed ?? [];
  const totalSets = performed.reduce((sum, entry) => sum + entry.sets.length, 0);
  const totalReps = performed.reduce(
    (sum, entry) => sum + entry.sets.reduce((inner, set) => inner + set.reps, 0),
    0,
  );
  const when = session ? formatWhen(session.endedAt) : { day: "", time: "" };

  return (
    <Modal
      visible={session !== null}
      transparent
      animationType={Platform.OS === "web" ? "none" : "slide"}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 justify-end"
      >
        {/* Fondo toccabile dietro al foglio, posizionato in assoluto così i
            tocchi sul contenuto non chiudono la modal. */}
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Chiudi dettaglio sessione"
          className="absolute inset-0 bg-black/60"
        />
        <View className="max-h-[92%] w-full rounded-t-3xl border-t border-border bg-surface">
          <View className="flex-row items-center gap-2 border-b border-border px-3 py-2">
            <Text className="flex-1 font-inter-bold text-lg text-foreground">
              {dayName || "Allenamento"}
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Chiudi"
              className="h-11 w-11 items-center justify-center rounded-lg active:opacity-60"
            >
              <X size={20} color="#94A3B8" strokeWidth={2.2} />
            </Pressable>
          </View>

          <ScrollView contentContainerClassName="gap-4 p-4 pb-8">
            <Text className="font-sans text-sm text-muted">
              {when.day}
              {when.time ? ` · ${when.time}` : ""}
            </Text>

            {/* Totali della sessione */}
            <View className="flex-row flex-wrap gap-2">
              <View className="flex-row items-center gap-1.5 rounded-lg bg-accent/15 px-2.5 py-1.5">
                <Clock size={14} color="#22C55E" strokeWidth={2.2} />
                <Text className="font-inter-semibold text-xs text-accent">
                  {session?.durationMinutes ?? 0} min
                </Text>
              </View>
              <View className="flex-row items-center gap-1.5 rounded-lg bg-primary/15 px-2.5 py-1.5">
                <Dumbbell size={14} color="#F97316" strokeWidth={2.2} />
                <Text className="font-inter-semibold text-xs text-primary">
                  {totalSets} serie
                </Text>
              </View>
              <View className="flex-row items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1.5">
                <Repeat size={14} color="#94A3B8" strokeWidth={2.2} />
                <Text className="font-inter-semibold text-xs text-muted">
                  {totalReps} rip.
                </Text>
              </View>
            </View>

            {performed.length === 0 ? (
              <Text className="font-sans text-sm leading-5 text-muted">
                Nessun dettaglio delle serie: questa sessione è stata salvata prima che
                l’app registrasse gli esercizi.
              </Text>
            ) : (
              <View className="gap-3">
                {performed.map((entry) => (
                  <ExerciseBlock
                    key={entry.exerciseId}
                    entry={entry}
                    exerciseNames={exerciseNames}
                  />
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
