import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Check, Search, X } from "lucide-react-native";
import { MOCK_EXERCISE_LIBRARY, WORKOUT_EQUIPMENT_OPTIONS } from "@/lib/mock-data";

type ReplaceExerciseModalProps = {
  visible: boolean;
  /** Esercizio attuale: in cima alla lista con il segno di spunta. */
  currentName: string;
  onSelect: (name: string) => void;
  onClose: () => void;
};

/** Etichetta leggibile della chiave attrezzatura (es. "manubri"). */
function equipmentLabel(key: string): string {
  return WORKOUT_EQUIPMENT_OPTIONS.find((option) => option.key === key)?.label ?? key;
}

/**
 * Sostituzione di un esercizio **durante la sessione**: lista della libreria
 * raggruppata per gruppo muscolare, con ricerca e attrezzatura richiesta
 * (serve quando il macchinario è occupato o non c'è).
 *
 * La scelta tocca solo la sessione in corso: la scheda resta quella
 * impostata in origine.
 */
export function ReplaceExerciseModal({
  visible,
  currentName,
  onSelect,
  onClose,
}: ReplaceExerciseModalProps) {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const search = query.trim().toLowerCase();
    const map = new Map<string, typeof MOCK_EXERCISE_LIBRARY>();
    for (const item of MOCK_EXERCISE_LIBRARY) {
      const matches =
        !search ||
        item.name.toLowerCase().includes(search) ||
        item.muscleGroups.some((group) => group.toLowerCase().includes(search));
      if (!matches) continue;
      const group = item.muscleGroups[0] ?? "Altri";
      map.set(group, [...(map.get(group) ?? []), item]);
    }
    return Array.from(map.entries());
  }, [query]);

  const nothingFound = groups.length === 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType={Platform.OS === "web" ? "none" : "slide"}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <View
          className="flex-1 bg-black/60"
          style={{ justifyContent: "flex-end", alignItems: "center" }}
        >
          <View className="w-full max-w-md overflow-hidden rounded-t-3xl border border-border bg-surface">
            <View className="flex-row items-center gap-1 border-b border-border px-3 py-2">
              <Text className="flex-1 font-inter-bold text-lg text-foreground">
                Sostituisci esercizio
              </Text>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Chiudi"
                className="h-11 w-11 cursor-pointer items-center justify-center rounded-lg active:opacity-80"
              >
                <X size={20} color="#94A3B8" strokeWidth={2.2} />
              </Pressable>
            </View>

            <View className="px-4 pt-4">
              <View className="flex-row items-center gap-2 rounded-lg border border-border bg-background/60 px-3">
                <Search size={16} color="#94A3B8" strokeWidth={2.2} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Cerca per esercizio o muscolo…"
                  placeholderTextColor="#64748B"
                  accessibilityLabel="Cerca un esercizio"
                  className="flex-1 py-2.5 font-sans text-sm text-foreground"
                />
                {query ? (
                  <Pressable
                    onPress={() => setQuery("")}
                    accessibilityRole="button"
                    accessibilityLabel="Cancella ricerca"
                    hitSlop={8}
                    className="cursor-pointer p-1 active:opacity-60"
                  >
                    <X size={14} color="#94A3B8" strokeWidth={2.4} />
                  </Pressable>
                ) : null}
              </View>
              <Text className="mt-2 font-sans text-xs text-muted">
                Vale solo per questa sessione: la scheda non cambia.
              </Text>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerClassName="gap-4 p-4 pb-8"
            >
              {nothingFound ? (
                <Text className="py-6 text-center font-sans text-sm text-muted">
                  Nessun esercizio per “{query}”.
                </Text>
              ) : (
                groups.map(([group, items]) => (
                  <View key={group} className="gap-1">
                    <Text className="font-inter-semibold text-xs uppercase tracking-wide text-muted">
                      {group}
                    </Text>
                    {items.map((item) => {
                      const selected = item.name === currentName;
                      return (
                        <Pressable
                          key={item.id}
                          onPress={() => {
                            if (selected) return;
                            onSelect(item.name);
                            onClose();
                          }}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          accessibilityLabel={`Sostituisci con ${item.name}`}
                          className="flex-row cursor-pointer items-center gap-3 rounded-xl border border-border bg-background/40 p-3 active:opacity-80"
                        >
                          <View className="flex-1">
                            <Text className="font-inter-semibold text-sm text-foreground">
                              {item.name}
                            </Text>
                            <Text className="mt-0.5 font-sans text-xs text-muted">
                              {item.sets}×{item.reps}
                              {item.equipment.length
                                ? ` · ${item.equipment.map(equipmentLabel).join(", ")}`
                                : ""}
                            </Text>
                          </View>
                          {selected ? (
                            <Check size={18} color="#22C55E" strokeWidth={2.6} />
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
