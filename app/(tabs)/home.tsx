import { useMemo } from "react";
import { ScrollView, Text, useWindowDimensions, View } from "react-native";
import { Screen } from "@/components/Screen";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import { useAuth } from "@/lib/auth";
import { dateToString } from "@/lib/dietaStore";
import { useDiaryDay, useMealsInRange } from "@/lib/dietQueries";
import { getTodayDayOfWeek, type QuickStats as QuickStatsData } from "@/lib/mock-data";
import { useProfile } from "@/lib/profileQueries";
import { useWorkoutPlan, useWorkoutPlans, useWorkoutSessions } from "@/lib/workoutQueries";
import type { WorkoutSession } from "@/types";
import { CalorieRing } from "@/components/home/CalorieRing";
import { WorkoutTodayCard } from "@/components/home/WorkoutTodayCard";
import { MealsSummaryCard } from "@/components/home/MealsSummaryCard";
import { QuickStats } from "@/components/home/QuickStats";

const WIDE_BREAKPOINT = 768; // px

/** Finestra (giorni) interrogata per la streak dei pasti. */
const STREAK_WINDOW_DAYS = 90;

function getGreeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return "Buongiorno";
  if (hour < 18) return "Buon pomeriggio";
  return "Buonasera";
}

function formatToday(date: Date): string {
  const label = new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Statistiche rapide della Home:
 * - **streak pasti**: giorni consecutivi con almeno un pasto registrato
 *   (almeno un alimento nel diario); se oggi non c'è ancora parte da ieri,
 *   così non si azzera al mattino;
 * - **ore settimanali**: durata delle sessioni dalla mezzanotte di lunedì;
 * - **sessioni totali**: tutte le sessioni chiuse.
 *
 * `mealDays` è l'insieme delle date con almeno un pasto (ultimi
 * `STREAK_WINDOW_DAYS` giorni); per oggi fa fede `todayLogged`, che arriva
 * dal diario già compilato con gli alimenti.
 */
