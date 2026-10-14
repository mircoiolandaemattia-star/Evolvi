import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Card } from "@/components/home/Card";
import { birthDateFromParts } from "@/lib/profileQueries";

export type PersonalData = {
  name: string;
  birthDay: string;
  birthMonth: string;
  birthYear: string;
  weightKg: string;
  heightCm: string;
  gender: string;
};

type Props = {
  data: PersonalData;
  readOnly?: boolean;
  onSave: (d: PersonalData) => void;
};

const GENDER_OPTIONS: { key: string; label: string }[] = [
  { key: "male", label: "Maschio" },
  { key: "female", label: "Femmina" },
  { key: "other", label: "Altro" },
];

function formatGender(g: string): string {
  const found = GENDER_OPTIONS.find((o) => o.key === g);
  return found ? found.label : g?.trim() ? g : "—";
}

function formatValue(key: keyof PersonalData, value: string): string {
  const v = value?.trim();
  if (!v) return "—";
  if (key === "weightKg") return `${v} kg`;
  if (key === "heightCm") return `${v} cm`;
  if (key === "gender") return formatGender(v);
  return v;
}

function formatBirthDate(d: PersonalData): string {
  const date = birthDateFromParts(d.birthDay, d.birthMonth, d.birthYear);
  if (!date) return "—";
  return `${d.birthDay}/${d.birthMonth}/${d.birthYear}`;
}

/**
 * Raccoglie la data di nascita, non l'età: il backend deriva l'età dai
 * giorni precisi, mentre dall'età si ricavava un 1° gennaio e chi nasce a
 * dicembre restava un anno in più per quasi tutta l'annata.
 * Allineata al form di onboarding, che usa gli stessi tre campi.
 */
