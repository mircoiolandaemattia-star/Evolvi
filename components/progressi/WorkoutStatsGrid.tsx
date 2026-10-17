import { Text, View } from "react-native";
import { Clock, Trophy } from "lucide-react-native";
import { CountUp } from "@/components/ui/CountUp";
import { Reveal } from "@/lib/reveal";

type Props = {
  sessions: number;
  hours: number;
};

export function WorkoutStatsGrid({ sessions, hours }: Props) {
  return (
    <View className="flex-row gap-3">
      <Reveal delay={0} className="flex-1" distance={14}>
        <View className="items-center gap-1 rounded-2xl border border-border bg-background/40 px-3 py-4">
          <View className="h-9 w-9 items-center justify-center rounded-xl bg-accent/15">
            <Trophy size={18} color="#22C55E" strokeWidth={2.2} />
          </View>
          <Text className="font-inter-bold text-lg text-foreground">
            <CountUp value={sessions} />
          </Text>
          <Text className="text-center font-sans text-xs leading-3 text-muted">sessioni</Text>
        </View>
      </Reveal>
      <Reveal delay={90} className="flex-1" distance={14}>
        <View className="items-center gap-1 rounded-2xl border border-border bg-background/40 px-3 py-4">
          <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#38BDF8]/15">
            <Clock size={18} color="#38BDF8" strokeWidth={2.2} />
          </View>
          <Text className="font-inter-bold text-lg text-foreground">
            <CountUp value={hours} />h
          </Text>
          <Text className="text-center font-sans text-xs leading-3 text-muted">ore totali</Text>
        </View>
      </Reveal>
    </View>
  );
}