function computeQuickStats(
  sessions: WorkoutSession[],
  mealDays: Set<string>,
  todayLogged: boolean,
): QuickStatsData {
  const today = new Date();
  const todayKey = dateToString(today);

  const weekStart = new Date(today);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weeklyMinutes = sessions
    .filter((session) => new Date(session.startedAt) >= weekStart)
    .reduce((sum, session) => sum + session.durationMinutes, 0);

  // Streak sui pasti: la riga del giorno serve solo ad aprire la serie,
  // non è lei a far parte il giorno (ieri resta contato anche se oggi
  // non si è ancora registrato nulla).
  const daysWithMeals = new Set(mealDays);
  daysWithMeals.delete(todayKey);
  if (todayLogged) daysWithMeals.add(todayKey);

  const cursor = new Date(today);
  cursor.setHours(0, 0, 0, 0);
  if (!daysWithMeals.has(dateToString(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streakDays = 0;
  while (daysWithMeals.has(dateToString(cursor))) {
    streakDays += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return {
    streakDays,
    weeklyHours: Math.round((weeklyMinutes / 60) * 10) / 10,
    totalSessions: sessions.length,
  };
}

/**
 * Home / Dashboard: header con saluto, card calorie, allenamento di oggi,
 * pasti e statistiche — dati reali dal backend (profilo, diario, scheda
 * attiva, sessioni). Su schermi larghi (>768px) il layout diventa a 2 colonne.
 */
export default function HomeScreen() {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;

  const today = useMemo(() => dateToString(new Date()), []);

  const profileQuery = useProfile();
  const diary = useDiaryDay(today);
  const plansQuery = useWorkoutPlans();
  const activePlanId =
    plansQuery.data?.find((plan) => plan.isActive)?.id ?? plansQuery.data?.[0]?.id ?? null;
  const planQuery = useWorkoutPlan(activePlanId);
  const sessionsQuery = useWorkoutSessions();

  // Finestra per la streak dei pasti: gli ultimi STREAK_WINDOW_DAYS giorni,
  // una sola richiesta (le date passate con ?from=&to=).
  const streakFrom = useMemo(() => {
    const from = new Date();
    from.setDate(from.getDate() - (STREAK_WINDOW_DAYS - 1));
    return dateToString(from);
  }, []);
  const mealsRangeQuery = useMealsInRange(streakFrom, today);

  const displayName = useMemo(() => {
    const first = user?.name?.trim().split(/\s+/)[0] ?? "";
    if (!first) return "";
    return first.charAt(0).toUpperCase() + first.slice(1);
  }, [user]);

  const target = profileQuery.data?.daily_calorie_target ?? 0;
  const consumed = diary.totals.calories;

  // Solo pasti con almeno un alimento: i gruppi vuoti non sono pasti fatti.
  const mealsToday = useMemo(
    () => diary.meals.filter((meal) => meal.foodItems.length > 0),
    [diary.meals],
  );

  // Giorno programmato per oggi: nessun giorno → il card mostra il riposo.
  const workoutDay = useMemo(
    () => planQuery.data?.days.find((day) => day.dayOfWeek === getTodayDayOfWeek()) ?? null,
    [planQuery.data],
  );

  // Date con almeno un pasto registrato nella finestra (escluso oggi,
  // che viene deciso dal diario qui sotto).
  const daysWithMeals = useMemo(() => {
    const days = new Set<string>();
    (mealsRangeQuery.data ?? []).forEach((meal) => days.add(meal.date));
    return days;
  }, [mealsRangeQuery.data]);

  const stats = useMemo(
    () =>
      computeQuickStats(
        sessionsQuery.data ?? [],
        daysWithMeals,
        mealsToday.length > 0,
      ),
    [sessionsQuery.data, daysWithMeals, mealsToday],
  );

  // Sessione chiusa oggi sul giorno programmato: la card "Allenamento di
  // oggi" passa così da "Inizia" ad "Allenamento completato".
  const todaySession = useMemo(() => {
    if (!workoutDay) return null;
    const sessions = (sessionsQuery.data ?? [])
      .filter(
        (session) =>
          session.dayId === workoutDay.id &&
          dateToString(new Date(session.endedAt)) === today,
      )
      .sort((a, b) => Date.parse(b.endedAt) - Date.parse(a.endedAt));
    return sessions[0] ?? null;
  }, [sessionsQuery.data, workoutDay, today]);

  const data = useMemo(
    () => ({
      greeting: getGreeting(new Date()),
      dateLabel: formatToday(new Date()),
    }),
    [],
  );

  return (
    <Screen>
      <ScrollView
        className="flex-1"
        contentContainerClassName={`w-full gap-6 px-4 py-6 ${
          isWide ? "mx-auto max-w-5xl px-6" : ""
        }`}
      >
        {/* Header — fix Android: safe-area via Screen + wrapping + capitalizzazione nome */}
        <View className="w-full gap-1">
          <Text
            className="font-inter-bold text-[28px] leading-[34px] text-foreground"
            numberOfLines={2}
            style={{ flexShrink: 1 }}
          >
            {data.greeting}
            {displayName ? `, ${displayName}` : ""}
          </Text>
          <Text className="font-sans text-sm leading-5 text-muted">{data.dateLabel}</Text>
        </View>

        <PWAInstallBanner />

      {isWide ? (
        /* Layout desktop: 2 colonne */
        <View className="w-full flex-row items-start gap-4">
          <View className="flex-1 gap-4">
            <CalorieRing consumed={consumed} target={target} />
            <MealsSummaryCard meals={mealsToday} />
          </View>
          <View className="flex-1 gap-4">
            <WorkoutTodayCard day={workoutDay} session={todaySession} />
            <QuickStats stats={stats} />
          </View>
        </View>
      ) : (
        /* Layout mobile: tutto verticale */
        <View className="w-full gap-4">
          <CalorieRing consumed={consumed} target={target} />
          <WorkoutTodayCard day={workoutDay} session={todaySession} />
          <MealsSummaryCard meals={mealsToday} />
          <QuickStats stats={stats} />
        </View>
      )}
      </ScrollView>
    </Screen>
  );
}
