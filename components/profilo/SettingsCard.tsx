import { Platform, Switch, Text, View } from "react-native";
import { Card } from "@/components/home/Card";

type Props = {
  readOnly?: boolean;
  /** Preferenza "notifiche attive" salvata sul dispositivo. */
  enabled: boolean;
  /** Permesso di sistema: `null` finchè non è stato interrogato. */
  permission: boolean | null;
  onChange: (value: boolean) => void;
  /** Preferenza "riduci movimento" salvata sul dispositivo. */
  reduceMotion: boolean;
  onReduceMotionChange: (value: boolean) => void;
};

/**
 * Impostazioni dell'app: notifiche e riduci movimento.
 *
 * Conteneva anche l'interruttore della modalità scura, ma era finto: il
 * design system è dark-only (`Appearance.setColorScheme("dark")` in _layout),
 * quindi è stato tolto. Restano le notifiche, che controllano per davvero
 * i promemoria programmati sul dispositivo.
 *
 * Su browser non esistono notifiche locali programmate: l'interruttore
 * resta spento e lo spiega. "Riduci movimento" vale invece su ogni
 * piattaforma e disattiva le micro-animazioni dell'app (contatori, barre,
 * ring, entrate delle card).
 */
export function SettingsCard({
  readOnly = false,
  enabled,
  permission,
  onChange,
  reduceMotion,
  onReduceMotionChange,
}: Props) {
  const isWeb = Platform.OS === "web";
  const disabled = readOnly || isWeb;
  // Promemoria accesi solo con preferenza E permesso: un permesso negato
  // deve apparire spento, non finto acceso.
  const active = !isWeb && enabled && permission !== false;

  const caption = isWeb
    ? "Disponibile solo nell'app installata (Android/iOS)."
    : enabled && permission === false
      ? "Permesso non concesso: tocca l'interruttore per consentire le notifiche."
      : active
        ? "Riceverai un avviso nei giorni e negli orari dei promemoria attivi."
        : "I promemoria non ti avviseranno.";

  return (
    <Card className="gap-4">
      <Text className="font-inter-semibold text-base text-foreground">Impostazioni</Text>

      <View className="flex-row items-center justify-between gap-3 rounded-xl border border-border bg-background/40 px-4 py-3">
        <View className="flex-1 gap-0.5">
          <Text className="font-sans text-sm text-foreground">Notifiche</Text>
          <Text className="font-sans text-xs leading-4 text-muted">{caption}</Text>
        </View>
        <Switch
          value={active}
          onValueChange={disabled ? undefined : onChange}
          disabled={disabled}
          trackColor={{ true: "#F97316" }}
          thumbColor="#fff"
        />
      </View>

      <View className="flex-row items-center justify-between gap-3 rounded-xl border border-border bg-background/40 px-4 py-3">
        <View className="flex-1 gap-0.5">
          <Text className="font-sans text-sm text-foreground">Riduci movimento</Text>
          <Text className="font-sans text-xs leading-4 text-muted">
            Disattiva le animazioni: i numeri e le barre arrivano subito al valore finale.
          </Text>
        </View>
        <Switch
          value={reduceMotion}
          onValueChange={onReduceMotionChange}
          trackColor={{ true: "#F97316" }}
          thumbColor="#fff"
        />
      </View>
    </Card>
  );
}
