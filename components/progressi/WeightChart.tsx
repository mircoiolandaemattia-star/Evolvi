import { useState } from "react";
import { Text, View } from "react-native";
import Animated, {
  useAnimatedProps,
  useDerivedValue,
  withTiming,
  Easing,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import type { WeightPoint } from "@/lib/progressQueries";
import { CountUp } from "@/components/ui/CountUp";
import { useRevealProgress } from "@/lib/reveal";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  points: WeightPoint[];
  current: number;
  delta: number;
  goalOk: boolean;
};

export function WeightChart({ points, current, delta, goalOk }: Props) {
  const [containerW, setContainerW] = useState(0);
  const chartH = 160;
  const padL = 28;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const w = containerW > 0 ? containerW : 320;
  const h = chartH;

  if (points.length === 0) {
    return (
      <View className="items-center py-6">
        <Text className="font-sans text-sm text-muted">Nessun dato peso</Text>
      </View>
    );
  }

  const weights = points.map((p) => p.weight);
  const min = Math.min(...weights) - 0.5;
  const max = Math.max(...weights) + 0.5;
  const range = max - min || 1;

  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const x = (i: number) => padL + (i / Math.max(1, points.length - 1)) * plotW;
  const y = (v: number) => padT + (1 - (v - min) / range) * plotH;

  let d = "";
  points.forEach((p, i) => {
    const xi = x(i);
    const yi = y(p.weight);
    d += i === 0 ? `M ${xi} ${yi}` : ` L ${xi} ${yi}`;
  });

  // Lunghezza del polilinea: serve per il "disegno" della curva
  // (strokeDashoffset che scende a 0). È una serie di segmenti dritti, quindi
  // la somma delle ipotenuse è esatta.
  let pathLength = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = x(i) - x(i - 1);
    const dy = y(points[i].weight) - y(points[i - 1].weight);
    pathLength += Math.hypot(dx, dy);
  }

  const deltaLabel = `${delta > 0 ? "+" : ""}${delta.toFixed(1)} kg`;
  const deltaColor = goalOk ? "#22C55E" : "#EF4444";

  return (
    <WeightChartBody
      points={points}
      d={d}
      pathLength={pathLength}
      x={x}
      y={y}
      padL={padL}
      plotW={plotW}
      plotH={plotH}
      padT={padT}
      w={w}
      h={h}
      current={current}
      deltaLabel={deltaLabel}
      deltaColor={deltaColor}
      onLayoutWidth={setContainerW}
    />
  );
}

type BodyProps = {
  points: WeightPoint[];
  d: string;
  pathLength: number;
  x: (i: number) => number;
  y: (v: number) => number;
  padL: number;
  plotW: number;
  plotH: number;
  padT: number;
  w: number;
  h: number;
  current: number;
  deltaLabel: string;
  deltaColor: string;
  onLayoutWidth: (width: number) => void;
};

/** Corpo del grafico: separato perché i hook Reanimated devono stare in un componente. */
function WeightChartBody({
  points,
  d,
  pathLength,
  x,
  y,
  padL,
  plotW,
  plotH,
  padT,
  w,
  h,
  current,
  deltaLabel,
  deltaColor,
  onLayoutWidth,
}: BodyProps) {
  // 0→1 che riparte a ogni focus: la curva si "disegna" a ogni visita della tab.
  const draw = useRevealProgress(260, 900);

  const animatedPathProps = useAnimatedProps(() => ({
    strokeDashoffset: pathLength * (1 - draw.value),
  }));

  const total = Math.max(1, points.length - 1);

  return (
    <View className="gap-3">
      <View className="flex-row items-baseline gap-2">
        <Text className="font-inter-bold text-3xl text-foreground">
          <CountUp value={current} format={(v) => v.toFixed(1)} /> kg
        </Text>
        <Text style={{ color: deltaColor }} className="font-inter-semibold text-sm">
          {deltaLabel}
        </Text>
        <Text className="font-sans text-xs text-muted">vs inizio periodo</Text>
      </View>

      <View
        className="w-full overflow-hidden"
        onLayout={(e) => onLayoutWidth(e.nativeEvent.layout.width)}
        style={{ height: h, width: "100%" }}
      >
        <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          {/* horizontal grid */}
          {[0, 1, 2, 3].map((i) => {
            const gy = padT + (i / 3) * plotH;
            return <Line key={i} x1={padL} y1={gy} x2={padL + plotW} y2={gy} stroke="#334155" strokeOpacity={0.4} strokeWidth={1} strokeDasharray="4 4" />;
          })}
          {/* line: disegnata via strokeDashoffset che scende a 0 */}
          <AnimatedPath
            d={d}
            stroke="#F97316"
            strokeWidth={2.5}
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray={`${pathLength} ${pathLength}`}
            animatedProps={animatedPathProps}
          />
          {/* points: compaiono in scala appena passa la curva */}
          {points.map((p, i) => (
            <AnimatedPoint
              key={p.date}
              cx={x(i)}
              cy={y(p.weight)}
              draw={draw}
              start={0.1 + (i / total) * 0.75}
            />
          ))}
          {/* X labels: show subset to avoid crowding */}
          {points.map((p, i) => {
            const step = points.length > 12 ? Math.ceil(points.length / 6) : 1;
            if (i % step !== 0 && i !== points.length - 1) return null;
            return (
              <SvgText key={`lbl-${p.date}`} x={x(i)} y={h - 6} fill="#94A3B8" fontSize={10} textAnchor="middle">
                {p.label}
              </SvgText>
            );
          })}
        </Svg>
      </View>
    </View>
  );
}

/**
 * Punto del grafico: cresce in raggio appena la curva lo raggiunge.
 * `start` è la frazione di `draw` in cui comincia a comparire.
 */
function AnimatedPoint({
  cx,
  cy,
  draw,
  start,
}: {
  cx: number;
  cy: number;
  draw: SharedValue<number>;
  start: number;
}) {
  const progress = useDerivedValue(() => {
    if (draw.value <= start) return 0;
    return withTiming(Math.min(1, (draw.value - start) / 0.15), {
      duration: 120,
      easing: Easing.out(Easing.quad),
    });
  });

  const animatedProps = useAnimatedProps(() => ({
    r: 3.5 * progress.value,
    opacity: progress.value,
  }));

  return (
    <AnimatedCircle
      cx={cx}
      cy={cy}
      fill="#F97316"
      stroke="#0F172A"
      strokeWidth={1.5}
      animatedProps={animatedProps}
    />
  );
}