export function PersonalDataCard({ data, readOnly = false, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PersonalData>(data);

  // Sincronizza il draft quando arrivano dati nuovi dal server: aggiustamento
  // durante il render (pattern documentato da React) al posto dell'effect con
  // setState, che il lint vieta perché scatena render a cascata.
  const [prevData, setPrevData] = useState(data);
  if (data !== prevData) {
    setPrevData(data);
    setDraft(data);
  }

  const birthDateValid = Boolean(
    birthDateFromParts(draft.birthDay, draft.birthMonth, draft.birthYear),
  );

  function handleToggle() {
    if (editing) {
      // Data incompleta o impossibile (31/02): si resta in modifica, con
      // l'avviso sotto, invece di salvare un birthday inventato dal parser.
      if (!birthDateValid) return;
      onSave(draft);
      setEditing(false);
    } else {
      setDraft(data);
      setEditing(true);
    }
  }

  return (
    <Card className="gap-4">
      <View className="flex-row items-center justify-between">
        <Text className="font-inter-semibold text-base text-foreground">Dati personali</Text>
        {!readOnly ? (
          <Pressable onPress={handleToggle} className={`rounded-full px-4 py-2 active:opacity-80 ${editing ? "bg-primary" : "border border-border bg-background/40"}`}>
            <Text className={`font-inter-semibold text-sm ${editing ? "text-primary-foreground" : "text-muted"}`}>{editing ? "Salva" : "Modifica"}</Text>
          </Pressable>
        ) : null}
      </View>

      <View className="gap-3">
        {/* Nome */}
        <View className="flex-row items-center gap-3 rounded-xl border border-border bg-background/40 px-3 py-3">
          <Text className="w-28 font-sans text-sm text-muted">Nome</Text>
          {editing ? (
            <TextInput
              value={draft.name}
              onChangeText={(t) => setDraft((p) => ({ ...p, name: t }))}
              placeholder="Il tuo nome"
              placeholderTextColor="#64748B"
              className="flex-1 font-sans text-sm text-foreground"
            />
          ) : (
            <Text className="flex-1 font-inter-semibold text-sm text-foreground">{formatValue("name", draft.name)}</Text>
          )}
        </View>

        {/* Nascita */}
        <View className="gap-1.5">
          <View className="flex-row items-center gap-3 rounded-xl border border-border bg-background/40 px-3 py-3">
            <Text className="w-28 font-sans text-sm text-muted">Nascita</Text>
            {editing ? (
              <View className="flex-1 flex-row items-center gap-1.5">
                <TextInput
                  value={draft.birthDay}
                  onChangeText={(t) => setDraft((p) => ({ ...p, birthDay: t.replace(/[^0-9]/g, "").slice(0, 2) }))}
                  placeholder="GG"
                  placeholderTextColor="#64748B"
                  keyboardType="number-pad"
                  className="w-12 font-sans text-sm text-foreground"
                />
                <TextInput
                  value={draft.birthMonth}
                  onChangeText={(t) => setDraft((p) => ({ ...p, birthMonth: t.replace(/[^0-9]/g, "").slice(0, 2) }))}
                  placeholder="MM"
                  placeholderTextColor="#64748B"
                  keyboardType="number-pad"
                  className="w-12 font-sans text-sm text-foreground"
                />
                <TextInput
                  value={draft.birthYear}
                  onChangeText={(t) => setDraft((p) => ({ ...p, birthYear: t.replace(/[^0-9]/g, "").slice(0, 4) }))}
                  placeholder="AAAA"
                  placeholderTextColor="#64748B"
                  keyboardType="number-pad"
                  className="flex-1 font-sans text-sm text-foreground"
                />
              </View>
            ) : (
              <Text className="flex-1 font-inter-semibold text-sm text-foreground">{formatBirthDate(data)}</Text>
            )}
          </View>
          {editing && !birthDateValid ? (
            <Text className="px-1 font-sans text-xs text-destructive">
              Giorno, mese e anno non formano una data valida.
            </Text>
          ) : null}
        </View>

        {/* Peso */}
        <View className="flex-row items-center gap-3 rounded-xl border border-border bg-background/40 px-3 py-3">
          <Text className="w-28 font-sans text-sm text-muted">Peso</Text>
          {editing ? (
            <View className="flex-1 flex-row items-center gap-2">
              <TextInput
                value={draft.weightKg}
                onChangeText={(t) => setDraft((p) => ({ ...p, weightKg: t.replace(/[^0-9.,]/g, "").replace(",", ".") }))}
                placeholder="72"
                placeholderTextColor="#64748B"
                keyboardType="decimal-pad"
                className="flex-1 font-sans text-sm text-foreground"
              />
              <Text className="font-sans text-sm text-muted">kg</Text>
            </View>
          ) : (
            <Text className="flex-1 font-inter-semibold text-sm text-foreground">{formatValue("weightKg", data.weightKg)}</Text>
          )}
        </View>

        {/* Altezza */}
        <View className="flex-row items-center gap-3 rounded-xl border border-border bg-background/40 px-3 py-3">
          <Text className="w-28 font-sans text-sm text-muted">Altezza</Text>
          {editing ? (
            <View className="flex-1 flex-row items-center gap-2">
              <TextInput
                value={draft.heightCm}
                onChangeText={(t) => setDraft((p) => ({ ...p, heightCm: t.replace(/[^0-9]/g, "") }))}
                placeholder="175"
                placeholderTextColor="#64748B"
                keyboardType="number-pad"
                className="flex-1 font-sans text-sm text-foreground"
              />
              <Text className="font-sans text-sm text-muted">cm</Text>
            </View>
          ) : (
            <Text className="flex-1 font-inter-semibold text-sm text-foreground">{formatValue("heightCm", data.heightCm)}</Text>
          )}
        </View>

        {/* Sesso - bottoni in modifica, testo italiano in visualizzazione */}
        <View className={`gap-2 rounded-xl border border-border bg-background/40 px-3 py-3 ${editing ? "" : "flex-row items-center gap-3"}`}>
          <Text className={`${editing ? "font-sans text-sm text-muted" : "w-28 font-sans text-sm text-muted"}`}>Sesso</Text>
          {editing ? (
            <View className="flex-row gap-2">
              {GENDER_OPTIONS.map((o) => {
                const active = draft.gender === o.key;
                return (
                  <Pressable
                    key={o.key}
                    onPress={() => setDraft((p) => ({ ...p, gender: o.key }))}
                    className={`flex-1 items-center rounded-full border px-3 py-2.5 active:opacity-80 ${active ? "border-primary bg-primary" : "border-border bg-surface"}`}
                  >
                    <Text className={`font-inter-semibold text-sm ${active ? "text-primary-foreground" : "text-muted"}`}>{o.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text className="flex-1 font-inter-semibold text-sm text-foreground">{formatValue("gender", data.gender)}</Text>
          )}
        </View>
      </View>
    </Card>
  );
}
