import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/Screen";
import { PressableScale, Reveal } from "@/lib/reveal";
import { useAuth } from "@/lib/auth";
import { isApiError } from "@/lib/api";
import {
  ACTIVITY_TO_API,
  GOAL_TO_API,
  birthDateFromParts,
  toIsoDate,
  useCreateProfile,
} from "@/lib/profileQueries";
import { OnboardingProgressBar } from "@/components/onboarding/OnboardingProgressBar";
import { PersonalDataStep, isPersonalDataValid, type PersonalData } from "@/components/onboarding/PersonalDataStep";
import { GoalStep } from "@/components/onboarding/GoalStep";
import { ActivityStep } from "@/components/onboarding/ActivityStep";
import { DisclaimerStep } from "@/components/onboarding/DisclaimerStep";
import { SummaryStep } from "@/components/onboarding/SummaryStep";
import { type ActivityLevel, type Goal, type Gender } from "@/lib/calorieCalculator";
import { ageFromBirthDate, computeTargets } from "@/src/api/lib/tdee";

const TOTAL = 5;

export default function OnboardingScreen() {
  const { user, updateUser } = useAuth();
  const createProfile = useCreateProfile();
  const [step, setStep] = useState(1);

  const [personal, setPersonal] = useState<PersonalData>({
    name: user?.name ?? "",
    // L'età locale non basta a ricostruire la data: si riparte da vuoto.
    birthDay: "",
    birthMonth: "",
    birthYear: "",
    gender: (user?.gender as PersonalData["gender"]) ?? "",
    weight: user?.weightKg ? String(user.weightKg) : "",
    height: user?.heightCm ? String(user.heightCm) : "",
  });
  const [goal, setGoal] = useState<Goal | "">((user?.goal as Goal) ?? "");
  const [activity, setActivity] = useState<ActivityLevel | "">((user?.activityLevel as ActivityLevel) ?? "");
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const canNext = useMemo(() => {
    if (step === 1) return isPersonalDataValid(personal);
    if (step === 2) return !!goal;
    if (step === 3) return !!activity;
    if (step === 4) return accepted;
    return true;
  }, [step, personal, goal, activity, accepted]);

  const tdeeData = useMemo(() => {
    const w = parseFloat(personal.weight.replace(",", "."));
    const h = parseInt(personal.height, 10);
    const birthDate = birthDateFromParts(personal.birthDay, personal.birthMonth, personal.birthYear);
    return { w, h, birthDate };
  }, [personal]);

  async function handleFinish() {
    if (saving) return;
    if (!goal || !activity) return;
    setSaveError(null);

    const { birthDate, w, h } = tdeeData;
    if (!birthDate) {
      setSaveError("Controlla la data di nascita: giorno, mese e anno.");
      return;
    }
    // Il backend accetta qualsiasi passato, ma 500 anni non lo è.
    const age = ageFromBirthDate(birthDate);
    if (!(age >= 1 && age <= 120)) {
      setSaveError("La data di nascita deve indicare un'età tra 1 e 120 anni.");
      return;
    }

    setSaving(true);
    // Stessa funzione del server: ciò che si vede nel riepilogo è ciò che
    // verrà salvato, senza un secondo calcolo in disparte.
    const targets = computeTargets({
      birthDate,
      gender: personal.gender,
      heightCm: h,
      weightKg: w,
      goal: GOAL_TO_API[goal],
      activityLevel: ACTIVITY_TO_API[activity],
    });
    try {
      // 1) Riga profilo sul server: da qui in poi GET /users/me risponde 200
      //    e il guard di navigazione non manda più all'onboarding.
      await createProfile.mutateAsync({
        name: personal.name.trim() || user?.name || "Utente",
        birth_date: toIsoDate(birthDate),
        gender: personal.gender as Gender,
        height_cm: h,
        weight_kg: w,
        goal: GOAL_TO_API[goal],
        activity_level: ACTIVITY_TO_API[activity],
      });
    } catch (error) {
      // 409 = profilo già creato (onboarding rifatto): si prosegue comunque.
      if (!(isApiError(error) && error.status === 409)) {
        setSaveError(
          isApiError(error)
            ? error.message
            : "Salvataggio non riuscito: controlla la connessione.",
        );
        setSaving(false);
        return;
      }
    }

    // 2) Profilo locale: campi usati dalle schermate ancora a mock.
    await updateUser({
      name: personal.name.trim() || user?.name || "Utente",
      age,
      gender: personal.gender || null,
      weightKg: w || null,
      heightCm: h || null,
      goal: goal || null,
      activityLevel: activity || null,
      dailyCalories: targets.daily_calorie_target,
      acceptedDisclaimer: true,
    });
    router.replace("/(tabs)/home");
    setSaving(false);
  }

  return (
    <Screen>
      <View className="flex-1 px-6 pt-4">
        <OnboardingProgressBar current={step} total={TOTAL} />

        <ScrollView className="flex-1" contentContainerClassName="py-6" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* `key={step}` forza il remount: ogni passo rientra con fade+salita. */}
          <Reveal key={step} delay={40} distance={16}>
            {step === 1 ? <PersonalDataStep value={personal} onChange={setPersonal} /> : null}
            {step === 2 ? <GoalStep value={goal} onChange={setGoal} /> : null}
            {step === 3 ? <ActivityStep value={activity} onChange={setActivity} /> : null}
            {step === 4 ? <DisclaimerStep accepted={accepted} onToggle={setAccepted} /> : null}
            {step === 5 && tdeeData.birthDate ? (
              <SummaryStep
                weight={tdeeData.w}
                height={tdeeData.h}
                birthDate={tdeeData.birthDate}
                gender={personal.gender}
                activity={activity}
                goal={goal}
              />
            ) : null}
          </Reveal>
        </ScrollView>

        {saveError ? (
          <Text className="pb-3 font-sans text-sm text-destructive">{saveError}</Text>
        ) : null}

        <View className="flex-row gap-3 pb-8 pt-2">
          {step > 1 ? (
            <PressableScale onPress={() => setStep((s) => Math.max(1, s - 1))} className="flex-1 items-center rounded-xl border border-border bg-surface py-3.5 active:opacity-80">
              <Text className="font-inter-semibold text-base text-muted">Indietro</Text>
            </PressableScale>
          ) : null}

          {step < 5 ? (
            <PressableScale
              onPress={() => setStep((s) => Math.min(TOTAL, s + 1))}
              disabled={!canNext}
              className={`flex-1 items-center rounded-xl py-3.5 active:opacity-80 ${canNext ? "bg-primary" : "bg-primary/40 opacity-60"}`}
            >
              <Text className="font-inter-bold text-base text-primary-foreground">Avanti</Text>
            </PressableScale>
          ) : (
            <PressableScale onPress={handleFinish} disabled={saving} className={`flex-1 items-center rounded-xl bg-primary py-3.5 active:opacity-80 ${saving ? "opacity-60" : ""}`}>
              <Text className="font-inter-bold text-base text-primary-foreground">{saving ? "Salvataggio…" : "Inizia"}</Text>
            </PressableScale>
          )}
        </View>
      </View>
    </Screen>
  );
}
