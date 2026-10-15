import { Text, View } from "react-native";
import { Flame } from "lucide-react-native";
import { Card } from "@/components/home/Card";
import { CountUp } from "@/components/ui/CountUp";
import { parseStoredBirthDate } from "@/lib/profileQueries";
import { computeTargets } from "@/src/api/lib/tdee";

type Props = {
  birthDate: string | null;
  gender: string | null;
  heightCm: number | null;
  weightKg: number | null;
  /** Enum del backend: sono i valori salvati, gli stessi di `daily_calorie_target`. */
  goal: string;
  /** Enum del backend, come sopra. */
  activityLevel: string;
};

/**
 * Unico riepilogo del fabbisogno sul profilo.
 *
 * Chiama `computeTargets`, la stessa funzione che il server usa per
 * scrivere `daily_calorie_target`: il numero che si legge qui è per
 * costruzione quello dell'anello in Home, e si aggiorna appena il server
 * risponde dopo un cambio di obiettivo o attività.
 *
 * Prima stava duplicato dentro Obiettivo e Livello di attività — due
 * volte la stessa cifra, calcolata con la formula sbagliata.
 */
export function TdeeCard({ birthDate, gender, heightCm, weightKg, goal, activityLevel }: Props) {
  const parsed = parseStoredBirthDate(birthDate);
  const targets =
    parsed && heightCm && weightKg
      ? computeTargets({ birthDate: parsed, gender, heightCm, weightKg, goal, activityLevel })
      : null;

  return (
    <Card className="gap-3">
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-2xl bg-primary/15">
          <Flame size={20} color="#F97316" />
        </View>
        <View className="flex-1">
          <Text className="font-sans text-xs text-muted">Fabbisogno giornaliero</Text>
          {targets ? (
            <Text className="font-inter-bold text-2xl text-primary">
              <CountUp value={targets.daily_calorie_target} /> kcal
            </Text>
          ) : (
            <Text className="font-inter-semibold text-sm leading-5 text-muted">
              Completa peso, altezza e data di nascita per vederlo
            </Text>
          )}
        </View>
      </View>

      {targets ? (
        <Text className="font-sans text-xs leading-4 text-muted">
          Lo stesso valore che vedi nell&apos;anello della Home: si aggiorna quando cambi obiettivo o attività.
        </Text>
      ) : null}
    </Card>
  );
}
