import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { router } from "expo-router";
import {
  ArrowLeftRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Flag,
  PenLine,
  SkipForward,
  Timer,
  X,
} from "lucide-react-native";
import type { WorkoutDay } from "@/types";
import { isApiError } from "@/lib/api";
import { confirmAction } from "@/lib/feedback";
import {
  clearActiveWorkout,
  formatDraftWhen,
  loadActiveWorkout,
  nowMs,
  resumeStartedAt,
  saveActiveWorkout,
  type ActiveWorkoutDraft,
  type SessionExercise,
  type SessionSetLog,
} from "@/lib/activeWorkout";
import {
  markWorkoutCompleted,
  useCreateWorkoutSession,
} from "@/lib/workoutQueries";
import { NumberField, PrimaryButton } from "./formControls";
import { ReplaceExerciseModal } from "./ReplaceExerciseModal";

/** Recupero usato quando la scheda non indica un riposo specifico (secondi). */
const DEFAULT_REST_SECONDS = 90;

/**
 * Spazio (px) fra le righe della lista esercizi: coincide con `gap-2`
 * del contenitore e serve a calcolare la posizione del focus in scroll.
 */
const LIST_ROW_GAP = 8;

/**
 * Recupero in secondi di un esercizio: quello impostato nella scheda
 * ("Riposo (s)" del form di modifica), altrimenti il default. Un riposo
 * a 0 significa "non indicato" e cade sul default.
 */
function restSecondsFor(exercise: SessionExercise): number {
  return exercise.restSeconds && exercise.restSeconds > 0
    ? exercise.restSeconds
    : DEFAULT_REST_SECONDS;
}

/** Log per esercizio: un SetLog per ogni serie programmata. */
type ExerciseLogs = SessionSetLog[][];

/** Riga della scheda → esercizio della sessione (stesso id, editabile). */
function toSessionExercise(item: {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weightKg: number;
  restSeconds?: number | null;
  notes?: string | null;
}): SessionExercise {
  return {
    id: item.id,
    name: item.name,
    sets: item.sets,
    reps: item.reps,
    weightKg: item.weightKg,
    restSeconds: item.restSeconds ?? null,
    notes: item.notes ?? null,
    edited: false,
  };
}

function initLogs(exercises: SessionExercise[]): ExerciseLogs {
  return exercises.map((exercise) =>
    Array.from({ length: exercise.sets }, () => ({
      completed: false,
      weight: exercise.weightKg > 0 ? String(exercise.weightKg) : "",
      reps: String(exercise.reps),
    })),
  );
}

