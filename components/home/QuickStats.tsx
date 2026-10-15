import { View, Text } from "react-native";
import { Clock, Dumbbell, Flame } from "lucide-react-native";
import type { QuickStats as QuickStatsData } from "@/lib/mock-data";
import { CountUp } from "@/components/ui/CountUp";
import { Card } from "./Card";

type QuickStatsProps = {
  stats: QuickStatsData;
};

function StatItem({
  icon,
  value,
  label,
  accentClassName,
}: {
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string;
  accentClassName: string;
}) {
  return (
    <View className="flex-1 items-center gap-2 rounded-xl bg-background/60 px-2 py-4">
      <View className={`h-10 w-10 items-center justify-center rounded-full ${accentClassName}`}>
        {icon}
      </View>
      <Text className="font-inter-bold text-lg text-foreground">{value}</Text>
      <Text className="text-center font-sans text-xs leading-4 text-muted">{label}</Text>
    </View>
  );
}

/**
 * Tre card affiancate: streak dei pasti, ore settimanali, sessioni totali.
 * I tre numeri salgono al contatore scaglionati, così la card sembra
 * "calcolare" le statistiche appena appare.
 *
 * La streak misura i giorni consecutivi con **almeno un pasto registrato**
 * nel diario (non le sessioni in palestra).
 */
export function QuickStats({ stats }: QuickStatsProps) {
  return (
    <Card delay={390}>
      <Text className="font-inter-semibold text-base text-foreground">Statistiche</Text>
      <View className="mt-4 flex-row gap-2">
        <StatItem
          icon={<Flame size={18} color="#F97316" strokeWidth={2.2} />}
          value={
            <CountUp
              value={stats.streakDays}
              format={(v) => `${Math.round(v)} gg`}
              className="font-inter-bold text-lg text-foreground"
            />
          }
          label="Streak pasti"
          accentClassName="bg-primary/15"
        />
        <StatItem
          icon={<Clock size={18} color="#22C55E" strokeWidth={2.2} />}
          value={
            <CountUp
              value={stats.weeklyHours}
              format={(v) => (Number.isInteger(v) ? `${v}h` : `${v.toFixed(1)}h`)}
              delay={90}
              className="font-inter-bold text-lg text-foreground"
            />
          }
          label="Questa settimana"
          accentClassName="bg-accent/15"
        />
        <StatItem
          icon={<Dumbbell size={18} color="#38BDF8" strokeWidth={2.2} />}
          value={
            <CountUp
              value={stats.totalSessions}
              delay={180}
              className="font-inter-bold text-lg text-foreground"
            />
          }
          label="Sessioni totali"
          accentClassName="bg-sky-500/15"
        />
      </View>
    </Card>
  );
}