/** Allinea il numero di righe di log al numero di serie programmato. */
function resizeLog(
  log: SessionSetLog[],
  sets: number,
  exercise: SessionExercise,
): SessionSetLog[] {
  if (sets <= log.length) return log.slice(0, sets);
  const extra = Array.from({ length: sets - log.length }, () => ({
    completed: false,
    weight: exercise.weightKg > 0 ? String(exercise.weightKg) : "",
    reps: String(exercise.reps),
  }));
  return [...log, ...extra];
}

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Numero come testo → valore intero valido, altrimenti null. */
function parseIntOrNull(text: string): number | null {
  const value = parseInt(text.replace(",", "."), 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

type ActiveWorkoutSessionProps = {
  day: WorkoutDay;
  /**
   * Arrivo dal banner "Riprendi" della Scheda: la sessione sospesa di
   * questo giorno viene ripristinata senza un secondo promemoria.
   */
  autoResume?: boolean;
};

/**
 * Fasi di avvio: si legge prima la sessione sospesa su AsyncStorage
 * (bozza di un'altra sessione → chiede, di questo giorno → propone ripresa).
 */
type Phase = "reading" | "prompt" | "ready";

/**
 * Metriche della lista esercizi misurate dai layout: `listTop` è la
 * posizione della lista nel contenuto scrollabile, `collapsed` l'altezza
 * di una riga chiusa (sono tutte identiche: è il focus a far crescere
 * una sola). `null` = non ancora misurate.
 */
type ListMetrics = { listTop: number | null; collapsed: number | null };

/**
 * Vista allenamento attivo: progresso esercizi, registrazione serie
 * (completata / peso / ripetizioni), timer di recupero, navigazione libera
 * fra gli esercizi, modifica al volo (sostituzione quando il macchinario
 * non è disponibile) e chiusura sessione → POST /workout-sessions.
 *
 * Il progresso viene salvato in AsyncStorage a ogni cambiamento: chiudere
 * l'app non perde nulla e la sessione si riprende dalla Scheda.
 */
export function ActiveWorkoutSession({ day, autoResume = false }: ActiveWorkoutSessionProps) {
  const [phase, setPhase] = useState<Phase>("reading");
  const [pendingDraft, setPendingDraft] = useState<ActiveWorkoutDraft | null>(null);
  const [resumed, setResumed] = useState(false);

  const [exercises, setExercises] = useState<SessionExercise[]>(() =>
    day.exercises.map(toSessionExercise),
  );
  const [index, setIndex] = useState(0);
  const [logs, setLogs] = useState<ExerciseLogs>(() => initLogs(exercises));
  const [rest, setRest] = useState<{ seconds: number } | null>(null);
  const [restRemaining, setRestRemaining] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<ListMetrics>({ listTop: null, collapsed: null });

  /**
   * Inizio sessione (ms da epoch). Parte "adesso" e viene riallineato dal
   * ripristino, che sottrae le pause più lunghe: `Date.now` è impuro, quindi
   * si calcola sempre dentro un effect (o un handler con `new Date()`).
   */
  const startedAtRef = useRef(0);
  /** Handler di uscita letto dall'evento hardware (senza dipendenze stale). */
  const exitRef = useRef<() => void>(() => {});
  /** Lista esercizi: ref dello scroll e del suo offset (non fanno render). */
  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);

  const createSession = useCreateWorkoutSession();
  /** Altezza schermo: serve a capire se il focus è già visibile. */
  const { height } = useWindowDimensions();

  const current = exercises[index];
  const currentLog = logs[index] ?? [];
  const completedInCurrent = currentLog.filter((set) => set.completed).length;
  const totalSets = exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
  const completedSets = logs.reduce(
    (sum, line) => sum + line.filter((set) => set.completed).length,
    0,
  );
  const progress = totalSets === 0 ? 0 : Math.min(1, completedSets / totalSets);

  /* --------------------------- Avvio e ripresa --------------------------- */

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const draft = await loadActiveWorkout();
      if (cancelled) return;
      startedAtRef.current = nowMs();
      if (!draft) {
        setPhase("ready");
        return;
      }
      if (draft.dayId !== day.id) {
        // Un'altra sessione è sospesa: iniziarne una la scarta, meglio chiedere.
        const startNew = await confirmAction({
          title: "Sessione già in corso",
          message: `C'è un allenamento sospeso su “${draft.dayName}”. Vuoi iniziare questo e scartare quello?`,
          confirmLabel: "Inizia questo",
          cancelLabel: "Annulla",
          destructive: true,
        });
        if (cancelled) return;
        if (!startNew) {
          router.back();
          return;
        }
        await clearActiveWorkout();
        if (!cancelled) setPhase("ready");
        return;
      }
      setPendingDraft(draft);
      // Dal banner "Riprendi" si entra direttamente: la scelta fra riprendere
      // e ricominciare serve solo a chi riapre il giorno da solo.
      if (autoResume) {
        resumeDraft(draft);
        return;
      }
      setPhase("prompt");
    })();
    return () => {
      cancelled = true;
    };
  }, [day.id, autoResume]);

  // Salva la sessione a ogni cambiamento (scrittura ritardata di 300 ms,
  // così una serie di tasti non genera altrettante scritture). Con zero
  // serie completate non c'è nulla da riprendere: un'eventuale bozza va
  // via, così l'apertura della Scheda non propone di riprendere un
  // allenamento ancora non iniziato.
  useEffect(() => {
    if (phase !== "ready") return;
    const timer = setTimeout(() => {
      if (completedSets === 0) {
        void clearActiveWorkout();
        return;
      }
      saveActiveWorkout({
        dayId: day.id,
        planId: day.planId,
        dayName: day.name,
        startedAt: startedAtRef.current,
        index,
        exercises,
        logs,
        updatedAt: nowMs(),
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [phase, day.id, day.planId, day.name, index, exercises, logs, completedSets]);

  function resumeDraft(draft: ActiveWorkoutDraft) {
    if (draft.exercises.length === 0) {
      void clearActiveWorkout().then(() => setPhase("ready"));
      return;
    }
    setExercises(draft.exercises);
    setLogs(draft.logs);
    setIndex(Math.min(Math.max(0, draft.index), draft.exercises.length - 1));
    startedAtRef.current = resumeStartedAt(draft, nowMs());
    setPendingDraft(null);
    setResumed(true);
    setPhase("ready");
  }

  async function discardDraft() {
    const accepted = await confirmAction({
      title: "Scarta la sessione salvata?",
      message: "Le serie già registrate verranno cancellate e si riparte da zero.",
      confirmLabel: "Scarta",
      cancelLabel: "Annulla",
      destructive: true,
    });
    if (!accepted) return;
    await clearActiveWorkout();
    setPendingDraft(null);
    setResumed(false);
    setPhase("ready");
  }

  /* ------------------------------- Uscita -------------------------------- */

  /**
   * Uscire dall'allenamento: prima chiede, poi lascia la sessione salvata
   * (pausa) così alla riapertura si può riprendere. Solo quando non è stata
   * completata nessuna serie la bozza viene buttata via.
   */
  async function requestExit() {
    if (createSession.isPending) return;
    // Fase di avvio: la bozza non è ancora "questa sessione", esce senza
    // toccarla (sarebbe un modo elegante per perdere il lavoro di ieri).
    if (phase !== "ready") {
      router.back();
      return;
    }
    const accepted = await confirmAction({
      title: "Esci dall'allenamento?",
      message:
        completedSets > 0
          ? "La sessione resta salvata su questo dispositivo: potrai riprenderla dalla Scheda quando vuoi."
          : "Nessuna serie completata: uscendo non resta nulla da riprendere.",
      confirmLabel: completedSets > 0 ? "Esci e metti in pausa" : "Esci",
      cancelLabel: "Continua",
    });
    if (!accepted) return;
    if (completedSets === 0) await clearActiveWorkout();
    router.back();
  }

  // Il tasto indietro di Android chiama qui (su web non c'è hardware back).
  useEffect(() => {
    exitRef.current = requestExit;
  });
  useEffect(() => {
    if (Platform.OS === "web") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      exitRef.current();
      return true;
    });
    return () => subscription.remove();
  }, []);

  /* ---------------------------- Modifica al volo -------------------------- */

  function patchCurrentExercise(patch: Partial<SessionExercise>) {
    const previous = exercises[index];
    if (!previous) return;
    const next = { ...previous, ...patch, edited: true };
    setExercises((prev) => prev.map((ex, i) => (i === index ? next : ex)));

    if (patch.sets !== undefined) {
      setLogs((prev) =>
        prev.map((line, i) => (i === index ? resizeLog(line, next.sets, next) : line)),
      );
    }
    // Le serie ancora da fare si allineano alle nuove ripetizioni; quelle
    // già compilate o completate non vengono toccate.
    if (patch.reps !== undefined && patch.reps !== previous.reps) {
      const oldReps = String(previous.reps);
      const newReps = String(patch.reps);
      setLogs((prev) =>
        prev.map((line, i) =>
          i === index
            ? line.map((set) =>
                !set.completed && set.reps === oldReps ? { ...set, reps: newReps } : set,
              )
            : line,
        ),
      );
    }
  }

  /* --------------------------- Serie e recupero -------------------------- */

  function updateSet(setIndex: number, patch: Partial<SessionSetLog>) {
    setLogs((prev) =>
      prev.map((line, i) =>
        i === index
          ? line.map((set, j) => (j === setIndex ? { ...set, ...patch } : set))
          : line,
      ),
    );
  }

  function handleToggleSet(setNumber: number) {
    const wasCompleted = currentLog[setNumber]?.completed ?? false;
    updateSet(setNumber, { completed: !wasCompleted });
    if (wasCompleted || !current) return;

    // Completare una serie avvia il recupero impostato per l'esercizio.
    const seconds = restSecondsFor(current);
    setRest({ seconds });
    setRestRemaining(seconds);

    // Finite tutte le serie: il recupero continua a scorrere e si passa
    // automaticamente al prossimo esercizio — il cambio di vista non lo
    // azzera, è una pausa fisica non legata allo schermo.
    const doneNow = currentLog.filter((set) => set.completed).length + 1;
    if (doneNow >= currentLog.length && index < exercises.length - 1) {
      setEditing(false);
      setIndex(index + 1);
    }
  }

  /** Chiude il recupero (solo con il salto manuale o a fine tempo). */
  function endRest() {
    setRest(null);
    setRestRemaining(null);
  }

  /** Nell'effect il tempo è lecito: qui si calcola la scadenza assoluta. */
  useEffect(() => {
    if (rest === null) return;
    const endsAt = nowMs() + rest.seconds * 1000;
    const interval = setInterval(() => {
      const left = Math.max(0, Math.ceil((endsAt - nowMs()) / 1000));
      setRestRemaining(left);
      if (left <= 0) clearInterval(interval);
    }, 250);
    return () => clearInterval(interval);
  }, [rest]);

  /* ---------------------------- Navigazione ------------------------------ */

  /**
   * Mette a fuoco un esercizio (riga toccata, Precedente/Successivo o
   * avanzamento automatico). Il recupero in corso non viene toccato: è
   * pausa fisica, non legata alla vista.
   */
  function goTo(target: number) {
    if (target < 0 || target >= exercises.length) return;
    setEditing(false);
    setIndex(target);
  }

  /** Inizio della lista nel contenuto scrollabile (dal suo onLayout). */
  function noteListTop(y: number) {
    setMetrics((prev) =>
      prev.listTop !== null && Math.abs(prev.listTop - y) < 0.5
        ? prev
        : { listTop: y, collapsed: prev.collapsed },
    );
  }

  /** Altezza di una riga chiusa: sono tutte identiche, basta la prima. */
  function noteCollapsedHeight(rowHeight: number) {
    setMetrics((prev) =>
      prev.collapsed !== null && Math.abs(prev.collapsed - rowHeight) < 0.5
        ? prev
        : { listTop: prev.listTop, collapsed: rowHeight },
    );
  }

  /**
   * Mantiene a fuoco l'esercizio in esercuzione quando cambia il focus.
   * Le righe sopra a lui sono sempre chiuse, quindi la posizione si
   * calcola: y = inizio lista + indice × (altezza riga + gap). Se l'esercizio
   * è già visibile nell'alto dello schermo non si muove (niente salti).
   */
  useEffect(() => {
    const { listTop, collapsed } = metrics;
    if (listTop === null || collapsed === null) return;
    const y = listTop + index * (collapsed + LIST_ROW_GAP);
    const visibleTop = scrollYRef.current;
    const halfVisible = Math.round((height - 140) / 2);
    if (y >= visibleTop + 16 && y <= visibleTop + halfVisible) return;
    const target = Math.max(0, y - 96);
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: target, animated: true });
    }, 60);
    return () => clearTimeout(timer);
  }, [index, metrics, height]);

  /* ------------------------------- Chiusura ------------------------------ */

  async function handleFinish() {
    if (createSession.isPending || completedSets === 0) return;
    const accepted = await confirmAction({
      title: "Termina allenamento?",
      message: `${completedSets} serie completate su ${totalSets}. La sessione finisce nello storico.`,
      confirmLabel: "Termina",
      cancelLabel: "Continua",
    });
    if (!accepted) return;

    const completedAt = new Date();
    const startedAt = new Date(startedAtRef.current);

    // Solo le serie completate entrano nel performed_data dell'API:
    // [{exercise_id, sets: [{reps, weight_kg?}]}]. L'id è quello della
    // scheda anche per gli esercizi sostituiti in sessione.
    const performed = exercises
      .map((exercise, exerciseIndex) => ({
        exercise_id: exercise.id,
        sets: (logs[exerciseIndex] ?? [])
          .filter((set) => set.completed)
          .map((set) => {
            const weight = parseFloat(set.weight.replace(",", "."));
            const reps = parseInt(set.reps, 10);
            return {
              reps: Number.isFinite(reps) && reps > 0 ? reps : 0,
              ...(Number.isFinite(weight) && weight > 0 ? { weight_kg: weight } : {}),
            };
          }),
      }))
      .filter((entry) => entry.sets.length > 0);

    setFinishError(null);
    createSession.mutate(
      { planId: day.planId, dayId: day.id, startedAt, completedAt, performed },
      {
        onSuccess: () => {
          // La Scheda mostra il banner "Allenamento completato!" al ritorno.
          markWorkoutCompleted();
          // Solo la sessione chiusa con successo cancella la bozza.
          void clearActiveWorkout().then(() => router.back());
        },
        onError: (error) =>
          setFinishError(
            isApiError(error)
              ? error.message
              : "Salvataggio non riuscito: controlla la connessione.",
          ),
      },
    );
  }

  const isRestDone = restRemaining === 0;

  /* -------------------------------- Render ------------------------------- */

  // Avvio in corso: la lettura della bozza è rapida, non serve altro.
  if (phase === "reading") {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#F97316" />
      </View>
    );
  }

  // Sessione sospesa dello stesso giorno: si chiede se riprenderla.
  if (phase === "prompt" && pendingDraft) {
    const draftCompleted = pendingDraft.logs.reduce(
      (sum, line) => sum + line.filter((set) => set.completed).length,
      0,
    );
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 bg-background"
      >
        <ScrollView
          contentContainerClassName="gap-4 px-4 pb-8 pt-6"
          keyboardShouldPersistTaps="handled"
        >
          <View className="items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-5">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-primary/15">
              <Timer size={26} color="#F97316" strokeWidth={2.2} />
            </View>
            <Text className="text-center font-inter-bold text-lg text-foreground">
              Sessione di allenamento in corso
            </Text>
            <Text className="text-center font-sans text-sm leading-5 text-muted">
              {pendingDraft.dayName} · iniziata {formatDraftWhen(pendingDraft.startedAt)} ·{" "}
              {draftCompleted} serie già completate
            </Text>
          </View>

          <PrimaryButton label="Riprendi" onPress={() => resumeDraft(pendingDraft)} />

          <Pressable
            onPress={() => void discardDraft()}
            accessibilityRole="button"
            className="cursor-pointer items-center rounded-xl border border-destructive/40 bg-destructive/10 py-3.5 active:opacity-80"
          >
            <Text className="font-inter-semibold text-base text-destructive">
              Ricomincia da capo
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            className="cursor-pointer items-center py-2 active:opacity-80"
          >
            <Text className="font-inter-semibold text-base text-muted">Torna alla scheda</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (!current) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="font-inter-semibold text-base text-foreground">
          Nessun esercizio in questo giorno.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-background"
    >
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-5 px-4 pb-8 pt-6"
        onScroll={(event) => {
          scrollYRef.current = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={50}
      >
        {/* Header */}
        <View className="flex-row items-center gap-4">
          <Pressable
            onPress={() => void requestExit()}
            accessibilityRole="button"
            accessibilityLabel="Torna alla scheda"
            hitSlop={8}
            className="h-11 w-11 cursor-pointer items-center justify-center rounded-xl bg-surface active:opacity-80"
          >
            <ChevronLeft size={22} color="#F8FAFC" strokeWidth={2.2} />
          </Pressable>
          <View className="flex-1">
            <Text className="font-inter-bold text-2xl text-foreground">{day.name}</Text>
            <Text className="mt-0.5 font-sans text-sm text-muted">
              Esercizio {index + 1} di {exercises.length} · {completedSets} serie completate
            </Text>
          </View>
        </View>

        {/* Progress bar (sulle serie, non sul singolo esercizio) */}
        <View className="h-2 w-full overflow-hidden rounded-full bg-surface">
          <View
            className="h-full rounded-full bg-primary"
            style={{ width: `${progress * 100}%` }}
          />
        </View>

        {/* Sessione ripresa: feedback una tantum */}
        {resumed ? (
          <View className="flex-row items-center gap-3 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3">
            <Check size={18} color="#22C55E" strokeWidth={2.4} />
            <Text className="flex-1 font-sans text-xs leading-4 text-muted">
              Sessione ripresa da dove l’avevi lasciata: le pause lunghe non entrano nella
              durata.
            </Text>
            <Pressable
              onPress={() => setResumed(false)}
              accessibilityRole="button"
              accessibilityLabel="Chiudi messaggio"
              hitSlop={8}
              className="cursor-pointer p-1 active:opacity-60"
            >
              <X size={16} color="#94A3B8" strokeWidth={2.2} />
            </Pressable>
          </View>
        ) : null}

        {/* Lista esercizi: si vedono sempre tutti, il focus resta su quello
            in esercuzione (serie, peso, rep e recupero sul pannello attivo) */}
        <View className="gap-2" onLayout={(event) => noteListTop(event.nativeEvent.layout.y)}>
          {exercises.map((exercise, exerciseIndex) => {
            if (exerciseIndex !== index) {
              // Prima e dopo il focus: solo il nome, un tap lo mette a fuoco.
              return (
                <Pressable
                  key={exercise.id}
                  onPress={() => goTo(exerciseIndex)}
                  onLayout={(event) => noteCollapsedHeight(event.nativeEvent.layout.height)}
                  accessibilityRole="button"
                  accessibilityLabel={`Metti a fuoco ${exercise.name}`}
                  className="cursor-pointer items-center rounded-xl border border-border bg-surface px-4 py-3.5 active:opacity-80"
                >
                  <Text className="font-inter-semibold text-sm text-muted" numberOfLines={1}>
                    {exercise.name}
                  </Text>
                </Pressable>
              );
            }

            return (
              <View
                key={exercise.id}
                className="rounded-2xl border-2 border-primary bg-surface p-4"
              >
                <View className="flex-row items-start gap-3">
                  <View className="h-11 w-11 items-center justify-center rounded-xl bg-accent/15">
                    <Text className="font-inter-bold text-sm text-accent">{index + 1}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="font-inter-bold text-lg leading-6 text-foreground">
                      {current.name}
                    </Text>
                    <View className="mt-1 flex-row items-center flex-wrap gap-1.5">
                      <Text className="font-sans text-xs text-muted">
                        {current.sets} serie programmate ·{" "}
                        {current.weightKg > 0 ? `${current.weightKg} kg` : "peso libero"}
                        {current.restSeconds ? ` · riposo ${current.restSeconds} s` : ""}
                      </Text>
                      <View className="rounded-full bg-background/60 px-2.5 py-0.5">
                        <Text className="font-inter-semibold text-xs text-foreground">
                          {completedInCurrent}/{currentLog.length} serie
                        </Text>
                      </View>
                      {current.edited ? (
                        <View className="rounded-full bg-primary/15 px-2.5 py-0.5">
                          <Text className="font-inter-semibold text-xs text-primary">Modificato</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <Pressable
                    onPress={() => setEditing((value) => !value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: editing }}
                    accessibilityLabel={`Modifica ${current.name} per questa sessione`}
                    className="h-11 w-11 cursor-pointer items-center justify-center rounded-lg bg-background/60 active:opacity-80"
                  >
                    <PenLine size={18} color="#F97316" strokeWidth={2.2} />
                  </Pressable>
                </View>

                {/* Recupero sul pannello del focus: non si azzera cambiando esercizio */}
                {restRemaining !== null ? (
                  <View className="mt-3 flex-row items-center gap-3 rounded-xl border border-primary/40 bg-primary/10 px-3 py-3">
                    <View className="h-10 w-10 items-center justify-center rounded-lg bg-primary/15">
                      <Timer size={20} color="#F97316" strokeWidth={2.2} />
                    </View>
                    <View className="flex-1">
                      <Text className="font-sans text-xs text-muted">
                        {isRestDone ? "Recupero terminato" : "Recupero tra le serie"}
                      </Text>
                      <Text className="font-inter-bold text-2xl tabular-nums text-foreground">
                        {isRestDone ? "Pronto!" : formatClock(restRemaining)}
                      </Text>
                    </View>
                    {!isRestDone ? (
                      <Pressable
                        onPress={endRest}
                        accessibilityRole="button"
                        accessibilityLabel="Salta il recupero"
                        className="flex-row cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-background/60 px-3.5 py-2.5 active:opacity-80"
                      >
                        <SkipForward size={16} color="#94A3B8" strokeWidth={2.2} />
                        <Text className="font-inter-semibold text-sm text-muted">Salta</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}

                {/* Modifica al volo: solo questa sessione, la scheda non cambia */}
                {editing ? (
                  <ExerciseEditPanel
                    key={current.id}
                    exercise={current}
                    onPatch={patchCurrentExercise}
                    onReplace={() => setReplacing(true)}
                    onClose={() => setEditing(false)}
                  />
                ) : null}

                {/* Serie */}
                <View className="mt-4 gap-2">
                  {currentLog.map((set, setIndex) => {
                    const isSetDone = set.completed;
                    return (
                      <View
                        key={`${current.id}-set-${setIndex}`}
                        className={`rounded-xl border p-3 ${
                          isSetDone
                            ? "border-accent/40 bg-accent/10"
                            : "border-border bg-background/40"
                        }`}
                      >
                        <View className="flex-row items-center gap-3">
                          {/* Checkbox completa serie */}
                          <Pressable
                            onPress={() => handleToggleSet(setIndex)}
                            accessibilityRole="checkbox"
                            accessibilityLabel={`Serie ${setIndex + 1} completata`}
                            accessibilityState={{ checked: isSetDone }}
                            className={`h-11 w-11 cursor-pointer items-center justify-center rounded-full border-2 ${
                              isSetDone ? "border-accent bg-accent" : "border-border bg-surface"
                            }`}
                          >
                            {isSetDone ? (
                              <Check size={20} color="#0F172A" strokeWidth={3} />
                            ) : null}
                          </Pressable>

                          <Text className="w-14 font-inter-semibold text-sm text-muted">
                            Serie {setIndex + 1}
                          </Text>

                          {/* Peso */}
                          <View className="flex-1">
                            <Text className="mb-1 font-sans text-xs text-muted">Peso (kg)</Text>
                            <TextInput
                              value={set.weight}
                              onChangeText={(text) => updateSet(setIndex, { weight: text })}
                              keyboardType={Platform.OS === "ios" ? "decimal-pad" : "numeric"}
                              accessibilityLabel={`Peso serie ${setIndex + 1} in chilogrammi`}
                              placeholder={current.weightKg > 0 ? String(current.weightKg) : "0"}
                              placeholderTextColor="#64748B"
                              className="rounded-lg border border-border bg-surface px-3 py-2 text-center font-sans text-foreground"
                            />
                          </View>

                          {/* Ripetizioni effettive */}
                          <View className="flex-1">
                            <Text className="mb-1 font-sans text-xs text-muted">Rep</Text>
                            <TextInput
                              value={set.reps}
                              onChangeText={(text) => updateSet(setIndex, { reps: text })}
                              keyboardType="number-pad"
                              accessibilityLabel={`Ripetizioni effettive serie ${setIndex + 1}`}
                              placeholder={String(current.reps)}
                              placeholderTextColor="#64748B"
                              className="rounded-lg border border-border bg-surface px-3 py-2 text-center font-sans text-foreground"
                            />
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>

        {/* Navigazione libera fra gli esercizi */}
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => goTo(index - 1)}
            disabled={index === 0}
            accessibilityRole="button"
            accessibilityLabel="Esercizio precedente"
            className={`flex-1 flex-row cursor-pointer items-center justify-center gap-1 rounded-xl border border-border bg-background/60 py-3.5 ${
              index === 0 ? "opacity-40" : "active:opacity-80"
            }`}
          >
            <ChevronLeft size={18} color="#94A3B8" strokeWidth={2.2} />
            <Text className="font-inter-semibold text-sm text-muted">Precedente</Text>
          </Pressable>
          <Pressable
            onPress={() => goTo(index + 1)}
            disabled={index === exercises.length - 1}
            accessibilityRole="button"
            accessibilityLabel="Esercizio successivo"
            className={`flex-1 flex-row cursor-pointer items-center justify-center gap-1 rounded-xl border border-border bg-background/60 py-3.5 ${
              index === exercises.length - 1 ? "opacity-40" : "active:opacity-80"
            }`}
          >
            <Text className="font-inter-semibold text-sm text-muted">Successivo</Text>
            <ChevronRight size={18} color="#94A3B8" strokeWidth={2.2} />
          </Pressable>
        </View>

        {/* Termina: sempre visibile in fondo, attivo con almeno una serie */}
        <View className="gap-2">
          <Pressable
            onPress={() => void handleFinish()}
            disabled={completedSets === 0 || createSession.isPending}
            accessibilityRole="button"
            accessibilityLabel="Termina allenamento"
            className={`flex-row cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent py-4 ${
              completedSets > 0 && !createSession.isPending ? "active:opacity-80" : "opacity-40"
            }`}
          >
            <Flag size={18} color="#0F172A" strokeWidth={2.5} />
            <Text className="font-inter-bold text-base text-primary-foreground">
              {createSession.isPending ? "Salvataggio…" : "Termina allenamento"}
            </Text>
          </Pressable>
          {completedSets === 0 ? (
            <Text className="text-center font-sans text-xs text-muted">
              Completa almeno una serie per terminare.
            </Text>
          ) : null}
        </View>

        {finishError ? (
          <Text className="text-center font-sans text-sm text-destructive">{finishError}</Text>
        ) : null}
      </ScrollView>

      <ReplaceExerciseModal
        visible={replacing}
        currentName={current.name}
        onSelect={(name) => patchCurrentExercise({ name })}
        onClose={() => setReplacing(false)}
      />
    </KeyboardAvoidingView>
  );
}

/**
 * Pannello di modifica di un esercizio **per la sola sessione**: serie,
 * ripetizioni, riposo e sostituzione quando il macchinario non è
 * disponibile. Il `key` è l'id dell'esercizio, così ogni passaggio ad
 * altro esercizio riparte dai valori giusti.
 */
function ExerciseEditPanel({
  exercise,
  onPatch,
  onReplace,
  onClose,
}: {
  exercise: SessionExercise;
  onPatch: (patch: Partial<SessionExercise>) => void;
  onReplace: () => void;
  onClose: () => void;
}) {
  const [sets, setSets] = useState(String(exercise.sets));
  const [reps, setReps] = useState(String(exercise.reps));
  const [rest, setRest] = useState(exercise.restSeconds ? String(exercise.restSeconds) : "");

  function changeSets(text: string) {
    setSets(text);
    const value = parseIntOrNull(text);
    if (value !== null) onPatch({ sets: Math.min(30, value) });
  }

  function changeReps(text: string) {
    setReps(text);
    const value = parseIntOrNull(text);
    if (value !== null) onPatch({ reps: Math.min(300, value) });
  }

  function changeRest(text: string) {
    setRest(text);
    const value = parseIntOrNull(text);
    // Riposo vuoto o 0 = "non indicato": il timer usa il default.
    onPatch({ restSeconds: value === null ? null : Math.min(3600, value) });
  }

  return (
    <View className="mt-3 gap-3 rounded-xl border border-border bg-background/60 p-3">
      <Text className="font-inter-semibold text-xs uppercase tracking-wide text-muted">
        Modifica per questa sessione
      </Text>

      <View className="flex-row gap-2">
        <NumberField
          label="Serie"
          value={sets}
          onChangeText={changeSets}
          accessibilityLabel={`Serie di ${exercise.name}`}
        />
        <NumberField
          label="Rip"
          value={reps}
          onChangeText={changeReps}
          accessibilityLabel={`Ripetizioni di ${exercise.name}`}
        />
        <NumberField
          label="Riposo (s)"
          value={rest}
          onChangeText={changeRest}
          accessibilityLabel={`Riposo di ${exercise.name}`}
        />
      </View>

      <Pressable
        onPress={onReplace}
        accessibilityRole="button"
        accessibilityLabel={`Sostituisci ${exercise.name}`}
        className="flex-row cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-surface py-3 active:opacity-80"
      >
        <ArrowLeftRight size={17} color="#F97316" strokeWidth={2.2} />
        <Text className="font-inter-semibold text-sm text-foreground">Sostituisci esercizio</Text>
      </Pressable>

      <View className="flex-row items-center gap-3">
        <Text className="flex-1 font-sans text-xs leading-4 text-muted">
          La scheda non cambia: vale solo per questa sessione.
        </Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          className="cursor-pointer rounded-lg bg-primary/15 px-4 py-2 active:opacity-80"
        >
          <Text className="font-inter-semibold text-sm text-primary">Fine</Text>
        </Pressable>
      </View>
    </View>
  );
}
